import { Router, Request, Response } from "express";
import { fetchResource, saveResource, getDb } from "../../serverDb";
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

async function saveSingleOrder(orderData: any) {
  const id = String(orderData.id || orderData.orderId || `PS${Math.floor(Math.random() * 90000 + 10000)}`);
  
  // Check existing order status to detect changes
  let existingOrder: any = null;
  try {
    const currentOrders: any[] = (await fetchResource('orders')) || [];
    existingOrder = currentOrders.find((o: any) => String(o.id) === id);
  } catch (_e) {}

  const formattedOrder = {
    id,
    customerName: orderData.customerName || existingOrder?.customerName || 'Valued Customer',
    customerEmail: orderData.customerEmail || existingOrder?.customerEmail || 'customer@pouch-supply.com',
    tags: Array.isArray(orderData.tags) ? orderData.tags : (existingOrder?.tags || ['Storefront', 'Online Order']),
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
    items: orderData.items || existingOrder?.items || [],
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

// GET all orders
router.get("/", async (_req: Request, res: Response) => {
  try {
    const data = await fetchResource("orders");
    res.json(data);
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
      const savedOrders = [];
      for (const item of payload) {
        savedOrders.push(await saveSingleOrder(item));
      }
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

export default router;
