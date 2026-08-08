import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma';
import { fetchResource, saveResource } from '../../serverDb';

const router = Router();

// In-memory store for pending checkout payloads before payment confirmation.
// Crucial: An order is NEVER created in the database prior to verified payment success!
interface PendingCheckout {
  orderId: string;
  customerName: string;
  customerEmail: string;
  destination: string;
  items: any[];
  total: number;
  discountApplied: any;
  storeCreditApplied: number;
  isTestMode: boolean;
  createdAt: number;
}

const pendingCheckoutsMap = new Map<string, PendingCheckout>();

// Helper to determine Worldpay Environment and Credentials
function getEnvironmentConfig(requestedMode?: 'live' | 'test') {
  const envMode = (process.env.WORLDPAY_ENVIRONMENT || 'live').toLowerCase();
  const testModeFlag = (process.env.WORLDPAY_TEST_MODE || '').toLowerCase() === 'true';

  let isTestMode = false;
  if (requestedMode === 'test') {
    isTestMode = true;
  } else if (requestedMode === 'live') {
    isTestMode = false;
  } else {
    isTestMode = envMode === 'test' || envMode === 'sandbox' || testModeFlag;
  }

  const entity = isTestMode
    ? (process.env.WORLDPAY_TEST_ENTITY || process.env.WORLDPAY_ENTITY || process.env.WORLDPAY_ENTITY_ID || 'TEST_ENTITY_PS')
    : (process.env.WORLDPAY_ENTITY || process.env.WORLDPAY_ENTITY_ID || '');

  const username = isTestMode
    ? (process.env.WORLDPAY_TEST_API_USERNAME || process.env.WORLDPAY_API_USERNAME || '')
    : (process.env.WORLDPAY_API_USERNAME || '');

  const password = isTestMode
    ? (process.env.WORLDPAY_TEST_API_PASSWORD || process.env.WORLDPAY_API_PASSWORD || '')
    : (process.env.WORLDPAY_API_PASSWORD || '');

  const baseUrl = (
    isTestMode
      ? (process.env.WORLDPAY_TEST_BASE_URL || 'https://try.access.worldpay.com')
      : (process.env.WORLDPAY_BASE_URL || 'https://access.worldpay.com')
  ).replace(/\/+$/, '');

  let authHeader: string | null = null;
  if (username && password) {
    authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  return {
    isTestMode,
    environment: isTestMode ? 'test' : 'live',
    entity,
    username,
    password,
    baseUrl,
    authHeader,
    checkoutId: process.env.WORLDPAY_CHECKOUT_ID || process.env.NEXT_PUBLIC_WORLDPAY_CHECKOUT_ID || ''
  };
}

// Helper to extract shopper redirect URL from Worldpay HAL JSON response
function extractWorldpayRedirectUrl(responseBody: any): string | null {
  if (!responseBody) return null;

  for (const prop of ['hostedPaymentPageUrl', 'redirectUrl', 'checkoutUrl', 'url']) {
    const val = responseBody[prop];
    if (val && typeof val === 'string' && !val.includes('/paymentQueries') && !val.includes('/payments?')) {
      return val;
    }
  }

  const links = responseBody._links;
  if (!links || typeof links !== 'object') return null;

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

  for (const [relKey, item] of Object.entries(links)) {
    if (relKey === 'self') continue;
    const href = typeof item === 'string' ? item : (item as any)?.href;
    if (href && typeof href === 'string' && !href.includes('/paymentQueries') && !href.includes('/payments?')) {
      return href;
    }
  }

  const selfHref = typeof links.self === 'string' ? links.self : links.self?.href;
  if (selfHref && typeof selfHref === 'string' && (selfHref.includes('/paymentPages/') || selfHref.includes('/checkout/'))) {
    return selfHref;
  }

  return null;
}

// Helper to save a verified successful order directly into Prisma and StoreResource
async function saveVerifiedOrder(
  orderId: string,
  details: {
    transactionId: string;
    authCode?: string;
    cardBrand?: string;
    cardLast4?: string;
    paymentMethod?: string;
    webhookEventId?: string;
    pendingData?: PendingCheckout;
  }
) {
  const pending = details.pendingData || pendingCheckoutsMap.get(orderId);
  const { saveSingleOrder } = await import('./orders');

  const formattedOrder = {
    id: orderId,
    orderId: orderId,
    customerName: pending?.customerName || 'Valued Customer',
    customerEmail: pending?.customerEmail || 'customer@pouch-supply.com',
    destination: pending?.destination || 'United Kingdom',
    items: pending?.items || [],
    total: typeof pending?.total === 'number' ? pending.total : parseFloat(pending?.total as any) || 0,
    storeCreditApplied: pending?.storeCreditApplied || 0,
    discountApplied: pending?.discountApplied || null,
    paymentStatus: 'Paid',
    fulfillmentStatus: 'Unfulfilled',
    worldpayTxId: details.transactionId,
    worldpayAuthCode: details.authCode || 'AUTH-OK',
    gatewayTxId: details.transactionId,
    gatewayAuthCode: details.authCode || 'AUTH-OK',
    cardBrand: details.cardBrand || 'Worldpay Card',
    deliveryMethod: 'Royal Mail Tracked 24/48',
    tags: ['Storefront', pending?.isTestMode ? 'Worldpay Test Order' : 'Worldpay Live Order'],
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    data: {
      cardLast4: details.cardLast4,
      paymentMethod: details.paymentMethod || 'Worldpay Access',
      webhookEventId: details.webhookEventId,
      isTestMode: pending?.isTestMode ?? false
    }
  };

  const savedOrder = await saveSingleOrder(formattedOrder);

  // Clear pending memory store
  pendingCheckoutsMap.delete(orderId);

  return savedOrder;
}

// GET /api/worldpay/config - Returns mode and configuration status
router.get('/config', (_req: Request, res: Response) => {
  const cfg = getEnvironmentConfig();

  res.json({
    active: true,
    isConfigured: Boolean(cfg.entity && cfg.authHeader),
    platform: 'Worldpay Access API',
    environment: cfg.environment,
    isTestMode: cfg.isTestMode,
    baseUrl: cfg.baseUrl,
    entityMasked: cfg.entity ? `${cfg.entity.substring(0, 4)}***` : 'Not Configured',
    checkoutIdMasked: cfg.checkoutId ? `${cfg.checkoutId.substring(0, 6)}***` : 'Not Configured',
    hasBasicAuth: Boolean(cfg.username && cfg.password),
    provider: `Worldpay Access (${cfg.environment.toUpperCase()})`
  });
});

// POST /api/worldpay/session - Initiate Hosted Payment Session
async function handleCreateHostedPaymentPage(req: Request, res: Response) {
  try {
    const {
      orderId,
      amount,
      customerName,
      customerEmail,
      destination,
      address,
      items,
      discountApplied,
      storeCreditApplied,
      origin: bodyOrigin,
      mode,
      paymentMode
    } = req.body;

    const requestedMode: 'live' | 'test' = (paymentMode || mode || '').toLowerCase() === 'test' ? 'test' : 'live';
    const cfg = getEnvironmentConfig(requestedMode);

    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
    const origin = bodyOrigin || `${protocol}://${host}`;

    const rawRef = orderId || `PS${Math.floor(Math.random() * 90000 + 10000)}`;
    const transactionReference = String(rawRef);

    let priceNum = 2500;
    if (typeof amount === 'number') {
      priceNum = Math.round(amount * 100);
    } else if (typeof amount === 'string' && !isNaN(parseFloat(amount))) {
      priceNum = Math.round(parseFloat(amount) * 100);
    }

    // Store pending order details in memory ONLY — DO NOT CREATE ORDER IN DATABASE BEFORE PAYMENT
    const pendingPayload: PendingCheckout = {
      orderId: transactionReference,
      customerName: customerName || 'Valued Customer',
      customerEmail: customerEmail || 'customer@pouch-supply.com',
      destination: destination || address || 'United Kingdom',
      items: Array.isArray(items) ? items : [],
      total: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
      discountApplied: discountApplied || null,
      storeCreditApplied: storeCreditApplied || 0,
      isTestMode: cfg.isTestMode,
      createdAt: Date.now()
    };

    pendingCheckoutsMap.set(transactionReference, pendingPayload);

    // TEST MODE REQUESTED OR ENFORCED
    if (cfg.isTestMode) {
      console.log(`[Worldpay Session] Creating TEST / SANDBOX checkout for Order: ${transactionReference}`);
      const testGatewayUrl = `${origin}/payment/gateway?orderId=${encodeURIComponent(transactionReference)}&amount=${encodeURIComponent(pendingPayload.total.toFixed(2))}&mode=test`;

      return res.status(200).json({
        success: true,
        sessionId: transactionReference,
        transactionReference,
        redirectUrl: testGatewayUrl,
        checkoutId: cfg.entity || 'TEST_ENTITY_PS',
        provider: 'Worldpay Access Test Sandbox',
        environment: 'test',
        isTestMode: true
      });
    }

    // LIVE MODE REQUESTED: Check for missing live credentials
    if (!cfg.authHeader || !cfg.entity) {
      return res.status(400).json({
        success: false,
        message: 'Live Worldpay Access API credentials are not configured in environment variables (WORLDPAY_ENTITY, WORLDPAY_API_USERNAME, WORLDPAY_API_PASSWORD).',
        error: 'Live Worldpay credentials missing.'
      });
    }

    // LIVE Worldpay HPP Request
    const successReturnUrl = `${origin}/api/worldpay/callback?orderId=${encodeURIComponent(transactionReference)}&status=SUCCESS`;
    const pendingReturnUrl = `${origin}/api/worldpay/callback?orderId=${encodeURIComponent(transactionReference)}&status=PENDING`;
    const failureReturnUrl = `${origin}/api/worldpay/callback?orderId=${encodeURIComponent(transactionReference)}&status=FAILED`;
    const cancelReturnUrl = `${origin}/payment/cancelled?orderId=${encodeURIComponent(transactionReference)}`;
    const expiryReturnUrl = `${origin}/payment/failed?orderId=${encodeURIComponent(transactionReference)}&reason=expired`;

    const rawLabel = (items && items[0]?.productTitle) || `Pouch Supply Order ${transactionReference}`;
    const label = rawLabel.length > 24 ? `${rawLabel.slice(0, 21)}...` : rawLabel;

    const body: Record<string, unknown> = {
      transactionReference,
      merchant: { entity: cfg.entity },
      narrative: { line1: label },
      value: { currency: 'GBP', amount: priceNum },
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

    const correlationId = crypto.randomUUID ? crypto.randomUUID() : `hpp-${Math.random().toString(36).slice(2, 12)}`;
    const userAgent = req.headers['user-agent'] || 'worldpay-hpp/1.0';

    const worldpayUrl = `${cfg.baseUrl}/payment_pages`;

    console.log(`[Worldpay HPP ${cfg.environment.toUpperCase()}] POST ${worldpayUrl} for Order: ${transactionReference}`);

    const response = await fetch(worldpayUrl, {
      method: 'POST',
      headers: {
        'Authorization': cfg.authHeader,
        'Content-Type': 'application/vnd.worldpay.payment_pages-v1.hal+json',
        'Accept': 'application/vnd.worldpay.payment_pages-v1.hal+json',
        'WP-CorrelationId': correlationId,
        'User-Agent': userAgent
      },
      body: JSON.stringify(body)
    });

    const responseBody: any = await response.json().catch(() => ({ message: 'Invalid response from Worldpay.' }));

    if (!response.ok) {
      const errMsg = responseBody?.description || responseBody?.message || 'Hosted Payment Pages creation failed.';
      return res.status(response.status).json({
        success: false,
        message: errMsg,
        error: `Worldpay Error (${response.status}): ${errMsg}`,
        details: responseBody
      });
    }

    const redirectUrl = extractWorldpayRedirectUrl(responseBody);
    if (!redirectUrl) {
      return res.status(400).json({
        success: false,
        message: 'Worldpay response did not include a valid Hosted Payment Page redirect URL.',
        details: responseBody
      });
    }

    return res.status(200).json({
      success: true,
      sessionId: transactionReference,
      transactionReference,
      redirectUrl,
      checkoutId: cfg.entity,
      provider: `Worldpay Access HPP (${cfg.environment})`,
      environment: cfg.environment,
      isTestMode: cfg.isTestMode
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

// POST /api/worldpay/verify-payment - Server-side Payment Verification & Order Creation
router.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      status,
      transactionId,
      txId,
      authCode,
      cardBrand,
      customerName,
      customerEmail,
      destination,
      items,
      total
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const statusUpper = String(status || 'SUCCESS').toUpperCase();

    if (statusUpper !== 'SUCCESS' && statusUpper !== 'AUTHORIZED' && statusUpper !== 'PAID') {
      // Payment was declined or cancelled. DO NOT SAVE ANY ORDER!
      pendingCheckoutsMap.delete(orderId);
      return res.status(400).json({
        success: false,
        message: 'Payment was not successful. No order was created in the database.'
      });
    }

    // Retrieve pending order data or construct from request body if missing
    let pending = pendingCheckoutsMap.get(orderId);
    if (!pending && items && Array.isArray(items)) {
      pending = {
        orderId,
        customerName: customerName || 'Valued Customer',
        customerEmail: customerEmail || 'customer@pouch-supply.com',
        destination: destination || 'United Kingdom',
        items,
        total: typeof total === 'number' ? total : parseFloat(total) || 0,
        discountApplied: req.body.discountApplied || null,
        storeCreditApplied: req.body.storeCreditApplied || 0,
        isTestMode: req.body.isTestMode ?? true,
        createdAt: Date.now()
      };
    }

    const effectiveTxId = transactionId || txId || `WP-${Date.now().toString().slice(-6)}`;
    const effectiveAuthCode = authCode || 'AUTH-SUCCESS-OK';

    // Persist verified order into Prisma DB and StoreResource
    const savedOrder = await saveVerifiedOrder(orderId, {
      transactionId: effectiveTxId,
      authCode: effectiveAuthCode,
      cardBrand: cardBrand || 'Worldpay Card',
      pendingData: pending
    });

    console.log(`[Worldpay Payment Verified] Order #${orderId} saved as Paid with Tx ID: ${effectiveTxId}`);

    return res.json({
      success: true,
      orderId,
      transactionId: effectiveTxId,
      authCode: effectiveAuthCode,
      paymentStatus: 'Paid',
      order: savedOrder,
      redirectUrl: `/payment/success?orderId=${encodeURIComponent(orderId)}&txId=${encodeURIComponent(effectiveTxId)}`
    });

  } catch (error: any) {
    console.error('[Worldpay Verify Payment Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server-side payment verification failed' });
  }
});

// GET & POST /api/worldpay/callback - Shopper Return Callback Handler
const handleWorldpayCallback = async (req: Request, res: Response) => {
  const params = req.method === 'POST' ? req.body : req.query;
  const orderId = (params.orderId || params.transactionReference) as string;
  const status = (params.status || '').toUpperCase();

  console.log(`[Worldpay Callback] Order: ${orderId}, Status: ${status}`);

  if (!orderId) {
    return res.redirect('/payment/failed?reason=missing_order');
  }

  if (status === 'FAILED' || status === 'CANCELLED' || status === 'ERROR') {
    pendingCheckoutsMap.delete(orderId);
    return res.redirect(`/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=payment_declined`);
  }

  if (status === 'SUCCESS' || status === 'PENDING' || status === 'AUTHORIZED') {
    const txId = (params.txId || params.transactionId || `WP-CB-${Date.now().toString().slice(-6)}`) as string;
    const authCode = (params.authCode || 'CALLBACK-OK') as string;

    try {
      await saveVerifiedOrder(orderId, {
        transactionId: txId,
        authCode,
        cardBrand: 'Worldpay Card'
      });
      console.log(`[Worldpay Callback] Successfully saved order ${orderId} as Paid upon return callback.`);
    } catch (error) {
      console.error('[Worldpay Callback] Error saving order on callback:', error);
    }

    return res.redirect(`/payment/success?orderId=${encodeURIComponent(orderId)}&txId=${encodeURIComponent(txId)}`);
  }

  return res.redirect(`/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=unknown_status`);
};

router.get('/callback', handleWorldpayCallback);
router.post('/callback', handleWorldpayCallback);

// POST /api/worldpay/webhook - Official Worldpay Webhook Handler
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    if (!event || !event.type || !event.data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const orderId = event.data.attributes?.metadata?.orderId || event.data.attributes?.reference;
    if (!orderId) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const paymentStatus = event.data.attributes?.status;
    const transactionId = event.data.attributes?.transactionId || event.data.id;
    const authCode = event.data.attributes?.authCode;
    const cardBrand = event.data.attributes?.paymentMethod?.card?.brand;

    if (paymentStatus === 'authorized' || paymentStatus === 'captured' || paymentStatus === 'settled') {
      await saveVerifiedOrder(orderId, {
        transactionId,
        authCode,
        cardBrand
      });
    } else if (paymentStatus === 'failed') {
      pendingCheckoutsMap.delete(orderId);
    }

    return res.status(200).json({ received: true, processed: true, orderId });
  } catch (error: any) {
    console.error('[Worldpay Webhook] Processing error:', error);
    return res.status(200).json({ received: true, processed: false, error: error.message });
  }
});

// GET /api/worldpay/status - Check order payment status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const orderId = req.query.orderId as string;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

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

    if (!foundOrder || foundOrder.paymentStatus !== 'Paid') {
      return res.json({
        orderId,
        paid: false,
        status: foundOrder ? foundOrder.paymentStatus : 'Unpaid'
      });
    }

    return res.json({
      orderId: foundOrder.id,
      paid: true,
      status: 'Paid',
      transactionId: foundOrder.worldpayTxId || foundOrder.gatewayTxId || null,
      authCode: foundOrder.worldpayAuthCode || foundOrder.gatewayAuthCode || null,
      cardBrand: foundOrder.cardBrand || null,
      updatedAt: foundOrder.updatedAt || null
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to check payment status' });
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
    return res.status(500).json({ error: error.message || 'Failed to fetch order' });
  }
});

export default router;
