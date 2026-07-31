import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { prisma } from './src/lib/prisma';

dotenv.config();

import { 
  INITIAL_PRODUCTS, INITIAL_COLLECTIONS, INITIAL_ORDERS, INITIAL_FILES, 
  INITIAL_CUSTOMERS, INITIAL_DISCOUNTS, DEFAULT_PAGES, INITIAL_BLOGS 
} from './src/initialData';
import { DEFAULT_DEV_SETTINGS } from './src/data/initialDevSettings';

export interface DbStatus {
  status: 'connected' | 'error' | 'not-configured' | 'pending';
  provider: 'Neon PostgreSQL';
  error?: string;
  host?: string;
  database?: string;
}

// In-Memory state fallback cache
const memoryCache: Record<string, any[]> = {
  products: [...INITIAL_PRODUCTS],
  collections: [...INITIAL_COLLECTIONS],
  orders: [...INITIAL_ORDERS],
  files: [...INITIAL_FILES],
  customers: [...INITIAL_CUSTOMERS],
  discounts: [...INITIAL_DISCOUNTS],
  customPages: [...DEFAULT_PAGES],
  blogs: [...INITIAL_BLOGS],
};

const BACKUP_FILE_PATH = path.join(process.cwd(), 'local_store_data.json');

function loadMemoryCacheFromBackup() {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const raw = fs.readFileSync(BACKUP_FILE_PATH, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            memoryCache[key] = data[key];
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Local Backup] Could not load local_store_data.json backup:', err);
  }
}

function persistMemoryCacheToBackup() {
  try {
    fs.writeFileSync(BACKUP_FILE_PATH, JSON.stringify(memoryCache, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Local Backup] Could not write to local_store_data.json backup:', err);
  }
}

loadMemoryCacheFromBackup();

let isTablesInitialized = false;

async function ensureNeonTablesExist(): Promise<void> {
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
    console.warn('[Neon Table Setup] Warning: Table initialization check encountered error:', err);
  }
}

function getHostFromDatabaseUrl(urlStr?: string): { host: string; database: string } {
  if (!urlStr) return { host: 'N/A', database: 'N/A' };
  try {
    const cleaned = urlStr.trim().replace(/^["']|["']$/g, '');
    const parsed = new URL(cleaned);
    return {
      host: parsed.hostname || 'N/A',
      database: parsed.pathname.replace(/^\//, '') || 'N/A'
    };
  } catch (e) {
    return { host: 'N/A', database: 'N/A' };
  }
}

export async function testNeonConnection(): Promise<DbStatus> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return {
      status: 'not-configured',
      provider: 'Neon PostgreSQL',
      error: 'DATABASE_URL environment variable is not configured.'
    };
  }

  const { host, database } = getHostFromDatabaseUrl(dbUrl);

  try {
    await prisma.$queryRaw`SELECT 1`;
    await ensureNeonTablesExist();
    return {
      status: 'connected',
      provider: 'Neon PostgreSQL',
      host,
      database
    };
  } catch (err: any) {
    return {
      status: 'error',
      provider: 'Neon PostgreSQL',
      host,
      database,
      error: err?.message || String(err)
    };
  }
}

export async function getConnectionStatus(): Promise<DbStatus> {
  return await testNeonConnection();
}

export async function getDatabaseDetails(): Promise<any> {
  const dbUrl = process.env.DATABASE_URL;
  const { host, database } = getHostFromDatabaseUrl(dbUrl);

  try {
    if (!dbUrl) {
      return {
        provider: 'Neon PostgreSQL',
        status: 'not-configured',
        host: 'N/A',
        database: 'N/A',
        uriHost: 'N/A',
        dbName: 'N/A',
        collections: [],
        models: [],
        error: 'DATABASE_URL is missing'
      };
    }

    const versionResult: any[] = await prisma.$queryRaw`SELECT version()`;
    const version = versionResult[0]?.version || 'PostgreSQL (Neon)';

    let collectionsList: { name: string; count: number }[] = [];
    try {
      await ensureNeonTablesExist();
      const grouped = await prisma.storeResource.groupBy({
        by: ['resource'],
        _count: { _all: true }
      });
      collectionsList = grouped.map(g => ({
        name: g.resource,
        count: g._count._all
      }));
    } catch (gErr) {
      console.warn('[getDatabaseDetails] Failed grouping resources:', gErr);
    }

    const modelsList = [
      'SystemStatus', 'StoreResource', 'StoreSetting', 'Product', 
      'Collection', 'FileEntry', 'Order', 'CustomPage', 'Customer', 
      'BlogPost', 'Discount', 'LayoutSetting'
    ];

    return {
      provider: 'Neon PostgreSQL',
      status: 'connected',
      host,
      database,
      uriHost: host,
      dbName: database,
      version,
      orm: 'Prisma',
      collections: collectionsList,
      models: modelsList
    };
  } catch (err: any) {
    return {
      provider: 'Neon PostgreSQL',
      status: 'error',
      host,
      database,
      uriHost: host,
      dbName: database,
      collections: [],
      models: [],
      error: err?.message || String(err),
      orm: 'Prisma'
    };
  }
}

export async function updateDatabaseUrl(newUrl: string): Promise<DbStatus> {
  const trimmed = newUrl.trim();
  process.env.DATABASE_URL = trimmed;
  isTablesInitialized = false;

  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const regex = /^DATABASE_URL\s*=\s*.*$/m;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `DATABASE_URL="${trimmed}"`);
    } else {
      envContent = `${envContent.trim()}\nDATABASE_URL="${trimmed}"\n`;
    }
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  } catch (err) {
    console.warn('[Database Config] Failed to persist DATABASE_URL to .env:', err);
  }

  return await testNeonConnection();
}

