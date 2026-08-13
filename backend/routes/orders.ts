import { Router, Request, Response } from "express";
import { fetchResource, saveResource, deleteSingleItem, getDb } from "../../serverDb";
import {
  sendOrderConfirmationEmail,
  sendOrderProcessingEmail,
  sendOrderShippedEmail,
  sendOutForDeliveryEmail,
  sendDeliveredEmail,
  sendOrderCancelledEmail,
  sendOrderRefundedEmail,
  sendAdminNewOrderNotification
} from "../services/emailService";
import { trackPurchaseCompleted, trackOrderRefunded } from "../services/klaviyoService";

const router = Router();

export async function saveSingleOrder(orderData: any) {
  const id = String(orderData.id || orderData.orderId || `PS${Math.floor(Math.random() * 90000 + 10000)}`);
  
  // Check existing order status to detect changes
  let existingOrder: any = null;
  try {
    const currentOrders: any[] = (await fetchResource('orders')) || [];
    existingOrder = currentOrders.find((o: any) => String(o.id) === id);
  } catch (_e) {}

  const items = orderData.items || existingOrder?.items || [];
  const subItem = items.find((i: any) =>
    i.isSubscription ||
    i.vendor === 'Subscription Pack' ||
    (i.productTitle && (i.productTitle.toLowerCase().includes('subscription') || i.productTitle.toLowerCase().includes('pack')))
  );

  const isSubscription = Boolean(orderData.isSubscription ?? existingOrder?.isSubscription ?? subItem);

  let subscriptionDetails = orderData.subscriptionDetails || existingOrder?.subscriptionDetails || null;

  if (isSubscription && !subscriptionDetails) {
    let planName = subItem?.subscriptionPlan || 'LITE Plan';
    let frequency = subItem?.subscriptionFrequency || '';
    let frequencyDiscount = subItem?.frequencyDiscount || '';

    const title = (subItem?.productTitle || '').toLowerCase();
    if (title.includes('core')) planName = 'CORE Plan';
    else if (title.includes('pro')) planName = 'PRO Plan';
    else if (title.includes('ultimate')) planName = 'ULTIMATE Plan';
    else if (title.includes('lite')) planName = 'LITE Plan';

    if (!frequency) {
      if (title.includes('next day') || title.includes('1 day')) {
        frequency = 'Next Day (Test)';
      } else if (title.includes('weekly') && !title.includes('bi')) {
        frequency = 'Weekly';
      } else if (title.includes('bi-weekly') || title.includes('by weekly') || title.includes('2 week')) {
        frequency = 'Bi-Weekly';
      } else if (title.includes('month') || title.includes('one month')) {
        frequency = 'One Month';
      } else {
        frequency = 'Bi-Weekly';
      }
    }

    if (!frequencyDiscount) {
      if (frequency.includes('Next Day')) frequencyDiscount = '10%';
      else if (frequency === 'Weekly') frequencyDiscount = '5%';
      else if (frequency === 'One Month') frequencyDiscount = '12%';
      else frequencyDiscount = '10%';
    }

    const baseDate = new Date();
    const nextDate = new Date(baseDate);
    if (frequency.includes('Next Day')) {
      nextDate.setDate(baseDate.getDate() + 1);
    } else if (frequency === 'Weekly') {
      nextDate.setDate(baseDate.getDate() + 7);
    } else if (frequency === 'Bi-Weekly') {
      nextDate.setDate(baseDate.getDate() + 14);
    } else {
      nextDate.setDate(baseDate.getDate() + 30);
    }

    subscriptionDetails = {
      planName,
      frequency,
      frequencyDiscount,
      paymentStatus: 'Paid',
      lastPaymentDate: baseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      nextPaymentDate: nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    };
  }

  let tags = Array.isArray(orderData.tags) ? orderData.tags : (existingOrder?.tags || ['Storefront', 'Online Order']);
  if (isSubscription && !tags.some((t: string) => t.toLowerCase().includes('subscription'))) {
    tags = [...tags, 'Subscription Order'];
  }

  const formattedOrder = {
    id,
    customerName: orderData.customerName || existingOrder?.customerName || 'Valued Customer',
    customerEmail: orderData.customerEmail || existingOrder?.customerEmail || 'customer@pouch-supply.com',
    tags,
    isSubscription,
    subscriptionDetails,
    fulfillmentStatus: orderData.fulfillmentStatus || existingOrder?.fulfillmentStatus || 'Unfulfilled',
    paymentStatus: orderData.paymentStatus || existingOrder?.paymentStatus || (orderData.total === 0 ? 'Paid' : 'Pending'),
    worldpayTxId: orderData.worldpayTxId || orderData.gatewayTxId || existingOrder?.worldpayTxId || null,
    worldpayAuthCode: orderData.worldpayAuthCode || orderData.gatewayAuthCode || existingOrder?.worldpayAuthCode || null,
    gatewayTxId: orderData.gatewayTxId || orderData.worldpayTxId || existingOrder?.gatewayTxId || null,
    gatewayAuthCode: orderData.gatewayAuthCode || orderData.worldpayAuthCode || existingOrder?.gatewayAuthCode || null,
    cardBrand: orderData.cardBrand || existingOrder?.cardBrand || 'Card',
    total: typeof orderData.total === 'number' ? orderData.total : parseFloat(orderData.total) || existingOrder?.total || 0,
    storeCreditApplied: typeof orderData.storeCreditApplied === 'number' ? orderData.storeCreditApplied : parseFloat(orderData.storeCreditApplied) || existingOrder?.storeCreditApplied || 0,
    destination: orderData.destination || orderData.address || existingOrder?.destination || 'United Kingdom',
    date: orderData.date || existingOrder?.date || (new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    deliveryMethod: orderData.deliveryMethod || existingOrder?.deliveryMethod || 'Royal Mail Tracked 24/48',
    items,
    discountApplied: orderData.discountApplied || existingOrder?.discountApplied || null,
    trackingNumber: orderData.trackingNumber || existingOrder?.trackingNumber || null,
    carrier: orderData.carrier || existingOrder?.carrier || null,
    data: {
      ...(existingOrder?.data || {}),
      address: orderData.address || existingOrder?.data?.address,
      paymentMethod: orderData.paymentMethod || existingOrder?.data?.paymentMethod
    }
  };

  // Try Prisma first
  try {
    const { prisma } = await import('../../src/lib/prisma');
    await prisma.order.upsert({
      where: { id },
      update: formattedOrder,
      create: formattedOrder
    });
  } catch (prismaErr: any) {
    console.warn('[Orders Router] Prisma save warning:', prismaErr?.message);
  }

  // Sync to StoreResource
  try {
    const currentOrders: any[] = (await fetchResource('orders')) || [];
    const existingIdx = currentOrders.findIndex((o: any) => String(o.id) === id);
    if (existingIdx !== -1) {
      currentOrders[existingIdx] = { ...currentOrders[existingIdx], ...formattedOrder };
    } else {
      currentOrders.unshift(formattedOrder);
    }
    await saveResource('orders', currentOrders);
  } catch (resourceErr) {
    console.error('[Orders Router] StoreResource save error:', resourceErr);
  }

  // Trigger Automatic Emails & Klaviyo Events on creation or status transition
  try {
    const isNewOrder = !existingOrder;
    const paymentStatusJustPaid = (existingOrder?.paymentStatus !== 'Paid') && (formattedOrder.paymentStatus === 'Paid');
    
    // 1. Order Payment Succeeded
    if (formattedOrder.paymentStatus === 'Paid' && (isNewOrder || paymentStatusJustPaid)) {
      console.log(`[Orders Trigger] Dispatching Order Confirmation & Klaviyo Purchase for ${id}`);
      sendOrderConfirmationEmail(formattedOrder).catch(e => console.warn('Order confirmation email fail:', e));
      trackPurchaseCompleted(formattedOrder).catch(e => console.warn('Klaviyo purchase track fail:', e));
    }

    // 2. Fulfillment Status Transition
    if (existingOrder && existingOrder.fulfillmentStatus !== formattedOrder.fulfillmentStatus) {
      const newStatus = formattedOrder.fulfillmentStatus;
      console.log(`[Orders Trigger] Fulfillment status changed for ${id}: ${existingOrder.fulfillmentStatus} -> ${newStatus}`);
      if (newStatus === 'Processing') {
        sendOrderProcessingEmail(formattedOrder).catch(e => console.warn('Order processing email fail:', e));
      } else if (newStatus === 'Shipped') {
        sendOrderShippedEmail(formattedOrder, formattedOrder.trackingNumber, formattedOrder.carrier).catch(e => console.warn('Order shipped email fail:', e));
      } else if (newStatus === 'Out for Delivery') {
        sendOutForDeliveryEmail(formattedOrder).catch(e => console.warn('Out for delivery email fail:', e));
      } else if (newStatus === 'Delivered') {
        sendDeliveredEmail(formattedOrder).catch(e => console.warn('Order delivered email fail:', e));
      } else if (newStatus === 'Cancelled') {
        sendOrderCancelledEmail(formattedOrder, orderData.reason || 'Order cancelled by store administrator').catch(e => console.warn('Order cancelled email fail:', e));
      }
    }

    // 3. Refund Transition
    if (existingOrder && existingOrder.paymentStatus !== 'Refunded' && formattedOrder.paymentStatus === 'Refunded') {
      console.log(`[Orders Trigger] Refund processed for ${id}`);
      sendOrderRefundedEmail(formattedOrder, formattedOrder.total, orderData.refundReason).catch(e => console.warn('Order refund email fail:', e));
      trackOrderRefunded(formattedOrder, formattedOrder.total).catch(e => console.warn('Klaviyo refund track fail:', e));
    }
  } catch (triggerErr) {
    console.warn('[Orders Trigger] Error dispatching automated notifications:', triggerErr);
  }

  return formattedOrder;
}

// GET all orders - return all valid persisted orders
router.get("/", async (_req: Request, res: Response) => {
  try {
    const data: any[] = (await fetchResource("orders")) || [];
    const validOrders = data.filter((o: any) => o && o.id);
    res.json(validOrders);
  } catch (err: any) {
    console.error("[Orders Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch orders" });
  }
});

