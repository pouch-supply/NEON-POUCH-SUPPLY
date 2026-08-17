import { prisma } from '../../src/lib/prisma';
import { fetchResource, saveResource, getDb } from '../../serverDb';
import { chargeRecurringSubscription } from './worldpaySubscription';
import { sendOrderConfirmationEmail } from './emailService';
import { trackPurchaseCompleted } from './klaviyoService';
import crypto from 'crypto';

export interface RenewalResult {
  processed: number;
  succeeded: number;
  failed: number;
  details: any[];
}

/**
 * Calculates the next billing date based on the plan's billing interval.
 */
export function calculateNextBillingDate(interval: string, fromDate: Date = new Date()): Date {
  const nextDate = new Date(fromDate);
  const normInterval = String(interval || '').toLowerCase().trim();

  if (
    normInterval === 'next day (test)' ||
    normInterval === 'next day' ||
    normInterval === 'next_day' ||
    normInterval === '1day' ||
    normInterval === '1 day' ||
    normInterval === 'day' ||
    normInterval === 'daily'
  ) {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (
    normInterval === 'week' ||
    normInterval === 'weekly' ||
    normInterval === '7 days' ||
    normInterval === '7days'
  ) {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (
    normInterval === 'bi-weekly' ||
    normInterval === 'biweekly' ||
    normInterval === '14 days' ||
    normInterval === '14days'
  ) {
    nextDate.setDate(nextDate.getDate() + 14);
  } else if (normInterval === 'year' || normInterval === 'annual') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  } else {
    // Default to monthly (30 days)
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

/**
 * Runs the subscription renewal engine for all active subscriptions due for billing.
 */
export async function processDueSubscriptions(): Promise<RenewalResult> {
  const now = new Date();
  console.log(`[Subscription Worker] Scanning for due renewals at ${now.toISOString()}...`);

  let subscriptions: any[] = [];
  const isConnected = await getDb().catch(() => false);

  if (isConnected) {
    try {
      subscriptions = await prisma.subscription.findMany({
        where: {
          status: 'active',
          nextBillingDate: { lte: now }
        }
      });
    } catch (_e) {
      // Fallback seamlessly to fetchResource
    }
  }

  if (!subscriptions || subscriptions.length === 0) {
    try {
      const stored: any[] = (await fetchResource('subscriptions')) || [];
      subscriptions = stored.filter((s: any) => {
        if (s.status !== 'active') return false;
        if (!s.nextBillingDate) return true;
        return new Date(s.nextBillingDate) <= now;
      });
    } catch (_e) {}
  }

  console.log(`[Subscription Worker] Found ${subscriptions.length} subscription(s) due for renewal.`);

  const results: any[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const subId = sub.id;
    const customerEmail = String(sub.customerEmail || '').toLowerCase().trim();
    const recurringHref = sub.worldpayRecurringHref || sub.recurringHref;
    const amount = Number(sub.amount || 25.0);
    const currency = sub.currency || 'GBP';
    const planName = sub.planName || 'Pouch Supply Subscription';

    console.log(`[Subscription Worker] Processing Renewal for Sub: ${subId} (${customerEmail}) - £${amount.toFixed(2)}`);

    if (!recurringHref) {
      console.warn(`[Subscription Worker] Sub ${subId} skipped: Missing Worldpay recurring reference.`);
      failed++;
      results.push({ id: subId, status: 'skipped', reason: 'Missing recurring token' });
      continue;
    }

    const transactionReference = `SUB-ORD-${Math.floor(10000 + Math.random() * 90000)}-${Date.now().toString().slice(-4)}`;

    try {
      // 1. Charge Worldpay using Stored MIT Credential / Scheme Reference
      const chargeResult = await chargeRecurringSubscription({
        recurringHref,
        transactionReference,
        amount,
        currency
      });

      console.log(`[Subscription Worker] Charge SUCCESS for ${subId}: Tx ${transactionReference}`);

      // 2. Compute Next Billing Date
      const nextBilling = calculateNextBillingDate(sub.billingInterval || '1day', new Date());

      // 3. Create the Recurring Order in Database
      const newOrderId = `PS${Math.floor(10000 + Math.random() * 90000)}`;
      const orderItems = [
        {
          productId: sub.planId || 'sub-pack',
          productTitle: `${planName} (Recurring Renewal)`,
          price: amount,
          quantity: 1,
          isSubscription: true,
          total: amount
        }
      ];

      const newOrderData = {
        id: newOrderId,
        orderId: newOrderId,
        customerName: sub.customerName || 'Valued Subscriber',
        customerEmail,
        destination: sub.shippingAddress || 'Customer Address on File',
        items: orderItems,
        total: amount,
        storeCreditApplied: 0,
        discountApplied: null,
        status: 'Processing',
        paymentStatus: 'Paid (Recurring MIT)',
        paymentMethod: 'Worldpay Recurring Subscription',
        worldpayTxId: chargeResult?.id || transactionReference,
        gatewayTxId: chargeResult?.id || transactionReference,
        worldpayAuthCode: 'AUTH-OK',
        gatewayAuthCode: 'AUTH-OK',
        subscriptionId: subId,
        isSubscription: true,
        createdAt: new Date().toISOString()
      };

      try {
        const { saveSingleOrder } = await import('../routes/orders');
        await saveSingleOrder(newOrderData);
      } catch (ordErr) {
        console.warn('[Subscription Worker] Order save fallback:', ordErr);
        const storedOrders: any[] = (await fetchResource('orders')) || [];
        storedOrders.unshift(newOrderData);
        await saveResource('orders', storedOrders);
      }

      // 4. Update Subscription in Database with Next Billing Date
      const updateData = {
        lastPaymentStatus: 'authorized',
        lastPaymentId: chargeResult?.id || transactionReference,
        lastPaymentAt: new Date(),
        nextBillingDate: nextBilling,
        failedPaymentCount: 0
      };

      try {
        await prisma.subscription.update({
          where: { id: subId },
          data: updateData
        });
      } catch (_e) {}

      try {
        const storedSubs: any[] = (await fetchResource('subscriptions')) || [];
        const updatedList = storedSubs.map((s: any) =>
          String(s.id) === String(subId) ? { ...s, ...updateData } : s
        );
        await saveResource('subscriptions', updatedList);
      } catch (_e) {}

      // 5. Send Order Confirmation Email & Trigger Klaviyo
      try {
        await sendOrderConfirmationEmail(newOrderData);
      } catch (_e) {}

      try {
        await trackPurchaseCompleted(newOrderData);
      } catch (_e) {}

      succeeded++;
      results.push({
        id: subId,
        status: 'succeeded',
        orderId: newOrderId,
        nextBillingDate: nextBilling.toISOString(),
        transactionReference
      });
    } catch (chargeErr: any) {
      console.error(`[Subscription Worker] Charge FAILED for Sub ${subId}:`, chargeErr.message);
      failed++;

      const failUpdate = {
        lastPaymentStatus: 'failed',
        failedPaymentCount: { increment: 1 }
      };

      try {
        await prisma.subscription.update({
          where: { id: subId },
          data: failUpdate
        });
      } catch (_e) {}

      results.push({
        id: subId,
        status: 'failed',
        error: chargeErr.message
      });
    }
  }

  return {
    processed: subscriptions.length,
    succeeded,
    failed,
    details: results
  };
}

let cronIntervalHandle: NodeJS.Timeout | null = null;

/**
 * Initializes the background recurring worker timer.
 * Checks for due subscriptions every 15 minutes.
 */
export function startSubscriptionRenewalWorker(intervalMs: number = 15 * 60 * 1000) {
  if (cronIntervalHandle) {
    clearInterval(cronIntervalHandle);
  }

  console.log(`[Subscription Worker] Background worker initialized (interval: ${intervalMs / 1000}s).`);

  // Run on startup after 10 seconds
  setTimeout(() => {
    processDueSubscriptions().catch(err => console.error('[Subscription Worker] Startup run error:', err));
  }, 10000);

  // Periodic recurring check
  cronIntervalHandle = setInterval(() => {
    processDueSubscriptions().catch(err => console.error('[Subscription Worker] Periodic run error:', err));
  }, intervalMs);
}
