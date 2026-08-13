import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
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
  sendOrderExchangedEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendAdminNewOrderNotification
} from '../services/emailService';
import {
  verifyRecaptchaToken,
  getRecaptchaSettings,
  saveRecaptchaSettings
} from '../services/recaptchaService';
import {
  renderOrderConfirmationTemplate,
  renderOrderProcessingTemplate,
  renderOrderShippedTemplate,
  renderOutForDeliveryTemplate,
  renderDeliveredTemplate,
  renderOrderCancelledTemplate,
  renderOrderRefundedTemplate,
  renderOrderExchangedTemplate,
  renderPasswordResetTemplate,
  renderEmailVerificationTemplate,
  renderWelcomeTemplate,
  renderAdminNewOrderTemplate,
  EmailTemplateData
} from '../services/emailTemplates';
import { saveResource, saveSingleItem } from '../../serverDb';

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
    deliveryMethod: 'Royal Mail Tracked 24/48',
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
      case 'order_exchanged':
        html = renderOrderExchangedTemplate(data);
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
    const { recipient, type, customSubject, customData, apiKey, fromEmail } = req.body;

    if (!recipient || typeof recipient !== 'string' || !recipient.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email address is required' });
    }

    const templateType = (type || 'order_confirmation') as EmailTemplateType;
    const data = getSampleTemplateData(templateType, customData);

    const result = await sendEmail(templateType, recipient.trim(), data, customSubject, apiKey, fromEmail);
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
      case 'order_exchanged':
        result = await sendOrderExchangedEmail(orderData || req.body, req.body.exchangeDetails, reason);
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

// GET /api/email/recaptcha-settings - Return reCAPTCHA settings
router.get('/recaptcha-settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getRecaptchaSettings();
    res.json({
      enabled: settings.enabled,
      siteKey: settings.siteKey,
      minScore: settings.minScore,
      hasSecretKey: Boolean(settings.secretKey && settings.secretKey.trim().length > 0)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch reCAPTCHA settings' });
  }
});

// POST /api/email/recaptcha-settings - Save reCAPTCHA settings
router.post('/recaptcha-settings', async (req: Request, res: Response) => {
  try {
    const updated = await saveRecaptchaSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save reCAPTCHA settings' });
  }
});

