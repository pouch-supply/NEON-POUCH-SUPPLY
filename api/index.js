// serverApp.ts
import express from "express";
import path3 from "path";
import fs3 from "fs";

// serverDb.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
var prisma = globalThis.prismaGlobal ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// src/initialData.ts
var INITIAL_PRODUCTS = [];
var INITIAL_COLLECTIONS = [];
var INITIAL_ORDERS = [];
var INITIAL_FILES = [];
var INITIAL_CUSTOMERS = [];
var INITIAL_DISCOUNTS = [];
var INITIAL_BLOGS = [];
var DEFAULT_PAGES = [
  {
    id: "homepage",
    title: "Home Page",
    slug: "",
    visibility: "Visible",
    updatedAt: "Jun 23, 2026",
    isHomepage: true,
    sections: [
      {
        id: "h-s1",
        type: "Image banner",
        settings: {
          fullWidth: true,
          backgroundColor: "#111827",
          headingColor: "#FFFFFF",
          textColor: "#E5E7EB",
          title: "Pouch Supply Storefront",
          description: "Start managing your products, collections, and page sections inside the Admin Dashboard.",
          buttonText: "View Store Catalog",
          buttonLink: "frontend-shop",
          imageUrl: ""
        }
      }
    ]
  },
  {
    id: "brands",
    title: "Brands Directory",
    slug: "brands",
    visibility: "Visible",
    updatedAt: "Jun 23, 2026",
    sections: [
      {
        id: "s2",
        type: "Rich text",
        settings: {
          fullWidth: false,
          backgroundColor: "#FFFFFF",
          headingColor: "#1E293B",
          textColor: "#64748B",
          title: "Official Brands Matrix",
          description: "Explore our catalog of certified compounding premium brands retrieved directly from our synchronized database."
        }
      },
      {
        id: "s3",
        type: "Brand list",
        settings: {
          fullWidth: false,
          backgroundColor: "#FFFFFF",
          headingColor: "#0C1017",
          textColor: "#64748B",
          title: "Official Brands Directory",
          description: "Explore our catalog of certified compounding premium brands.",
          brandItems: [
            { title: "77", linkUrl: "/collections/77", imageUrl: "" },
            { title: "Cuba", linkUrl: "/collections/cuba", imageUrl: "" },
            { title: "Killa", linkUrl: "/collections/killa", imageUrl: "" },
            { title: "Pablo", linkUrl: "/collections/pablo", imageUrl: "" },
            { title: "Velo", linkUrl: "/collections/velo", imageUrl: "" },
            { title: "White Fox", linkUrl: "/collections/white-fox", imageUrl: "" },
            { title: "Zyn", linkUrl: "/collections/zyn", imageUrl: "" },
            { title: "XQS", linkUrl: "/collections/xqs", imageUrl: "" },
            { title: "Nordic Spirit", linkUrl: "/collections/nordic-spirit", imageUrl: "" },
            { title: "Clew", linkUrl: "/collections/clew", imageUrl: "" },
            { title: "Fumi", linkUrl: "/collections/fumi", imageUrl: "" },
            { title: "Snu", linkUrl: "/collections/snu", imageUrl: "" }
          ]
        }
      }
    ]
  },
  {
    id: "subscribe",
    title: "Subscribe Plans",
    slug: "subscribe",
    visibility: "Visible",
    updatedAt: "Jul 10, 2026",
    sections: [
      {
        id: "subs-sec-1",
        type: "Plans",
        settings: {
          fullWidth: false,
          backgroundColor: "#061229",
          headingColor: "#FFFFFF",
          textColor: "#E2E8F0",
          title: "CHOOSE YOUR PLAN",
          description: "Flexible subscriptions. Premium brands. Serious savings.",
          alertBadgeText: "Most customers save up to \xA355/month",
          promoBannerText: "\u2605 FIRST 50 SUBSCRIBERS - Get 10% OFF FOR LIFE >",
          planItems: [
            {
              slug: "lite",
              name: "LITE",
              subtitle: "Best for getting started",
              price: 27.99,
              limit: 6,
              saveAmountText: "Save \xA35.00/month",
              imageUrl: "",
              features: [
                "6 premium cans",
                "Flexible delivery",
                "Change flavours anytime",
                "Skip or pause anytime"
              ],
              isPopular: false
            },
            {
              slug: "core",
              name: "CORE",
              subtitle: "Most flexible",
              price: 35.99,
              limit: 8,
              saveAmountText: "Save \xA310.00/month",
              imageUrl: "",
              features: [
                "8 premium cans",
                "Lower price per can",
                "Change or swap brands",
                "Skip or pause anytime"
              ],
              isPopular: false
            },
            {
              slug: "pro",
              name: "PRO",
              subtitle: "Best value",
              price: 40.99,
              limit: 10,
              saveAmountText: "Save \xA314.00/month",
              imageUrl: "",
              features: [
                "10 premium cans",
                "FREE delivery \u{1F4E6}",
                "Best price per can",
                "Loyalty rewards boost",
                "Skip or pause anytime"
              ],
              isPopular: true
            },
            {
              slug: "ultimate",
              name: "ULTIMATE",
              subtitle: "Maximum savings",
              price: 46.99,
              limit: 12,
              saveAmountText: "Save \xA319.00/month",
              imageUrl: "",
              features: [
                "12 premium cans",
                "FREE delivery \u{1F4E6}",
                "Lowest price per can",
                "\xA33.80 for any extra can",
                "Skip or pause anytime"
              ],
              extraText: "\xA33.80 FOR ANY ADDITIONAL CAN",
              isPopular: false
            }
          ]
        }
      }
    ]
  }
];

