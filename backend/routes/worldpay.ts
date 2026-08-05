import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma';
import { fetchResource, saveResource } from '../../serverDb';

const router = Router();

// Worldpay Configuration - Environment Variables
const WORLDPAY_ENTITY = process.env.WORLDPAY_ENTITY || process.env.WORLDPAY_ENTITY_ID || '';
const WORLDPAY_CHECKOUT_ID = process.env.WORLDPAY_CHECKOUT_ID || process.env.NEXT_PUBLIC_WORLDPAY_CHECKOUT_ID || '';
const WORLDPAY_API_USERNAME = process.env.WORLDPAY_API_USERNAME || '';
const WORLDPAY_API_PASSWORD = process.env.WORLDPAY_API_PASSWORD || '';
const WORLDPAY_API_KEY = process.env.WORLDPAY_API_KEY || '';
const WORLDPAY_WEBHOOK_SECRET = process.env.WORLDPAY_WEBHOOK_SECRET || '';
const WORLDPAY_ENVIRONMENT = (process.env.WORLDPAY_ENVIRONMENT || 'live').toLowerCase();
const WORLDPAY_BASE_URL = (
  process.env.WORLDPAY_BASE_URL ||
  process.env.NEXT_PUBLIC_WORLDPAY_BASE_URL ||
  (WORLDPAY_ENVIRONMENT === 'live' ? 'https://access.worldpay.com' : 'https://try.access.worldpay.com')
).replace(/\/+$/, '');

// Helper to create Worldpay Authorization Header (Basic or Bearer)
function createAuthHeader(): string | null {
  const username = process.env.WORLDPAY_API_USERNAME || WORLDPAY_API_USERNAME;
  const password = process.env.WORLDPAY_API_PASSWORD || WORLDPAY_API_PASSWORD;
  const apiKey = process.env.WORLDPAY_API_KEY || WORLDPAY_API_KEY;

  if (username && password) {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return `Basic ${encoded}`;
  }

  if (apiKey) {
    return `Bearer ${apiKey}`;
  }

  return null;
}

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
  const authHeader = createAuthHeader();
  const entity = WORLDPAY_ENTITY;
  const isConfigured = Boolean(entity && authHeader);

  res.json({
    active: true,
    isConfigured,
    platform: 'Worldpay Access API',
    environment: WORLDPAY_ENVIRONMENT,
    baseUrl: WORLDPAY_BASE_URL,
    entityMasked: entity ? `${entity.substring(0, 4)}***` : 'Not Configured',
    checkoutIdMasked: WORLDPAY_CHECKOUT_ID ? `${WORLDPAY_CHECKOUT_ID.substring(0, 6)}***` : 'Not Configured',
    hasBasicAuth: Boolean(process.env.WORLDPAY_API_USERNAME && process.env.WORLDPAY_API_PASSWORD),
    hasBearerAuth: Boolean(process.env.WORLDPAY_API_KEY),
    provider: 'Worldpay Access'
  });
});

// Helper to extract shopper redirect URL from Worldpay HAL JSON response
function extractWorldpayRedirectUrl(responseBody: any): string | null {
  if (!responseBody) return null;

  // 1. Direct string properties
  for (const prop of ['hostedPaymentPageUrl', 'redirectUrl', 'checkoutUrl', 'url']) {
    const val = responseBody[prop];
    if (val && typeof val === 'string' && !val.includes('/paymentQueries') && !val.includes('/payments?')) {
      return val;
    }
  }

  const links = responseBody._links;
  if (!links || typeof links !== 'object') return null;

  // 2. Standard Worldpay HAL JSON relation names for hosted payment page
  const priorityRels = [
    'hostedPaymentPage',
    'payments:hostedPaymentPage',
    'hpp:hostedPaymentPage',
    'hostedPaymentPage:page',
    'hostedPaymentPage:redirect',
    'paymentPage',
    'redirect',
    'checkout',
    'shopper'
  ];

  for (const rel of priorityRels) {
    const item = links[rel];
    const href = typeof item === 'string' ? item : item?.href;
    if (href && typeof href === 'string' && !href.includes('/paymentQueries') && !href.includes('/payments?')) {
      return href;
    }
  }

  // 3. Any key in _links except 'self'
  for (const [relKey, item] of Object.entries(links)) {
    if (relKey === 'self') continue;
    const href = typeof item === 'string' ? item : (item as any)?.href;
    if (href && typeof href === 'string' && !href.includes('/paymentQueries') && !href.includes('/payments?')) {
      return href;
    }
  }

  // 4. Only accept 'self' if it explicitly points to shopper payment pages or checkout
  const selfHref = typeof links.self === 'string' ? links.self : links.self?.href;
  if (selfHref && typeof selfHref === 'string' && (selfHref.includes('/paymentPages/') || selfHref.includes('/checkout/'))) {
    return selfHref;
  }

  return null;
}

