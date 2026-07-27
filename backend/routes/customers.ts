import { Router } from "express";
import crypto from "crypto";
import { fetchResource, saveResource, getDb } from "../../serverDb";
import { Customer } from "../../src/types";

const router = Router();

// Password hashing helper using standard Node crypto
function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "pouch_supply_salt_123!")
    .digest("hex");
}

// GET all customers (Admin use)
router.get("/", async (req, res) => {
  try {
    const data = await fetchResource("customers");
    // Remove password hashes from output for security
    const sanitized = data.map(({ passwordHash, ...rest }) => rest);
    res.json(sanitized);
  } catch (err: any) {
    console.error("[Customers Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch customers" });
  }
});

// POST update/sync customers (Admin use)
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Customers API expects an array of documents" });
    }

    const database = await getDb();
    if (!database) {
      res.setHeader("X-Database-Offline", "true");
    } else {
      res.setHeader("X-Database-Offline", "false");
    }

    const updated = await saveResource("customers", payload);
    res.json(updated);
  } catch (err: any) {
    console.error("[Customers Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist customers" });
  }
});

// POST: Customer Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, location = "United Kingdom", referredByCode = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required for registration." });
    }

    const emailTrim = email.trim().toLowerCase();
    const customersList = await fetchResource("customers");
    
    const existing = customersList.find((c: any) => c.email.toLowerCase() === emailTrim);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Generate unique referral code for the new customer
    const codeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const cleanFirstName = name.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase() || "USER";
    const referralCode = `REF-PS-${cleanFirstName}-${codeSuffix}`;

    // Verify referrer
    let validReferredByCode: string | null = null;
    if (referredByCode) {
      const trimmedCode = referredByCode.trim().toUpperCase();
      const referrer = customersList.find((c: any) => c.referralCode && c.referralCode.toUpperCase() === trimmedCode);
      if (referrer) {
        validReferredByCode = referrer.referralCode;
      }
    }

    const newCustomer: Customer & { passwordHash: string } = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      email: emailTrim,
      subscriptionStatus: "Not subscribed",
      location: location.trim(),
      ordersCount: 0,
      amountSpent: 0,
      addresses: [], // Start with empty addresses array, no mock placeholder
      wishlist: [],
      referralCode,
      storeCredit: 0,
      referredByCode: validReferredByCode,
      passwordHash: hashPassword(password),
    };

    const updatedList = [...customersList, newCustomer];
    await saveResource("customers", updatedList);

    // If successfully registered and has referredByCode, create their 10% coupon
    if (validReferredByCode) {
      try {
        const discountCode = `REF10-${codeSuffix}`;
        const discountsList = await fetchResource("discounts") || [];
        const newDiscount = {
          id: `disc-ref-${newCustomer.id}`,
          title: discountCode,
          status: 'Active',
          method: 'Code',
          eligibility: 'All customers',
          type: 'Amount off order',
          used: 0,
          details: `10% discount welcome coupon for referred customer`,
          valueType: 'Percentage',
          valueAmount: 10,
          limitOnePerCustomer: true
        };
        await saveResource("discounts", [...discountsList, newDiscount]);
        console.log(`[Referral System] Generated 10% discount coupon ${discountCode} for referred customer: ${emailTrim}`);
      } catch (err) {
        console.error("Failed to generate referral discount:", err);
      }
    }

    console.log(`[Customer Auth] New registration successful for: ${emailTrim}`);
    
    // Return customer without passwordHash
    const { passwordHash, ...safeCustomer } = newCustomer;
    res.status(201).json({
      message: "Registration successful!",
      customer: safeCustomer
    });
  } catch (err: any) {
    console.error("[Customer Auth] Signup Error:", err);
    res.status(500).json({ error: err.message || "Failed to complete customer registration" });
  }
});

// POST: Customer Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const emailTrim = email.trim().toLowerCase();
    const customersList = await fetchResource("customers");
    const found: any = customersList.find((c: any) => c.email.toLowerCase() === emailTrim);

    if (!found) {
      return res.status(401).json({ error: "No account found matching this email." });
    }

    let needsUpdate = false;

    // Generate unique referral code for legacy / existing users if they don't have one or have the old format
    const hasOldFormat = found.referralCode && !found.referralCode.startsWith("REF-PS-");
    if (!found.referralCode || hasOldFormat) {
      const codeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const cleanFirstName = found.name.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase() || "USER";
      found.referralCode = `REF-PS-${cleanFirstName}-${codeSuffix}`;
      needsUpdate = true;
    }

    if (found.storeCredit === undefined) {
      found.storeCredit = 0;
      needsUpdate = true;
    }

    if (found.referredByCode === undefined) {
      found.referredByCode = null;
      needsUpdate = true;
    }

    // Support backward compatibility for legacy accounts without password hash
    if (found.passwordHash) {
      if (found.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: "Incorrect password. Please try again." });
      }
    } else {
      // If no passwordHash is set yet, we allow login on first try and save the password hash for subsequent logins
      found.passwordHash = hashPassword(password);
      needsUpdate = true;
    }

    if (needsUpdate) {
      const updatedList = customersList.map((c: any) => c.id === found.id ? found : c);
      await saveResource("customers", updatedList);
      console.log(`[Customer Auth] Initialized referral credentials or password for: ${emailTrim}`);
    }

    console.log(`[Customer Auth] Login successful: ${emailTrim}`);

    // Return authenticated customer details safely
    const { passwordHash, ...safeCustomer } = found;
    res.json({
      message: "Login successful!",
      customer: safeCustomer
    });
  } catch (err: any) {
    console.error("[Customer Auth] Login Error:", err);
    res.status(500).json({ error: err.message || "Failed to complete customer login" });
  }
});

// POST: Secure Admin Login
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Admin email and password are required." });
    }

    const adminEmail = process.env.ADMIN_EMAIL || "Support@pouch-supply.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "January14!2019";

    if (
      email.trim().toLowerCase() === adminEmail.toLowerCase() &&
      password === adminPassword
    ) {
      console.log(`[Admin Auth] Secure admin login succeeded for email: ${email}`);
      const adminToken = `admin-token-${crypto.randomBytes(16).toString("hex")}`;
      res.json({
        success: true,
        message: "Admin access granted.",
        token: adminToken,
        adminUser: {
          email: adminEmail,
          name: "Pouch Supply Administrator"
        }
      });
    } else {
      console.warn(`[Admin Auth] Unauthorized admin login attempt with email: ${email}`);
      res.status(401).json({ error: "Invalid admin login credentials." });
    }
  } catch (err: any) {
    console.error("[Admin Auth] Login Error:", err);
    res.status(500).json({ error: err.message || "Internal server error during admin validation" });
  }
});

export default router;