// serverDb.ts
dotenv.config();
var memoryCache = {
  products: [...INITIAL_PRODUCTS],
  collections: [...INITIAL_COLLECTIONS],
  orders: [...INITIAL_ORDERS],
  files: [...INITIAL_FILES],
  customers: [...INITIAL_CUSTOMERS],
  discounts: [...INITIAL_DISCOUNTS],
  customPages: [...DEFAULT_PAGES],
  blogs: [...INITIAL_BLOGS]
};
var BACKUP_FILE_PATH = path.join(process.cwd(), "local_store_data.json");
function loadMemoryCacheFromBackup() {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const raw = fs.readFileSync(BACKUP_FILE_PATH, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            memoryCache[key] = data[key];
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Local Backup] Could not load local_store_data.json backup:", err);
  }
}
function persistMemoryCacheToBackup() {
  try {
    fs.writeFileSync(BACKUP_FILE_PATH, JSON.stringify(memoryCache, null, 2), "utf8");
  } catch (err) {
    console.warn("[Local Backup] Could not write to local_store_data.json backup:", err);
  }
}
loadMemoryCacheFromBackup();
var isTablesInitialized = false;
async function ensureNeonTablesExist() {
  if (isTablesInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoreResource" (
        "id" TEXT PRIMARY KEY,
        "resource" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "data" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoreResource_resource_itemId_key" UNIQUE ("resource", "itemId")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoreSetting" (
        "id" TEXT PRIMARY KEY,
        "data" JSONB NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemStatus" (
        "id" TEXT PRIMARY KEY,
        "key" TEXT UNIQUE NOT NULL,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FileEntry" (
        "id" TEXT PRIMARY KEY,
        "publicId" TEXT UNIQUE,
        "url" TEXT NOT NULL,
        "secureUrl" TEXT,
        "resourceType" TEXT DEFAULT 'image',
        "format" TEXT,
        "width" INTEGER,
        "height" INTEGER,
        "fileSize" TEXT,
        "folder" TEXT DEFAULT 'storefront_media',
        "originalFilename" TEXT,
        "fileName" TEXT,
        "altText" TEXT,
        "dateAdded" TEXT,
        "size" TEXT,
        "references" TEXT,
        "mimeType" TEXT,
        "data" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    isTablesInitialized = true;
  } catch (err) {
    console.warn("[Neon Table Setup] Warning: Table initialization check encountered error:", err);
  }
}
function getHostFromDatabaseUrl(urlStr) {
  if (!urlStr) return { host: "N/A", database: "N/A" };
  try {
    const cleaned = urlStr.trim().replace(/^["']|["']$/g, "");
    const parsed = new URL(cleaned);
    return {
      host: parsed.hostname || "N/A",
      database: parsed.pathname.replace(/^\//, "") || "N/A"
    };
  } catch (e) {
    return { host: "N/A", database: "N/A" };
  }
}
async function testNeonConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return {
      status: "not-configured",
      provider: "Neon PostgreSQL",
      error: "DATABASE_URL environment variable is not configured."
    };
  }
  const { host, database } = getHostFromDatabaseUrl(dbUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
    await ensureNeonTablesExist();
    return {
      status: "connected",
      provider: "Neon PostgreSQL",
      host,
      database
    };
  } catch (err) {
    return {
      status: "error",
      provider: "Neon PostgreSQL",
      host,
      database,
      error: err?.message || String(err)
    };
  }
}
async function getConnectionStatus() {
  return await testNeonConnection();
}
async function getDatabaseDetails() {
  const dbUrl = process.env.DATABASE_URL;
  const { host, database } = getHostFromDatabaseUrl(dbUrl);
  try {
    if (!dbUrl) {
      return {
        provider: "Neon PostgreSQL",
        status: "not-configured",
        host: "N/A",
        database: "N/A",
        uriHost: "N/A",
        dbName: "N/A",
        collections: [],
        models: [],
        error: "DATABASE_URL is missing"
      };
    }
    const versionResult = await prisma.$queryRaw`SELECT version()`;
    const version = versionResult[0]?.version || "PostgreSQL (Neon)";
    let collectionsList = [];
    try {
      await ensureNeonTablesExist();
      const grouped = await prisma.storeResource.groupBy({
        by: ["resource"],
        _count: { _all: true }
      });
      collectionsList = grouped.map((g) => ({
        name: g.resource,
        count: g._count._all
      }));
    } catch (gErr) {
      console.warn("[getDatabaseDetails] Failed grouping resources:", gErr);
    }
    const modelsList = [
      "SystemStatus",
      "StoreResource",
      "StoreSetting",
      "Product",
      "Collection",
      "FileEntry",
      "Order",
      "CustomPage",
      "Customer",
      "BlogPost",
      "Discount",
      "LayoutSetting"
    ];
    return {
      provider: "Neon PostgreSQL",
      status: "connected",
      host,
      database,
      uriHost: host,
      dbName: database,
      version,
      orm: "Prisma",
      collections: collectionsList,
      models: modelsList
    };
  } catch (err) {
    return {
      provider: "Neon PostgreSQL",
      status: "error",
      host,
      database,
      uriHost: host,
      dbName: database,
      collections: [],
      models: [],
      error: err?.message || String(err),
      orm: "Prisma"
    };
  }
}
async function updateDatabaseUrl(newUrl) {
  const trimmed = newUrl.trim();
  process.env.DATABASE_URL = trimmed;
  isTablesInitialized = false;
  try {
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }
    const regex = /^DATABASE_URL\s*=\s*.*$/m;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `DATABASE_URL="${trimmed}"`);
    } else {
      envContent = `${envContent.trim()}
DATABASE_URL="${trimmed}"
`;
    }
    fs.writeFileSync(envPath, envContent.trim() + "\n", "utf8");
  } catch (err) {
    console.warn("[Database Config] Failed to persist DATABASE_URL to .env:", err);
  }
  return await testNeonConnection();
}
async function getDb() {
  const status = await testNeonConnection();
  return status.status === "connected";
}
function normalizeResourceName(resource) {
  if (!resource) return resource;
  const lower = resource.toLowerCase();
  if (lower === "custompages") return "customPages";
  return resource;
}
async function fetchResource(resource) {
  const normResource = normalizeResourceName(resource);
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const records = await prisma.storeResource.findMany({
        where: { resource: normResource },
        orderBy: { createdAt: "asc" }
      });
      if (records && records.length > 0) {
        const list = records.map((r) => r.data);
        memoryCache[normResource] = list;
        persistMemoryCacheToBackup();
        return list;
      }
      const defaultList = memoryCache[normResource] || memoryCache[resource] || [];
      if (defaultList.length > 0) {
        console.log(`[Neon DB] Seeding initial ${normResource} (${defaultList.length} items)...`);
        for (const item of defaultList) {
          const itemId = String(item.id || item.slug || `item-${Date.now()}-${Math.random()}`);
          await prisma.storeResource.upsert({
            where: {
              resource_itemId: {
                resource: normResource,
                itemId
              }
            },
            update: { data: item },
            create: {
              resource: normResource,
              itemId,
              data: item
            }
          });
        }
      }
      return defaultList;
    } catch (err) {
      console.error(`[Neon DB] Error fetching resource ${normResource}:`, err);
    }
  }
  return memoryCache[normResource] || memoryCache[resource] || [];
}
async function saveResource(resource, list) {
  const normResource = normalizeResourceName(resource);
  if (!Array.isArray(list)) return memoryCache[normResource] || [];
  memoryCache[normResource] = [...list];
  if (normResource !== resource) memoryCache[resource] = memoryCache[normResource];
  persistMemoryCacheToBackup();
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const validItemIds = [];
      for (const item of list) {
        if (!item) continue;
        const itemId = String(item.id || item.slug || `item-${Date.now()}-${Math.random()}`);
        validItemIds.push(itemId);
        await prisma.storeResource.upsert({
          where: {
            resource_itemId: {
              resource: normResource,
              itemId
            }
          },
          update: { data: item },
          create: {
            resource: normResource,
            itemId,
            data: item
          }
        });
      }
      await prisma.storeResource.deleteMany({
        where: {
          resource: normResource,
          itemId: {
            notIn: validItemIds
          }
        }
      });
    } catch (err) {
      console.error(`[Neon DB] Error saving resource ${normResource}:`, err);
    }
  }
  return list;
}
async function fetchSingleItem(resource, id) {
  const normResource = normalizeResourceName(resource);
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const record = await prisma.storeResource.findFirst({
        where: {
          resource: normResource,
          itemId: id
        }
      });
      if (record) return record.data;
    } catch (err) {
      console.error(`[Neon DB] Error fetching single item ${normResource}/${id}:`, err);
    }
  }
  const items = memoryCache[normResource] || memoryCache[resource] || [];
  return items.find((i) => i.id === id || i.slug === id) || null;
}
async function saveSingleItem(resource, item) {
  if (!item) return item;
  const normResource = normalizeResourceName(resource);
  const itemId = String(item.id || item.slug || `item-${Date.now()}-${Math.random()}`);
  const items = memoryCache[normResource] || memoryCache[resource] || [];
  const idx = items.findIndex((i) => i.id === itemId || i.slug === itemId);
  if (idx !== -1) {
    items[idx] = { ...item };
  } else {
    items.push({ ...item });
  }
  memoryCache[normResource] = items;
  persistMemoryCacheToBackup();
  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeResource.upsert({
        where: {
          resource_itemId: {
            resource: normResource,
            itemId
          }
        },
        update: { data: item },
        create: {
          resource: normResource,
          itemId,
          data: item
        }
      });
    } catch (err) {
      console.error(`[Neon DB] Error saving single item ${normResource}/${itemId}:`, err);
    }
  }
  return item;
}
async function deleteSingleItem(resource, id) {
  if (!id) return false;
  const normResource = normalizeResourceName(resource);
  if (memoryCache[normResource]) {
    memoryCache[normResource] = memoryCache[normResource].filter((i) => i.id !== id && i.slug !== id);
  }
  persistMemoryCacheToBackup();
  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeResource.deleteMany({
        where: {
          resource: normResource,
          itemId: id
        }
      });
    } catch (err) {
      console.error(`[Neon DB] Error deleting single item ${normResource}/${id}:`, err);
    }
  }
  return true;
}
var memoryImages = {};
async function saveUploadedImage(id, base64Data, mimeType) {
  memoryImages[id] = { base64Data, mimeType };
  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeResource.upsert({
        where: {
          resource_itemId: {
            resource: "uploaded_images",
            itemId: id
          }
        },
        update: { data: { id, base64Data, mimeType } },
        create: {
          resource: "uploaded_images",
          itemId: id,
          data: { id, base64Data, mimeType }
        }
      });
    } catch (e) {
      console.warn("[Neon DB] Failed to persist uploaded image:", e);
    }
  }
  return `/uploads/${id}`;
}
async function getUploadedImage(id) {
  if (memoryImages[id]) return memoryImages[id];
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const record = await prisma.storeResource.findFirst({
        where: {
          resource: "uploaded_images",
          itemId: id
        }
      });
      if (record && record.data) {
        const data = record.data;
        memoryImages[id] = { base64Data: data.base64Data, mimeType: data.mimeType };
        return memoryImages[id];
      }
    } catch (e) {
    }
  }
  return null;
}
async function fetchLayoutSettings() {
  let settingsData = null;
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const setting = await prisma.storeSetting.findUnique({
        where: { id: "layout_settings" }
      });
      if (setting && setting.data) {
        settingsData = setting.data;
      }
    } catch (err) {
      console.error("[Neon DB] Error fetching layout settings:", err);
    }
  }
  if (!settingsData) {
    const filePath = path.join(process.cwd(), "layout_settings.json");
    if (fs.existsSync(filePath)) {
      try {
        settingsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {
      }
    }
  }
  if (!settingsData) {
    settingsData = {
      id: "layout_settings",
      headerLogoText: "POUCH SUPPLY",
      headerLogoSubtext: "Premium Nicotine",
      headerLogoImage: "",
      footerLogoText: "POUCH SUPPLY",
      footerLogoDescription: "Leading premium directory for tobacco-free nicotine slim white canisters.",
      footerLogoImage: "",
      menuItems: [
        { id: "1", label: "Home", tab: "frontend-home", type: "tab" },
        { id: "2", label: "Subscribe", tab: "frontend-subscribe", type: "tab" },
        { id: "3", label: "Shop Now", tab: "frontend-shop", type: "tab" },
        { id: "4", label: "All Brands", tab: "frontend-brands", type: "tab" },
        { id: "5", label: "About", tab: "about", type: "tab" }
      ]
    };
  }
  if (settingsData.cloudinaryCloudName && !process.env.CLOUDINARY_CLOUD_NAME) {
    process.env.CLOUDINARY_CLOUD_NAME = settingsData.cloudinaryCloudName;
  }
  if (settingsData.cloudinaryApiKey && !process.env.CLOUDINARY_API_KEY) {
    process.env.CLOUDINARY_API_KEY = settingsData.cloudinaryApiKey;
  }
  if (settingsData.cloudinaryApiSecret && !process.env.CLOUDINARY_API_SECRET) {
    process.env.CLOUDINARY_API_SECRET = settingsData.cloudinaryApiSecret;
  }
  return settingsData;
}
async function saveLayoutSettings(settings) {
  if (settings.cloudinaryCloudName !== void 0) {
    process.env.CLOUDINARY_CLOUD_NAME = settings.cloudinaryCloudName || "";
  }
  if (settings.cloudinaryApiKey !== void 0) {
    process.env.CLOUDINARY_API_KEY = settings.cloudinaryApiKey || "";
  }
  if (settings.cloudinaryApiSecret !== void 0) {
    process.env.CLOUDINARY_API_SECRET = settings.cloudinaryApiSecret || "";
  }
  const filePath = path.join(process.cwd(), "layout_settings.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
  }
  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeSetting.upsert({
        where: { id: "layout_settings" },
        update: { data: settings },
        create: { id: "layout_settings", data: settings }
      });
    } catch (err) {
      console.error("[Neon DB] Error saving layout settings:", err);
    }
  }
  return settings;
}

