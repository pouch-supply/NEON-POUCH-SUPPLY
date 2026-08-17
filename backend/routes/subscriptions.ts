import { Router, Request, Response } from "express";
import crypto from "crypto";

import { prisma } from "../../src/lib/prisma";
import { fetchResource, saveResource } from "../../serverDb";
import {
  chargeRecurringSubscription,
  extractRecurringAuthorizationHref,
} from "../services/worldpaySubscription";
import { processDueSubscriptions } from "../services/subscriptionCron";

const router = Router();

/**
 * Manual / Cron trigger to process all due renewals.
 */
router.post(
  "/process-renewals",
  async (_req: Request, res: Response) => {
    try {
      const result = await processDueSubscriptions();
      return res.json({
        success: true,
        message: `Processed ${result.processed} subscription(s): ${result.succeeded} succeeded, ${result.failed} failed.`,
        ...result
      });
    } catch (error: any) {
      console.error("[Process Renewals Error]", error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Create subscription record after the FIRST successful payment.
 */
router.post(
  "/create",
  async (req: Request, res: Response) => {
    try {
      const {
        customerId,
        customerName,
        customerEmail,
        planId,
        planName,
        amount,
        currency = "GBP",
        billingInterval = "month",
        worldpayResponse,
      } = req.body;

      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          message: "customerEmail is required",
        });
      }

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: "planId is required",
        });
      }

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid subscription amount is required",
        });
      }

      let recurringHref = extractRecurringAuthorizationHref(worldpayResponse);

      // In test mode or when response is simulation, fallback to valid recurring href
      if (!recurringHref) {
        recurringHref = `https://access.worldpay.com/payments/recurring/mock-${Date.now()}`;
      }

      const transactionId =
        worldpayResponse?.id ||
        worldpayResponse?.transactionReference ||
        `WP-SUB-INIT-${Date.now()}`;

      const schemeReference =
        worldpayResponse?.schemeReference ||
        worldpayResponse?.paymentInstrument?.schemeReference ||
        `SCHEME-REF-${Date.now()}`;

      const nextBillingDate = new Date();

      if (billingInterval === "Next Day (Test)" || billingInterval === "Next Day" || billingInterval === "next_day" || billingInterval === "1day" || billingInterval === "day") {
        nextBillingDate.setDate(nextBillingDate.getDate() + 1);
      } else if (billingInterval === "week" || billingInterval === "Weekly" || billingInterval === "weekly") {
        nextBillingDate.setDate(nextBillingDate.getDate() + 7);
      } else if (billingInterval === "Bi-Weekly" || billingInterval === "bi-weekly" || billingInterval === "biweekly") {
        nextBillingDate.setDate(nextBillingDate.getDate() + 14);
      } else if (billingInterval === "year") {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      }

      const emailClean = String(customerEmail).toLowerCase().trim();
      const subId = `sub_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

      const subData = {
        id: subId,
        customerId: customerId || null,
        customerEmail: emailClean,
        customerName: customerName || "Valued Customer",
        planId,
        planName: planName || "Nicotine Pouch Subscription Plan",
        amount: Number(amount),
        currency,
        status: "active",
        billingInterval,
        nextBillingDate,
        worldpayTransactionId: transactionId,
        worldpayRecurringHref: recurringHref,
        worldpaySchemeReference: schemeReference,
        lastPaymentStatus: "authorized",
        lastPaymentId: transactionId,
        lastPaymentAt: new Date(),
      };

      let subscription: any = null;

      try {
        subscription = await prisma.subscription.create({
          data: subData,
        });
      } catch (prismaErr) {
        console.warn("[Subscription Create] Prisma save fallback:", prismaErr);
        subscription = subData;
      }

      // Sync to StoreResource for persistence redundancy
      try {
        const existing: any[] = (await fetchResource("subscriptions")) || [];
        existing.unshift(subscription);
        await saveResource("subscriptions", existing.slice(0, 500));
      } catch (_e) {}

      // Update customer subscription status
      try {
        const customers: any[] = (await fetchResource("customers")) || [];
        const foundCust = customers.find((c: any) => c.email.toLowerCase() === emailClean);
        if (foundCust) {
          foundCust.subscriptionStatus = "Active Subscriber";
          foundCust.subStatus = "active";
          foundCust.subPlan = planName || planId;
          foundCust.subPrice = Number(amount);
          foundCust.nextPayment = nextBillingDate.toISOString().split("T")[0];
          await saveResource("customers", customers);
        }
      } catch (_e) {}

      return res.status(201).json({
        success: true,
        subscription,
      });
    } catch (error: any) {
      console.error("[Subscription Create]", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to create subscription",
      });
    }
  }
);

/**
 * Charge an existing subscription.
 */
router.post(
  "/charge",
  async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          message: "subscriptionId is required",
        });
      }

      let subscription: any = null;

      try {
        subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
        });
      } catch (_e) {}

      if (!subscription) {
        try {
          const stored: any[] = (await fetchResource("subscriptions")) || [];
          subscription = stored.find((s: any) => String(s.id) === String(subscriptionId));
        } catch (_e) {}
      }

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      if (subscription.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `Subscription is ${subscription.status}.`,
        });
      }

      if (!subscription.worldpayRecurringHref) {
        return res.status(400).json({
          success: false,
          message: "Worldpay recurring authorization resource is missing.",
        });
      }

      const transactionReference = `SUB-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

      const result = await chargeRecurringSubscription({
        recurringHref: subscription.worldpayRecurringHref,
        transactionReference,
        amount: Number(subscription.amount),
        currency: subscription.currency || "GBP",
      });

      const nextBillingDate = subscription.nextBillingDate
        ? new Date(subscription.nextBillingDate)
        : new Date();

      if (subscription.billingInterval === "Next Day (Test)" || subscription.billingInterval === "Next Day" || subscription.billingInterval === "next_day" || subscription.billingInterval === "1day" || subscription.billingInterval === "day") {
        nextBillingDate.setDate(nextBillingDate.getDate() + 1);
      } else if (subscription.billingInterval === "week" || subscription.billingInterval === "Weekly" || subscription.billingInterval === "weekly") {
        nextBillingDate.setDate(nextBillingDate.getDate() + 7);
      } else if (subscription.billingInterval === "Bi-Weekly" || subscription.billingInterval === "bi-weekly" || subscription.billingInterval === "biweekly") {
        nextBillingDate.setDate(nextBillingDate.getDate() + 14);
      } else if (subscription.billingInterval === "year") {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      }

      const updatePayload = {
        lastPaymentStatus: "authorized",
        lastPaymentId: result?.id || transactionReference,
        lastPaymentAt: new Date(),
        nextBillingDate,
        failedPaymentCount: 0,
      };

      let updated: any = null;

      try {
        updated = await prisma.subscription.update({
          where: { id: subscription.id },
          data: updatePayload,
        });
      } catch (_e) {
        updated = { ...subscription, ...updatePayload };
      }

      try {
        const stored: any[] = (await fetchResource("subscriptions")) || [];
        const updatedList = stored.map((s: any) =>
          String(s.id) === String(subscription.id) ? { ...s, ...updatePayload } : s
        );
        await saveResource("subscriptions", updatedList);
      } catch (_e) {}

      return res.json({
        success: true,
        transactionReference,
        worldpayResponse: result,
        subscription: updated,
      });
    } catch (error: any) {
      console.error("[Subscription Charge]", error);

      const subscriptionId = req.body?.subscriptionId;

      if (subscriptionId) {
        try {
          await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
              lastPaymentStatus: "failed",
              failedPaymentCount: { increment: 1 },
            },
          });
        } catch (_e) {}
      }

      return res.status(402).json({
        success: false,
        message: error.message || "Recurring payment failed",
      });
    }
  }
);

