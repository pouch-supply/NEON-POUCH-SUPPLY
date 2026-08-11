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
import {
  createOrder,
  getOrders,
  getOrderByReference,
  cancelOrder,
  getApiVersion,
  checkRoyalMailConnection,
  getRoyalMailLabel,
  markRoyalMailOrderDispatched,
  RoyalMailError,
  RoyalMailOrderPayload
} from "../../src/lib/royalMail";
import { fetchResource } from "../../serverDb";

const router = Router();

// GET /api/royalmail/connection - Check live Click & Drop API Connection
router.get("/connection", async (_req: Request, res: Response) => {
  try {
    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(200).json({
        success: false,
        connected: false,
        message: "ROYAL_MAIL_API_KEY is not configured.",
        environment: "LIVE"
      });
    }

    await checkRoyalMailConnection(apiKey);

    return res.json({
      success: true,
      connected: true,
      message: "Royal Mail Click & Drop API is connected.",
      environment: "LIVE",
    });
  } catch (error: any) {
    console.error("[Royal Mail] Connection check error:", error);
    if (error instanceof RoyalMailError) {
      return res.status(error.status >= 400 && error.status < 600 ? error.status : 200).json({
        success: false,
        connected: false,
        message: error.message || "Royal Mail API error",
        status: error.status,
        details: error.details,
      });
    }
    return res.status(200).json({
      success: false,
      connected: false,
      message: error?.message || "Unable to connect to Royal Mail.",
    });
  }
});

// POST /api/royalmail/create-order - Create order direct payload
router.post("/create-order", async (req: Request, res: Response) => {
  try {
    const orderData = req.body as RoyalMailOrderPayload;
    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "RM_API_KEY is not configured.",
      });
    }

    if (!orderData.orderReference) {
      return res.status(400).json({
        success: false,
        error: "orderReference is required.",
      });
    }

    if (!orderData.recipient) {
      return res.status(400).json({
        success: false,
        error: "recipient information is required.",
      });
    }

    if (!orderData.packages?.length) {
      return res.status(400).json({
        success: false,
        error: "At least one package is required.",
      });
    }

    if (!orderData.postageDetails?.serviceCode) {
      return res.status(400).json({
        success: false,
        error: "Royal Mail serviceCode is required.",
      });
    }

    console.log("[Royal Mail] Creating order:", orderData.orderReference);

    const result = await createOrder(orderData, apiKey);

    console.log("[Royal Mail] Order created successfully:", result);

    const createdOrder = result.createdOrders?.[0];

    return res.json({
      success: true,
      orderReference: createdOrder?.orderReference || orderData.orderReference,
      orderIdentifier: createdOrder?.orderIdentifier || null,
      trackingNumber: createdOrder?.trackingNumber || null,
      royalMailResponse: result,
    });
  } catch (error: unknown) {
    console.error("[Royal Mail] Create order error:", error);
    const message = error instanceof Error ? error.message : "Failed to create Royal Mail order.";
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

// GET /api/royalmail/orders - Fetch orders from Royal Mail
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "RM_API_KEY is not configured." });
    }
    const params = req.query as Record<string, string>;
    const data = await getOrders(apiKey, params);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch orders" });
  }
});

// GET /api/royalmail/orders/:reference - Get specific order
router.get("/orders/:reference", async (req: Request, res: Response) => {
  try {
    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "RM_API_KEY is not configured." });
    }
    const data = await getOrderByReference(req.params.reference, apiKey);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch order" });
  }
});

// DELETE /api/royalmail/orders/:reference - Delete specific order
router.delete("/orders/:reference", async (req: Request, res: Response) => {
  try {
    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "RM_API_KEY is not configured." });
    }
    const data = await cancelOrder(req.params.reference, apiKey);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to cancel order" });
  }
});

// GET /api/royalmail/version - Get API version
router.get("/version", async (_req: Request, res: Response) => {
  try {
    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "RM_API_KEY is not configured." });
    }
    const data = await getApiVersion(apiKey);
    res.json({ success: true, version: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch API version" });
  }
});

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

// GET /api/royalmail/label/:identifier/pdf - Retrieve official Royal Mail PDF postage label
router.get("/label/:identifier/pdf", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const includeReturnsLabel = req.query.includeReturnsLabel === "true";
    const includeCN = req.query.includeCN === "true";

    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: "ROYAL_MAIL_API_KEY is not configured." });
    }

    const pdfBuffer = await getRoyalMailLabel(
      /^\d+$/.test(identifier) ? Number(identifier) : identifier,
      { includeReturnsLabel, includeCN },
      apiKey
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="royal-mail-${identifier}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    console.error("[Royal Mail] Label PDF error:", error);
    if (error instanceof RoyalMailError) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message,
        status: error.status,
        details: error.details
      });
    }
    return res.status(500).json({ success: false, message: error.message || "Unable to retrieve Royal Mail label." });
  }
});

// PUT /api/royalmail/dispatch - Mark order as dispatched in Royal Mail
router.put("/dispatch", async (req: Request, res: Response) => {
  try {
    const { orderIdentifier, orderReference } = req.body;
    if (orderIdentifier === undefined && !orderReference) {
      return res.status(400).json({
        success: false,
        message: "orderIdentifier or orderReference is required."
      });
    }

    const settings = await getRoyalMailSettings();
    const apiKey = settings.apiKey || process.env.RM_API_KEY || process.env.ROYAL_MAIL_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: "ROYAL_MAIL_API_KEY is not configured." });
    }

    const identifier = orderIdentifier !== undefined ? Number(orderIdentifier) : String(orderReference);
    const result = await markRoyalMailOrderDispatched(identifier, apiKey);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[Royal Mail] Dispatch error:", error);
    if (error instanceof RoyalMailError) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message,
        status: error.status,
        details: error.details
      });
    }
    return res.status(500).json({
      success: false,
      message: "Unable to mark Royal Mail order as dispatched."
    });
  }
});

export default router;
