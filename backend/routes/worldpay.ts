import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma';
import { fetchResource, saveResource } from '../../serverDb';

const router = Router();

// Environment variables for Worldpay Access Platform (dashboard.worldpay.com)
const WORLDPAY_ENTITY_ID = process.env.WORLDPAY_ENTITY_ID || '';
const WORLDPAY_CHECKOUT_ID = process.env.WORLDPAY_CHECKOUT_ID || '';
const WORLDPAY_API_USERNAME = process.env.WORLDPAY_API_USERNAME || '';
const WORLDPAY_API_PASSWORD = process.env.WORLDPAY_API_PASSWORD || '';
const WORLDPAY_WEBHOOK_SECRET = process.env.WORLDPAY_WEBHOOK_SECRET || '';
const WORLDPAY_ENVIRONMENT = (process.env.WORLDPAY_ENVIRONMENT || 'live').toLowerCase();
const WORLDPAY_BASE_URL = (process.env.WORLDPAY_BASE_URL || (WORLDPAY_ENVIRONMENT === 'live' ? 'https://access.worldpay.com' : 'https://try.access.worldpay.com')).replace(/\/+$/, '');

// Helper to verify Worldpay Webhook Signatures
function verifyWorldpaySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(signature));
  } catch (err) {
    console.error('[Worldpay Signature Verification] Cryptographic error:', err);
    return false;
  }
}

// Helper to update order in database (Prisma primary, StoreResource fallback)
async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'Paid' | 'Failed',
  details: { 
    transactionId: string; 
    authCode: string; 
    cardBrand?: string;
    customerName?: string;
    customerEmail?: string;
    amount?: number;
    address?: string;
    items?: any[];
  }
) {
  let updatedOrder: any = null;
  try {
    const existingPrisma = await prisma.order.findUnique({ where: { id: orderId } });
    if (existingPrisma) {
      if (existingPrisma.paymentStatus === 'Paid' && paymentStatus === 'Paid') {
        console.log(`[Worldpay Access] Order ${orderId} is already paid. Skipping update.`);
        return existingPrisma;
      }

      updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus,
          worldpayTxId: details.transactionId,
          worldpayAuthCode: details.authCode,
          gatewayTxId: details.transactionId,
          gatewayAuthCode: details.authCode,
          cardBrand: details.cardBrand || existingPrisma.cardBrand || 'Visa/Mastercard'
        }
      });
      console.log(`[Worldpay Access] Order ${orderId} updated to '${paymentStatus}' in Neon PostgreSQL.`);
      return updatedOrder;
    } else if (paymentStatus === 'Paid') {
      // Create paid order record if it doesn't exist yet
      updatedOrder = await prisma.order.create({
        data: {
          id: orderId,
          customerName: details.customerName || 'Valued Customer',
          customerEmail: details.customerEmail || 'customer@pouch-supply.com',
          tags: ['Storefront', 'Worldpay Access Checkout'],
          fulfillmentStatus: 'Unfulfilled',
          paymentStatus: 'Paid',
          total: details.amount || 0,
          destination: details.address || 'United Kingdom',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          deliveryMethod: 'Priority Express Courier Shipping | Tracked',
          worldpayTxId: details.transactionId,
          worldpayAuthCode: details.authCode,
          gatewayTxId: details.transactionId,
          gatewayAuthCode: details.authCode,
          cardBrand: details.cardBrand || 'Visa/Mastercard',
          items: details.items || []
        }
      });
      console.log(`[Worldpay Access] Order ${orderId} created as 'Paid' in Neon PostgreSQL.`);
      return updatedOrder;
    }
  } catch (prismaErr: any) {
    console.warn(`[Worldpay Access] Prisma update failed for ${orderId}, trying StoreResource fallback:`, prismaErr?.message);
  }

  // Fallback to StoreResource
  try {
    const orders: any[] = (await fetchResource('orders')) || [];
    const idx = orders.findIndex((o: any) => o.id === orderId);
    if (idx !== -1) {
      orders[idx].paymentStatus = paymentStatus;
      orders[idx].worldpayTxId = details.transactionId;
      orders[idx].worldpayAuthCode = details.authCode;
      orders[idx].gatewayTxId = details.transactionId;
      orders[idx].gatewayAuthCode = details.authCode;
      if (details.cardBrand) orders[idx].cardBrand = details.cardBrand;
      await saveResource('orders', orders);
      console.log(`[Worldpay Access] Order ${orderId} updated via StoreResource fallback.`);
      return orders[idx];
    } else if (paymentStatus === 'Paid') {
      const newOrder = {
        id: orderId,
        customerName: details.customerName || 'Valued Customer',
        customerEmail: details.customerEmail || 'customer@pouch-supply.com',
        tags: ['Storefront', 'Worldpay Access Checkout'],
        fulfillmentStatus: 'Unfulfilled',
        paymentStatus: 'Paid',
        total: details.amount || 0,
        destination: details.address || 'United Kingdom',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliveryMethod: 'Priority Express Courier Shipping | Tracked',
        worldpayTxId: details.transactionId,
        worldpayAuthCode: details.authCode,
        gatewayTxId: details.transactionId,
        gatewayAuthCode: details.authCode,
        cardBrand: details.cardBrand || 'Visa/Mastercard',
        items: details.items || []
      };
      orders.unshift(newOrder);
      await saveResource('orders', orders);
      console.log(`[Worldpay Access] Order ${orderId} created as 'Paid' via StoreResource fallback.`);
      return newOrder;
    }
  } catch (fallbackErr) {
    console.error(`[Worldpay Access] StoreResource update error for order ${orderId}:`, fallbackErr);
  }

  return updatedOrder;
}

