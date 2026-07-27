import React, { useState, useEffect } from 'react';
import { CartItem, Discount, Customer, Order } from '../types';
import { 
  ShieldCheck, ArrowLeft, CreditCard, Lock, Terminal, 
  CheckCircle, AlertTriangle, AlertCircle, RefreshCw, Send, HelpCircle, Truck, ShoppingCart,
  Camera, QrCode, UserCheck, Smartphone, Upload, Activity, Check, X
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
    worldpayTxId: string;
    worldpayAuthCode: string;
    cardBrand: string;
    storeCreditApplied?: number;
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

  useEffect(() => {
    setCurrentDiscount(discountApplied);
  }, [discountApplied]);
  // Shipping info state
  const [fullName, setFullName] = useState(loggedInCustomer?.name || '');
  const [email, setEmail] = useState(loggedInCustomer?.email || '');
  const [addressLine, setAddressLine] = useState(
    loggedInCustomer?.addresses && loggedInCustomer.addresses[0] ? loggedInCustomer.addresses[0] : ''
  );
  const [city, setCity] = useState('London');
  const [postcode, setPostcode] = useState('EC1A 1BB');
  const [country, setCountry] = useState('United Kingdom');
  const [deliverySpeed, setDeliverySpeed] = useState<'standard' | 'priority'>('priority');

  // Worldpay Card State
  const [paymentMethod, setPaymentMethod] = useState<'hosted' | 'direct'>('hosted');
  const [cardHolder, setCardHolder] = useState(loggedInCustomer?.name || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Sandbox simulation settings
  const [simulationMode, setSimulationMode] = useState<'SUCCESS' | 'DECLINED' | '3DS_REQUIRED' | 'GATEWAY_ERROR'>('SUCCESS');
  const [showLogs, setShowLogs] = useState(false);
  const [apiLogs, setApiLogs] = useState<{ timestamp: string; type: 'REQUEST' | 'RESPONSE' | 'ERROR'; payload: any }[]>([]);

  // Payment execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any | null>(null);

  // 3D Secure dialog state
  const [show3dsModal, setShow3dsModal] = useState(false);
  const [threeDsTxId, setThreeDsTxId] = useState('');
  const [threeDsOtp, setThreeDsOtp] = useState('');
  const [threeDsError, setThreeDsError] = useState<string | null>(null);

  // AgeChecked Age Verification States
  const [ageCheckedVerified, setAgeCheckedVerified] = useState<boolean>(() => {
    return sessionStorage.getItem('agechecked_verified') === 'true';
  });
  const [ageCheckedDetails, setAgeCheckedDetails] = useState<{
    method: 'ELECTORAL' | 'CARD' | 'MOBILE' | 'DOC' | 'BIOMETRIC';
    timestamp: string;
    token: string;
    name?: string;
    details?: string;
    publicKeyUsed?: string;
  } | null>(() => {
    const saved = sessionStorage.getItem('agechecked_details');
    return saved ? JSON.parse(saved) : null;
  });
  const [ageCheckedActiveMethod, setAgeCheckedActiveMethod] = useState<'ELECTORAL' | 'CARD' | 'MOBILE' | 'DOC' | 'BIOMETRIC' | null>(null);
  const [ageCheckedStep, setAgeCheckedStep] = useState<'select' | 'input' | 'verifying' | 'success'>('select');
  const [ageCheckedScanningProgress, setAgeCheckedScanningProgress] = useState<number>(0);
  const [ageCheckedLocalStream, setAgeCheckedLocalStream] = useState<MediaStream | null>(null);
  const [ageCheckedConfig, setAgeCheckedConfig] = useState<{ active: boolean; publicKeyMasked: string } | null>(null);

  useEffect(() => {
    fetch('/api/agechecked/config')
      .then(res => res.json())
      .then(data => setAgeCheckedConfig(data))
      .catch(err => console.error('Failed to load AgeChecked config:', err));
  }, []);

  // Input states for AgeChecked methods
  const [electoralName, setElectoralName] = useState(loggedInCustomer?.name || '');
  const [electoralDob, setElectoralDob] = useState('');
  const [electoralPostcode, setElectoralPostcode] = useState(postcode || 'EC1A 1BB');
  
  const [cardCheckNumber, setCardCheckNumber] = useState('');
  const [cardCheckName, setCardCheckName] = useState(loggedInCustomer?.name || '');
  
  const [mobilePhone, setMobilePhone] = useState('');
  const [mobileNetwork, setMobileNetwork] = useState('EE');
  
  const [docType, setDocType] = useState<'Passport' | 'Driving License'>('Passport');
  const [docNumber, setDocNumber] = useState('');
  const [docName, setDocName] = useState(loggedInCustomer?.name || '');

  // Auto-fill customer details when they change
  useEffect(() => {
    if (loggedInCustomer) {
      setFullName(loggedInCustomer.name);
      setEmail(loggedInCustomer.email);
      setCardHolder(loggedInCustomer.name);
      setElectoralName(loggedInCustomer.name);
      setCardCheckName(loggedInCustomer.name);
      setDocName(loggedInCustomer.name);
      if (loggedInCustomer.addresses && loggedInCustomer.addresses[0]) {
        setAddressLine(loggedInCustomer.addresses[0]);
      }
    }
  }, [loggedInCustomer]);

  // --- AgeChecked Verification Simulations ---

  // Camera integration for Facial Biometrics/Estimation
  useEffect(() => {
    if (ageCheckedActiveMethod === 'BIOMETRIC' && ageCheckedStep === 'verifying') {
      let activeStream: MediaStream | null = null;
      let interval: any = null;

      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          setAgeCheckedLocalStream(stream);
          activeStream = stream;

          setAgeCheckedScanningProgress(0);
          interval = setInterval(() => {
            setAgeCheckedScanningProgress(prev => {
              if (prev >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                  handleConfirmAgeCheckedVerification('BIOMETRIC', fullName || 'Verified Customer', 'AgeChecked Facial Age Estimation 18+ Passed');
                }, 500);
                return 100;
              }
              return prev + 10;
            });
          }, 200);
        })
        .catch(err => {
          console.error("Camera required for AgeChecked face estimation:", err);
          alert("Camera access is required for Facial Age Estimation. No camera was detected or permission was denied. Please connect a camera or select another age verification method.");
          setAgeCheckedActiveMethod(null);
          setAgeCheckedStep('select');
        });

      return () => {
        if (interval) clearInterval(interval);
        if (activeStream) {
          activeStream.getTracks().forEach(track => track.stop());
        }
        setAgeCheckedLocalStream(null);
      };
    }
  }, [ageCheckedActiveMethod, ageCheckedStep]);

  // General loader/verify progress for text-based checks (Electoral Roll, CC, Mobile, Doc)
  useEffect(() => {
    if (ageCheckedActiveMethod !== null && ageCheckedActiveMethod !== 'BIOMETRIC' && ageCheckedStep === 'verifying') {
      setAgeCheckedScanningProgress(0);
      const interval = setInterval(() => {
        setAgeCheckedScanningProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              let detailsStr = '';
              let targetName = fullName || 'Verified Customer';
              
              if (ageCheckedActiveMethod === 'ELECTORAL') {
                detailsStr = `Electoral Register Match at Postcode: ${electoralPostcode}, DOB: ${electoralDob}`;
                targetName = electoralName;
              } else if (ageCheckedActiveMethod === 'CARD') {
                detailsStr = `Card Verification pre-auth success. Last 4 digits: ${cardCheckNumber.slice(-4) || '4321'}`;
                targetName = cardCheckName;
              } else if (ageCheckedActiveMethod === 'MOBILE') {
                detailsStr = `Mobile operator ${mobileNetwork} database lookup verified for phone: ${mobilePhone}`;
              } else if (ageCheckedActiveMethod === 'DOC') {
                detailsStr = `${docType} verified. Doc Number: ${docNumber}`;
                targetName = docName;
              }

              handleConfirmAgeCheckedVerification(ageCheckedActiveMethod, targetName, detailsStr);
            }, 600);
            return 100;
          }
          return prev + 10;
        });
      }, 120);

      return () => clearInterval(interval);
    }
  }, [ageCheckedActiveMethod, ageCheckedStep]);

  // Handle finalize and save AgeChecked verification to session
  const handleConfirmAgeCheckedVerification = async (
    method: 'ELECTORAL' | 'CARD' | 'MOBILE' | 'DOC' | 'BIOMETRIC',
    customName?: string,
    customDetails?: string
  ) => {
    const payload = {
      method,
      name: customName || fullName || 'Verified Customer',
      dob: method === 'ELECTORAL' ? electoralDob : undefined,
      postcode: method === 'ELECTORAL' ? electoralPostcode : (postcode || undefined),
      phone: method === 'MOBILE' ? mobilePhone : undefined,
      network: method === 'MOBILE' ? mobileNetwork : undefined,
      docType: method === 'DOC' ? docType : undefined,
      docNumber: method === 'DOC' ? docNumber : (method === 'CARD' ? cardCheckNumber : undefined),
    };

    addLog('REQUEST', {
      url: '/api/agechecked/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    try {
      const res = await fetch('/api/agechecked/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      addLog('RESPONSE', data);

      if (res.ok && data.success && data.verified) {
        const verificationObj = {
          method: data.method,
          timestamp: data.timestamp,
          token: data.token,
          name: data.name,
          details: data.details,
          publicKeyUsed: data.publicKeyUsed
        };

        setAgeCheckedDetails(verificationObj);
        setAgeCheckedVerified(true);
        setAgeCheckedStep('success');

        sessionStorage.setItem('agechecked_verified', 'true');
        sessionStorage.setItem('agechecked_details', JSON.stringify(verificationObj));
        
        // Dispatch custom event if other parts of application listen
        const event = new CustomEvent('agechecked-status-updated', { detail: { verified: true, details: verificationObj } });
        window.dispatchEvent(event);
      } else {
        const errMsg = data.error || 'Age Verification declined by AgeChecked API.';
        addLog('ERROR', { message: errMsg });
        alert(`Age Verification Failed: ${errMsg}`);
        setAgeCheckedVerified(false);
        setAgeCheckedStep('select');
        sessionStorage.removeItem('agechecked_verified');
        sessionStorage.removeItem('agechecked_details');
      }
    } catch (err: any) {
      console.error('[AgeChecked Client API Error]', err);
      const errMsg = err.message || 'AgeChecked API connection failed.';
      addLog('ERROR', { message: errMsg });
      alert(`Age Verification Service Error: ${errMsg}`);
      setAgeCheckedVerified(false);
      setAgeCheckedStep('select');
      sessionStorage.removeItem('agechecked_verified');
      sessionStorage.removeItem('agechecked_details');
    }
  };

  // Reset verification
  const handleResetAgeCheckedVerification = () => {
    setAgeCheckedVerified(false);
    setAgeCheckedDetails(null);
    setAgeCheckedActiveMethod(null);
    setAgeCheckedStep('select');
    setAgeCheckedScanningProgress(0);

    sessionStorage.removeItem('agechecked_verified');
    sessionStorage.removeItem('agechecked_details');

    const event = new CustomEvent('agechecked-status-updated', { detail: { verified: false, details: null } });
    window.dispatchEvent(event);
  };

  // Detected card type
  const getCardBrand = (num: string) => {
    const clean = num.replace(/\s+/g, '');
    if (clean.startsWith('4')) return { name: 'Visa', color: 'from-blue-600 to-indigo-800', logo: '💳 Visa' };
    if (clean.startsWith('5')) return { name: 'Mastercard', color: 'from-orange-500 to-red-600', logo: '💳 Mastercard' };
    if (clean.startsWith('3')) return { name: 'American Express', color: 'from-teal-600 to-emerald-800', logo: '💳 AMEX' };
    if (clean.startsWith('6')) return { name: 'Maestro', color: 'from-blue-500 to-cyan-600', logo: '💳 Maestro' };
    return { name: 'Worldpay Core', color: 'from-slate-700 to-slate-900', logo: '💳 Card' };
  };

  const currentCardBrand = getCardBrand(cardNumber);

  // Format card number with spacing (#### #### #### ####)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setCardNumber(formatted);
  };

  // Format expiry (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    
    if (value.length >= 2) {
      const month = parseInt(value.substring(0, 2), 10);
      const safeMonth = Math.min(Math.max(month, 1), 12).toString().padStart(2, '0');
      const year = value.substring(2);
      setExpiry(`${safeMonth}/${year}`);
    } else {
      setExpiry(value);
    }
  };

  // Add a log helper
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

    // Check active promotional coupon codes
    const found = activeDiscounts?.find(d => d.title.toUpperCase() === code && d.status === 'Active');
    if (found) {
      setCurrentDiscount(found);
      if (onApplyDiscount) {
        onApplyDiscount(found);
      }
      setPromoSuccess(`Promo Code "${code}" applied: ${found.details}!`);
    } else {
      // Check if it matches an existing customer's referral code (case-insensitive)
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
        setPromoSuccess(`Referral code applied! You receive a 10% discount on your order.`);
      } else {
        setPromoError('Invalid or expired promo code.');
      }
    }
  };

  // Subtotal details calculated dynamically
  const rawSubtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  
  // Auto-apply subscriber 10% discount if cart has subscription items and no discount selected yet
  useEffect(() => {
    if (!currentDiscount && cartItems.some(i => i.productId?.includes('sub-pack') || i.productTitle?.toLowerCase().includes('subscription') || i.productTitle?.toLowerCase().includes('pack'))) {
      onApplyDiscount({
        id: 'disc-sub-first50',
        title: 'SUB10-FIRST50',
        status: 'Active',
        method: 'Code',
        eligibility: 'All customers',
        type: 'Amount off order',
        valueType: 'Percentage',
        valueAmount: 10,
        used: 12,
        details: '10% First 50 Subscribers Permanent Discount'
      });
    }
  }, [cartItems, currentDiscount, onApplyDiscount]);

  const discountValue = calculateDiscountAmount(currentDiscount, cartItems, rawSubtotal);
  const subtotalAfterDiscount = Math.max(rawSubtotal - discountValue, 0);

  const deliveryCost = currentDiscount?.type === 'Free shipping' 
    ? 0 
    : (subtotalAfterDiscount >= 40 ? 0 : 2.99);
  const finalTotal = subtotalAfterDiscount + deliveryCost;
  const storeCreditAvailable = loggedInCustomer?.storeCredit || 0;
  const storeCreditApplied = applyStoreCredit ? Math.min(storeCreditAvailable, finalTotal) : 0;
  const finalTotalToPay = Math.max(0, finalTotal - storeCreditApplied);

  // Process secure Worldpay request
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !addressLine) {
      setPaymentError('Please fill in your shipping and contact information.');
      return;
    }

    if (!ageCheckedVerified) {
      setPaymentError('Age Verification Required: Under tobacco & nicotine regulation, you must verify you are 18+ via AgeChecked before completing your order.');
      // Smooth scroll to AgeChecked block
      const element = document.getElementById('agechecked-verification-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (finalTotalToPay === 0) {
      setIsProcessing(true);
      setPaymentError(null);
      setTimeout(() => {
        setIsProcessing(false);
        const generatedOrderId = `PS${Math.floor(Math.random() * 90000 + 10000)}`;
        const successData = {
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
          worldpayTxId: `WP-CREDIT-${Math.floor(Math.random() * 100000000)}`,
          worldpayAuthCode: 'CREDIT-AUTH',
          cardBrand: 'Store Credit',
          storeCreditApplied: storeCreditApplied
        };
        onCompleteCheckout(successData);
        setPaymentSuccessData(successData);
      }, 1000);
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    // Generate clean Order ID
    const generatedOrderId = `PS${Math.floor(Math.random() * 90000 + 10000)}`;

    setTimeout(() => {
      setIsProcessing(false);
      window.history.pushState({}, '', `/payment/gateway?orderId=${generatedOrderId}&amount=${finalTotalToPay.toFixed(2)}`);
      window.dispatchEvent(new Event('popstate'));
    }, 800);
  };

  // Process 3DS validation code
  const handleVerify3ds = async () => {
    if (!threeDsOtp.trim()) return;

    setIsProcessing(true);
    setThreeDsError(null);

    const requestPayload = {
      cardHolderName: cardHolder,
      cardNumber: cardNumber,
      expiry: expiry,
      cvv: cvv,
      amount: finalTotalToPay.toFixed(2),
      currency: 'GBP',
      simulationMode: 'SUCCESS', // Verify completes transaction
      threeDSecureOTP: threeDsOtp
    };

    addLog('REQUEST', {
      endpoint: '/api/worldpay/process',
      method: 'POST',
      notes: 'Completing 3D Secure challenge',
      body: {
        transactionId: threeDsTxId,
        otp: '****'
      }
    });

    try {
      const response = await fetch('/api/worldpay/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        addLog('ERROR', {
          statusCode: response.status,
          error: responseData.error || '3DS Verification Failed',
          message: responseData.message || 'The OTP code is invalid'
        });
        throw new Error(responseData.message || 'Verification rejected.');
      }

      addLog('RESPONSE', responseData);

      // Payment authorized!
      setPaymentSuccessData(responseData);
      setShow3dsModal(false);
      setIsProcessing(false);

      // Place order
      const orderId = `PS${Math.floor(Math.random() * 90000 + 10000)}`;
      onCompleteCheckout({
        orderId,
        customerName: fullName,
        customerEmail: email,
        address: `${addressLine}, ${city}, ${postcode}, ${country}`,
        total: finalTotalToPay,
        discountApplied: currentDiscount,
        items: cartItems.map(item => ({
          productId: item.productId,
          productTitle: item.productTitle,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        worldpayTxId: responseData.transactionId,
        worldpayAuthCode: responseData.authCode,
        cardBrand: responseData.cardBrand,
        storeCreditApplied: storeCreditApplied
      });

    } catch (err: any) {
      setThreeDsError(err.message || 'Authentication declined. Passcode hints: 1234');
      setIsProcessing(false);
    }
  };

  // If order was successfully completed
  if (paymentSuccessData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 relative overflow-hidden">
          {/* Subtle branding background element */}
          <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-50 rounded-full blur-3xl opacity-60 -z-10" />
          
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 mx-auto">
            <CheckCircle className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold py-1 px-3.5 rounded-full uppercase tracking-wider inline-block">
              Payment Secured by Worldpay
            </span>
            <h1 className="text-3xl font-black text-slate-950 uppercase tracking-tight">Order Placed Successfully!</h1>
            <p className="text-slate-500 max-w-lg mx-auto text-xs leading-relaxed">
              Thank you for shopping with us! Your nicotine pouches are being packed and dispatched directly from our UK-licensed laboratory pouch facility.
            </p>
          </div>

          {/* Receipt Card */}
          <div className="bg-slate-50 border border-slate-150/70 rounded-2xl p-6 text-left max-w-lg mx-auto space-y-4">
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Worldpay Ref Code:</span>
              <span className="font-mono font-bold text-slate-800 uppercase">{paymentSuccessData.transactionId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Authorization Pin:</span>
              <span className="font-mono font-bold text-slate-800">{paymentSuccessData.authCode}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Payment Method:</span>
              <span className="font-semibold text-slate-800">{paymentSuccessData.cardBrand} (Worldpay Network)</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3 text-xs">
              <span className="text-slate-400 font-bold">Risk Assessment Score:</span>
              <span className="font-black text-indigo-600">{paymentSuccessData.riskScore} / 100 (Safe)</span>
            </div>
            <div className="flex justify-between pt-1 text-sm font-black">
              <span className="text-slate-800 uppercase">Amount Transacted:</span>
              <span className="text-slate-950">£{paymentSuccessData.amount.toFixed(2)} GBP</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
            <button
              onClick={() => onNavigate('frontend-home')}
              className="w-full bg-slate-900 border-slate-900 text-white hover:bg-slate-850 py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer shadow-md"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => {
                // Open Customer profile at order logs tab
                onNavigate('frontend-account');
              }}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              View Order History
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasSubscription = cartItems.some(item => item.productId && (item.productId.startsWith('sub-pack') || item.productId.includes('sub-pack')));

  if (hasSubscription && !loggedInCustomer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-sm space-y-6 flex flex-col items-center animate-fade-in">
          <div className="p-4 bg-red-50 text-red-600 rounded-full w-16 h-16 flex items-center justify-center shadow-xs">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-black text-[#071d37] uppercase tracking-wider">Account Required to Subscribe</h2>
            <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
              Your cart contains a customized **Pouch Supply Subscription Pack**. To complete a subscription purchase, you are required to create a free customer account or sign in.
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed max-w-lg mx-auto bg-slate-50 border border-slate-100 rounded-xl p-3.5 mt-2">
              Having an account ensures your selected nicotine pouch quantities are securely synced to our cloud database. This allows you to manage swaps, skip deliveries, track milestones, and secure rewards anytime with zero data loss.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-2">
            <button
              onClick={() => onNavigate('frontend-account')}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-xs"
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
          <ArrowLeft className="h-4 w-4" /> Back to Catalog Shop
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
              <Truck className="h-4 w-4 text-indigo-600" /> 1. Shipping Address & Contact Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Recipient Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alexander Sterling"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (!cardHolder) setCardHolder(e.target.value);
                  }}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Contact Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@example.co.uk"
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
                placeholder="e.g. 100 Clifton Street, Floor 2"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Town / City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-250 bg-slate-50/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Postcode / Zip</label>
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
                  <option value="United Kingdom">United Kingdom (UK)</option>
                  <option value="Ireland">Ireland</option>
                  <option value="Sweden">Sweden</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                </select>
              </div>
            </div>

            {/* Delivery Speeds */}
            <div className="pt-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">Delivery Method</label>
              <div className="border border-slate-800 bg-slate-50 ring-1 ring-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div className="text-left">
                  <span className="font-extrabold text-xs block text-slate-800 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-indigo-600" /> Royal Mail
                  </span>
                  <span className="text-[10px] text-slate-500">Arrives in 3–5 business days</span>
                </div>
                <span className={subtotalAfterDiscount >= 40 ? "font-black text-xs text-emerald-600" : "font-black text-xs text-slate-800"}>
                  {subtotalAfterDiscount >= 40 ? 'FREE' : '£2.99'}
                </span>
              </div>
            </div>
          </div>

          {/* AgeChecked Age Verification Section */}
          <div id="agechecked-verification-section" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <UserCheck className="h-4.5 w-4.5 text-cyan-600" /> 1.5. AgeChecked 18+ Verification
                </h3>
                <p className="text-slate-400 text-[10.5px] font-bold mt-1 leading-normal">
                  In compliance with UK Tobacco and Nicotine sales standards, we instantly verify that you are aged 18 or over.
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                  🟢 AgeChecked Live Integration Active
                </span>
                {ageCheckedConfig?.publicKeyMasked && (
                  <span className="text-[8.5px] text-slate-400 font-mono tracking-normal">
                    Key: {ageCheckedConfig.publicKeyMasked}
                  </span>
                )}
              </div>
            </div>

            {ageCheckedVerified && ageCheckedDetails ? (
              /* Verification Success State */
              <div className="bg-emerald-50/40 border-2 border-emerald-500/30 p-5 rounded-2xl space-y-4 relative overflow-hidden">
                <div className="absolute right-[-10px] top-[-10px] w-14 h-14 bg-emerald-100/40 rounded-full flex items-center justify-center">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                
                <div className="flex items-start gap-3.5">
                  <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Age Checked Successfully</h4>
                    <p className="text-[11px] text-slate-500 leading-normal font-bold">
                      Your age is verified (18+) via the secure AgeChecked system and associated with your transaction.
                    </p>
                  </div>
                </div>

                {/* Verification Metadata table */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-white border border-emerald-100 rounded-xl p-3.5 text-[10px] font-semibold text-slate-600">
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[8px] uppercase font-black">Verification Method</p>
                    <p className="font-extrabold text-slate-800 flex items-center gap-1">
                      {ageCheckedDetails.method === 'ELECTORAL' && 'UK Electoral Register Match'}
                      {ageCheckedDetails.method === 'CARD' && 'Card pre-auth Validation Check'}
                      {ageCheckedDetails.method === 'MOBILE' && 'Mobile Operator Sync Match'}
                      {ageCheckedDetails.method === 'DOC' && 'Government Document Check'}
                      {ageCheckedDetails.method === 'BIOMETRIC' && 'Biometric Facial Estimate Scan'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[8px] uppercase font-black">Verified Customer Name</p>
                    <p className="font-extrabold text-slate-800">{ageCheckedDetails.name}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2 border-t border-slate-100 pt-2.5">
                    <p className="text-slate-400 text-[8px] uppercase font-black">Compliance Reference Details</p>
                    <p className="font-mono text-slate-700 text-[9.5px] select-all truncate">{ageCheckedDetails.details}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[8px] uppercase font-black">Compliance Token</p>
                    <p className="font-mono text-cyan-600 text-[9px] select-all truncate">{ageCheckedDetails.token}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[8px] uppercase font-black">Verified Timestamp</p>
                    <p className="font-extrabold text-slate-800">{ageCheckedDetails.timestamp}</p>
                  </div>
                  {ageCheckedDetails.publicKeyUsed && (
                    <div className="space-y-1 sm:col-span-2 border-t border-slate-100 pt-2.5">
                      <p className="text-slate-400 text-[8px] uppercase font-black">AgeChecked Integration Public Key</p>
                      <p className="font-mono text-slate-500 text-[9px] select-all">{ageCheckedDetails.publicKeyUsed}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5 shrink-0" /> PAS 1296 Accredited Age Assurance.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetAgeCheckedVerification}
                    className="text-[9.5px] text-red-600 hover:text-red-700 font-black uppercase hover:underline bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    Reset & Re-Verify
                  </button>
                </div>
              </div>
            ) : (
              /* Pending Verification state */
              <div className="space-y-4">
                
                {ageCheckedActiveMethod === null && (
                  /* Main verification type selection cards */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    
                    {/* Method 1: UK Electoral Roll */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgeCheckedActiveMethod('ELECTORAL');
                        setAgeCheckedStep('input');
                      }}
                      className="text-left border border-slate-200 hover:border-cyan-500 hover:shadow-md rounded-xl p-4 transition-all bg-slate-50/20 flex flex-col justify-between gap-3 group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <span className="p-2 bg-cyan-50 text-cyan-700 rounded-lg inline-block group-hover:bg-cyan-100 transition-colors">
                          <CheckCircle className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <h4 className="text-[11.5px] font-black uppercase tracking-wider text-slate-900">1. Electoral Register</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-normal pt-1">
                            Instant verification matching name, address, and DOB against electoral rolls.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-700 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Select Electoral check <span className="text-xs">➔</span>
                      </span>
                    </button>

                    {/* Method 2: Payment Card Pre-auth */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgeCheckedActiveMethod('CARD');
                        setAgeCheckedStep('input');
                      }}
                      className="text-left border border-slate-200 hover:border-cyan-500 hover:shadow-md rounded-xl p-4 transition-all bg-slate-50/20 flex flex-col justify-between gap-3 group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <span className="p-2 bg-cyan-50 text-cyan-700 rounded-lg inline-block group-hover:bg-cyan-100 transition-colors">
                          <CreditCard className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <h4 className="text-[11.5px] font-black uppercase tracking-wider text-slate-900">2. Card Verification</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-normal pt-1">
                            Simulate a credit or debit card check verifying adult ownership. No charge is made.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-700 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Select Card Check <span className="text-xs">➔</span>
                      </span>
                    </button>

                    {/* Method 3: Mobile Network Database */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgeCheckedActiveMethod('MOBILE');
                        setAgeCheckedStep('input');
                      }}
                      className="text-left border border-slate-200 hover:border-cyan-500 hover:shadow-md rounded-xl p-4 transition-all bg-slate-50/20 flex flex-col justify-between gap-3 group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <span className="p-2 bg-cyan-50 text-cyan-700 rounded-lg inline-block group-hover:bg-cyan-100 transition-colors">
                          <Smartphone className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <h4 className="text-[11.5px] font-black uppercase tracking-wider text-slate-900">3. Mobile Operator</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-normal pt-1">
                            Queries your mobile operator (EE, Vodafone, O2, Three) to match adult credentials.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-700 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Select Mobile check <span className="text-xs">➔</span>
                      </span>
                    </button>

                    {/* Method 4: Passport or Driving Licence */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgeCheckedActiveMethod('DOC');
                        setAgeCheckedStep('input');
                      }}
                      className="text-left border border-slate-200 hover:border-cyan-500 hover:shadow-md rounded-xl p-4 transition-all bg-slate-50/20 flex flex-col justify-between gap-3 group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <span className="p-2 bg-cyan-50 text-cyan-700 rounded-lg inline-block group-hover:bg-cyan-100 transition-colors">
                          <Upload className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <h4 className="text-[11.5px] font-black uppercase tracking-wider text-slate-900">4. Driving Licence / Passport</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-normal pt-1">
                            Check and authenticate document register formats instantly to pass regulation.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-700 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Select Document Check <span className="text-xs">➔</span>
                      </span>
                    </button>

                    {/* Method 5: Facial age mesh biometric estimation */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgeCheckedActiveMethod('BIOMETRIC');
                        setAgeCheckedStep('verifying');
                      }}
                      className="text-left border border-slate-200 hover:border-cyan-500 hover:shadow-md rounded-xl p-4 transition-all bg-slate-50/20 flex flex-col justify-between gap-3 group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <span className="p-2 bg-cyan-50 text-cyan-700 rounded-lg inline-block group-hover:bg-cyan-100 transition-colors">
                          <Camera className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <h4 className="text-[11.5px] font-black uppercase tracking-wider text-slate-900">5. Facial Age Biometrics</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-normal pt-1">
                            Secure camera-based biometrics scan evaluating physical age markers in 3 seconds.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-700 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Start Facial Scan <span className="text-xs">➔</span>
                      </span>
                    </button>

                  </div>
                )}

                {/* ACTIVE VERIFICATION WORKFLOW DISPLAY */}
                {ageCheckedActiveMethod !== null && (
                  <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/40 space-y-4">
                    
                    {/* Active Header with Go Back */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-600 animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-cyan-800 tracking-wider">
                          {ageCheckedActiveMethod === 'ELECTORAL' && 'AgeChecked: Electoral Register Match'}
                          {ageCheckedActiveMethod === 'CARD' && 'AgeChecked: Payment Card Check'}
                          {ageCheckedActiveMethod === 'MOBILE' && 'AgeChecked: Mobile Operator Handshake'}
                          {ageCheckedActiveMethod === 'DOC' && 'AgeChecked: Document Integrity Check'}
                          {ageCheckedActiveMethod === 'BIOMETRIC' && 'AgeChecked: Facial Biometrics Scan'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetAgeCheckedVerification}
                        className="text-[9.5px] text-slate-500 hover:text-slate-800 font-black uppercase flex items-center gap-1 cursor-pointer hover:underline"
                      >
                        ✕ Cancel & Choose Other
                      </button>
                    </div>

                    {/* INTERACTIVE INPUT FORMS */}
                    {ageCheckedStep === 'input' && (
                      <div className="space-y-4 text-left">
                        
                        {/* 1. Electoral roll details */}
                        {ageCheckedActiveMethod === 'ELECTORAL' && (
                          <div className="space-y-3.5">
                            <p className="text-[10.5px] text-slate-500 font-bold leading-normal">
                              Enter your registered voter address details. AgeChecked matches public registries instantly without pulling credit histories.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Full Name</label>
                                <input
                                  type="text"
                                  value={electoralName}
                                  onChange={(e) => setElectoralName(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Date of Birth</label>
                                <input
                                  type="date"
                                  value={electoralDob}
                                  onChange={(e) => setElectoralDob(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                  required
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Registered Postcode</label>
                                <input
                                  type="text"
                                  value={electoralPostcode}
                                  onChange={(e) => setElectoralPostcode(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                  required
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (electoralDob) {
                                  setAgeCheckedStep('verifying');
                                } else {
                                  alert('Please specify your date of birth first.');
                                }
                              }}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                              Verify via Electoral Roll
                            </button>
                          </div>
                        )}

                        {/* 2. Card Check Details */}
                        {ageCheckedActiveMethod === 'CARD' && (
                          <div className="space-y-3.5">
                            <p className="text-[10.5px] text-slate-500 font-bold leading-normal">
                              Authorize a mock verification. Visa and Mastercard mandate that payment card issuers only issue active accounts to individuals 18+. We verify with the bank instantly.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1 sm:col-span-2">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Name on Card</label>
                                <input
                                  type="text"
                                  value={cardCheckName}
                                  onChange={(e) => setCardCheckName(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                  required
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Card Number (16-digit)</label>
                                <input
                                  type="text"
                                  placeholder="xxxx xxxx xxxx xxxx"
                                  value={cardCheckNumber}
                                  onChange={(e) => setCardCheckNumber(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                  required
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAgeCheckedStep('verifying')}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                              Simulate Bank Age Validation
                            </button>
                          </div>
                        )}

                        {/* 3. Mobile Network Verification */}
                        {ageCheckedActiveMethod === 'MOBILE' && (
                          <div className="space-y-3.5">
                            <p className="text-[10.5px] text-slate-500 font-bold leading-normal">
                              AgeChecked matches your cellular profile with carrier database registries to confirm you are registered as a bill-paying adult.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">UK Mobile Number</label>
                                <input
                                  type="tel"
                                  placeholder="e.g. 07700 900077"
                                  value={mobilePhone}
                                  onChange={(e) => setMobilePhone(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Network Carrier</label>
                                <select
                                  value={mobileNetwork}
                                  onChange={(e) => setMobileNetwork(e.target.value)}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                >
                                  <option value="EE">EE</option>
                                  <option value="O2">O2</option>
                                  <option value="Vodafone">Vodafone</option>
                                  <option value="Three">Three Mobile</option>
                                  <option value="Virgin Mobile">Virgin Mobile</option>
                                </select>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAgeCheckedStep('verifying')}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                              Send Handshake Signal
                            </button>
                          </div>
                        )}

                        {/* 4. Document check details */}
                        {ageCheckedActiveMethod === 'DOC' && (
                          <div className="space-y-3.5">
                            <p className="text-[10.5px] text-slate-500 font-bold leading-normal">
                              Please supply your document reference details. AgeChecked performs instant cryptographic register lookup matching.
                            </p>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Document Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {(['Passport', 'Driving License'] as const).map((doc) => (
                                    <button
                                      type="button"
                                      key={doc}
                                      onClick={() => setDocType(doc)}
                                      className={`py-2 px-3 text-[9.5px] font-black uppercase border rounded-lg transition-all ${
                                        docType === doc 
                                          ? 'border-cyan-600 bg-cyan-50 text-cyan-700' 
                                          : 'border-slate-200 bg-white text-slate-600'
                                      }`}
                                    >
                                      {doc === 'Passport' ? '✈️ UK Passport' : '🚗 UK Driving Licence'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">Full Name on Document</label>
                                  <input
                                    type="text"
                                    value={docName}
                                    onChange={(e) => setDocName(e.target.value)}
                                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white"
                                    required
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">
                                    {docType === 'Passport' ? 'Passport Number (9 Digits)' : 'Licence Number (18 Characters)'}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={docType === 'Passport' ? 'e.g. 504930122' : 'e.g. SMITH904837DS29'}
                                    value={docNumber}
                                    onChange={(e) => setDocNumber(e.target.value)}
                                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold bg-white font-mono"
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAgeCheckedStep('verifying')}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                              Verify Document Number
                            </button>
                          </div>
                        )}

                      </div>
                    )}

                    {/* VERIFYING SIMULATOR PROGRESS */}
                    {ageCheckedStep === 'verifying' && (
                      <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
                        
                        {/* Special Webcam Frame for Biometric, Standard Spin for Text Checks */}
                        {ageCheckedActiveMethod === 'BIOMETRIC' ? (
                          <div className="relative w-48 h-48 rounded-full border-4 border-dashed border-cyan-500 overflow-hidden bg-slate-900 flex items-center justify-center shadow-inner">
                            {ageCheckedLocalStream ? (
                              <video
                                ref={video => { if (video && ageCheckedLocalStream) { video.srcObject = ageCheckedLocalStream; } }}
                                autoPlay
                                playsInline
                                muted
                                className="absolute inset-0 w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <div className="text-slate-500 text-center space-y-2">
                                <Camera className="h-10 w-10 mx-auto text-slate-400 animate-pulse" />
                                <span className="text-[9px] font-bold block uppercase text-slate-400 px-3">Initializing Camera...</span>
                              </div>
                            )}
                            <div className="absolute inset-x-0 h-1 bg-cyan-400 opacity-80 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-[bounce_2s_infinite]" style={{ top: `${ageCheckedScanningProgress}%` }} />
                          </div>
                        ) : (
                          <div className="p-4 bg-cyan-50 text-cyan-600 rounded-full animate-spin">
                            <RefreshCw className="h-8 w-8" />
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-slate-800">
                            {ageCheckedActiveMethod === 'BIOMETRIC' ? 'Analyzing Face Geometry...' : 'AgeChecked Secure Verification in Progress...'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold leading-normal max-w-sm">
                            Querying compliant registers and validating age thresholds safely. This process adheres to PAS 1296 privacy requirements.
                          </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full max-w-xs space-y-1.5">
                          <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                            <span>Processing Match Rate</span>
                            <span>{ageCheckedScanningProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-cyan-600 h-full transition-all duration-100" style={{ width: `${ageCheckedScanningProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}
          </div>

          {/* Payment Gateway Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-600" /> 2. Worldpay Secure Gateway Payment
              </h3>
            </div>

            {/* HOSTED CHECKOUT GRAPHIC */}
            <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-850">Worldpay Checkout</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-md mx-auto">
                  You will be securely redirected to the official Worldpay Payment Gateway to finalize your transaction. Your payment details are processed entirely in Worldpay's isolated vault (PCI-DSS Compliant).
                </p>
              </div>
              <div className="flex justify-center gap-6 text-[10px] text-slate-400 font-extrabold uppercase">
                <span>✓ 256-bit SSL</span>
                <span>✓ 3D Secure 2.0</span>
                <span>✓ PCI Level 1</span>
              </div>
            </div>

            {/* Form Inputs */}
            <form onSubmit={handlePay} className="space-y-4">
              {paymentError && (
                <div className="flex gap-2 items-center bg-red-50 border border-red-150 p-3.5 rounded-xl text-xs font-bold text-red-650">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Secure Payment Trigger */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    <span>Processing Secure Gateway Auth...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-emerald-400" />
                    <span>
                      {finalTotalToPay === 0
                        ? `Complete Order using Store Credit (£0.00 to Pay)`
                        : `Pay Now (£${finalTotalToPay.toFixed(2)})`}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Secure developer terminal logs */}
          {showLogs && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-450 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Terminal className="h-4 w-4" />
                  <span className="font-extrabold text-[10px] tracking-wider uppercase">Worldpay Real-time Dev API Logs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-500">LISTENING</span>
                  <button 
                    onClick={() => setApiLogs([])}
                    className="text-[9px] underline text-slate-450 hover:text-white cursor-pointer ml-2"
                  >
                    Clear console
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {apiLogs.length === 0 ? (
                  <p className="text-slate-600 text-[10px] italic py-2">
                    &gt; Console silent. Submit a payment to inspect outbound gateway HTTP POST request &amp; JSON response telemetry stream...
                  </p>
                ) : (
                  apiLogs.map((log, i) => (
                    <div key={i} className="space-y-1 border-l-2 pl-3.5 border-slate-700/60">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-extrabold ${
                          log.type === 'REQUEST' ? 'text-blue-400' : log.type === 'RESPONSE' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          [{log.type}] {log.type === 'REQUEST' ? '➔ HTTP POST' : '✔ RESPONSE'}
                        </span>
                        <span className="text-slate-600 font-semibold">{log.timestamp}</span>
                      </div>
                      <pre className="text-[10px] text-slate-300 overflow-x-auto bg-slate-900/60 p-2 rounded-lg scrollbar-none font-mono">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Order summary basket review */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 sticky top-6">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-indigo-600" /> Order Summary Basket
            </h3>

            {/* Product items list */}
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

            {/* Store Credit application checkbox */}
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
                    Applying £{Math.min(loggedInCustomer.storeCredit, finalTotal).toFixed(2)} Store Credit deduction to order total.
                  </p>
                )}
              </div>
            )}

            {/* Promo / Referral Code Box */}
            <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-2xl text-xs space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Promo or Referral Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. CRUSHCLUB15 or REF-..."
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

            {/* Calculations review */}
            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs leading-normal font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal items</span>
                <span className="text-slate-800">£{rawSubtotal.toFixed(2)}</span>
              </div>

              {currentDiscount && (
                <div className="flex justify-between text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Promo/Referral Applied ({currentDiscount.title})
                  </span>
                  <span className="font-extrabold">-£{discountValue.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-500">
                <span>Delivery postage (Royal Mail)</span>
                <span>{deliveryCost === 0 ? 'FREE' : `£${deliveryCost.toFixed(2)}`}</span>
              </div>

              {applyStoreCredit && storeCreditApplied > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Store Credit Applied</span>
                  <span>-£{storeCreditApplied.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-150">
                <span>Total amount to pay</span>
                <span className="text-base text-indigo-700 font-black">£{finalTotalToPay.toFixed(2)}</span>
              </div>
            </div>

            {/* Verified badge */}
            <div className="border-t border-slate-100 pt-3.5 flex justify-center gap-4 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-emerald-500" /> SSL Encrypted</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-indigo-500" /> Worldpay Verified</span>
            </div>
          </div>

        </div>

      </div>

      {/* 3D SECURE (3DS) OVERLAY MODAL */}
      {show3dsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-6 shadow-2xl relative">
            
            {/* Worldpay Verified Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="text-left">
                <span className="text-[10px] font-black tracking-widest uppercase text-indigo-600 block leading-none">Worldpay Gateway</span>
                <span className="text-[9px] font-bold text-slate-450">Verified by Visa / Mastercard ID Check</span>
              </div>
              <span className="bg-slate-100 text-slate-800 font-black px-2 py-0.5 rounded text-[8px] uppercase tracking-widest">TEST SECURE</span>
            </div>

            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">
              <ShieldCheck className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-slate-900 uppercase">3D Secure Card Verification</h4>
              <p className="text-[10.5px] text-slate-500 font-bold leading-relaxed">
                Please enter the One-Time Passcode (OTP) sent to the cardholder's mobile device ending in **83 to approve the card authorisation.
              </p>
            </div>

            {/* Quick credentials details table */}
            <div className="bg-slate-50 rounded-xl p-3 text-left text-[10px] space-y-1.5 font-semibold text-slate-600">
              <div className="flex justify-between">
                <span>Merchant:</span>
                <span className="font-bold text-slate-800">POUCH SUPPLY CO.</span>
              </div>
              <div className="flex justify-between">
                <span>Total Charge:</span>
                <span className="font-bold text-slate-800">£{finalTotal.toFixed(2)} GBP</span>
              </div>
              <div className="flex justify-between">
                <span>Secure Session ID:</span>
                <span className="font-mono text-slate-500">{threeDsTxId}</span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Enter One-Time Passcode</label>
                <input
                  type="text"
                  required
                  placeholder="Enter 1234 to authorize"
                  value={threeDsOtp}
                  onChange={(e) => setThreeDsOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-sm p-3 border border-slate-250 bg-slate-50/50 rounded-xl font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-slate-300"
                />
              </div>

              {threeDsError && (
                <div className="flex gap-2 items-center text-[10px] font-bold text-red-650 bg-red-50 p-2.5 rounded-lg border border-red-150">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{threeDsError}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShow3dsModal(false);
                    setPaymentError('3DS Authentication cancelled by client.');
                  }}
                  className="w-1/2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel Auth
                </button>
                <button
                  type="button"
                  onClick={handleVerify3ds}
                  disabled={isProcessing}
                  className="w-1/2 bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Submit Code</span>
                  )}
                </button>
              </div>

              <div className="pt-2 text-[9px] text-slate-400 font-bold leading-normal">
                🔐 Worldpay 256-Bit SSL Encrypted Direct Checkout Payment System.
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
