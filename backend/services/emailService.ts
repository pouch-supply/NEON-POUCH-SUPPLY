import { Resend } from 'resend';
import { fetchResource, saveResource } from '../../serverDb';
import {
  EmailTemplateData,
  renderOrderConfirmationTemplate,
  renderOrderProcessingTemplate,
  renderOrderShippedTemplate,
  renderOutForDeliveryTemplate,
  renderDeliveredTemplate,
  renderOrderCancelledTemplate,
  renderOrderRefundedTemplate,
  renderPasswordResetTemplate,
  renderEmailVerificationTemplate,
  renderWelcomeTemplate,
  renderAdminNewOrderTemplate
} from './emailTemplates';

export type EmailTemplateType =
  | 'order_confirmation'
  | 'order_processing'
  | 'order_shipped'
  | 'out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_refunded'
  | 'password_reset'
  | 'email_verification'
  | 'welcome_email'
  | 'admin_new_order';

export interface EmailSettings {
  enabled: boolean;
  resendApiKey: string;
  fromEmail: string;
  adminNotificationEmail: string;
  templates: Record<EmailTemplateType, {
    enabled: boolean;
    subject: string;
  }>;
}

export interface EmailLogEntry {
  id: string;
  type: EmailTemplateType;
  recipient: string;
  subject: string;
  status: 'sent' | 'simulated' | 'failed' | 'disabled';
  resendId?: string;
  error?: string;
  timestamp: string;
  metadata?: any;
}

const DEFAULT_SETTINGS: EmailSettings = {
  enabled: true,
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.RESEND_FROM_EMAIL || 'Pouch Supply Co. <onboarding@resend.dev>',
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@pouch-supply.com',
  templates: {
    order_confirmation: { enabled: true, subject: 'Order Confirmation - Pouch Supply Co.' },
    order_processing: { enabled: true, subject: 'Order Processing - Pouch Supply Co.' },
    order_shipped: { enabled: true, subject: 'Order Dispatched & Tracking Info - Pouch Supply Co.' },
    out_for_delivery: { enabled: true, subject: 'Out for Delivery Today - Pouch Supply Co.' },
    order_delivered: { enabled: true, subject: 'Order Delivered - Pouch Supply Co.' },
    order_cancelled: { enabled: true, subject: 'Order Cancellation Notice - Pouch Supply Co.' },
    order_refunded: { enabled: true, subject: 'Refund Confirmation - Pouch Supply Co.' },
    password_reset: { enabled: true, subject: 'Reset Your Password - Pouch Supply Co.' },
    email_verification: { enabled: true, subject: 'Verify Your Email Address - Pouch Supply Co.' },
    welcome_email: { enabled: true, subject: 'Welcome to Pouch Supply Co. - 10% Off Inside' },
    admin_new_order: { enabled: true, subject: '🚨 New Storefront Order Placed' }
  }
};

export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const stored: any = await fetchResource('email_settings');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        templates: {
          ...DEFAULT_SETTINGS.templates,
          ...(stored.templates || {})
        }
      };
    }
  } catch (err) {
    console.warn('[EmailService] Failed to load settings from DB:', err);
  }
  return DEFAULT_SETTINGS;
}

export async function saveEmailSettings(settings: Partial<EmailSettings>): Promise<EmailSettings> {
  const current = await getEmailSettings();
  const updated: EmailSettings = {
    ...current,
    ...settings,
    templates: {
      ...current.templates,
      ...(settings.templates || {})
    }
  };
  await saveResource('email_settings', updated as any);
  return updated;
}

export async function getEmailLogs(): Promise<EmailLogEntry[]> {
  try {
    const logs = await fetchResource('email_logs');
    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    return [];
  }
}

async function logEmail(entry: Omit<EmailLogEntry, 'id' | 'timestamp'>): Promise<EmailLogEntry> {
  const newLog: EmailLogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString()
  };

  try {
    const currentLogs = await getEmailLogs();
    const updated = [newLog, ...currentLogs].slice(0, 500); // Keep last 500 logs
    await saveResource('email_logs', updated);
  } catch (err) {
    console.error('[EmailService] Failed to log email entry:', err);
  }

  return newLog;
}