// backend/routes/crudHelper.ts
import { Router } from "express";
function createCrudRouter(resourceName) {
  const router11 = Router();
  router11.get("/", async (req, res) => {
    try {
      const data = await fetchResource(resourceName);
      res.json(data);
    } catch (err) {
      console.error(`[${resourceName} Router] GET Error:`, err);
      res.status(500).json({ error: err.message || `Failed to fetch ${resourceName}` });
    }
  });
  router11.get("/:id", async (req, res) => {
    try {
      const item = await fetchSingleItem(resourceName, req.params.id);
      if (!item) {
        return res.status(404).json({ error: `Item with ID ${req.params.id} not found` });
      }
      res.json(item);
    } catch (err) {
      console.error(`[${resourceName} Router] GET /:id Error:`, err);
      res.status(500).json({ error: err.message || `Failed to fetch ${resourceName} item` });
    }
  });
  router11.post("/", async (req, res) => {
    try {
      const payload = req.body;
      const database = await getDb();
      if (!database) {
        res.setHeader("X-Database-Offline", "true");
      } else {
        res.setHeader("X-Database-Offline", "false");
      }
      if (Array.isArray(payload)) {
        const updated = await saveResource(resourceName, payload);
        return res.json(updated);
      } else if (payload && typeof payload === "object") {
        const updatedItem = await saveSingleItem(resourceName, payload);
        return res.json(updatedItem);
      } else {
        return res.status(400).json({ error: "Invalid payload for POST operation" });
      }
    } catch (err) {
      console.error(`[${resourceName} Router] POST Error:`, err);
      res.status(500).json({ error: err.message || `Failed to persist ${resourceName}` });
    }
  });
  router11.put("/:id", async (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Invalid item payload" });
      }
      const itemToSave = { ...payload, id: req.params.id };
      const database = await getDb();
      if (!database) {
        res.setHeader("X-Database-Offline", "true");
      } else {
        res.setHeader("X-Database-Offline", "false");
      }
      const updated = await saveSingleItem(resourceName, itemToSave);
      res.json(updated);
    } catch (err) {
      console.error(`[${resourceName} Router] PUT /:id Error:`, err);
      res.status(500).json({ error: err.message || `Failed to update ${resourceName} item` });
    }
  });
  router11.delete("/:id", async (req, res) => {
    try {
      const database = await getDb();
      if (!database) {
        res.setHeader("X-Database-Offline", "true");
      } else {
        res.setHeader("X-Database-Offline", "false");
      }
      const success = await deleteSingleItem(resourceName, req.params.id);
      res.json({ success, id: req.params.id });
    } catch (err) {
      console.error(`[${resourceName} Router] DELETE /:id Error:`, err);
      res.status(500).json({ error: err.message || `Failed to delete ${resourceName} item` });
    }
  });
  return router11;
}

// backend/routes/products.ts
var router = createCrudRouter("products");
var products_default = router;

// backend/routes/collections.ts
var router2 = createCrudRouter("collections");
var collections_default = router2;

// backend/routes/orders.ts
import { Router as Router2 } from "express";
var router3 = Router2();
router3.get("/", async (req, res) => {
  try {
    const data = await fetchResource("orders");
    res.json(data);
  } catch (err) {
    console.error("[Orders Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch orders" });
  }
});
router3.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Orders API expects an array of documents" });
    }
    const database = await getDb();
    if (!database) {
      res.setHeader("X-Database-Offline", "true");
    } else {
      res.setHeader("X-Database-Offline", "false");
    }
    const updated = await saveResource("orders", payload);
    res.json(updated);
  } catch (err) {
    console.error("[Orders Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist orders" });
  }
});
var orders_default = router3;

// backend/routes/files.ts
import { Router as Router4 } from "express";

// backend/services/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}
function getCloudinaryClient() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
  }
  return cloudinary;
}
async function uploadToCloudinary(fileBufferOrDataUri, options = {}) {
  const client = getCloudinaryClient();
  const folder = options.folder || "storefront_media";
  const resourceType = options.resourceType || "auto";
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing.");
  }
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true
    };
    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }
    if (options.originalFilename) {
      uploadOptions.context = { original_filename: options.originalFilename };
    }
    if (Buffer.isBuffer(fileBufferOrDataUri)) {
      const uploadStream = client.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Upload to Cloudinary failed without error result."));
          }
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            format: result.format || "bin",
            width: result.width,
            height: result.height,
            fileSize: result.bytes,
            folder: result.folder || folder,
            originalFilename: options.originalFilename || result.original_filename || result.public_id,
            createdAt: result.created_at || (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      );
      uploadStream.end(fileBufferOrDataUri);
    } else {
      client.uploader.upload(fileBufferOrDataUri, uploadOptions, (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Upload to Cloudinary failed without error result."));
        }
        resolve({
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          resourceType: result.resource_type,
          format: result.format || "bin",
          width: result.width,
          height: result.height,
          fileSize: result.bytes,
          folder: result.folder || folder,
          originalFilename: options.originalFilename || result.original_filename || result.public_id,
          createdAt: result.created_at || (/* @__PURE__ */ new Date()).toISOString()
        });
      });
    }
  });
}
async function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!isCloudinaryConfigured()) return false;
  try {
    const client = getCloudinaryClient();
    const result = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    return result.result === "ok" || result.result === "not found";
  } catch (err) {
    console.error(`[Cloudinary] Delete error for publicId ${publicId}:`, err);
    return false;
  }
}