// POST /api/worldpay/session or /payment_pages - Create Worldpay Hosted Payment Page Session
async function handleCreateHostedPaymentPage(req: Request, res: Response) {
  try {
    const {
      orderId,
      amount,
      customerName,
      customerEmail,
      items,
      origin: bodyOrigin,
      mode = 'guest',
      product
    } = req.body;

    const entity = WORLDPAY_ENTITY;
    if (!entity) {
      console.error('[Worldpay] Missing WORLDPAY_ENTITY or WORLDPAY_ENTITY_ID environment variable.');
      return res.status(500).json({
        success: false,
        message: 'Missing Worldpay entity configuration. Set WORLDPAY_ENTITY or WORLDPAY_ENTITY_ID environment variable.',
        error: 'Missing Worldpay entity configuration.'
      });
    }

    const authHeader = createAuthHeader();
    if (!authHeader) {
      console.error('[Worldpay] Missing API credentials in environment variables.');
      return res.status(500).json({
        success: false,
        message: 'Missing Worldpay API credentials. Set WORLDPAY_API_USERNAME and WORLDPAY_API_PASSWORD, or WORLDPAY_API_KEY.',
        error: 'Missing Worldpay API credentials.'
      });
    }

    // Determine return origin URL
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
    const origin = bodyOrigin || `${protocol}://${host}`;

    const rawRef = orderId || product?.id || `hpp-${Date.now()}`;
    const transactionReference = String(rawRef);

    const rawLabel = product?.name || (items && items[0]?.productTitle) || `Pouch Supply Order ${orderId || ''}`.trim();
    const label = rawLabel.length > 24 ? `${rawLabel.slice(0, 21)}...` : (rawLabel || 'Hosted Payment');

    // Amount in pence (e.g. £25.00 -> 2500)
    let priceNum = 2500;
    if (typeof amount === 'number') {
      priceNum = Math.round(amount * 100);
    } else if (typeof amount === 'string' && !isNaN(parseFloat(amount))) {
      priceNum = Math.round(parseFloat(amount) * 100);
    } else if (product?.price) {
      priceNum = Math.round(product.price);
    }

    const currency = product?.currency || 'GBP';

    const successReturnUrl = `${origin}/api/worldpay/callback?orderId=${encodeURIComponent(orderId || transactionReference)}&status=SUCCESS`;
    const pendingReturnUrl = `${origin}/api/worldpay/callback?orderId=${encodeURIComponent(orderId || transactionReference)}&status=PENDING`;
    const failureReturnUrl = `${origin}/api/worldpay/callback?orderId=${encodeURIComponent(orderId || transactionReference)}&status=FAILED`;
    const cancelReturnUrl = `${origin}/payment/cancelled?orderId=${encodeURIComponent(orderId || transactionReference)}`;
    const expiryReturnUrl = `${origin}/payment/failed?orderId=${encodeURIComponent(orderId || transactionReference)}&reason=expired`;

    const body: Record<string, unknown> = {
      transactionReference,
      merchant: {
        entity
      },
      narrative: {
        line1: label
      },
      value: {
        currency,
        amount: priceNum
      },
      description: label,
      billingAddressName: customerName || 'Customer',
      resultURLs: {
        successURL: successReturnUrl,
        pendingURL: pendingReturnUrl,
        failureURL: failureReturnUrl,
        errorURL: failureReturnUrl,
        cancelURL: cancelReturnUrl,
        expiryURL: expiryReturnUrl
      }
    };

    if (mode === 'store' || mode === 'subscription') {
      body.createToken = {
        type: 'worldpay',
        description: `${label} token`,
        optIn: 'ASK'
      };
      body.customerAgreement = {
        type: mode === 'subscription' ? 'subscription' : 'cardOnFile',
        storedCardUsage: 'first'
      };
    }

    const correlationId = crypto.randomUUID ? crypto.randomUUID() : `hpp-${Math.random().toString(36).slice(2, 12)}`;
    const userAgent = req.headers['user-agent'] || 'worldpay-hpp/1.0';

    const worldpayUrl = `${WORLDPAY_BASE_URL}/payment_pages`;

    console.log(`[Worldpay HPP] POST ${worldpayUrl} for Order: ${orderId || transactionReference}, Amount: ${priceNum} pence`);

    const response = await fetch(worldpayUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/vnd.worldpay.payment_pages-v1.hal+json',
        'Accept': 'application/vnd.worldpay.payment_pages-v1.hal+json',
        'WP-CorrelationId': correlationId,
        'User-Agent': userAgent
      },
      body: JSON.stringify(body)
    });

    const responseBody: any = await response.json().catch(() => ({ message: 'Invalid response from Worldpay.' }));

    console.log(`[Worldpay HPP] Status ${response.status}:`, JSON.stringify(responseBody, null, 2));

    if (!response.ok) {
      const errMsg = responseBody?.description || responseBody?.message || responseBody?.title || 'Hosted Payment Pages creation failed.';
      return res.status(response.status).json({
        success: false,
        message: errMsg,
        error: `Worldpay Error (${response.status}): ${errMsg}`,
        details: responseBody
      });
    }

    // Extract shopper redirect URL from HAL JSON links safely
    const redirectUrl = extractWorldpayRedirectUrl(responseBody);

    if (!redirectUrl) {
      console.warn('[Worldpay HPP] No valid shopper payment page URL found in Worldpay response. Available links:', responseBody._links);
      return res.status(400).json({
        success: false,
        message: responseBody?.description || responseBody?.message || 'Worldpay did not return a Hosted Payment Page URL. Please check your Worldpay Entity configuration.',
        error: 'Worldpay response did not include a valid Hosted Payment Page redirect URL.',
        details: responseBody
      });
    }

    return res.status(200).json({
      success: true,
      sessionId: transactionReference,
      transactionReference,
      redirectUrl,
      checkoutId: entity,
      provider: 'Worldpay Access HPP',
      ...responseBody
    });

  } catch (error: any) {
    console.error('[Worldpay HPP] Request failed:', error);
    return res.status(502).json({
      success: false,
      message: 'Unable to reach Worldpay Hosted Payment Pages service.',
      error: error.message
    });
  }
}

