export type KlaviyoEventProperties = Record<string, unknown>;

declare global {
  interface Window {
    klaviyo?: any[];
    _learnq?: any[];
    __KLAVIYO_COMPANY_ID?: string;
    klaviyoCompanyId?: string;
  }
}

export function getKlaviyoCompanyId(): string {
  const fromProcess = typeof process !== 'undefined' ? (process.env?.NEXT_PUBLIC_KLAVIYO_COMPANY_ID || process.env?.NEXT_PUBLIC_KLAVIYO_PUBLIC_KEY || process.env?.KLAVIYO_SITE_ID || process.env?.KLAVIYO_PUBLIC_KEY || '') : '';
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  const fromMeta = metaEnv ? (metaEnv.NEXT_PUBLIC_KLAVIYO_COMPANY_ID || metaEnv.NEXT_PUBLIC_KLAVIYO_PUBLIC_KEY || metaEnv.VITE_KLAVIYO_COMPANY_ID || metaEnv.VITE_KLAVIYO_PUBLIC_KEY || '') : '';
  const fromWindow = typeof window !== 'undefined' ? (window.__KLAVIYO_COMPANY_ID || window.klaviyoCompanyId || '') : '';
  
  return (fromProcess || fromMeta || fromWindow || 'VPbY66').trim();
}

function shouldInitialize(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(getKlaviyoCompanyId());
}

export function initializeKlaviyo(): void {
  if (!shouldInitialize() || typeof document === 'undefined') return;

  const companyId = getKlaviyoCompanyId();
  const scriptId = 'klaviyo-onsite-script';

  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.async = true;
    script.src = `//static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(companyId)}`;
    document.head.appendChild(script);
  }

  if (!window.klaviyo) {
    window.klaviyo = [];
  }
  if (!window._learnq) {
    window._learnq = [];
  }
}

function pushKlaviyo(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (!window.klaviyo) {
    window.klaviyo = [];
  }
  if (!window._learnq) {
    window._learnq = [];
  }

  window.klaviyo.push([event, payload]);
  window._learnq.push(['track', event, payload]);
}

export function identifyCustomer(email?: string, properties: KlaviyoEventProperties = {}): void {
  if (typeof window === 'undefined' || !email) return;

  if (!window.klaviyo) {
    window.klaviyo = [];
  }
  if (!window._learnq) {
    window._learnq = [];
  }

  const profilePayload = {
    $email: email,
    ...properties,
  };

  window.klaviyo.push(['identify', profilePayload]);
  window._learnq.push(['identify', profilePayload]);
}

export function trackEvent(eventName: string, properties: KlaviyoEventProperties = {}): void {
  if (typeof window === 'undefined') return;

  const safeProperties = {
    ...properties,
    event_source: 'pouch_supply_storefront',
  };

  pushKlaviyo(eventName, safeProperties);
}

export function trackViewedProduct(product: { id: string; name: string; price: number; currency: string; recurring?: boolean; image?: string }): void {
  trackEvent('Viewed Product', {
    ProductID: product.id,
    ProductName: product.name,
    Price: product.price,
    $value: product.price,
    value: product.price,
    currency: product.currency || 'GBP',
    ImageURL: product.image,
    recurring: Boolean(product.recurring),
  });
}

export function trackAgeVerified(properties: KlaviyoEventProperties = {}): void {
  trackEvent('Age Verified', {
    flow: 'age_gate',
    ...properties,
  });
}