export async function sendEmail(
  type: EmailTemplateType,
  recipient: string,
  data: EmailTemplateData,
  customSubject?: string
): Promise<{ success: boolean; log: EmailLogEntry }> {
  const settings = await getEmailSettings();

  // Check global enabled
  if (!settings.enabled) {
    console.log(`[EmailService] Global email sending is disabled. Skipping ${type} to ${recipient}.`);
    const log = await logEmail({
      type,
      recipient,
      subject: customSubject || settings.templates[type]?.subject || type,
      status: 'disabled',
      error: 'Global email system disabled in settings'
    });
    return { success: false, log };
  }

  // Check template enabled
  const templateConfig = settings.templates[type];
  if (templateConfig && !templateConfig.enabled) {
    console.log(`[EmailService] Template '${type}' is disabled. Skipping sending to ${recipient}.`);
    const log = await logEmail({
      type,
      recipient,
      subject: customSubject || templateConfig.subject || type,
      status: 'disabled',
      error: `Template '${type}' is disabled in settings`
    });
    return { success: false, log };
  }

  // Determine subject
  const subject = customSubject || templateConfig?.subject || `Notification from Pouch Supply Co.`;

  // Render HTML for template
  let html = '';
  switch (type) {
    case 'order_confirmation':
      html = renderOrderConfirmationTemplate(data);
      break;
    case 'order_processing':
      html = renderOrderProcessingTemplate(data);
      break;
    case 'order_shipped':
      html = renderOrderShippedTemplate(data);
      break;
    case 'out_for_delivery':
      html = renderOutForDeliveryTemplate(data);
      break;
    case 'order_delivered':
      html = renderDeliveredTemplate(data);
      break;
    case 'order_cancelled':
      html = renderOrderCancelledTemplate(data);
      break;
    case 'order_refunded':
      html = renderOrderRefundedTemplate(data);
      break;
    case 'password_reset':
      html = renderPasswordResetTemplate(data);
      break;
    case 'email_verification':
      html = renderEmailVerificationTemplate(data);
      break;
    case 'welcome_email':
      html = renderWelcomeTemplate(data);
      break;
    case 'admin_new_order':
      html = renderAdminNewOrderTemplate(data);
      break;
    default:
      html = `<p>Notification from Pouch Supply Co.</p>`;
  }

  const apiKey = settings.resendApiKey || process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.warn(`[EmailService] No RESEND_API_KEY found. Simulating email dispatch to ${recipient}.`);
    const log = await logEmail({
      type,
      recipient,
      subject,
      status: 'simulated',
      error: 'No RESEND_API_KEY configured (simulated mode active)',
      metadata: { data }
    });
    return { success: true, log };
  }

  try {
    const resend = new Resend(apiKey.trim());
    const fromEmail = settings.fromEmail || 'Pouch Supply Co. <onboarding@resend.dev>';

    console.log(`[EmailService] Sending '${type}' via Resend to '${recipient}'...`);

    const resendResponse = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject,
      html
    });

    if (resendResponse.error) {
      console.warn(`[EmailService] Resend API error for ${type}:`, resendResponse.error);
      const log = await logEmail({
        type,
        recipient,
        subject,
        status: 'failed',
        error: resendResponse.error.message || String(resendResponse.error),
        metadata: { data }
      });
      return { success: false, log };
    }

    const resendId = resendResponse.data?.id;
    console.log(`[EmailService] Email sent successfully via Resend! ID: ${resendId}`);

    const log = await logEmail({
      type,
      recipient,
      subject,
      status: 'sent',
      resendId,
      metadata: { data }
    });

    return { success: true, log };

  } catch (error: any) {
    console.error(`[EmailService] Unexpected error sending email '${type}':`, error);
    const log = await logEmail({
      type,
      recipient,
      subject,
      status: 'failed',
      error: error.message || String(error),
      metadata: { data }
    });
    return { success: false, log };
  }
}