router.post('/session', handleCreateHostedPaymentPage);
router.post('/payment_pages', handleCreateHostedPaymentPage);

// POST /api/worldpay/payment or /payments - Worldpay Direct Payment Execution
async function handleDirectPayment(req: Request, res: Response) {
  try {
    const { sessionHref, tokenHref, schemeReference, product, orderId, amount, customerName } = req.body;

    if (!sessionHref && !tokenHref) {
      return res.status(400).json({ success: false, message: 'Missing sessionHref or tokenHref.' });
    }

    const entity = WORLDPAY_ENTITY;
    if (!entity) {
      return res.status(500).json({ success: false, message: 'Missing WORLDPAY_ENTITY environment variable.' });
    }

    const authHeader = createAuthHeader();
    if (!authHeader) {
      return res.status(500).json({
        success: false,
        message: 'Missing Worldpay API credentials. Set WORLDPAY_API_USERNAME and WORLDPAY_API_PASSWORD, or WORLDPAY_API_KEY.'
      });
    }

    const isSubscriptionSetup = !tokenHref && product?.recurring === true;
    const isSubscriptionRenewal = !!tokenHref;

    const rawName = product?.name || `Order ${orderId || ''}`.trim();
    const line1 = rawName.length > 24 ? rawName.slice(0, 24) : (rawName || 'Payment');

    let priceNum = 2500;
    if (typeof amount === 'number') {
      priceNum = Math.round(amount * 100);
    } else if (typeof amount === 'string' && !isNaN(parseFloat(amount))) {
      priceNum = Math.round(parseFloat(amount) * 100);
    } else if (product?.price) {
      priceNum = Math.round(product.price);
    }

    const instruction: Record<string, unknown> = {
      method: 'card',
      narrative: {
        line1
      },
      value: {
        currency: product?.currency || 'GBP',
        amount: priceNum
      },
      paymentInstrument: tokenHref
        ? {
            type: 'token',
            href: tokenHref
          }
        : {
            type: 'checkout',
            sessionHref,
            cardHolderName: customerName || 'Customer'
          }
    };

    if (isSubscriptionSetup) {
      instruction.tokenCreation = { type: 'worldpay' };
      instruction.customerAgreement = {
        type: 'subscription',
        storedCardUsage: 'first'
      };
    }

    if (isSubscriptionRenewal) {
      instruction.customerAgreement = {
        type: 'subscription',
        storedCardUsage: 'subsequent',
        ...(schemeReference ? { schemeReference } : {})
      };
    }

    const txRef = `worldpay-${Date.now()}`;
    const orderRef = orderId || product?.id || 'worldpay-order';

    const body = {
      transactionReference: txRef,
      orderReference: orderRef,
      merchant: {
        entity
      },
      instruction
    };

    const userAgent = req.headers['user-agent'] || 'unknown';
    const correlationId = (req.headers['x-correlation-id'] as string) || (crypto.randomUUID ? crypto.randomUUID() : `tx-${Math.random().toString(36).slice(2, 10)}`);

    const worldpayUrl = `${WORLDPAY_BASE_URL}/api/payments`;

    console.log(`[Worldpay Direct Payment] POST ${worldpayUrl} for Order: ${orderRef}`);

    const response = await fetch(worldpayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'WP-Api-Version': '2024-06-01',
        'Authorization': authHeader,
        'User-Agent': userAgent,
        'x-correlation-id': correlationId
      },
      body: JSON.stringify(body)
    });

    const responseBody: any = await response.json().catch(() => ({ message: 'Invalid response from Worldpay.' }));

    console.log('[Worldpay Direct Payment Response]', JSON.stringify({ responseBody, status: response.status }, null, 2));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: responseBody?.description || responseBody?.message || 'Worldpay authorization failed.',
        details: responseBody
      });
    }

    // Mark order paid if successful
    if (orderId && (responseBody.outcome === 'authorized' || responseBody.outcome === 'captured' || responseBody.status === 'authorized')) {
      await updateOrderPaymentStatus(orderId, 'Paid', {
        transactionId: responseBody.id || responseBody.transactionId || txRef,
        authCode: responseBody.authCode
      });
    }

    return res.status(200).json(responseBody);
  } catch (error: any) {
    console.error('[Worldpay Direct Payment failed]', error);
    return res.status(502).json({ success: false, message: 'Unable to reach Worldpay services.', error: error.message });
  }
}

