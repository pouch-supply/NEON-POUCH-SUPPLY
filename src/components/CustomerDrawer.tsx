import React, { useState, useEffect } from 'react';
import { Customer, Product, Order } from '../types';
import { 
  X, User, LogIn, Heart, MapPin, Package, ShoppingBag, 
  Plus, Trash2, Eye, ShieldCheck, Sparkles, Smile, ArrowRight,
  Truck, Check, Clock, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SubscriptionIcon from './SubscriptionIcon';

interface CustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  loggedInCustomer: Customer | null;
  onLogin: (customer: Customer) => void;
  onLogout: () => void;
  onUpdateWishlist: (productId: string, action: 'add' | 'remove') => void;
  onAddToCart: (product: Product, quantity: number) => void;
  allProducts: Product[];
  orders: Order[];
  onAddAddress: (address: string) => void;
  onRemoveAddress: (index: number) => void;
  onOpenCart: () => void;
  initialTab?: 'orders' | 'addresses' | 'wishlist' | 'emails';
  onNavigateToPortal?: () => void;
}

export default function CustomerDrawer({
  isOpen,
  onClose,
  customers,
  loggedInCustomer,
  onLogin,
  onLogout,
  onUpdateWishlist,
  onAddToCart,
  allProducts,
  orders,
  onAddAddress,
  onRemoveAddress,
  onOpenCart,
  initialTab = 'orders',
  onNavigateToPortal
}: CustomerDrawerProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'wishlist' | 'emails'>(initialTab);

  const [emailsList, setEmailsList] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);

  const loadEmails = () => {
    try {
      const stored = localStorage.getItem('ps_simulated_emails');
      if (stored) {
        setEmailsList(JSON.parse(stored));
      } else {
        setEmailsList([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEmails();
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    window.addEventListener('ps-emails-updated', loadEmails);
    return () => {
      window.removeEventListener('ps-emails-updated', loadEmails);
    };
  }, []);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Addresses States
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newStreetAddress, setNewStreetAddress] = useState('');

  // Expandable Order details Accordion
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (authMode === 'signup' && !nameInput.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!emailInput.trim()) {
      setErrorMsg('Please enter your email.');
      return;
    }
    if (!passwordInput) {
      setErrorMsg('Please enter your password.');
      return;
    }
    if (authMode === 'signup' && passwordInput !== confirmPasswordInput) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const email = emailInput.toLowerCase().trim();
      const endpoint = authMode === 'signup' ? '/api/customers/signup' : '/api/customers/login';
      const bodyPayload = authMode === 'signup' 
        ? { name: nameInput.trim(), email, password: passwordInput }
        : { email, password: passwordInput };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.customer);
        setErrorMsg('');
        setEmailInput('');
        setPasswordInput('');
        setNameInput('');
        setConfirmPasswordInput('');
      } else {
        throw new Error(data.error || 'Authentication failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myOrders = loggedInCustomer 
    ? orders.filter(o => o.customerEmail.toLowerCase() === loggedInCustomer.email.toLowerCase()) 
    : [];

  const handleAddAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreetAddress.trim()) return;
    onAddAddress(newStreetAddress.trim());
    setNewStreetAddress('');
    setShowAddressForm(false);
  };

  const handleQuickLogin = async (cust: Customer) => {
    setEmailInput(cust.email);
    setPasswordInput('password123');
    
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cust.email, password: 'password123' })
      });

      const data = await response.json();
      if (response.ok) {
        onLogin(data.customer);
        setErrorMsg('');
        setEmailInput('');
        setPasswordInput('');
      } else {
        // Fallback to local state if server has any issue or doesn't have seed
        onLogin(cust);
      }
    } catch {
      onLogin(cust);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  return (
    <>
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
            {/* Slide-in customer drawer panel */}
            <motion.div 
              id="customer-drawer-panel" 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-screen max-w-md bg-white flex flex-col h-full shadow-2xl border-l border-slate-200 relative z-10"
            >
              {/* Header */}
              <div className="px-5 py-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-600 animate-pulse" />
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    {loggedInCustomer ? 'Customer Account' : 'Customer Account Login'}
                  </h2>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close Account Workspace"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body content */}
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                {!loggedInCustomer ? (
                  /* GUEST LOGIN PANEL */
                  <div className="p-6 flex flex-col justify-between h-full space-y-6">
                    <div className="space-y-5">
                      <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 border border-slate-200 p-4 rounded-2xl text-center space-y-1">
                        <Smile className="h-8 w-8 text-indigo-600 mx-auto" />
                        <h3 className="font-extrabold text-[#0D0F12] text-[13px] uppercase mt-1">Unlock Member Perks!</h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold font-sans">
                          Sign in or register an account to manage addresses, monitor order delivery status, and save your curated wishlist flavors instantly.
                        </p>
                      </div>

                      {/* Mode Toggle Switcher */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl w-full">
                        <button
                          type="button"
                          onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
                          className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                            authMode === 'login'
                              ? 'bg-white text-slate-900 shadow-3xs'
                              : 'text-slate-500 hover:text-slate-850'
                          }`}
                        >
                          Sign In
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
                          className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                            authMode === 'signup'
                              ? 'bg-white text-slate-900 shadow-3xs'
                              : 'text-slate-500 hover:text-slate-850'
                          }`}
                        >
                          Create Account
                        </button>
                      </div>

                      <form onSubmit={handleLoginSubmit} className="space-y-4">
                        {authMode === 'signup' && (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Full Name
                            </label>
                            <input
                              type="text"
                              placeholder="Kayla Canty"
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                              required
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Email Address
                          </label>
                          <input
                            type="email"
                            placeholder="kayla.canty@yahoo.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                            required
                          />
                        </div>

                        {authMode === 'signup' && (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Confirm Password
                            </label>
                            <input
                              type="password"
                              placeholder="••••••••"
                              value={confirmPasswordInput}
                              onChange={(e) => setConfirmPasswordInput(e.target.value)}
                              className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                              required
                            />
                          </div>
                        )}

                        {errorMsg && (
                          <p className="text-[11px] text-red-500 font-semibold">{errorMsg}</p>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-[#1e293b] hover:bg-[#0f172a] disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-widest py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <>
                              <LogIn className="h-4 w-4 animate-spin" /> 
                              <span>Authenticating...</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="h-4 w-4" /> 
                              <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  /* LOGGED IN ACCOUNT WORKSPACE PANEL */
                  <div className="flex flex-col h-full">
                    {/* Customer Account Summary Header Card */}
                    <div className="p-4 bg-slate-900 text-white flex flex-col gap-3 shrink-0 rounded-b-xl border-t border-slate-800 shadow-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] text-indigo-300 font-extrabold uppercase tracking-widest">Logged In Member</span>
                          <h3 className="font-extrabold text-sm text-white mt-0.5">{loggedInCustomer.name}</h3>
                          <span className="font-mono text-[9.5px] text-slate-400 block mt-0.5">{loggedInCustomer.email}</span>
                        </div>
                        <button
                          onClick={onLogout}
                          className="text-[9.5px] bg-red-950/50 hover:bg-red-900 border border-red-800/60 hover:border-red-650 text-red-300 font-bold py-1 px-2.5 rounded-lg cursor-pointer transition-all"
                        >
                          Sign Out
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-center">
                        <div className="bg-slate-800/40 p-2 rounded-lg">
                          <span className="text-[8px] uppercase tracking-wide text-slate-400 block font-bold">Plan status</span>
                          <span className="text-[10px] font-extrabold text-indigo-400 block mt-0.5 truncate">{loggedInCustomer.subscriptionStatus}</span>
                        </div>
                        <div className="bg-slate-800/40 p-2 rounded-lg">
                          <span className="text-[8px] uppercase tracking-wide text-slate-400 block font-bold">Total orders</span>
                          <span className="text-[10px] font-extrabold text-white block mt-0.5">{loggedInCustomer.ordersCount} sessions</span>
                        </div>
                        <div className="bg-slate-800/40 p-2 rounded-lg">
                          <span className="text-[8px] uppercase tracking-wide text-slate-400 block font-bold">Total Spent</span>
                          <span className="text-[10px] font-extrabold text-emerald-400 block mt-0.5">£{loggedInCustomer.amountSpent.toFixed(2)}</span>
                        </div>
                      </div>

                      {onNavigateToPortal && (
                        <button
                          onClick={onNavigateToPortal}
                          className="w-full bg-[#dfa047] hover:bg-[#c98e3b] text-[#071d37] font-black text-xs uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-transparent hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <span>Open Customer Portal</span>
                          <ArrowRight className="h-4 w-4 animate-bounce-right" />
                        </button>
                      )}
                    </div>

                    {/* Navigation Tabs for the Account drawer */}
                    <div className="flex border-b border-slate-150 bg-slate-50 p-1 gap-1 shrink-0 overflow-x-auto">
                      <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 min-w-[75px] py-2 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                          activeTab === 'orders' 
                            ? 'bg-white text-indigo-650 shadow-xs border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <Package className="h-3 w-3 inline-block mr-1 -mt-0.5 text-slate-500" />
                        Orders ({myOrders.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('addresses')}
                        className={`flex-1 min-w-[75px] py-2 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                          activeTab === 'addresses' 
                            ? 'bg-white text-indigo-650 shadow-xs border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <MapPin className="h-3 w-3 inline-block mr-1 -mt-0.5 text-slate-500" />
                        Addresses
                      </button>
                      <button
                        onClick={() => setActiveTab('wishlist')}
                        className={`flex-1 min-w-[75px] py-2 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                          activeTab === 'wishlist' 
                            ? 'bg-white text-indigo-650 shadow-xs border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <Heart className="h-3 w-3 inline-block mr-1 -mt-0.5 text-slate-500" />
                        Wishlist
                      </button>
                      <button
                        onClick={() => setActiveTab('emails')}
                        className={`flex-1 min-w-[75px] py-2 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                          activeTab === 'emails' 
                            ? 'bg-white text-indigo-650 shadow-xs border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <Mail className="h-3 w-3 inline-block mr-1 -mt-0.5 text-slate-500" />
                        Inbox ({loggedInCustomer ? emailsList.filter(e => e.to.toLowerCase() === loggedInCustomer.email.toLowerCase()).length : 0})
                      </button>
                    </div>

                    {/* Tab contents */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      
                      {/* 1. ORDERS TAB */}
                      {activeTab === 'orders' && (
                        <div className="space-y-3">
                          {myOrders.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">No Orders Found</p>
                              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[200px] mx-auto">Place your first order and track its dispatch here instantly.</p>
                            </div>
                          ) : (
                            myOrders.map((order) => {
                              const isExpanded = expandedOrderId === order.id;
                              return (
                                <div 
                                  key={order.id} 
                                  className="bg-white border border-slate-200/95 hover:border-slate-300 rounded-2xl p-3.5 transition-all shadow-3xs"
                                >
                                  {/* Order Header Summary Row */}
                                  <div className="flex justify-between items-center gap-2">
                                    <div className="space-y-0.5">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-extrabold text-xs text-slate-900">{order.id}</span>
                                        <span className={`text-[8.5px] font-black uppercase py-0.5 px-2 rounded-full leading-none shrink-0 ${
                                          order.fulfillmentStatus === 'Fulfilled' || order.fulfillmentStatus === 'Delivered'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}>
                                          {order.fulfillmentStatus}
                                        </span>
                                        {Array.isArray(order.tags) && order.tags.includes('Withdrawal Requested') && (
                                          <span className="text-[8.5px] font-black uppercase py-0.5 px-2 rounded-full leading-none shrink-0 bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                            Withdrawal Requested
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[9.5px] text-slate-400 font-mono">{order.date}</p>
                                    </div>

                                    <div className="text-right space-y-1">
                                      <div className="text-xs font-black text-slate-900">£{order.total.toFixed(2)}</div>
                                      <button
                                        onClick={() => toggleOrderExpand(order.id)}
                                        className="text-[9.5px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-0.5 cursor-pointer ml-auto"
                                      >
                                        <Eye className="h-3 w-3" />
                                        <span>{isExpanded ? 'Hide' : 'Details'}</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expandable Order Detail Inner Accordion */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="pt-3.5 mt-3.5 border-t border-slate-100 space-y-3 test-xs">
                                          {/* Delivery details metadata */}
                                          <div className="space-y-1 text-[10.5px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Fulfillment Details</span>
                                            <p className="text-slate-700 leading-tight">📍 Courier: {order.destination}</p>
                                            <p className="text-slate-500 leading-none mt-1">🚚 Delivery Type: {order.deliveryMethod}</p>
                                          </div>

                                          {/* Direct Shipment Status Timeline (Real-time tracking) */}
                                          <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-3 shadow-3xs">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                              <Truck className="h-3 w-3 text-indigo-600 animate-pulse" />
                                              Live Delivery Tracker
                                            </span>

                                            <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-250">
                                              {(() => {
                                                const isUnfulfilled = order.fulfillmentStatus === 'Unfulfilled';
                                                const isFulfilled = order.fulfillmentStatus === 'Fulfilled';
                                                const isDelivered = order.fulfillmentStatus === 'Delivered';

                                                const steps = [
                                                  {
                                                    label: 'Placed',
                                                    active: true,
                                                    completed: true,
                                                    date: order.date,
                                                    desc: 'Order received and payment confirmed.'
                                                  },
                                                  {
                                                    label: 'Processing',
                                                    active: isUnfulfilled,
                                                    completed: !isUnfulfilled,
                                                    date: isUnfulfilled ? 'Current step' : 'Prepared',
                                                    desc: 'Personalization & custom packaging.'
                                                  },
                                                  {
                                                    label: 'Dispatched',
                                                    active: isFulfilled,
                                                    completed: isDelivered,
                                                    date: isUnfulfilled ? 'Pending' : (isFulfilled ? 'In Transit' : 'Departed hub'),
                                                    desc: 'In transit with postal carrier.'
                                                  },
                                                  {
                                                    label: 'Delivered',
                                                    active: isDelivered,
                                                    completed: isDelivered,
                                                    date: isDelivered ? 'Handed over' : 'Pending',
                                                    desc: 'Safely delivered at destination.'
                                                  }
                                                ];

                                                return steps.map((step, sIdx) => (
                                                  <div key={sIdx} className="relative text-left">
                                                    <div className={`absolute -left-[18.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 transition-all flex items-center justify-center ${
                                                      step.completed
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : step.active
                                                        ? 'bg-amber-500 border-amber-500 animate-pulse'
                                                        : 'bg-white border-slate-300'
                                                    }`} />
                                                    <div className="leading-tight">
                                                      <span className={`text-[10px] font-black uppercase tracking-wider block ${
                                                        step.completed ? 'text-indigo-950' : step.active ? 'text-amber-600' : 'text-slate-400'
                                                      }`}>
                                                        {step.label}
                                                      </span>
                                                      <p className="text-[9px] text-slate-500 leading-normal">{step.desc}</p>
                                                      <span className="text-[8.5px] font-mono text-slate-400 font-semibold mt-0.5 block">{step.date}</span>
                                                    </div>
                                                  </div>
                                                ));
                                              })()}
                                            </div>
                                          </div>

                                          {/* Items List inside accordion */}
                                          <div className="space-y-2">
                                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Custom Products ({order.items.reduce((acc, i) => acc + i.quantity, 0)})</span>
                                            <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
                                              {order.items.map((item, id) => {
                                                const matchingProduct = allProducts.find(p => p.id === item.productId);
                                                return (
                                                  <div key={id} className="p-2 flex gap-2.5 items-center justify-between text-[11px] leading-tight bg-white">
                                                    <div className="flex gap-2 items-center min-w-0">
                                                      {item.productId && (item.productId.startsWith('sub-pack-') || item.productId.includes('sub-pack')) ? (
                                                        <SubscriptionIcon planName={item.productTitle} className="!w-8 !h-8 rounded-lg" />
                                                      ) : (
                                                        <img 
                                                          src={matchingProduct?.image || item.image} 
                                                          className="w-8 h-8 rounded-lg object-contain border border-slate-150 bg-slate-50 shrink-0" 
                                                          alt="" 
                                                          referrerPolicy="no-referrer"
                                                        />
                                                      )}
                                                      <div className="min-w-0">
                                                        <p className="font-bold text-slate-800">{item.productTitle}</p>
                                                        <p className="text-slate-400 text-[9.5px] font-mono whitespace-nowrap">Qty: {item.quantity} × £{item.price.toFixed(2)}</p>
                                                      </div>
                                                    </div>
                                                    <span className="font-bold text-slate-900 shrink-0 select-none">£{(item.price * item.quantity).toFixed(2)}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* 2. ADDRESSES TAB */}
                      {activeTab === 'addresses' && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-xl border border-slate-150 shrink-0">
                            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Saved delivery points</span>
                            <button
                              onClick={() => setShowAddressForm(!showAddressForm)}
                              className="text-[10px] text-indigo-650 hover:text-indigo-850 font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>{showAddressForm ? 'Cancel' : 'Add New'}</span>
                            </button>
                          </div>

                          {showAddressForm && (
                            <form 
                              onSubmit={handleAddAddressSubmit} 
                              className="bg-indigo-50/30 p-3.5 rounded-xl border border-indigo-150/50 space-y-2.5 animate-fadeIn"
                            >
                              <h4 className="text-[9.5px] font-black uppercase tracking-widest text-[#1e293b]">Enter Shipping Address</h4>
                              <input
                                type="text"
                                placeholder="e.g. 52 Wardour St, London, W1D 4JD, United Kingdom"
                                value={newStreetAddress}
                                onChange={(e) => setNewStreetAddress(e.target.value)}
                                className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl bg-white focus:ring-1 focus:ring-indigo-650"
                                required
                              />
                              <div className="flex justify-end gap-1.5 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setShowAddressForm(false)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 rounded-lg text-[9.5px] uppercase cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="bg-[#1e293b] hover:bg-[#0f172a] text-white font-black py-1 px-3.5 rounded-lg text-[9.5px] uppercase tracking-wider cursor-pointer"
                                >
                                  Save Address
                                </button>
                              </div>
                            </form>
                          )}

                          <div className="space-y-2">
                            {loggedInCustomer.addresses.length === 0 ? (
                              <p className="text-[11px] text-slate-400 text-center py-4">No registered addresses found. Add one above!</p>
                            ) : (
                              loggedInCustomer.addresses.map((address, idx) => (
                                <div 
                                  key={idx} 
                                  className="bg-white border border-slate-200/90 hover:border-slate-350 p-3.5 rounded-2xl relative transition-all flex justify-between gap-3 items-start"
                                >
                                  <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                                      {idx === 0 ? 'Primary Address' : 'Secondary Address'}
                                    </span>
                                    <p className="text-[11px] font-semibold text-slate-700 leading-relaxed pt-1 pr-6">{address}</p>
                                  </div>

                                  {idx > 0 && (
                                    <button
                                      onClick={() => onRemoveAddress(idx)}
                                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Delete shipping address"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. WISHLIST TAB */}
                      {activeTab === 'wishlist' && (
                        <div className="space-y-3">
                          {loggedInCustomer.wishlist.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              <Heart className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Empty Wishlist</p>
                              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[200px] mx-auto">Click the hearts on our product lists to save your favorite flavors here!</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-2.5">
                              {loggedInCustomer.wishlist.map((productId) => {
                                const prod = allProducts.find(p => p.id === productId);
                                if (!prod) return null;
                                return (
                                  <div 
                                    key={prod.id} 
                                    className="bg-white border border-slate-200 p-3 rounded-2xl flex gap-3 items-center justify-between"
                                  >
                                    <div className="flex gap-2.5 items-center min-w-0">
                                      <img 
                                        src={prod.image} 
                                        className="w-10 h-10 object-contain tracking-wide border border-slate-100 bg-slate-50 shrink-0 rounded-xl" 
                                        alt="" 
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-[9.5px] text-slate-400 uppercase font-black tracking-wider leading-none">{prod.vendor}</p>
                                        <p className="font-bold text-slate-800 text-[11px] truncate mt-0.5 leading-tight">{prod.title}</p>
                                        <p className="text-xs text-indigo-700 font-extrabold mt-0.5">£{prod.price.toFixed(2)}</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-1 items-end shrink-0">
                                      <button
                                        onClick={() => {
                                          onAddToCart(prod, 1);
                                          onClose(); // Auto close the customer drawer to focus on cart selection
                                          setTimeout(() => {
                                            onOpenCart();
                                          }, 350);
                                        }}
                                        className="text-[9px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-2 rounded-lg flex items-center gap-0.5 transition-colors cursor-pointer select-none"
                                      >
                                        <Plus className="h-2.5 w-2.5" /> Bag
                                      </button>
                                      
                                      <button
                                        onClick={() => onUpdateWishlist(prod.id, 'remove')}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                        title="Remove item"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. EMAILS / INBOX TAB */}
                      {activeTab === 'emails' && (
                        <div className="space-y-3">
                          {!loggedInCustomer ? (
                            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              <Mail className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Authentication Required</p>
                              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[200px] mx-auto">Please sign in to view simulated dispatched emails sent to your address.</p>
                            </div>
                          ) : (() => {
                            const myEmails = emailsList.filter(e => e.to.toLowerCase() === loggedInCustomer.email.toLowerCase());
                            return myEmails.length === 0 ? (
                              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Mail className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inbox Empty</p>
                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[200px] mx-auto">Dispatched transaction and withdrawal emails will show up here as live copies.</p>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-[10px] text-indigo-800 font-medium leading-relaxed">
                                  📬 <strong>Simulated Sandbox Inbox</strong>: Since actual transactional emails require live SMTP credentials, all confirmation emails are intercepted and mirrored below in real-time.
                                </div>
                                {myEmails.map((email, idx) => (
                                  <div 
                                    key={idx} 
                                    onClick={() => setSelectedEmail(email)}
                                    className="bg-white border border-slate-200 hover:border-slate-300 p-3.5 rounded-xl cursor-pointer text-left transition-all shadow-3xs flex gap-3 items-start"
                                  >
                                    <div className="p-2 bg-slate-50 rounded-lg text-indigo-600 border border-slate-100 shrink-0 mt-0.5">
                                      <Mail className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <div className="flex justify-between items-baseline">
                                        <span className="text-[9px] font-black text-indigo-650 uppercase tracking-wide">From: PerfumeSampler</span>
                                        <span className="text-[8.5px] font-mono text-slate-400 font-semibold">{email.date || 'Just now'}</span>
                                      </div>
                                      <h4 className="font-bold text-slate-800 text-xs mt-1 truncate">{email.subject}</h4>
                                      <p className="text-[10px] text-slate-450 truncate mt-0.5 font-medium">{email.preview || 'Click to view full HTML email message.'}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>

              {/* Secure Footer Checkout Indicator badge */}
              <div className="p-4 border-t border-slate-150 bg-slate-50/80 text-center flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold select-none">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                <span>Pouch Supply End-to-End SSL Authenticated Session</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>

    {/* FULL HTML EMAIL PREVIEW MODAL */}
    <AnimatePresence>
      {selectedEmail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-50 border border-slate-200 p-6 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-250">
              <div>
                <span className="text-[8.5px] font-black uppercase tracking-widest text-indigo-650">SIMULATED SANDBOX EMAIL</span>
                <h4 className="text-xs font-extrabold text-slate-850 mt-0.5">Subject: {selectedEmail.subject}</h4>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Fake Email client envelope headers */}
            <div className="bg-white border border-slate-200 p-3 rounded-xl text-[10.5px] space-y-1 text-slate-600 font-medium text-left">
              <p><strong>From:</strong> PerfumeSampler Support &lt;support@perfumesampler.com&gt;</p>
              <p><strong>To:</strong> {selectedEmail.to}</p>
              <p><strong>Date:</strong> {selectedEmail.date || 'Just now'}</p>
            </div>

            {/* Email message body content */}
            <div 
              className="bg-white border border-slate-250 p-6 rounded-xl overflow-hidden shadow-inner text-slate-800 text-xs leading-relaxed space-y-4 text-left"
              dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
            />

            <button
              onClick={() => setSelectedEmail(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-[10.5px] rounded-xl cursor-pointer"
            >
              Close Message
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