// POST /api/email/contact - Handle contact form submissions & send email via Resend
router.post('/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message, phone, recaptchaToken, token } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required fields.' });
    }

    // Verify Google reCAPTCHA v3 score
    const captchaCheck = await verifyRecaptchaToken(recaptchaToken || token, 'contact_form_submit');
    if (!captchaCheck.success) {
      console.warn('[ContactForm] reCAPTCHA check failed:', captchaCheck);
      return res.status(403).json({
        error: captchaCheck.error || 'reCAPTCHA security validation failed. Automated submission detected.'
      });
    }

    const settings = await getEmailSettings();
    const adminEmail = settings.adminNotificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@support.pouch-supply.com';
    const apiKey = (settings.resendApiKey || process.env.RESEND_API_KEY || '').trim();
    let fromEmail = (settings.fromEmail || process.env.RESEND_FROM_EMAIL || 'Pouch Supply Co. <orders@support.pouch-supply.com>').trim();

    const emailSubject = `📩 Contact Form Submission: ${subject || 'General Inquiry'} from ${name}`;
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">New Contact Form Message</h2>
        <p style="color: #475569; font-size: 14px;">You received a new message from your website contact page.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #334155; width: 120px;">Name:</td>
            <td style="padding: 8px 0; color: #0f172a;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #334155;">Email:</td>
            <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
          </tr>
          ${phone ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #334155;">Phone:</td>
            <td style="padding: 8px 0; color: #0f172a;">${phone}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #334155;">Subject:</td>
            <td style="padding: 8px 0; color: #0f172a;">${subject || 'General Inquiry'}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px;">
          <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Message:</h4>
          <p style="margin: 0; color: #334155; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${message}</p>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">Sent via Pouch Supply Co. Storefront Contact Form</p>
      </div>
    `;

    const custSubject = `Thank you for contacting Pouch Supply Co.!`;
    const custHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
          <h1 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em;">Pouch Supply Co.</h1>
          <p style="color: #64748b; font-size: 12px; margin-top: 4px;">Premium Nicotine Pouches & Fast Express Shipping</p>
        </div>

        <div style="padding: 24px 0;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 700;">Hi ${name},</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Thank you for reaching out to <strong>Pouch Supply Co.</strong>! We have received your inquiry regarding <strong>"${subject || 'General Inquiry'}"</strong> and our customer support team is reviewing it now.
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Our average response time is under 2 hours during business hours (Monday – Friday, 9:00 AM – 6:00 PM GMT).
          </p>

          <div style="margin-top: 20px; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Summary of your message:</h4>
            <p style="margin: 0 0 6px 0; color: #475569; font-size: 13px;"><strong>Topic:</strong> ${subject || 'General Inquiry'}</p>
            <p style="margin: 0; color: #475569; font-size: 13px; white-space: pre-wrap;"><strong>Message:</strong> ${message}</p>
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Need to add extra details? Simply reply directly to this email.</p>
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} Pouch Supply Co. All rights reserved.</p>
        </div>
      </div>
    `;

    let adminStatus: 'sent' | 'failed' = 'failed';
    let adminResendId: string | undefined = undefined;
    let adminError: string | undefined = undefined;

    let custStatus: 'sent' | 'failed' = 'failed';
    let custResendId: string | undefined = undefined;
    let custError: string | undefined = undefined;

    if (apiKey) {
      const resend = new Resend(apiKey);

      // 1) Send Admin Notification
      try {
        let sendRes = await resend.emails.send({
          from: fromEmail,
          to: [adminEmail],
          replyTo: email,
          subject: emailSubject,
          html: htmlBody
        });

        if (sendRes.error && !fromEmail.includes('onboarding@resend.dev')) {
          fromEmail = 'Pouch Supply Co. <onboarding@resend.dev>';
          sendRes = await resend.emails.send({
            from: fromEmail,
            to: [adminEmail],
            replyTo: email,
            subject: emailSubject,
            html: htmlBody
          });
        }

        if (sendRes.error) {
          adminStatus = 'failed';
          adminError = sendRes.error.message || String(sendRes.error);
        } else if (sendRes.data?.id) {
          adminStatus = 'sent';
          adminResendId = sendRes.data.id;
        }
      } catch (err: any) {
        adminStatus = 'failed';
        adminError = err.message || String(err);
      }

      // 2) Send Customer Thank You Confirmation
      try {
        let custSendRes = await resend.emails.send({
          from: fromEmail,
          to: [email],
          replyTo: adminEmail,
          subject: custSubject,
          html: custHtml
        });

        if (custSendRes.error && !fromEmail.includes('onboarding@resend.dev')) {
          fromEmail = 'Pouch Supply Co. <onboarding@resend.dev>';
          custSendRes = await resend.emails.send({
            from: fromEmail,
            to: [email],
            replyTo: adminEmail,
            subject: custSubject,
            html: custHtml
          });
        }

        if (custSendRes.error) {
          custStatus = 'failed';
          custError = custSendRes.error.message || String(custSendRes.error);
        } else if (custSendRes.data?.id) {
          custStatus = 'sent';
          custResendId = custSendRes.data.id;
        }
      } catch (err: any) {
        custStatus = 'failed';
        custError = err.message || String(err);
      }
    } else {
      adminError = 'No Resend API key configured';
      custError = 'No Resend API key configured';
    }

    // Save logs for both emails
    const logs = await getEmailLogs();
    const adminLog = {
      id: `log_${Date.now()}_admin_${Math.random().toString(36).substring(2, 6)}`,
      type: 'admin_new_order' as const,
      recipient: adminEmail,
      subject: emailSubject,
      status: adminStatus,
      resendId: adminResendId,
      error: adminError,
      timestamp: new Date().toISOString(),
      metadata: { contactForm: { name, email, subject, message, phone } }
    };
    const customerLog = {
      id: `log_${Date.now()}_cust_${Math.random().toString(36).substring(2, 6)}`,
      type: 'welcome_email' as const,
      recipient: email,
      subject: custSubject,
      status: custStatus,
      resendId: custResendId,
      error: custError,
      timestamp: new Date().toISOString(),
      metadata: { contactFormReply: { name, email, subject, message } }
    };

    await saveResource('email_logs', [adminLog, customerLog, ...(Array.isArray(logs) ? logs : [])]);

    // Save contact form submission directly into database resource contactMessages
    try {
      const contactMsgRecord = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        email,
        phone: phone || '',
        subject: subject || 'General Inquiry',
        message,
        status: 'Unread',
        createdAt: new Date().toISOString()
      };
      await saveSingleItem('contactMessages', contactMsgRecord);
    } catch (saveMsgErr) {
      console.warn('[ContactForm] Failed to save contact submission to DB:', saveMsgErr);
    }

    let responseNote = 'Thank you for reaching out! Your message has been received, and our customer support team will get back to you shortly.';
    let sandboxNotice: string | undefined = undefined;

    if (custStatus === 'failed' && custError?.toLowerCase().includes('testing emails')) {
      sandboxNotice = `Note: Resend's free onboarding mode limits live emails to your verified account address. Verify a custom domain in Resend (resend.com/domains) to dispatch live emails to all external customer inboxes.`;
    }

    res.json({
      success: true,
      message: responseNote,
      sandboxNotice,
      adminStatus,
      customerStatus: custStatus,
      customerError: custError
    });
  } catch (err: any) {
    console.error('[ContactForm] Error submitting contact form:', err);
    res.status(500).json({ error: err.message || 'Failed to send message.' });
  }
});

// POST /api/email/subscribe - Handle newsletter subscription & send welcome email
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, recaptchaToken, token } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    // Verify Google reCAPTCHA v3 score
    const captchaCheck = await verifyRecaptchaToken(recaptchaToken || token, 'newsletter_subscribe');
    if (!captchaCheck.success) {
      console.warn('[Newsletter] reCAPTCHA check failed:', captchaCheck);
      return res.status(403).json({
        error: captchaCheck.error || 'reCAPTCHA security check failed. Automated subscription blocked.'
      });
    }

    const emailTrim = email.trim().toLowerCase();
    const result = await sendWelcomeEmail(emailTrim, 'Valued Customer', 'WELCOME10');

    res.json({
      success: true,
      message: 'Subscribed successfully! Welcome email dispatched.',
      result
    });
  } catch (err: any) {
    console.error('[Newsletter] Error subscribing:', err);
    res.status(500).json({ error: err.message || 'Failed to process newsletter subscription.' });
  }
});

export default router;
