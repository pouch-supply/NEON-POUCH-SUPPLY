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
  const [checkoutId, setCheckoutId] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  
  const [simulationMode, setSimulationMode] = useState<'SUCCESS' | 'DECLINED' | '3DS_REQUIRED'>('SUCCESS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 3DS validation state
  const [show3ds, setShow3ds] = useState(false);
  const [threeDsOtp, setThreeDsOtp] = useState('');
  const [threeDsError, setThreeDsError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');

  const [worldpayConfig, setWorldpayConfig] = useState<{ active: boolean; isConfigured: boolean; checkoutId: string; provider: string } | null>(null);

  useEffect(() => {
    fetch('/api/worldpay/config')
      .then(res => res.json())
      .then(data => setWorldpayConfig(data))
      .catch(() => null);

    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('orderId') || `PS${Math.floor(Math.random() * 90000 + 10000)}`);
    setAmount(params.get('amount') || '29.99');
    setCheckoutId(params.get('checkoutId') || '');
  }, []);

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

  const getCardBrand = (num: string) => {
    const clean = num.replace(/\s+/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (clean.startsWith('5')) return 'Mastercard';
    if (clean.startsWith('3')) return 'American Express';
    if (clean.startsWith('6')) return 'Maestro';
    return 'Visa/Mastercard';
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardHolder.trim() || !cardNumber || cardNumber.replace(/\s/g, '').length < 15 || !expiry || !cvv || cvv.length < 3) {
      setPaymentError('Please enter valid credit card details.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    if (simulationMode === 'DECLINED') {
      setTimeout(() => {
        setIsProcessing(false);
        window.history.pushState({}, '', `/payment/failed?orderId=${orderId}&reason=Card declined by Worldpay risk analyzer`);
        window.dispatchEvent(new Event('popstate'));
      }, 1000);
      return;
    }

    if (simulationMode === '3DS_REQUIRED') {
      setTimeout(() => {
        setTransactionId(`WP-3DS-${Math.floor(Math.random() * 89999999 + 10000000)}`);
        setShow3ds(true);
        setIsProcessing(false);
      }, 1000);
      return;
    }

    // Call Worldpay backend API to process payment and record transaction
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
          cardHolder,
          cardBrand: getCardBrand(cardNumber)
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
      setPaymentError(err.message || 'Error communicating with Worldpay backend.');
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
        setThreeDsError('Incorrect authorization password. Worldpay 3D-Secure authentication failed.');
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
          cardHolder,
          cardBrand: getCardBrand(cardNumber)
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
      setThreeDsError(err.message || 'Connection error during 3DS verification.');
    }
  };

  const handleCancel = () => {
    window.history.pushState({}, '', `/payment/cancelled?orderId=${orderId}`);
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div className="min-h-screen bg-[#f4f4f2] py-8 px-4 font-sans text-slate-800 flex flex-col items-center">
      
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex flex-col items-center">
          <div className="text-4xl sm:text-5xl font-black tracking-tight text-[#0f2347] font-serif flex items-baseline gap-2">
            <span>Pouch</span>
            <span className="font-sans font-black tracking-widest text-xs uppercase text-[#0f2347]">SUPPLY</span>
          </div>
          <div className="flex gap-1.5 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d9a036]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#d9a036]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#d9a036]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#d9a036]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#d9a036]"></span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl w-full space-y-5">
        
        {/* Order Summary Box */}
        <div className="bg-white border-2 border-slate-200/90 rounded-xl p-6 sm:p-7 shadow-xs space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Order summary</h2>
          
          <div className="space-y-1.5 text-xs text-slate-700 font-medium">
            <div>
              <span className="font-bold text-slate-900 block text-[13px]">Payment reference:</span>
              <span className="font-mono text-slate-800 text-sm">{orderId}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-[13px]">Description:</span>
              <span className="text-slate-600">Pouch Supply Merchandise & Fast Delivery</span>
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-[13px]">Amount (GBP):</span>
              <span className="text-base font-extrabold text-slate-900">£{amount}</span>
            </div>
          </div>
        </div>

        {/* Sandbox Mode Switcher (For testing) */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-amber-900">
            <span>Worldpay HPP Gateway Sandbox Mode</span>
            <span className="text-amber-700">{worldpayConfig?.isConfigured ? 'Live Credentials Configured' : 'Simulated Gateway Active'}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSimulationMode('SUCCESS')}
              className={`px-3 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${simulationMode === 'SUCCESS' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Pass (200 OK)
            </button>
            <button
              type="button"
              onClick={() => setSimulationMode('3DS_REQUIRED')}
              className={`px-3 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${simulationMode === '3DS_REQUIRED' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Trigger 3DS
            </button>
            <button
              type="button"
              onClick={() => setSimulationMode('DECLINED')}
              className={`px-3 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${simulationMode === 'DECLINED' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Force Decline
            </button>
          </div>
        </div>

        {/* Payment Details Box */}
        <div className="bg-white border-2 border-slate-200/90 rounded-xl p-6 sm:p-7 shadow-xs space-y-5">
          
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-150 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Payment details</h2>
              <span className="text-[11px] text-red-500 font-medium">* Indicates a required field</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                <span className="text-[10px] font-bold text-slate-600">MAESTRO</span>
                <span className="text-[10px] font-bold text-blue-700">VISA</span>
                <span className="text-[10px] font-bold text-amber-600">MC</span>
                <span className="text-[10px] font-bold text-indigo-700">AMEX</span>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Card number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Card Number"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded focus:outline-none focus:border-slate-600 bg-white text-slate-900 font-mono tracking-wider"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Cardholder's name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cardholder name"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded focus:outline-none focus:border-slate-600 bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Expiry date <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={handleExpiryChange}
                    className="w-28 text-xs p-2.5 border border-slate-300 rounded text-center focus:outline-none focus:border-slate-600 bg-white text-slate-900 font-mono"
                  />
                  <span className="text-slate-400 text-xs">MM / YY</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Security code<span className="text-red-500">*</span>
                </label>
                <div className="flex items-start gap-2">
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="CVV"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                    className="w-20 text-xs p-2.5 border border-slate-300 rounded text-center focus:outline-none focus:border-slate-600 bg-white text-slate-900 font-mono"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-8 border border-slate-300 rounded bg-slate-100 flex items-center justify-end pr-1 text-[9px] font-mono text-red-600 font-bold border-r-2 border-r-red-500">
                      123
                    </div>
                    <span className="text-[10px] text-slate-500 max-w-[160px] leading-tight">
                      3 digits on the back of the card or 4 digits on front of card
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold text-slate-700 transition cursor-pointer border border-slate-300"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isProcessing}
                className="px-8 py-2.5 bg-[#0f2347] hover:bg-[#163366] text-white rounded text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Processing Worldpay...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Pay Now
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* 3D SECURE MODAL */}
      {show3ds && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full space-y-5 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-indigo-600 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">Worldpay 3D-Secure Authentication</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Card issuer verification required. Enter the passcode sent to your phone.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">Passcode</label>
              <input
                type="text"
                maxLength={6}
                placeholder="1234"
                value={threeDsOtp}
                onChange={(e) => setThreeDsOtp(e.target.value)}
                className="w-full text-center text-sm font-mono tracking-widest p-2.5 border border-slate-300 rounded focus:outline-none focus:border-slate-600 text-slate-900 font-bold"
              />
              <span className="text-[10px] text-slate-500 block">
                Hint: Enter <strong className="text-indigo-600">1234</strong> (or <strong className="text-red-500">0000</strong> to fail)
              </span>
            </div>

            {threeDsError && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600 font-medium text-left flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{threeDsError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleVerify3ds}
              disabled={isProcessing}
              className="w-full py-2.5 bg-[#0f2347] hover:bg-[#163366] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                'Verify & Authorize'
              )}
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

