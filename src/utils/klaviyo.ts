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
  
  return (fromProcess || fromMeta || fromWindow || '').trim();
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

  window.klaviyo.push([event, payload]);

  if (window._learnq) {
    window._learnq.push(['track', event, payload]);
  }
}

export function identifyCustomer(email?: string, properties: KlaviyoEventProperties = {}): void {
  if (typeof window === 'undefined' || !email) return;

  if (!window.klaviyo) {
    window.klaviyo = [];
  }

  window.klaviyo.push([
    'identify',
    {
      $email: email,
      ...properties,
    },
  ]);

  if (window._learnq) {
    window._learnq.push([
      'identify',
      {
        $email: email,
        ...properties,
      },
    ]);
  }
}

export function trackEvent(eventName: string, properties: KlaviyoEventProperties = {}): void {
  if (typeof window === 'undefined') return;

  const safeProperties = {
    ...properties,
    event_source: 'worldpay_try_store',
  };

  pushKlaviyo('track', { event: eventName, ...safeProperties });
}

export function trackViewedProduct(product: { id: string; name: string; price: number; currency: string; recurring?: boolean }): void {
  trackEvent('Viewed Product', {
    product_id: product.id,
    product_name: product.name,
    value: product.price,
    currency: product.currency,
    recurring: Boolean(product.recurring),
  });
}

export function trackAgeVerified(properties: KlaviyoEventProperties = {}): void {
  trackEvent('Age Verified', {
    flow: 'ac0130',
    ...properties,
  });
}

export function trackStartedCheckout(product: { id: string; name: string; price: number; currency: string; recurring?: boolean }): void {
  trackEvent('Started Checkout', {
    product_id: product.id,
    product_name: product.name,
    value: product.price,
    currency: product.currency,
    recurring: Boolean(product.recurring),
  });
}

export function trackOrderCompleted(order: { orderId: string; product: { id: string; name: string; price: number; currency: string; recurring?: boolean }; email?: string; amount?: number }): void {
  const eventProperties = {
    order_id: order.orderId,
    product_id: order.product.id,
    product_name: order.product.name,
    value: order.amount ?? order.product.price,
    currency: order.product.currency,
    recurring: Boolean(order.product.recurring),
  };

  if (order.email) {
    identifyCustomer(order.email, {
      $first_name: 'Customer',
      $last_name: 'Worldpay',
      customer_type: order.product.recurring ? 'subscriber' : 'one_time_customer',
    });
  }

  trackEvent('Placed Order', eventProperties);
}

export function trackCheckoutFailed(product: { id: string; name: string; price: number; currency: string; recurring?: boolean }, errorMessage?: string): void {
  trackEvent('Checkout Failed', {
    product_id: product.id,
    product_name: product.name,
    value: product.price,
    currency: product.currency,
    recurring: Boolean(product.recurring),
    error_message: errorMessage ?? 'unknown',
  });
}

export function trackSubscriptionStarted(product: { id: string; name: string; price: number; currency: string; recurring?: boolean }, subscriptionId?: string): void {
  trackEvent('Started Subscription', {
    product_id: product.id,
    product_name: product.name,
    value: product.price,
    currency: product.currency,
    recurring: true,
    subscription_id: subscriptionId ?? 'unknown',
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

export const klaviyoTrackViewedProduct = (product: { id: string; title?: string; name?: string; price: number; isSubscription?: boolean }) => {
  trackViewedProduct({
    id: product.id,
    name: product.name || product.title || 'Product',
    price: product.price,
    currency: 'GBP',
    recurring: Boolean(product.isSubscription),
  });
};

export const klaviyoTrackAddedToCart = (product: { id: string; title?: string; name?: string; price: number; isSubscription?: boolean }, quantity: number = 1) => {
  trackEvent('Added to Cart', {
    product_id: product.id,
    product_name: product.name || product.title || 'Product',
    quantity,
    value: product.price * quantity,
    currency: 'GBP',
    recurring: Boolean(product.isSubscription),
  });
};

export const klaviyoTrackStartedCheckout = (cartItems: any[], subtotal: number, discountAmount: number = 0) => {
  const firstItem = cartItems[0] || { productId: 'cart', productTitle: 'Cart Items', price: subtotal };
  trackStartedCheckout({
    id: firstItem.productId || firstItem.id || 'cart',
    name: firstItem.productTitle || firstItem.name || 'Cart Items',
    price: Math.max(0, subtotal - discountAmount),
    currency: 'GBP',
    recurring: Boolean(cartItems.some(i => i.isSubscription || i.productId?.startsWith('sub-pack-'))),
  });
};

export const klaviyoTrackPlacedOrder = (orderId: string, cartItems: any[], total: number, discountCode: string = '', email?: string) => {
  const firstItem = cartItems[0] || { productId: 'order-item', productTitle: 'Order Items', price: total };
  trackOrderCompleted({
    orderId,
    email,
    product: {
      id: firstItem.productId || firstItem.id || 'order-item',
      name: firstItem.productTitle || firstItem.name || 'Order Items',
      price: total,
      currency: 'GBP',
      recurring: Boolean(cartItems.some(i => i.isSubscription || i.productId?.startsWith('sub-pack-'))),
    },
    amount: total,
  });
};

export const klaviyoTrackNewsletterSubscribe = (email: string) => {
  identifyCustomer(email, { source: 'Footer Newsletter' });
  trackEvent('Subscribed to Newsletter', { email, form: 'Footer Form' });
};