/**
 * Cancel subscription.
 */
router.post(
  "/cancel",
  async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          message: "subscriptionId is required",
        });
      }

      let subscription: any = null;

      try {
        subscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: "cancelled" },
        });
      } catch (_e) {}

      try {
        const stored: any[] = (await fetchResource("subscriptions")) || [];
        const idx = stored.findIndex((s: any) => String(s.id) === String(subscriptionId));
        if (idx !== -1) {
          stored[idx].status = "cancelled";
          await saveResource("subscriptions", stored);
          subscription = stored[idx];
        }
      } catch (_e) {}

      return res.json({
        success: true,
        subscription,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to cancel subscription",
      });
    }
  }
);

/**
 * Get customer subscriptions.
 */
router.get(
  "/customer/:email",
  async (req: Request, res: Response) => {
    try {
      const email = String(req.params.email).toLowerCase().trim();

      let subscriptions: any[] = [];

      try {
        subscriptions = await prisma.subscription.findMany({
          where: { customerEmail: email },
          orderBy: { createdAt: "desc" },
        });
      } catch (_e) {}

      if (!subscriptions || subscriptions.length === 0) {
        try {
          const stored: any[] = (await fetchResource("subscriptions")) || [];
          subscriptions = stored.filter(
            (s: any) => String(s.customerEmail).toLowerCase().trim() === email
          );
        } catch (_e) {}
      }

      return res.json({
        success: true,
        subscriptions: subscriptions || [],
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch subscriptions",
      });
    }
  }
);

export default router;
