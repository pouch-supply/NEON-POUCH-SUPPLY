// wordpay.ts
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma';

const router = Router();

// Worldpay HPP Configuration - Using official Worldpay Access API
const WORLDPAY_ENTITY_ID = process.env.WORLDPAY_ENTITY_ID || '';
const WORLDPAY_CHECKOUT_ID = process.env.WORLDPAY_CHECKOUT_ID || '';
const WORLDPAY_API_USERNAME = process.env.WORLDPAY_API_USERNAME || '';
const WORLDPAY_API_PASSWORD = process.env.WORLDPAY_API_PASSWORD || '';
const WORLDPAY_WEBHOOK_SECRET = process.env.WORLDPAY_WEBHOOK_SECRET || '';
const WORLDPAY_ENVIRONMENT = (process.env.WORLDPAY_ENVIRONMENT || 'live').toLowerCase();
const WORLDPAY_BASE_URL = (process.env.WORLDPAY_BASE_URL || 
  (WORLDPAY_ENVIRONMENT === 'live' ? 'https://access.worldpay.com' : 'https://try.access.worldpay.com')
).replace(/\/+$/, '');

// Official Worldpay Access API endpoints
const WORLDPAY_API_ENDPOINTS = {
  SESSIONS: `${WORLDPAY_BASE_URL}/sessions`,
  PAYMENTS: `${WORLDPAY_BASE_URL}/payments`,
  ORDERS: `${WORLDPAY_BASE_URL}/orders`,
};

// Webhook event types from official Worldpay documentation
type WorldpayWebhookEvent = {
  id: string;
  type: 'payment.authorized' | 'payment.captured' | 'payment.settled' | 'payment.failed' | 'payment.refunded';
  created: string;
  data: {
    id: string;
    type: 'payment';
    attributes: {
      amount: number;
      currency: string;
      status: 'authorized' | 'captured' | 'settled' | 'failed' | 'refunded';
      reference: string;
      transactionId: string;
      authCode?: string;
      paymentMethod: {
        type: string;
        card?: {
          brand: string;
          last4: string;
          expiryMonth: number;
          expiryYear: number;
        };
      };
      customer: {
        email?: string;
        name?: string;
      };
      metadata?: {
        orderId: string;
      };
    };
  };
};

// Helper to verify Worldpay Webhook Signatures
function verifyWorldpaySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    console.warn('[Worldpay] Missing signature or secret');
    return false;
  }

  try {
    // Worldpay uses HMAC-SHA256 with the webhook secret
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(computedHmac, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (err) {
    console.error('[Worldpay] Signature verification error:', err);
    return false;
  }
}

// Helper to update order payment status - Prisma only
async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'Paid' | 'Failed' | 'Pending' | 'Refunded',
  details: {
    transactionId: string;
    authCode?: string;
    cardBrand?: string;
    cardLast4?: string;
    paymentMethod?: string;
    webhookEventId?: string;
  }
) {
  try {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      console.error(`[Worldpay] Order ${orderId} not found in database`);
      return null;
    }

    // Prevent duplicate webhook processing
    if (existingOrder.paymentStatus === 'Paid' && paymentStatus === 'Paid') {
      console.log(`[Worldpay] Order ${orderId} is already paid. Skipping duplicate webhook.`);
      return existingOrder;
    }

    // Prevent processing old webhook events
    if (existingOrder.webhookEventId && details.webhookEventId && 
        existingOrder.webhookEventId === details.webhookEventId) {
      console.log(`[Worldpay] Order ${orderId} webhook event ${details.webhookEventId} already processed.`);
      return existingOrder;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        worldpayTxId: details.transactionId || existingOrder.worldpayTxId,
        worldpayAuthCode: details.authCode || existingOrder.worldpayAuthCode,
        gatewayTxId: details.transactionId || existingOrder.gatewayTxId,
        gatewayAuthCode: details.authCode || existingOrder.gatewayAuthCode,
        cardBrand: details.cardBrand || existingOrder.cardBrand,
        cardLast4: details.cardLast4 || existingOrder.cardLast4,
        paymentMethod: details.paymentMethod || existingOrder.paymentMethod,
        webhookEventId: details.webhookEventId || existingOrder.webhookEventId,
        updatedAt: new Date()
      }
    });

    console.log(`[Worldpay] Order ${orderId} payment status updated to '${paymentStatus}'`);
    return updatedOrder;
  } catch (error) {
    console.error(`[Worldpay] Failed to update order ${orderId}:`, error);
    throw error;
  }
}

// GET /api/worldpay/config - Configuration status
router.get('/config', (_req: Request, res: Response) => {
  const isConfigured = Boolean(
    WORLDPAY_ENTITY_ID &&
    WORLDPAY_API_USERNAME &&
    WORLDPAY_API_PASSWORD
  );

  res.json({
    active: true,
    isConfigured,
    platform: 'Worldpay Access API',
    environment: WORLDPAY_ENVIRONMENT,
    entityIdMasked: WORLDPAY_ENTITY_ID ? `${WORLDPAY_ENTITY_ID.substring(0, 4)}***` : 'Not Configured',
    checkoutIdMasked: WORLDPAY_CHECKOUT_ID ? `${WORLDPAY_CHECKOUT_ID.substring(0, 6)}***` : 'Not Configured',
    provider: 'Worldpay Access'
  });
});

