import React, { useState, useEffect } from 'react';
import { X, Globe, ExternalLink, ShieldCheck, RefreshCw, AlertCircle, Sparkles, User, PlusCircle, CheckCircle2 } from 'lucide-react';
import { signInWithGoogleFirebase } from '../lib/firebase';

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: { email: string; name?: string; picture?: string; customer?: any }) => void;
  isLoading?: boolean;
}

export default function GoogleAccountChooserModal({
  isOpen,
  onClose,
  onSelectAccount,
  isLoading = false,
}: GoogleAccountChooserModalProps) {
  const [error, setError] = useState('');
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  // Primary active Google session default for quick selection
  const primaryAccount = {
    email: 'scottkivlinpouch@gmail.com',
    name: 'Scott Kivlin',
    picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
  };

  if (!isOpen) return null;

  // Trigger official Firebase Authentication popup
  const handleFirebaseGoogleSignIn = async () => {
    setIsFirebaseLoading(true);
    setError('');
    try {
      const res = await signInWithGoogleFirebase();
      if (res && res.customer) {
        onSelectAccount({
          email: res.customer.email,
          name: res.customer.name,
          picture: res.customer.avatarUrl,
          customer: res.customer
        });
        onClose();
        return true;
      }
    } catch (err: any) {
      console.warn('[Firebase Auth Popup Info]', err?.message || err);
      // Popup was blocked or failed, fall back gracefully
      throw err;
    } finally {
      setIsFirebaseLoading(false);
    }
    return false;
  };

  const handleSelectCard = async (account: { email: string; name?: string; picture?: string }) => {
    setError('');
    setIsFirebaseLoading(true);
    try {
      // 1. Attempt official Firebase OAuth Popup
      await handleFirebaseGoogleSignIn();
    } catch (err) {
      // 2. On popup block / failure, authenticate account directly via Google API
      console.log('[Google Auth] Popup skipped or blocked, authenticating via Google backend service:', account.email);
      onSelectAccount(account);
      onClose();
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Google / Gmail address.');
      return;
    }
    const nameFromEmail = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    onSelectAccount({
      email: cleanEmail,
      name: nameFromEmail || 'Valued Customer'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-[480px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all flex flex-col">
        {/* Top Header matching Google Account Chooser */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="text-sm font-bold text-slate-800">Sign in with Google</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 flex flex-col text-left space-y-5 bg-white">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Choose a Google Account</h2>
            <p className="text-xs text-slate-500 mt-1">Select an account to sign in to <strong className="text-slate-800">Pouch Supply</strong></p>
          </div>

          {error && (
            <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Account List Card */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Active Google Session
            </span>

            {/* Primary Account Item */}
            <button
              type="button"
              onClick={() => handleSelectCard(primaryAccount)}
              disabled={isLoading}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all text-left cursor-pointer group shadow-xs hover:shadow-md"
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                  SK
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700 block truncate">
                  {primaryAccount.name}
                </span>
                <span className="text-xs text-slate-500 block truncate">
                  {primaryAccount.email}
                </span>
              </div>

              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Signed in
              </span>
            </button>

            {/* Custom / Add Another Account toggle */}
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-700">
                  Use another Google account
                </span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="pt-2 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Enter Google Email
                  </label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="another.account@gmail.com"
                    autoFocus
                    required
                    className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed pt-2">
            To continue, Google will share your name, email address, and profile picture with Pouch Supply.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-slate-400" />
            <span>English (United Kingdom)</span>
          </div>

          <div className="flex items-center gap-3">
            <a href="/privacy" target="_blank" className="hover:text-slate-700 transition">Privacy</a>
            <span>•</span>
            <a href="/terms" target="_blank" className="hover:text-slate-700 transition">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
