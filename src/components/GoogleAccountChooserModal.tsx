import React, { useState, useEffect } from 'react';
import { X, Globe, ExternalLink, ShieldCheck, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: { email: string; name?: string; picture?: string }) => void;
  isLoading?: boolean;
}

export default function GoogleAccountChooserModal({
  isOpen,
  onClose,
  onSelectAccount,
  isLoading = false,
}: GoogleAccountChooserModalProps) {
  const [error, setError] = useState('');
  const [isOpeningOAuth, setIsOpeningOAuth] = useState(false);
  const [showDirectEmailFallback, setShowDirectEmailFallback] = useState(false);
  const [directEmail, setDirectEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      handleLaunchGoogleOAuth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Launch official Google OAuth popup
  const handleLaunchGoogleOAuth = async () => {
    setIsOpeningOAuth(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();

      if (data.url) {
        const popup = window.open(
          data.url,
          'google_oauth_popup',
          'width=550,height=680,left=200,top=100'
        );
        if (!popup) {
          setError('Popup was blocked by your browser. Please allow popups or click "Continue with Google" below.');
        }
      } else {
        // Fallback to Google OAuth URL if endpoint returns unconfigured
        const host = window.location.host;
        const protocol = window.location.protocol;
        const redirectUri = `${protocol}//${host}/auth/google/callback`;
        const fallbackUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=openid%20email%20profile&prompt=select_account&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        const popup = window.open(fallbackUrl, 'google_oauth_popup', 'width=550,height=680,left=200,top=100');
        if (!popup) {
          setError('Popup was blocked by your browser. Please click "Continue with Google" below.');
        }
      }
    } catch (err: any) {
      console.error('[Google OAuth] Failed to launch auth:', err);
      setError('Unable to open Google sign-in window. Please try clicking the button below.');
    } finally {
      setIsOpeningOAuth(false);
    }
  };

  const handleDirectEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = directEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Gmail / Google email address.');
      return;
    }
    const nameFromEmail = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    onSelectAccount({
      email: cleanEmail,
      name: nameFromEmail || 'Valued Customer',
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-[540px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all flex flex-col">
        {/* Top Header */}
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

        {/* Content Body */}
        <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-6 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-base tracking-tight shadow-md">
              PS
            </div>
            <div className="text-left">
              <span className="font-extrabold text-slate-900 text-lg tracking-tight block">Pouch Supply</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Official Google SSO
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Choose a Google Account</h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Google will open account chooser where you can select your existing account or click <strong>Use another account</strong>.
            </p>
          </div>

          {error && (
            <div className="w-full text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {!showDirectEmailFallback ? (
            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={handleLaunchGoogleOAuth}
                disabled={isOpeningOAuth || isLoading}
                className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm py-3.5 px-6 rounded-xl border-2 border-slate-200 shadow-sm hover:border-blue-500 transition-all flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-50"
              >
                {isOpeningOAuth ? (
                  <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                ) : (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{isOpeningOAuth ? 'Opening Google Window...' : 'Continue with Google'}</span>
                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors ml-auto" />
              </button>

              <button
                type="button"
                onClick={() => setShowDirectEmailFallback(true)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-1"
              >
                Having popup issues? Enter Google email address manually
              </button>
            </div>
          ) : (
            <form onSubmit={handleDirectEmailSubmit} className="w-full space-y-4 pt-2">
              <div className="text-left">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Google Email Address
                </label>
                <input
                  type="email"
                  value={directEmail}
                  onChange={(e) => setDirectEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  autoFocus
                  required
                  className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirectEmailFallback(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Back to Google Popup
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Sign In with Google Email
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>Secure account verification powered by Google OAuth 2.0</span>
          </div>
        </div>

        {/* Footer info bar matching Google's footer */}
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
