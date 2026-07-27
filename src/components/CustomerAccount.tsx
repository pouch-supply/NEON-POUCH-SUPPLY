import React, { useState, useEffect } from 'react';
import { Customer, Product, Order, Discount } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, LogIn, Heart, PlusCircle, Trash2, MapPin, Package, ShoppingBag, 
  Eye, X, Search, Truck, Check, Clock, Calendar, RefreshCw, Award, 
  Copy, Share2, HelpCircle, ShieldAlert, CreditCard, Star, ChevronRight, 
  CheckCircle2, AlertTriangle, Play, Pause, ChevronDown, CheckCircle, Tag, LifeBuoy,
  Layout, LogOut
} from 'lucide-react';

interface CustomerAccountProps {
  customers: Customer[];
  loggedInCustomer: Customer | null;
  onLogin: (customer: Customer) => void;
  onLogout: () => void;
  onUpdateWishlist: (productId: string, action: 'add' | 'remove') => void;
  allProducts: Product[];
  orders: Order[];
  onAddAddress: (address: string) => void;
  onRemoveAddress: (index: number) => void;
  onUpdateProfile?: (customer: Customer) => void;
  onUpdateOrder?: (order: Order) => void;
  discounts?: Discount[];
}

export default function CustomerAccount({
  customers,
  loggedInCustomer,
  onLogin,
  onLogout,
  onUpdateWishlist,
  allProducts,
  orders,
  onAddAddress,
  onRemoveAddress,
  onUpdateProfile,
  onUpdateOrder,
  discounts = []
}: CustomerAccountProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [referredByCodeInput, setReferredByCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrApt, setAddrApt] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [addrCountry, setAddrCountry] = useState('United Kingdom');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  // Active view tab state (mimicking the sidebar items)
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Track order in customer portal
  const [trackerInput, setTrackerInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackerError, setTrackerError] = useState('');

  // Profile editing local states
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Star Progress System definition and calculations
  const TIERS = [
    { level: 1, name: "Bronze Member", required: 5 },
    { level: 2, name: "Silver Member", required: 15 },
    { level: 3, name: "Gold Member", required: 30 },
    { level: 4, name: "Platinum Member", required: 31 }
  ];

  const myOrders = loggedInCustomer 
    ? orders.filter(o => o.customerEmail.toLowerCase() === loggedInCustomer.email.toLowerCase()) 
    : [];
  const ordersCount = myOrders.length;

  const getUnlockedRewardsCount = (count: number): number => {
    const staticMilestones = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29];
    let unlocked = staticMilestones.filter(m => count >= m).length;
    if (count >= 31) {
      for (let i = 31; i <= count; i++) {
        if (i % 2 !== 0) {
          unlocked++;
        }
      }
    }
    return unlocked;
  };

  const getTierInfo = (count: number) => {
    const unlockedCount = getUnlockedRewardsCount(count);
    if (count >= 31) {
      return {
        level: 4,
        currentTierName: "Platinum Member",
        badgeName: "Platinum Member",
        nextTierName: "",
        ordersNeededForNext: 0,
        progressPercentage: 100,
        unlockedCount,
        description: "Congratulations! You have reached Platinum Member status 💎! Enjoy the highest loyalty multiplier, quarterly surprise rewards, priority customer support, and direct rewards for every odd-numbered order."
      };
    } else if (count >= 16) {
      return {
        level: 3,
        currentTierName: "Gold Member",
        badgeName: "Gold Member",
        nextTierName: "Platinum Member",
        ordersNeededForNext: 31 - count,
        progressPercentage: Math.round(((count - 15) / (31 - 15)) * 100),
        unlockedCount,
        description: `You are currently a Gold Member 🥇. Complete ${31 - count} more order${31 - count > 1 ? 's' : ''} to unlock Platinum Member status.`
      };
    } else if (count >= 6) {
      return {
        level: 2,
        currentTierName: "Silver Member",
        badgeName: "Silver Member",
        nextTierName: "Gold Member",
        ordersNeededForNext: 16 - count,
        progressPercentage: Math.round(((count - 5) / (16 - 5)) * 100),
        unlockedCount,
        description: `You are currently a Silver Member 🥈. Complete ${16 - count} more order${16 - count > 1 ? 's' : ''} to unlock Gold Member status.`
      };
    } else {
      return {
        level: 1,
        currentTierName: "Bronze Member",
        badgeName: "Bronze Member",
        nextTierName: "Silver Member",
        ordersNeededForNext: 6 - count,
        progressPercentage: Math.round((count / 5) * 100),
        unlockedCount,
        description: count === 0
          ? "You are currently a Bronze Member 🥉. Every new subscriber starts here! Place your first order to start unlocking rewards."
          : `You are currently a Bronze Member 🥉. Complete ${6 - count} more order${6 - count > 1 ? 's' : ''} to unlock Silver Member status.`
      };
    }
  };

  const tierInfo = getTierInfo(ordersCount);

  const customerLoyaltyRewards = (discounts || []).filter(d => {
    if (d.type !== 'Loyalty Reward' || d.status !== 'Active') return false;
    
    // Check eligibility
    if (!d.loyaltyCustomerSelection || d.loyaltyCustomerSelection === 'All customers') {
      return true;
    }
    
    if (d.loyaltyCustomerSelection === 'Specific customers' && loggedInCustomer) {
      return (d.loyaltyCustomerEmails || [])
        .map(e => e.toLowerCase())
        .includes(loggedInCustomer.email.toLowerCase());
    }
    
    return false;
  });

  useEffect(() => {
    if (loggedInCustomer) {
      setEditName(loggedInCustomer.name);
      setEditEmail(loggedInCustomer.email);
      setEditPassword('');
    }
  }, [loggedInCustomer]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track');
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
    if (trackId) {
      setTrackerInput(trackId);
      const found = orders.find(o => 
        o.id.toUpperCase() === trackId.toUpperCase() || 
        (o.trackingId && o.trackingId.toUpperCase() === trackId.toUpperCase())
      );
      if (found) {
        setTrackedOrder(found);
      }
    }
  }, [orders]);

  // Local storage state helper for customer properties
  const custKey = loggedInCustomer ? `cust_db_${loggedInCustomer.email}` : '';
  const [custState, setCustState] = useState<any>(null);

  useEffect(() => {
    if (!loggedInCustomer) {
      setCustState(null);
      return;
    }
    const saved = localStorage.getItem(custKey);
    let state: any = null;
    if (saved) {
      try {
        state = JSON.parse(saved);
      } catch (e) {}
    }

    const realReferralCode = loggedInCustomer.referralCode || `REF-PS-${loggedInCustomer.name.trim().split(" ")[0].toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const realStoreCredit = loggedInCustomer.storeCredit !== undefined ? loggedInCustomer.storeCredit : 0;

    // Gather all referred friends from both:
    // 1. Registered customers who used the referral code on signup
    // 2. Orders that were placed using the referrer's referral code/coupon
    const referredEmails = new Set<string>();
    const dynamicReferrals: Array<{
      name: string;
      email: string;
      date: string;
      status: 'Registered' | 'Ordered';
      credit: string;
    }> = [];

    // 1. Scan registered customers
    customers.forEach(c => {
      if (c.referredByCode && c.referredByCode.toUpperCase() === realReferralCode.toUpperCase()) {
        if (c.email.toLowerCase() !== loggedInCustomer.email.toLowerCase()) {
          referredEmails.add(c.email.toLowerCase());
          const hasOrdered = orders.some(o => o.customerEmail.toLowerCase() === c.email.toLowerCase());
          dynamicReferrals.push({
            name: c.name,
            email: c.email.toLowerCase(),
            date: "Recently Registered",
            status: hasOrdered ? 'Ordered' : 'Registered',
            credit: hasOrdered ? '£5.00' : 'Pending'
          });
        }
      }
    });

    // 2. Scan orders for guest or other users who applied this referrer's code at checkout
    orders.forEach(o => {
      const disc = o.discountApplied;
      const isMyReferralCode = disc && (
        disc.id === `disc-ref-virtual-${loggedInCustomer.id}` ||
        disc.id === `disc-ref-${loggedInCustomer.id}` ||
        disc.title.toUpperCase() === realReferralCode.toUpperCase()
      );
      if (isMyReferralCode && o.customerEmail.toLowerCase() !== loggedInCustomer.email.toLowerCase()) {
        const emailLower = o.customerEmail.toLowerCase();
        if (!referredEmails.has(emailLower)) {
          referredEmails.add(emailLower);
          const matchCust = customers.find(c => c.email.toLowerCase() === emailLower);
          const displayName = matchCust ? matchCust.name : (o.customerName || "Friend");
          dynamicReferrals.push({
            name: displayName,
            email: emailLower,
            date: o.createdAt ? new Date(o.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : "Recently Ordered",
            status: 'Ordered',
            credit: '£5.00'
          });
        } else {
          const existingRef = dynamicReferrals.find(r => r.email === emailLower);
          if (existingRef && existingRef.status !== 'Ordered') {
            existingRef.status = 'Ordered';
            existingRef.credit = '£5.00';
          }
        }
      }
    });

    const referredCount = dynamicReferrals.length;
    const referralsList = dynamicReferrals.map(r => ({
      name: r.name.split(" ")[0] + " " + (r.name.split(" ")[1] ? r.name.split(" ")[1].substring(0, 1) + "." : ""),
      date: r.date,
      status: r.status,
      credit: r.credit
    }));

    if (!state) {
      // Set default state, preferring values already saved in the database on loggedInCustomer
      state = {
        subPlan: (loggedInCustomer as any).subPlan || 'core',
        subStatus: (loggedInCustomer as any).subStatus || 'Active',
        subFrequency: (loggedInCustomer as any).subFrequency || 'Every 4 Weeks',
        subCansCount: (loggedInCustomer as any).subCansCount || 8,
        subPrice: (loggedInCustomer as any).subPrice || 35.99,
        nextPayment: (loggedInCustomer as any).nextPayment || '19 June 2026',
        nextDelivery: (loggedInCustomer as any).nextDelivery || '24 June 2026',
        unlockedRewards: (loggedInCustomer as any).unlockedRewards || [
          { id: 'reward_1', title: 'Free Express Delivery', desc: 'Complimentary shipping upgrade', redeemed: false, code: 'FREESHIP' },
          { id: 'reward_2', title: '£5.00 Off Order', desc: 'Direct cash discount voucher', redeemed: false, code: 'POUCH5OFF' },
          { id: 'reward_3', title: 'Free Extra Can', desc: 'Unlock a free sample in next box', redeemed: false, code: 'FREECAN' }
        ],
        referralCode: realReferralCode,
        referredCount: referredCount,
        referralCredit: realStoreCredit,
        referralsList: referralsList,
        savedCards: (loggedInCustomer as any).savedCards || [
          { id: 'card_1', brand: 'Visa', last4: '4242', exp: '12/28', default: true }
        ],
        ordersCount: orders.filter(o => o.customerEmail.toLowerCase() === loggedInCustomer.email.toLowerCase()).length,
        subItems: (loggedInCustomer as any).subItems || (allProducts.length >= 2 ? [
          { productId: allProducts[0].id, title: allProducts[0].title, quantity: Math.floor(((loggedInCustomer as any).subCansCount || 8) / 2) || 4, image: allProducts[0].image, price: allProducts[0].price },
          { productId: allProducts[1].id, title: allProducts[1].title, quantity: Math.ceil(((loggedInCustomer as any).subCansCount || 8) / 2) || 4, image: allProducts[1].image, price: allProducts[1].price }
        ] : [
          { productId: 'prod-1', title: 'VELO Freeze Max', quantity: Math.floor(((loggedInCustomer as any).subCansCount || 8) / 2) || 4, image: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=120&q=80', price: 4.50 },
          { productId: 'prod-2', title: 'ZYN Cool Mint', quantity: Math.ceil(((loggedInCustomer as any).subCansCount || 8) / 2) || 4, image: 'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=120&q=80', price: 4.50 }
        ])
      };
    } else {
      // Ensure sync with loggedInCustomer's real storeCredit and referralCode from MongoDB database
      state.referralCode = realReferralCode;
      state.referralCredit = realStoreCredit;
      state.referredCount = referredCount;
      state.referralsList = referralsList;
      if ((loggedInCustomer as any).subStatus !== undefined) state.subStatus = (loggedInCustomer as any).subStatus;
      if ((loggedInCustomer as any).subPlan !== undefined) state.subPlan = (loggedInCustomer as any).subPlan;
      if ((loggedInCustomer as any).subFrequency !== undefined) state.subFrequency = (loggedInCustomer as any).subFrequency;
      if ((loggedInCustomer as any).subCansCount !== undefined) state.subCansCount = (loggedInCustomer as any).subCansCount;
      if ((loggedInCustomer as any).subPrice !== undefined) state.subPrice = (loggedInCustomer as any).subPrice;
      if ((loggedInCustomer as any).nextPayment !== undefined) state.nextPayment = (loggedInCustomer as any).nextPayment;
      if ((loggedInCustomer as any).nextDelivery !== undefined) state.nextDelivery = (loggedInCustomer as any).nextDelivery;
      if ((loggedInCustomer as any).unlockedRewards !== undefined) state.unlockedRewards = (loggedInCustomer as any).unlockedRewards;
      if ((loggedInCustomer as any).savedCards !== undefined) state.savedCards = (loggedInCustomer as any).savedCards;

      if ((loggedInCustomer as any).subItems !== undefined) {
        state.subItems = (loggedInCustomer as any).subItems;
      } else if (!state.subItems) {
        const cansCount = state.subCansCount || 8;
        state.subItems = allProducts.length >= 2 ? [
          { productId: allProducts[0].id, title: allProducts[0].title, quantity: Math.floor(cansCount / 2) || 4, image: allProducts[0].image, price: allProducts[0].price },
          { productId: allProducts[1].id, title: allProducts[1].title, quantity: Math.ceil(cansCount / 2) || 4, image: allProducts[1].image, price: allProducts[1].price }
        ] : [
          { productId: 'prod-1', title: 'VELO Freeze Max', quantity: Math.floor(cansCount / 2) || 4, image: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=120&q=80', price: 4.50 },
          { productId: 'prod-2', title: 'ZYN Cool Mint', quantity: Math.ceil(cansCount / 2) || 4, image: 'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=120&q=80', price: 4.50 }
        ];
      }
    }

    setCustState(state);
    localStorage.setItem(custKey, JSON.stringify(state));
  }, [loggedInCustomer, custKey, customers, orders]);

  const updateCustState = (newVal: any) => {
    setCustState(newVal);
    localStorage.setItem(custKey, JSON.stringify(newVal));
    if (onUpdateProfile && loggedInCustomer) {
      onUpdateProfile({
        ...loggedInCustomer,
        ...newVal
      });
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (authMode === 'signup' && !nameInput.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!emailInput.trim() || !passwordInput) {
      setErrorMsg('Please fill in all credentials.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = authMode === 'signup' ? '/api/customers/signup' : '/api/customers/login';
      const bodyPayload = authMode === 'signup' 
        ? { name: nameInput.trim(), email: emailInput.toLowerCase().trim(), password: passwordInput, referredByCode: referredByCodeInput.trim() }
        : { email: emailInput.toLowerCase().trim(), password: passwordInput };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');

      onLogin(data.customer);
      setNameInput('');
      setPasswordInput('');
      setReferredByCodeInput('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Server connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleTrackOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTrackerError('');
    setTrackedOrder(null);
    const checkId = trackerInput.trim().toUpperCase();
    if (!checkId) {
      setTrackerError('Please enter an Order ID or Royal Mail Tracking reference.');
      return;
    }
    const found = orders.find(o => 
      o.id.toUpperCase() === checkId || 
      (o.trackingId && o.trackingId.toUpperCase() === checkId)
    );
    if (found) {
      setTrackedOrder(found);
    } else {
      setTrackerError(`No order found matching "${checkId}".`);
    }
  };

  const getTimelineSteps = (order: Order) => {
    const isUnfulfilled = order.fulfillmentStatus === 'Unfulfilled';
    const isFulfilled = order.fulfillmentStatus === 'Fulfilled';
    const isDelivered = order.fulfillmentStatus === 'Delivered';
    return [
      { key: 'placed', label: 'Placed', description: 'Order received and payment confirmed.', status: 'completed', date: order.date },
      { key: 'processing', label: 'Processing', description: 'Active assembly & quality inspection.', status: isUnfulfilled ? 'current' : 'completed', date: isUnfulfilled ? 'Current step' : `${order.date} (Success)` },
      { key: 'dispatched', label: 'Dispatched', description: 'Departed sorting facility.', status: isUnfulfilled ? 'pending' : (isFulfilled ? 'current' : 'completed'), date: isUnfulfilled ? 'Pending shipment' : (isFulfilled ? 'In Transit' : 'Departed hub') },
      { key: 'delivered', label: 'Delivered', description: 'Arrived at your doorstep successfully.', status: isDelivered ? 'completed' : 'pending', date: isDelivered ? 'Handed to customer' : 'Awaiting delivery estimates' }
    ];
  };

  // Logged Out Screen
  if (!loggedInCustomer) {
    return (
      <div className="max-w-5xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden font-sans">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Sign In / Sign Up form */}
          <div className="p-8 lg:p-12 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[#071d37] tracking-wider uppercase">Pouch Supply</span>
                <span className="w-1.5 h-1.5 bg-[#dfa047] rounded-full self-end mb-1"></span>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${authMode === 'login' ? 'bg-white text-[#071d37] shadow-sm' : 'text-slate-500'}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${authMode === 'signup' ? 'bg-white text-[#071d37] shadow-sm' : 'text-slate-500'}`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-[#071d37]">
                {authMode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p className="text-slate-500 text-xs">
                {authMode === 'login' 
                  ? 'Access your personalized subscription portal, track order progress, and unlock free premium rewards.'
                  : 'Join Pouch Supply today to get 15% off subscription boxes and start unlocking direct premium gifts.'}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Valentina Gomez"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-[#071d37] focus:outline-none bg-slate-50/50"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="valentina@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-[#071d37] focus:outline-none bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-[#071d37] focus:outline-none bg-slate-50/50"
                />
              </div>
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Referral Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. REF-SCOTT-F4X8"
                    value={referredByCodeInput}
                    onChange={(e) => setReferredByCodeInput(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-[#071d37] focus:outline-none bg-slate-50/50"
                  />
                </div>
              )}
              {errorMsg && <p className="text-xs text-rose-500 font-bold">{errorMsg}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#071d37] hover:bg-[#0c2e56] disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-widest py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {authMode === 'login' ? 'Sign In To Account' : 'Register Now'}
              </button>
            </form>
          </div>

          {/* Quick Tracking Panel */}
          <div className="p-8 lg:p-12 bg-slate-50/80 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100">
            <div className="space-y-6">
              <div className="p-3 bg-blue-50 text-[#071d37] rounded-full w-12 h-12 flex items-center justify-center shadow-xs">
                <Truck className="h-6 w-6 animate-pulse" />
              </div>
              <h2 className="text-xl font-extrabold text-[#071d37]">Guest Order Tracking</h2>
              <p className="text-slate-500 text-xs">
                You do not need to sign in to check your order shipment status. Enter your Order ID reference below to visualize real-time progress.
              </p>
              <form onSubmit={handleTrackOrder} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. PS48884"
                    value={trackerInput}
                    onChange={(e) => setTrackerInput(e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-slate-200 p-3 pr-10 rounded-xl focus:ring-2 focus:ring-[#071d37] focus:outline-none uppercase bg-white"
                  />
                  <Search className="absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
                {trackerError && <p className="text-xs text-rose-500 font-bold">{trackerError}</p>}
                <button
                  type="submit"
                  className="w-full bg-[#dfa047] hover:bg-[#c98e3b] text-white font-bold text-xs uppercase tracking-widest py-3 px-4 rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Track Shipment Status
                </button>
              </form>

              {trackedOrder && (
                trackedOrder.carrier === 'Royal Mail' ? (
                  <div className="bg-[#fef2f2] border border-red-200 p-4 rounded-2xl shadow-xs space-y-4">
                    <div className="flex justify-between items-center border-b border-red-100 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif font-black text-xs text-[#e1192e]">Royal Mail</span>
                        <span className="text-[8px] bg-red-100 text-[#e1192e] px-1.5 py-0.5 rounded font-bold uppercase">Tracked</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-slate-500">{trackedOrder.trackingId}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[8.5px] text-slate-400 uppercase font-extrabold block">Current Location / Status</span>
                      <strong className="text-[#e1192e] font-black uppercase text-[11px] block">
                        {trackedOrder.fulfillmentStatus === 'Delivered' ? 'DELIVERED & SIGNED' : 
                         trackedOrder.fulfillmentStatus === 'Fulfilled' ? 'IN TRANSIT via Royal Mail' : 'AWAITING COLLECTION'}
                      </strong>
                    </div>

                    <div className="space-y-4 pl-4 border-l border-red-200 relative">
                      {trackedOrder.trackingHistory && trackedOrder.trackingHistory.map((hist, idx) => (
                        <div key={idx} className="text-xs relative">
                          <p className="font-bold text-slate-800">{hist.status}</p>
                          <p className="text-[9px] text-slate-400 font-mono font-bold">{hist.date} • {hist.location}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{hist.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="font-mono text-xs font-bold text-[#071d37]">{trackedOrder.id}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{trackedOrder.fulfillmentStatus}</span>
                    </div>
                    <div className="space-y-3 pl-4 border-l border-slate-200 relative">
                      {getTimelineSteps(trackedOrder).map((step) => (
                        <div key={step.key} className="text-xs">
                          <p className={`font-bold ${step.status === 'completed' ? 'text-[#071d37]' : step.status === 'current' ? 'text-[#dfa047]' : 'text-slate-400'}`}>{step.label}</p>
                          <p className="text-[10px] text-slate-500">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loaded state helper to verify layout safety
  if (!custState) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-[#071d37] animate-spin" />
      </div>
    );
  }

  // Sidebar items configuration
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Layout },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw },
    { id: 'loyalty', label: 'Loyalty Rewards', icon: Award },
    { id: 'referrals', label: 'Referrals', icon: Share2 },
    { id: 'payments', label: 'Payment Methods', icon: CreditCard },
    { id: 'details', label: 'Account Details', icon: User },
    { id: 'addresses', label: 'Delivery Addresses', icon: MapPin },
    { id: 'support', label: 'Help & Support', icon: LifeBuoy }
  ];

  // Subscription item modifiers
  const handleUpdateSubItemQty = (productId: string, newQty: number) => {
    if (newQty < 0) return;
    let updatedItems = [...(custState.subItems || [])];
    if (newQty === 0) {
      updatedItems = updatedItems.filter((item: any) => item.productId !== productId);
    } else {
      updatedItems = updatedItems.map((item: any) => {
        if (item.productId === productId) {
          return { ...item, quantity: newQty };
        }
        return item;
      });
    }
    updateCustState({ ...custState, subItems: updatedItems });
  };

  const handleRemoveSubItem = (productId: string) => {
    const updatedItems = (custState.subItems || []).filter((item: any) => item.productId !== productId);
    updateCustState({ ...custState, subItems: updatedItems });
  };

  const handleAddProductToSub = (product: Product) => {
    const currentItems = [...(custState.subItems || [])];
    const totalCansSelected = currentItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const capacity = custState.subCansCount || 8;
    
    if (totalCansSelected >= capacity) {
      alert(`Your subscription box is currently full (${totalCansSelected}/${capacity} cans). Please decrease the quantity of an existing flavor first, or use the 'Replace flavor' dropdown to swap!`);
      return;
    }
    
    const existingIndex = currentItems.findIndex((item: any) => item.productId === product.id);
    if (existingIndex > -1) {
      currentItems[existingIndex].quantity += 1;
    } else {
      currentItems.push({
        productId: product.id,
        title: product.title,
        quantity: 1,
        image: product.image,
        price: product.price
      });
    }
    updateCustState({ ...custState, subItems: currentItems });
  };

  const handleSwapSubItem = (oldProductId: string, newProduct: Product) => {
    let updatedItems = [...(custState.subItems || [])];
    const existingIndex = updatedItems.findIndex((item: any) => item.productId === newProduct.id);
    const oldItemIndex = updatedItems.findIndex((item: any) => item.productId === oldProductId);
    
    if (oldItemIndex === -1) return;
    const oldQty = updatedItems[oldItemIndex].quantity;
    
    if (existingIndex > -1) {
      if (existingIndex === oldItemIndex) return; // same product, no-op
      updatedItems[existingIndex].quantity += oldQty;
      updatedItems = updatedItems.filter((item: any) => item.productId !== oldProductId);
    } else {
      updatedItems[oldItemIndex] = {
        productId: newProduct.id,
        title: newProduct.title,
        quantity: oldQty,
        image: newProduct.image,
        price: newProduct.price
      };
    }
    updateCustState({ ...custState, subItems: updatedItems });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] py-6 px-4 md:px-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Left Side Navigation Sidebar */}
        <aside className="w-full lg:w-64 bg-[#071d37] text-white rounded-3xl p-6 flex flex-col justify-between shrink-0 shadow-lg">
          <div className="space-y-8">
            {/* Store Brand / Logo */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black text-white tracking-widest uppercase">Pouch Supply</span>
                <span className="w-2 h-2 bg-[#dfa047] rounded-full self-end mb-1"></span>
              </div>
              {/* Golden dots under name matching the mockup */}
              <div className="flex gap-1.5 pl-1.5">
                {[1, 2, 3, 4, 5].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-[#dfa047] rounded-full opacity-80"></span>
                ))}
              </div>
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="space-y-1">
              {sidebarItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#dfa047] text-white shadow-md' 
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Need Help Box & Footer */}
          <div className="mt-12 space-y-6">
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-black uppercase text-[#dfa047] tracking-wider">Need help?</h4>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                We're here for you. Get in touch with our specialist support team.
              </p>
              <button 
                onClick={() => setActiveTab('support')}
                className="w-full bg-white hover:bg-slate-100 text-[#071d37] font-bold text-[10px] uppercase tracking-wider py-2 rounded-xl transition-colors cursor-pointer"
              >
                Contact Support
              </button>
            </div>

            <div className="text-center pt-2 border-t border-white/10">
              <span className="inline-block bg-white/10 text-[9px] border border-white/20 py-0.5 px-2 rounded-full text-slate-200 font-bold mb-1.5">18+ Only</span>
              <p className="text-[9px] text-slate-400 leading-snug">
                Nicotine pouches are for adult consumers only. Please consume responsibly.
              </p>
            </div>
          </div>
        </aside>

        {/* Right Side Main Content Panel */}
        <main className="flex-1 space-y-6">
          
          {/* Top Welcome Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[#071d37]">Welcome back, {loggedInCustomer.name} 👋</h1>
                {ordersCount >= 50 && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-[#dfa047] text-[#071d37] px-2.5 py-0.5 rounded-full shadow-sm animate-pulse shrink-0">
                    <Award className="h-3 w-3 fill-current" /> VIP Customer
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Here's what's happening with your Pouch Supply account today.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => { setActiveTab('orders'); setTrackerInput(myOrders[0]?.id || ''); setTrackedOrder(myOrders[0] || null); }}
                className="flex items-center gap-1.5 text-xs font-bold text-[#071d37] bg-slate-100 hover:bg-slate-200 py-2 px-3.5 rounded-xl transition-all cursor-pointer"
              >
                <Truck className="h-4 w-4" /> Track order
              </button>
              <button 
                onClick={() => setActiveTab('details')}
                className="flex items-center gap-1.5 text-xs font-bold text-[#071d37] bg-slate-100 hover:bg-slate-200 py-2 px-3.5 rounded-xl transition-all cursor-pointer"
              >
                <User className="h-4 w-4" /> Account
              </button>
              <button 
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 py-2 px-3.5 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              
              {/* TAB 1: DASHBOARD (Rich Bento Grid Layout similar to the mockup) */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  
                  {/* Referral Welcome Coupon Banner */}
                  {(() => {
                    const myWelcomeCoupon = discounts.find(d => d.id === `disc-ref-${loggedInCustomer?.id}` && d.status === 'Active');
                    if (myWelcomeCoupon) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                              <Tag className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-black uppercase tracking-wider">Welcome Referral Reward Active</p>
                              <p className="text-[10.5px] text-amber-800 font-medium leading-relaxed">
                                You received a <strong>10% discount coupon</strong> for your first purchase. Copy and enter the code at checkout!
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-white px-4 py-2 border border-amber-100 rounded-2xl shrink-0">
                            <span className="font-mono font-black text-xs text-[#071d37] select-all tracking-wider">{myWelcomeCoupon.title}</span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(myWelcomeCoupon.title);
                                alert('Welcome coupon code copied! Apply it in your cart/checkout.');
                              }}
                              className="p-1 hover:bg-slate-100 text-[#071d37] rounded-lg transition-colors cursor-pointer"
                              title="Copy Coupon Code"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Top Row: Loyalty Scheme Header & Rewards Quick Look */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* VIP Progress Tracker (2/3 width) */}
                    <div className="lg:col-span-2 bg-[#071d37] text-white rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-md">
                      {/* Ambient circle background overlay */}
                      <div className="absolute right-[-40px] top-[-40px] w-48 h-48 rounded-full bg-white/5 border border-white/5" />
                      
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1.5">
                          <h2 className="text-xl font-black uppercase tracking-wider text-white">
                            {ordersCount >= 31 ? "★ PLATINUM MEMBER STATUS" : "STAR PROGRESS SYSTEM"}
                          </h2>
                          <p className="text-slate-300 text-xs leading-relaxed max-w-md">
                            {tierInfo.description}
                          </p>
                        </div>
                        {/* Interactive circle dial */}
                        <div className="relative shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-[#dfa047] bg-black/20 text-center shadow-lg transition-all duration-300 hover:scale-105">
                          <Star className="h-4 w-4 text-[#dfa047] fill-[#dfa047]" />
                          <span className="text-lg font-black text-white mt-0.5">
                            {tierInfo.progressPercentage}%
                          </span>
                          <span className="text-[7px] text-slate-300 uppercase tracking-widest font-extrabold max-w-[80px] truncate">
                            {ordersCount >= 31 ? "Platinum Member" : tierInfo.currentTierName}
                          </span>
                        </div>
                      </div>

                      {/* Stars Milestone Timeline */}
                      <div className="mt-10 mb-8 relative px-6">
                        {/* Overall progress background track */}
                        <div className="relative h-1 bg-white/20 rounded-full">
                          <div 
                            className="absolute left-0 top-0 h-full bg-[#dfa047] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(223,160,71,0.5)]" 
                            style={{ width: `${Math.min(100, (ordersCount / 31) * 100)}%` }} 
                          />
                          
                          {/* Milestone Nodes */}
                          {TIERS.map((t) => {
                            const isUnlocked = ordersCount >= t.required;
                            const pct = (t.required / 31) * 100;
                            return (
                              <div 
                                key={t.level}
                                style={{ left: `${pct}%` }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 z-10 flex flex-col items-center"
                              >
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                  isUnlocked 
                                    ? 'bg-[#dfa047] border-[#dfa047] text-[#071d37] scale-110 shadow-lg' 
                                    : 'bg-[#071d37] border-slate-500 text-slate-400 hover:border-slate-300'
                                }`}>
                                  {t.level === 4 ? (
                                    <Award className={`h-4 w-4 ${isUnlocked ? 'fill-current text-[#071d37]' : 'text-slate-400'}`} />
                                  ) : (
                                    <Star className={`h-3.5 w-3.5 ${isUnlocked ? 'fill-current text-[#071d37]' : 'text-slate-400'}`} />
                                  )}
                                </div>
                                <span className={`text-[8px] font-extrabold mt-1.5 uppercase tracking-wider whitespace-nowrap ${isUnlocked ? 'text-[#dfa047]' : 'text-slate-400'}`}>
                                  {t.name}
                                </span>
                                <span className="text-[7px] text-slate-400 font-bold tracking-tighter">
                                  {t.required} order{t.required > 1 ? 's' : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-300 font-bold uppercase tracking-wider mt-4 px-1">
                        <span>{ordersCount} Completed Order{ordersCount !== 1 ? 's' : ''}</span>
                        <span className="text-[#dfa047] font-black">
                          {ordersCount >= 31 
                            ? "★ PLATINUM MEMBER LEVEL UNLOCKED" 
                            : `${tierInfo.ordersNeededForNext} order${tierInfo.ordersNeededForNext > 1 ? 's' : ''} to reach ${tierInfo.nextTierName}`}
                        </span>
                      </div>

                      <div className="mt-6 flex justify-start">
                        <button 
                          onClick={() => setActiveTab('loyalty')}
                          className="bg-[#dfa047] hover:bg-[#c98e3b] text-[#071d37] font-black text-[10px] uppercase tracking-widest py-2 px-5 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
                        >
                          Ways to earn rewards
                        </button>
                      </div>
                    </div>

                    {/* VIP Loyalty Card Stats Panel (1/3 width) */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Loyalty Rewards</h3>
                          <button onClick={() => setActiveTab('loyalty')} className="text-[10px] font-bold text-[#dfa047] uppercase hover:underline">View all rewards</button>
                        </div>
                        
                        <div className="flex gap-3 items-center bg-[#f4f6f9] p-3 rounded-2xl border border-slate-100">
                          <div className="p-2 bg-[#071d37]/5 text-[#071d37] rounded-xl">
                            <Award className="h-6 w-6 text-[#dfa047]" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#071d37] uppercase">{tierInfo.badgeName}</p>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              {ordersCount >= 31 
                                ? "Platinum status active! Highest loyalty multiplier and priority support." 
                                : "Complete purchases to unlock tiers and trigger premium coupons."}
                            </p>
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-2 text-center pt-2">
                          <div className="bg-slate-50 border border-slate-100 p-2 rounded-2xl flex flex-col justify-center min-w-0">
                            <p className="text-xs font-black text-[#071d37] truncate">{tierInfo.currentTierName}</p>
                            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight mt-0.5">Status Level</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-2 rounded-2xl flex flex-col justify-center min-w-0">
                            <p className="text-base font-black text-[#071d37]">{tierInfo.unlockedCount}</p>
                            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight mt-0.5">Unlocked Perks</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-2 rounded-2xl flex flex-col justify-center min-w-0">
                            <p className="text-base font-black text-[#071d37]">£{(tierInfo.unlockedCount * 12).toFixed(0)}</p>
                            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight mt-0.5">Saved Total</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: Next Order & Subscription Visualizers */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Next Order visualizer */}
                    <div className="lg:col-span-2 space-y-6">
                      
                      {/* Next Order details card */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs relative">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                          <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider flex items-center gap-1.5">
                            <Truck className="h-4.5 w-4.5 text-[#dfa047]" />
                            Your next order
                          </h3>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-150 py-1 px-3 rounded-full">Scheduled</span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-xs font-semibold py-2">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Delivering On</p>
                            <p className="text-xs font-extrabold text-[#071d37] mt-0.5">{custState.nextDelivery}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Box Items</p>
                            <p className="text-xs font-extrabold text-[#071d37] mt-0.5">{custState.subCansCount} canisters</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Total Price</p>
                            <p className="text-xs font-extrabold text-slate-900 mt-0.5">£{custState.subPrice.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 mt-4">
                          <button 
                            onClick={() => { setSelectedOrderDetails(myOrders[0] || null); }}
                            className="flex-1 bg-[#071d37] hover:bg-[#0c2e56] text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors cursor-pointer text-center"
                          >
                            View Order Details
                          </button>
                          <button 
                            onClick={() => setActiveTab('subscriptions')}
                            className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-[#071d37] font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors cursor-pointer text-center"
                          >
                            Manage Subscription
                          </button>
                        </div>
                      </div>

                      {/* Active subscription summary card */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                          <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider flex items-center gap-1.5">
                            <RefreshCw className="h-4.5 w-4.5 text-[#dfa047]" />
                            Your active subscription
                          </h3>
                          <span className="text-[10px] font-bold text-[#071d37] bg-emerald-50 text-emerald-700 py-1 px-3 rounded-full border border-emerald-100">Active</span>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 items-center">
                          {/* Left: overlapping canisters preview */}
                          <div className="flex -space-x-4 shrink-0">
                            {(() => {
                              const images = (custState.subItems || [])
                                .map((item: any) => item.image)
                                .filter(Boolean);
                              const defaults = [
                                'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=120&q=80',
                                'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=120&q=80',
                                'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=120&q=80'
                              ];
                              const subscriptionImages = images.length > 0 ? [...images, ...defaults].slice(0, 3) : defaults;
                              return subscriptionImages.map((imgSrc, i) => (
                                <img 
                                  key={i} 
                                  src={imgSrc} 
                                  className="w-14 h-14 object-cover rounded-full border-2 border-white shadow-md bg-slate-100" 
                                  alt="canister preview" 
                                  referrerPolicy="no-referrer"
                                />
                              ));
                            })()}
                          </div>

                          <div className="flex-1 space-y-1 text-center md:text-left">
                            <h4 className="text-sm font-black text-[#071d37] uppercase tracking-wide">{custState.subPlan.toUpperCase()} BOX PLAN</h4>
                            <p className="text-xs text-slate-500">{custState.subCansCount} items • Deliver {custState.subFrequency}</p>
                            <p className="text-xs font-bold text-[#dfa047]">£{custState.subPrice.toFixed(2)} per delivery • Next charge: {custState.nextPayment}</p>
                          </div>

                          <div className="flex md:flex-col gap-2 w-full md:w-auto shrink-0">
                            <button 
                              onClick={() => setActiveTab('subscriptions')}
                              className="flex-1 md:w-44 bg-white hover:bg-slate-50 border border-slate-200 text-[#071d37] font-bold text-xs py-2 rounded-xl cursor-pointer text-center"
                            >
                              Manage Plan
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Side Column: Free Rewards Redemptions list & Friends Invites */}
                    <div className="space-y-6">
                      
                      {/* Redeem rewards list */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Redeem Your Free Gifts</h3>
                          <p className="text-slate-400 text-[10px] mt-0.5">Select a premium unlocked loyalty gift below.</p>
                        </div>

                        <div className="space-y-3">
                          {custState.unlockedRewards.map((rew: any) => (
                            <div key={rew.id} className="flex items-center justify-between p-2.5 bg-[#f4f6f9] rounded-2xl border border-slate-100">
                              <div className="flex gap-2 items-center">
                                <div className="p-1.5 bg-[#071d37]/5 text-[#dfa047] rounded-xl">
                                  <Tag className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-black text-[#071d37] truncate">{rew.title}</p>
                                  <p className="text-[9px] text-slate-400 truncate">{rew.desc}</p>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  if (rew.redeemed) return;
                                  const updatedRewards = custState.unlockedRewards.map((r: any) => 
                                    r.id === rew.id ? { ...r, redeemed: true } : r
                                  );
                                  updateCustState({ ...custState, unlockedRewards: updatedRewards });
                                  alert(`Successfully redeemed! Use promo code "${rew.code}" at checkout or enjoy automatically in your next sub delivery.`);
                                }}
                                className={`text-[9px] font-black uppercase py-1.5 px-3 rounded-lg border cursor-pointer transition-colors ${
                                  rew.redeemed 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-150 cursor-not-allowed' 
                                    : 'bg-[#071d37] text-white hover:bg-[#dfa047] border-slate-200'
                                }`}
                              >
                                {rew.redeemed ? 'Redeemed' : 'Redeem'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Invite Friends Referral Card */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Invite your friends</h3>
                          <p className="text-slate-500 text-[10.5px] leading-relaxed">
                            Give your friends <strong className="text-[#071d37]">10% off</strong> their first order and get <strong className="text-emerald-700">£5.00 credit</strong> when they subscribe.
                          </p>
                        </div>

                        {/* Copyable referral input */}
                        <div className="flex items-center gap-2 bg-[#f4f6f9] p-2.5 rounded-2xl border border-slate-100">
                          <input 
                            type="text" 
                            readOnly 
                            value={custState.referralCode} 
                            className="bg-transparent text-slate-600 text-[10px] font-semibold flex-1 outline-none select-all" 
                          />
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(custState.referralCode);
                              alert('Referral link copied to clipboard!');
                            }}
                            className="p-1.5 hover:bg-slate-200 text-[#071d37] rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>

                        <button 
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({
                                title: 'Join Pouch Supply',
                                text: 'Join me on Pouch Supply for the ultimate subscription box experience!',
                                url: custState.referralCode
                              }).catch(() => {});
                            } else {
                              navigator.clipboard.writeText(custState.referralCode);
                              alert('Referral link copied! Share it with your friends.');
                            }
                          }}
                          className="w-full bg-[#071d37] hover:bg-[#0c2e56] text-white font-bold text-xs uppercase py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Share2 className="h-4 w-4" />
                          Share your link
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* Bottom Row: Recent Order Log */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                      <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Recent Order Log</h3>
                      <button onClick={() => setActiveTab('orders')} className="text-[10px] font-bold text-[#dfa047] uppercase hover:underline">View all orders</button>
                    </div>

                    {myOrders.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-xs text-slate-400">No purchase records registered yet.</p>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setSelectedOrderDetails(myOrders[0])}
                        className="flex justify-between items-center bg-[#f4f6f9] hover:bg-slate-100 p-4 rounded-2xl border border-slate-100 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 font-mono font-bold text-xs">
                            #PS
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#071d37]">Order {myOrders[0].id}</p>
                            <p className="text-[10px] text-slate-500">{myOrders[0].date} • {myOrders[0].items.reduce((sum, item) => sum + item.quantity, 0)} canisters</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase">{myOrders[0].fulfillmentStatus}</span>
                          <span className="text-xs font-black text-[#071d37]">£{myOrders[0].total.toFixed(2)}</span>
                          <ChevronRight className="h-4.5 w-4.5 text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Horizontal Trust Badges row matching mockup */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="bg-white border border-slate-200 py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-xs">
                      <Tag className="h-4.5 w-4.5 text-[#dfa047]" />
                      <span className="text-xs font-black text-[#071d37] uppercase tracking-wider">Save up to £55/mo</span>
                    </div>
                    <div className="bg-white border border-slate-200 py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-xs">
                      <Package className="h-4.5 w-4.5 text-[#dfa047]" />
                      <span className="text-xs font-black text-[#071d37] uppercase tracking-wider">Discreet delivery</span>
                    </div>
                    <div className="bg-white border border-slate-200 py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-xs">
                      <Clock className="h-4.5 w-4.5 text-[#dfa047]" />
                      <span className="text-xs font-black text-[#071d37] uppercase tracking-wider">Cancel anytime</span>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: ORDERS (Order history list and detailed shipment timeline) */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  
                  {/* Shipment visualizer widget */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Real-Time Order Tracker</h3>
                        <p className="text-slate-400 text-[10.5px]">Provide your Order ID code to visualize shipping history logs.</p>
                      </div>
                      <form onSubmit={handleTrackOrder} className="flex gap-2 w-full md:w-auto">
                        <input
                          type="text"
                          placeholder="e.g. PS48884"
                          value={trackerInput}
                          onChange={(e) => setTrackerInput(e.target.value)}
                          className="text-xs font-mono font-bold border border-slate-200 px-3 py-2 rounded-xl focus:ring-2 focus:ring-[#071d37] focus:outline-none uppercase bg-slate-50/50"
                        />
                        <button type="submit" className="bg-[#dfa047] text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer">Track</button>
                      </form>
                    </div>

                    {trackerError && <p className="text-xs text-rose-500 font-bold">{trackerError}</p>}

                    {trackedOrder ? (
                      trackedOrder.carrier === 'Royal Mail' ? (
                        <div className="bg-[#fef2f2] border-2 border-[#e1192e] rounded-3xl overflow-hidden shadow-xs">
                          {/* Royal Mail Brand Header */}
                          <div className="bg-[#e1192e] p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-serif font-black tracking-widest text-lg">Royal Mail</span>
                              <span className="text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Track & Trace Live
                              </span>
                            </div>
                            <div className="text-left sm:text-right">
                              <span className="text-[8px] text-red-100 block uppercase font-extrabold">TRACKING NUMBER</span>
                              <span className="font-mono font-black text-sm tracking-wider text-white select-all">{trackedOrder.trackingId}</span>
                            </div>
                          </div>

                          {/* Royal Mail Content Area */}
                          <div className="p-5 sm:p-6 space-y-6">
                            {/* Status Quick Look */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-red-100">
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Current Status</span>
                                <span className={`text-sm font-black uppercase tracking-wide flex items-center gap-1.5 mt-0.5 ${
                                  trackedOrder.fulfillmentStatus === 'Delivered' ? 'text-emerald-600' :
                                  trackedOrder.fulfillmentStatus === 'Fulfilled' ? 'text-indigo-600 animate-pulse' : 'text-[#dfa047]'
                                }`}>
                                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-current" />
                                  {trackedOrder.fulfillmentStatus === 'Delivered' ? 'Delivered & Signed' : 
                                   trackedOrder.fulfillmentStatus === 'Fulfilled' ? 'In Transit via Royal Mail' : 'Awaiting Collection'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Last Scanned Depot</span>
                                <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                                  {trackedOrder.trackingHistory && trackedOrder.trackingHistory.length > 0
                                    ? trackedOrder.trackingHistory[0].location
                                    : 'Pouch Supply Hub, London MC'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Estimated Arrival</span>
                                <span className="text-xs font-black text-slate-900 mt-0.5 block">
                                  {trackedOrder.fulfillmentStatus === 'Delivered' ? 'Delivered successfully' : 'Within 24 Hours'}
                                </span>
                              </div>
                            </div>

                            {/* Royal Mail Progress Timeline */}
                            <div className="relative pt-2 pb-4">
                              <div className="absolute top-[2.1rem] left-8 right-8 h-1 bg-slate-200" />
                              <div className="absolute top-[2.1rem] left-8 h-1 bg-[#e1192e] transition-all duration-500" style={{
                                width: trackedOrder.fulfillmentStatus === 'Delivered' ? 'calc(100% - 64px)' :
                                       trackedOrder.fulfillmentStatus === 'Fulfilled' ? '50%' : '0%'
                              }} />

                              <div className="flex justify-between items-start text-center relative z-10">
                                {[
                                  { id: 'placed', label: 'Accepted', desc: 'Package registered', status: 'completed' },
                                  { id: 'transit', label: 'In Transit', desc: 'Outward MC hub', status: trackedOrder.fulfillmentStatus !== 'Unfulfilled' ? 'completed' : 'pending' },
                                  { id: 'delivered', label: 'Delivered', desc: 'At destination', status: trackedOrder.fulfillmentStatus === 'Delivered' ? 'completed' : 'pending' }
                                ].map((pt, idx) => (
                                  <div key={idx} className="flex flex-col items-center flex-1">
                                    <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center transition-all ${
                                      pt.status === 'completed' 
                                        ? 'bg-[#e1192e] border-[#ffd6d9] text-white shadow-xs' 
                                        : 'bg-white border-slate-200 text-slate-400'
                                    }`}>
                                      {pt.status === 'completed' ? <Check className="h-4.5 w-4.5 font-bold" /> : <Clock className="h-4.5 w-4.5" />}
                                    </div>
                                    <div className="mt-2.5">
                                      <span className={`text-[10.5px] font-black uppercase block tracking-wider ${pt.status === 'completed' ? 'text-[#e1192e]' : 'text-slate-400'}`}>{pt.label}</span>
                                      <span className="text-[8.5px] text-slate-400 block mt-0.5">{pt.desc}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Detailed Checkpoints */}
                            <div className="space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-red-50 text-xs">
                              <div className="flex justify-between items-center border-b border-red-100 pb-2">
                                <span className="font-extrabold text-[#e1192e] uppercase text-[10px] tracking-wider">Royal Mail Routing History</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Live Updates via API</span>
                              </div>
                              
                              <div className="space-y-4 pt-1">
                                {trackedOrder.trackingHistory && trackedOrder.trackingHistory.map((hist, idx) => (
                                  <div key={idx} className="flex gap-4 items-start relative">
                                    {idx < trackedOrder.trackingHistory!.length - 1 && (
                                      <div className="absolute left-2.5 top-6 bottom-[-16px] w-0.5 bg-red-100" />
                                    )}
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                      idx === 0 ? 'bg-[#e1192e] text-white ring-4 ring-red-100 animate-pulse' : 'bg-red-50 text-[#e1192e]'
                                    }`}>
                                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                    </div>
                                    <div className="space-y-0.5 flex-1">
                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                                        <span className="font-black text-slate-800 text-[11px] uppercase tracking-wide">{hist.status}</span>
                                        <span className="text-[9px] font-mono text-slate-400 font-bold">{hist.date}</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                                        <MapPin className="h-3.5 w-3.5 text-red-400" /> {hist.location}
                                      </p>
                                      <p className="text-[10.5px] text-slate-600 leading-normal mt-1">{hist.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Sandbox Simulator Interface */}
                            {onUpdateOrder && (
                              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 border border-slate-800">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Carrier Sandbox Service Simulation</span>
                                  </div>
                                  <span className="text-[9px] bg-slate-800 text-slate-300 font-bold py-0.5 px-2 rounded">TESTING PANEL</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-normal">
                                  Since this is a sandbox environment, you can act as the **Royal Mail delivery agent** to push transit state updates and test how customers track their pouches.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {trackedOrder.fulfillmentStatus === 'Unfulfilled' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedOrder: Order = {
                                          ...trackedOrder,
                                          fulfillmentStatus: 'Fulfilled',
                                          trackingHistory: [
                                            {
                                              status: 'Processed through local sorting office',
                                              date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                              location: 'Heathrow Worldwide Distribution Centre',
                                              description: 'Your package was processed at our primary MC hub and is now being dispatched to your nearest local mail delivery office.'
                                            },
                                            ...(trackedOrder.trackingHistory || [])
                                          ]
                                        };
                                        onUpdateOrder(updatedOrder);
                                        setTrackedOrder(updatedOrder);
                                      }}
                                      className="bg-[#e1192e] hover:bg-red-700 text-white text-[9.5px] font-black uppercase tracking-widest py-2 px-4 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                                    >
                                      🚚 Dispatch Package (Mark In Transit)
                                    </button>
                                  )}

                                  {trackedOrder.fulfillmentStatus === 'Fulfilled' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedOrder: Order = {
                                          ...trackedOrder,
                                          fulfillmentStatus: 'Delivered',
                                          trackingHistory: [
                                            {
                                              status: 'Delivered and Signed For',
                                              date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                              location: trackedOrder.destination.split(',')[0] || 'Customer Destination',
                                              description: 'Delivered. Handed to customer at destination address and signed electronically.'
                                            },
                                            ...(trackedOrder.trackingHistory || [])
                                          ]
                                        };
                                        onUpdateOrder(updatedOrder);
                                        setTrackedOrder(updatedOrder);
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] font-black uppercase tracking-widest py-2 px-4 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                                    >
                                      📦 Deliver Package (Mark Delivered)
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Generate and send simulated alert/update email
                                      const notificationEmail = {
                                        to: trackedOrder.customerEmail,
                                        subject: `Royal Mail Delivery Update - Order #${trackedOrder.id}`,
                                        preview: `Your shipment with Royal Mail reference ${trackedOrder.trackingId} has been updated: current status is ${trackedOrder.fulfillmentStatus === 'Delivered' ? 'Delivered' : 'In Transit'}.`,
                                        body: `
                                          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                                            <div style="background-color: #e1192e; padding: 20px; text-align: center; color: white;">
                                              <h2 style="margin: 0; font-size: 18px;">ROYAL MAIL SERVICE ALERT</h2>
                                            </div>
                                            <div style="padding: 20px; font-size: 13px; line-height: 1.5; color: #334155;">
                                              <p>Hello ${trackedOrder.customerName},</p>
                                              <p>There is a new update on your <strong>Pouch Supply</strong> shipment tracked with Royal Mail reference <strong>${trackedOrder.trackingId}</strong>.</p>
                                              <div style="background-color: #f8fafc; border-left: 4px solid #e1192e; padding: 12px; margin: 15px 0;">
                                                <strong>Current Status:</strong> ${trackedOrder.fulfillmentStatus === 'Delivered' ? 'DELIVERED & SIGNED' : 'IN TRANSIT'}<br/>
                                                <strong>Scan Location:</strong> ${trackedOrder.trackingHistory && trackedOrder.trackingHistory[0] ? trackedOrder.trackingHistory[0].location : 'En Route'}
                                              </div>
                                              <p>If you have questions, visit your account dashboard or contact <a href="mailto:scott@pouch-supply.com" style="color: #dc2626; text-decoration: none;">scott@pouch-supply.com</a>.</p>
                                            </div>
                                          </div>
                                        `,
                                        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      };
                                      
                                      try {
                                        const stored = localStorage.getItem('ps_simulated_emails');
                                        const emails = stored ? JSON.parse(stored) : [];
                                        localStorage.setItem('ps_simulated_emails', JSON.stringify([notificationEmail, ...emails]));
                                        window.dispatchEvent(new CustomEvent('ps-emails-updated'));
                                      } catch (e) {}
                                      alert("Simulated Royal Mail email update alert sent!");
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9.5px] font-black uppercase tracking-widest py-2 px-4 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                                  >
                                    ✉️ Send Status Alert Email
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="bg-[#f4f6f9] border border-slate-100 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">Currently Tracking</span>
                              <p className="font-bold text-[#071d37] mt-0.5">{trackedOrder.id}</p>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">Recipient Address</span>
                              <p className="font-bold text-slate-600 mt-0.5">{trackedOrder.destination}</p>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">Courier Status</span>
                              <p className="text-emerald-700 font-black mt-0.5">{trackedOrder.fulfillmentStatus.toUpperCase()}</p>
                            </div>
                          </div>

                          {/* Interactive Timeline layout */}
                          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-2 pb-4">
                            <div className="absolute hidden md:block left-6 right-6 top-[2rem] h-0.5 bg-slate-200" />
                            {getTimelineSteps(trackedOrder).map((step) => {
                              const isCompleted = step.status === 'completed';
                              const isCurrent = step.status === 'current';
                              return (
                                <div key={step.key} className="flex md:flex-col items-center gap-3 flex-1 text-left md:text-center z-10 w-full">
                                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isCompleted ? 'bg-[#071d37] border-[#071d37] text-white' : isCurrent ? 'bg-white border-[#dfa047] text-[#dfa047] animate-pulse' : 'bg-white border-slate-200 text-slate-400'
                                  }`}>
                                    {isCompleted ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-[#071d37]">{step.label}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{step.description}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">Search for an order ID above to preview your custom shipping timelines.</p>
                    )}
                  </div>

                  {/* Full Order history table */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Purchase History List</h3>
                    
                    {myOrders.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">You haven't placed any order transactions yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {myOrders.map(order => (
                          <div key={order.id} className="bg-[#f4f6f9] border border-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-all">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs text-[#071d37] font-mono">{order.id}</span>
                                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">{order.fulfillmentStatus}</span>
                              </div>
                              <p className="text-[10px] text-slate-500">{order.date} • {order.items.length} unique lines • {order.deliveryMethod}</p>
                            </div>
                            <div className="flex sm:flex-col items-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                              <span className="text-xs font-black text-slate-900">£{order.total.toFixed(2)}</span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setSelectedOrderDetails(order)}
                                  className="text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-700 py-1 px-2.5 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                                >
                                  <Eye className="h-3 w-3" /> View Order
                                </button>
                                <button 
                                  onClick={() => setSelectedOrderDetails(order)}
                                  className="text-[10px] font-bold text-[#071d37] bg-white border border-slate-200 py-1 px-2.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-all"
                                >
                                  Invoice
                                </button>
                                <button 
                                  onClick={() => { setTrackerInput(order.id); setTrackedOrder(order); }}
                                  className="text-[10px] font-bold text-white bg-[#071d37] py-1 px-2.5 rounded-lg cursor-pointer hover:bg-[#dfa047] transition-all"
                                >
                                  Track
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 3: SUBSCRIPTIONS (Interactive controls for active sub, swaps, pause/resume) */}
              {activeTab === 'subscriptions' && (
                <div className="space-y-6">
                  
                  {/* Subscription management console */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Configure Subscription Plan</h3>
                        <p className="text-slate-400 text-[10.5px] mt-0.5">Pause, swap, reschedule or upgrade your box items in real-time.</p>
                      </div>
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${custState.subStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {custState.subStatus.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Form inputs */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Box Size (Plan tier)</label>
                          <select 
                            value={custState.subPlan} 
                            onChange={(e) => {
                              const plan = e.target.value;
                              let cans = 8, price = 35.99;
                              if (plan === 'lite') { cans = 6; price = 27.99; }
                              else if (plan === 'pro') { cans = 10; price = 40.99; }
                              else if (plan === 'ultimate') { cans = 12; price = 46.99; }

                              let currentSubItems = [...(custState.subItems || [])];
                              if (currentSubItems.length === 0) {
                                currentSubItems = allProducts.length >= 2 ? [
                                  { productId: allProducts[0].id, title: allProducts[0].title, quantity: Math.floor(cans / 2) || 3, image: allProducts[0].image, price: allProducts[0].price },
                                  { productId: allProducts[1].id, title: allProducts[1].title, quantity: Math.ceil(cans / 2) || 3, image: allProducts[1].image, price: allProducts[1].price }
                                ] : [
                                  { productId: 'prod-1', title: 'VELO Freeze Max', quantity: Math.floor(cans / 2) || 3, image: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=120&q=80', price: 4.50 },
                                  { productId: 'prod-2', title: 'ZYN Cool Mint', quantity: Math.ceil(cans / 2) || 3, image: 'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=120&q=80', price: 4.50 }
                                ];
                              } else {
                                const totalCurrent = currentSubItems.reduce((sum, item) => sum + item.quantity, 0);
                                if (totalCurrent !== cans) {
                                  if (cans > totalCurrent) {
                                    currentSubItems[0].quantity += (cans - totalCurrent);
                                  } else {
                                    let diff = totalCurrent - cans;
                                    for (let i = currentSubItems.length - 1; i >= 0; i--) {
                                      if (currentSubItems[i].quantity > diff) {
                                        currentSubItems[i].quantity -= diff;
                                        break;
                                      } else {
                                        diff -= (currentSubItems[i].quantity - 1);
                                        currentSubItems[i].quantity = 1;
                                      }
                                    }
                                  }
                                }
                              }

                              updateCustState({ ...custState, subPlan: plan, subCansCount: cans, subPrice: price, subItems: currentSubItems });
                            }}
                            className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37] bg-white outline-none"
                          >
                            <option value="lite">LITE (6 Canisters - £27.99)</option>
                            <option value="core">CORE (8 Canisters - £35.99)</option>
                            <option value="pro">PRO (10 Canisters - £40.99)</option>
                            <option value="ultimate">ULTIMATE (12 Canisters - £46.99)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Delivery Frequency</label>
                          <select 
                            value={custState.subFrequency} 
                            onChange={(e) => updateCustState({ ...custState, subFrequency: e.target.value })}
                            className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37] bg-white outline-none"
                          >
                            <option value="Every 2 Weeks">Every 2 Weeks (Fast delivery)</option>
                            <option value="Every 4 Weeks">Every 4 Weeks (Most popular)</option>
                            <option value="Every 6 Weeks">Every 6 Weeks</option>
                            <option value="Every 8 Weeks">Every 8 Weeks</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Next Payment</span>
                            <p className="font-extrabold text-[#071d37] mt-1">{custState.nextPayment}</p>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Delivery</span>
                            <p className="font-extrabold text-[#071d37] mt-1">{custState.nextDelivery}</p>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Visual controls */}
                      <div className="bg-[#f4f6f9] p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimated box value</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-[#071d37]">£{custState.subPrice.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-500 font-bold">/ delivery</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Includes personalized nicotine strength choices, custom flavor ratios, priority shipping, and complimentary VIP loyalty rewards.
                          </p>
                        </div>

                        <div className="flex gap-2 mt-6">
                          <button
                            onClick={() => {
                              const toggleStatus = custState.subStatus === 'Active' ? 'Paused' : 'Active';
                              updateCustState({ ...custState, subStatus: toggleStatus });
                            }}
                            className={`flex-1 font-bold text-xs uppercase py-2.5 rounded-xl border transition-all cursor-pointer text-center ${
                              custState.subStatus === 'Active' 
                                ? 'bg-white border-slate-200 text-[#071d37] hover:bg-slate-50' 
                                : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {custState.subStatus === 'Active' ? 'Pause subscription' : 'Resume subscription'}
                          </button>
                          
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to cancel your box subscription? All pending free gifts will be lost.')) {
                                updateCustState({ ...custState, subStatus: 'Cancelled' });
                              }
                            }}
                            className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs uppercase px-4 py-2.5 rounded-xl cursor-pointer text-center"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Interactive product Swapper & Customizer */}
                  <div className="space-y-6">
                    {/* Part 1: Current Box Composition */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div>
                            <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Your Current Box Lineup</h3>
                            <p className="text-slate-400 text-[10.5px]">Adjust canister quantities or swap flavors to customize your recurring delivery.</p>
                          </div>
                          {(() => {
                            const subItems = custState.subItems || [];
                            const totalSelected = subItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
                            const capacity = custState.subCansCount || 8;
                            const isExact = totalSelected === capacity;
                            const isOver = totalSelected > capacity;
                            
                            return (
                              <div className="text-right shrink-0">
                                <span className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                  isExact ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  isOver ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  Box Capacity: {totalSelected} / {capacity} Cans
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Progress Bar Meter */}
                        {(() => {
                          const subItems = custState.subItems || [];
                          const totalSelected = subItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
                          const capacity = custState.subCansCount || 8;
                          const pct = Math.min(100, (totalSelected / capacity) * 100);
                          const isExact = totalSelected === capacity;
                          const isOver = totalSelected > capacity;
                          
                          return (
                            <div className="mt-3">
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    isExact ? 'bg-emerald-500' :
                                    isOver ? 'bg-rose-500 animate-pulse' : 'bg-[#dfa047]'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              {/* Alert Warnings */}
                              {!isExact && (
                                <div className={`mt-2.5 flex items-start gap-2 p-3.5 rounded-2xl text-[11px] leading-relaxed border ${
                                  isOver 
                                    ? 'bg-rose-50 border-rose-100 text-rose-700' 
                                    : 'bg-amber-50 border-amber-100 text-amber-700'
                                }`}>
                                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                  <div>
                                    {isOver ? (
                                      <p><strong>Limit Exceeded:</strong> Your selected canisters ({totalSelected}) exceed your <strong>{capacity} Cans</strong> subscription plan. Please reduce quantities to complete your box customizations.</p>
                                    ) : (
                                      <p><strong>Fill Your Box:</strong> You have selected {totalSelected} of your allowed <strong>{capacity} Cans</strong>. Please increase quantities or add new flavors from the catalog below to make the most of your delivery!</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Current Items List */}
                      {(!custState.subItems || custState.subItems.length === 0) ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          Your active subscription box is empty. Choose premium flavors below to fill it!
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {custState.subItems.map((item: any) => (
                            <div key={item.productId} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-slate-300 transition-all animate-fade-in">
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <img 
                                  src={item.image} 
                                  alt={item.title} 
                                  className="w-12 h-12 object-cover rounded-xl bg-white border border-slate-200 shrink-0 shadow-xs" 
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0">
                                  <h4 className="text-xs font-black text-[#071d37] truncate">{item.title}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">£{item.price ? item.price.toFixed(2) : '4.50'} • Recurring Item</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-2.5 sm:pt-0">
                                {/* Swap dropdown list */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 hidden md:inline">Swap:</span>
                                  <select
                                    value={item.productId}
                                    onChange={(e) => {
                                      const selectedProd = allProducts.find(p => p.id === e.target.value);
                                      if (selectedProd) {
                                        handleSwapSubItem(item.productId, selectedProd);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-[#071d37] bg-white border border-slate-200 py-1.5 px-2.5 rounded-xl hover:border-[#dfa047] transition-all cursor-pointer outline-none focus:ring-1 focus:ring-[#071d37] max-w-[150px]"
                                  >
                                    <option value={item.productId}>🔄 Swap with...</option>
                                    {allProducts.filter(p => p.id !== item.productId).map(p => (
                                      <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Quantity Controller */}
                                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
                                  <button
                                    onClick={() => handleUpdateSubItemQty(item.productId, item.quantity - 1)}
                                    className="w-7 h-7 flex items-center justify-center text-xs font-bold text-[#071d37] hover:bg-slate-100 rounded-lg cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-extrabold text-[#071d37] min-w-[16px] text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => handleUpdateSubItemQty(item.productId, item.quantity + 1)}
                                    className="w-7 h-7 flex items-center justify-center text-xs font-bold text-[#071d37] hover:bg-slate-100 rounded-lg cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleRemoveSubItem(item.productId)}
                                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                  title="Remove from Box"
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Part 2: Add other available canisters */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Add Premium Flavors to Box</h3>
                        <p className="text-slate-400 text-[10.5px]">Select any of these premium nicotine pouch brands to add to your recurring deliveries.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {allProducts.filter(prod => !(custState.subItems || []).some((item: any) => item.productId === prod.id)).map(prod => (
                          <div key={prod.id} className="flex gap-3 bg-[#f4f6f9] border border-slate-100 p-3 rounded-2xl relative hover:shadow-xs transition-all">
                            <img 
                              src={prod.image} 
                              alt={prod.title} 
                              className="w-14 h-14 object-cover rounded-xl bg-white border border-slate-100 shrink-0" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] text-[#dfa047] font-bold uppercase tracking-wider">{prod.vendor}</span>
                                <h4 className="text-xs font-black text-[#071d37] truncate">{prod.title}</h4>
                              </div>
                              <span className="text-xs font-extrabold text-slate-800 mt-1">£{prod.price.toFixed(2)}</span>
                            </div>
                            
                            <button
                              onClick={() => handleAddProductToSub(prod)}
                              className="absolute right-3 bottom-3 text-[10px] font-bold text-[#071d37] bg-white border border-slate-200 py-1 px-2.5 rounded-lg hover:border-[#dfa047] transition-all cursor-pointer"
                            >
                              + Add to Box
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: LOYALTY REWARDS (Complete rewards list, vouchers, status info) */}
              {activeTab === 'loyalty' && (
                <div className="space-y-6">
                  
                  {/* Loyalty header stats */}
                  <div className="bg-[#071d37] text-white rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 shadow-lg">
                    <div className="absolute left-[-20px] top-[-20px] w-40 h-40 rounded-full bg-white/5 border border-white/5" />
                    
                    <div className="space-y-2 text-center md:text-left">
                      <span className="text-[10px] font-bold bg-[#dfa047] text-[#071d37] py-1 px-3 rounded-full uppercase tracking-wider inline-block">Loyalty Club</span>
                      <h2 className="text-2xl font-black uppercase text-white tracking-wide">Pouch Supply VIP Scheme</h2>
                      <p className="text-slate-300 text-xs max-w-lg leading-relaxed">
                        No complex formulas, math points, or expiration clocks. Simply complete shop orders to trigger direct premium gifts, complimentary deliveries, and discount credit codes.
                      </p>
                    </div>

                    <div className="bg-white/10 border border-white/20 p-5 rounded-3xl text-center min-w-[160px]">
                      <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Rewards Unlocked</p>
                      <p className="text-3xl font-black text-[#dfa047] mt-1">{tierInfo.unlockedCount} Gift{tierInfo.unlockedCount !== 1 ? 's' : ''}</p>
                      <span className="text-[9px] text-slate-400 block pt-1">{tierInfo.currentTierName} Status</span>
                    </div>
                  </div>

                  {/* Complete rewards list based on new Tier System */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Your Tier Milestone Rewards</h3>
                      <p className="text-slate-500 text-xs mt-0.5">Place orders to progress through tiers and unlock instant vouchers, free cans, free shipping, and merchandise.</p>
                    </div>

                    <div className="space-y-8">
                      {[
                        {
                          id: "bronze",
                          badge: "🥉",
                          name: "Bronze Member",
                          range: "Orders 1–5",
                          intro: "Every new subscriber starts here.",
                          unlockMsg: "Unlock: Silver Member",
                          benefits: [
                            "Bronze Member Badge 🥉",
                            "Automatic Loyalty Tracking 📊"
                          ],
                          milestones: [
                            { order: 1, reward: "Members receive 10% OFF", code: "BRONZE1" },
                            { order: 3, reward: "FREE can of your choice", code: "BRONZE3" },
                            { order: 5, reward: "Free Express Delivery on your next order", code: "BRONZE5" }
                          ]
                        },
                        {
                          id: "silver",
                          badge: "🥈",
                          name: "Silver Member",
                          range: "Orders 6–15",
                          intro: "Benefits unlocked upon reaching Order 6.",
                          unlockMsg: "Unlock: Gold Member",
                          benefits: [
                            "Silver Account Badge 🥈",
                            "Early Access to New Flavours 🎁",
                            "Exclusive Subscriber-Only Offers 💰"
                          ],
                          milestones: [
                            { order: 7, reward: "FREE can 🥫", code: "SILVER7" },
                            { order: 9, reward: "£5 Store Credit 🎁", code: "SILVER9" },
                            { order: 11, reward: "FREE can 🥫", code: "SILVER11" },
                            { order: 13, reward: "Exclusive Pouch Supply merchandise (stickers, keyring, bottle opener, etc.) 🎁", code: "SILVER13" },
                            { order: 15, reward: "2 FREE cans 🥫", code: "SILVER15" }
                          ]
                        },
                        {
                          id: "gold",
                          badge: "🥇",
                          name: "Gold Member",
                          range: "Orders 16–30",
                          intro: "Elite member status with priority benefits and multiple rewards.",
                          unlockMsg: "Unlock: Platinum Member",
                          benefits: [
                            "Gold Badge 🥇",
                            "Priority Access to Limited Editions ⭐",
                            "Birthday Reward 🎉",
                            "Exclusive Promotions 💰"
                          ],
                          milestones: [
                            { order: 17, reward: "20% off your purchase 🎁", code: "GOLD17" },
                            { order: 19, reward: "2 FREE cans 🥫", code: "GOLD19" },
                            { order: 21, reward: "Mystery Reward (chosen by Pouch Supply) 🎁", code: "GOLD21" },
                            { order: 23, reward: "2 FREE cans 🥫", code: "GOLD23" },
                            { order: 25, reward: "Premium Pouch Supply merchandise 👕", code: "GOLD25" },
                            { order: 27, reward: "20% off your purchase 🎁", code: "GOLD27" },
                            { order: 29, reward: "2 FREE cans 🥫", code: "GOLD29" },
                            { order: 30, reward: "Unlock Platinum Member 🏆", code: "GOLD30" }
                          ]
                        },
                        {
                          id: "platinum",
                          badge: "💎",
                          name: "Platinum Member",
                          range: "31+ Orders",
                          intro: "Unlocks at 31 completed subscription orders.",
                          unlockMsg: "Ultimate Status reached!",
                          benefits: [
                            "Platinum Badge 💎",
                            "Highest Loyalty Multiplier 👑",
                            "First Access to All New Launches 🚀",
                            "Quarterly Surprise Rewards 🎁",
                            "Priority Customer Support ⭐"
                          ],
                          milestones: [
                            { order: 31, reward: "Odd order reward: Choose 3 FREE cans, £10 Store Credit, Free Priority Delivery, Exclusive merchandise, or Mystery Reward", code: "PLATINUM_ODD" }
                          ]
                        }
                      ].map((tier) => {
                        const isTierActive = (tier.id === "bronze") ||
                          (tier.id === "silver" && ordersCount >= 6) ||
                          (tier.id === "gold" && ordersCount >= 16) ||
                          (tier.id === "platinum" && ordersCount >= 31);

                        return (
                          <div 
                            key={tier.id}
                            className={`border rounded-2xl p-5 space-y-4 transition-all ${
                              isTierActive ? 'bg-slate-50/80 shadow-xs border-slate-200' : 'opacity-70 bg-slate-50/30 border-slate-200/50'
                            }`}
                          >
                            {/* Tier Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{tier.badge}</span>
                                <div>
                                  <h4 className="font-extrabold text-sm text-[#071d37]">{tier.name}</h4>
                                  <span className="text-[10px] text-slate-500 font-bold">{tier.range} — {tier.intro}</span>
                                </div>
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                isTierActive 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}>
                                {isTierActive ? 'Active Tier' : 'Locked'}
                              </span>
                            </div>

                            {/* Benefits row */}
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#071d37]/70">Permanent Tier Benefits Unlocked:</p>
                              <div className="flex flex-wrap gap-2">
                                {tier.benefits.map((b, i) => (
                                  <span key={i} className="text-[10px] font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 shadow-3xs">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Milestones inside Tier */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#071d37]/70">Order Milestones & Gifts:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {tier.id === "platinum" ? (
                                  <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-200 p-4 rounded-xl space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-xs font-black text-[#071d37] uppercase tracking-wide">💎 Dynamic Odd-Numbered Rewards Active</p>
                                        <p className="text-[10.5px] text-slate-600 leading-relaxed pt-0.5">Every odd-numbered subscription shipment earns you a reward!</p>
                                      </div>
                                      <span className="text-[9px] bg-violet-100 text-violet-800 border border-violet-200 px-2.5 py-0.5 rounded-full font-bold">Orders 31+ Onwards</span>
                                    </div>

                                    {/* Choice box */}
                                    <div className="bg-white/80 p-3 rounded-lg border border-violet-100 space-y-2">
                                      <p className="text-[10px] font-bold text-slate-700">Odd Order Rewards (Choose ONE at checkout/delivery):</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-medium text-slate-600">
                                        <span className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100">🥫 3 FREE Cans of choice</span>
                                        <span className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100">💷 £10.00 Store Credit</span>
                                        <span className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100">🚚 Free Priority Fast Delivery</span>
                                        <span className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100">🎁 Exclusive Pouch Supply Merch</span>
                                        <span className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100">🎲 Mystery Custom Reward</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-1 border-t border-violet-100">
                                      <span className="text-[10px] text-slate-500 font-bold">Your completed orders: <strong>{ordersCount}</strong></span>
                                      {ordersCount >= 31 ? (
                                        <div className="flex gap-2">
                                          <span className="font-mono font-black text-xs bg-white text-[#071d37] border border-violet-200 py-1 px-3 rounded-md">PLATINUM_ODD</span>
                                          <button 
                                            onClick={() => {
                                              navigator.clipboard.writeText("PLATINUM_ODD");
                                              alert("Voucher code 'PLATINUM_ODD' copied to clipboard! Paste at checkout to request your odd-numbered order selection.");
                                            }}
                                            className="text-[9px] font-black text-violet-700 bg-violet-50 hover:bg-violet-100 py-1 px-2.5 rounded-md uppercase tracking-wider cursor-pointer"
                                          >
                                            Copy Code
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-bold">Complete {31 - ordersCount} more orders to activate</span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  tier.milestones.map((m) => {
                                    const isUnlocked = ordersCount >= m.order;
                                    return (
                                      <div 
                                        key={m.order}
                                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                                          isUnlocked 
                                            ? 'bg-emerald-50/35 border-emerald-200/60' 
                                            : 'bg-slate-100/50 border-slate-200/50'
                                        }`}
                                      >
                                        <div className="space-y-1">
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                              Order {m.order}
                                            </span>
                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                              isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                              {isUnlocked ? 'Unlocked' : 'Locked'}
                                            </span>
                                          </div>
                                          <p className="text-[10.5px] font-bold text-slate-800">{m.reward}</p>
                                        </div>

                                        {isUnlocked ? (
                                          <div className="flex items-center justify-between gap-1 bg-white p-1.5 border border-emerald-100 rounded-lg">
                                            <div className="min-w-0">
                                              <span className="text-[7px] text-slate-400 font-bold uppercase block">Voucher Code</span>
                                              <span className="font-mono font-black text-[10px] text-[#071d37] tracking-wider block truncate">{m.code}</span>
                                            </div>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(m.code);
                                                alert(`Voucher code "${m.code}" copied! Enter at checkout to redeem.`);
                                              }}
                                              className="text-[8px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-1 px-2 rounded cursor-pointer shrink-0 uppercase"
                                            >
                                              Copy
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-[9px] text-slate-400 font-bold block pt-1">
                                            Needs {m.order - ordersCount} more order{m.order - ordersCount !== 1 ? 's' : ''}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Unlock Message Footer */}
                            <div className="text-right">
                              <span className="text-[9px] font-black bg-slate-200/50 text-[#071d37]/80 px-2.5 py-1 rounded-md border border-slate-300/30">
                                {tier.unlockMsg}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Special Personalized VIP Loyalty Discounts */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-[#dfa047]" />
                          Personalized VIP Loyalty Perks
                        </h3>
                        <p className="text-slate-500 text-xs mt-0.5">Special loyalty coupons created specifically for your account tier by the administration team.</p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                        {customerLoyaltyRewards.length} Perks Active
                      </span>
                    </div>

                    {customerLoyaltyRewards.length === 0 ? (
                      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 text-center space-y-2">
                        <Award className="h-8 w-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">No custom administration loyalty perks currently pending.</p>
                        <p className="text-[10px] text-slate-400 max-w-sm mx-auto">Our support team frequently reviews active members and issues secret discount coupons. Keep ordering to trigger custom perks!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customerLoyaltyRewards.map((reward) => (
                          <div key={reward.id} className="bg-amber-50/25 border border-amber-200/50 p-4 rounded-2xl flex flex-col justify-between gap-3 relative overflow-hidden transition-all hover:border-amber-300/80">
                            {/* Accent gold corner flare */}
                            <div className="absolute right-[-15px] top-[-15px] w-12 h-12 rounded-full bg-amber-100/50" />
                            
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="p-1 bg-amber-100 text-amber-700 rounded-md">
                                  <Award className="h-3.5 w-3.5" />
                                </span>
                                <h4 className="text-xs font-black uppercase tracking-wider text-[#071d37]">{reward.loyaltyRewardType || 'Custom Loyalty Reward'}</h4>
                              </div>
                              <p className="text-xs font-extrabold text-slate-900 pt-1.5">{reward.title}</p>
                              <p className="text-[10.5px] text-slate-600 leading-relaxed font-semibold">Reward: {reward.loyaltyRewardValue || 'Secret perk active'}</p>
                              
                              {/* Show product or collection constraints if any */}
                              {reward.loyaltyProductSelection === 'Specific products' && (reward.loyaltyProductIds || []).length > 0 && (
                                <p className="text-[9px] bg-white border border-amber-100 text-amber-800 px-2 py-0.5 rounded-md mt-1 inline-block font-bold">
                                  Applies to {(reward.loyaltyProductIds || []).length} select product(s)
                                </p>
                              )}
                              {reward.loyaltyCollectionSelection === 'Specific collections' && (reward.loyaltyCollectionIds || []).length > 0 && (
                                <p className="text-[9px] bg-white border border-amber-100 text-amber-800 px-2 py-0.5 rounded-md mt-1 inline-block font-bold">
                                  Applies to {(reward.loyaltyCollectionIds || []).length} select collection(s)
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 bg-white p-2 border border-amber-100 rounded-xl mt-1 z-10 shadow-xs">
                              <div className="min-w-0">
                                <span className="text-[8px] text-slate-400 font-bold uppercase block">Voucher Code</span>
                                <span className="font-mono font-black text-[11px] text-[#071d37] tracking-wider select-all">{reward.title}</span>
                              </div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(reward.title);
                                  alert(`Loyalty code "${reward.title}" copied to clipboard! Enter at checkout to apply.`);
                                }}
                                className="text-[9px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 py-1.5 px-3 rounded-lg transition-colors cursor-pointer shrink-0 uppercase"
                              >
                                Copy Code
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 5: REFERRALS (Invite page, stats, pending rewards list) */}
              {activeTab === 'referrals' && (
                <div className="space-y-6">
                  
                  {/* Referral Header */}
                  <div className="bg-[#071d37] text-white rounded-3xl p-8 relative overflow-hidden shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="absolute right-[-10px] top-[-10px] w-36 h-36 rounded-full bg-white/5 border border-white/5" />
                    <div className="space-y-2 text-center md:text-left">
                      <span className="text-[10px] font-bold bg-[#dfa047] text-[#071d37] py-1 px-3 rounded-full uppercase tracking-wider inline-block">Referrals Hub</span>
                      <h2 className="text-2xl font-black uppercase tracking-wide">Invite Friends, Earn Wallet Credit</h2>
                      <p className="text-slate-300 text-xs max-w-lg leading-relaxed">
                        Earn cash credit directly into your Pouch Supply wallet! For every friend who registers and triggers a box subscription, we reward you with £5.00 in direct credits.
                      </p>
                    </div>

                    <div className="bg-white/10 border border-white/20 p-5 rounded-3xl text-center min-w-[160px] shrink-0">
                      <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Available Credit</p>
                      <p className="text-3xl font-black text-emerald-400 mt-1">£{custState.referralCredit.toFixed(2)}</p>
                      <span className="text-[9px] text-slate-400 block pt-1">{custState.referredCount} Friends Invited</span>
                    </div>
                  </div>

                  {/* Stats & Invite Action Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Link Generator */}
                    <div className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                      <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Your Referral Credentials</h3>
                      <p className="text-slate-500 text-xs">
                        Copy and distribute this personalized link to family or colleagues.
                      </p>
                      
                      <div className="flex items-center gap-2 bg-[#f4f6f9] p-3 rounded-2xl border border-slate-100">
                        <input 
                          type="text" 
                          readOnly 
                          value={custState.referralCode} 
                          className="bg-transparent text-slate-600 text-xs font-semibold flex-1 outline-none" 
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(custState.referralCode);
                            alert('Referral link copied to clipboard!');
                          }}
                          className="p-1.5 hover:bg-slate-200 text-[#071d37] rounded-lg transition-colors cursor-pointer"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(custState.referralCode);
                            alert('Copied link!');
                          }}
                          className="flex-1 bg-[#071d37] hover:bg-[#0c2e56] text-white font-bold text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer text-center"
                        >
                          Copy Invite Code
                        </button>
                      </div>
                    </div>

                    {/* Referrals summary block */}
                    {(() => {
                      const orderedCount = custState.referralsList.filter((r: any) => r.status === 'Ordered').length;
                      const pendingCount = custState.referralsList.filter((r: any) => r.status === 'Registered').length;
                      const earnedCredit = orderedCount * 5;
                      const pendingCredit = pendingCount * 5;
                      return (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                          <div className="space-y-4">
                            <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Referral Stats</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                                <span className="text-slate-500 font-medium">Referred Friends</span>
                                <span className="font-black text-[#071d37]">{custState.referredCount}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                                <span className="text-slate-500 font-medium">Credits Earned</span>
                                <span className="font-black text-emerald-700">£{earnedCredit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-medium">Pending Credits</span>
                                <span className="font-black text-amber-600">£{pendingCredit.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Referrals table list */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Invited Friends Log</h3>
                    
                    <div className="space-y-3">
                      {custState.referralsList.map((ref: any, idx: number) => (
                        <div key={idx} className="bg-[#f4f6f9] border border-slate-100 p-4 rounded-2xl flex justify-between items-center text-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#071d37]/5 text-[#dfa047] flex items-center justify-center font-bold font-sans text-xs uppercase">
                              {ref.name.substring(0, 2)}
                            </div>
                            <div>
                              <p className="font-black text-[#071d37]">{ref.name}</p>
                              <p className="text-[10px] text-slate-400">Registered on {ref.date}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ref.status === 'Subscribed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {ref.status}
                            </span>
                            <span className="font-black text-slate-800">{ref.credit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 6: PAYMENT METHODS */}
              {activeTab === 'payments' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Saved Payment Cards</h3>
                      <p className="text-slate-400 text-[10.5px]">Manage your saved billing methods for seamless automatic box charges.</p>
                    </div>
                    <button 
                      onClick={() => alert('New card authorization form loading... (Simulated)')}
                      className="text-xs font-black text-[#dfa047] uppercase tracking-wider flex items-center gap-1 hover:underline"
                    >
                      <PlusCircle className="h-4 w-4" /> Add Card
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {custState.savedCards.map((card: any) => (
                      <div key={card.id} className="bg-gradient-to-br from-[#071d37] to-[#123157] text-white p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between h-36 shadow-md">
                        <div className="absolute right-[-10px] bottom-[-10px] w-24 h-24 rounded-full bg-white/5 border border-white/5" />
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#dfa047]">{card.brand} CARD</span>
                          {card.default && <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">DEFAULT</span>}
                        </div>
                        <p className="font-mono text-base font-bold tracking-widest mt-4">•••• •••• •••• {card.last4}</p>
                        <div className="flex justify-between text-[10px] text-slate-300 font-semibold mt-2">
                          <span>EXPIRY: {card.exp}</span>
                          <span>POUCH SUPPLY CUSTOMER</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: ADDRESSES (Integrated seamlessly with onAddAddress/onRemoveAddress callbacks) */}
              {activeTab === 'addresses' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Delivery Addresses</h3>
                      <p className="text-slate-400 text-[10.5px]">Configure your shipping points for regular deliveries.</p>
                    </div>
                    <button 
                      onClick={() => setShowAddressModal(true)}
                      className="text-xs font-black text-[#dfa047] uppercase tracking-wider flex items-center gap-1 hover:underline"
                    >
                      <PlusCircle className="h-4 w-4" /> Add Address
                    </button>
                  </div>

                  {loggedInCustomer.addresses.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No addresses saved yet. Click add address above.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {loggedInCustomer.addresses.map((addr, idx) => (
                        <div key={idx} className="bg-[#f4f6f9] border border-slate-150 p-4 rounded-2xl flex flex-col justify-between relative group">
                          <span className="absolute top-3 right-3 bg-white border border-slate-200 text-slate-500 text-[9px] font-black uppercase py-0.5 px-2 rounded-md">
                            {idx === 0 ? 'Primary' : 'Secondary'}
                          </span>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-[#071d37] uppercase tracking-wide">Destination #{idx + 1}</h4>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold pr-12">{addr}</p>
                          </div>
                          {idx > 0 && (
                            <button
                              onClick={() => onRemoveAddress(idx)}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-0.5 mt-4 self-start cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove Shipping Address
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7.5: ACCOUNT DETAILS */}
              {activeTab === 'details' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Account Settings</h3>
                    <p className="text-slate-400 text-[10.5px] mt-0.5">Configure your customer profile name, email, and secure access credentials.</p>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!editName.trim() || !editEmail.trim()) {
                        alert('Name and Email are required.');
                        return;
                      }
                      if (onUpdateProfile && loggedInCustomer) {
                        const updated: Customer = {
                          ...loggedInCustomer,
                          name: editName.trim(),
                          email: editEmail.trim(),
                        };
                        if (editPassword) {
                          alert('Profile and Password updated successfully!');
                        } else {
                          alert('Profile details updated successfully!');
                        }
                        onUpdateProfile(updated);
                      } else {
                        alert('Profile details updated successfully! (Local state synced)');
                      }
                    }}
                    className="space-y-4 text-xs"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                        <input 
                          type="text" 
                          required 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input 
                          type="email" 
                          required 
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37] bg-slate-50 text-slate-500 outline-none"
                          disabled 
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block">Contact support if you need to modify your registration email.</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Password (leave blank to keep current)</label>
                      <input 
                        type="password" 
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37] outline-none"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button 
                        type="submit" 
                        className="bg-[#071d37] hover:bg-[#0c2e56] text-white font-bold text-xs uppercase py-2.5 px-6 rounded-xl cursor-pointer transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 8: HELP & SUPPORT (Interactive Support ticketing form & beautiful FAQ visualizer) */}
              {activeTab === 'support' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Support form */}
                  <div className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Contact Specialist Support</h3>
                    <p className="text-slate-400 text-[10.5px]">Send a direct message below. Our average client response speed is 15 minutes.</p>
                    
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        alert('Message sent successfully! Our client support agents are reviewing your request.');
                      }} 
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Your Name</label>
                          <input type="text" readOnly value={loggedInCustomer.name} className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl bg-slate-50 text-slate-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                          <input type="email" readOnly value={loggedInCustomer.email} className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl bg-slate-50 text-slate-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Subject Topic</label>
                        <input type="text" required placeholder="e.g., Subscription Swapping question" className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Detailed Message</label>
                        <textarea required rows={4} placeholder="Tell us how we can help you today..." className="w-full text-xs font-semibold border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-[#071d37]"></textarea>
                      </div>
                      <button type="submit" className="bg-[#071d37] hover:bg-[#0c2e56] text-white font-bold text-xs uppercase py-2.5 px-6 rounded-xl cursor-pointer">Submit Request</button>
                    </form>
                  </div>

                  {/* Compact FAQs */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-[#071d37] uppercase tracking-wider">Quick FAQs</h3>
                    
                    <div className="space-y-3 text-xs">
                      {[
                        { q: 'Can I swap can flavors?', a: 'Yes! Simply use the Swapper in your Subscriptions tab before shipment day.' },
                        { q: 'How do loyalty gifts work?', a: 'Place regular orders to unlock free delivery coupons or premium extra pouch cans.' },
                        { q: 'How do referrals trigger?', a: 'When friends join using your unique code, a £5.00 wallet discount applies automatically.' }
                      ].map((faq, idx) => (
                        <div key={idx} className="space-y-1 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="font-black text-[#071d37]">{faq.q}</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </main>
      </div>

      {/* Invoice Detail Modal overlay */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-[#071d37]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9] rounded-t-3xl">
              <div>
                <h3 className="font-black text-[#071d37] text-base">Invoice Ref: {selectedOrderDetails.id}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedOrderDetails.date}</p>
              </div>
              <button 
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px] block mb-1">Customer Details</span>
                  <p className="font-black text-[#071d37]">{selectedOrderDetails.customerName}</p>
                  <p className="text-slate-500">{selectedOrderDetails.customerEmail}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px] block mb-1">Delivery Destination</span>
                  <p className="font-semibold text-slate-600 leading-relaxed">{selectedOrderDetails.destination}</p>
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Itemized list</h4>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                  {selectedOrderDetails.items.map((item, idx) => {
                    const prodImage = allProducts.find(p => p.id === item.productId)?.image || item.image || '';
                    return (
                      <div key={idx} className="flex gap-3 items-center justify-between p-3">
                        <div className="flex gap-2 items-center min-w-0">
                          {prodImage && <img src={prodImage} className="w-8 h-8 object-cover rounded bg-slate-50 border border-slate-100" alt="" referrerPolicy="no-referrer" />}
                          <div className="min-w-0">
                            <p className="font-bold text-[#071d37] truncate">{item.productTitle}</p>
                            <p className="text-slate-400 text-[10px]">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-extrabold text-slate-850">£{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Shipping Delivery ({selectedOrderDetails.deliveryMethod})</span>
                  <span className="font-bold text-emerald-700">Free</span>
                </div>
                <div className="flex justify-between text-slate-800 text-sm font-extrabold pt-2 border-t border-slate-100">
                  <span>Total Amount</span>
                  <span>£{selectedOrderDetails.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-[#071d37]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp text-left">
            <h3 className="font-black text-[#071d37] text-sm mb-4 uppercase tracking-wide flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#071d37]" />
              <span>Add Custom Shipping Address</span>
            </h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!addrStreet.trim() || !addrCity.trim() || !addrZip.trim()) {
                  return;
                }
                const combined = [
                  addrStreet.trim(),
                  addrApt.trim() ? addrApt.trim() : null,
                  addrCity.trim(),
                  addrState.trim() ? addrState.trim() : null,
                  addrZip.trim(),
                  addrCountry.trim()
                ].filter(Boolean).join(', ');
                
                onAddAddress(combined);
                
                // Reset fields
                setAddrStreet('');
                setAddrApt('');
                setAddrCity('');
                setAddrState('');
                setAddrZip('');
                setAddrCountry('United Kingdom');
                setShowAddressModal(false);
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 24 London Road"
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#071d37]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Apartment, suite, unit, etc. (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Flat 3B"
                  value={addrApt}
                  onChange={(e) => setAddrApt(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#071d37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. London"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#071d37]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">State / Province</label>
                  <input
                    type="text"
                    placeholder="e.g. Greater London"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#071d37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">ZIP / Postal Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EC1A 1BB"
                    value={addrZip}
                    onChange={(e) => setAddrZip(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#071d37]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. United Kingdom"
                    value={addrCountry}
                    onChange={(e) => setAddrCountry(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#071d37]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="bg-slate-100 hover:bg-slate-205 text-slate-600 py-2 px-4 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#071d37] hover:bg-[#0c2e56] text-white py-2 px-4 rounded-xl font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
