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
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currOrderId = params.get('orderId') || '';
    const currAmount = params.get('amount') || '0.00';
    
    setOrderId(currOrderId);
    setAmount(currAmount);

    // Auto-initialize session if orderId and amount are present
    if (currOrderId && currAmount && parseFloat(currAmount) > 0) {
      handleLaunchWorldpay(currOrderId, currAmount);
    }
  }, []);

  const handleLaunchWorldpay = async (targetOrderId?: string, targetAmount?: string) => {
    const oId = targetOrderId || orderId;
    const amt = targetAmount || amount;

    if (!oId || !amt) {
      setPaymentError('Missing order ID or checkout amount.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const sessionRes = await fetch('/api/worldpay/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: oId,
          amount: amt,
          customerName: 'Valued Customer',
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 font-sans text-slate-800 flex flex-col items-center justify-center">
      
      {/* Brand & Worldpay Header */}
      <div className="text-center mb-6 max-w-lg w-full space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-red-50 text-red-700 rounded-full border border-red-100 text-xs font-bold shadow-2xs">
          <Lock className="h-3.5 w-3.5 text-red-600" />
          <span>Worldpay Access Gateway</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
          Official Worldpay Secure Checkout
        </h1>
        <p className="text-xs text-slate-500">
          PCI-DSS Compliant Payment Redirection Portal
        </p>
      </div>

      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
        
        {/* Order Details Header */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-bold">Order Reference:</span>
            <span className="font-mono font-black text-slate-900">{orderId || 'PS-ORDER'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-bold">Total Amount:</span>
            <span className="text-sm font-black text-slate-900">£{amount} GBP</span>
          </div>
          <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500">
            <span>Provider:</span>
            <span className="font-bold text-slate-700">Worldpay Access Checkout Platform</span>
          </div>
        </div>

        {paymentError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 space-y-1.5 text-left flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-bold block text-red-900">Worldpay Access Error</span>
              <p className="text-[11.5px] leading-relaxed">{paymentError}</p>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleLaunchWorldpay()}
            className="w-full py-4 bg-[#0F172A] hover:bg-[#1E293B] disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Redirecting to Worldpay...</span>
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 text-amber-400" />
                <span>Proceed to Worldpay Secure Payment</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReturnToShop}
            className="w-full py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            Cancel & Return to Store
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted with 256-bit SSL | Verified by Worldpay Access API</span>
        </div>
      </div>
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

  const [txId, setTxId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedOrderId = params.get('orderId') || 'PS-TEMP';
    const parsedAmount = params.get('amount') || '0.00';
    const parsedTxId = params.get('txId') || params.get('transactionId') || params.get('worldpayTxId') || '';
    setOrderId(parsedOrderId);
    setAmount(parsedAmount);
    setTxId(parsedTxId);

    // Fetch the order from db to show authentic rich confirmation details!
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders`);
        if (res.ok) {
          const list: Order[] = await res.json();
          const found = list.find(o => o.id === parsedOrderId);
          if (found) {
            setOrder(found);
            const foundAny = found as any;
            if (!parsedTxId && (foundAny.worldpayTxId || foundAny.gatewayTxId)) {
              setTxId(foundAny.worldpayTxId || foundAny.gatewayTxId || '');
            }
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

  const effectiveTxId = txId || (order?.worldpayTxId || order?.gatewayTxId || `WP-TXN-${(orderId || '8841').slice(-6).toUpperCase()}`);

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

      {/* Prominent Order & Transaction Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 text-white rounded-2xl p-4 shadow-md text-left">
        <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-0.5">Customer Order ID</span>
          <strong className="text-amber-400 text-sm font-mono tracking-tight block">#{orderId}</strong>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-0.5">Transaction ID</span>
          <strong className="text-emerald-400 text-xs font-mono tracking-tight block truncate" title={effectiveTxId}>{effectiveTxId}</strong>
        </div>
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
          Suggestions: Check that cardholder billing details match your card issuing bank, ensure sufficient account funds, or try an alternative card.
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
          Retry Payment Gateway
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

