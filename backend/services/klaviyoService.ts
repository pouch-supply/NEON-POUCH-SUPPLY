import { fetchResource, saveResource } from '../../serverDb';

export interface KlaviyoSettings {
  enabled: boolean;
  apiKey: string;
  siteId: string;
  publicKey?: string;
  listId?: string;
  trackEvents: {
    customerSignup: boolean;
    newsletterSignup: boolean;
    emailVerified: boolean;
    addToCart: boolean;
    checkoutStarted: boolean;
    purchase: boolean;
    refunded: boolean;
    wishlist: boolean;
  };
}

export interface KlaviyoEventLog {
  id: string;
  eventName: string;
  customerEmail: string;
  status: 'sent' | 'simulated' | 'failed' | 'disabled';
  error?: string;
  timestamp: string;
  payload?: any;
}

const DEFAULT_KLAVIYO_SETTINGS: KlaviyoSettings = {
  enabled: true,
  apiKey: process.env.KLAVIYO_API_KEY || '',
  siteId: process.env.KLAVIYO_SITE_ID || process.env.KLAVIYO_PUBLIC_KEY || '',
  publicKey: process.env.KLAVIYO_SITE_ID || process.env.KLAVIYO_PUBLIC_KEY || '',
  listId: '',
  trackEvents: {
    customerSignup: true,
    newsletterSignup: true,
    emailVerified: true,
    addToCart: true,
    checkoutStarted: true,
    purchase: true,
    refunded: true,
    wishlist: true
  }
};

export async function getKlaviyoSettings(): Promise<KlaviyoSettings> {
  try {
    const stored: any = await fetchResource('klaviyo_settings');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const siteIdVal = stored.siteId || stored.publicKey || DEFAULT_KLAVIYO_SETTINGS.siteId;
      return {
        ...DEFAULT_KLAVIYO_SETTINGS,
        ...stored,
        siteId: siteIdVal,
        publicKey: siteIdVal,
        trackEvents: {
          ...DEFAULT_KLAVIYO_SETTINGS.trackEvents,
          ...(stored.trackEvents || {})
        }
      };
    }
  } catch (err) {}
  return DEFAULT_KLAVIYO_SETTINGS;
}

export async function saveKlaviyoSettings(settings: Partial<KlaviyoSettings>): Promise<KlaviyoSettings> {
  const current = await getKlaviyoSettings();
  const siteIdVal = settings.siteId || settings.publicKey || current.siteId;
  const updated: KlaviyoSettings = {
    ...current,
    ...settings,
    siteId: siteIdVal,
    publicKey: siteIdVal,
    trackEvents: {
      ...current.trackEvents,
      ...(settings.trackEvents || {})
    }
  };
  await saveResource('klaviyo_settings', updated as any);
  return updated;
}

export async function getKlaviyoLogs(): Promise<KlaviyoEventLog[]> {
  try {
    const logs = await fetchResource('klaviyo_logs');
    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    return [];
  }
}

async function logKlaviyoEvent(entry: Omit<KlaviyoEventLog, 'id' | 'timestamp'>): Promise<KlaviyoEventLog> {
  const newLog: KlaviyoEventLog = {
    ...entry,
    id: `klaviyo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString()
  };

  try {
    const currentLogs = await getKlaviyoLogs();
    const updated = [newLog, ...currentLogs].slice(0, 500);
    await saveResource('klaviyo_logs', updated);
  } catch (err) {}

  return newLog;
}

export async function trackKlaviyoEvent(
  eventName: string,
  customerEmail: string,
  eventProperties: Record<string, any> = {},
  customerProperties: Record<string, any> = {}
): Promise<{ success: boolean; log: KlaviyoEventLog }> {
  const settings = await getKlaviyoSettings();

  if (!settings.enabled) {
    const log = await logKlaviyoEvent({
      eventName,
      customerEmail,
      status: 'disabled',
      error: 'Klaviyo integration is disabled globally'
    });
    return { success: false, log };
  }

  const apiKey = settings.apiKey || process.env.KLAVIYO_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.log(`[Klaviyo] Simulated event '${eventName}' for ${customerEmail} (No KLAVIYO_API_KEY configured)`);
    const log = await logKlaviyoEvent({
      eventName,
      customerEmail,
      status: 'simulated',
      error: 'No KLAVIYO_API_KEY configured (simulated mode active)',
      payload: { eventProperties, customerProperties }
    });
    return { success: true, log };
  }

  try {
    // Official Klaviyo Events API v3 endpoint
    const response = await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'revision': '2024-02-15'
      },
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: {
                  name: eventName
                }
              }
            },
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: customerEmail,
                  ...customerProperties
                }
              }
            },
            properties: eventProperties,
            time: new Date().toISOString()
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Klaviyo Tracking] API response status ${response.status} for event '${eventName}':`, errorText);
      const log = await logKlaviyoEvent({
        eventName,
        customerEmail,
        status: 'failed',
        error: `API HTTP ${response.status}: ${errorText}`,
        payload: { eventProperties }
      });
      return { success: false, log };
    }

    console.log(`[Klaviyo] Event '${eventName}' successfully tracked for ${customerEmail}!`);
    const log = await logKlaviyoEvent({
      eventName,
      customerEmail,
      status: 'sent',
      payload: { eventProperties }
    });
    return { success: true, log };

  } catch (err: any) {
    console.error(`[Klaviyo] Network error tracking '${eventName}':`, err);
    const log = await logKlaviyoEvent({
      eventName,
      customerEmail,
      status: 'failed',
      error: err.message || String(err),
      payload: { eventProperties }
    });
    return { success: false, log };
  }
}