export function trackStartedCheckout(data: { items?: any[]; total?: number; customerEmail?: string; customerName?: string } | { id: string; name: string; price: number; currency: string; recurring?: boolean }): void {
  if ('items' in data || 'total' in data) {
    const multiItemData = data as { items?: any[]; total?: number; customerEmail?: string; customerName?: string };
    const items = multiItemData.items || [];
    const total = multiItemData.total || 0;
    if (multiItemData.customerEmail) {
      identifyCustomer(multiItemData.customerEmail, {
        $first_name: multiItemData.customerName?.split(' ')[0] || 'Valued',
        $last_name: multiItemData.customerName?.split(' ').slice(1).join(' ') || 'Customer',
      });
    }

    trackEvent('Started Checkout', {
      $value: total,
      value: total,
      ItemNames: items.map((i: any) => i.productTitle || i.title || i.name),
      Items: items.map((i: any) => ({
        ProductID: i.productId || i.id,
        SKU: i.sku || i.productId || i.id,
        ProductName: i.productTitle || i.title || i.name,
        Quantity: i.quantity || 1,
        ItemPrice: i.price,
        RowTotal: (i.price || 0) * (i.quantity || 1),
        ImageURL: i.image
      })),
      currency: 'GBP'
    });

    // Also notify backend
    if (multiItemData.customerEmail) {
      fetch('/api/klaviyo/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'checkout_started',
          customerEmail: multiItemData.customerEmail,
          data: { items, total }
        })
      }).catch(() => {});
    }
  } else {
    const singleItemData = data as { id: string; name: string; price: number; currency: string; recurring?: boolean };
    trackEvent('Started Checkout', {
      ProductID: singleItemData.id,
      ProductName: singleItemData.name,
      $value: singleItemData.price,
      value: singleItemData.price,
      currency: singleItemData.currency || 'GBP',
      recurring: Boolean(singleItemData.recurring),
    });
  }
}

export function trackOrderCompleted(order: {
  orderId?: string;
  id?: string;
  customerEmail?: string;
  email?: string;
  customerName?: string;
  name?: string;
  items?: any[];
  total?: number;
  amount?: number;
  destination?: string;
  address?: string;
  deliveryMethod?: string;
  discountApplied?: any;
  product?: { id: string; name: string; price: number; currency: string; recurring?: boolean };
}): void {
  const orderId = String(order.orderId || order.id || `PS${Math.floor(10000 + Math.random() * 90000)}`);
  const email = (order.customerEmail || order.email || 'customer@pouch-supply.com').trim().toLowerCase();
  const customerName = order.customerName || order.name || 'Valued Customer';
  const totalValue = typeof order.total === 'number' ? order.total : (order.amount ?? order.product?.price ?? 0);
  
  const nameParts = customerName.split(/\s+/);
  const firstName = nameParts[0] || 'Valued';
  const lastName = nameParts.slice(1).join(' ') || 'Customer';

  // Identify in browser onsite
  identifyCustomer(email, {
    $first_name: firstName,
    $last_name: lastName,
    first_name: firstName,
    last_name: lastName
  });

  const rawItems = order.items && order.items.length > 0 ? order.items : (order.product ? [{
    productId: order.product.id,
    productTitle: order.product.name,
    price: order.product.price,
    quantity: 1,
    isSubscription: order.product.recurring
  }] : []);

  const formattedItems = rawItems.map((i: any) => {
    const price = typeof i.price === 'number' ? i.price : parseFloat(i.price) || 0;
    const qty = typeof i.quantity === 'number' ? i.quantity : parseInt(i.quantity) || 1;
    return {
      ProductID: String(i.productId || i.id || 'pouch-item'),
      SKU: String(i.sku || i.productId || i.id || 'SKU-001'),
      ProductName: String(i.productTitle || i.title || i.name || 'Nicotine Pouch Pack'),
      Quantity: qty,
      ItemPrice: price,
      Price: price,
      RowTotal: parseFloat((price * qty).toFixed(2)),
      ImageURL: i.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300'
    };
  });

  const eventPayload = {
    $event_id: orderId,
    $value: totalValue,
    OrderId: orderId,
    order_id: orderId,
    ItemNames: formattedItems.map(i => i.ProductName),
    Items: formattedItems,
    Categories: ['Nicotine Pouches', 'Storefront'],
    Destination: order.destination || order.address || 'United Kingdom',
    DeliveryMethod: order.deliveryMethod || 'Royal Mail Tracked 24/48',
    DiscountApplied: order.discountApplied || null,
    ShippingAddress: {
      first_name: firstName,
      last_name: lastName,
      address1: order.destination || order.address || 'United Kingdom'
    },
    extra: {
      order_id: orderId,
      items: formattedItems,
      total: totalValue
    }
  };

  // Push "Placed Order" to client-side Klaviyo tracker
  trackEvent('Placed Order', eventPayload);

  // Push "Ordered Product" for individual items
  for (const item of formattedItems) {
    trackEvent('Ordered Product', {
      $event_id: `${orderId}_${item.ProductID}`,
      $value: item.RowTotal,
      OrderId: orderId,
      ProductID: item.ProductID,
      ProductName: item.ProductName,
      Quantity: item.Quantity,
      ItemPrice: item.ItemPrice,
      RowTotal: item.RowTotal
    });
  }

  // Also trigger server-side dual dispatch for reliability
  fetch('/api/klaviyo/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'purchase',
      customerEmail: email,
      data: {
        id: orderId,
        customerEmail: email,
        customerName,
        total: totalValue,
        destination: order.destination || order.address,
        deliveryMethod: order.deliveryMethod,
        discountApplied: order.discountApplied,
        items: rawItems
      }
    })
  }).catch(err => {
    console.warn('[Klaviyo Client Track Error]:', err);
  });
}

