import { Router, Request, Response } from 'express';
import {
  getKlaviyoSettings,
  saveKlaviyoSettings,
  getKlaviyoLogs,
  trackKlaviyoEvent,
  trackCustomerSignup,
  trackNewsletterSignup,
  trackEmailVerified,
  trackAddToCart,
  trackCheckoutStarted,
  trackPurchaseCompleted,
  trackOrderRefunded,
  trackWishlistAdded
} from '../services/klaviyoService';
import { saveResource } from '../../serverDb';

const router = Router();

// GET /api/klaviyo/settings
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getKlaviyoSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch Klaviyo settings' });
  }
});

// POST /api/klaviyo/settings
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const updated = await saveKlaviyoSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save Klaviyo settings' });
  }
});

// GET & POST /api/klaviyo/verify - Verify Klaviyo Private API Key
const handleVerify = async (req: Request, res: Response) => {
  try {
    const apiKey = req.body?.apiKey || req.query?.apiKey as string | undefined;
    const settings = await getKlaviyoSettings();
    let keyToTest = (apiKey || settings.apiKey || process.env.KLAVIYO_API_KEY || '').trim();
    if (keyToTest.toLowerCase().startsWith('klaviyo-api-key ')) {
      keyToTest = keyToTest.substring(16).trim();
    }

    if (!keyToTest) {
      return res.status(400).json({ success: false, error: 'No Klaviyo Private API Key provided or saved in settings.' });
    }

    // First check metrics:read
    const response = await fetch('https://a.klaviyo.com/api/metrics/', {
      method: 'GET',
      headers: {
        'Authorization': `Klaviyo-API-Key ${keyToTest}`,
        'accept': 'application/json',
        'revision': '2024-02-15'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `HTTP ${response.status}: ${errText}`;
      try {
        const jsonErr = JSON.parse(errText);
        if (jsonErr.errors && Array.isArray(jsonErr.errors)) {
          errorMsg = jsonErr.errors.map((e: any) => `${e.title || 'Error'}: ${e.detail || e.message || JSON.stringify(e)}`).join(' | ');
        }
      } catch (e) {}
      return res.status(response.status).json({ success: false, error: errorMsg });
    }

    const data: any = await response.json();
    const count = Array.isArray(data?.data) ? data.data.length : 0;

    // Next check events:write permission (required for server-side Analytics > Metrics aggregation)
    const testEventPayload = {
      data: {
        type: 'event',
        attributes: {
          metric: { data: { type: 'metric', attributes: { name: 'Storefront Verification' } } },
          profile: { data: { type: 'profile', attributes: { email: 'verification-check@pouch-supply.com' } } },
          properties: { verified: true },
          time: new Date().toISOString()
        }
      }
    };

    const eventCheckRes = await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${keyToTest}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'revision': '2024-02-15'
      },
      body: JSON.stringify(testEventPayload)
    });

    let hasEventsWrite = eventCheckRes.ok || eventCheckRes.status === 202;
    let eventsWriteWarning = '';

    if (!hasEventsWrite) {
      const evErrText = await eventCheckRes.text();
      try {
        const parsed = JSON.parse(evErrText);
        if (parsed.errors?.[0]?.detail) {
          eventsWriteWarning = parsed.errors[0].detail;
        }
      } catch (e) {
        eventsWriteWarning = evErrText;
      }
    }

    return res.json({
      success: true,
      hasEventsWrite,
      eventsWriteWarning: eventsWriteWarning || undefined,
      message: hasEventsWrite
        ? `Klaviyo Private API Key verified with Full Access! Account connected with ${count} metrics.`
        : `API Key connected (${count} metrics), but missing "events:write" scope. Please create a Private Key in Klaviyo with "Full Access" so metrics populate in Analytics.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to verify Klaviyo API key' });
  }
};

router.get('/verify', handleVerify);
router.post('/verify', handleVerify);

// GET /api/klaviyo/logs
router.get('/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await getKlaviyoLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch Klaviyo logs' });
  }
});

// POST /api/klaviyo/logs/clear
router.post('/logs/clear', async (_req: Request, res: Response) => {
  try {
    await saveResource('klaviyo_logs', []);
    res.json({ success: true, message: 'Klaviyo logs cleared successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear Klaviyo logs' });
  }
});

// POST /api/klaviyo/track - Track custom event from client or backend
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { eventName, customerEmail, eventProperties, customerProperties, eventType, data } = req.body;

    if (eventType) {
      switch (eventType) {
        case 'customer_signup':
          await trackCustomerSignup(data || { email: customerEmail });
          break;
        case 'newsletter_signup':
          await trackNewsletterSignup(customerEmail);
          break;
        case 'email_verified':
          await trackEmailVerified(customerEmail);
          break;
        case 'add_to_cart':
          await trackAddToCart(customerEmail, data?.item, data?.quantity || 1);
          break;
        case 'checkout_started':
          await trackCheckoutStarted(customerEmail, data?.items || [], data?.total || 0);
          break;
        case 'purchase':
          await trackPurchaseCompleted(data || { customerEmail, total: eventProperties?.total });
          break;
        case 'refunded':
          await trackOrderRefunded(data || { customerEmail, id: eventProperties?.orderId }, data?.refundAmount);
          break;
        case 'wishlist':
          await trackWishlistAdded(customerEmail, data?.item);
          break;
        default:
          await trackKlaviyoEvent(eventName || eventType, customerEmail || 'guest@pouch-supply.com', eventProperties, customerProperties);
      }
      return res.json({ success: true, tracked: eventType });
    }

    if (!eventName || !customerEmail) {
      return res.status(400).json({ error: 'eventName and customerEmail are required' });
    }

    const result = await trackKlaviyoEvent(eventName, customerEmail, eventProperties || {}, customerProperties || {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to track Klaviyo event' });
  }
});

export default router;