router.post('/payment', handleDirectPayment);
router.post('/payments', handleDirectPayment);

// GET & POST /api/worldpay/callback - Shopper return handler
const handleWorldpayCallback = async (req: Request, res: Response) => {
  const params = req.method === 'POST' ? req.body : req.query;
  const orderId = (params.orderId || params.transactionReference) as string;
  const status = (params.status || '').toUpperCase();

  console.log(`[Worldpay Callback] Order: ${orderId}, Status: ${status}`);

  if (!orderId) {
    console.warn('[Worldpay Callback] No orderId in callback parameters');
    return res.redirect('/payment/failed?reason=missing_order');
  }

  if (status === 'FAILED' || status === 'CANCELLED' || status === 'ERROR') {
    try {
      await updateOrderPaymentStatus(orderId, 'Failed', {
        transactionId: `CALLBACK_${orderId}`,
        authCode: 'CALLBACK_DECLINED'
      });
    } catch (error) {
      console.error('[Worldpay Callback] Failed to update order status:', error);
    }
    return res.redirect(`/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=payment_declined`);
  }

  if (status === 'SUCCESS' || status === 'PENDING' || status === 'AUTHORIZED') {
    if (status === 'SUCCESS' || status === 'AUTHORIZED') {
      try {
        await updateOrderPaymentStatus(orderId, 'Paid', {
          transactionId: `CALLBACK_${orderId}`,
          authCode: 'CALLBACK_SUCCESS'
        });
      } catch (error) {
        console.error('[Worldpay Callback] Failed to update order status to Paid:', error);
      }
    }
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
    console.error('[Worldpay Webhook] Failed to read raw body');
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
    const signature = req.headers['x-worldpay-signature'] as string;

    if (WORLDPAY_WEBHOOK_SECRET) {
      if (!signature) {
        console.warn('[Worldpay Webhook] Missing signature');
        return res.status(401).json({ error: 'Unauthorized: Missing signature' });
      }

      const isValid = verifyWorldpaySignature(rawBody, signature, WORLDPAY_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn('[Worldpay Webhook] Invalid signature');
        return res.status(403).json({ error: 'Forbidden: Invalid signature' });
      }
      console.log('[Worldpay Webhook] Signature verified');
    }

    const event = req.body as WorldpayWebhookEvent;

    if (!event || !event.type || !event.data) {
      console.warn('[Worldpay Webhook] Invalid webhook payload structure');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (!event.type.startsWith('payment.')) {
      console.log(`[Worldpay Webhook] Ignoring non-payment event: ${event.type}`);
      return res.status(200).json({ received: true, ignored: true });
    }

    const orderId = event.data.attributes?.metadata?.orderId ||
                    event.data.attributes?.reference;

    if (!orderId) {
      console.warn('[Worldpay Webhook] No order ID in webhook payload');
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

    console.log(`[Worldpay Webhook] Order ${orderId}, Status: ${paymentStatus}`);

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
        console.log(`[Worldpay Webhook] Unhandled payment status: ${paymentStatus}`);
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
    console.error('[Worldpay Webhook] Processing error:', error);
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
    console.error('[Worldpay Status] Check error:', error);
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
    console.error('[Worldpay Order] Fetch error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch order'
    });
  }
});

export default router;