export function trackCheckoutFailed(product: { id: string; name: string; price: number; currency: string; recurring?: boolean }, errorMessage?: string): void {
  trackEvent('Checkout Failed', {
    ProductID: product.id,
    ProductName: product.name,
    $value: product.price,
    currency: product.currency || 'GBP',
    recurring: Boolean(product.recurring),
    ErrorMessage: errorMessage ?? 'unknown',
  });
}

export function trackSubscriptionStarted(product: { id: string; name: string; price: number; currency: string; recurring?: boolean }, subscriptionId?: string): void {
  trackEvent('Started Subscription', {
    ProductID: product.id,
    ProductName: product.name,
    $value: product.price,
    currency: product.currency || 'GBP',
    recurring: true,
    SubscriptionID: subscriptionId ?? 'unknown',
  });
}

// ----------------------------------------------------
// Convenience & Compatibility Aliases
// ----------------------------------------------------
export const initKlaviyo = (companyIdOrPublicKey?: string) => {
  if (typeof window !== 'undefined' && companyIdOrPublicKey) {
    window.__KLAVIYO_COMPANY_ID = companyIdOrPublicKey;
  }
  initializeKlaviyo();
};

export const klaviyoIdentify = (customer: { email?: string; name?: string } | null, properties: KlaviyoEventProperties = {}) => {
  if (!customer?.email) return;
  const nameParts = (customer.name || '').trim().split(/\s+/);
  identifyCustomer(customer.email, {
    $first_name: nameParts[0] || 'Customer',
    $last_name: nameParts.slice(1).join(' ') || 'User',
    ...properties,
  });
};

export const klaviyoReset = () => {
  if (typeof window === 'undefined') return;
  if (window.klaviyo) window.klaviyo.push(['identify', {}]);
  if (window._learnq) window._learnq.push(['identify', {}]);
};

export const klaviyoTrack = trackEvent;

export const klaviyoTrackViewedProduct = (product: { id: string; title?: string; name?: string; price: number; isSubscription?: boolean; image?: string }) => {
  trackViewedProduct({
    id: product.id,
    name: product.name || product.title || 'Product',
    price: product.price,
    currency: 'GBP',
    image: product.image,
    recurring: Boolean(product.isSubscription),
  });
};

export const klaviyoTrackAddedToCart = (product: { id: string; title?: string; name?: string; price: number; isSubscription?: boolean; image?: string }, quantity: number = 1) => {
  trackEvent('Added to Cart', {
    ProductID: product.id,
    ProductName: product.name || product.title || 'Product',
    Quantity: quantity,
    $value: product.price * quantity,
    value: product.price * quantity,
    Price: product.price,
    ImageURL: product.image,
    currency: 'GBP',
    recurring: Boolean(product.isSubscription),
  });
};

export const klaviyoTrackStartedCheckout = (cartItems: any[], subtotal: number, discountAmount: number = 0, email?: string, name?: string) => {
  trackStartedCheckout({
    items: cartItems,
    total: Math.max(0, subtotal - discountAmount),
    customerEmail: email,
    customerName: name
  });
};

export const klaviyoTrackPlacedOrder = (
  orderId: string,
  cartItems: any[],
  total: number,
  discountCode: string = '',
  email?: string,
  name?: string,
  destination?: string
) => {
  trackOrderCompleted({
    orderId,
    items: cartItems,
    total,
    discountApplied: discountCode,
    customerEmail: email,
    customerName: name,
    destination
  });
};

export const klaviyoTrackNewsletterSubscribe = (email: string) => {
  identifyCustomer(email, { source: 'Footer Newsletter' });
  trackEvent('Newsletter Subscribed', { email, source: 'Storefront Footer' });
  fetch('/api/klaviyo/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'newsletter_signup',
      customerEmail: email
    })
  }).catch(() => {});
};
