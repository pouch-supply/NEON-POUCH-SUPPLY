import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma';
import { fetchResource, saveResource } from '../../serverDb';

const router = Router();

// Worldpay Configuration - Using official Worldpay Access API
const WORLDPAY_ENTITY_ID = process.env.WORLDPAY_ENTITY_ID || '';
const WORLDPAY_CHECKOUT_ID = process.env.WORLDPAY_CHECKOUT_ID || '';
const WORLDPAY_API_USERNAME = process.env.WORLDPAY_API_USERNAME || '';
const WORLDPAY_API_PASSWORD = process.env.WORLDPAY_API_PASSWORD || '';
const WORLDPAY_WEBHOOK_SECRET = process.env.WORLDPAY_WEBHOOK_SECRET || '';
const WORLDPAY_ENVIRONMENT = (process.env.WORLDPAY_ENVIRONMENT || 'live').toLowerCase();
const WORLDPAY_BASE_URL = (process.env.WORLDPAY_BASE_URL || 
  (WORLDPAY_ENVIRONMENT === 'live' ? 'https://access.worldpay.com' : 'https://try.access.worldpay.com')
).replace(/\/+$/, '');

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
      paymentMethod?: {
        type?: string;
        card?: {
          brand?: string;
          last4?: string;
          expiryMonth?: number;
          expiryYear?: number;
        };
      };
      customer?: {
        email?: string;
        name?: string;
      };
      metadata?: {
        orderId?: string;
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
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(computedHmac, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (err) {
    console.error('[Worldpay] Signature verification error:', err);
    return false;
  }
}

// Helper to update order payment status in Prisma and StoreResource
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
  let updatedOrder: any = null;

  // 1. Try Prisma first
  try {
    const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });

    if (existingOrder) {
      if (existingOrder.paymentStatus === 'Paid' && paymentStatus === 'Paid') {
        console.log(`[Worldpay] Order ${orderId} is already paid. Skipping duplicate update.`);
        return existingOrder;
      }

      const existingData = (existingOrder.data && typeof existingOrder.data === 'object') ? existingOrder.data : {};

      updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus,
          worldpayTxId: details.transactionId || existingOrder.worldpayTxId,
          worldpayAuthCode: details.authCode || existingOrder.worldpayAuthCode,
          gatewayTxId: details.transactionId || existingOrder.gatewayTxId,
          gatewayAuthCode: details.authCode || existingOrder.gatewayAuthCode,
          cardBrand: details.cardBrand || existingOrder.cardBrand || 'Card',
          data: {
            ...existingData,
            cardLast4: details.cardLast4,
            paymentMethod: details.paymentMethod,
            webhookEventId: details.webhookEventId
          }
        }
      });
      console.log(`[Worldpay] Order ${orderId} updated to '${paymentStatus}' in Prisma.`);
    }
  } catch (error: any) {
    console.warn(`[Worldpay] Prisma update warning for order ${orderId}:`, error?.message);
  }

  // 2. Sync to StoreResource / JSON database
  try {
    const currentOrders: any[] = (await fetchResource('orders')) || [];
    const idx = currentOrders.findIndex((o: any) => String(o.id) === String(orderId));
    if (idx !== -1) {
      currentOrders[idx].paymentStatus = paymentStatus;
      currentOrders[idx].worldpayTxId = details.transactionId || currentOrders[idx].worldpayTxId;
      currentOrders[idx].worldpayAuthCode = details.authCode || currentOrders[idx].worldpayAuthCode;
      currentOrders[idx].gatewayTxId = details.transactionId || currentOrders[idx].gatewayTxId;
      currentOrders[idx].gatewayAuthCode = details.authCode || currentOrders[idx].gatewayAuthCode;
      if (details.cardBrand) currentOrders[idx].cardBrand = details.cardBrand;
      await saveResource('orders', currentOrders);
      if (!updatedOrder) updatedOrder = currentOrders[idx];
      console.log(`[Worldpay] Order ${orderId} updated to '${paymentStatus}' in StoreResource.`);
    }
  } catch (resourceErr) {
    console.error(`[Worldpay] StoreResource update error for order ${orderId}:`, resourceErr);
  }

  return updatedOrder;
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

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Order ID and amount are required'
      });
    }

    if (!WORLDPAY_API_USERNAME || !WORLDPAY_API_PASSWORD || !WORLDPAY_ENTITY_ID) {
      console.error('[Worldpay] Missing API credentials in environment variables.');
      return res.status(500).json({
        success: false,
        error: 'Worldpay Access API credentials (WORLDPAY_ENTITY_ID, WORLDPAY_API_USERNAME, WORLDPAY_API_PASSWORD) are not configured.'
      });
    }

    console.log(`[Worldpay] Creating session for Order: ${orderId}, Amount: £${amount}`);

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'localhost:3000';
    const amountInPence = Math.round(parseFloat(amount) * 100);

    const primaryBaseUrl = WORLDPAY_BASE_URL;
    const fallbackBaseUrl = WORLDPAY_BASE_URL.includes('try.access.worldpay.com')
      ? 'https://access.worldpay.com'
      : 'https://try.access.worldpay.com';

    const baseUrls = Array.from(new Set([primaryBaseUrl, fallbackBaseUrl]));
    const authHeader = 'Basic ' + Buffer.from(`${WORLDPAY_API_USERNAME}:${WORLDPAY_API_PASSWORD}`).toString('base64');

    const successReturnUrl = `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}&status=SUCCESS`;
    const failureReturnUrl = `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}&status=FAILED`;
    const cancelReturnUrl = `${protocol}://${host}/payment/cancelled?orderId=${encodeURIComponent(orderId)}`;

    let lastStatus = 500;
    let lastErrorData: any = null;

    for (const baseUrl of baseUrls) {
      const extraHeaders: Record<string, string> = {
        'WP-Entity-Id': WORLDPAY_ENTITY_ID,
        'Entity-Id': WORLDPAY_ENTITY_ID
      };

      const attempts = [
        {
          url: `${baseUrl}/checkout/sessions`,
          contentType: 'application/vnd.worldpay.checkout-sessions-v1.hal+json',
          accept: 'application/vnd.worldpay.checkout-sessions-v1.hal+json, application/json',
          body: {
            entity: WORLDPAY_ENTITY_ID,
            ...(WORLDPAY_CHECKOUT_ID ? { checkoutId: WORLDPAY_CHECKOUT_ID } : {}),
            transaction: {
              reference: String(orderId),
              value: {
                amount: amountInPence,
                currency: 'GBP'
              },
              description: `Order ${orderId}`
            },
            customer: {
              email: customerEmail || undefined,
              name: customerName || undefined
            },
            returnUrls: {
              success: successReturnUrl,
              cancel: cancelReturnUrl,
              failure: failureReturnUrl
            }
          }
        },
        {
          url: `${baseUrl}/checkout/sessions`,
          contentType: 'application/json',
          accept: 'application/json, application/vnd.worldpay.checkout-sessions-v1.hal+json',
          body: {
            entity: WORLDPAY_ENTITY_ID,
            ...(WORLDPAY_CHECKOUT_ID ? { checkoutId: WORLDPAY_CHECKOUT_ID } : {}),
            transaction: {
              reference: String(orderId),
              value: {
                amount: amountInPence,
                currency: 'GBP'
              }
            },
            customer: {
              email: customerEmail || undefined,
              name: customerName || undefined
            },
            returnUrls: {
              success: successReturnUrl,
              cancel: cancelReturnUrl,
              failure: failureReturnUrl
            }
          }
        },
        {
          url: `${baseUrl}/sessions`,
          contentType: 'application/vnd.worldpay.sessions-v1.hal+json',
          accept: 'application/vnd.worldpay.sessions-v1.hal+json, application/json',
          body: {
            entity: WORLDPAY_ENTITY_ID,
            ...(WORLDPAY_CHECKOUT_ID ? { checkoutId: WORLDPAY_CHECKOUT_ID } : {}),
            transaction: {
              reference: String(orderId),
              value: {
                amount: amountInPence,
                currency: 'GBP'
              }
            }
          }
        }
      ];

      for (const attempt of attempts) {
        try {
          console.log(`[Worldpay API] POST ${attempt.url} (${attempt.contentType})`);
          const response = await fetch(attempt.url, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': attempt.contentType,
              'Accept': attempt.accept,
              ...extraHeaders
            },
            body: JSON.stringify(attempt.body)
          });

          lastStatus = response.status;
          const responseText = await response.text();
          let data: any = {};
          try {
            data = JSON.parse(responseText);
          } catch (_e) {
            data = { message: responseText };
          }

          console.log(`[Worldpay API] Response Status ${response.status}:`, JSON.stringify(data));

          if (response.ok) {
            const redirectUrl = 
              data._links?.checkout?.href || 
              data._links?.self?.href || 
              data._links?.redirect?.href || 
              data.redirectUrl || 
              data.url;

            if (redirectUrl) {
              return res.json({
                success: true,
                sessionId: data.id || data.sessionId || `WP-ACC-${orderId}`,
                redirectUrl,
                checkoutId: WORLDPAY_CHECKOUT_ID || WORLDPAY_ENTITY_ID,
                provider: 'Worldpay Access'
              });
            }
          }

          lastErrorData = data;
          if (response.status === 401 || response.status === 403) {
            break;
          }
        } catch (attemptErr: any) {
          console.warn(`[Worldpay API] Endpoint ${attempt.url} error:`, attemptErr.message);
          lastErrorData = { message: attemptErr.message };
        }
      }

      if (lastStatus === 401 || lastStatus === 403) {
        break;
      }
    }

    const rawMsg = 
      lastErrorData?.description || 
      lastErrorData?.message || 
      lastErrorData?.title || 
      lastErrorData?.error || 
      (typeof lastErrorData === 'string' ? lastErrorData : JSON.stringify(lastErrorData));

    const formattedError = `Worldpay Access API Error (${lastStatus}): ${rawMsg || 'Session creation failed'}`;
    console.error(`[Worldpay Session Failed]: ${formattedError}`);

    return res.status(lastStatus >= 400 && lastStatus < 600 ? lastStatus : 400).json({
      success: false,
      error: formattedError,
      code: lastErrorData?.code || 'WORLDPAY_SESSION_ERROR',
      details: lastErrorData
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

  if (status === 'SUCCESS') {
    return res.redirect(`/payment/processing?orderId=${encodeURIComponent(orderId)}`);
  }

  return res.redirect(`/payment/processing?orderId=${encodeURIComponent(orderId)}`);
};

router.get('/callback', handleWorldpayCallback);
router.post('/callback', handleWorldpayCallback);

// POST /api/worldpay/webhook - Official Worldpay Webhook Handler
router.post('/webhook', async (req: Request, res: Response) => {
  let rawBody: string;

  try {
    rawBody = (req as any).rawBody?.toString('utf-8') || JSON.stringify(req.body);
  } catch (error) {
    console.error('[Worldpay] Failed to read raw body');
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
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

    const event = req.body as WorldpayWebhookEvent;

    if (!event || !event.type || !event.data) {
      console.warn('[Worldpay] Invalid webhook payload structure');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (!event.type.startsWith('payment.')) {
      console.log(`[Worldpay] Ignoring non-payment event: ${event.type}`);
      return res.status(200).json({ received: true, ignored: true });
    }

    const orderId = event.data.attributes?.metadata?.orderId || 
                    event.data.attributes?.reference;

    if (!orderId) {
      console.warn('[Worldpay] No order ID in webhook payload');
      return res.status(200).json({ received: true, ignored: true });
    }

    const { attributes } = event.data;
    const eventId = event.id;
    const paymentStatus = attributes.status;
    const transactionId = attributes.transactionId || event.data.id;
    const authCode = attributes.authCode;
    const cardBrand = attributes.paymentMethod?.card?.brand;
    const cardLast4 = attributes.paymentMethod?.card?.last4;
    const paymentMethod = attributes.paymentMethod?.type;

    console.log(`[Worldpay] Processing webhook: Order ${orderId}, Status: ${paymentStatus}`);

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

    await updateOrderPaymentStatus(orderId, orderStatus, {
      transactionId,
      authCode,
      cardBrand,
      cardLast4,
      paymentMethod,
      webhookEventId: eventId
    });

    return res.status(200).json({ 
      received: true, 
      processed: true,
      orderId,
      status: orderStatus
    });

  } catch (error: any) {
    console.error('[Worldpay] Webhook processing error:', error);
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

    let foundOrder: any = null;

    try {
      foundOrder = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (_e) {}

    if (!foundOrder) {
      try {
        const orders: any[] = (await fetchResource('orders')) || [];
        foundOrder = orders.find((o: any) => String(o.id) === String(orderId));
      } catch (_e) {}
    }

    if (!foundOrder) {
      return res.status(404).json({ error: 'Order not found', paid: false });
    }

    return res.json({
      orderId: foundOrder.id,
      paid: foundOrder.paymentStatus === 'Paid',
      status: foundOrder.paymentStatus || 'Pending',
      transactionId: foundOrder.worldpayTxId || foundOrder.gatewayTxId || null,
      authCode: foundOrder.worldpayAuthCode || foundOrder.gatewayAuthCode || null,
      cardBrand: foundOrder.cardBrand || null,
      updatedAt: foundOrder.updatedAt || null
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

    let foundOrder: any = null;

    try {
      foundOrder = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (_e) {}

    if (!foundOrder) {
      try {
        const orders: any[] = (await fetchResource('orders')) || [];
        foundOrder = orders.find((o: any) => String(o.id) === String(orderId));
      } catch (_e) {}
    }

    if (!foundOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(foundOrder);

  } catch (error: any) {
    console.error('[Worldpay] Order fetch error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch order' 
    });
  }
});

export default router;
