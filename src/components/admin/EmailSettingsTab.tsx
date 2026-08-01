import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, CheckCircle2, AlertCircle, Eye, Settings, RefreshCw, 
  Trash2, ShieldCheck, Zap, Lock, Filter, Smartphone, Monitor, Code, 
  ExternalLink, Layers, Sparkles, Check, Play, User, ShoppingBag, DollarSign, RotateCcw
} from 'lucide-react';

export interface EmailSettings {
  enabled: boolean;
  resendApiKey: string;
  fromEmail: string;
  adminNotificationEmail: string;
  templates: Record<string, {
    enabled: boolean;
    subject: string;
  }>;
}

export interface KlaviyoSettings {
  enabled: boolean;
  apiKey: string;
  publicKey: string;
  listId?: string;
  trackEvents: Record<string, boolean>;
}

export interface EmailLogEntry {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'simulated' | 'failed' | 'disabled';
  resendId?: string;
  error?: string;
  timestamp: string;
  metadata?: any;
}

export interface KlaviyoLogEntry {
  id: string;
  eventName: string;
  customerEmail: string;
  status: 'sent' | 'simulated' | 'failed' | 'disabled';
  error?: string;
  timestamp: string;
  payload?: any;
}

const TEMPLATE_OPTIONS = [
  { id: 'order_confirmation', label: 'Order Confirmation', category: 'Transactional' },
  { id: 'order_processing', label: 'Order Processing', category: 'Fulfillment' },
  { id: 'order_shipped', label: 'Order Shipped / Dispatched', category: 'Fulfillment' },
  { id: 'out_for_delivery', label: 'Out for Delivery', category: 'Fulfillment' },
  { id: 'order_delivered', label: 'Order Delivered', category: 'Fulfillment' },
  { id: 'order_cancelled', label: 'Order Cancelled', category: 'Transactional' },
  { id: 'order_refunded', label: 'Order Refunded', category: 'Transactional' },
  { id: 'password_reset', label: 'Password Reset', category: 'Account' },
  { id: 'email_verification', label: 'Email Verification', category: 'Account' },
  { id: 'welcome_email', label: 'Welcome Email', category: 'Marketing' },
  { id: 'admin_new_order', label: 'Admin New Order Notification', category: 'Admin' },
];