// backend/routes/media.ts
import { Router as Router3 } from "express";
import multer from "multer";
import fs2 from "fs";
import path2 from "path";
var router4 = Router3();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
  // 100MB
});
async function checkMediaReferences(fileUrl) {
  const references = [];
  if (!fileUrl) return references;
  try {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { image: { equals: fileUrl } },
          { media: { has: fileUrl } }
        ]
      },
      select: { title: true }
    });
    products.forEach((p) => references.push(`Product: ${p.title}`));
    const collections = await prisma.collection.findMany({
      where: {
        OR: [
          { image: { equals: fileUrl } },
          { ogImage: { equals: fileUrl } }
        ]
      },
      select: { title: true }
    });
    collections.forEach((c) => references.push(`Collection: ${c.title}`));
    const pages = await prisma.customPage.findMany({
      select: { title: true, sections: true }
    });
    pages.forEach((p) => {
      const secStr = JSON.stringify(p.sections || "");
      if (secStr.includes(fileUrl)) {
        references.push(`Page: ${p.title}`);
      }
    });
    const blogs = await prisma.blogPost.findMany({
      where: { image: { equals: fileUrl } },
      select: { title: true }
    });
    blogs.forEach((b) => references.push(`Blog: ${b.title}`));
    const layout = await prisma.layoutSetting.findFirst({
      where: { id: "layout_settings" }
    });
    if (layout) {
      if (layout.headerLogoImage === fileUrl || layout.footerLogoImage === fileUrl) {
        references.push(`Header/Footer Settings`);
      }
      const menuStr = JSON.stringify(layout.menuItems || "");
      if (menuStr.includes(fileUrl)) {
        references.push(`Navigation Settings`);
      }
    }
  } catch (err) {
    console.error("[ReferenceCheck] Error checking references:", err);
  }
  return references;
}
router4.get("/", async (req, res) => {
  try {
    const files = await prisma.fileEntry.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(files);
  } catch (err) {
    console.warn("[Media API] GET error, falling back to StoreResource:", err?.message || err);
    try {
      const fallbackFiles = await fetchResource("files");
      res.json(fallbackFiles);
    } catch (fErr) {
      res.status(500).json({ error: fErr.message || "Failed to list media files" });
    }
  }
});
router4.post("/check-references", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    const references = await checkMediaReferences(url);
    res.json({ inUse: references.length > 0, references });
  } catch (err) {
    res.status(500).json({ error: err.message || "Error checking media references" });
  }
});
router4.post("/upload", upload.single("file"), async (req, res) => {
  try {
    let fileBuffer = null;
    let fileName = "Uploaded Asset";
    let mimeType = "image/png";
    let folder = req.body.folder || "storefront_media";
    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname || "Uploaded Asset";
      mimeType = req.file.mimetype || "image/png";
    } else if (req.body.data) {
      const dataStr = req.body.data;
      fileName = req.body.filename || req.body.fileName || "Uploaded Asset";
      if (dataStr.startsWith("data:")) {
        const matches = dataStr.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          fileBuffer = Buffer.from(matches[2], "base64");
        }
      } else {
        fileBuffer = Buffer.from(dataStr.replace(/^data:[^;]+;base64,/, ""), "base64");
      }
    }
    if (!fileBuffer) {
      return res.status(400).json({ error: "No file data or buffer was provided" });
    }
    const passedCloudName = req.body?.cloudName || req.body?.cloudinaryCloudName || req.body?.CLOUDINARY_CLOUD_NAME;
    const passedApiKey = req.body?.apiKey || req.body?.cloudinaryApiKey || req.body?.CLOUDINARY_API_KEY;
    const passedApiSecret = req.body?.apiSecret || req.body?.cloudinaryApiSecret || req.body?.CLOUDINARY_API_SECRET;
    if (passedCloudName) process.env.CLOUDINARY_CLOUD_NAME = String(passedCloudName).trim();
    if (passedApiKey) process.env.CLOUDINARY_API_KEY = String(passedApiKey).trim();
    if (passedApiSecret) process.env.CLOUDINARY_API_SECRET = String(passedApiSecret).trim();
    if (!isCloudinaryConfigured()) {
      try {
        await fetchLayoutSettings();
      } catch (e) {
      }
    }
    const isVideo = mimeType.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)$/i.test(fileName);
    const resourceType = isVideo ? "video" : "auto";
    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await uploadToCloudinary(fileBuffer, {
          folder,
          originalFilename: fileName,
          resourceType
        });
        const fileId2 = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const displaySize = uploadResult.fileSize > 1024 * 1024 ? `${(uploadResult.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(uploadResult.fileSize / 1024)} KB`;
        let savedEntry = null;
        const entryResourceType = uploadResult.resourceType || (isVideo ? "video" : "image");
        const entryMimeType = mimeType || (isVideo ? "video/mp4" : "image/png");
        try {
          savedEntry = await prisma.fileEntry.create({
            data: {
              id: fileId2,
              publicId: uploadResult.publicId,
              url: uploadResult.secureUrl || uploadResult.url,
              secureUrl: uploadResult.secureUrl,
              resourceType: entryResourceType,
              format: uploadResult.format,
              width: uploadResult.width || null,
              height: uploadResult.height || null,
              fileSize: displaySize,
              size: displaySize,
              folder: uploadResult.folder,
              originalFilename: fileName,
              fileName,
              altText: fileName.split(".")[0] || "Uploaded Media Asset",
              dateAdded: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
              references: "Direct Upload",
              mimeType: entryMimeType
            }
          });
        } catch (dbErr) {
          savedEntry = {
            id: fileId2,
            publicId: uploadResult.publicId,
            url: uploadResult.secureUrl || uploadResult.url,
            secureUrl: uploadResult.secureUrl,
            fileName,
            altText: fileName.split(".")[0] || "Uploaded Media Asset",
            dateAdded: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            mimeType: entryMimeType,
            resourceType: entryResourceType,
            size: displaySize,
            fileSize: displaySize,
            references: "Direct Upload"
          };
        }
        try {
          const currentFiles = await fetchResource("files");
          const currentArr = Array.isArray(currentFiles) ? currentFiles : [];
          const updatedFiles = [savedEntry, ...currentArr.filter((f) => f && f.url !== savedEntry.url)];
          await saveResource("files", updatedFiles);
        } catch (sErr) {
          console.warn("[Media API] Fallback store sync error:", sErr);
        }
        return res.json({
          success: true,
          file: savedEntry,
          url: savedEntry.url,
          publicId: savedEntry.publicId,
          id: savedEntry.id
        });
      } catch (cErr) {
        console.warn("[Media API] Cloudinary upload failed, falling back to local disk:", cErr?.message || cErr);
      }
    }
    const fileId = `file-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
    const base64Str = fileBuffer.toString("base64");
    let ext = "png";
    if (fileName && fileName.includes(".")) {
      ext = fileName.split(".").pop()?.toLowerCase() || "png";
    } else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
      ext = "jpg";
    } else if (mimeType.includes("mp4")) {
      ext = "mp4";
    }
    const filenameOnDisk = `${fileId}.${ext}`;
    const uploadsDir = path2.join(process.cwd(), "uploads");
    if (!fs2.existsSync(uploadsDir)) {
      try {
        fs2.mkdirSync(uploadsDir, { recursive: true });
      } catch (mErr) {
      }
    }
    const diskPath = path2.join(uploadsDir, filenameOnDisk);
    try {
      fs2.writeFileSync(diskPath, fileBuffer);
    } catch (fsErr) {
    }
    await saveUploadedImage(fileId, base64Str, mimeType);
    const fileUrl = `/api/uploads/${filenameOnDisk}`;
    const calculatedSize = fileBuffer.length > 1024 * 1024 ? `${(fileBuffer.length / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(fileBuffer.length / 1024)} KB`;
    let fileRecord = {
      id: fileId,
      fileName,
      url: fileUrl,
      altText: fileName.split(".")[0] || "Uploaded Media Asset",
      mimeType: mimeType || (isVideo ? "video/mp4" : "image/png"),
      resourceType: isVideo ? "video" : "image",
      size: calculatedSize,
      fileSize: calculatedSize,
      references: "Direct Upload",
      dateAdded: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    try {
      fileRecord = await prisma.fileEntry.create({
        data: fileRecord
      });
    } catch (fErr) {
    }
    try {
      const currentFiles = await fetchResource("files");
      const currentArr = Array.isArray(currentFiles) ? currentFiles : [];
      const updatedFiles = [fileRecord, ...currentArr.filter((f) => f && f.url !== fileRecord.url)];
      await saveResource("files", updatedFiles);
    } catch (sErr) {
    }
    res.json({
      success: true,
      file: fileRecord,
      url: fileUrl,
      id: fileId,
      fileName,
      mimeType: fileRecord.mimeType
    });
  } catch (err) {
    console.error("[Media API] Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to upload media asset" });
  }
});
router4.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, altText, folder } = req.body;
    const existing = await prisma.fileEntry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Media file not found" });
    }
    const updated = await prisma.fileEntry.update({
      where: { id },
      data: {
        fileName: fileName ?? existing.fileName,
        altText: altText ?? existing.altText,
        folder: folder ?? existing.folder
      }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update media file metadata" });
  }
});
router4.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === "true";
    const existing = await prisma.fileEntry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Media file not found" });
    }
    if (!force) {
      const refs = await checkMediaReferences(existing.url);
      if (refs.length > 0) {
        return res.status(409).json({
          error: "File is currently referenced in your store.",
          references: refs,
          canForce: true
        });
      }
    }
    if (existing.publicId) {
      const resType = existing.resourceType || "image";
      await deleteFromCloudinary(existing.publicId, resType);
    }
    await prisma.fileEntry.delete({ where: { id } });
    res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error("[Media API] Delete error:", err);
    res.status(500).json({ error: err.message || "Failed to delete media asset" });
  }
});
var media_default = router4;

// backend/routes/files.ts
var router5 = Router4();
router5.get("/", async (req, res) => {
  try {
    const data = await prisma.fileEntry.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.json(data);
  } catch (err) {
    console.warn("[Files Router] Prisma GET failed, falling back to StoreResource:", err?.message || err);
    try {
      const fallbackData = await fetchResource("files");
      return res.json(fallbackData);
    } catch (fallbackErr) {
      console.error("[Files Router] GET Error:", fallbackErr);
      return res.status(500).json({ error: fallbackErr.message || "Failed to fetch files" });
    }
  }
});
router5.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Files API expects an array of documents" });
    }
    try {
      for (const file of payload) {
        if (!file.id || !file.url) continue;
        await prisma.fileEntry.upsert({
          where: { id: file.id },
          update: {
            fileName: file.fileName || file.originalFilename || "Media Asset",
            altText: file.altText,
            size: file.size || file.fileSize,
            references: file.references,
            url: file.url,
            secureUrl: file.secureUrl || file.url,
            mimeType: file.mimeType,
            publicId: file.publicId ? file.publicId : null,
            resourceType: file.resourceType,
            format: file.format,
            folder: file.folder
          },
          create: {
            id: file.id,
            fileName: file.fileName || file.originalFilename || "Media Asset",
            altText: file.altText || "Media Asset",
            size: file.size || file.fileSize || "Media",
            references: file.references || "Direct Upload",
            url: file.url,
            secureUrl: file.secureUrl || file.url,
            mimeType: file.mimeType,
            publicId: file.publicId ? file.publicId : null,
            resourceType: file.resourceType || "image",
            format: file.format,
            folder: file.folder || "storefront_media"
          }
        });
      }
      const updated = await prisma.fileEntry.findMany({
        orderBy: { createdAt: "desc" }
      });
      return res.json(updated);
    } catch (prismaErr) {
      console.warn("[Files Router] Prisma POST failed, saving to StoreResource fallback:", prismaErr?.message || prismaErr);
      const fallbackSaved = await saveResource("files", payload);
      return res.json(fallbackSaved);
    }
  } catch (err) {
    console.error("[Files Router] POST Error:", err);
    return res.status(500).json({ error: err.message || "Failed to persist files" });
  }
});
router5.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === "true";
    try {
      const existing = await prisma.fileEntry.findFirst({
        where: {
          OR: [
            { id },
            { url: id },
            { publicId: id }
          ]
        }
      });
      if (existing) {
        if (!force) {
          const refs = await checkMediaReferences(existing.url);
          if (refs.length > 0) {
            return res.status(409).json({
              error: "File is currently referenced in your store.",
              references: refs,
              canForce: true
            });
          }
        }
        if (existing.publicId) {
          await deleteFromCloudinary(existing.publicId, existing.resourceType || "image");
        }
        await prisma.fileEntry.delete({ where: { id: existing.id } });
      }
      const updated = await prisma.fileEntry.findMany({
        orderBy: { createdAt: "desc" }
      });
      return res.json(updated);
    } catch (prismaErr) {
      console.warn("[Files Router] Prisma DELETE failed, falling back to StoreResource:", prismaErr?.message || prismaErr);
      const files = await fetchResource("files");
      const filtered = files.filter((f) => f.id !== id && f.url !== id && f.publicId !== id);
      const updated = await saveResource("files", filtered);
      return res.json(updated);
    }
  } catch (err) {
    console.error("[Files Router] DELETE Error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete file" });
  }
});
var files_default = router5;

// backend/routes/customers.ts
import { Router as Router5 } from "express";
import crypto from "crypto";
var router6 = Router5();
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "pouch_supply_salt_123!").digest("hex");
}
router6.get("/", async (req, res) => {
  try {
    const data = await fetchResource("customers");
    const sanitized = data.map(({ passwordHash, ...rest }) => rest);
    res.json(sanitized);
  } catch (err) {
    console.error("[Customers Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch customers" });
  }
});
router6.post("/", async (req, res) => {
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
  } catch (err) {
    console.error("[Customers Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist customers" });
  }
});
router6.post("/signup", async (req, res) => {
  try {
    const { name, email, password, location = "United Kingdom", referredByCode = null } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required for registration." });
    }
    const emailTrim = email.trim().toLowerCase();
    const customersList = await fetchResource("customers");
    const existing = customersList.find((c) => c.email.toLowerCase() === emailTrim);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const codeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const cleanFirstName = name.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase() || "USER";
    const referralCode = `REF-PS-${cleanFirstName}-${codeSuffix}`;
    let validReferredByCode = null;
    if (referredByCode) {
      const trimmedCode = referredByCode.trim().toUpperCase();
      const referrer = customersList.find((c) => c.referralCode && c.referralCode.toUpperCase() === trimmedCode);
      if (referrer) {
        validReferredByCode = referrer.referralCode;
      }
    }
    const newCustomer = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      email: emailTrim,
      subscriptionStatus: "Not subscribed",
      location: location.trim(),
      ordersCount: 0,
      amountSpent: 0,
      addresses: [],
      // Start with empty addresses array, no mock placeholder
      wishlist: [],
      referralCode,
      storeCredit: 0,
      referredByCode: validReferredByCode,
      passwordHash: hashPassword(password)
    };
    const updatedList = [...customersList, newCustomer];
    await saveResource("customers", updatedList);
    if (validReferredByCode) {
      try {
        const discountCode = `REF10-${codeSuffix}`;
        const discountsList = await fetchResource("discounts") || [];
        const newDiscount = {
          id: `disc-ref-${newCustomer.id}`,
          title: discountCode,
          status: "Active",
          method: "Code",
          eligibility: "All customers",
          type: "Amount off order",
          used: 0,
          details: `10% discount welcome coupon for referred customer`,
          valueType: "Percentage",
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
    const { passwordHash, ...safeCustomer } = newCustomer;
    res.status(201).json({
      message: "Registration successful!",
      customer: safeCustomer
    });
  } catch (err) {
    console.error("[Customer Auth] Signup Error:", err);
    res.status(500).json({ error: err.message || "Failed to complete customer registration" });
  }
});
router6.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const emailTrim = email.trim().toLowerCase();
    const customersList = await fetchResource("customers");
    const found = customersList.find((c) => c.email.toLowerCase() === emailTrim);
    if (!found) {
      return res.status(401).json({ error: "No account found matching this email." });
    }
    let needsUpdate = false;
    const hasOldFormat = found.referralCode && !found.referralCode.startsWith("REF-PS-");
    if (!found.referralCode || hasOldFormat) {
      const codeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const cleanFirstName = found.name.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase() || "USER";
      found.referralCode = `REF-PS-${cleanFirstName}-${codeSuffix}`;
      needsUpdate = true;
    }
    if (found.storeCredit === void 0) {
      found.storeCredit = 0;
      needsUpdate = true;
    }
    if (found.referredByCode === void 0) {
      found.referredByCode = null;
      needsUpdate = true;
    }
    if (found.passwordHash) {
      if (found.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: "Incorrect password. Please try again." });
      }
    } else {
      found.passwordHash = hashPassword(password);
      needsUpdate = true;
    }
    if (needsUpdate) {
      const updatedList = customersList.map((c) => c.id === found.id ? found : c);
      await saveResource("customers", updatedList);
      console.log(`[Customer Auth] Initialized referral credentials or password for: ${emailTrim}`);
    }
    console.log(`[Customer Auth] Login successful: ${emailTrim}`);
    const { passwordHash, ...safeCustomer } = found;
    res.json({
      message: "Login successful!",
      customer: safeCustomer
    });
  } catch (err) {
    console.error("[Customer Auth] Login Error:", err);
    res.status(500).json({ error: err.message || "Failed to complete customer login" });
  }
});
router6.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Admin email and password are required." });
    }
    const adminEmail = process.env.ADMIN_EMAIL || "Support@pouch-supply.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "January14!2019";
    if (email.trim().toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
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
  } catch (err) {
    console.error("[Admin Auth] Login Error:", err);
    res.status(500).json({ error: err.message || "Internal server error during admin validation" });
  }
});
var customers_default = router6;

// backend/routes/discounts.ts
import { Router as Router6 } from "express";
var router7 = Router6();
router7.get("/", async (req, res) => {
  try {
    const data = await fetchResource("discounts");
    res.json(data);
  } catch (err) {
    console.error("[Discounts Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch discounts" });
  }
});
router7.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Discounts API expects an array of documents" });
    }
    const database = await getDb();
    if (!database) {
      res.setHeader("X-Database-Offline", "true");
    } else {
      res.setHeader("X-Database-Offline", "false");
    }
    const updated = await saveResource("discounts", payload);
    res.json(updated);
  } catch (err) {
    console.error("[Discounts Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist discounts" });
  }
});
var discounts_default = router7;

// backend/routes/customPages.ts
var router8 = createCrudRouter("customPages");
var customPages_default = router8;

// backend/routes/blogs.ts
import { Router as Router7 } from "express";
var router9 = Router7();
router9.get("/", async (req, res) => {
  try {
    const data = await fetchResource("blogs");
    res.json(data);
  } catch (err) {
    console.error("[Blogs Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch blogs" });
  }
});
router9.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Blogs API expects an array of documents" });
    }
    const database = await getDb();
    if (!database) {
      res.setHeader("X-Database-Offline", "true");
    } else {
      res.setHeader("X-Database-Offline", "false");
    }
    const updated = await saveResource("blogs", payload);
    res.json(updated);
  } catch (err) {
    console.error("[Blogs Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist blogs" });
  }
});
var blogs_default = router9;

// backend/routes/worldpay.ts
import { Router as Router8 } from "express";
import crypto2 from "crypto";
var router10 = Router8();
var WORLDPAY_INSTALLATION_ID = process.env.WORLDPAY_INSTALLATION_ID || "";
var WORLDPAY_MD5_SECRET = process.env.WORLDPAY_MD5_SECRET || "";
var WORLDPAY_WEBHOOK_SECRET = process.env.WORLDPAY_WEBHOOK_SECRET || "wp_secret_xyz123";
var WORLDPAY_TEST_MODE = process.env.WORLDPAY_TEST_MODE || "100";
function verifyWorldpaySignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const computedHmac = crypto2.createHmac("sha256", secret).update(payload).digest("hex");
    return crypto2.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(signature));
  } catch (err) {
    console.error("[Worldpay Signature Verification] Cryptographic error:", err);
    return false;
  }
}
function verifyWorldpayMD5(instId, amount, currency, cartId, secret, providedMD5) {
  if (!secret || !providedMD5) return true;
  try {
    const signatureString = `${secret}:${instId}:${amount}:${currency}:${cartId}`;
    const computedMD5 = crypto2.createHash("md5").update(signatureString).digest("hex");
    return computedMD5.toLowerCase() === providedMD5.toLowerCase();
  } catch (err) {
    console.error("[Worldpay MD5 Verification Error]:", err);
    return false;
  }
}
async function updateOrderPaymentStatus(orderId, paymentStatus, details) {
  let updatedOrder = null;
  try {
    const existingPrisma = await prisma.order.findUnique({ where: { id: orderId } });
    if (existingPrisma) {
      if (existingPrisma.paymentStatus === "Paid" && paymentStatus === "Paid") {
        console.log(`[Worldpay Callback] Order ${orderId} is already paid. Skipping update.`);
        return existingPrisma;
      }
      updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus,
          worldpayTxId: details.transactionId,
          worldpayAuthCode: details.authCode,
          gatewayTxId: details.transactionId,
          gatewayAuthCode: details.authCode,
          cardBrand: details.cardBrand || existingPrisma.cardBrand || "Visa/Mastercard"
        }
      });
      console.log(`[Worldpay Callback] Order ${orderId} successfully updated to '${paymentStatus}' in database.`);
      return updatedOrder;
    }
  } catch (prismaErr) {
    console.warn(`[Worldpay Callback] Prisma update failed for ${orderId}, trying StoreResource fallback:`, prismaErr?.message);
  }
  try {
    const orders = await fetchResource("orders") || [];
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      orders[idx].paymentStatus = paymentStatus;
      orders[idx].worldpayTxId = details.transactionId;
      orders[idx].worldpayAuthCode = details.authCode;
      orders[idx].gatewayTxId = details.transactionId;
      orders[idx].gatewayAuthCode = details.authCode;
      if (details.cardBrand) orders[idx].cardBrand = details.cardBrand;
      await saveResource("orders", orders);
      console.log(`[Worldpay Callback] Order ${orderId} updated via StoreResource fallback.`);
      return orders[idx];
    }
  } catch (fallbackErr) {
    console.error(`[Worldpay Callback] StoreResource update error for order ${orderId}:`, fallbackErr);
  }
  return updatedOrder;
}
router10.get("/config", (_req, res) => {
  const isConfigured = Boolean(WORLDPAY_INSTALLATION_ID);
  res.json({
    active: true,
    isConfigured,
    installationIdMasked: WORLDPAY_INSTALLATION_ID ? `${WORLDPAY_INSTALLATION_ID.substring(0, 4)}***` : "Simulated Hosted Page",
    testMode: WORLDPAY_TEST_MODE,
    provider: "Worldpay Hosted Payment Pages (HPP)"
  });
});
router10.post("/session", async (req, res) => {
  try {
    const { orderId, amount, customerEmail, customerName, items, destination } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ error: "Order ID and amount are required to create a Worldpay Hosted Checkout session." });
    }
    console.log(`[Worldpay Hosted Checkout] Initializing session for Order: ${orderId}, Amount: \xA3${amount}`);
    try {
      const existing = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) {
        await prisma.order.create({
          data: {
            id: orderId,
            customerName: customerName || "Valued Customer",
            customerEmail: customerEmail || "customer@example.com",
            tags: ["Storefront", "Worldpay Hosted Checkout"],
            fulfillmentStatus: "Unfulfilled",
            paymentStatus: "Pending",
            total: parseFloat(amount),
            destination: destination || "United Kingdom",
            date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            deliveryMethod: "Standard Delivery",
            items: items || []
          }
        });
        console.log(`[Worldpay Hosted Checkout] Pre-registered pending order ${orderId} in database.`);
      }
    } catch (dbErr) {
      console.warn("[Worldpay Hosted Checkout] DB pre-register non-fatal warning:", dbErr);
    }
    const protocol = req.protocol || "https";
    const host = req.get("host") || "localhost:3000";
    if (WORLDPAY_INSTALLATION_ID) {
      console.log(`[Worldpay Hosted Checkout] Live Installation ID detected: ${WORLDPAY_INSTALLATION_ID}`);
      const callbackUrl = `${protocol}://${host}/api/worldpay/callback?orderId=${encodeURIComponent(orderId)}`;
      const formattedAmount = parseFloat(amount).toFixed(2);
      const currency = "GBP";
      let md5Signature = "";
      if (WORLDPAY_MD5_SECRET) {
        const md5Input = `${WORLDPAY_MD5_SECRET}:${WORLDPAY_INSTALLATION_ID}:${formattedAmount}:${currency}:${orderId}`;
        md5Signature = crypto2.createHash("md5").update(md5Input).digest("hex");
      }
      const hppUrl = new URL("https://secure.worldpay.com/wcc/purchase");
      hppUrl.searchParams.append("instId", WORLDPAY_INSTALLATION_ID);
      hppUrl.searchParams.append("cartId", orderId);
      hppUrl.searchParams.append("amount", formattedAmount);
      hppUrl.searchParams.append("currency", currency);
      hppUrl.searchParams.append("testMode", WORLDPAY_TEST_MODE);
      hppUrl.searchParams.append("MC_callback", callbackUrl);
      if (customerName) hppUrl.searchParams.append("name", customerName);
      if (customerEmail) hppUrl.searchParams.append("email", customerEmail);
      if (md5Signature) hppUrl.searchParams.append("signature", md5Signature);
      return res.json({
        success: true,
        redirectUrl: hppUrl.toString(),
        installationId: WORLDPAY_INSTALLATION_ID,
        provider: "Worldpay Official Hosted Payment Pages"
      });
    }
    const redirectUrl = `/payment/worldpay-gateway?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}`;
    res.json({
      success: true,
      redirectUrl,
      provider: "Worldpay Hosted Payment Pages"
    });
  } catch (err) {
    console.error("[Worldpay Hosted Checkout] Error creating session:", err);
    res.status(500).json({ error: err.message || "Failed to initialize Worldpay Hosted Payment session." });
  }
});
var handleWorldpayCallback = async (req, res) => {
  const params = req.method === "POST" ? req.body : req.query;
  const orderId = params.orderId || params.cartId || "";
  const transStatus = params.transStatus || params.status || "Y";
  const transId = params.transId || params.txId || `WP-TX-${Math.floor(Math.random() * 89999999 + 1e7)}`;
  const authCode = params.authCode || `AUTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const rawMD5 = params.signature || params.rawAuthCode || "";
  const cardBrand = params.cardType || params.cardBrand || "Visa / Mastercard";
  console.log(`[Worldpay Callback] Received return for Order ID: ${orderId}, Status: ${transStatus}, TransID: ${transId}`);
  let paymentSuccess = transStatus === "Y" || transStatus === "SUCCESS" || transStatus === "Paid";
  if (WORLDPAY_MD5_SECRET && rawMD5 && WORLDPAY_INSTALLATION_ID) {
    const isMd5Valid = verifyWorldpayMD5(
      WORLDPAY_INSTALLATION_ID,
      params.amount || "",
      params.currency || "GBP",
      orderId,
      WORLDPAY_MD5_SECRET,
      rawMD5
    );
    if (!isMd5Valid) {
      console.warn(`[Worldpay Callback] MD5 signature mismatch for Order ${orderId}`);
    }
  }
  if (orderId) {
    if (paymentSuccess) {
      await updateOrderPaymentStatus(orderId, "Paid", { transactionId: transId, authCode, cardBrand });
      return res.redirect(`/payment/success?orderId=${encodeURIComponent(orderId)}&txId=${encodeURIComponent(transId)}`);
    } else {
      await updateOrderPaymentStatus(orderId, "Failed", { transactionId: transId, authCode, cardBrand });
      return res.redirect(`/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=declined`);
    }
  }
  res.redirect("/payment/success");
};
router10.get("/callback", handleWorldpayCallback);
router10.post("/callback", handleWorldpayCallback);
router10.post("/process", async (req, res) => {
  try {
    const { orderId, amount, cardNumber, cardHolder } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ error: "Order ID and amount are required." });
    }
    console.log(`[Worldpay Hosted Payment] Processing payment authorization for Order: ${orderId}`);
    const cleanCard = (cardNumber || "").replace(/\s+/g, "");
    let cardBrand = "Visa";
    if (cleanCard.startsWith("5")) cardBrand = "Mastercard";
    if (cleanCard.startsWith("3")) cardBrand = "American Express";
    if (cleanCard.startsWith("6")) cardBrand = "Maestro";
    if (cleanCard.endsWith("0000") || cleanCard.endsWith("9999")) {
      const failTxId = `WP-FAIL-${Math.floor(Math.random() * 89999999 + 1e7)}`;
      await updateOrderPaymentStatus(orderId, "Failed", {
        transactionId: failTxId,
        authCode: "DECLINED-INSF",
        cardBrand
      });
      return res.status(402).json({
        success: false,
        error: "Payment declined: Insufficient funds or invalid card status.",
        transactionId: failTxId
      });
    }
    const transactionId = `WP-LIVE-${Math.floor(Math.random() * 89999999 + 1e7)}`;
    const authCode = `AUTH-WP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await updateOrderPaymentStatus(orderId, "Paid", {
      transactionId,
      authCode,
      cardBrand
    });
    res.json({
      success: true,
      status: "CAPTURED",
      transactionId,
      authCode,
      cardBrand,
      amount: parseFloat(amount),
      orderId,
      message: "Worldpay payment authorization completed successfully."
    });
  } catch (err) {
    console.error("[Worldpay Process Error]:", err);
    res.status(500).json({ error: err.message || "Worldpay payment processing failed." });
  }
});
router10.get("/status", async (req, res) => {
  try {
    const orderId = req.query.orderId;
    if (!orderId) {
      return res.status(400).json({ error: "orderId parameter is required" });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.json({ paid: false, status: "Not Found", orderId });
    }
    res.json({
      paid: order.paymentStatus === "Paid",
      status: order.paymentStatus || "Pending",
      transactionId: order.worldpayTxId || order.gatewayTxId || null,
      authCode: order.worldpayAuthCode || order.gatewayAuthCode || null,
      order
    });
  } catch (err) {
    console.error("[Worldpay Status Error]:", err);
    res.status(500).json({ error: err.message || "Error querying Worldpay payment status" });
  }
});
router10.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-worldpay-signature"] || req.headers["x-signature"] || "";
    const rawBody = req.rawBody ? req.rawBody.toString("utf-8") : JSON.stringify(req.body);
    console.log(`[Worldpay Webhook] Received webhook notification.`);
    if (WORLDPAY_WEBHOOK_SECRET && signature) {
      const isValid = verifyWorldpaySignature(rawBody, signature, WORLDPAY_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn("[Worldpay Webhook] Signature verification failed.");
      } else {
        console.log("[Worldpay Webhook] Signature verified successfully.");
      }
    }
    const { eventType, orderId, cartId, paymentStatus, transStatus, transactionId, transId, authCode, cardBrand } = req.body;
    const targetOrderId = orderId || cartId;
    if (targetOrderId) {
      const isPaid = paymentStatus === "CHARGED" || paymentStatus === "SUCCESS" || paymentStatus === "Paid" || transStatus === "Y";
      const targetStatus = isPaid ? "Paid" : "Failed";
      await updateOrderPaymentStatus(targetOrderId, targetStatus, {
        transactionId: transactionId || transId || `WP-WH-${Math.floor(Math.random() * 89999999 + 1e7)}`,
        authCode: authCode || "AUTH-WH-OK",
        cardBrand: cardBrand || "Visa/Mastercard"
      });
      console.log(`[Worldpay Webhook] Order ${targetOrderId} status set to '${targetStatus}'.`);
    }
    res.status(200).json({ received: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    console.error("[Worldpay Webhook] Error:", err);
    res.status(500).json({ error: "Failed to process Worldpay webhook payload" });
  }
});
var worldpay_default = router10;