// POST /api/worldpay/session - Create Worldpay HPP Session
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { orderId, amount, customerEmail, customerName, items, destination } = req.body;

    // Validate required fields
    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Order ID and amount are required'
      });
    }

    if (!WORLDPAY_API_USERNAME || !WORLDPAY_API_PASSWORD || !WORLDPAY_ENTITY_ID) {
      console.error('[Worldpay] Missing API credentials');
      return res.status(500).json({
        success: false,
        error: 'Payment gateway is not properly configured'
      });
    }

    console.log(`[Worldpay] Creating session for Order: ${orderId}, Amount: £${amount}`);

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'localhost:3000';
    const amountInPence = Math.round(parseFloat(amount) * 100);

    // Official Worldpay Access API - Create Session
    const authHeader = 'Basic ' + Buffer.from(`${WORLDPAY_API_USERNAME}:${WORLDPAY_API_PASSWORD}`).toString('base64');

    const payload = {
      entity: WORLDPAY_ENTITY_ID,
      checkoutId: WORLDPAY_CHECKOUT_ID || undefined,
      transaction: {
        reference: String(orderId),
        value: {
          amount: amountInPence,
          currency: 'GBP'
        },
        description: `Order ${orderId} - Pouch Supply`
      },
      customer: {
        email: customerEmail || undefined,
        name: customerName || undefined
      },
      returnUrls: {
        success: `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}&status=SUCCESS`,
        cancel: `${protocol}://${host}/payment/cancelled?orderId=${encodeURIComponent(orderId)}`,
        failure: `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}&status=FAILED`
      },
      hpp: {
        display: {
          language: 'en',
          theme: 'default'
        },
        paymentMethods: ['VISA', 'MASTERCARD', 'MAESTRO', 'AMEX']
      }
    };

    // Call official Worldpay Access API endpoint
    const response = await fetch(WORLDPAY_API_ENDPOINTS.SESSIONS, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[Worldpay] Session creation failed:', responseData);
      return res.status(response.status).json({
        success: false,
        error: responseData.message || responseData.description || 'Failed to create session',
        code: responseData.code || 'WORLDPAY_SESSION_ERROR',
        details: responseData
      });
    }

    // Extract HPP redirect URL from official response
    const redirectUrl = responseData._links?.checkout?.href || 
                        responseData.redirectUrl || 
                        responseData._links?.self?.href;

    if (!redirectUrl) {
      console.error('[Worldpay] No redirect URL in response:', responseData);
      return res.status(500).json({
        success: false,
        error: 'No redirect URL received from payment gateway'
      });
    }

    // Store session in database for reference
    await prisma.paymentSession.create({
      data: {
        id: responseData.id || `session_${orderId}`,
        orderId,
        sessionData: responseData,
        status: 'PENDING',
        createdAt: new Date()
      }
    }).catch(error => {
      console.warn('[Worldpay] Failed to store session in DB:', error);
    });

    return res.json({
      success: true,
      sessionId: responseData.id,
      redirectUrl,
      checkoutId: WORLDPAY_CHECKOUT_ID || WORLDPAY_ENTITY_ID,
      provider: 'Worldpay Access'
    });

  } catch (error: any) {
    console.error('[Worldpay] Session creation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize payment session'
    });
  }
});

// GET & POST /api/worldpay/callback - Shopper return handler
const handleWorldpayCallback = async (req: Request, res: Response) => {
  const params = req.method === 'POST' ? req.body : req.query;
  const orderId = params.orderId as string;
  const status = (params.status || '').toUpperCase();

  console.log(`[Worldpay] Callback received for Order: ${orderId}, Status: ${status}`);

  if (!orderId) {
    console.warn('[Worldpay] No orderId in callback');
    return res.redirect('/payment/failed?reason=missing_order');
  }

  // IMPORTANT: Callback is just for redirecting - webhook handles actual payment status
  // Only update status if we have explicit failure from return URL
  if (status === 'FAILED' || status === 'CANCELLED') {
    try {
      await updateOrderPaymentStatus(orderId, 'Failed', {
        transactionId: `CALLBACK_${orderId}`,
        authCode: 'CALLBACK_DECLINED'
      });
    } catch (error) {
      console.error('[Worldpay] Failed to update order status:', error);
    }
    return res.redirect(`/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=payment_declined`);
  }

  // For SUCCESS, redirect to success page but don't mark as paid
  // Webhook will update the actual payment status
  if (status === 'SUCCESS') {
    return res.redirect(`/payment/processing?orderId=${encodeURIComponent(orderId)}`);
  }

  // Default redirect for unknown status
  return res.redirect(`/payment/processing?orderId=${encodeURIComponent(orderId)}`);
};

