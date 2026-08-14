// CheckoutView.tsx
import React, { useState, useEffect } from 'react';
import { CartItem, Discount, Customer, Order } from '../types';
import { 
  ShieldCheck, ArrowLeft, CreditCard, Lock, Terminal, 
  CheckCircle, AlertTriangle, AlertCircle, RefreshCw, 
  Truck, ShoppingCart, UserCheck, Check, X, Loader2,
  Clock, ExternalLink, Repeat, User
} from 'lucide-react';
import SubscriptionIcon from './SubscriptionIcon';
import GoogleAccountChooserModal from './GoogleAccountChooserModal';
import AgeGate, { AgeGateHandle } from './AgeGate';
import { calculateDiscountAmount, calculateVolumePrice } from '../utils';
import { trackStartedCheckout, trackOrderCompleted, trackCheckoutFailed, trackSubscriptionStarted } from '../utils/klaviyo';

interface CheckoutViewProps {
  cartItems: CartItem[];
  discountApplied: Discount | null;
  totalAmount: number;
  loggedInCustomer: Customer | null;
  onNavigate: (tab: string) => void;
  onCompleteCheckout: (paymentDetails: {
    orderId: string;
    customerName: string;
    customerEmail: string;
    address: string;
    total: number;
    discountApplied: Discount | null;
    items: { productId: string; productTitle: string; price: number; quantity: number; image?: string; }[];
    gatewayTxId: string;
    gatewayAuthCode: string;
    cardBrand: string;
    storeCreditApplied?: number;
    paymentMethod?: string;
  }) => void;
  activeDiscounts?: Discount[];
  customers?: Customer[];
  onApplyDiscount?: (discount: Discount | null) => void;
}