export function EmailSettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'templates' | 'preview' | 'test' | 'logs' | 'klaviyo'>('config');
  
  // Settings state
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [klaviyoSettings, setKlaviyoSettings] = useState<KlaviyoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logs state
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [klaviyoLogs, setKlaviyoLogs] = useState<KlaviyoLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState('all');

  // Preview state
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState('order_confirmation');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Test email state
  const [testRecipient, setTestRecipient] = useState('scottkivlinpouch@gmail.com');
  const [testTemplate, setTestTemplate] = useState('order_confirmation');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Fetch all configuration and logs on load
  const loadData = async () => {
    setLoading(true);
    try {
      const [emailRes, klaviyoRes, emailLogsRes, klaviyoLogsRes] = await Promise.all([
        fetch('/api/email/settings'),
        fetch('/api/klaviyo/settings'),
        fetch('/api/email/logs'),
        fetch('/api/klaviyo/logs')
      ]);

      if (emailRes.ok) setEmailSettings(await emailRes.ok ? await emailRes.json() : null);
      if (klaviyoRes.ok) setKlaviyoSettings(await klaviyoRes.ok ? await klaviyoRes.json() : null);
      if (emailLogsRes.ok) setEmailLogs(await emailLogsRes.json());
      if (klaviyoLogsRes.ok) setKlaviyoLogs(await klaviyoLogsRes.json());
    } catch (err: any) {
      console.error('Failed to load email settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch preview HTML when selected template changes or when preview tab opens
  useEffect(() => {
    if (activeSubTab === 'preview') {
      fetchPreview(selectedPreviewTemplate);
    }
  }, [selectedPreviewTemplate, activeSubTab]);

  const fetchPreview = async (templateId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: templateId })
      });
      const html = await res.text();
      setPreviewHtml(html);
    } catch (err: any) {
      setPreviewHtml(`<div style="padding:20px; color:red;">Failed to load template preview</div>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!emailSettings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Resend Email settings saved successfully!' });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKlaviyoSettings = async () => {
    if (!klaviyoSettings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/klaviyo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(klaviyoSettings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Klaviyo settings saved successfully!' });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save Klaviyo settings' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving Klaviyo settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: testRecipient,
          type: testTemplate,
          apiKey: emailSettings?.resendApiKey,
          fromEmail: emailSettings?.fromEmail
        })
      });
      const data = await res.json();
      setTestResult(data);
      // Reload logs
      const logsRes = await fetch('/api/email/logs');
      if (logsRes.ok) setEmailLogs(await logsRes.json());
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Failed to send test email' });
    } finally {
      setTestSending(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all email activity logs?')) return;
    try {
      await fetch('/api/email/logs/clear', { method: 'POST' });
      setEmailLogs([]);
    } catch (err) {}
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin mr-3 text-teal-600" />
        <span>Loading Email & Marketing System...</span>
      </div>
    );
  }

  const filteredLogs = emailLogs.filter(log => {
    if (logFilter === 'all') return true;
    return log.status === logFilter || log.type === logFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Mail className="h-48 w-48 text-teal-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Zap className="h-3 w-3 text-teal-400" /> Production Email Engine
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Resend + React Email + Klaviyo
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Email & Marketing System</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Manage transactional email dispatch, responsive branding templates, automated triggers, and Klaviyo marketing telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${
              emailSettings?.resendApiKey ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }`}>
              <ShieldCheck className="h-4 w-4" />
              {emailSettings?.resendApiKey ? 'Resend Connected' : 'Resend Simulated'}
            </div>

            <div className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${
              klaviyoSettings?.apiKey ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Sparkles className="h-4 w-4" />
              {klaviyoSettings?.apiKey ? 'Klaviyo Active' : 'Klaviyo Simulated'}
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'config' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Settings className="h-3.5 w-3.5" /> API & Configuration
          </button>

          <button
            onClick={() => setActiveSubTab('templates')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'templates' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> Templates & Toggles
          </button>

          <button
            onClick={() => setActiveSubTab('preview')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'preview' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Live Template Preview
          </button>

          <button
            onClick={() => setActiveSubTab('test')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'test' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Send className="h-3.5 w-3.5" /> Send Test Email
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'logs' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Email Activity Logs ({emailLogs.length})
          </button>

          <button
            onClick={() => setActiveSubTab('klaviyo')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'klaviyo' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Klaviyo Integration
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm font-semibold ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* SUB-TAB 1: API & CONFIGURATION */}
      {activeSubTab === 'config' && emailSettings && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Resend API & Dispatch Configuration</h3>
              <p className="text-xs text-slate-500">Configure your Resend API credentials, sender address, and admin notifications.</p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailSettings.enabled}
                onChange={(e) => setEmailSettings({ ...emailSettings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              <span className="ml-3 text-xs font-bold text-slate-700">Global Email System Enabled</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Resend API Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={emailSettings.resendApiKey || ''}
                  onChange={(e) => setEmailSettings({ ...emailSettings, resendApiKey: e.target.value })}
                  placeholder="re_123456789_abcdef..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500">Get your key from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">resend.com/api-keys</a>. Leave blank for instant local simulation mode.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">From Email Address</label>
              <input
                type="text"
                value={emailSettings.fromEmail || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                placeholder="Pouch Supply Co. <orders@pouch-supply.com>"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[11px] text-slate-500">Verified sender domain in Resend. (Default onboarding sender: <code>onboarding@resend.dev</code>)</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Admin Notification Email</label>
              <input
                type="email"
                value={emailSettings.adminNotificationEmail || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, adminNotificationEmail: e.target.value })}
                placeholder="admin@pouch-supply.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[11px] text-slate-500">Receives real-time alerts whenever a customer places an order or payment completes.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveEmailSettings}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Email Configuration
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TEMPLATES & TOGGLES */}
      {activeSubTab === 'templates' && emailSettings && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Transactional Email Templates & Subject Lines</h3>
            <p className="text-xs text-slate-500">Toggle individual email triggers on or off and customize subject lines.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATE_OPTIONS.map((tmpl) => {
              const currentTmpl = emailSettings.templates[tmpl.id] || { enabled: true, subject: tmpl.label };
              return (
                <div key={tmpl.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 hover:border-teal-300 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">{tmpl.category}</span>
                      <h4 className="text-sm font-bold text-slate-900">{tmpl.label}</h4>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentTmpl.enabled}
                        onChange={(e) => {
                          setEmailSettings({
                            ...emailSettings,
                            templates: {
                              ...emailSettings.templates,
                              [tmpl.id]: {
                                ...currentTmpl,
                                enabled: e.target.checked
                              }
                            }
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={currentTmpl.subject || ''}
                      onChange={(e) => {
                        setEmailSettings({
                          ...emailSettings,
                          templates: {
                            ...emailSettings.templates,
                            [tmpl.id]: {
                              ...currentTmpl,
                              subject: e.target.value
                            }
                          }
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveEmailSettings}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Template Changes
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LIVE TEMPLATE PREVIEW */}
      {activeSubTab === 'preview' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Responsive Email Template Inspector</h3>
              <p className="text-xs text-slate-500">Select a template to view the live HTML rendering on desktop and mobile viewports.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedPreviewTemplate}
                onChange={(e) => setSelectedPreviewTemplate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>

              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded text-xs font-bold flex items-center gap-1 ${
                    previewDevice === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" /> Desktop
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded text-xs font-bold flex items-center gap-1 ${
                    previewDevice === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 rounded-xl p-6 flex justify-center items-center min-h-[600px] overflow-auto">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
                <span>Rendering template...</span>
              </div>
            ) : (
              <div className={`transition-all duration-300 shadow-2xl rounded-xl overflow-hidden bg-white ${
                previewDevice === 'mobile' ? 'w-[375px]' : 'w-full max-w-[650px]'
              }`}>
                <iframe
                  title="Template Preview"
                  srcDoc={previewHtml}
                  className="w-full h-[700px] border-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SEND TEST EMAIL */}
      {activeSubTab === 'test' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Send Test Transactional Email</h3>
              <p className="text-xs text-slate-500">Dispatch a test email to verify your Resend integration or review live inbox formatting.</p>
            </div>

            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
              emailSettings?.resendApiKey ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <ShieldCheck className="h-4 w-4" />
              {emailSettings?.resendApiKey ? 'Resend Live Mode' : 'Simulation Mode Active'}
            </div>
          </div>

          {/* Quick Resend API Key setup banner if missing */}
          {!emailSettings?.resendApiKey && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Resend API Key Required for Real Inbox Delivery</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    No Resend API Key is currently saved. Test emails will run in <strong>Local Simulation Mode</strong> (logged in dashboard, but not delivered to real inboxes). Enter your key below to send actual emails to your inbox.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="password"
                  placeholder="Paste Resend API Key (re_12345...)"
                  value={emailSettings?.resendApiKey || ''}
                  onChange={(e) => setEmailSettings(prev => prev ? { ...prev, resendApiKey: e.target.value } : null)}
                  className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handleSaveEmailSettings}
                  disabled={saving || !emailSettings?.resendApiKey}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all shrink-0"
                >
                  Save Key
                </button>
              </div>
            </div>
          )}

          {/* Info Banner explaining Resend Sandbox Recipient Limitation */}
          {emailSettings?.resendApiKey && (
            <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs text-blue-950">Resend Free Sandbox Recipient Rule</p>
                  <p className="text-blue-800 leading-relaxed">
                    By default, Resend API key sends via <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">onboarding@resend.dev</code>. In this free sandbox mode, Resend <strong>strictly restricts delivery to your registered Resend email address</strong> (<strong className="underline">scottkivlinpouch@gmail.com</strong>).
                  </p>
                  <p className="text-blue-800 leading-relaxed">
                    To send live emails to other customer addresses (or any outside inbox), you must verify a domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="font-bold underline text-blue-900 hover:text-blue-950">resend.com/domains</a> and set a custom 'From Email' in the Configuration tab.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Recipient Email Address</label>
                <button
                  type="button"
                  onClick={() => setTestRecipient('scottkivlinpouch@gmail.com')}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  Use scottkivlinpouch@gmail.com
                </button>
              </div>
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="scottkivlinpouch@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[11px] text-slate-500">
                Send to <strong>scottkivlinpouch@gmail.com</strong> for testing while on <code className="bg-slate-100 px-1 rounded font-mono">onboarding@resend.dev</code>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Select Email Template</label>
              <select
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-start">
            <button
              onClick={handleSendTestEmail}
              disabled={testSending || !testRecipient}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              {testSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Email
            </button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : testResult.mode === 'simulated'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="font-bold text-sm flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : testResult.mode === 'simulated' ? (
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                )}

                <span>
                  {testResult.success
                    ? 'Test Email Successfully Delivered via Resend!'
                    : testResult.mode === 'simulated'
                    ? 'Simulation Mode: No Resend API Key Configured'
                    : 'Resend Email Dispatch Failed'}
                </span>
              </div>

              <p className="text-xs">
                {testResult.message || (testResult.error ? String(testResult.error) : 'Check details below.')}
              </p>

              {testResult.log?.resendId && (
                <div className="p-2.5 bg-white/80 rounded border border-emerald-200 font-mono text-[11px] text-emerald-900 font-bold">
                  Resend Message Reference ID: {testResult.log.resendId}
                </div>
              )}

              <details className="mt-2 pt-2 border-t border-slate-200/60">
                <summary className="cursor-pointer text-[11px] font-bold text-slate-600 hover:underline">
                  View Raw API Payload Response
                </summary>
                <pre className="mt-2 p-2 bg-white/90 rounded border border-slate-200 font-mono text-[11px] overflow-x-auto text-slate-800">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 5: EMAIL ACTIVITY LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Email Telemetry & Audit Logs</h3>
              <p className="text-xs text-slate-500">Live feed of all emails dispatched via Resend or simulation mode.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                <option value="all">All Logs ({emailLogs.length})</option>
                <option value="sent">Status: Sent</option>
                <option value="simulated">Status: Simulated</option>
                <option value="failed">Status: Failed</option>
                <option value="disabled">Status: Disabled</option>
              </select>

              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear Logs
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No email logs recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Resend Ref / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {log.type}
                      </td>
                      <td className="p-3 text-slate-700 font-mono">
                        {log.recipient}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">
                        {log.subject}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                          log.status === 'simulated' ? 'bg-sky-100 text-sky-800' :
                          log.status === 'disabled' ? 'bg-slate-100 text-slate-600' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px] max-w-xs truncate">
                        {log.resendId ? `ID: ${log.resendId}` : log.error || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 6: KLAVIYO INTEGRATION */}
      {activeSubTab === 'klaviyo' && klaviyoSettings && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Klaviyo Marketing Automation</h3>
              <p className="text-xs text-slate-500">Automatically sync customer profiles, e-commerce transactions, cart activity, and wishlist events to Klaviyo.</p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={klaviyoSettings.enabled}
                onChange={(e) => setKlaviyoSettings({ ...klaviyoSettings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-3 text-xs font-bold text-slate-700">Klaviyo Tracking Enabled</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Klaviyo Private API Key</label>
              <input
                type="password"
                value={klaviyoSettings.apiKey || ''}
                onChange={(e) => setKlaviyoSettings({ ...klaviyoSettings, apiKey: e.target.value })}
                placeholder="pk_123456789_abcdef..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500">Private API Key with Events & Profiles permissions from <a href="https://www.klaviyo.com/settings/account/api-keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">klaviyo.com</a>.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Klaviyo Public Site ID / Key</label>
              <input
                type="text"
                value={klaviyoSettings.publicKey || ''}
                onChange={(e) => setKlaviyoSettings({ ...klaviyoSettings, publicKey: e.target.value })}
                placeholder="ABC123XYZ"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500">Six-character public company ID for client-side web tracking.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Klaviyo Event Toggles</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'customerSignup', label: 'Customer Signup' },
                { id: 'newsletterSignup', label: 'Newsletter Signup' },
                { id: 'emailVerified', label: 'Email Verified' },
                { id: 'addToCart', label: 'Added to Cart' },
                { id: 'checkoutStarted', label: 'Checkout Started' },
                { id: 'purchase', label: 'Placed Order / Purchase' },
                { id: 'refunded', label: 'Order Refunded' },
                { id: 'wishlist', label: 'Added to Wishlist' },
              ].map(evt => (
                <label key={evt.id} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(klaviyoSettings.trackEvents[evt.id])}
                    onChange={(e) => {
                      setKlaviyoSettings({
                        ...klaviyoSettings,
                        trackEvents: {
                          ...klaviyoSettings.trackEvents,
                          [evt.id]: e.target.checked
                        }
                      });
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-slate-800">{evt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveKlaviyoSettings}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Klaviyo Settings
            </button>
          </div>

          {/* Klaviyo Logs Section */}
          <div className="pt-6 border-t border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Klaviyo Event Stream ({klaviyoLogs.length})</h4>
            {klaviyoLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No Klaviyo events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase">
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">Event</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {klaviyoLogs.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-400 font-mono text-[10px]">{new Date(l.timestamp).toLocaleString()}</td>
                        <td className="p-2 font-bold text-slate-900">{l.eventName}</td>
                        <td className="p-2 text-slate-700 font-mono">{l.customerEmail}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
