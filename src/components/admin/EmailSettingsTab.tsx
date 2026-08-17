import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, CheckCircle, CheckCircle2, AlertCircle, Eye, Settings, RefreshCw, 
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
  siteId?: string;
  publicKey?: string;
  listId?: string;
  trackEvents: Record<string, boolean>;
}

export interface EmailLogEntry {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'disabled';
  resendId?: string;
  error?: string;
  timestamp: string;
  metadata?: any;
}

export interface KlaviyoLogEntry {
  id: string;
  eventName: string;
  customerEmail: string;
  status: 'sent' | 'failed' | 'disabled';
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

export interface ContactMessageEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status?: 'Unread' | 'Read' | 'Replied';
  createdAt: string;
}

export function EmailSettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'templates' | 'preview' | 'test' | 'logs' | 'klaviyo' | 'inquiries'>('config');
  
  // Settings state
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [klaviyoSettings, setKlaviyoSettings] = useState<KlaviyoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logs & Inquiries state
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [klaviyoLogs, setKlaviyoLogs] = useState<KlaviyoLogEntry[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageEntry[]>([]);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState('all');
  const [inquirySearch, setInquirySearch] = useState('');

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

  // Test Klaviyo state
  const [testKlaviyoEmail, setTestKlaviyoEmail] = useState('scottkivlinpouch@gmail.com');
  const [sendingKlaviyoTest, setSendingKlaviyoTest] = useState(false);
  const [testKlaviyoResult, setTestKlaviyoResult] = useState<any>(null);
  const [verifyingKlaviyoKey, setVerifyingKlaviyoKey] = useState(false);
  const [klaviyoVerifyResult, setKlaviyoVerifyResult] = useState<{ success: boolean; message?: string; error?: string; hasEventsWrite?: boolean } | null>(null);

  // Fetch all configuration and logs on load
  const loadData = async () => {
    setLoading(true);
    try {
      const [emailRes, klaviyoRes, emailLogsRes, klaviyoLogsRes, contactMsgsRes, productsRes] = await Promise.all([
        fetch('/api/email/settings'),
        fetch('/api/klaviyo/settings'),
        fetch('/api/email/logs'),
        fetch('/api/klaviyo/logs'),
        fetch('/api/contact-messages'),
        fetch('/api/products')
      ]);

      if (emailRes.ok) setEmailSettings(await emailRes.json());
      if (klaviyoRes.ok) setKlaviyoSettings(await klaviyoRes.json());
      if (emailLogsRes.ok) {
        const rawLogs = await emailLogsRes.json();
        if (Array.isArray(rawLogs)) {
          setEmailLogs(rawLogs.filter(l => l.status !== 'simulated'));
        }
      }
      if (klaviyoLogsRes.ok) {
        const rawKlav = await klaviyoLogsRes.json();
        if (Array.isArray(rawKlav)) {
          setKlaviyoLogs(rawKlav.filter(l => l.status !== 'simulated'));
        }
      }
      if (contactMsgsRes.ok) {
        const msgs = await contactMsgsRes.json();
        if (Array.isArray(msgs)) {
          setContactMessages(msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      }
      if (productsRes.ok) {
        const prods = await productsRes.json();
        if (Array.isArray(prods)) setStoreProducts(prods);
      }
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

  const handleVerifyKlaviyoKey = async () => {
    if (!klaviyoSettings?.apiKey) return;
    setVerifyingKlaviyoKey(true);
    setKlaviyoVerifyResult(null);
    try {
      const res = await fetch('/api/klaviyo/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: klaviyoSettings.apiKey })
      });
      const data = await res.json();
      setKlaviyoVerifyResult(data);
    } catch (err: any) {
      setKlaviyoVerifyResult({ success: false, error: err.message || 'Failed to verify Klaviyo API key' });
    } finally {
      setVerifyingKlaviyoKey(false);
    }
  };

  const handleSaveKlaviyoSettings = async () => {
    if (!klaviyoSettings) return;
    setSaving(true);
    setMessage(null);
    setKlaviyoVerifyResult(null);
    try {
      const res = await fetch('/api/klaviyo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(klaviyoSettings)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          setKlaviyoSettings(data.settings);
        }
        setMessage({ type: 'success', text: 'Klaviyo settings saved successfully!' });
        if (klaviyoSettings.apiKey) {
          handleVerifyKlaviyoKey();
        }
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

  const handleSendTestKlaviyoOrderEvent = async () => {
    if (!testKlaviyoEmail) return;
    setSendingKlaviyoTest(true);
    setTestKlaviyoResult(null);
    try {
      const itemsPayload = (storeProducts && storeProducts.length > 0)
        ? storeProducts.slice(0, 2).map((p: any) => ({
            productId: p.id || 'prod-sample',
            productTitle: p.title || p.name || 'Sample Product',
            price: Number(p.price || 5.99),
            quantity: 1,
            image: p.image || p.imageUrl || ''
          }))
        : [
            {
              productId: 'prod-pouch-sample',
              productTitle: 'Pouch Supply Co. Sample Pack',
              price: 14.99,
              quantity: 1,
              image: ''
            }
          ];

      const res = await fetch('/api/klaviyo/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'purchase',
          customerEmail: testKlaviyoEmail.trim().toLowerCase(),
          data: {
            id: `PS-KLAV-${Math.floor(Math.random() * 90000 + 10000)}`,
            customerEmail: testKlaviyoEmail.trim().toLowerCase(),
            customerName: 'Scott Kivlin',
            total: itemsPayload.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0),
            destination: 'United Kingdom',
            deliveryMethod: 'Royal Mail Tracked 24',
            items: itemsPayload
          }
        })
      });
      const data = await res.json();
      setTestKlaviyoResult(data);
      // Reload Klaviyo logs
      const logsRes = await fetch('/api/klaviyo/logs');
      if (logsRes.ok) {
        const rawKlav = await logsRes.json();
        if (Array.isArray(rawKlav)) setKlaviyoLogs(rawKlav.filter((l: any) => l.status !== 'simulated'));
      }
    } catch (err: any) {
      setTestKlaviyoResult({ success: false, error: err.message || 'Failed to dispatch Klaviyo test event' });
    } finally {
      setSendingKlaviyoTest(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all email activity logs?')) return;
    try {
      await fetch('/api/email/logs/clear', { method: 'POST' });
      setEmailLogs([]);
    } catch (err) {}
  };

  const handleClearKlaviyoLogs = async () => {
    if (!confirm('Are you sure you want to clear all Klaviyo activity logs?')) return;
    try {
      await fetch('/api/klaviyo/logs/clear', { method: 'POST' });
      setKlaviyoLogs([]);
    } catch (err) {}
  };

  const handleToggleMessageStatus = async (msgId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'Unread' ? 'Read' : currentStatus === 'Read' ? 'Replied' : 'Unread';
    const updated = contactMessages.map(m => m.id === msgId ? { ...m, status: nextStatus as any } : m);
    setContactMessages(updated);
    try {
      const target = updated.find(m => m.id === msgId);
      if (target) {
        await fetch(`/api/contact-messages/${msgId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target)
        });
      }
    } catch (err) {}
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Are you sure you want to delete this contact submission from the database?')) return;
    const updated = contactMessages.filter(m => m.id !== msgId);
    setContactMessages(updated);
    try {
      await fetch(`/api/contact-messages/${msgId}`, { method: 'DELETE' });
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
              {emailSettings?.resendApiKey ? 'Resend Connected' : 'System Engine Active'}
            </div>

            <div className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${
              klaviyoSettings?.apiKey ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Sparkles className="h-4 w-4" />
              {klaviyoSettings?.apiKey ? 'Klaviyo Active' : 'Klaviyo Ready'}
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

          <button
            onClick={() => setActiveSubTab('inquiries')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'inquiries' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> Customer Inquiries ({contactMessages.length})
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
              <p className="text-[11px] text-slate-500">Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">resend.com/api-keys</a>.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">From Email Address</label>
              <input
                type="text"
                value={emailSettings.fromEmail || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                placeholder="Pouch Supply Co. <orders@support.pouch-supply.com>"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[11px] text-slate-500">Verified sender domain in Resend (e.g. <code>Pouch Supply Co. &lt;orders@support.pouch-supply.com&gt;</code>).</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Admin Notification Email</label>
              <input
                type="email"
                value={emailSettings.adminNotificationEmail || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, adminNotificationEmail: e.target.value })}
                placeholder="admin@support.pouch-supply.com"
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
              {emailSettings?.resendApiKey ? 'Resend Live Mode' : 'Internal Dispatch Mode Active'}
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
                    No Resend API Key is currently saved. Test emails will record to <strong>Internal Dispatch Logs</strong> (viewable in admin dashboard and customer portal). Enter your key below to dispatch live external emails.
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

          {/* Info Banner explaining Resend Sandbox Recipient Limitation & How to allow ANY email */}
          {emailSettings?.resendApiKey && (
            emailSettings.fromEmail && !emailSettings.fromEmail.includes('resend.dev') ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-sm text-emerald-950">Custom Sender Domain Active!</p>
                    <p className="text-emerald-900 leading-relaxed">
                      Your sender email is configured to <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-950">{emailSettings.fromEmail}</code>.
                      Once verified in Resend (<a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline font-bold text-emerald-700">resend.com/domains</a>), Resend delivers live customer emails (order confirmations, welcomes, cancellations, refunds, exchanges) directly to ANY customer email address.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-extrabold text-sm text-blue-950">Where are emails delivered & How to send to ANY email address?</p>
                    
                    <p className="text-blue-900 leading-relaxed">
                      <strong>1. Where do test emails go?</strong> They are sent directly to the specified recipient inbox (e.g., <strong>scottkivlinpouch@gmail.com</strong>). Please check your <em>Primary inbox, Spam/Junk folder, and Promotions tab</em> in Gmail.
                    </p>

                    <p className="text-blue-900 leading-relaxed">
                      <strong>2. Why did sending to other emails fail?</strong> Resend's free default sender (<code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">onboarding@resend.dev</code>) only permits sending to your registered Resend account owner email (<strong className="underline">scottkivlinpouch@gmail.com</strong>) to prevent spam.
                    </p>

                    <div className="p-3 bg-white/90 rounded-lg border border-blue-200 text-blue-950 space-y-1">
                      <p className="font-extrabold text-xs text-blue-900 uppercase tracking-wider">You connected your domain in Resend? Follow final Step 3:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 pl-1">
                        <li>Go to the <strong>Configuration</strong> tab above in this Email Settings menu.</li>
                        <li>Change <strong>From Email Address</strong> to your domain address (e.g., <code className="bg-slate-100 px-1 rounded font-mono">Pouch Supply Co. &lt;orders@support.pouch-supply.com&gt;</code>).</li>
                        <li>Click <strong>Save Configuration</strong>.</li>
                      </ol>
                      <p className="text-[11px] text-emerald-800 font-bold pt-1">
                        ✓ Once saved, your app will send emails from your custom domain to ALL customer addresses!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
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
                    ? 'Resend API Key Required: Key Not Configured'
                    : 'Resend Email Dispatch Failed'}
                </span>
              </div>

              <p className="text-xs">
                {testResult.message || (testResult.error ? String(testResult.error) : 'Check details below.')}
              </p>

              {testResult.success && testResult.mode === 'live' && (
                <div className="p-3 bg-white/90 rounded-lg border border-emerald-300 text-emerald-950 text-xs space-y-1 mt-2">
                  <p className="font-bold">📬 Delivered to: <span className="underline">{testRecipient}</span></p>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    Check your Gmail account at <strong>{testRecipient}</strong>. If you do not see it in your primary inbox, please check your <strong>Spam / Junk</strong> folder or <strong>Promotions</strong> tab.
                  </p>
                </div>
              )}

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
              <p className="text-xs text-slate-500">Live audit feed of all transactional emails dispatched by system services.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                <option value="all">All Logs ({emailLogs.length})</option>
                <option value="sent">Status: Sent</option>
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
              <div className="flex gap-2">
                <input
                  type="password"
                  value={klaviyoSettings.apiKey || ''}
                  onChange={(e) => setKlaviyoSettings({ ...klaviyoSettings, apiKey: e.target.value })}
                  placeholder="pk_123456789_abcdef..."
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleVerifyKlaviyoKey}
                  disabled={verifyingKlaviyoKey || !klaviyoSettings.apiKey}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                >
                  {verifyingKlaviyoKey ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Test Key
                </button>
              </div>
              <p className="text-[11px] text-slate-500">Private API Key with Events & Profiles permissions from <a href="https://www.klaviyo.com/settings/account/api-keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">klaviyo.com/settings/account/api-keys</a>.</p>
              
              {klaviyoVerifyResult && (
                <div className={`mt-2 p-3 rounded-lg text-xs border ${
                  klaviyoVerifyResult.success 
                    ? klaviyoVerifyResult.hasEventsWrite === false 
                      ? 'bg-amber-50 border-amber-200 text-amber-900' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {klaviyoVerifyResult.success ? (
                    <div className="space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        {klaviyoVerifyResult.hasEventsWrite === false ? (
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                        {klaviyoVerifyResult.message}
                      </p>
                      {klaviyoVerifyResult.hasEventsWrite === false && (
                        <p className="text-[11px] text-amber-800 pl-5">
                          💡 <strong>Fix:</strong> In Klaviyo, go to <em>Settings &gt; API Keys &gt; Create Private API Key</em> &rarr; select <strong>"Full Access Key"</strong>, copy it, and paste it here.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      {klaviyoVerifyResult.error || 'Key verification failed.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Klaviyo Company ID / Public Key</label>
              <input
                type="text"
                value={klaviyoSettings.siteId || klaviyoSettings.publicKey || ''}
                onChange={(e) => setKlaviyoSettings({ ...klaviyoSettings, siteId: e.target.value, publicKey: e.target.value })}
                placeholder="e.g. ABC123XYZ or NEXT_PUBLIC_KLAVIYO_COMPANY_ID"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500">Public Company ID / Public API Key (NEXT_PUBLIC_KLAVIYO_COMPANY_ID or NEXT_PUBLIC_KLAVIYO_PUBLIC_KEY).</p>
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

          {/* Test Klaviyo Event Dispatcher */}
          <div className="pt-6 border-t border-slate-100 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Test Klaviyo Order Confirmation Event Flow
                </h4>
                <p className="text-[11px] text-indigo-700">
                  Trigger an immediate <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-900 font-bold">Placed Order</code> event to your Klaviyo account for testing order confirmation emails.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={testKlaviyoEmail}
                onChange={(e) => setTestKlaviyoEmail(e.target.value)}
                placeholder="scottkivlinpouch@gmail.com"
                className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSendTestKlaviyoOrderEvent}
                disabled={sendingKlaviyoTest || !testKlaviyoEmail}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                {sendingKlaviyoTest ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Sending Event...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send 'Placed Order' Event
                  </>
                )}
              </button>
            </div>

            {testKlaviyoResult && (
              <div className={`p-3 rounded-lg text-xs border ${
                testKlaviyoResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {testKlaviyoResult.success ? (
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Event successfully dispatched to Klaviyo for <strong>{testKlaviyoEmail}</strong>! Check your Klaviyo flows and Gmail inbox.
                  </p>
                ) : (
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    {testKlaviyoResult.error || testKlaviyoResult.log?.error || 'Klaviyo event dispatch failed.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Klaviyo Logs Section */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900">Klaviyo Event Stream ({klaviyoLogs.length})</h4>
              {klaviyoLogs.length > 0 && (
                <button
                  onClick={handleClearKlaviyoLogs}
                  className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear Klaviyo Logs
                </button>
              )}
            </div>
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
                            l.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
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

      {/* SUBTAB: Customer Inquiries / Contact Messages */}
      {activeSubTab === 'inquiries' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600" /> Customer Contact Submissions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Messages submitted via the Contact Form section on your storefront, persisted directly in your database.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search by name, email, subject..."
                value={inquirySearch}
                onChange={(e) => setInquirySearch(e.target.value)}
                className="text-xs p-2 border border-slate-200 rounded-lg w-full sm:w-64 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
              <button
                onClick={loadData}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Refresh messages"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {(() => {
            const filtered = contactMessages.filter(m => {
              if (!inquirySearch) return true;
              const q = inquirySearch.toLowerCase();
              return (
                m.name?.toLowerCase().includes(q) ||
                m.email?.toLowerCase().includes(q) ||
                m.subject?.toLowerCase().includes(q) ||
                m.message?.toLowerCase().includes(q)
              );
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Contact Messages Found</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    When customers submit the Contact Form on your storefront, their entries will automatically save into this database log.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                  <span>Showing {filtered.length} of {contactMessages.length} inquiries</span>
                </div>

                <div className="space-y-3">
                  {filtered.map((m) => {
                    const statusClass = m.status === 'Read' 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : m.status === 'Replied' 
                      ? 'bg-purple-50 text-purple-700 border-purple-200' 
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold';

                    return (
                      <div key={m.id} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${statusClass}`}>
                              {m.status || 'Unread'}
                            </span>
                            <h4 className="text-sm font-black text-slate-900">{m.subject || 'General Inquiry'}</h4>
                          </div>

                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(m.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">From</span>
                            <span className="font-bold text-slate-800">{m.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Email Address</span>
                            <a href={`mailto:${m.email}`} className="font-bold text-indigo-600 hover:underline">{m.email}</a>
                          </div>
                          {m.phone && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone</span>
                              <span className="font-bold text-slate-700">{m.phone}</span>
                            </div>
                          )}
                        </div>

                        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                          {m.message}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => handleToggleMessageStatus(m.id, m.status)}
                            className="text-xs text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
                          >
                            Mark as {m.status === 'Unread' ? 'Read' : m.status === 'Read' ? 'Replied' : 'Unread'}
                          </button>

                          <div className="flex items-center gap-3">
                            <a
                              href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'Inquiry')}`}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition shadow-xs"
                            >
                              <Send className="h-3 w-3" /> Reply via Email
                            </a>
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Delete from database"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