// Convenience event methods
export async function trackCustomerSignup(customer: { email: string; name?: string }) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.customerSignup) return;
  return trackKlaviyoEvent('Customer Registered', customer.email, {
    signupDate: new Date().toISOString()
  }, {
    first_name: customer.name?.split(' ')[0],
    last_name: customer.name?.split(' ').slice(1).join(' ')
  });
}

export async function trackNewsletterSignup(email: string) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.newsletterSignup) return;
  return trackKlaviyoEvent('Newsletter Subscribed', email, {
    source: 'Storefront Footer / Popup'
  });
}

export async function trackEmailVerified(email: string, name?: string) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.emailVerified) return;
  return trackKlaviyoEvent('Email Verified', email, {
    verifiedAt: new Date().toISOString()
  });
}

export async function trackAddToCart(email: string, item: any, quantity: number = 1) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.addToCart) return;
  return trackKlaviyoEvent('Added to Cart', email, {
    ProductName: item.title || item.productTitle,
    ProductID: item.id || item.productId,
    Price: item.price,
    Quantity: quantity,
    Value: (item.price || 0) * quantity
  });
}

export async function trackCheckoutStarted(email: string, cartItems: any[], totalValue: number) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.checkoutStarted) return;
  return trackKlaviyoEvent('Checkout Started', email, {
    $value: totalValue,
    ItemNames: cartItems.map((i: any) => i.title || i.productTitle),
    Items: cartItems
  });
}

export async function trackPurchaseCompleted(order: any) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.purchase) return;
  const email = order.customerEmail || 'customer@pouch-supply.com';
  return trackKlaviyoEvent('Placed Order', email, {
    $event_id: String(order.id),
    $value: typeof order.total === 'number' ? order.total : parseFloat(order.total) || 0,
    ItemNames: (order.items || []).map((i: any) => i.productTitle || i.title),
    Items: order.items || [],
    Destination: order.destination || order.address
  });
}

export async function trackOrderRefunded(order: any, refundAmount?: number) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.refunded) return;
  const email = order.customerEmail || 'customer@pouch-supply.com';
  return trackKlaviyoEvent('Refunded Order', email, {
    $event_id: String(order.id),
    $value: refundAmount !== undefined ? refundAmount : order.total,
    OrderId: String(order.id)
  });
}

export async function trackWishlistAdded(email: string, item: any) {
  const settings = await getKlaviyoSettings();
  if (!settings.trackEvents.wishlist) return;
  return trackKlaviyoEvent('Added to Wishlist', email, {
    ProductName: item.title,
    ProductID: item.id,
    Price: item.price
  });
}

export async function trackOrderShipped(order: any, trackingNumber?: string, carrier?: string) {
  const email = order.customerEmail || 'customer@pouch-supply.com';
  return trackKlaviyoEvent('Order Shipped', email, {
    $event_id: String(order.id),
    OrderId: String(order.id),
    Carrier: carrier || order.carrier || 'Royal Mail Tracked 24',
    TrackingNumber: trackingNumber || order.trackingNumber || order.trackingId,
    TrackingUrl: `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber || order.trackingNumber || order.trackingId}`,
    Destination: order.destination || order.address
  });
}