export async function getDb(): Promise<boolean> {
  const status = await testNeonConnection();
  return status.status === 'connected';
}

function normalizeResourceName(resource: string): string {
  if (!resource) return resource;
  const lower = resource.toLowerCase();
  if (lower === 'custompages') return 'customPages';
  return resource;
}

export async function fetchResource(resource: string): Promise<any[]> {
  const normResource = normalizeResourceName(resource);
  const isConnected = await getDb();

  if (isConnected) {
    try {
      const records = await prisma.storeResource.findMany({
        where: { resource: normResource },
        orderBy: { createdAt: 'asc' }
      });

      if (records && records.length > 0) {
        const list = records.map(r => r.data as any);
        memoryCache[normResource] = list;
        persistMemoryCacheToBackup();
        return list;
      }

      // Pre-seed Neon PostgreSQL if table for resource is empty
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

export async function saveResource(resource: string, list: any[]): Promise<any[]> {
  const normResource = normalizeResourceName(resource);
  if (!Array.isArray(list)) return memoryCache[normResource] || [];

  memoryCache[normResource] = [...list];
  if (normResource !== resource) memoryCache[resource] = memoryCache[normResource];
  persistMemoryCacheToBackup();

  const isConnected = await getDb();
  if (isConnected) {
    try {
      const validItemIds: string[] = [];

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

      // Delete items removed from list
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

export async function fetchSingleItem(resource: string, id: string): Promise<any | null> {
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
  return items.find((i: any) => i.id === id || i.slug === id) || null;
}

export async function saveSingleItem(resource: string, item: any): Promise<any> {
  if (!item) return item;
  const normResource = normalizeResourceName(resource);
  const itemId = String(item.id || item.slug || `item-${Date.now()}-${Math.random()}`);

  const items = memoryCache[normResource] || memoryCache[resource] || [];
  const idx = items.findIndex((i: any) => i.id === itemId || i.slug === itemId);
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

export async function deleteSingleItem(resource: string, id: string): Promise<boolean> {
  if (!id) return false;
  const normResource = normalizeResourceName(resource);

  if (memoryCache[normResource]) {
    memoryCache[normResource] = memoryCache[normResource].filter((i: any) => i.id !== id && i.slug !== id);
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

const memoryImages: Record<string, { base64Data: string; mimeType: string }> = {};

export async function saveUploadedImage(id: string, base64Data: string, mimeType: string): Promise<string> {
  memoryImages[id] = { base64Data, mimeType };
  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeResource.upsert({
        where: {
          resource_itemId: {
            resource: 'uploaded_images',
            itemId: id
          }
        },
        update: { data: { id, base64Data, mimeType } },
        create: {
          resource: 'uploaded_images',
          itemId: id,
          data: { id, base64Data, mimeType }
        }
      });
    } catch (e) {
      console.warn('[Neon DB] Failed to persist uploaded image:', e);
    }
  }
  return `/uploads/${id}`;
}

export async function getUploadedImage(id: string): Promise<{ base64Data: string; mimeType: string } | null> {
  if (memoryImages[id]) return memoryImages[id];
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const record = await prisma.storeResource.findFirst({
        where: {
          resource: 'uploaded_images',
          itemId: id
        }
      });
      if (record && record.data) {
        const data = record.data as any;
        memoryImages[id] = { base64Data: data.base64Data, mimeType: data.mimeType };
        return memoryImages[id];
      }
    } catch (e) {}
  }
  return null;
}

export async function fetchLayoutSettings(): Promise<any> {
  let settingsData: any = null;
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
      } catch (e) {}
    }
  }

  if (!settingsData) {
    settingsData = {
      id: "layout_settings",
      headerLogoText: 'POUCH SUPPLY',
      headerLogoSubtext: 'Premium Nicotine',
      headerLogoImage: '',
      footerLogoText: 'POUCH SUPPLY',
      footerLogoDescription: 'Leading premium directory for tobacco-free nicotine slim white canisters.',
      footerLogoImage: '',
      menuItems: [
        { id: '1', label: 'Home', tab: 'frontend-home', type: 'tab' },
        { id: '2', label: 'Subscribe', tab: 'frontend-subscribe', type: 'tab' },
        { id: '3', label: 'Shop Now', tab: 'frontend-shop', type: 'tab' },
        { id: '4', label: 'All Brands', tab: 'frontend-brands', type: 'tab' },
        { id: '5', label: 'About', tab: 'about', type: 'tab' }
      ]
    };
  }

  // Hydrate Cloudinary environment variables if stored in layout settings
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

export async function saveLayoutSettings(settings: any): Promise<any> {
  // Sync Cloudinary process.env if provided in settings payload
  if (settings.cloudinaryCloudName !== undefined) {
    process.env.CLOUDINARY_CLOUD_NAME = settings.cloudinaryCloudName || '';
  }
  if (settings.cloudinaryApiKey !== undefined) {
    process.env.CLOUDINARY_API_KEY = settings.cloudinaryApiKey || '';
  }
  if (settings.cloudinaryApiSecret !== undefined) {
    process.env.CLOUDINARY_API_SECRET = settings.cloudinaryApiSecret || '';
  }

  const filePath = path.join(process.cwd(), "layout_settings.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {}

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

export async function fetchDevSettings(): Promise<any> {
  let settingsData: any = null;
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const setting = await prisma.storeSetting.findUnique({
        where: { id: "dev_settings" }
      });
      if (setting && setting.data) {
        settingsData = setting.data;
      }
    } catch (err) {
      console.error("[Neon DB] Error fetching dev settings:", err);
    }
  }

  if (!settingsData) {
    const filePath = path.join(process.cwd(), "dev_settings.json");
    if (fs.existsSync(filePath)) {
      try {
        settingsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {}
    }
  }

  if (!settingsData) {
    settingsData = DEFAULT_DEV_SETTINGS;
  }

  return settingsData;
}

export async function saveDevSettings(settings: any): Promise<any> {
  const filePath = path.join(process.cwd(), "dev_settings.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {}

  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeSetting.upsert({
        where: { id: "dev_settings" },
        update: { data: settings },
        create: { id: "dev_settings", data: settings }
      });
    } catch (err) {
      console.error("[Neon DB] Error saving dev settings:", err);
    }
  }

  return settings;
}
