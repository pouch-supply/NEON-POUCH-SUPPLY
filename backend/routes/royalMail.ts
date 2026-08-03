import { Router, Request, Response } from "express";
import {
  getRoyalMailSettings,
  saveRoyalMailSettings,
  validateAddress,
  getShippingRates,
  createRoyalMailShipment,
  cancelRoyalMailShipment,
  getRoyalMailTracking,
  createReturnLabel as createRoyalMailReturnLabel,
  generateShippingLabelHtml,
  generateRoyalMailTrackingNumber
} from "../services/royalMailService";
import { fetchResource } from "../../serverDb";

const router = Router();

// GET /api/royalmail/settings - Get settings
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await getRoyalMailSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch Royal Mail settings" });
  }
});

// POST /api/royalmail/settings - Update settings
router.post("/settings", async (req: Request, res: Response) => {
  try {
    const updated = await saveRoyalMailSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save Royal Mail settings" });
  }
});

// POST /api/royalmail/create-shipment - Create shipment for an order
router.post("/create-shipment", async (req: Request, res: Response) => {
  try {
    const { orderId, serviceCode, packageType, weightGrams } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const result = await createRoyalMailShipment(String(orderId), {
      serviceCode,
      packageType,
      weightGrams: weightGrams ? parseInt(weightGrams, 10) : undefined
    });

    res.json(result);
  } catch (err: any) {
    console.error("[RoyalMail Router] Create shipment error:", err);
    res.status(500).json({ error: err.message || "Failed to create Royal Mail shipment" });
  }
});

// POST /api/royalmail/validate-address - Address Validation
router.post("/validate-address", async (req: Request, res: Response) => {
  try {
    const result = validateAddress(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Address validation failed" });
  }
});

// POST /api/royalmail/rates - Calculate rates
router.post("/rates", async (req: Request, res: Response) => {
  try {
    const { weightGrams, countryCode } = req.body;
    const rates = getShippingRates(weightGrams || 350, countryCode || 'GB');
    res.json({ success: true, rates });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to calculate rates" });
  }
});

// GET /api/royalmail/label/:orderId/html - Printable Label HTML View
router.get("/label/:orderId/html", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const settings = await getRoyalMailSettings();
    const orders: any[] = (await fetchResource("orders")) || [];
    const order = orders.find((o: any) => String(o.id) === String(orderId));

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const trackingNumber = order.trackingNumber || order.trackingId || generateRoyalMailTrackingNumber();
    const rawAddr = order.data?.address || order.destination || '';
    const recipient = {
      fullName: order.customerName,
      addressLine1: typeof rawAddr === 'object' ? (rawAddr.addressLine1 || rawAddr.street) : String(rawAddr),
      city: typeof rawAddr === 'object' ? (rawAddr.city || 'London') : 'London',
      postcode: typeof rawAddr === 'object' ? (rawAddr.postcode || 'EC1A 1BB') : 'EC1A 1BB',
      countryCode: 'GB',
      email: order.customerEmail
    };

    const labelHtml = generateShippingLabelHtml({
      trackingNumber,
      orderId: String(order.id),
      serviceCode: order.data?.royalMail?.serviceCode || settings.defaultServiceCode || 'TPS24',
      serviceName: order.carrier || 'Royal Mail Tracked 24',
      recipient,
      sender: settings.senderAddress,
      weightGrams: settings.defaultWeightGrams || 350,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    });

    res.setHeader("Content-Type", "text/html");
    res.send(labelHtml);
  } catch (err: any) {
    res.status(500).send("Error generating label: " + err.message);
  }
});

// GET /api/royalmail/track/:trackingNumber - Track shipment
router.get("/track/:trackingNumber", async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;
    const trackingInfo = await getRoyalMailTracking(trackingNumber);
    res.json(trackingInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Tracking lookup failed" });
  }
});

// POST /api/royalmail/cancel-shipment - Cancel shipment
router.post("/cancel-shipment", async (req: Request, res: Response) => {
  try {
    const { orderId, royalMailOrderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }
    const result = await cancelRoyalMailShipment(String(orderId), royalMailOrderId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to cancel shipment" });
  }
});

// POST /api/royalmail/create-return-label - Return label
router.post("/create-return-label", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }
    const result = await createRoyalMailReturnLabel(String(orderId));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate return label" });
  }
});

export default router;