router.get('/callback', handleWorldpayCallback);
router.post('/callback', handleWorldpayCallback);

// POST /api/worldpay/webhook - Official Worldpay Webhook Handler
router.post('/webhook', async (req: Request, res: Response) => {
  let rawBody: string;

  try {
    // Get raw body for signature verification
    rawBody = (req as any).rawBody?.toString('utf-8') || JSON.stringify(req.body);
  } catch (error) {
    console.error('[Worldpay] Failed to read raw body');
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-worldpay-signature'] as string;
    
    if (WORLDPAY_WEBHOOK_SECRET) {
      if (!signature) {
        console.warn('[Worldpay] Missing webhook signature');
        return res.status(401).json({ error: 'Unauthorized: Missing signature' });
      }

      const isValid = verifyWorldpaySignature(rawBody, signature, WORLDPAY_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn('[Worldpay] Invalid webhook signature');
        return res.status(403).json({ error: 'Forbidden: Invalid signature' });
      }
      console.log('[Worldpay] Webhook signature verified');
    }

    // Parse official Worldpay webhook payload
    const event = req.body as WorldpayWebhookEvent;

    // Validate webhook structure
    if (!event || !event.type || !event.data) {
      console.warn('[Worldpay] Invalid webhook payload structure');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Only process payment events
    if (!event.type.startsWith('payment.')) {
      console.log(`[Worldpay] Ignoring non-payment event: ${event.type}`);
      return res.status(200).json({ received: true, ignored: true });
    }

    // Extract order ID from metadata or reference
    const orderId = event.data.attributes?.metadata?.orderId || 
                    event.data.attributes?.reference;

    if (!orderId) {
      console.warn('[Worldpay] No order ID in webhook payload');
      return res.status(200).json({ received: true, ignored: true });
    }

    // Extract payment details
    const { attributes } = event.data;
    const eventId = event.id;
    const paymentStatus = attributes.status;
    const transactionId = attributes.transactionId || event.data.id;
    const authCode = attributes.authCode;
    const cardBrand = attributes.paymentMethod?.card?.brand;
    const cardLast4 = attributes.paymentMethod?.card?.last4;
    const paymentMethod = attributes.paymentMethod?.type;

    console.log(`[Worldpay] Processing webhook: Order ${orderId}, Status: ${paymentStatus}`);

    // Map Worldpay status to our status
    let orderStatus: 'Paid' | 'Failed' | 'Pending' | 'Refunded' = 'Pending';
    
    switch (paymentStatus) {
      case 'authorized':
      case 'captured':
      case 'settled':
        orderStatus = 'Paid';
        break;
      case 'failed':
        orderStatus = 'Failed';
        break;
      case 'refunded':
        orderStatus = 'Refunded';
        break;
      default:
        console.log(`[Worldpay] Unhandled payment status: ${paymentStatus}`);
        return res.status(200).json({ received: true, ignored: true });
    }

    // Update order with webhook data
    await updateOrderPaymentStatus(orderId, orderStatus, {
      transactionId,
      authCode,
      cardBrand,
      cardLast4,
      paymentMethod,
      webhookEventId: eventId
    });

    // Store webhook for audit trail
    await prisma.webhookEvent.create({
      data: {
        id: eventId,
        type: event.type,
        orderId,
        payload: event,
        processedAt: new Date()
      }
    }).catch(error => {
      console.warn('[Worldpay] Failed to store webhook event:', error);
    });

    // Return 200 OK to acknowledge receipt
    return res.status(200).json({ 
      received: true, 
      processed: true,
      orderId,
      status: orderStatus
    });

  } catch (error: any) {
    console.error('[Worldpay] Webhook processing error:', error);
    
    // Always return 200 to prevent retries
    // But log the error for debugging
    return res.status(200).json({ 
      received: true, 
      processed: false, 
      error: error.message 
    });
  }
});

// GET /api/worldpay/status - Check order payment status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const orderId = req.query.orderId as string;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        worldpayTxId: true,
        worldpayAuthCode: true,
        gatewayTxId: true,
        gatewayAuthCode: true,
        cardBrand: true,
        paymentMethod: true,
        updatedAt: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      orderId: order.id,
      paid: order.paymentStatus === 'Paid',
      status: order.paymentStatus,
      transactionId: order.worldpayTxId || order.gatewayTxId,
      authCode: order.worldpayAuthCode || order.gatewayAuthCode,
      cardBrand: order.cardBrand,
      paymentMethod: order.paymentMethod,
      updatedAt: order.updatedAt
    });

  } catch (error: any) {
    console.error('[Worldpay] Status check error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to check payment status' 
    });
  }
});

// GET /api/worldpay/order/:id - Get order details
router.get('/order/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(order);

  } catch (error: any) {
    console.error('[Worldpay] Order fetch error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch order' 
    });
  }
});

export default router;