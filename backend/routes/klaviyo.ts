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
