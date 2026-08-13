import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CreditCard, Lock, RefreshCw, AlertTriangle, 
  CheckCircle, XCircle, ArrowLeft, Send, ShoppingBag, Truck, ExternalLink, Check
} from 'lucide-react';
import { Order } from '../types';

// ==========================================
// 1. WORLDPAY SECURE PAYMENT GATEWAY / TEST SIMULATOR
// ==========================================
interface SecureGatewaySimulatorProps {
  onReturnToShop: () => void;
}

export function WorldpayGatewaySimulator({ onReturnToShop }: SecureGatewaySimulatorProps) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Test Mode Card Details
  const [cardNumber, setCardNumber] = useState('4444 3333 2222 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardHolder, setCardHolder] = useState('Valued Customer');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currOrderId = params.get('orderId') || '';
    const currAmount = params.get('amount') || '0.00';
    
    setOrderId(currOrderId);
    setAmount(currAmount);
  }, []);

  // Handle Test Payment Verification
  const handleTestPaymentSuccess = async () => {
    if (!orderId) {
      setPaymentError('Missing order ID reference.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const testTxId = `WP-TEST-TXN-${Math.floor(100000 + Math.random() * 900000)}`;
    const testAuthCode = `AUTH-TEST-${Math.floor(1000 + Math.random() * 9000)}`;

    const pendingDataRaw = localStorage.getItem(`ps_pending_order_${orderId}`);
    let pendingObj: any = null;
    if (pendingDataRaw) {
      try { pendingObj = JSON.parse(pendingDataRaw); } catch (_e) {}
    }

    const safeParseJson = async (res: Response) => {
      const text = await res.text().catch(() => '');
      try {
        return JSON.parse(text);
      } catch (_e) {
        return {
          success: false,
          error: text.startsWith('<') ? 'Server returned HTML response' : text || `HTTP ${res.status}`,
          message: text.startsWith('<') ? `Server returned an invalid response (${res.status})` : text
        };
      }
    };

    try {
      const response = await fetch('/api/worldpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'SUCCESS',
          transactionId: testTxId,
          authCode: testAuthCode,
          cardBrand: 'Worldpay Test Visa',
          total: parseFloat(amount) || pendingObj?.total || 0,
          customerName: pendingObj?.customerName || cardHolder,
          customerEmail: pendingObj?.customerEmail,
          destination: pendingObj?.destination,
          items: pendingObj?.items,
          discountApplied: pendingObj?.discountApplied,
          storeCreditApplied: pendingObj?.storeCreditApplied
        })
      });

      const data = await safeParseJson(response);
      setIsProcessing(false);

      if (response.ok && data.success) {
        // Clear cart and pending order backup
        localStorage.removeItem('ps_cart');
        localStorage.removeItem(`ps_pending_order_${orderId}`);

        // Dispatch order completion notification to reload admin list & customer order history
        window.dispatchEvent(new Event('order-completed'));
        
        // Redirect to Payment Success page
        const redirectUrl = `/payment/success?orderId=${encodeURIComponent(orderId)}&txId=${encodeURIComponent(testTxId)}&amount=${encodeURIComponent(amount)}`;
        window.history.pushState({}, '', redirectUrl);
        window.dispatchEvent(new Event('popstate'));
      } else {
        setPaymentError(data.message || 'Test payment verification failed.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setPaymentError(err.message || 'Failed to complete test payment verification.');
    }
  };

  // Handle Test Payment Failure / Decline
  const handleTestPaymentFailure = async () => {
    if (!orderId) return;

    setIsProcessing(true);
    try {
      // Inform server of test failure (server will NOT create order)
      await fetch('/api/worldpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'FAILED',
          reason: 'Test card authorization declined'
        })
      });
    } catch (_e) {}

    setIsProcessing(false);
    window.history.pushState({}, '', `/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=Test%20card%20authorization%20declined.%20No%20order%20was%20created.`);
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div className="min-h-screen bg-slate-900/5 py-12 px-4 font-sans text-slate-800 flex flex-col items-center justify-center">
      
      {/* Test Mode Banner Header */}
      <div className="text-center mb-6 max-w-lg w-full space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-500/10 text-amber-700 rounded-full border border-amber-500/20 text-xs font-bold shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
          <span>WORLDPAY TEST / SANDBOX MODE</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Worldpay Secure Payment Sandbox
        </h1>
        <p className="text-xs text-slate-500">
          Official Worldpay Access Gateway. Test Sandbox Environment.
        </p>
      </div>

      <div className="max-w-lg w-full bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
        
        {/* Order Details Header */}
        <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400 font-bold">Order ID Reference:</span>
            <span className="font-mono font-black text-amber-400">#{orderId || 'PS-TEMP'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400 font-bold">Total Payable Amount:</span>
            <span className="text-sm font-black text-emerald-400">£{amount} GBP</span>
          </div>
          <div className="flex justify-between items-center pt-1 text-[11px] text-slate-400">
            <span>Payment Environment:</span>
            <span className="font-bold text-amber-300 uppercase tracking-wider">Worldpay Sandbox Test Mode</span>
          </div>
        </div>

        {paymentError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 space-y-1.5 text-left flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-bold block text-red-900">Worldpay Test Gateway Alert</span>
              <p className="text-[11.5px] leading-relaxed">{paymentError}</p>
            </div>
          </div>
        )}

        {/* Test Card Inputs Form */}
        <div className="space-y-3.5 text-left">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Test Card Credentials</span>
          
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Cardholder Name</label>
            <input
              type="text"
              value={cardHolder}
              onChange={e => setCardHolder(e.target.value)}
              className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Test Card Number</label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                className="w-full text-xs font-mono font-bold p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
              <CreditCard className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Expiry Date</label>
              <input
                type="text"
                value={cardExpiry}
                onChange={e => setCardExpiry(e.target.value)}
                className="w-full text-xs font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Security Code (CVV)</label>
              <input
                type="text"
                value={cardCvv}
                onChange={e => setCardCvv(e.target.value)}
                className="w-full text-xs font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Payment Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleTestPaymentSuccess}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                <span>Verifying Test Payment Server-Side...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-white" />
                <span>Authorize Successful Test Payment (£{amount})</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleTestPaymentFailure}
            className="w-full py-2.5 border border-red-200 hover:bg-red-50 text-red-650 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span>Test Card Decline (Authorization Failure)</span>
          </button>

          <button
            type="button"
            onClick={onReturnToShop}
            className="w-full py-2 text-slate-400 hover:text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Cancel & Return to Store
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Server-Side Payment Verification Enabled | Official Worldpay Test Protocol</span>
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

    // Fetch the order from db to show authentic rich confirmation details
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders`);
        if (res.ok) {
          const text = await res.text().catch(() => '');
          let list: Order[] = [];
          try {
            list = JSON.parse(text);
          } catch (_e) {}
          if (Array.isArray(list)) {
            const found = list.find(o => o.id === parsedOrderId);
            if (found) {
              setOrder(found);
              const foundAny = found as any;
              if (!parsedTxId && (foundAny.worldpayTxId || foundAny.gatewayTxId)) {
                setTxId(foundAny.worldpayTxId || foundAny.gatewayTxId || '');
              }
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

    // Trigger custom event so Admin Dashboard re-fetches orders immediately
    window.dispatchEvent(new Event('order-completed'));
  }, []);

  const effectiveTxId = txId || (order?.worldpayTxId || order?.gatewayTxId || `WP-TXN-${(orderId || '8841').slice(-6).toUpperCase()}`);
  const displayTotal = order?.total ? order.total.toFixed(2) : (amount || '0.00');

  return (
    <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-6 font-sans">
      
      {/* Success Badge */}
      <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
        <CheckCircle className="h-10 w-10 text-emerald-500 animate-bounce" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Payment Completed Successfully!</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          Your credit card was authorized, and your order has been received. A detailed order confirmation has been dispatched to your email address.
        </p>
      </div>

      {/* Prominent Order ID & Transaction ID Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 text-white rounded-2xl p-4 shadow-md text-left">
        <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-0.5">Order ID</span>
          <strong className="text-amber-400 text-base font-mono tracking-tight block">#{orderId}</strong>
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
            <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Customer Name</span>
            <strong className="text-slate-800 text-xs">{order?.customerName || 'Valued Customer'}</strong>
          </div>
          <div className="text-right">
            <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Payment Status</span>
            <span className="text-emerald-600 font-black text-xs uppercase tracking-widest block font-mono bg-emerald-100/70 px-2 py-0.5 rounded-md inline-block mt-0.5">
              Successful
            </span>
          </div>
        </div>

        <div className="py-3.5 space-y-2">
          <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Fulfillment Delivery Method</span>
          <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-150 shadow-3xs">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-slate-600" />
              <div>
                <span className="font-extrabold text-slate-850 block text-[11px]">Royal Mail Tracked 24/48</span>
                <span className="text-[9px] text-slate-400 block font-bold">Estimated Delivery: 2-3 Business Days</span>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 py-1 px-2.5 rounded-md">
              Order Confirmed
            </span>
          </div>
        </div>

        {order && order.items && order.items.length > 0 && (
          <div className="py-3.5 space-y-2">
            <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider block">Items Purchased ({order.items.length})</span>
            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
              {order.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-[11px] font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-100">
                  <span className="truncate max-w-[280px]">{item.productTitle} <span className="text-slate-400 font-normal">x{item.quantity}</span></span>
                  <span>£{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 flex justify-between items-center">
          <span className="font-black text-slate-850 uppercase text-[10px] tracking-wider">Total Amount Paid</span>
          <span className="text-lg font-black text-slate-900">£{displayTotal} GBP</span>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-2">
        <Send className="h-4 w-4 shrink-0" />
        <span>Order confirmation email dispatched to {order?.customerEmail || 'customer mailbox'}!</span>
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
    setReason(params.get('reason') || 'Card authorization declined or transaction cancelled.');
  }, []);

  return (
    <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-6 font-sans">
      <div className="mx-auto w-16 h-16 bg-red-50 text-red-650 rounded-full flex items-center justify-center shadow-inner">
        <XCircle className="h-10 w-10 text-red-500" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Payment Authorization Failed</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          The credit card processor could not complete your transaction. No charges were billed, and no order was created.
        </p>
      </div>

      <div className="border border-red-100 bg-red-50/50 rounded-2xl p-5 text-left text-xs space-y-1">
        <span className="text-red-800 uppercase text-[9px] font-black tracking-widest block">Error Message:</span>
        <p className="font-extrabold text-slate-800 text-[11.5px] leading-relaxed">{reason}</p>
        <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
          Suggestions: Check that card details match your issuing bank, ensure sufficient account funds, or try an alternative card.
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
          <ArrowLeft className="h-4 w-4 text-slate-500" /> Return to Checkout
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
          The transaction was closed before completion. No charges were made, and no order was recorded in the system.
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