// GET single order by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders: any[] = (await fetchResource("orders")) || [];
    const found = orders.find((o: any) => String(o.id) === String(id));
    if (found) {
      return res.json(found);
    }
    
    // Fallback to Prisma
    try {
      const { prisma } = await import('../../src/lib/prisma');
      const prismaOrder = await prisma.order.findUnique({ where: { id } });
      if (prismaOrder) {
        return res.json(prismaOrder);
      }
    } catch (_e) {}

    res.status(404).json({ error: "Order not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch order" });
  }
});

// POST /create - Create a single order
router.post("/create", async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    if (!orderData || typeof orderData !== 'object') {
      return res.status(400).json({ error: "Order data object is required" });
    }

    const savedOrder = await saveSingleOrder(orderData);
    res.json({ success: true, order: savedOrder });
  } catch (err: any) {
    console.error("[Orders Router] POST /create Error:", err);
    res.status(500).json({ error: err.message || "Failed to create order" });
  }
});

// POST / - Create or sync orders (accepts single order or array)
router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (Array.isArray(payload)) {
      const formattedOrders = payload.map((orderData: any) => {
        const id = String(orderData.id || orderData.orderId || `PS${Math.floor(Math.random() * 90000 + 10000)}`);
        return {
          id,
          customerName: orderData.customerName || 'Valued Customer',
          customerEmail: orderData.customerEmail || 'customer@pouch-supply.com',
          tags: Array.isArray(orderData.tags) ? orderData.tags : ['Storefront', 'Online Order'],
          fulfillmentStatus: orderData.fulfillmentStatus || 'Unfulfilled',
          paymentStatus: orderData.paymentStatus || (orderData.total === 0 ? 'Paid' : 'Pending'),
          worldpayTxId: orderData.worldpayTxId || orderData.gatewayTxId || null,
          worldpayAuthCode: orderData.worldpayAuthCode || orderData.gatewayAuthCode || null,
          gatewayTxId: orderData.gatewayTxId || orderData.worldpayTxId || null,
          gatewayAuthCode: orderData.gatewayAuthCode || orderData.worldpayAuthCode || null,
          cardBrand: orderData.cardBrand || 'Card',
          total: typeof orderData.total === 'number' ? orderData.total : parseFloat(orderData.total) || 0,
          storeCreditApplied: typeof orderData.storeCreditApplied === 'number' ? orderData.storeCreditApplied : parseFloat(orderData.storeCreditApplied) || 0,
          destination: orderData.destination || orderData.address || 'United Kingdom',
          date: orderData.date || (new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          deliveryMethod: orderData.deliveryMethod || 'Royal Mail Tracked 24/48',
          items: orderData.items || [],
          discountApplied: orderData.discountApplied || null,
          trackingNumber: orderData.trackingNumber || null,
          carrier: orderData.carrier || null,
          data: orderData.data || {}
        };
      });

      const savedOrders = await saveResource('orders', formattedOrders);
      return res.json(savedOrders);
    } else if (payload && typeof payload === 'object') {
      const savedOrder = await saveSingleOrder(payload);
      return res.json({ success: true, order: savedOrder });
    } else {
      return res.status(400).json({ error: "Invalid order payload" });
    }
  } catch (err: any) {
    console.error("[Orders Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist orders" });
  }
});

