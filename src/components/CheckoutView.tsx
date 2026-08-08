// CheckoutView.tsx
import React, { useState, useEffect } from 'react';
import { CartItem, Discount, Customer, Order } from '../types';
import { 
  ShieldCheck, ArrowLeft, CreditCard, Lock, Terminal, 
  CheckCircle, AlertTriangle, AlertCircle, RefreshCw, 
  Truck, ShoppingCart, UserCheck, Check, X, Loader2,
  Clock, ExternalLink
} from 'lucide-react';
import SubscriptionIcon from './SubscriptionIcon';
import { calculateDiscountAmount } from '../utils';

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

  // Logging for development
  const [showLogs, setShowLogs] = useState(false);
  const [apiLogs, setApiLogs] = useState<{ timestamp: string; type: 'REQUEST' | 'RESPONSE' | 'ERROR'; payload: any }[]>([]);

  useEffect(() => {
    setCurrentDiscount(discountApplied);
  }, [discountApplied]);

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
        const data = await response.json();

        if (data.paid === true) {
          // Payment confirmed!
          clearInterval(interval);
          setPollingInterval(null);
          
          // Fetch full order details
          const orderResponse = await fetch(`/api/worldpay/order/${orderId}`);
          const orderData = await orderResponse.json();
          
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

  // Calculate totals
  const rawSubtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountValue = calculateDiscountAmount(currentDiscount, cartItems, rawSubtotal);
  const subtotalAfterDiscount = Math.max(rawSubtotal - discountValue, 0);
  const deliveryCost = subtotalAfterDiscount >= 40 ? 0 : 2.99;
  const finalTotal = subtotalAfterDiscount + deliveryCost;
  const storeCreditAvailable = loggedInCustomer?.storeCredit || 0;
  const storeCreditApplied = applyStoreCredit ? Math.min(storeCreditAvailable, finalTotal) : 0;
  const finalTotalToPay = Math.max(0, finalTotal - storeCreditApplied);

  // Process payment with Worldpay HPP
  const executePaymentProcess = async () => {
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

    try {
      addLog('REQUEST', {
        endpoint: '/api/worldpay/session',
        method: 'POST',
        orderId: generatedOrderId,
        amount: finalTotalToPay.toFixed(2)
      });

      // Initialize Worldpay HPP session directly without creating an unconfirmed pending order
      const sessionRes = await fetch('/api/worldpay/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: generatedOrderId,
          amount: finalTotalToPay.toFixed(2),
          customerName: fullName,
          customerEmail: email,
          destination: `${addressLine}, ${city}, ${postcode}, ${country}`,
          items: cartItems.map(item => ({
            productId: item.productId,
            productTitle: item.productTitle,
            price: item.price,
            quantity: item.quantity
          }))
        })
      });

      const sessionData = await sessionRes.json();
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
      setPaymentError(sessionData.error || sessionData.message || 'Payment gateway is currently not configured or session failed. No order was generated.');
      setIsProcessingPayment(false);
      
    } catch (error: any) {
      console.error('[Checkout] Error:', error);
      addLog('ERROR', { message: error.message });
      setIsProcessing(false);
      setIsProcessingPayment(false);
      setPaymentError(error.message || 'Failed to process payment');
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate shipping info
    if (!fullName || !email || !addressLine) {
      setPaymentError('Please fill in your shipping and contact information.');
      return;
    }

    await executePaymentProcess();
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
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-600" /> 1. Shipping Address
            </h3>

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
                <CreditCard className="h-4 w-4 text-indigo-600" /> 2. Secure Payment
              </h3>
            </div>

            {/* Payment Info */}
            <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-850">Secure Checkout</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-md mx-auto">
                  You will be securely redirected to Worldpay to complete your payment. Your card details are processed in a PCI-DSS compliant environment.
                </p>
              </div>
              <div className="flex justify-center gap-6 text-[10px] text-slate-400 font-extrabold uppercase">
                <span>✓ 256-bit SSL</span>
                <span>✓ 3D Secure 2.0</span>
                <span>✓ PCI Level 1</span>
              </div>
            </div>

            {/* Payment Button */}
            <form onSubmit={handlePay} className="space-y-4">
              {paymentError && (
                <div className="flex gap-2 items-center bg-red-50 border border-red-150 p-3.5 rounded-xl text-xs font-bold text-red-650">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-emerald-400" />
                    <span>
                      {finalTotalToPay === 0
                        ? `Complete Order (Free)`
                        : `Pay £${finalTotalToPay.toFixed(2)}`}
                    </span>
                  </>
                )}
              </button>
            </form>
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
                  <span className="font-black text-slate-800 text-[11px]">£{(item.price * item.quantity).toFixed(2)}</span>
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

    </div>
  );
}