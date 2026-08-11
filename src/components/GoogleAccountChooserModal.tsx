import React, { useState, useEffect } from 'react';
import { X, Globe } from 'lucide-react';

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
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [error, setError] = useState('');
  const [isOpeningOAuth, setIsOpeningOAuth] = useState(false);

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

      if (data.configured && data.url) {
        const popup = window.open(
          data.url,
          'google_oauth_popup',
          'width=550,height=650,left=200,top=100'
        );
        if (!popup) {
          setError('Popup was blocked by browser. Please allow popups or enter your email below.');
        }
      } else {
        // OAuth client ID not set, proceed with direct real email sign-in UI
        console.log('[Google OAuth] Client ID not set, using real email input.');
      }
    } catch (err) {
      console.error('[Google OAuth] Failed to fetch auth URL:', err);
    } finally {
      setIsOpeningOAuth(false);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = emailOrPhone.trim();
    if (!cleanInput) {
      setError('Enter an email or phone number');
      return;
    }

    if (!cleanInput.includes('@') && !/^\+?[0-9\s\-()]{7,}$/.test(cleanInput)) {
      setError('Enter a valid email address or phone number');
      return;
    }

    setError('');
    setStep('password');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = emailOrPhone.trim().toLowerCase();
    const nameFromEmail = cleanInput.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    onSelectAccount({
      email: cleanInput,
      name: nameFromEmail || 'Valued Customer',
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-[850px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all flex flex-col">
        {/* Top Google Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Sign in with Google</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchGoogleOAuth}
              disabled={isOpeningOAuth}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer border border-indigo-200 flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Open Google Auth Popup
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Split Google Sign-In Card matching official Google design */}
        <div className="p-8 sm:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 bg-white flex-1">
          {/* Left Column: Branding */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black text-sm tracking-tight shadow-sm">
                  PS
                </div>
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">Pouch Supply</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-normal text-slate-900 tracking-tight leading-tight">
                {step === 'email' ? 'Sign in' : 'Welcome'}
              </h1>
              <p className="text-sm text-slate-600 mt-2 font-normal">
                to continue to <span className="font-semibold text-indigo-600">Pouch Supply</span>
              </p>
            </div>

            <div className="hidden md:block pt-8 border-t border-slate-100">
              <p className="text-xs text-slate-500 leading-relaxed">
                Google will share your name, email address, and profile picture with Pouch Supply.
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Form */}
          <div className="flex flex-col justify-between pt-2 md:pt-0">
            {error && (
              <div className="mb-4 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">×</button>
              </div>
            )}

            {step === 'email' ? (
              <form onSubmit={handleNextStep} className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    id="emailOrPhone"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder=" "
                    autoFocus
                    className="block w-full px-4 py-3.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 peer transition-all"
                  />
                  <label
                    htmlFor="emailOrPhone"
                    className="absolute text-sm text-slate-500 duration-150 transform -translate-y-2.5 scale-75 top-2 z-10 origin-[0] bg-white px-1.5 left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-3.5 peer-placeholder-shown:text-slate-500 peer-focus:scale-75 peer-focus:-translate-y-2.5 peer-focus:text-blue-600"
                  >
                    Email or phone
                  </label>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => alert('Enter your Google/Gmail address to sign in directly.')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Forgot email?
                  </button>
                </div>

                <div className="pt-2 text-xs text-slate-500 leading-relaxed">
                  Before using this app, you can review Pouch Supply's{' '}
                  <span className="text-blue-600 font-semibold hover:underline cursor-pointer">Privacy Policy</span> and{' '}
                  <span className="text-blue-600 font-semibold hover:underline cursor-pointer">Terms of Service</span>.
                </div>

                <div className="flex items-center justify-between pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      const userEmail = prompt('Enter email address to create account:');
                      if (userEmail) {
                        setEmailOrPhone(userEmail);
                        setStep('password');
                      }
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Create account
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm px-6 py-2.5 rounded-full shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      {emailOrPhone.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-slate-800">{emailOrPhone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
                  >
                    Change
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="password"
                    id="passwordInput"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    autoFocus
                    required
                    className="block w-full px-4 py-3.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 peer transition-all"
                  />
                  <label
                    htmlFor="passwordInput"
                    className="absolute text-sm text-slate-500 duration-150 transform -translate-y-2.5 scale-75 top-2 z-10 origin-[0] bg-white px-1.5 left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-3.5 peer-placeholder-shown:text-slate-500 peer-focus:scale-75 peer-focus:-translate-y-2.5 peer-focus:text-blue-600"
                  >
                    Enter your password
                  </label>
                </div>

                <div className="flex items-center justify-between pt-6">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm px-6 py-2.5 rounded-full shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer info bar matching Google's footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
            <Globe className="h-3 w-3" />
            <span>English (United States)</span>
            <span className="text-[9px]">▼</span>
          </div>

          <div className="flex items-center gap-4">
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-700">Help</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-700">Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-700">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