// Convenient helper functions for each required email type

export async function sendOrderConfirmationEmail(orderData: any) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    orderDate: orderData.date,
    items: orderData.items,
    total: typeof orderData.total === 'number' ? orderData.total : parseFloat(orderData.total) || 0,
    destination: orderData.destination || orderData.address,
    deliveryMethod: orderData.deliveryMethod,
    discountAmount: orderData.discountApplied?.amount
  };

  // 1. Send confirmation to customer
  const customerResult = await sendEmail('order_confirmation', recipient, data);

  // 2. Also trigger admin notification
  const settings = await getEmailSettings();
  const adminEmail = settings.adminNotificationEmail || 'admin@pouch-supply.com';
  if (adminEmail) {
    await sendEmail('admin_new_order', adminEmail, data);
  }

  return customerResult;
}

export async function sendOrderProcessingEmail(orderData: any) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    items: orderData.items,
    total: orderData.total,
    destination: orderData.destination || orderData.address
  };
  return sendEmail('order_processing', recipient, data);
}

export async function sendOrderShippedEmail(orderData: any, trackingNumber?: string, carrier?: string) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    items: orderData.items,
    total: orderData.total,
    destination: orderData.destination || orderData.address,
    trackingNumber: trackingNumber || orderData.trackingNumber || 'GB982341234UK',
    carrier: carrier || orderData.carrier || 'Royal Mail Tracked 24'
  };
  return sendEmail('order_shipped', recipient, data);
}

export async function sendOutForDeliveryEmail(orderData: any) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    items: orderData.items,
    trackingNumber: orderData.trackingNumber || 'GB982341234UK'
  };
  return sendEmail('out_for_delivery', recipient, data);
}

export async function sendDeliveredEmail(orderData: any) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    items: orderData.items,
    destination: orderData.destination || orderData.address
  };
  return sendEmail('order_delivered', recipient, data);
}

export async function sendOrderCancelledEmail(orderData: any, reason?: string) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    cancellationReason: reason
  };
  return sendEmail('order_cancelled', recipient, data);
}

export async function sendOrderRefundedEmail(orderData: any, refundAmount?: number, reason?: string) {
  const recipient = orderData.customerEmail || 'customer@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    total: orderData.total,
    refundAmount: refundAmount !== undefined ? refundAmount : orderData.total,
    refundReason: reason
  };
  return sendEmail('order_refunded', recipient, data);
}

export async function sendPasswordResetEmail(email: string, name?: string, resetToken?: string, resetLink?: string) {
  const data: EmailTemplateData = {
    customerName: name || 'Customer',
    customerEmail: email,
    resetToken: resetToken || 'token_xyz',
    resetLink: resetLink || '#'
  };
  return sendEmail('password_reset', email, data);
}

export async function sendEmailVerificationEmail(email: string, name?: string, code?: string) {
  const data: EmailTemplateData = {
    customerName: name || 'Customer',
    customerEmail: email,
    verificationCode: code || Math.floor(100000 + Math.random() * 900000).toString()
  };
  return sendEmail('email_verification', email, data);
}

export async function sendWelcomeEmail(email: string, name?: string, discountCode?: string) {
  const data: EmailTemplateData = {
    customerName: name || 'Friend',
    customerEmail: email,
    discountCode: discountCode || 'WELCOME10'
  };
  return sendEmail('welcome_email', email, data);
}

export async function sendAdminNewOrderNotification(orderData: any) {
  const settings = await getEmailSettings();
  const adminEmail = settings.adminNotificationEmail || 'admin@pouch-supply.com';
  const data: EmailTemplateData = {
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    orderId: orderData.id,
    items: orderData.items,
    total: orderData.total,
    destination: orderData.destination || orderData.address
  };
  return sendEmail('admin_new_order', adminEmail, data);
}
