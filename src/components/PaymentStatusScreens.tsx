import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CreditCard, Lock, RefreshCw, AlertTriangle, 
  CheckCircle, XCircle, ArrowLeft, Send, ShoppingBag, Truck, ExternalLink
} from 'lucide-react';
import { Order } from '../types';

// ==========================================
// 1. WORLDPAY SECURE PAYMENT GATEWAY SIMULATOR
// ==========================================
interface SecureGatewaySimulatorProps {
  onReturnToShop: () => void;
}

export function WorldpayGatewaySimulator({ onReturnToShop }: SecureGatewaySimulatorProps) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [installationId, setInstallationId] = useState('1000000');
  const [worldpayUrl, setWorldpayUrl] = useState('');
  
  // Tab/Mode state
  const [activeTab, setActiveTab] = useState<'OFFICIAL_HPP' | 'SIMULATOR'>('OFFICIAL_HPP');

  // Card form state
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 3DS validation state
  const [show3ds, setShow3ds] = useState(false);
  const [threeDsOtp, setThreeDsOtp] = useState('');
  const [threeDsError, setThreeDsError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currOrderId = params.get('orderId') || `PS${Math.floor(Math.random() * 90000 + 10000)}`;
    const currAmount = params.get('amount') || '29.99';
    const currCheckoutId = params.get('checkoutId') || params.get('installationId') || '1000000';
    
    setOrderId(currOrderId);
    setAmount(currAmount);
    setInstallationId(currCheckoutId);
  }, []);

  const handleLaunchWorldpay = async () => {
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const sessionRes = await fetch('/api/worldpay/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          customerName: cardHolder || 'Valued Customer',
          customerEmail: 'customer@pouch-supply.com'
        })
      });

      const sessionData = await sessionRes.json();
      setIsProcessing(false);

      if (sessionRes.ok && sessionData.redirectUrl) {
        const url = sessionData.redirectUrl;
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = url;
          } else {
            window.location.href = url;
          }
        } catch (_e) {
          window.location.href = url;
        }
        return;
      }

      setPaymentError(sessionData.error || sessionData.message || 'Worldpay Access Checkout session creation failed.');
    } catch (err: any) {
      setIsProcessing(false);
      setPaymentError(err.message || 'Error connecting to Worldpay Access API.');
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 16) val = val.substring(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 4) val = val.substring(0, 4);
    if (val.length >= 2) {
      setExpiry(`${val.substring(0, 2)}/${val.substring(2)}`);
    } else {
      setExpiry(val);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardHolder.trim() || !cardNumber || cardNumber.replace(/\s/g, '').length < 15 || !expiry || !cvv || cvv.length < 3) {
      setPaymentError('Please enter complete credit card details.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    // Prompt for 3DS if needed
    if (cardNumber.endsWith('3D') || cardNumber.endsWith('3333')) {
      setTimeout(() => {
        setShow3ds(true);
        setIsProcessing(false);
      }, 800);
      return;
    }

    try {
      const res = await fetch('/api/worldpay/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          cardNumber,
          cardExpiry: expiry,
          cvc: cvv,
          cardHolder
        })
      });

      const data = await res.json();
      setIsProcessing(false);

      if (res.ok && data.success) {
        window.history.pushState({}, '', `/payment/success?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}&txId=${encodeURIComponent(data.transactionId)}`);
        window.dispatchEvent(new Event('popstate'));
      } else {
        setPaymentError(data.error || 'Payment authorization failed.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setPaymentError(err.message || 'Error executing Worldpay transaction.');
    }
  };

  const handleVerify3ds = async () => {
    if (!threeDsOtp.trim()) {
      setThreeDsError('Please enter the 3D-Secure passcode.');
      return;
    }

    setIsProcessing(true);
    setThreeDsError(null);

    if (threeDsOtp === '0000') {
      setTimeout(() => {
        setThreeDsError('Incorrect passcode. 3D-Secure authorization failed.');
        setIsProcessing(false);
      }, 800);
      return;
    }

    try {
      const res = await fetch('/api/worldpay/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          cardNumber,
          cardExpiry: expiry,
          cvc: cvv,
          cardHolder
        })
      });

      const data = await res.json();
      setIsProcessing(false);

      if (res.ok && data.success) {
        setShow3ds(false);
        window.history.pushState({}, '', `/payment/success?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}&txId=${encodeURIComponent(data.transactionId)}`);
        window.dispatchEvent(new Event('popstate'));
      } else {
        setThreeDsError(data.error || '3DS Verification rejected by issuer.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setThreeDsError(err.message || 'Error during 3DS verification.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 font-sans text-slate-800 flex flex-col items-center justify-center">
      
      {/* Brand & Worldpay Header */}
      <div className="text-center mb-6 max-w-lg w-full space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-100 text-xs font-bold">
          <Lock className="h-3.5 w-3.5 text-red-600" />
          <span>Worldpay Access Gateway</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
          Secure Payment Portal
        </h1>
        <p className="text-xs text-slate-500">
          Official Worldpay Integration & Merchant Gateway Launcher
        </p>
      </div>

      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden space-y-0">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('OFFICIAL_HPP')}
            className={`flex-1 py-3 px-4 transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'OFFICIAL_HPP' 
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-black shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            <span>Launch Official Worldpay HPP</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SIMULATOR')}
            className={`flex-1 py-3 px-4 transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'SIMULATOR' 
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-black shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Instant Test Checkout</span>
          </button>
        </div>

        {/* Order Details Header */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-bold">Order Reference:</span>
              <span className="font-mono font-black text-slate-900">{orderId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-bold">Total Amount:</span>
              <span className="text-sm font-black text-slate-900">£{amount} GBP</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-bold">Installation ID:</span>
              <input
                type="text"
                value={installationId}
                onChange={(e) => setInstallationId(e.target.value)}
                placeholder="1000000"
                className="w-32 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:outline-none focus:border-indigo-600 text-slate-900 text-right"
              />
            </div>
          </div>

          {/* TAB 1: OFFICIAL WORLDPAY ACCESS LAUNCHER */}
          {activeTab === 'OFFICIAL_HPP' && (
            <div className="space-y-4 pt-1">
              {paymentError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 space-y-1 text-left flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <span className="font-bold block text-red-900">Worldpay Access Session Error</span>
                    <p className="text-[11.5px] leading-relaxed">{paymentError}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleLaunchWorldpay}
                className="w-full py-3.5 bg-[#0F172A] hover:bg-[#1E293B] disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>Connecting to Worldpay Access...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    <span>Launch Worldpay Access Checkout</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onReturnToShop}
                className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Cancel & Return to Store
              </button>
            </div>
          )}

          {/* TAB 2: INSTANT TEST CHECKOUT SIMULATOR */}
          {activeTab === 'SIMULATOR' && (
            <form onSubmit={handlePaySubmit} className="space-y-4 pt-1 text-left">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="4532 •••• •••• ••••"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 font-mono tracking-wider bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={handleExpiryChange}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 font-mono text-center bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    CVV Security Code
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 font-mono text-center bg-white"
                  />
                </div>
              </div>

              {paymentError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Authorizing Worldpay...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Authorize & Pay £{amount}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onReturnToShop}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-xs transition cursor-pointer"
                >
                  Cancel & Return to Store
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>256-Bit SSL Encrypted Worldpay Access Gateway</span>
        </div>

      </div>

      {/* 3D SECURE MODAL */}
      {show3ds && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-indigo-600 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">Worldpay 3D-Secure Authentication</h4>
              <p className="text-xs text-slate-500">
                Enter the passcode sent to your phone.
              </p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                maxLength={6}
                placeholder="1234"
                value={threeDsOtp}
                onChange={(e) => setThreeDsOtp(e.target.value)}
                className="w-full text-center text-sm font-mono tracking-widest p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-900 font-bold"
              />
              <span className="text-[10px] text-slate-400 block">
                Enter passcode <strong className="text-indigo-600">1234</strong>
              </span>
            </div>

            {threeDsError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-600 font-medium">
                {threeDsError}
              </div>
            )}

            <button
              type="button"
              onClick={handleVerify3ds}
              disabled={isProcessing}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Confirm & Authorize'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export const SecureGatewaySimulator = WorldpayGatewaySimulator;

// ==========================================
// 2. PAYMENT SUCCESS RECEIPT SCREEN
// ==========================================
interface PaymentSuccessScreenProps {
  onReturnToShop: () => void;
}

export function PaymentSuccessScreen({ onReturnToShop }: PaymentSuccessScreenProps) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedOrderId = params.get('orderId') || 'PS-TEMP';
    const parsedAmount = params.get('amount') || '0.00';
    setOrderId(parsedOrderId);
    setAmount(parsedAmount);

    // Fetch the order from db to show authentic rich confirmation details!
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders`);
        if (res.ok) {
          const list: Order[] = await res.json();
          const found = list.find(o => o.id === parsedOrderId);
          if (found) {
            setOrder(found);
          }
        }
      } catch (err) {
        console.warn('Could not fetch order details receipt:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, []);

  return (
    <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-6 font-sans">
      <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
        <CheckCircle className="h-10 w-10 text-emerald-500 animate-bounce" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Payment Completed Successfully!</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          Your credit card was authorized, and your order has been received. A detailed transaction receipt has been dispatched to your email address.
        </p>
      </div>

      {/* Real receipt breakdown */}
      <div className="border border-slate-150 bg-slate-50 rounded-2xl p-5 text-left text-xs divide-y divide-slate-200/60 space-y-3.5">
        <div className="pb-3 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Order ID Reference</span>
            <strong className="text-slate-800 text-sm font-mono">{orderId}</strong>
          </div>
          <div className="text-right">
            <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Payment Provider</span>
            <span className="text-indigo-600 font-black text-xs uppercase tracking-widest block font-mono">Secure Card Gateway</span>
          </div>
        </div>

        <div className="py-3.5 space-y-2">
          <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Fulfillment Delivery Method</span>
          <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-150 shadow-3xs">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-slate-600" />
              <div>
                <span className="font-extrabold text-slate-850 block text-[11px]">Priority Courier Dispense</span>
                <span className="text-[9px] text-slate-400 block font-bold">Estimated Delivery: 2-3 Business Days</span>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 py-1 px-2.5 rounded-md">
              Handoff pending
            </span>
          </div>
        </div>

        {order && order.items && (
          <div className="py-3.5 space-y-2">
            <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Items Purchased ({order.items.length})</span>
            <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
              {order.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-[11px] font-bold text-slate-700">
                  <span className="truncate max-w-[280px]">{item.productTitle} <span className="text-slate-400 font-normal">x{item.quantity}</span></span>
                  <span>£{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 flex justify-between items-center">
          <span className="font-black text-slate-850 uppercase text-[10px] tracking-wider">Total Paid Securely</span>
          <span className="text-lg font-black text-slate-900">£{amount || (order ? order.total.toFixed(2) : '29.99')}</span>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-2">
        <Send className="h-4 w-4 shrink-0" />
        <span>Confirmation Email Sent to Support & Customer Mailbox!</span>
      </div>

      <button
        onClick={onReturnToShop}
        className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
      >
        <ShoppingBag className="h-4 w-4" /> Continue Catalog Shopping
      </button>
    </div>
  );
}

// ==========================================
// 3. PAYMENT FAILED / DECLINED SCREEN
// ==========================================
interface PaymentFailedScreenProps {
  onReturnToCheckout: () => void;
}

export function PaymentFailedScreen({ onReturnToCheckout }: PaymentFailedScreenProps) {
  const [reason, setReason] = useState('Card declined by issuer');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReason(params.get('reason') || 'Insufficient funds or gateway timeout.');
  }, []);

  return (
    <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-6 font-sans">
      <div className="mx-auto w-16 h-16 bg-red-50 text-red-650 rounded-full flex items-center justify-center shadow-inner">
        <XCircle className="h-10 w-10 text-red-500" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Payment Authorization Failed</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          The credit card processor could not complete your transaction. No charges have been billed to your card.
        </p>
      </div>

      {/* Reason Box */}
      <div className="border border-red-100 bg-red-50/50 rounded-2xl p-5 text-left text-xs space-y-1">
        <span className="text-red-800 uppercase text-[9px] font-black tracking-widest block">Error Reported by Gateway:</span>
        <p className="font-extrabold text-slate-800 text-[11.5px] leading-relaxed">{reason}</p>
        <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
          Suggestions: Check that cardholder address details are valid, check you have sufficient account funds, or toggle the "approved card" simulator setting on the gateway page to try again.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/pages/checkout');
            window.dispatchEvent(new Event('popstate'));
          }}
          className="flex-1 py-4 border border-slate-250 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" /> Change payment details
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            const orderId = params.get('orderId') || '';
            const amount = '29.99'; // Default fallback
            window.history.pushState({}, '', `/payment/gateway?orderId=${orderId}&amount=${amount}`);
            window.dispatchEvent(new Event('popstate'));
          }}
          className="flex-1 py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer shadow-md"
        >
          Retry Payment on Simulator
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 4. PAYMENT CANCELLED SCREEN
// ==========================================
interface PaymentCancelledScreenProps {
  onReturnToCheckout: () => void;
}

export function PaymentCancelledScreen({ onReturnToCheckout }: PaymentCancelledScreenProps) {
  return (
    <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-6 font-sans">
      <div className="mx-auto w-16 h-16 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center shadow-inner">
        <AlertTriangle className="h-9 w-9 text-slate-500" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Checkout Cancelled</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          The secure transaction was closed by cardholder cancellation. Your cart items have been saved so you can finish whenever you are ready.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/collections/all');
            window.dispatchEvent(new Event('popstate'));
          }}
          className="py-4 border border-slate-250 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          Browse Products
        </button>
        <button
          onClick={() => {
            window.history.pushState({}, '', '/pages/checkout');
            window.dispatchEvent(new Event('popstate'));
          }}
          className="py-4 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
        >
          Return to Checkout View
        </button>
      </div>
    </div>
  );
}

