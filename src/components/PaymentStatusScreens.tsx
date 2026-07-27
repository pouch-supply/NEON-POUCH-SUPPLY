import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CreditCard, Lock, RefreshCw, AlertTriangle, 
  CheckCircle, XCircle, ArrowLeft, Send, ShoppingBag, Truck, ExternalLink
} from 'lucide-react';
import { Order } from '../types';

// ==========================================
// 1. SECURE PAYMENT GATEWAY SIMULATOR
// ==========================================
interface SecureGatewaySimulatorProps {
  onReturnToShop: () => void;
}

export function SecureGatewaySimulator({ onReturnToShop }: SecureGatewaySimulatorProps) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  
  const [simulationMode, setSimulationMode] = useState<'SUCCESS' | 'DECLINED' | '3DS_REQUIRED' | 'GATEWAY_ERROR'>('SUCCESS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 3DS validation state
  const [show3ds, setShow3ds] = useState(false);
  const [threeDsOtp, setThreeDsOtp] = useState('');
  const [threeDsError, setThreeDsError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('orderId') || `PS${Math.floor(Math.random() * 90000 + 10000)}`);
    setAmount(params.get('amount') || '29.99');
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

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardHolder.trim() || !cardNumber || cardNumber.replace(/\s/g, '').length < 15 || !expiry || !cvv || cvv.length < 3) {
      setPaymentError('Please enter valid credit card authorization fields.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    setTimeout(() => {
      if (simulationMode === '3DS_REQUIRED') {
        setTransactionId(`TX-${Math.floor(Math.random() * 1000000)}`);
        setShow3ds(true);
        setIsProcessing(false);
      } else if (simulationMode === 'SUCCESS') {
        setIsProcessing(false);
        window.history.pushState({}, '', `/payment/success?orderId=${orderId}&amount=${amount}`);
        window.dispatchEvent(new Event('popstate'));
      } else {
        setIsProcessing(false);
        window.history.pushState({}, '', `/payment/failed?orderId=${orderId}&reason=Card declined by issuer`);
        window.dispatchEvent(new Event('popstate'));
      }
    }, 1000);
  };

  const handleVerify3ds = () => {
    if (!threeDsOtp.trim()) {
      setThreeDsError('Please enter the OTP verification code.');
      return;
    }

    setIsProcessing(true);
    setThreeDsError(null);

    // Any code is accepted except 0000 for simulation failure
    setTimeout(() => {
      if (threeDsOtp === '0000') {
        setThreeDsError('Incorrect authorization password. 3D-Secure authentication failed.');
        setIsProcessing(false);
      } else {
        setIsProcessing(false);
        setShow3ds(false);
        window.history.pushState({}, '', `/payment/success?orderId=${orderId}&amount=${amount}&verified=3ds`);
        window.dispatchEvent(new Event('popstate'));
      }
    }, 1200);
  };

  const handleCancel = () => {
    window.history.pushState({}, '', `/payment/cancelled?orderId=${orderId}`);
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div className="max-w-xl mx-auto my-12 bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative font-sans">
      
      {/* Secure Brand Bar */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 py-4 px-6 flex justify-between items-center border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black tracking-widest text-white font-mono uppercase">SECURE PAYMENT</span>
          <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
            PCI-DSS Encrypted
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/90">
          <ShieldCheck className="h-4 w-4 text-emerald-400 animate-pulse" /> Encrypted Vault
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        
        {/* Merchant details */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-slate-550 text-[10px] block uppercase tracking-wider font-extrabold">MERCHANT NAME</span>
            <span className="font-extrabold text-slate-200">Pouch Supply UK Ltd</span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-550 text-[10px] block uppercase tracking-wider font-extrabold">ORDER REFERENCE</span>
            <span className="font-mono text-slate-300 font-bold">{orderId}</span>
          </div>
          <div className="space-y-1 sm:text-right">
            <span className="text-slate-550 text-[10px] block uppercase tracking-wider font-extrabold">TOTAL CHARGE</span>
            <span className="font-black text-rose-450 text-sm">£{amount} GBP</span>
          </div>
        </div>

        {false ? (
          <div />
        ) : (
          <>
            <div className="bg-slate-850/50 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Secure Direct Card Gateway</span>
                <span className="text-[9px] font-semibold text-emerald-400">● 256-BIT SSL ENCRYPTED</span>
              </div>
              <p className="text-[10px] text-slate-400">Enter your debit/credit card details below to complete your order securely through Worldpay.</p>
            </div>

            {/* Real-looking form inputs */}
            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 block">Name on Credit Card</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ALEXANDER STERLING"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  className="w-full text-xs font-mono p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 text-white font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 block">16-Digit Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="4444 3333 2222 1111"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="w-full text-xs font-mono p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 text-white font-bold pl-10"
                  />
                  <CreditCard className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 block">Expiration (MM/YY)</label>
                  <input
                    type="text"
                    required
                    placeholder="12/28"
                    value={expiry}
                    onChange={handleExpiryChange}
                    className="w-full text-xs font-mono p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 text-white font-bold text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 block">Security Code (CVV)</label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="e.g. 123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-xs font-mono p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 text-white font-bold text-center"
                  />
                </div>
              </div>

              {paymentError && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3 text-[11px] text-red-300 font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-400" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="py-3.5 bg-slate-800 hover:bg-slate-750 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-50 text-slate-300"
                >
                  Cancel Payment
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="py-3.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 text-white shadow-lg disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4.5 w-4.5 animate-spin" /> Authorising...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Submit Secure Payment
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="text-center">
              <p className="text-[9.5px] text-slate-500 leading-normal">
                By completing this checkout, you authorize Worldpay secure payment processing. All customer card payloads are hashed securely over transport layer SSL protocols.
              </p>
            </div>
          </>
        )}
      </div>

      {/* 3D SECURE INTERACTION DIALOG OVERLAY */}
      {show3ds && (
        <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center p-6 z-30 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-6 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 bg-rose-950/60 border border-rose-800 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-rose-500 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-100">3D-Secure Verification</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Worldpay 3DS Engine requires card issuer authorization. Enter the OTP code sent to your registered mobile number ending in <strong className="text-slate-200">****204</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 block tracking-widest uppercase">SMS OTP Password</label>
              <input
                type="text"
                maxLength={6}
                placeholder="e.g. 1234"
                value={threeDsOtp}
                onChange={(e) => setThreeDsOtp(e.target.value)}
                className="w-full text-center text-sm font-mono tracking-widest p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 text-slate-100 font-bold"
              />
              <span className="text-[9px] text-slate-500 font-bold block">
                Simulator Hint: Type <strong className="text-rose-400">1234</strong> (Type <strong className="text-rose-400">0000</strong> to trigger fail)
              </span>
            </div>

            {threeDsError && (
              <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-2.5 text-[10px] text-red-300 font-bold text-left flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{threeDsError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleVerify3ds}
              disabled={isProcessing}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" /> Verifying...
                </>
              ) : (
                'Verify & Complete Checkout'
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

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
            <span className="text-rose-600 font-black text-xs uppercase tracking-widest block font-mono">Worldpay Secure</span>
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
            window.history.pushState({}, '', `/payment/worldpay-gateway?orderId=${orderId}&amount=${amount}`);
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

export const WorldpayGatewaySimulator = SecureGatewaySimulator;
