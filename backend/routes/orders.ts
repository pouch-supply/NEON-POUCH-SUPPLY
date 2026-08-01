import { Router, Request, Response } from "express";
import { fetchResource, saveResource, getDb } from "../../serverDb";

const router = Router();

async function saveSingleOrder(orderData: any) {
  const id = String(orderData.id || orderData.orderId || `PS${Math.floor(Math.random() * 90000 + 10000)}`);
  const formattedOrder = {
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
    deliveryMethod: orderData.deliveryMethod || 'Priority Express Courier Shipping | Tracked',
    items: orderData.items || [],
    discountApplied: orderData.discountApplied || null,
    data: {
      address: orderData.address,
      paymentMethod: orderData.paymentMethod
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

  // Fallback / StoreResource sync
  try {
    const currentOrders: any[] = (await fetchResource('orders')) || [];
    const existingIdx = currentOrders.findIndex((o: any) => o.id === id);
    if (existingIdx !== -1) {
      currentOrders[existingIdx] = { ...currentOrders[existingIdx], ...formattedOrder };
    } else {
      currentOrders.unshift(formattedOrder);
    }
    await saveResource('orders', currentOrders);
  } catch (resourceErr) {
    console.error('[Orders Router] StoreResource save error:', resourceErr);
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