// POST /:id/cancel - Customer Cancel Order Workflow
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, refundMethod = "original", customerEmail } = req.body;

    const currentOrders: any[] = (await fetchResource("orders")) || [];
    const foundIdx = currentOrders.findIndex((o: any) => String(o.id) === String(id));

    if (foundIdx === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = currentOrders[foundIdx];

    if (order.fulfillmentStatus === "Shipped" || order.fulfillmentStatus === "Delivered") {
      return res.status(400).json({ error: "Order has already shipped and cannot be directly cancelled. Please request a return." });
    }

    if (order.fulfillmentStatus === "Cancelled" || order.paymentStatus === "Refunded") {
      return res.status(400).json({ error: "Order is already cancelled or refunded." });
    }

    // Update status
    order.fulfillmentStatus = "Cancelled";
    order.cancellationReason = reason || "Customer requested cancellation";
    order.cancelledAt = new Date().toISOString();

    if (refundMethod === "store_credit") {
      order.paymentStatus = "Refunded";
      // Add store credit to customer account
      try {
        const customersList: any[] = (await fetchResource("customers")) || [];
        const cIdx = customersList.findIndex((c: any) => c.email.toLowerCase() === (order.customerEmail || "").toLowerCase());
        if (cIdx !== -1) {
          customersList[cIdx].storeCredit = (customersList[cIdx].storeCredit || 0) + (order.total || 0);
          await saveResource("customers", customersList);
          console.log(`[Cancel Order] Added £${order.total} store credit to ${order.customerEmail}`);
        }
      } catch (custErr) {
        console.warn("[Cancel Order] Failed to update customer store credit:", custErr);
      }
    } else {
      // Process refund via Worldpay Payment Gateway if transaction ID is attached
      order.paymentStatus = "Refunded";
      if (order.worldpayTxId || order.gatewayTxId) {
        try {
          const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
          await fetch(`${appUrl}/api/worldpay/refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              amount: order.total,
              reason: `Customer cancellation: ${reason || "Changed mind"}`,
              transactionId: order.worldpayTxId || order.gatewayTxId
            })
          });
        } catch (wpErr) {
          console.warn("[Cancel Order] Worldpay refund trigger notice:", wpErr);
        }
      }
    }

    order.returnRequest = {
      type: "Cancellation",
      reason: reason || "Customer requested cancellation",
      refundMethod,
      status: "Completed",
      requestedAt: new Date().toISOString()
    };

    const updatedOrder = await saveSingleOrder(order);

    // Send Resend Emails
    sendOrderCancelledEmail(updatedOrder, reason).catch(e => console.warn("Cancel email error:", e));
    sendOrderRefundedEmail(updatedOrder, updatedOrder.total, `Cancellation refund (${refundMethod === "store_credit" ? "Store Credit" : "Original Payment"})`).catch(e => console.warn("Refund email error:", e));

    res.json({ success: true, message: "Order successfully cancelled and refund initiated.", order: updatedOrder });
  } catch (err: any) {
    console.error("[Orders Router] POST /:id/cancel Error:", err);
    res.status(500).json({ error: err.message || "Failed to cancel order" });
  }
});

// POST /:id/return-request - Customer Return / Refund / Exchange Request Workflow
router.post("/:id/return-request", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, reason, itemsToReturn, exchangeNotes, refundMethod } = req.body;

    if (!type || !reason) {
      return res.status(400).json({ error: "Request type and reason are required." });
    }

    const currentOrders: any[] = (await fetchResource("orders")) || [];
    const foundIdx = currentOrders.findIndex((o: any) => String(o.id) === String(id));

    if (foundIdx === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = currentOrders[foundIdx];

    const returnRequest = {
      type: type || "Return", // 'Return' | 'Refund' | 'Exchange'
      reason,
      itemsToReturn: itemsToReturn || order.items || [],
      exchangeNotes: exchangeNotes || "",
      refundMethod: refundMethod || "original",
      status: "Pending", // 'Pending' | 'Approved' | 'Declined' | 'Completed'
      requestedAt: new Date().toISOString()
    };

    order.returnRequest = returnRequest;
    if (!Array.isArray(order.tags)) order.tags = [];
    if (!order.tags.includes(`${type} Requested`)) {
      order.tags.push(`${type} Requested`);
    }

    const updatedOrder = await saveSingleOrder(order);

    // Send notification email
    try {
      if (type === "Exchange") {
        const { sendOrderExchangedEmail } = await import("../services/emailService");
        await sendOrderExchangedEmail(updatedOrder, exchangeNotes || "Product exchange requested", reason);
      } else {
        const { sendOrderCancelledEmail } = await import("../services/emailService");
        await sendOrderCancelledEmail(updatedOrder, `Return/Refund request initiated: ${reason}`);
      }
    } catch (e) {
      console.warn("Return request email notification error:", e);
    }

    res.json({ success: true, message: `${type} request submitted successfully. Our team will review your request.`, order: updatedOrder });
  } catch (err: any) {
    console.error("[Orders Router] Return Request Error:", err);
    res.status(500).json({ error: err.message || "Failed to submit return request" });
  }
});

// POST /:id/admin-action - Admin Approve / Decline / Process Return, Refund, or Exchange
router.post("/:id/admin-action", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, refundAmount, reason } = req.body;

    const currentOrders: any[] = (await fetchResource("orders")) || [];
    const foundIdx = currentOrders.findIndex((o: any) => String(o.id) === String(id));

    if (foundIdx === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = currentOrders[foundIdx];
    const amountToRefund = typeof refundAmount === "number" ? refundAmount : (order.total || 0);

    if (action === "approve_return" || action === "process_refund") {
      order.paymentStatus = "Refunded";
      if (order.returnRequest) {
        order.returnRequest.status = "Completed";
        order.returnRequest.processedAt = new Date().toISOString();
      }

      // Execute actual payment provider refund via Worldpay Endpoint
      if (order.worldpayTxId || order.gatewayTxId) {
        try {
          const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
          await fetch(`${appUrl}/api/worldpay/refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              amount: amountToRefund,
              reason: reason || "Admin processed refund",
              transactionId: order.worldpayTxId || order.gatewayTxId
            })
          });
        } catch (wpErr) {
          console.warn("[Admin Action] Worldpay refund trigger notice:", wpErr);
        }
      }

      sendOrderRefundedEmail(order, amountToRefund, reason || "Refund processed by store administrator").catch(e => console.warn("Refund email fail:", e));

    } else if (action === "complete_exchange") {
      order.fulfillmentStatus = "Exchanged" as any;
      if (order.returnRequest) {
        order.returnRequest.status = "Completed";
        order.returnRequest.completedAt = new Date().toISOString();
      }
      const { sendOrderExchangedEmail } = await import("../services/emailService");
      sendOrderExchangedEmail(order, "Exchange replacement item dispatched", reason || "Exchange approved").catch(e => console.warn("Exchange email fail:", e));

    } else if (action === "decline_return") {
      if (order.returnRequest) {
        order.returnRequest.status = "Declined";
        order.returnRequest.declinedReason = reason || "Request declined by administrator";
      }
    }

    const updatedOrder = await saveSingleOrder(order);
    res.json({ success: true, message: `Admin action '${action}' processed successfully.`, order: updatedOrder });
  } catch (err: any) {
    console.error("[Orders Router] Admin Action Error:", err);
    res.status(500).json({ error: err.message || "Failed to execute admin action" });
  }
});

// DELETE /:id - Permanently delete a single order
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteSingleItem("orders", id);
    if (deleted) {
      return res.json({ success: true, deletedId: id });
    } else {
      return res.status(404).json({ error: "Order not found or could not be deleted" });
    }
  } catch (err: any) {
    console.error("[Orders Router] DELETE Error:", err);
    res.status(500).json({ error: err.message || "Failed to delete order" });
  }
});

export default router;