// GET /api/worldpay/config - Worldpay Access Platform Configuration Status
router.get('/config', (_req: Request, res: Response) => {
  const isConfigured = Boolean(
    WORLDPAY_ENTITY_ID ||
    WORLDPAY_CHECKOUT_ID ||
    WORLDPAY_API_USERNAME ||
    WORLDPAY_API_PASSWORD
  );

  res.json({
    active: true,
    isConfigured,
    platform: 'Worldpay Access Platform (dashboard.worldpay.com)',
    entityIdMasked: WORLDPAY_ENTITY_ID ? `${WORLDPAY_ENTITY_ID.substring(0, 4)}***` : 'Demo Mode',
    checkoutIdMasked: WORLDPAY_CHECKOUT_ID ? `${WORLDPAY_CHECKOUT_ID.substring(0, 6)}***` : 'Demo Mode',
    environment: WORLDPAY_ENVIRONMENT,
    provider: 'Worldpay Access Checkout'
  });
});

// POST /api/worldpay/session - Initialize Worldpay Access Checkout Session
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { orderId, amount, customerEmail, customerName, items, destination } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ error: 'Order ID and amount are required to create a Worldpay Access session.' });
    }

    console.log(`[Worldpay Access] Initializing checkout session for Order: ${orderId}, Amount: £${amount}`);

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'localhost:3000';

    // Verify Worldpay Access API credentials exist
    if (!WORLDPAY_API_USERNAME || !WORLDPAY_API_PASSWORD || !WORLDPAY_ENTITY_ID) {
      console.error('[Worldpay Access Error] Missing Worldpay API Credentials in environment variables.');
      return res.status(400).json({
        success: false,
        error: 'Worldpay Access API credentials (WORLDPAY_ENTITY_ID, WORLDPAY_API_USERNAME, WORLDPAY_API_PASSWORD) are not configured in environment variables.'
      });
    }

    const primaryBaseUrl = WORLDPAY_BASE_URL;

    const fallbackBaseUrl = WORLDPAY_BASE_URL.includes('try.access.worldpay.com')
      ? 'https://access.worldpay.com'
      : 'https://try.access.worldpay.com';

    const baseUrls = Array.from(new Set([primaryBaseUrl, fallbackBaseUrl]));
    const authHeader = 'Basic ' + Buffer.from(`${WORLDPAY_API_USERNAME}:${WORLDPAY_API_PASSWORD}`).toString('base64');
    const amountInPence = Math.round(parseFloat(amount) * 100);

    const successReturnUrl = `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}&status=SUCCESS`;
    const failureReturnUrl = `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}&status=FAILED`;
    const cancelReturnUrl = `${protocol}://${host}/payment/cancelled?orderId=${encodeURIComponent(orderId)}`;

    let lastStatus = 500;
    let lastErrorData: any = null;

    for (const baseUrl of baseUrls) {
      const extraHeaders: Record<string, string> = {};
      if (WORLDPAY_ENTITY_ID) {
        extraHeaders['WP-Entity-Id'] = WORLDPAY_ENTITY_ID;
        extraHeaders['Entity-Id'] = WORLDPAY_ENTITY_ID;
      }

      const attempts = [
        {
          url: `${baseUrl}/checkout/sessions`,
          contentType: 'application/vnd.worldpay.checkout-sessions-v1.hal+json',
          accept: 'application/vnd.worldpay.checkout-sessions-v1.hal+json, application/json',
          body: {
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
          url: `${baseUrl}/checkout/sessions`,
          contentType: 'application/json',
          accept: 'application/json, application/vnd.worldpay.checkout-sessions-v1.hal+json',
          body: {
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
          url: `${baseUrl}/verifiedTokens/sessions`,
          contentType: 'application/vnd.worldpay.verified-tokens-v1.hal+json',
          accept: 'application/vnd.worldpay.verified-tokens-v1.hal+json, application/json',
          body: {
            ...(WORLDPAY_CHECKOUT_ID ? { checkoutId: WORLDPAY_CHECKOUT_ID } : {}),
            transaction: {
              reference: String(orderId),
              value: {
                amount: amountInPence,
                currency: 'GBP'
              }
            }
          }
        },
        {
          url: `${baseUrl}/sessions`,
          contentType: 'application/vnd.worldpay.sessions-v1.hal+json',
          accept: 'application/vnd.worldpay.sessions-v1.hal+json, application/json',
          body: {
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
          console.log(`[Worldpay Access API] POST ${attempt.url} (${attempt.contentType})`);
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

          console.log(`[Worldpay Access API] Response Status ${response.status}:`, JSON.stringify(data));

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
                provider: 'Worldpay Access Checkout'
              });
            }
          }

          lastErrorData = data;
          if (response.status === 401 || response.status === 403) {
            break;
          }
        } catch (attemptErr: any) {
          console.warn(`[Worldpay Access API] Endpoint ${attempt.url} error:`, attemptErr.message);
          lastErrorData = { message: attemptErr.message };
        }
      }

      if (lastStatus === 401 || lastStatus === 403) {
        break;
      }
    }

    // Extract exact error description from Worldpay Access API response
    const rawMsg = 
      lastErrorData?.description || 
      lastErrorData?.message || 
      lastErrorData?.title || 
      lastErrorData?.error || 
      (typeof lastErrorData === 'string' ? lastErrorData : JSON.stringify(lastErrorData));

    const formattedError = `Worldpay Access API Error (${lastStatus}): ${rawMsg || 'Access Checkout session creation failed'}`;
    console.error(`[Worldpay Access Session Failed]: ${formattedError}`);

    return res.status(lastStatus >= 400 && lastStatus < 600 ? lastStatus : 400).json({
      success: false,
      error: formattedError,
      code: lastErrorData?.code || 'WORLDPAY_ACCESS_ERROR',
      details: lastErrorData
    });
  } catch (err: any) {
    console.error('[Worldpay Access Session Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to initialize Worldpay Access session.' });
  }
});