export default function CheckoutView({
  cartItems,
  discountApplied,
  totalAmount,
  loggedInCustomer,
  onNavigate,
  onCompleteCheckout,
  activeDiscounts = [],
  customers = [],
  onApplyDiscount
}: CheckoutViewProps) {
  const [applyStoreCredit, setApplyStoreCredit] = useState(false);
  const [currentDiscount, setCurrentDiscount] = useState<Discount | null>(discountApplied);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  // Shipping info state
  const [fullName, setFullName] = useState(loggedInCustomer?.name || '');
  const [email, setEmail] = useState(loggedInCustomer?.email || '');
  const [addressLine, setAddressLine] = useState(
    loggedInCustomer?.addresses && loggedInCustomer.addresses[0] ? loggedInCustomer.addresses[0] : ''
  );
  const [city, setCity] = useState('London');
  const [postcode, setPostcode] = useState('EC1A 1BB');
  const [country, setCountry] = useState('United Kingdom');

  // Payment state
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [worldpayRedirectUrl, setWorldpayRedirectUrl] = useState<string | null>(null);

  // Polling for payment status
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // AgeChecked Gate State & Ref
  const ageGateRef = React.useRef<AgeGateHandle>(null);
  const [isAgeApproved, setIsAgeApproved] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('agechecked-approved');
    const params = new URLSearchParams(window.location.search);
    return stored === 'true' || params.get('agechecked') === 'approved' || params.get('approved') === 'true';
  });

  // Logging for development
  const [showLogs, setShowLogs] = useState(false);
  const [apiLogs, setApiLogs] = useState<{ timestamp: string; type: 'REQUEST' | 'RESPONSE' | 'ERROR'; payload: any }[]>([]);

  useEffect(() => {
    setCurrentDiscount(discountApplied);
  }, [discountApplied]);

  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // Auto-fill customer details
  useEffect(() => {
    if (loggedInCustomer) {
      setFullName(loggedInCustomer.name);
      setEmail(loggedInCustomer.email);
      if (loggedInCustomer.addresses && loggedInCustomer.addresses[0]) {
        setAddressLine(loggedInCustomer.addresses[0]);
      }
    }
  }, [loggedInCustomer]);

  const handleGoogleAccountSelect = async (account: { email: string; name?: string; picture?: string; customer?: any }) => {
    if (account.name) setFullName(account.name);
    if (account.email) setEmail(account.email);

    if (account.customer) {
      localStorage.setItem('ps_logged_in_customer', JSON.stringify(account.customer));
      if (account.customer.addresses && account.customer.addresses[0]) {
        setAddressLine(account.customer.addresses[0]);
      }
      setIsGoogleModalOpen(false);
      return;
    }

    try {
      const response = await fetch('/api/customers/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email.toLowerCase().trim(),
          name: account.name || 'Scott Kivlin',
          picture: account.picture
        })
      });
      const data = await response.json();
      if (response.ok && data.customer) {
        localStorage.setItem('ps_logged_in_customer', JSON.stringify(data.customer));
        if (data.customer.addresses && data.customer.addresses[0]) {
          setAddressLine(data.customer.addresses[0]);
        }
      }
    } catch (err) {
      console.warn('[Checkout Google Sign-In Warning]', err);
    } finally {
      setIsGoogleModalOpen(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const addLog = (type: 'REQUEST' | 'RESPONSE' | 'ERROR', payload: any) => {
    setApiLogs(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        type,
        payload
      },
      ...prev
    ]);
  };

  const handleApplyPromoInCheckout = (e: React.MouseEvent) => {
    e.preventDefault();
    setPromoError('');
    setPromoSuccess('');

    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      setPromoError('Please enter a code.');
      return;
    }

    const found = activeDiscounts?.find(d => d.title.toUpperCase() === code && d.status === 'Active');
    if (found) {
      setCurrentDiscount(found);
      if (onApplyDiscount) {
        onApplyDiscount(found);
      }
      setPromoSuccess(`Promo Code "${code}" applied: ${found.details}!`);
    } else {
      const matchingCustomer = customers?.find(c => c.referralCode && c.referralCode.toUpperCase() === code);
      if (matchingCustomer) {
        if (loggedInCustomer && loggedInCustomer.id === matchingCustomer.id) {
          setPromoError("You cannot use your own referral code.");
          return;
        }

        const virtualDiscount: Discount = {
          id: `disc-ref-virtual-${matchingCustomer.id}`,
          title: code,
          status: 'Active',
          method: 'Code',
          eligibility: 'All customers',
          type: 'Amount off order',
          valueType: 'Percentage',
          valueAmount: 10,
          details: `10% referral discount courtesy of ${matchingCustomer.name.split(" ")[0]}`,
          used: 0,
          limitOnePerCustomer: true
        };
        setCurrentDiscount(virtualDiscount);
        if (onApplyDiscount) {
          onApplyDiscount(virtualDiscount);
        }
        setPromoSuccess(`Referral code applied! You receive a 10% discount.`);
      } else {
        setPromoError('Invalid or expired promo code.');
      }
    }
  };

  const safeParseJson = async (res: Response) => {
    const text = await res.text().catch(() => '');
    try {
      return JSON.parse(text);
    } catch (_e) {
      return {
        success: false,
        error: text.startsWith('<') ? 'Server returned HTML response' : text || `HTTP ${res.status}`,
        message: text.startsWith('<') ? `Server returned an invalid response (${res.status} ${res.statusText})` : text
      };
    }
  };

  // Poll for payment status after redirect
  const pollPaymentStatus = (orderId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 3 seconds = 90 seconds max

    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(`/api/worldpay/status?orderId=${orderId}`);
        const data = await safeParseJson(response);

        if (data.paid === true) {
          // Payment confirmed!
          clearInterval(interval);
          setPollingInterval(null);
          
          // Fetch full order details
          const orderResponse = await fetch(`/api/worldpay/order/${orderId}`);
          const orderData = await safeParseJson(orderResponse);
          
          trackOrderCompleted({
            orderId: orderId,
            customerName: orderData.customerName || fullName,
            customerEmail: orderData.customerEmail || email,
            destination: orderData.destination || `${addressLine}, ${city}, ${postcode}, ${country}`,
            total: orderData.total || finalTotalToPay,
            items: orderData.items || cartItems
          });

          setPaymentSuccessData({
            orderId: orderId,
            total: orderData.total || 0,
            gatewayTxId: orderData.worldpayTxId || orderData.gatewayTxId,
            gatewayAuthCode: orderData.worldpayAuthCode || orderData.gatewayAuthCode,
            cardBrand: orderData.cardBrand || 'Card',
            paymentMethod: orderData.paymentMethod || 'Card'
          });
          
          setIsProcessingPayment(false);
          return;
        }

        if (data.status === 'Failed') {
          clearInterval(interval);
          setPollingInterval(null);
          setIsProcessingPayment(false);
          setPaymentError('Payment was declined. Please try again.');
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPollingInterval(null);
          setIsProcessingPayment(false);
          setPaymentError('Payment is taking longer than expected. Please check your email for confirmation.');
        }
      } catch (error) {
        console.error('[Checkout] Polling error:', error);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPollingInterval(null);
          setIsProcessingPayment(false);
        }
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);
  };

  const getItemTotal = (item: CartItem) => {
    if (item.productId && (item.productId.startsWith('sub-pack-') || item.productId.includes('sub-pack') || item.isSubscription)) {
      return item.price * item.quantity;
    }
    return calculateVolumePrice(item.price, item.quantity);
  };

  // Calculate totals
  const rawSubtotal = cartItems.reduce((acc, item) => acc + getItemTotal(item), 0);
  const discountValue = calculateDiscountAmount(currentDiscount, cartItems, rawSubtotal);
  const subtotalAfterDiscount = Math.max(rawSubtotal - discountValue, 0);
  const deliveryCost = subtotalAfterDiscount >= 40 ? 0 : 2.99;
  const finalTotal = subtotalAfterDiscount + deliveryCost;
  const storeCreditAvailable = loggedInCustomer?.storeCredit || 0;
  const storeCreditApplied = applyStoreCredit ? Math.min(storeCreditAvailable, finalTotal) : 0;
  const finalTotalToPay = Math.max(0, finalTotal - storeCreditApplied);

  // Process payment with Worldpay HPP
  const executePaymentProcess = async (paymentMode: 'live' | 'test' = 'live') => {
    // Validate shipping info
    if (!fullName || !email || !addressLine) {
      setPaymentError('Please fill in your shipping and contact information.');
      return;
    }

    // Enforce AgeChecked verification gate for live payments
    if (paymentMode === 'live' && !isAgeApproved) {
      setPaymentError('Age verification (18+) is required before live checkout can continue.');
      if (ageGateRef.current) {
        const approved = await ageGateRef.current.openPortal();
        if (!approved) {
          return;
        }
      } else {
        return;
      }
    }

    // Handle zero-cost orders (store credit covers everything)
    if (finalTotalToPay === 0) {
      setIsProcessing(true);
      setPaymentError(null);
      
      try {
        const generatedOrderId = `PS${Math.floor(Math.random() * 90000 + 10000)}`;
        
        // Create order with store credit
        const orderData = {
          orderId: generatedOrderId,
          customerName: fullName,
          customerEmail: email,
          address: `${addressLine}, ${city}, ${postcode}, ${country}`,
          total: 0,
          discountApplied: currentDiscount,
          items: cartItems.map(item => ({
            productId: item.productId,
            productTitle: item.productTitle,
            price: item.price,
            quantity: item.quantity,
            image: item.image
          })),
          gatewayTxId: `CREDIT-${Date.now()}`,
          gatewayAuthCode: 'CREDIT-AUTH',
          cardBrand: 'Store Credit',
          storeCreditApplied: storeCreditApplied,
          paymentMethod: 'Store Credit'
        };

        // Call API to create order
        const response = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        if (response.ok) {
          trackOrderCompleted({
            orderId: orderData.orderId,
            customerName: orderData.customerName,
            customerEmail: orderData.customerEmail,
            destination: orderData.address,
            total: orderData.total,
            items: orderData.items
          });
          onCompleteCheckout(orderData);
          setPaymentSuccessData(orderData);
        } else {
          throw new Error('Failed to create order');
        }
      } catch (error: any) {
        setPaymentError(error.message || 'Failed to process order');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const generatedOrderId = `PS${Math.floor(Math.random() * 90000 + 10000)}`;
    setOrderId(generatedOrderId);

    // Track Started Checkout in Klaviyo
    try {
      const firstItem = cartItems[0];
      if (firstItem) {
        trackStartedCheckout({
          id: firstItem.productId,
          name: firstItem.productTitle,
          price: finalTotalToPay,
          currency: 'GBP',
          recurring: Boolean(cartItems.some(i => i.isSubscription || i.productId?.startsWith('sub-pack-'))),
        });
      }
    } catch (_e) {}

    try {
      addLog('REQUEST', {
        endpoint: '/api/worldpay/session',
        method: 'POST',
        orderId: generatedOrderId,
        amount: finalTotalToPay.toFixed(2),
        mode: paymentMode
      });

      const pendingOrderObj = {
        orderId: generatedOrderId,
        amount: finalTotalToPay.toFixed(2),
        total: finalTotalToPay,
        customerName: fullName,
        customerEmail: email,
        destination: `${addressLine}, ${city}, ${postcode}, ${country}`,
        items: cartItems.map(item => ({
          productId: item.productId,
          productTitle: item.productTitle,
          price: item.price,
          quantity: item.quantity,
          image: item.image || '',
          variant: (item as any).variant || (item as any).concreteVariantName || (item as any).strength || (item as any).flavour || 'Standard',
          sku: (item as any).sku || (item as any).concreteVariantId || item.productId || 'SKU-001',
          vendor: item.vendor || '',
          total: Number((item.price * item.quantity).toFixed(2))
        })),
        discountApplied: currentDiscount,
        storeCreditApplied: storeCreditApplied
      };
      localStorage.setItem(`ps_pending_order_${generatedOrderId}`, JSON.stringify(pendingOrderObj));

      // Initialize Worldpay HPP session with explicit payment mode
      const sessionRes = await fetch('/api/worldpay/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: generatedOrderId,
          amount: finalTotalToPay.toFixed(2),
          customerName: fullName,
          customerEmail: email,
          destination: `${addressLine}, ${city}, ${postcode}, ${country}`,
          items: pendingOrderObj.items,
          mode: paymentMode,
          paymentMode: paymentMode,
          discountApplied: currentDiscount,
          storeCreditApplied: storeCreditApplied
        })
      });

      const sessionData = await safeParseJson(sessionRes);
      addLog('RESPONSE', sessionData);

      setIsProcessing(false);

      if (sessionRes.ok && sessionData.redirectUrl) {
        // Redirect to Worldpay HPP or Test Gateway
        const url = sessionData.redirectUrl;
        setWorldpayRedirectUrl(url);
        setIsProcessingPayment(false);
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const isIframe = window.self !== window.top;
          if (isIframe) {
            try {
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (_e) {
              window.location.href = url;
            }
          } else {
            window.location.href = url;
          }
          return;
        } else {
          // Relative test gateway navigation
          window.history.pushState({}, '', url);
          window.dispatchEvent(new Event('popstate'));
          return;
        }
      }

      // Handle error if payment gateway is not configured or session fails
      const errMsg = sessionData.message || sessionData.error || 'Payment gateway is currently not configured or session failed. No order was generated.';
      setPaymentError(errMsg);
      setIsProcessingPayment(false);

      try {
        const firstItem = cartItems[0];
        if (firstItem) {
          trackCheckoutFailed({
            id: firstItem.productId,
            name: firstItem.productTitle,
            price: finalTotalToPay,
            currency: 'GBP',
            recurring: Boolean(cartItems.some(i => i.isSubscription || i.productId?.startsWith('sub-pack-'))),
          }, errMsg);
        }
      } catch (_e) {}
      
    } catch (error: any) {
      console.error('[Checkout] Error:', error);
      addLog('ERROR', { message: error.message });
      setIsProcessing(false);
      setIsProcessingPayment(false);
      const errMsg = error.message || 'Failed to process payment';
      setPaymentError(errMsg);

      try {
        const firstItem = cartItems[0];
        if (firstItem) {
          trackCheckoutFailed({
            id: firstItem.productId,
            name: firstItem.productTitle,
            price: finalTotalToPay,
            currency: 'GBP',
            recurring: Boolean(cartItems.some(i => i.isSubscription || i.productId?.startsWith('sub-pack-'))),
          }, errMsg);
        }
      } catch (_e) {}
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    await executePaymentProcess('live');
  };

  // Processing screen
  if (isProcessingPayment) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mx-auto">
            <Clock className="h-10 w-10 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-950">Processing Worldpay Payment</h2>
            <p className="text-slate-500 text-sm">
              Please complete your payment on the Worldpay secure portal.
            </p>
            <p className="text-slate-400 text-xs">
              Order #{orderId} • This page will update automatically once payment is confirmed.
            </p>
          </div>

          {worldpayRedirectUrl && (
            <div className="py-2">
              <a
                href={worldpayRedirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-3.5 rounded-xl uppercase tracking-wider shadow-md transition-all cursor-pointer"
              >
                <span>Open Worldpay Payment Page</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Waiting for payment confirmation...</span>
          </div>

          <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                if (orderId) {
                  pollPaymentStatus(orderId);
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
            >
              Check status now
            </button>
            <button
              onClick={() => {
                setIsProcessingPayment(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
            >
              Back to Checkout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (paymentSuccessData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-50 rounded-full blur-3xl opacity-60 -z-10" />
          
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto">
            <CheckCircle className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold py-1 px-3.5 rounded-full uppercase tracking-wider inline-block">
              Payment Confirmed
            </span>
            <h1 className="text-3xl font-black text-slate-950 uppercase tracking-tight">Order Placed Successfully!</h1>
            <p className="text-slate-500 max-w-lg mx-auto text-xs leading-relaxed">
              Thank you for your order! You will receive a confirmation email shortly.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-150/70 rounded-2xl p-6 text-left max-w-lg mx-auto space-y-4">
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Order Reference:</span>
              <span className="font-mono font-bold text-slate-800 uppercase">{paymentSuccessData.orderId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Transaction ID:</span>
              <span className="font-mono font-bold text-slate-800">{paymentSuccessData.gatewayTxId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Payment Method:</span>
              <span className="font-semibold text-slate-800">{paymentSuccessData.paymentMethod || paymentSuccessData.cardBrand}</span>
            </div>
            <div className="flex justify-between pt-1 text-sm font-black">
              <span className="text-slate-800 uppercase">Total Paid:</span>
              <span className="text-slate-950">£{paymentSuccessData.total?.toFixed(2) || '0.00'} GBP</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
            <button
              onClick={() => onNavigate('frontend-home')}
              className="w-full bg-slate-900 border-slate-900 text-white hover:bg-slate-800 py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer shadow-md"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => onNavigate('frontend-account')}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              View Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Subscription account check
  const hasSubscription = cartItems.some(item => 
    item.productId && (item.productId.startsWith('sub-pack') || item.productId.includes('sub-pack'))
  );

  if (hasSubscription && !loggedInCustomer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-sm space-y-6 flex flex-col items-center">
          <div className="p-4 bg-red-50 text-red-600 rounded-full w-16 h-16 flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-black text-[#071d37] uppercase tracking-wider">Account Required</h2>
            <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
              Your cart contains a subscription item. Please create an account or sign in to complete your purchase.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-2">
            <button
              onClick={() => onNavigate('frontend-account')}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all cursor-pointer"
            >
              Sign In / Create Account
            </button>
            <button
              onClick={() => onNavigate('frontend-shop')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all cursor-pointer border border-slate-200"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Header back navigation */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => onNavigate('frontend-shop')}
          className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-850 transition-colors uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Shop
        </button>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> 256-Bit SSL Encrypted Checkout
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Order forms */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Shipping Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-600" /> 1. Shipping Address
              </h3>
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(true)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-extrabold py-1.5 px-3 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign in with Google
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Street Address</label>
              <input
                type="text"
                required
                placeholder="Street address"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Postcode</label>
                <input
                  type="text"
                  required
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-bold text-slate-700 bg-white"
                >
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Ireland">Ireland</option>
                  <option value="Sweden">Sweden</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                </select>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="pt-2">
              <div className="border border-slate-800 bg-slate-50 ring-1 ring-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div className="text-left">
                  <span className="font-extrabold text-xs block text-slate-800 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-red-600" /> Royal Mail Tracked
                  </span>
                  <span className="text-[10px] text-slate-500">Royal Mail 24/48 Tracked Delivery</span>
                </div>
                <span className={subtotalAfterDiscount >= 40 ? "font-black text-xs text-emerald-600" : "font-black text-xs text-slate-800"}>
                  {subtotalAfterDiscount >= 40 ? 'FREE' : '£2.99'}
                </span>
              </div>
            </div>
          </div>

            {/* Payment Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" /> 2. Select Payment Method
                </h3>
              </div>

              {/* Payment Info */}
              <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-5 text-center space-y-3">
                <div className="mx-auto w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-850">Worldpay Payment Gateways</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-md mx-auto">
                    Choose <strong>Pay with Worldpay – Live</strong> to process an authentic payment, or <strong>Pay with Worldpay – Test</strong> for test order creation.
                  </p>
                </div>
                <div className="flex justify-center gap-6 text-[10px] text-slate-400 font-extrabold uppercase">
                  <span>✓ 256-bit SSL</span>
                  <span>✓ 3D Secure 2.0</span>
                  <span>✓ PCI Level 1</span>
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="space-y-4">
                {/* AgeChecked Gate Integration */}
                <div className="mb-4">
                  <AgeGate
                    ref={ageGateRef}
                    onApprovedChange={(approved) => {
                      setIsAgeApproved(approved);
                      if (approved) setPaymentError(null);
                    }}
                    customerData={{
                      name: fullName,
                      email: email,
                      postcode: postcode,
                      countrycode: country === 'United Kingdom' ? 'GB' : 'GB',
                      reference: orderId || `order-${Date.now()}`
                    }}
                  />
                </div>

                {paymentError && (
                  <div className="flex gap-2 items-center bg-red-50 border border-red-150 p-3.5 rounded-xl text-xs font-bold text-red-650">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {finalTotalToPay === 0 ? (
                  <button
                    type="button"
                    onClick={() => executePaymentProcess('live')}
                    disabled={isProcessing}
                    className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                        <span>Processing Order...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-emerald-400" />
                        <span>Complete Order with Store Credit (£0.00)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3.5">
                    {hasSubscription && (
                      <div className="bg-indigo-950 text-white border-2 border-indigo-500 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg animate-pulse-subtle">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 shadow-md">
                            <Repeat className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                              <span>Worldpay Subscription Payment</span>
                            </p>
                            <p className="text-[11px] text-indigo-200 mt-0.5">
                              Automatic recurring monthly billing via Worldpay Access
                            </p>
                          </div>
                        </div>
                        <span className="bg-amber-400 text-slate-950 font-black text-[9.5px] px-3 py-1 rounded-full uppercase tracking-widest shrink-0 shadow-md border border-amber-300">
                          RECURRING
                        </span>
                      </div>
                    )}

                    {/* Option 1: Pay with Worldpay – Live */}
                    <div className="p-4 border-2 border-slate-900 bg-slate-50/50 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs font-black text-slate-900 uppercase">
                        <span className="flex items-center gap-1.5">
                          <Lock className="h-4 w-4 text-emerald-600" /> Option 1: Live Payment
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasSubscription && (
                            <span className="bg-indigo-100 text-indigo-900 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">SUBSCRIPTION PAYMENT</span>
                          )}
                          <span className="bg-emerald-100 text-emerald-800 text-[9.5px] px-2.5 py-0.5 rounded-full font-mono font-extrabold">LIVE</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Redirects to official Worldpay Access Hosted Payment Page to securely authorize your credit card.
                      </p>
                      <button
                        type="button"
                        onClick={() => executePaymentProcess('live')}
                        disabled={isProcessing}
                        className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-black py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-white" />
                            <span>Connecting to Worldpay Live...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 text-emerald-400" />
                            {hasSubscription ? (
                              <span className="flex items-center gap-2 font-black text-amber-300">
                                <Repeat className="h-4 w-4 text-amber-400 shrink-0" />
                                Pay & Start Recurring Subscription – Live (£{finalTotalToPay.toFixed(2)})
                              </span>
                            ) : (
                              <span>Pay with Worldpay – Live (£{finalTotalToPay.toFixed(2)})</span>
                            )}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Option 2: Pay with Worldpay – Test */}
                    <div className="p-4 border-2 border-amber-400/80 bg-amber-50/40 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs font-black text-amber-950 uppercase">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-amber-600" /> Option 2: Test Sandbox
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasSubscription && (
                            <span className="bg-amber-200 text-amber-950 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">SUBSCRIPTION PAYMENT</span>
                          )}
                          <span className="bg-amber-200 text-amber-900 text-[9.5px] px-2.5 py-0.5 rounded-full font-mono font-extrabold">TEST / SANDBOX</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Processes complete payment authorization, receipt confirmation, email dispatch, and order creation in test mode.
                      </p>
                      <button
                        type="button"
                        onClick={() => executePaymentProcess('test')}
                        disabled={isProcessing}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-black py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-white" />
                            <span>Launching Worldpay Sandbox...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4 text-amber-200" />
                            {hasSubscription ? (
                              <span className="flex items-center gap-2 font-black text-white">
                                <Repeat className="h-4 w-4 text-amber-200 shrink-0" />
                                Pay & Start Recurring Subscription – Test (£{finalTotalToPay.toFixed(2)})
                              </span>
                            ) : (
                              <span>Pay with Worldpay – Test (£{finalTotalToPay.toFixed(2)})</span>
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          {/* Developer logs */}
          {showLogs && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-450 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Terminal className="h-4 w-4" />
                  <span className="font-extrabold text-[10px] tracking-wider uppercase">API Logs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <button 
                    onClick={() => setApiLogs([])}
                    className="text-[9px] underline text-slate-450 hover:text-white cursor-pointer ml-2"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
                {apiLogs.length === 0 ? (
                  <p className="text-slate-600 text-[10px] italic py-2">
                    &gt; No logs yet. Submit a payment to see API requests.
                  </p>
                ) : (
                  apiLogs.map((log, i) => (
                    <div key={i} className="space-y-1 border-l-2 pl-3.5 border-slate-700/60">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-extrabold ${
                          log.type === 'REQUEST' ? 'text-blue-400' : log.type === 'RESPONSE' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          [{log.type}]
                        </span>
                        <span className="text-slate-600 font-semibold">{log.timestamp}</span>
                      </div>
                      <pre className="text-[10px] text-slate-300 overflow-x-auto bg-slate-900/60 p-2 rounded-lg">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold underline cursor-pointer"
          >
            {showLogs ? 'Hide' : 'Show'} Debug Logs
          </button>
        </div>

        {/* Right Side: Order summary */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 sticky top-6">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-indigo-600" /> Order Summary
            </h3>

            {/* Product items */}
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-2">
              {cartItems.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center gap-3.5 text-xs">
                  {item.productId && (item.productId.startsWith('sub-pack-') || item.productId.includes('sub-pack')) ? (
                    <SubscriptionIcon planName={item.productTitle} className="!w-12 !h-12 rounded-lg" />
                  ) : (
                    <img
                      src={item.image}
                      alt={item.productTitle}
                      className="w-12 h-12 object-cover rounded-lg bg-slate-50 border border-slate-100"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-slate-800 text-[11px]">{item.productTitle}</h4>
                    <p className="text-slate-400 text-[10px] font-bold">Qty: {item.quantity} × £{item.price.toFixed(2)}</p>
                  </div>
                  <span className="font-black text-slate-800 text-[11px]">£{getItemTotal(item).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Store Credit */}
            {loggedInCustomer && loggedInCustomer.storeCredit !== undefined && loggedInCustomer.storeCredit > 0 && (
              <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-2xl text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="apply-store-credit-checkout"
                      checked={applyStoreCredit}
                      onChange={(e) => setApplyStoreCredit(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 cursor-pointer"
                    />
                    <label htmlFor="apply-store-credit-checkout" className="font-extrabold text-[#071d37] cursor-pointer select-none">
                      Apply Store Credit (£{loggedInCustomer.storeCredit.toFixed(2)} Available)
                    </label>
                  </div>
                </div>
                {applyStoreCredit && (
                  <p className="text-[10.5px] text-emerald-700 mt-2 font-medium leading-relaxed">
                    Applying £{Math.min(loggedInCustomer.storeCredit, finalTotal).toFixed(2)} Store Credit deduction.
                  </p>
                )}
              </div>
            )}

            {/* Promo Code */}
            <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-2xl text-xs space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Promo or Referral Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 p-2 text-xs rounded-xl uppercase placeholder:normal-case font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <button
                  type="button"
                  onClick={handleApplyPromoInCheckout}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold px-3.5 py-2 rounded-xl cursor-pointer transition-colors shrink-0 uppercase tracking-wider"
                >
                  Apply
                </button>
              </div>
              {promoError && <p className="text-[10px] text-red-500 font-bold">{promoError}</p>}
              {promoSuccess && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg font-black">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>{promoSuccess}</span>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs leading-normal font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="text-slate-800">£{rawSubtotal.toFixed(2)}</span>
              </div>

              {currentDiscount && (
                <div className="flex justify-between text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Discount
                  </span>
                  <span className="font-extrabold">-£{discountValue.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-500">
                <span>Delivery</span>
                <span>{deliveryCost === 0 ? 'FREE' : `£${deliveryCost.toFixed(2)}`}</span>
              </div>

              {applyStoreCredit && storeCreditApplied > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Store Credit</span>
                  <span>-£{storeCreditApplied.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-150">
                <span>Total</span>
                <span className="text-base text-indigo-700 font-black">£{finalTotalToPay.toFixed(2)}</span>
              </div>
            </div>

            {/* Security badge */}
            <div className="border-t border-slate-100 pt-3.5 flex justify-center gap-4 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-emerald-500" /> SSL Encrypted</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-indigo-500" /> Secure</span>
            </div>
          </div>

        </div>

      </div>

      {isGoogleModalOpen && (
        <GoogleAccountChooserModal
          isOpen={isGoogleModalOpen}
          onClose={() => setIsGoogleModalOpen(false)}
          onSelectAccount={handleGoogleAccountSelect}
        />
      )}

    </div>
  );
}