import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Key, Globe, CheckCircle2, AlertTriangle, 
  RefreshCw, Save, Eye, EyeOff, Lock, Server, Activity, Sliders, ToggleLeft, ToggleRight, Sparkles
} from 'lucide-react';
import { AgeCheckedSettings, AgeCheckedAuditLog } from '../../types';

export function AgeCheckedSettingsTab() {
  const [settings, setSettings] = useState<AgeCheckedSettings>({
    enabled: true,
    environment: 'staging',
    username: '',
    password: '',
    publicKey: '',
    secretKey: '',
    stagingUrl: 'https://staging-api.agechecked.com/v1',
    liveUrl: 'https://api.agechecked.com/v1',
    minAge: 18,
    restrictAllProducts: true,
    restrictedCategories: ['Nicotine Pouches', 'Vapes', 'Tobacco Products']
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Test API state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    environment?: string;
    apiUrl?: string;
    status?: number;
    timestamp?: string;
    details?: any;
  } | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AgeCheckedAuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchAuditLogs();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/agechecked/config');
      const data = await res.json();
      if (data.success && data.config) {
        setSettings(prev => ({ ...prev, ...data.config }));
      }
    } catch (err) {
      console.warn('Failed to load AgeChecked settings from backend API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/agechecked/audit-logs');
      const data = await res.json();
      if (data.success && data.logs) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      const res = await fetch('/api/agechecked/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess('AgeChecked configuration saved successfully!');
        setTimeout(() => setSaveSuccess(null), 3500);
      }
    } catch (err) {
      alert('Failed to save AgeChecked settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/agechecked/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Network error running AgeChecked test: ${err.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Page Title & Status Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#dfa047]/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#dfa047] text-slate-950 rounded-2xl font-black shadow-md">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-[#dfa047]">Official Integration</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  settings.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {settings.enabled ? '● Age Verification Active' : '○ Integration Disabled'}
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                  settings.environment === 'live' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {settings.environment.toUpperCase()} MODE
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1">AgeChecked Compliance Hub</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Seamless age verification for nicotine pouches & restricted items. Customer age verified before checkout via the official AgeChecked API.
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="self-start sm:self-center px-6 py-3 bg-[#dfa047] hover:bg-[#c98e3b] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column - Policy & Credentials Settings */}
        <div className="lg:col-span-2 space-y-6">

          {/* Policy Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Sliders className="h-5 w-5 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-base">Verification Policy & Mode</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  settings.enabled 
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {settings.enabled ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                <span>{settings.enabled ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  API Target Environment
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, environment: 'staging' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      settings.environment === 'staging'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    🧪 Staging
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, environment: 'live' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      settings.environment === 'live'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    🔴 Live Production
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Minimum Age Threshold
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={18}
                    max={25}
                    value={settings.minAge}
                    onChange={e => setSettings({ ...settings, minAge: parseInt(e.target.value, 10) || 18 })}
                    className="w-24 p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-sm text-center focus:bg-white outline-none"
                  />
                  <span className="text-xs text-slate-500 font-semibold">Years Old (UK default is 18+)</span>
                </div>
              </div>

            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.restrictAllProducts}
                  onChange={e => setSettings({ ...settings, restrictAllProducts: e.target.checked })}
                  className="rounded text-[#dfa047] focus:ring-[#dfa047] h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-800">
                  Require AgeChecked verification for all orders containing nicotine pouch products
                </span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1 pl-6">
                When enabled, clicking "Proceed to Checkout" opens the AgeChecked verification popup before allowing payment.
              </p>
            </div>
          </div>

          {/* Credentials Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <Key className="h-5 w-5 text-slate-700" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">API Keys & Authentication Credentials</h3>
                <p className="text-xs text-slate-400">Configure your official AgeChecked merchant credentials.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  AgeChecked Username
                </label>
                <input
                  type="text"
                  value={settings.username}
                  onChange={e => setSettings({ ...settings, username: e.target.value })}
                  placeholder="e.g. pouchsupply_merchant"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={settings.password || ''}
                    onChange={e => setSettings({ ...settings, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Public API Key
                </label>
                <input
                  type="text"
                  value={settings.publicKey}
                  onChange={e => setSettings({ ...settings, publicKey: e.target.value })}
                  placeholder="e.g. pk_live_pouchsupply_xxx"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Secret API Key
                </label>
                <div className="relative">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={settings.secretKey || ''}
                    onChange={e => setSettings({ ...settings, secretKey: e.target.value })}
                    placeholder="sk_live_pouchsupply_secret_xxx"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Staging Endpoint URL
                </label>
                <input
                  type="text"
                  value={settings.stagingUrl}
                  onChange={e => setSettings({ ...settings, stagingUrl: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Live Endpoint URL
                </label>
                <input
                  type="text"
                  value={settings.liveUrl}
                  onChange={e => setSettings({ ...settings, liveUrl: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono text-slate-600"
                />
              </div>
            </div>

          </div>

        </div>

        {/* Right Column - Connection Test & Diagnostic Panel */}
        <div className="space-y-6">

          {/* Diagnostics Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-[#dfa047]" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-200">API Connection Diagnostic</h3>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">HANDSHAKE</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Run a live server-side test to verify authentication and communication with the AgeChecked API endpoint.
            </p>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full py-3 bg-[#dfa047] hover:bg-[#c98e3b] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Test AgeChecked Connection</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                testResult.success 
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
                  : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {testResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
                  <span>{testResult.success ? 'Handshake Successful' : 'Connection Error'}</span>
                </div>
                <p className="text-[11px] leading-relaxed font-medium">
                  {testResult.message}
                </p>
                {testResult.apiUrl && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono space-y-1 text-slate-400">
                    <div>Endpoint: <span className="text-white">{testResult.apiUrl}</span></div>
                    <div>Env Mode: <span className="text-[#dfa047] uppercase">{testResult.environment}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Setup Reference Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-amber-700" />
              <span>Integration Checklist</span>
            </div>
            <ul className="text-xs text-amber-950 space-y-2 list-disc list-inside font-medium leading-relaxed">
              <li>Verified customers are remembered per browser session.</li>
              <li>Underage/failed checks immediately block order placement.</li>
              <li>No order created in database until AgeChecked & Worldpay succeed.</li>
            </ul>
          </div>

        </div>

      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-slate-700" /> AgeChecked Verification Telemetry
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Live audit trail of age checks performed during customer checkout sessions.</p>
          </div>
          <button
            onClick={fetchAuditLogs}
            className="text-xs font-extrabold text-[#dfa047] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} /> Refresh Telemetry
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center italic">No age verification attempts logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Environment</th>
                  <th className="p-3">Age Checked Ref ID</th>
                  <th className="p-3">Decision Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      <div>{log.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{log.customerEmail}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        log.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status === 'APPROVED' ? '✓ APPROVED' : '❌ DECLINED'}
                      </span>
                    </td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">
                      {log.environment} ({log.minAgeRequired}+)
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-700">
                      {log.ageCheckedId || 'N/A'}
                    </td>
                    <td className="p-3 text-[11px] text-slate-500">
                      {log.reason || 'Age verified & cleared for checkout.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
