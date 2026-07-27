import React, { useState } from 'react';
import { CartItem, Discount, Customer } from '../types';
import { X, Trash2, Plus, Minus, Ticket, Check, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SubscriptionIcon from './SubscriptionIcon';
import { calculateDiscountAmount } from '../utils';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (productId: string, action: 'inc' | 'dec') => void;
  onRemoveItem: (productId: string) => void;
  activeDiscounts: Discount[];
  onTriggerCheckout: (discountApplied: Discount | null, finalTotal: number) => void;
  products?: any[];
  collections?: any[];
  customers?: Customer[];
  loggedInCustomer?: Customer | null;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  activeDiscounts,
  onTriggerCheckout,
  products = [],
  collections = [],
  customers = [],
  loggedInCustomer = null
}: CartDrawerProps) {
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const discountValue = calculateDiscountAmount(
    appliedDiscount,
    cartItems,
    subtotal,
    products,
    collections
  );

  const totalBeforeShipping = Math.max(subtotal - discountValue, 0);
  const shippingFee = (totalBeforeShipping >= 40 || appliedDiscount?.type === 'Free shipping') ? 0 : 2.99;
  const total = totalBeforeShipping + shippingFee;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;
    
    setPromoError('');
    setPromoSuccess('');

    // Locate discount matches
    const code = promoCodeInput.trim().toUpperCase();
    const found = activeDiscounts.find(d => d.title.toUpperCase() === code && d.status === 'Active');

    if (found) {
      setAppliedDiscount(found);
      setPromoSuccess(`Promo Code "${code}" applied: ${found.details}!`);
    } else if (code === 'SUB10' || code === 'SUBSCRIBER10' || code === 'FIRST50') {
      const subDiscount: Discount = {
        id: 'disc-sub-first50',
        title: code,
        status: 'Active',
        method: 'Code',
        eligibility: 'All customers',
        type: 'Amount off order',
        valueType: 'Percentage',
        valueAmount: 10,
        details: '10% First 50 Subscribers Permanent Discount',
        used: 12,
        limitOnePerCustomer: false
      };
      setAppliedDiscount(subDiscount);
      setPromoSuccess('10% First 50 Subscribers discount applied!');
    } else {
      // Check if it matches an existing customer's referral code (case-insensitive)
      const matchingCustomer = customers.find(c => c.referralCode && c.referralCode.toUpperCase() === code);
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
        setAppliedDiscount(virtualDiscount);
        setPromoSuccess(`Referral code applied! You receive a 10% discount on your order.`);
      } else {
        setPromoError('Invalid or expired promo code.');
      }
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    onTriggerCheckout(appliedDiscount, total);
    setAppliedDiscount(null);
    setPromoCodeInput('');
    setPromoSuccess('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Dark backdrop blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            {/* Slide-in cart panel */}
            <motion.div 
              id="cart-drawer-panel" 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-screen max-w-md bg-white flex flex-col h-full shadow-2xl border-l border-slate-200 relative z-10"
            >
              {/* Header */}
              <div className="px-5 py-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    My Shopping Cart ({cartItems.reduce((acc, i) => acc + i.quantity, 0)})
                  </h2>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Cart items list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {cartItems.length === 0 ? (
                  <div className="text-center py-24 space-y-3">
                    <span className="text-3xl block">🛒</span>
                    <p className="font-bold text-slate-750 text-sm">Your cart drawer is empty</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">Explore our nicotine pouches, configure custom collection subscribers or custom packs.</p>
                    <button
                      onClick={onClose}
                      className="inline-block text-xs bg-slate-900 border-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-6 rounded-lg shadow-xs cursor-pointer transition-colors mt-2"
                    >
                      Continue Shopping Now
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cartItems.map((item, index) => (
                      <div key={`${item.productId}-${index}`} className="py-4 flex gap-4 text-xs items-center justify-between">
                        {item.productId && (item.productId.startsWith('sub-pack-') || item.productId.includes('sub-pack')) ? (
                          <SubscriptionIcon planName={item.productTitle} />
                        ) : (
                          <img
                            src={item.image}
                            alt={item.productTitle}
                            className="w-16 h-16 object-cover rounded-lg bg-slate-50 border border-slate-100 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        <div className="flex-1 min-w-0 pr-3">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{item.vendor}</span>
                          <h4 className="font-extrabold text-slate-800 leading-normal text-xs">{item.productTitle}</h4>
                          <p className="text-slate-500 font-bold text-slate-900 mt-1">£{item.price.toFixed(2)} each</p>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center border border-slate-200 rounded-md bg-white">
                              <button
                                onClick={() => onUpdateQty(item.productId, 'dec')}
                                className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 cursor-pointer rounded-l-md"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="px-2 text-xs font-bold text-slate-800 w-5 text-center bg-slate-50/55">{item.quantity}</span>
                              <button
                                onClick={() => onUpdateQty(item.productId, 'inc')}
                                className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 cursor-pointer rounded-r-md"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <span className="font-extrabold text-slate-900 text-xs">£{(item.price * item.quantity).toFixed(2)}</span>
                          <button
                            onClick={() => onRemoveItem(item.productId)}
                            className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100/60 rounded-md cursor-pointer transition-colors"
                            title="Remove package"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Panel */}
              {cartItems.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50 p-5 space-y-4 shrink-0">
                  {/* Promo code block */}
                  <form onSubmit={handleApplyPromo} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Promo (CRUSHCLUB15)"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 p-2 text-xs rounded-lg uppercase placeholder:normal-case font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-lg cursor-pointer transition-colors shrink-0"
                    >
                      Apply Code
                    </button>
                  </form>

                  {/* Promo status messages */}
                  {promoError && <p className="text-[10px] text-red-500 font-bold">{promoError}</p>}
                  {promoSuccess && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 p-1.5 rounded font-black">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>{promoSuccess}</span>
                    </div>
                  )}

                  {/* Total calculations */}
                  <div className="space-y-2 border-t border-slate-200 pt-3 text-xs leading-normal">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal items</span>
                      <span className="font-bold text-slate-800">£{subtotal.toFixed(2)}</span>
                    </div>
                    
                    {appliedDiscount && (
                      <div className="flex justify-between text-emerald-600">
                        <span className="flex items-center gap-1 font-semibold">
                          <Ticket className="h-3.5 w-3.5" /> Discount ({appliedDiscount.title})
                        </span>
                        <span className="font-extrabold">-£{discountValue.toFixed(2)}</span>
                      </div>
                    )}

                    {totalBeforeShipping < 40 && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-[11px] text-indigo-700 text-center font-bold">
                        🚚 Add <span className="font-extrabold">£{(40 - totalBeforeShipping).toFixed(2)}</span> more to qualify for <span className="underline">FREE Delivery</span>!
                      </div>
                    )}

                    <div className="flex justify-between text-slate-500">
                      <span>Delivery fee</span>
                      <span className={shippingFee === 0 ? "text-emerald-600 font-extrabold" : "font-extrabold text-slate-800"}>
                        {shippingFee === 0 ? 'FREE' : '£2.99'}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-800 text-sm font-extrabold pt-2 border-t border-slate-200">
                      <span className="flex items-center gap-1">Total amount <Sparkles className="h-3 w-3 text-indigo-500" /></span>
                      <span className="text-base text-slate-950">£{total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Checkout actions */}
                  <button
                    id="cart-checkout-btn"
                    onClick={handleCheckout}
                    className="w-full bg-slate-900 border-slate-900 text-white hover:bg-slate-800 py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <ShieldCheck className="h-4.5 w-4.5" /> PROCEED TO CHECKOUT SCREEN
                  </button>

                  <div className="flex justify-center items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <span>🔒 Secured, encrypted checkout sequence setup</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
