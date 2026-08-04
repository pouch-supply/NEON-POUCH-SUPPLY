import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, AlertCircle, CheckCircle2, Lock, Sparkles, RefreshCw, X, UserCheck, Calendar, MapPin, Building2, User } from 'lucide-react';
import { AgeCheckedVerificationRequest, AgeCheckedVerificationResult } from '../types';

interface AgeCheckedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (result: AgeCheckedVerificationResult) => void;
  minAge?: number;
  initialCustomerData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    addressLine1?: string;
    city?: string;
    postalCode?: string;
    phone?: string;
  };
}

export default function AgeCheckedModal({
  isOpen,
  onClose,
  onVerified,
  minAge = 18,
  initialCustomerData
}: AgeCheckedModalProps) {
  const [formData, setFormData] = useState<AgeCheckedVerificationRequest>({
    firstName: initialCustomerData?.firstName || '',
    lastName: initialCustomerData?.lastName || '',
    dob: '',
    addressLine1: initialCustomerData?.addressLine1 || '',
    city: initialCustomerData?.city || '',
    postalCode: initialCustomerData?.postalCode || '',
    country: 'GB',
    email: initialCustomerData?.email || '',
    phone: initialCustomerData?.phone || ''
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingStep, setVerifyingStep] = useState<string>('');
  const [errorResult, setErrorResult] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<AgeCheckedVerificationResult | null>(null);

  useEffect(() => {
    if (initialCustomerData) {
      setFormData(prev => ({
        ...prev,
        firstName: initialCustomerData.firstName || prev.firstName,
        lastName: initialCustomerData.lastName || prev.lastName,
        email: initialCustomerData.email || prev.email,
        addressLine1: initialCustomerData.addressLine1 || prev.addressLine1,
        city: initialCustomerData.city || prev.city,
        postalCode: initialCustomerData.postalCode || prev.postalCode,
        phone: initialCustomerData.phone || prev.phone
      }));
    }
  }, [initialCustomerData]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorResult(null);
    setSuccessResult(null);

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorResult('Please enter your full first name and last name.');
      return;
    }

    if (!formData.dob) {
      setErrorResult('Date of birth is required to verify your age.');
      return;
    }

    setIsVerifying(true);
    setVerifyingStep('Connecting to AgeChecked Identity Register...');

    const timer1 = setTimeout(() => {
      setVerifyingStep('Cross-referencing electoral roll & official registers...');
    }, 1200);

    const timer2 = setTimeout(() => {
      setVerifyingStep('Validating age threshold compliance (18+)...');
    }, 2400);

    try {
      const response = await fetch('/api/agechecked/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          minAge
        })
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data: AgeCheckedVerificationResult = await response.json();

      setIsVerifying(false);

      if (data.success && data.verified) {
        setSuccessResult(data);
        
        // Cache verification in sessionStorage so user isn't prompted again in this session
        try {
          sessionStorage.setItem('ps_agechecked_verified', JSON.stringify({
            verified: true,
            ageCheckedId: data.ageCheckedId,
            timestamp: new Date().toISOString(),
            customerEmail: formData.email,
            minAge
          }));
        } catch (e) {}

        // Proceed to checkout after brief confirmation view
        setTimeout(() => {
          onVerified(data);
        }, 1200);
      } else {
        setErrorResult(data.reason || `Age Verification Failed. You must be at least ${minAge} years old to complete checkout.`);
      }
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsVerifying(false);
      setErrorResult(`Verification system error: ${err.message || 'Unable to connect to AgeChecked service.'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#dfa047] text-slate-950 rounded-xl font-extrabold shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#dfa047]">Official AgeChecked Verification</span>
                <span className="bg-slate-800 text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded">UK {minAge}+ COMPLIANT</span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-0.5">Verify Age to Proceed</h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isVerifying}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice banner */}
        <div className="bg-amber-50 border-b border-amber-200/80 p-3.5 px-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed font-medium">
            Nicotine pouches and pouch supply products are age-restricted to customers aged <strong>{minAge}+</strong>. We use <strong>AgeChecked</strong> to verify age without impacting your credit score.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">

          {/* Success screen */}
          {successResult && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h4 className="text-lg font-black text-slate-900">Age Verified Successfully!</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                AgeChecked Ref: <span className="font-mono font-bold text-slate-800">{successResult.ageCheckedId || 'AC_VERIFIED_OK'}</span>
              </p>
              <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 py-2 px-4 rounded-xl border border-emerald-200 max-w-xs mx-auto">
                ✓ Proceeding to Worldpay Secure Checkout...
              </p>
            </div>
          )}

          {/* Error / Underage Screen */}
          {errorResult && !isVerifying && !successResult && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Verification Decision: Blocked</span>
              </div>
              <p className="text-xs text-rose-900 font-medium leading-relaxed">
                {errorResult}
              </p>
              <p className="text-[10px] text-rose-700 pt-1">
                If you believe this is an error, please double check your name and birth date or contact support at <a href="mailto:support@pouch-supply.com" className="underline font-bold">support@pouch-supply.com</a>.
              </p>
            </div>
          )}

          {/* Form inputs */}
          {!successResult && (
            <form onSubmit={handleVerify} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" /> First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="e.g. Alexander"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#dfa047] focus:bg-white transition-all outline-none"
                    disabled={isVerifying}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" /> Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="e.g. Smith"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#dfa047] focus:bg-white transition-all outline-none"
                    disabled={isVerifying}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" /> Date of Birth *
                </label>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={e => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#dfa047] focus:bg-white transition-all outline-none font-medium"
                  disabled={isVerifying}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" /> Delivery Postcode / Address
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="e.g. SW1A 1AA"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#dfa047] focus:bg-white transition-all outline-none"
                    disabled={isVerifying}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#dfa047] outline-none font-semibold"
                    disabled={isVerifying}
                  >
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="IE">Ireland (IE)</option>
                    <option value="US">United States (US)</option>
                  </select>
                </div>
              </div>

              {/* Submit button / spinner */}
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-[#dfa047]" />
                    <span>{verifyingStep}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 text-[#dfa047]" />
                    <span>Verify Age & Continue to Checkout</span>
                  </>
                )}
              </button>

            </form>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-emerald-600" /> 256-Bit Encrypted AgeCheck API
            </span>
            <span className="font-semibold text-slate-500">Pouch Supply Compliance</span>
          </div>

        </div>

      </div>
    </div>
  );
}