// GET & POST /api/worldpay/callback - Worldpay Access Payment Shopper Redirect Return
const handleWorldpayCallback = async (req: Request, res: Response) => {
  const params = req.method === 'POST' ? req.body : req.query;
  const orderId = (params.orderId || params.cartId || params.reference || '') as string;
  const sessionId = (params.sessionId || params.session_id || params.token || '') as string;
  const transId = (params.transId || params.transactionId || params.txId || '') as string;

  console.log(`[Worldpay Access Callback] Shopper returned for Order ID: ${orderId}, Session: ${sessionId}, TxId: ${transId}`);

  if (!orderId) {
    console.warn('[Worldpay Access Callback] No orderId provided in callback query or body.');
    return res.redirect('/payment/failed?reason=missing_order');
  }

  // Official Worldpay Access Verification via Worldpay API
  let isVerifiedPaid = false;
  let verifiedTxId = transId;
  let verifiedAuthCode = '';
  let cardBrand = 'Visa/Mastercard';

  if (WORLDPAY_API_USERNAME && WORLDPAY_API_PASSWORD) {
    const authHeader = 'Basic ' + Buffer.from(`${WORLDPAY_API_USERNAME}:${WORLDPAY_API_PASSWORD}`).toString('base64');
    
    // Attempt verification endpoints on Worldpay Access API
    const verifyUrls = [];
    if (sessionId) {
      verifyUrls.push(`${WORLDPAY_BASE_URL}/checkout/sessions/${encodeURIComponent(sessionId)}`);
      verifyUrls.push(`${WORLDPAY_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`);
    }
    if (transId) {
      verifyUrls.push(`${WORLDPAY_BASE_URL}/payments/authorisations/${encodeURIComponent(transId)}`);
    }

    for (const url of verifyUrls) {
      try {
        console.log(`[Worldpay Access Verification] GET ${url}`);
        const vRes = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json, application/vnd.worldpay.checkout-sessions-v1.hal+json'
          }
        });

        if (vRes.ok) {
          const vData: any = await vRes.json();
          console.log(`[Worldpay Access Verification Response] Status ${vRes.status}:`, JSON.stringify(vData));

          const outcomeStatus = (vData.outcome || vData.status || vData.state || vData.paymentStatus || '').toUpperCase();
          if (['SUCCESS', 'AUTHORIZED', 'CAPTURED', 'SETTLED', 'COMPLETED', 'APPROVED'].includes(outcomeStatus)) {
            isVerifiedPaid = true;
            verifiedTxId = vData.id || vData.transactionId || vData.paymentId || verifiedTxId;
            verifiedAuthCode = vData.authorizationCode || vData.authCode || 'WP-AUTH-VERIFIED';
            cardBrand = vData.paymentMethod?.card?.brand || vData.cardBrand || cardBrand;
            break;
          }
        } else {
          const errText = await vRes.text();
          console.warn(`[Worldpay Access Verification Failed] ${url} returned ${vRes.status}: ${errText}`);
        }
      } catch (vErr: any) {
        console.error(`[Worldpay Access Verification Error] ${url}:`, vErr?.message);
      }
    }
  }

  if (isVerifiedPaid) {
    await updateOrderPaymentStatus(orderId, 'Paid', {
      transactionId: verifiedTxId || `WP-VERIFIED-${orderId}`,
      authCode: verifiedAuthCode || 'AUTH-OK',
      cardBrand
    });
    return res.redirect(`/payment/success?orderId=${encodeURIComponent(orderId)}&txId=${encodeURIComponent(verifiedTxId)}`);
  } else {
    // If API verification did not confirm paid, record status as Failed
    await updateOrderPaymentStatus(orderId, 'Failed', {
      transactionId: verifiedTxId || `WP-FAIL-${orderId}`,
      authCode: 'UNVERIFIED-DECLINED',
      cardBrand
    });
    return res.redirect(`/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=unverified_or_declined`);
  }
};

