import { Router, Request, Response } from 'express';
import {
  getEmailSettings,
  saveEmailSettings,
  getEmailLogs,
  sendEmail,
  EmailTemplateType,
  sendOrderConfirmationEmail,
  sendOrderProcessingEmail,
  sendOrderShippedEmail,
  sendOutForDeliveryEmail,
  sendDeliveredEmail,
  sendOrderCancelledEmail,
  sendOrderRefundedEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendAdminNewOrderNotification
} from '../services/emailService';
import {
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
  renderAdminNewOrderTemplate,
  EmailTemplateData
} from '../services/emailTemplates';
import { saveResource } from '../../serverDb';

const router = Router();

// Sample data generator for template previews and test emails
function getSampleTemplateData(type: EmailTemplateType, customData?: any): EmailTemplateData {
  const sampleItems = [
    { productId: 'p1', productTitle: 'VELO Freeze Max Strong 17mg Canister', price: 5.99, quantity: 2 },
    { productId: 'p2', productTitle: 'PABLO Ice Cold Danger Strong 24mg Canister', price: 6.49, quantity: 1 },
    { productId: 'p3', productTitle: 'KILLA Cold Mint Extra Strong 16mg Canister', price: 5.49, quantity: 3 }
  ];

  const defaultData: EmailTemplateData = {
    customerName: 'Alex Mercer',
    customerEmail: 'alex.mercer@example.com',
    orderId: 'PS89421',
    orderDate: 'Aug 1, 2026 at 10:45 AM',
    items: sampleItems,
    subtotal: 34.94,
    deliveryCost: 2.99,
    total: 37.93,
    destination: '42 Baker Street, Marylebone, London, NW1 6XE, United Kingdom',
    deliveryMethod: 'Priority Express Courier Shipping | Tracked 24',
    trackingNumber: 'GB892341982UK',
    carrier: 'Royal Mail Tracked 24',
    estimatedDelivery: 'Tomorrow by 1:00 PM',
    cancellationReason: 'Customer requested order change',
    refundAmount: 37.93,
    refundReason: 'Customer satisfaction guarantee',
    verificationCode: '749201',
    verificationLink: 'https://pouch-supply.com/verify?code=749201',
    resetLink: 'https://pouch-supply.com/reset-password?token=sample_reset_token',
    resetToken: 'sample_reset_token',
    discountCode: 'WELCOME10',
    supportEmail: 'support@pouch-supply.com',
    siteUrl: 'https://pouch-supply.com'
  };

  return { ...defaultData, ...(customData || {}) };
}

// GET /api/email/settings
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getEmailSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch email settings' });
  }
});

// POST /api/email/settings
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const updated = await saveEmailSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save email settings' });
  }
});

// GET /api/email/logs
router.get('/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await getEmailLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch email logs' });
  }
});

// POST /api/email/logs/clear
router.post('/logs/clear', async (_req: Request, res: Response) => {
  try {
    await saveResource('email_logs', []);
    res.json({ success: true, message: 'Email logs cleared successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear email logs' });
  }
});

// POST /api/email/preview - Render HTML for visual previewer
router.post('/preview', (req: Request, res: Response) => {
  try {
    const { type, customData } = req.body;
    const templateType = (type || 'order_confirmation') as EmailTemplateType;
    const data = getSampleTemplateData(templateType, customData);

    let html = '';
    switch (templateType) {
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
        html = renderOrderConfirmationTemplate(data);
    }

    res.send(html);
  } catch (err: any) {
    res.status(500).send(`<div style="padding:20px; color:red; font-family:sans-serif;">Error rendering preview: ${err.message}</div>`);
  }
});

// POST /api/email/test - Send a test email
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { recipient, type, customSubject, customData } = req.body;

    if (!recipient || typeof recipient !== 'string' || !recipient.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email address is required' });
    }

    const templateType = (type || 'order_confirmation') as EmailTemplateType;
    const data = getSampleTemplateData(templateType, customData);

    const result = await sendEmail(templateType, recipient.trim(), data, customSubject);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send test email' });
  }
});

// POST /api/email/send-trigger - Manual or API trigger endpoint
router.post('/send-trigger', async (req: Request, res: Response) => {
  try {
    const { type, orderData, customerEmail, customerName, trackingNumber, carrier, refundAmount, reason, code } = req.body;

    let result: any = null;

    switch (type as EmailTemplateType) {
      case 'order_confirmation':
        result = await sendOrderConfirmationEmail(orderData || req.body);
        break;
      case 'order_processing':
        result = await sendOrderProcessingEmail(orderData || req.body);
        break;
      case 'order_shipped':
        result = await sendOrderShippedEmail(orderData || req.body, trackingNumber, carrier);
        break;
      case 'out_for_delivery':
        result = await sendOutForDeliveryEmail(orderData || req.body);
        break;
      case 'order_delivered':
        result = await sendDeliveredEmail(orderData || req.body);
        break;
      case 'order_cancelled':
        result = await sendOrderCancelledEmail(orderData || req.body, reason);
        break;
      case 'order_refunded':
        result = await sendOrderRefundedEmail(orderData || req.body, refundAmount, reason);
        break;
      case 'password_reset':
        result = await sendPasswordResetEmail(customerEmail || req.body.email, customerName);
        break;
      case 'email_verification':
        result = await sendEmailVerificationEmail(customerEmail || req.body.email, customerName, code);
        break;
      case 'welcome_email':
        result = await sendWelcomeEmail(customerEmail || req.body.email, customerName);
        break;
      case 'admin_new_order':
        result = await sendAdminNewOrderNotification(orderData || req.body);
        break;
      default:
        return res.status(400).json({ error: `Unsupported email template trigger '${type}'` });
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dispatch email trigger' });
  }
});

export default router;
