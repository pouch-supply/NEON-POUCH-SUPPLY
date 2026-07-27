import { Customer, Product, CartItem } from '../types';

/**
 * Initialize Klaviyo Javascript script on-demand using the provided Public API Key (Site ID)
 */
export function initKlaviyo(publicKey: string) {
  if (!publicKey || typeof window === 'undefined') return;

  const win = window as any;
  win._learnq = win._learnq || [];

  // If script already exists, do not duplicate
  if (document.getElementById('klaviyo-js')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'klaviyo-js';
  script.type = 'text/javascript';
  script.async = true;
  script.src = `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(publicKey)}`;
  document.head.appendChild(script);

  console.log(`[Klaviyo] On-site Javascript SDK loaded for Site ID: ${publicKey}`);
}

/**
 * Identify a user with Klaviyo profile properties
 */
export function klaviyoIdentify(customer: Customer | null) {
  if (!customer || typeof window === 'undefined') return;

  const win = window as any;
  win._learnq = win._learnq || [];

  const nameParts = (customer.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const profileProperties: Record<string, any> = {
    '$email': customer.email,
    '$first_name': firstName,
    '$last_name': lastName,
    'Total Orders': customer.ordersCount || 0,
    'Total Spent': customer.amountSpent || 0,
    'Subscription Status': customer.subscriptionStatus || 'Not subscribed'
  };

  win._learnq.push(['identify', profileProperties]);
  console.log('[Klaviyo] Profile identified:', customer.email);
}

/**
 * Reset/un-identify user (useful upon logout)
 */
export function klaviyoReset() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  win._learnq = win._learnq || [];
  
  // Klaviyo reset method pushes an empty identify or cleans cookies if supported,
  // we do a blank identify or special track to reset the user session state
  win._learnq.push(['identify', {}]);
  console.log('[Klaviyo] Session reset requested');
}

/**
 * General purpose event tracking helper
 */
export function klaviyoTrack(eventName: string, properties: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win._learnq = win._learnq || [];

  win._learnq.push(['track', eventName, properties]);
  console.log(`[Klaviyo] Event Tracked: "${eventName}"`, properties);
}

/**
 * Track "Viewed Product" event for Catalog details analytics
 */
export function klaviyoTrackViewedProduct(product: Product) {
  klaviyoTrack('Viewed Product', {
    'ProductName': product.title,
    'ProductID': product.id,
    'SKU': product.sku || product.id,
    'Categories': product.tags || [],
    'ImageURL': product.image || '',
    'Price': product.price,
    'CompareAtPrice': product.compareAtPrice || product.price,
    'Vendor': product.vendor,
    'CanisterStrength': product.strength || '',
    'InStock': product.inventory > 0
  });
}

/**
 * Track "Added to Cart" event
 */
export function klaviyoTrackAddedToCart(product: Product, quantity: number = 1) {
  klaviyoTrack('Added to Cart', {
    'ProductName': product.title,
    'ProductID': product.id,
    'SKU': product.sku || product.id,
    'Categories': product.tags || [],
    'ImageURL': product.image || '',
    'Price': product.price,
    'Quantity': quantity,
    'Value': product.price * quantity,
    'Vendor': product.vendor
  });
}

/**
 * Track "Started Checkout" event
 */
export function klaviyoTrackStartedCheckout(cartItems: CartItem[], subtotal: number, discountAmount: number = 0) {
  const items = cartItems.map(item => ({
    'ProductName': item.productTitle,
    'ProductID': item.productId,
    'Quantity': item.quantity,
    'Price': item.price,
    'Total': item.price * item.quantity,
    'Vendor': item.vendor || '',
    'ImageURL': item.image || ''
  }));

  klaviyoTrack('Started Checkout', {
    'Items': items,
    'Subtotal': subtotal,
    'DiscountAmount': discountAmount,
    'TotalValue': Math.max(0, subtotal - discountAmount),
    'ItemCount': cartItems.reduce((acc, i) => acc + i.quantity, 0)
  });
}

/**
 * Track "Placed Order" event upon success
 */
export function klaviyoTrackPlacedOrder(orderId: string, cartItems: CartItem[], total: number, discountCode: string = '') {
  const items = cartItems.map(item => ({
    'ProductName': item.productTitle,
    'ProductID': item.productId,
    'Quantity': item.quantity,
    'Price': item.price,
    'Total': item.price * item.quantity,
    'Vendor': item.vendor || '',
    'ImageURL': item.image || ''
  }));

  klaviyoTrack('Placed Order', {
    'OrderID': orderId,
    'Items': items,
    'Value': total,
    'DiscountCode': discountCode,
    'ItemCount': cartItems.reduce((acc, i) => acc + i.quantity, 0)
  });
}

/**
 * Track "Subscribed to Newsletter" event (Footer submission etc.)
 */
export function klaviyoTrackNewsletterSubscribe(email: string) {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win._learnq = win._learnq || [];

  // Identify the email first
  win._learnq.push(['identify', { '$email': email }]);
  
  // Track event
  klaviyoTrack('Subscribed to Newsletter', {
    'email': email,
    'Source': 'Footer Form'
  });
}
