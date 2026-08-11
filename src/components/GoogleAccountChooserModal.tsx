import React, { useState } from 'react';
import { X, User, ArrowLeft } from 'lucide-react';

export interface GoogleAccountOption {
  name: string;
  email: string;
  avatarBg?: string;
  avatarText?: string;
}

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: { email: string; name: string; picture?: string }) => void;
  isLoading?: boolean;
}

const DEFAULT_ACCOUNTS: GoogleAccountOption[] = [
  {
    name: 'neha bhardwaz',
    email: 'nehabhardwaz.gtl@gmail.com',
    avatarBg: 'bg-[#8d6e63]',
    avatarText: 'n',
  },
  {
    name: 'Scott Kivlin',
    email: 'scottkivlinpouch@gmail.com',
    avatarBg: 'bg-slate-900',
    avatarText: 'S',
  },
  {
    name: 'rahul dhiman',
    email: 'rahul@prowebcoder.com',
    avatarBg: 'bg-[#3f51b5]',
    avatarText: 'r',
  },
  {
    name: 'ajay thakur',
    email: 'mblesscenter@gmail.com',
    avatarBg: 'bg-[#4caf50]',
    avatarText: 'a',
  },
];

export default function GoogleAccountChooserModal({
  isOpen,
  onClose,
  onSelectAccount,
  isLoading = false,
}: GoogleAccountChooserModalProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    const nameToUse = customName.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    onSelectAccount({
      email: cleanEmail,
      name: nameToUse,
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all">
        {/* Google Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-150 bg-white">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="text-xs font-semibold text-slate-600">Sign in with Google</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* Logo / Branding header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black text-xs tracking-tight shadow-xs">
                PS
              </div>
            </div>
            <h2 className="text-2xl font-normal text-slate-900 tracking-tight">Choose an account</h2>
            <p className="text-xs text-slate-600 mt-1">
              to continue to <span className="font-semibold text-indigo-600">Pouch Supply</span>
            </p>
          </div>

          {!showCustomInput ? (
            /* Account list */
            <div className="divide-y divide-slate-100 border-t border-b border-slate-100 mb-6">
              {DEFAULT_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSelectAccount({ email: account.email, name: account.name })}
                  className="w-full flex items-center gap-3 py-3 px-1 hover:bg-slate-50/80 transition-colors cursor-pointer text-left group"
                >
                  <div className={`h-9 w-9 rounded-full ${account.avatarBg || 'bg-slate-700'} text-white flex items-center justify-center text-sm font-medium shrink-0 shadow-2xs`}>
                    {account.avatarText}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 group-hover:text-slate-950 truncate">
                      {account.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {account.email}
                    </p>
                  </div>
                </button>
              ))}

              {/* Use another account option */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => { setShowCustomInput(true); setError(''); }}
                className="w-full flex items-center gap-3 py-3 px-1 hover:bg-slate-50/80 transition-colors cursor-pointer text-left group"
              >
                <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 group-hover:text-slate-950">
                    Use another account
                  </p>
                </div>
              </button>
            </div>
          ) : (
            /* Custom account input form */
            <form onSubmit={handleCustomSubmit} className="space-y-4 mb-6">
              <button
                type="button"
                onClick={() => setShowCustomInput(false)}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mb-1 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to account list
              </button>

              {error && (
                <div className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">
                  Gmail or Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Smith"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Next / Sign in'}
              </button>
            </form>
          )}

          {/* Footer note matching Google's footer */}
          <p className="text-[10.5px] text-slate-500 leading-relaxed">
            Before using this app, you can review Pouch Supply's{' '}
            <span className="text-indigo-600 hover:underline cursor-pointer font-medium">Privacy Policy</span> and{' '}
            <span className="text-indigo-600 hover:underline cursor-pointer font-medium">Terms of Service</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
