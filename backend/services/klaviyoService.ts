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
  status: 'sent' | 'failed' | 'disabled';
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
    if (Array.isArray(logs)) {
      return logs.filter((l: any) => l.status !== 'simulated');
    }
    return [];
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

  let apiKey = (settings.apiKey || process.env.KLAVIYO_API_KEY || '').trim();
  if (apiKey.toLowerCase().startsWith('klaviyo-api-key ')) {
    apiKey = apiKey.substring(16).trim();
  }

  if (!apiKey) {
    console.warn(`[Klaviyo] Event '${eventName}' not tracked for ${customerEmail} (No KLAVIYO_API_KEY configured)`);
    const log = await logKlaviyoEvent({
      eventName,
      customerEmail,
      status: 'failed',
      error: 'Klaviyo Private API Key is not configured. Enter an API key in Klaviyo Settings to track events.',
      payload: { eventProperties, customerProperties }
    });
    return { success: false, log };
  }

  try {
    // 1. Sanitize Profile Attributes for Klaviyo API v3
    const cleanEmail = (customerEmail || '').trim().toLowerCase();
    const profileAttributes: Record<string, any> = {
      email: cleanEmail
    };
    const customProfileProps: Record<string, any> = {};

    if (customerProperties && typeof customerProperties === 'object') {
      for (const [rawKey, val] of Object.entries(customerProperties)) {
        if (val === undefined || val === null) continue;
        const key = rawKey.replace(/^\$/, ''); // Remove leading $ if present
        if (key === 'email') {
          profileAttributes.email = String(val).trim().toLowerCase();
        } else if (key === 'first_name' || key === 'firstName') {
          profileAttributes.first_name = String(val).trim();
        } else if (key === 'last_name' || key === 'lastName') {
          profileAttributes.last_name = String(val).trim();
        } else if (key === 'phone_number' || key === 'phone') {
          profileAttributes.phone_number = String(val).trim();
        } else if (key === 'external_id') {
          profileAttributes.external_id = String(val).trim();
        } else if (key === 'organization' || key === 'title' || key === 'image' || key === 'location') {
          profileAttributes[key] = val;
        } else {
          customProfileProps[key] = val;
        }
      }
    }

    if (Object.keys(customProfileProps).length > 0) {
      profileAttributes.properties = customProfileProps;
    }

    // 2. Extract numeric value
    let numValue: number | undefined = undefined;
    if (typeof eventProperties.$value === 'number') numValue = eventProperties.$value;
    else if (typeof eventProperties.value === 'number') numValue = eventProperties.value;
    else if (typeof eventProperties.total === 'number') numValue = eventProperties.total;
    else if (typeof eventProperties.Value === 'number') numValue = eventProperties.Value;
    else if (typeof eventProperties.$value === 'string') {
      const parsed = parseFloat(eventProperties.$value);
      if (!isNaN(parsed)) numValue = parsed;
    } else if (typeof eventProperties.total === 'string') {
      const parsed = parseFloat(eventProperties.total);
      if (!isNaN(parsed)) numValue = parsed;
    }

    // 3. Extract unique_id for deduplication
    const uniqueId = eventProperties.$event_id || eventProperties.OrderId || eventProperties.id || undefined;

    // 4. Clean custom event properties
    const cleanProps = { ...eventProperties };
    delete cleanProps.$value;
    delete cleanProps.$event_id;

    // 5. Construct Klaviyo API v3 Event Object
    const attributes: Record<string, any> = {
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
          attributes: profileAttributes
        }
      },
      properties: cleanProps,
      time: new Date().toISOString()
    };

    if (numValue !== undefined && !isNaN(numValue)) {
      attributes.value = numValue;
    }

    if (uniqueId) {
      attributes.unique_id = String(uniqueId);
    }

    const requestBody = {
      data: {
        type: 'event',
        attributes
      }
    };

    console.log(`[Klaviyo] Sending event '${eventName}' to Klaviyo for ${profileAttributes.email}...`);

    const response = await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'revision': '2024-02-15'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = `HTTP ${response.status}: ${errorText}`;
      try {
        const jsonErr = JSON.parse(errorText);
        if (jsonErr.errors && Array.isArray(jsonErr.errors)) {
          errorDetails = jsonErr.errors.map((e: any) => `${e.title || 'Error'}: ${e.detail || e.message || JSON.stringify(e)}`).join(' | ');
        }
      } catch (e) {}

      console.error(`[Klaviyo API Error] '${eventName}' failed (${response.status}):`, errorDetails);
      const log = await logKlaviyoEvent({
        eventName,
        customerEmail: profileAttributes.email,
        status: 'failed',
        error: errorDetails,
        payload: { eventProperties: cleanProps }
      });
      return { success: false, log };
    }

    console.log(`[Klaviyo] Event '${eventName}' successfully tracked for ${profileAttributes.email}!`);
    const log = await logKlaviyoEvent({
      eventName,
      customerEmail: profileAttributes.email,
      status: 'sent',
      payload: { eventProperties: cleanProps }
    });
    return { success: true, log };

  } catch (err: any) {
    console.error(`[Klaviyo Network Error] Failed tracking '${eventName}':`, err);
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
  if (settings.trackEvents && settings.trackEvents.purchase === false) return;
  const email = (order.customerEmail || 'customer@pouch-supply.com').toLowerCase().trim();

  const nameParts = (order.customerName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Valued';
  const lastName = nameParts.slice(1).join(' ') || 'Customer';

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const formattedItems = rawItems.map((i: any) => {
    const priceNum = typeof i.price === 'number' ? i.price : parseFloat(i.price) || 0;
    const qtyNum = typeof i.quantity === 'number' ? i.quantity : parseInt(i.quantity) || 1;
    return {
      ProductID: String(i.productId || i.id || 'prod-generic'),
      SKU: String(i.sku || i.productId || i.id || 'SKU-001'),
      ProductName: String(i.productTitle || i.title || i.name || 'Nicotine Pouch Pack'),
      Quantity: qtyNum,
      ItemPrice: priceNum,
      Price: priceNum,
      RowTotal: priceNum * qtyNum,
      ImageURL: i.image || i.imageUrl || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
      Vendor: i.vendor || 'Pouch Supply Co.'
    };
  });

  const itemNames = formattedItems.map((i: any) => i.ProductName);
  const totalVal = typeof order.total === 'number' ? order.total : parseFloat(order.total) || 0;
  const orderIdStr = String(order.id || `PS${Math.floor(Math.random() * 90000 + 10000)}`);

  return trackKlaviyoEvent('Placed Order', email, {
    $event_id: orderIdStr,
    $value: totalVal,
    OrderId: orderIdStr,
    ItemNames: itemNames,
    Items: formattedItems,
    Categories: ['Nicotine Pouches', 'Storefront'],
    Destination: order.destination || order.address || 'United Kingdom',
    DeliveryMethod: order.deliveryMethod || 'Royal Mail Tracked 24/48',
    DiscountApplied: order.discountApplied || null,
    StoreCreditApplied: order.storeCreditApplied || 0,
    ShippingAddress: {
      first_name: firstName,
      last_name: lastName,
      address1: order.destination || order.address || 'United Kingdom'
    }
  }, {
    $email: email,
    $first_name: firstName,
    $last_name: lastName,
    first_name: firstName,
    last_name: lastName
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