router.get('/callback', handleWorldpayCallback);
router.post('/callback', handleWorldpayCallback);

// GET /api/worldpay/status - Check payment status in Neon DB
router.get('/status', async (req: Request, res: Response) => {
  try {
    const orderId = req.query.orderId as string;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId parameter is required' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.json({ paid: false, status: 'Not Found', orderId });
    }

    res.json({
      paid: order.paymentStatus === 'Paid',
      status: order.paymentStatus || 'Pending',
      transactionId: order.worldpayTxId || order.gatewayTxId || null,
      authCode: order.worldpayAuthCode || order.gatewayAuthCode || null,
      order
    });
  } catch (err: any) {
    console.error('[Worldpay Access Status Error]:', err);
    res.status(500).json({ error: err.message || 'Error querying Worldpay payment status' });
  }
});

// POST /api/worldpay/webhook - Receive Worldpay Access Platform Webhook Events
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-worldpay-signature'] || req.headers['x-signature'] || '') as string;
    const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf-8') : JSON.stringify(req.body);

    console.log(`[Worldpay Access Webhook] Received webhook event.`);

    // Reject webhook requests with 401/403 if signature verification is configured and fails
    if (WORLDPAY_WEBHOOK_SECRET) {
      if (!signature) {
        console.warn('[Worldpay Access Webhook] Missing required x-worldpay-signature header.');
        return res.status(401).json({ error: 'Unauthorized: Webhook signature is required.' });
      }

      const isValid = verifyWorldpaySignature(rawBody, signature, WORLDPAY_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('[Worldpay Access Webhook] Signature verification failed!');
        return res.status(403).json({ error: 'Forbidden: Invalid webhook signature.' });
      }
      console.log('[Worldpay Access Webhook] Signature verified successfully.');
    }

    const { eventType, orderId, cartId, reference, paymentStatus, status, transactionId, transId, authCode, cardBrand } = req.body;
    const targetOrderId = orderId || cartId || reference;

    if (targetOrderId) {
      const isPaid = ['CHARGED', 'SUCCESS', 'PAID', 'AUTHORIZED', 'CAPTURED', 'SETTLED'].includes((paymentStatus || status || eventType || '').toUpperCase());
      const targetStatus = isPaid ? 'Paid' : 'Failed';

      await updateOrderPaymentStatus(targetOrderId, targetStatus, {
        transactionId: transactionId || transId || `WP-ACC-WH-${targetOrderId}`,
        authCode: authCode || 'AUTH-WH-OK',
        cardBrand: cardBrand || 'Visa/Mastercard'
      }); 
      console.log(`[Worldpay Access Webhook] Order ${targetOrderId} status updated to '${targetStatus}'.`);
    }

    res.status(200).json({ received: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Worldpay Access Webhook Error]:', err);
    res.status(500).json({ error: 'Failed to process Worldpay Access webhook payload' });
  }
});

export default router;