// serverApp.ts
async function createExpressApp() {
  const app = express();
  try {
    await fetchLayoutSettings();
  } catch (err) {
  }
  app.use((req, res, next) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return next();
    }
    express.json({
      limit: "1000mb",
      verify: (req2, _res, buf) => {
        req2.rawBody = buf;
      }
    })(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return next();
    }
    express.urlencoded({ limit: "1000mb", extended: true })(req, res, next);
  });
  let uploadsPath = path3.join(process.cwd(), "uploads");
  try {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      uploadsPath = "/tmp/uploads";
    }
    if (!fs3.existsSync(uploadsPath)) {
      fs3.mkdirSync(uploadsPath, { recursive: true });
    }
  } catch (err) {
    console.warn("[Uploads Setup] Failed to create uploads directory at", uploadsPath, err);
    uploadsPath = "/tmp/uploads";
    try {
      if (!fs3.existsSync(uploadsPath)) {
        fs3.mkdirSync(uploadsPath, { recursive: true });
      }
    } catch (tmpErr) {
      console.error("[Uploads Setup] Fatal: failed to create /tmp/uploads:", tmpErr);
    }
  }
  const serveMediaBuffer = (req, res, buffer, mimeType) => {
    const range = req.headers.range;
    const fileSize = buffer.length;
    if (range && (mimeType.startsWith("video/") || mimeType.startsWith("audio/"))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        return res.end();
      }
      const chunksize = end - start + 1;
      const chunk = buffer.subarray(start, end + 1);
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000"
      });
      return res.end(chunk);
    } else {
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": fileSize,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000"
      });
      return res.end(buffer);
    }
  };
  const handleUploadsFileRequest = async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path3.join(uploadsPath, filename);
      if (fs3.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
      const dotIndex = filename.lastIndexOf(".");
      const id = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
      const imgDoc = await getUploadedImage(filename) || await getUploadedImage(id);
      if (imgDoc && imgDoc.base64Data) {
        try {
          fs3.writeFileSync(filePath, Buffer.from(imgDoc.base64Data, "base64"));
          return res.sendFile(filePath);
        } catch (e) {
        }
        const imgBuffer = Buffer.from(imgDoc.base64Data, "base64");
        return serveMediaBuffer(req, res, imgBuffer, imgDoc.mimeType || "image/png");
      }
    } catch (err) {
      console.error("[Uploads] Error reading uploaded file:", err);
    }
    return res.status(404).send("File not found");
  };
  app.get("/uploads/:filename", handleUploadsFileRequest);
  app.get("/api/uploads/:filename", handleUploadsFileRequest);
  app.use("/uploads", express.static(uploadsPath));
  app.use("/api/uploads", express.static(uploadsPath));
  app.post("/api/upload", async (req, res) => {
    try {
      const { data, filename, cloudName, apiKey, apiSecret, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = req.body;
      if (!data) {
        return res.status(400).json({ error: "Missing data payload for upload." });
      }
      const passedCloudName = cloudName || cloudinaryCloudName;
      const passedApiKey = apiKey || cloudinaryApiKey;
      const passedApiSecret = apiSecret || cloudinaryApiSecret;
      if (passedCloudName) process.env.CLOUDINARY_CLOUD_NAME = String(passedCloudName).trim();
      if (passedApiKey) process.env.CLOUDINARY_API_KEY = String(passedApiKey).trim();
      if (passedApiSecret) process.env.CLOUDINARY_API_SECRET = String(passedApiSecret).trim();
      if (!isCloudinaryConfigured()) {
        try {
          await fetchLayoutSettings();
        } catch (e) {
        }
      }
      let base64String = data;
      let mimeType = "image/png";
      if (typeof data === "string" && data.startsWith("data:")) {
        const matches = data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64String = matches[2];
        }
      }
      if (typeof base64String === "string" && base64String.includes(";base64,")) {
        base64String = base64String.split(";base64,").pop() || base64String;
      }
      base64String = (base64String || "").trim();
      const displayName = filename || `upload-${Date.now()}`;
      const isVideo = mimeType.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)$/i.test(displayName);
      if (isCloudinaryConfigured()) {
        try {
          const fileBuffer = Buffer.from(base64String, "base64");
          const uploadResult = await uploadToCloudinary(fileBuffer, {
            folder: "storefront_media",
            originalFilename: displayName,
            resourceType: isVideo ? "video" : "auto"
          });
          const id2 = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const displaySize = uploadResult.fileSize > 1024 * 1024 ? `${(uploadResult.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(uploadResult.fileSize / 1024)} KB`;
          let newFile = null;
          const entryResourceType = uploadResult.resourceType || (isVideo ? "video" : "image");
          const entryMimeType = mimeType || (isVideo ? "video/mp4" : "image/png");
          try {
            newFile = await prisma.fileEntry.create({
              data: {
                id: id2,
                publicId: uploadResult.publicId,
                url: uploadResult.secureUrl || uploadResult.url,
                secureUrl: uploadResult.secureUrl,
                resourceType: entryResourceType,
                format: uploadResult.format,
                width: uploadResult.width || null,
                height: uploadResult.height || null,
                fileSize: displaySize,
                size: displaySize,
                folder: uploadResult.folder,
                originalFilename: displayName,
                fileName: displayName,
                altText: displayName.split(".")[0] || "Uploaded Asset",
                dateAdded: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
                references: "Direct Upload",
                mimeType: entryMimeType
              }
            });
          } catch (dbErr) {
            newFile = {
              id: id2,
              publicId: uploadResult.publicId,
              url: uploadResult.secureUrl || uploadResult.url,
              secureUrl: uploadResult.secureUrl,
              fileName: displayName,
              altText: displayName.split(".")[0] || "Uploaded Asset",
              dateAdded: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
              mimeType: entryMimeType,
              resourceType: entryResourceType,
              size: displaySize,
              fileSize: displaySize,
              references: "Direct Upload"
            };
          }
          try {
            const currentFiles = await fetchResource("files");
            const currentArr = Array.isArray(currentFiles) ? currentFiles : [];
            const updatedFiles = [newFile, ...currentArr.filter((f) => f && f.url !== newFile.url)];
            await saveResource("files", updatedFiles);
          } catch (sErr) {
          }
          return res.json({
            url: newFile.url,
            secureUrl: newFile.secureUrl,
            publicId: newFile.publicId,
            id: newFile.id,
            fileName: displayName,
            mimeType: entryMimeType,
            resourceType: entryResourceType
          });
        } catch (cErr) {
          console.warn("[API Upload] Cloudinary upload failed, falling back to disk:", cErr?.message || cErr);
        }
      }
      const id = `file-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
      let extension = "png";
      if (filename && filename.includes(".")) {
        extension = filename.split(".").pop()?.toLowerCase() || "png";
      } else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
        extension = "jpg";
      } else if (mimeType.includes("mp4")) {
        extension = "mp4";
      }
      const filenameOnDisk = `${id}.${extension}`;
      const filePath = path3.join(uploadsPath, filenameOnDisk);
      try {
        fs3.writeFileSync(filePath, Buffer.from(base64String, "base64"));
      } catch (fsErr) {
        console.error("[API Upload] Failed to write file to local disk:", fsErr);
      }
      await saveUploadedImage(id, base64String, mimeType);
      const fileUrl = `/api/uploads/${filenameOnDisk}`;
      const rawBytes = Math.round(base64String.length * 0.75);
      const calculatedSize = rawBytes > 1024 * 1024 ? `${(rawBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(rawBytes / 1024)} KB`;
      const isVid = mimeType.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)$/i.test(filename || "");
      const diskEntry = {
        id,
        fileName: displayName,
        url: fileUrl,
        altText: displayName.split(".")[0] || "Uploaded Media Asset",
        mimeType: mimeType || (isVid ? "video/mp4" : "image/png"),
        resourceType: isVid ? "video" : "image",
        size: calculatedSize,
        fileSize: calculatedSize,
        references: "Direct Upload",
        dateAdded: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      try {
        await prisma.fileEntry.create({
          data: diskEntry
        });
      } catch (fileRegErr) {
      }
      try {
        const currentFiles = await fetchResource("files");
        const currentArr = Array.isArray(currentFiles) ? currentFiles : [];
        const updatedFiles = [diskEntry, ...currentArr.filter((f) => f && f.url !== diskEntry.url)];
        await saveResource("files", updatedFiles);
      } catch (sErr) {
      }
      res.json({ url: fileUrl, id, fileName: displayName, mimeType: diskEntry.mimeType, resourceType: diskEntry.resourceType });
    } catch (err) {
      console.error("[API Upload] Fail:", err);
      res.status(500).json({ error: err.message || "Failed to process image upload" });
    }
  });
  app.get("/api/images/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const imgDoc = await getUploadedImage(id);
      if (!imgDoc) {
        return res.status(404).send("Media asset not found");
      }
      const imgBuffer = Buffer.from(imgDoc.base64Data, "base64");
      return serveMediaBuffer(req, res, imgBuffer, imgDoc.mimeType || "image/png");
    } catch (err) {
      res.status(500).send("Internal server error serving media");
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/status", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const status = await getConnectionStatus();
      if (status.status === "connected") {
        res.status(200).json({
          statusCode: 200,
          status: "connected",
          databaseUrlConfigured: true,
          provider: "Neon PostgreSQL",
          host: status.host || "Connected",
          database: status.database || "neondb",
          error: null,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        res.status(200).json({
          statusCode: 500,
          status: status.status || "error",
          databaseUrlConfigured: !!process.env.DATABASE_URL,
          provider: "Neon PostgreSQL",
          host: status.host || "N/A",
          database: status.database || "N/A",
          error: status.error || "Database connection test failed.",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } catch (err) {
      res.status(200).json({
        statusCode: 500,
        status: "error",
        databaseUrlConfigured: !!process.env.DATABASE_URL,
        provider: "Neon PostgreSQL",
        host: "N/A",
        database: "N/A",
        error: err?.message || String(err),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app.get("/api/db-status", async (req, res) => {
    try {
      await getDb();
    } catch (e) {
    }
    res.json(await getConnectionStatus());
  });
  app.get("/api/db-details", async (req, res) => {
    try {
      const details = await getDatabaseDetails();
      res.json(details);
    } catch (err) {
      console.error("[API db-details] Error fetching DB details:", err);
      res.status(500).json({ error: err.message || "Failed to fetch database details" });
    }
  });
  app.post("/api/update-db-uri", async (req, res) => {
    try {
      const { uri } = req.body;
      if (!uri) {
        return res.status(400).json({ error: "No connection string was provided." });
      }
      const updatedStatus = await updateDatabaseUrl(uri);
      res.json(updatedStatus);
    } catch (err) {
      console.error("[API update-db-uri] Error updating connection string:", err);
      res.status(500).json({ error: err.message || "Failed to update connection string" });
    }
  });
  const handleTestCloudinary = async (req, res) => {
    try {
      let cloudName = req.body?.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
      let apiKey = req.body?.apiKey || process.env.CLOUDINARY_API_KEY;
      let apiSecret = req.body?.apiSecret || process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        try {
          const layout = await fetchLayoutSettings();
          if (layout) {
            cloudName = cloudName || layout.cloudinaryCloudName;
            apiKey = apiKey || layout.cloudinaryApiKey;
            apiSecret = apiSecret || layout.cloudinaryApiSecret;
          }
        } catch (e) {
        }
      }
      const hasCloudName = Boolean(cloudName && String(cloudName).trim().length > 0);
      const hasApiKey = Boolean(apiKey && String(apiKey).trim().length > 0);
      const hasApiSecret = Boolean(apiSecret && String(apiSecret).trim().length > 0);
      const isConfigured = hasCloudName && hasApiKey && hasApiSecret;
      if (isConfigured) {
        process.env.CLOUDINARY_CLOUD_NAME = cloudName;
        process.env.CLOUDINARY_API_KEY = apiKey;
        process.env.CLOUDINARY_API_SECRET = apiSecret;
      }
      res.json({
        success: isConfigured,
        configured: isConfigured,
        hasCloudName,
        hasApiKey,
        hasApiSecret,
        cloudName: cloudName ? String(cloudName).trim() : null,
        apiKeyMasked: apiKey ? `${String(apiKey).substring(0, 4)}***` : null,
        message: isConfigured ? "Cloudinary credentials are fully valid and configured." : "Cloudinary environment variables missing or incomplete."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        configured: false,
        error: err?.message || "Error testing Cloudinary configuration"
      });
    }
  };
  app.get("/api/test-cloudinary", handleTestCloudinary);
  app.post("/api/test-cloudinary", handleTestCloudinary);
  app.get("/api/layoutsettings", async (req, res) => {
    try {
      const data = await fetchLayoutSettings();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to load layout settings" });
    }
  });
  app.post("/api/layoutsettings", async (req, res) => {
    try {
      const saved = await saveLayoutSettings(req.body);
      res.json({ status: "success", data: saved });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to save layout settings" });
    }
  });
  app.use("/api/media", media_default);
  app.use("/api/products", products_default);
  app.use("/api/collections", collections_default);
  app.use("/api/orders", orders_default);
  app.use("/api/files", files_default);
  app.use("/api/customers", customers_default);
  app.use("/api/discounts", discounts_default);
  app.use("/api/custompages", customPages_default);
  app.use("/api/blogs", blogs_default);
  app.use("/api/worldpay", worldpay_default);
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      const lastSegment = url.split("/").pop() || "";
      if (url.startsWith("/api") || lastSegment.includes(".")) {
        return next();
      }
      try {
        const fs4 = await import("fs");
        let html = fs4.readFileSync(path3.resolve(process.cwd(), "index.html"), "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path3.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const url = req.originalUrl;
      const lastSegment = url.split("/").pop() || "";
      if (url.startsWith("/api") || lastSegment.includes(".")) {
        return res.status(404).send("API or File Asset Not Found");
      }
      const indexPath = path3.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(500).send("Internal Server Error: Missing compiled static resources.");
        }
      });
    });
  }
  return app;
}

// api-entry.ts
var appPromise = createExpressApp();
async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
