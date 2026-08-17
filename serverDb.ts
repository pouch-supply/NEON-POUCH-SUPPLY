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
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Subscription" (
        "id" TEXT PRIMARY KEY,
        "customerId" TEXT,
        "customerEmail" TEXT NOT NULL,
        "customerName" TEXT,
        "planId" TEXT NOT NULL,
        "planName" TEXT NOT NULL,
        "amount" DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        "currency" TEXT NOT NULL DEFAULT 'GBP',
        "status" TEXT NOT NULL DEFAULT 'active',
        "billingInterval" TEXT NOT NULL DEFAULT 'month',
        "nextBillingDate" TIMESTAMP(3),
        "worldpayTransactionId" TEXT,
        "worldpayRecurringHref" TEXT,
        "worldpaySchemeReference" TEXT,
        "lastPaymentStatus" TEXT,
        "lastPaymentId" TEXT,
        "lastPaymentAt" TIMESTAMP(3),
        "failedPaymentCount" INTEGER NOT NULL DEFAULT 0,
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

async function syncToPrismaModel(resource: string, item: any): Promise<void> {
  if (!item) return;
  const id = String(item.id || item.slug || `item-${Date.now()}-${Math.random()}`);
  const norm = resource.toLowerCase();

  try {
    if (norm === 'products') {
      await prisma.product.upsert({
        where: { id },
        update: {
          title: item.title || 'Untitled Product',
          description: item.description || null,
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
          compareAtPrice: typeof item.compareAtPrice === 'number' ? item.compareAtPrice : parseFloat(item.compareAtPrice) || 0,
          inventory: typeof item.inventory === 'number' ? item.inventory : parseInt(item.inventory) || 0,
          sku: item.sku || null,
          category: item.category || null,
          vendor: item.vendor || null,
          status: item.status || 'Active',
          image: item.image || null,
          weight: typeof item.weight === 'number' ? item.weight : parseFloat(item.weight) || 0,
          tags: Array.isArray(item.tags) ? item.tags : [],
          media: Array.isArray(item.media) ? item.media : [],
          variants: item.variants || null,
          concreteVariants: item.concreteVariants || null,
          barcode: item.barcode || null,
          slug: item.slug || id,
          seoTitle: item.seoTitle || null,
          seoDescription: item.seoDescription || null,
          strength: item.strength || null,
          flavour: item.flavour || null,
          data: item
        },
        create: {
          id,
          title: item.title || 'Untitled Product',
          description: item.description || null,
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
          compareAtPrice: typeof item.compareAtPrice === 'number' ? item.compareAtPrice : parseFloat(item.compareAtPrice) || 0,
          inventory: typeof item.inventory === 'number' ? item.inventory : parseInt(item.inventory) || 0,
          sku: item.sku || null,
          category: item.category || null,
          vendor: item.vendor || null,
          status: item.status || 'Active',
          image: item.image || null,
          weight: typeof item.weight === 'number' ? item.weight : parseFloat(item.weight) || 0,
          tags: Array.isArray(item.tags) ? item.tags : [],
          media: Array.isArray(item.media) ? item.media : [],
          variants: item.variants || null,
          concreteVariants: item.concreteVariants || null,
          barcode: item.barcode || null,
          slug: item.slug || id,
          seoTitle: item.seoTitle || null,
          seoDescription: item.seoDescription || null,
          strength: item.strength || null,
          flavour: item.flavour || null,
          data: item
        }
      });
    } else if (norm === 'collections') {
      const colSlug = item.slug || id;
      try {
        await prisma.collection.upsert({
          where: { id },
          update: {
            title: item.title || 'Untitled Collection',
            description: item.description || null,
            type: item.type || 'Manual',
            image: item.image || null,
            productIds: Array.isArray(item.productIds) ? item.productIds : [],
            slug: colSlug,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
            data: item
          },
          create: {
            id,
            title: item.title || 'Untitled Collection',
            description: item.description || null,
            type: item.type || 'Manual',
            image: item.image || null,
            productIds: Array.isArray(item.productIds) ? item.productIds : [],
            slug: colSlug,
            seoTitle: item.seoTitle || null,
            seoDescription: item.seoDescription || null,
            data: item
          }
        });
      } catch (colErr: any) {
        if (colErr?.code === 'P2002') {
          await prisma.collection.upsert({
            where: { id },
            update: { slug: `${colSlug}-${id}`, data: item },
            create: { id, title: item.title || 'Untitled Collection', slug: `${colSlug}-${id}`, data: item }
          }).catch(() => {});
        }
      }
    } else if (norm === 'blogs') {
      const blogSlug = item.slug ? String(item.slug).trim() : id;
      const cleanContent = typeof item.content === 'string' ? item.content : (typeof item.body === 'string' ? item.body : (item.content ? String(item.content) : ''));
      const blogData = {
        title: item.title || 'Untitled Blog',
        slug: blogSlug,
        excerpt: item.excerpt || null,
        content: cleanContent,
        image: item.image || null,
        author: item.author || null,
        category: item.category || null,
        status: item.status || 'Active',
        publishedAt: item.publishedAt || null,
        readTime: item.readTime || null,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        data: item
      };

      try {
        await prisma.blogPost.upsert({
          where: { id },
          update: blogData,
          create: {
            id,
            ...blogData
          }
        });
      } catch (bErr: any) {
        if (bErr?.code === 'P2002') {
          const fallbackSlug = `${blogSlug}-${String(id).slice(-6)}`;
          await prisma.blogPost.upsert({
            where: { id },
            update: { ...blogData, slug: fallbackSlug },
            create: { id, ...blogData, slug: fallbackSlug }
          }).catch((e: any) => console.warn(`[BlogPost Fallback Upsert] warning:`, e?.message));
        } else {
          console.warn(`[BlogPost Sync] warning:`, bErr?.message);
        }
      }
    } else if (norm === 'discounts') {
      await prisma.discount.upsert({
        where: { id },
        update: {
          title: item.title || item.code || 'Discount',
          status: item.status || 'Active',
          method: item.method || 'Code',
          eligibility: item.eligibility || 'All',
          type: item.type || 'Percentage',
          used: typeof item.used === 'number' ? item.used : 0,
          details: item.details || null,
          data: item
        },
        create: {
          id,
          title: item.title || item.code || 'Discount',
          status: item.status || 'Active',
          method: item.method || 'Code',
          eligibility: item.eligibility || 'All',
          type: item.type || 'Percentage',
          used: typeof item.used === 'number' ? item.used : 0,
          details: item.details || null,
          data: item
        }
      });
    } else if (norm === 'customers') {
      const emailVal = (item.email && item.email.trim()) ? item.email.trim().toLowerCase() : `cust-${id}@pouch-supply.com`;
      try {
        await prisma.customer.upsert({
          where: { email: emailVal },
          update: {
            name: item.name || 'Customer',
            subscriptionStatus: item.subscriptionStatus || 'Not subscribed',
            location: item.location || null,
            ordersCount: typeof item.ordersCount === 'number' ? item.ordersCount : 0,
            amountSpent: typeof item.amountSpent === 'number' ? item.amountSpent : 0,
            addresses: Array.isArray(item.addresses) ? item.addresses : [],
            wishlist: Array.isArray(item.wishlist) ? item.wishlist : [],
            referralCode: item.referralCode || null,
            storeCredit: typeof item.storeCredit === 'number' ? item.storeCredit : 0,
            data: item
          },
          create: {
            id,
            name: item.name || 'Customer',
            email: emailVal,
            subscriptionStatus: item.subscriptionStatus || 'Not subscribed',
            location: item.location || null,
            ordersCount: typeof item.ordersCount === 'number' ? item.ordersCount : 0,
            amountSpent: typeof item.amountSpent === 'number' ? item.amountSpent : 0,
            addresses: Array.isArray(item.addresses) ? item.addresses : [],
            wishlist: Array.isArray(item.wishlist) ? item.wishlist : [],
            referralCode: item.referralCode || null,
            storeCredit: typeof item.storeCredit === 'number' ? item.storeCredit : 0,
            data: item
          }
        });
      } catch (cErr: any) {
        if (cErr?.code === 'P2002') {
          const safeEmail = `cust-${id}@pouch-supply.com`;
          await prisma.customer.upsert({
            where: { id },
            update: {
              name: item.name || 'Customer',
              email: safeEmail,
              subscriptionStatus: item.subscriptionStatus || 'Not subscribed',
              location: item.location || null,
              ordersCount: typeof item.ordersCount === 'number' ? item.ordersCount : 0,
              amountSpent: typeof item.amountSpent === 'number' ? item.amountSpent : 0,
              addresses: Array.isArray(item.addresses) ? item.addresses : [],
              wishlist: Array.isArray(item.wishlist) ? item.wishlist : [],
              referralCode: item.referralCode || null,
              storeCredit: typeof item.storeCredit === 'number' ? item.storeCredit : 0,
              data: item
            },
            create: {
              id,
              name: item.name || 'Customer',
              email: safeEmail,
              subscriptionStatus: item.subscriptionStatus || 'Not subscribed',
              location: item.location || null,
              ordersCount: typeof item.ordersCount === 'number' ? item.ordersCount : 0,
              amountSpent: typeof item.amountSpent === 'number' ? item.amountSpent : 0,
              addresses: Array.isArray(item.addresses) ? item.addresses : [],
              wishlist: Array.isArray(item.wishlist) ? item.wishlist : [],
              referralCode: item.referralCode || null,
              storeCredit: typeof item.storeCredit === 'number' ? item.storeCredit : 0,
              data: item
            }
          }).catch(e => console.warn('[Prisma Customer Sync] Fallback error:', e?.message));
        } else {
          console.warn('[Prisma Customer Sync] Warning:', cErr?.message);
        }
      }
    } else if (norm === 'orders') {
      await prisma.order.upsert({
        where: { id },
        update: {
          customerName: item.customerName || 'Valued Customer',
          customerEmail: item.customerEmail || 'customer@pouch-supply.com',
          tags: Array.isArray(item.tags) ? item.tags : [],
          fulfillmentStatus: item.fulfillmentStatus || 'Unfulfilled',
          paymentStatus: item.paymentStatus || 'Paid',
          worldpayTxId: item.worldpayTxId || item.gatewayTxId || null,
          worldpayAuthCode: item.worldpayAuthCode || item.gatewayAuthCode || null,
          gatewayTxId: item.gatewayTxId || item.worldpayTxId || null,
          gatewayAuthCode: item.gatewayAuthCode || item.worldpayAuthCode || null,
          cardBrand: item.cardBrand || 'Card',
          total: typeof item.total === 'number' ? item.total : parseFloat(item.total) || 0,
          storeCreditApplied: typeof item.storeCreditApplied === 'number' ? item.storeCreditApplied : parseFloat(item.storeCreditApplied) || 0,
          destination: item.destination || 'United Kingdom',
          date: item.date || new Date().toISOString(),
          deliveryMethod: item.deliveryMethod || 'Royal Mail Tracked 24/48',
          items: item.items || [],
          data: item
        },
        create: {
          id,
          customerName: item.customerName || 'Valued Customer',
          customerEmail: item.customerEmail || 'customer@pouch-supply.com',
          tags: Array.isArray(item.tags) ? item.tags : [],
          fulfillmentStatus: item.fulfillmentStatus || 'Unfulfilled',
          paymentStatus: item.paymentStatus || 'Paid',
          worldpayTxId: item.worldpayTxId || item.gatewayTxId || null,
          worldpayAuthCode: item.worldpayAuthCode || item.gatewayAuthCode || null,
          gatewayTxId: item.gatewayTxId || item.worldpayTxId || null,
          gatewayAuthCode: item.gatewayAuthCode || item.worldpayAuthCode || null,
          cardBrand: item.cardBrand || 'Card',
          total: typeof item.total === 'number' ? item.total : parseFloat(item.total) || 0,
          storeCreditApplied: typeof item.storeCreditApplied === 'number' ? item.storeCreditApplied : parseFloat(item.storeCreditApplied) || 0,
          destination: item.destination || 'United Kingdom',
          date: item.date || new Date().toISOString(),
          deliveryMethod: item.deliveryMethod || 'Royal Mail Tracked 24/48',
          items: item.items || [],
          data: item
        }
      });
    } else if (norm === 'custompages' || norm === 'pages') {
      const pageSlug = item.slug || id;
      const pageSections = Array.isArray(item.sections) ? item.sections : [];
      try {
        await prisma.customPage.upsert({
          where: { id },
          update: {
            title: item.title || 'Untitled Page',
            slug: pageSlug,
            visibility: item.visibility || 'Visible',
            isHomepage: Boolean(item.isHomepage),
            sections: pageSections,
            data: { ...item, sections: pageSections }
          },
          create: {
            id,
            title: item.title || 'Untitled Page',
            slug: pageSlug,
            visibility: item.visibility || 'Visible',
            isHomepage: Boolean(item.isHomepage),
            sections: pageSections,
            data: { ...item, sections: pageSections }
          }
        });
      } catch (pErr: any) {
        if (pErr?.code === 'P2002') {
          await prisma.customPage.upsert({
            where: { id },
            update: { slug: `${pageSlug}-${id}`, sections: pageSections, data: { ...item, sections: pageSections } },
            create: { id, title: item.title || 'Untitled Page', slug: `${pageSlug}-${id}`, sections: pageSections, data: { ...item, sections: pageSections } }
          }).catch(() => {});
        }
      }
    } else if (norm === 'analytics' || norm === 'analyticsrecords' || norm === 'analyticsrecord') {
      await prisma.analyticsRecord.upsert({
        where: { id },
        update: {
          metric: item.metric || 'page_view',
          value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 1,
          period: item.period || null,
          metadata: item.metadata || item,
        },
        create: {
          id,
          metric: item.metric || 'page_view',
          value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 1,
          period: item.period || null,
          metadata: item.metadata || item,
        }
      });
    } else if (norm === 'files' || norm === 'fileentry' || norm === 'fileentries') {
      if (item.url) {
        const sizeVal = item.size ?? item.fileSize;
        const sizeStr = typeof sizeVal === 'number'
          ? (sizeVal > 1024 * 1024 ? `${(sizeVal / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(sizeVal / 1024)} KB`)
          : (sizeVal ? String(sizeVal) : null);

        const rawPublicId = item.publicId;
        const publicIdStr = (rawPublicId && typeof rawPublicId === 'string' && rawPublicId.trim() !== '')
          ? rawPublicId.trim()
          : null;

        const fileData = {
          fileName: item.fileName || item.originalFilename || 'Media Asset',
          altText: item.altText ? String(item.altText) : 'Media Asset',
          size: sizeStr,
          fileSize: sizeStr,
          references: item.references ? String(item.references) : 'Direct Upload',
          url: String(item.url),
          secureUrl: item.secureUrl ? String(item.secureUrl) : String(item.url),
          mimeType: item.mimeType ? String(item.mimeType) : null,
          publicId: publicIdStr,
          resourceType: item.resourceType ? String(item.resourceType) : 'image',
          format: item.format ? String(item.format) : null,
          folder: item.folder ? String(item.folder) : 'storefront_media',
          width: typeof item.width === 'number' ? item.width : (parseInt(String(item.width), 10) || null),
          height: typeof item.height === 'number' ? item.height : (parseInt(String(item.height), 10) || null),
          data: item
        };

        try {
          await prisma.fileEntry.upsert({
            where: { id },
            update: fileData,
            create: {
              id,
              ...fileData
            }
          });
        } catch (upsertErr: any) {
          if (upsertErr?.code === 'P2002') {
            await prisma.fileEntry.upsert({
              where: { id },
              update: { ...fileData, publicId: null },
              create: {
                id,
                ...fileData,
                publicId: null
              }
            }).catch(() => {});
          }
        }
      }
    } else if (norm === 'subscriptions' || norm === 'subscription') {
      const subEmail = String(item.customerEmail || item.email || `customer-${id}@pouch-supply.com`).toLowerCase().trim();
      const amountVal = typeof item.amount === 'number' ? item.amount : (parseFloat(item.amount) || 0.0);
      const nextDate = item.nextBillingDate ? new Date(item.nextBillingDate) : null;
      const lastPaymentDate = item.lastPaymentAt ? new Date(item.lastPaymentAt) : null;

      await prisma.subscription.upsert({
        where: { id },
        update: {
          customerId: item.customerId || null,
          customerEmail: subEmail,
          customerName: item.customerName || null,
          planId: item.planId || 'sub-pack',
          planName: item.planName || 'Pouch Supply Subscription',
          amount: amountVal,
          currency: item.currency || 'GBP',
          status: item.status || 'active',
          billingInterval: item.billingInterval || 'month',
          nextBillingDate: nextDate,
          worldpayTransactionId: item.worldpayTransactionId || null,
          worldpayRecurringHref: item.worldpayRecurringHref || item.recurringHref || null,
          worldpaySchemeReference: item.worldpaySchemeReference || null,
          lastPaymentStatus: item.lastPaymentStatus || null,
          lastPaymentId: item.lastPaymentId || null,
          lastPaymentAt: lastPaymentDate,
          failedPaymentCount: typeof item.failedPaymentCount === 'number' ? item.failedPaymentCount : 0
        },
        create: {
          id,
          customerId: item.customerId || null,
          customerEmail: subEmail,
          customerName: item.customerName || null,
          planId: item.planId || 'sub-pack',
          planName: item.planName || 'Pouch Supply Subscription',
          amount: amountVal,
          currency: item.currency || 'GBP',
          status: item.status || 'active',
          billingInterval: item.billingInterval || 'month',
          nextBillingDate: nextDate,
          worldpayTransactionId: item.worldpayTransactionId || null,
          worldpayRecurringHref: item.worldpayRecurringHref || item.recurringHref || null,
          worldpaySchemeReference: item.worldpaySchemeReference || null,
          lastPaymentStatus: item.lastPaymentStatus || null,
          lastPaymentId: item.lastPaymentId || null,
          lastPaymentAt: lastPaymentDate,
          failedPaymentCount: typeof item.failedPaymentCount === 'number' ? item.failedPaymentCount : 0
        }
      });
    }
  } catch (mErr: any) {
    console.warn(`[Prisma Model Sync] ${norm} sync warning:`, mErr?.message);
  }
}

async function fetchFromPrismaModel(resource: string): Promise<any[]> {
  const norm = resource.toLowerCase();
  try {
    if (norm === 'orders') {
      const dbOrders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
      return dbOrders.map(o => {
        const itemData = (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) ? (o.data as object) : {};
        return {
          id: o.id,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          tags: o.tags,
          fulfillmentStatus: o.fulfillmentStatus,
          paymentStatus: o.paymentStatus,
          worldpayTxId: o.worldpayTxId,
          worldpayAuthCode: o.worldpayAuthCode,
          gatewayTxId: o.gatewayTxId,
          gatewayAuthCode: o.gatewayAuthCode,
          cardBrand: o.cardBrand,
          total: o.total,
          storeCreditApplied: o.storeCreditApplied,
          destination: o.destination,
          date: o.date,
          deliveryMethod: o.deliveryMethod,
          items: o.items,
          trackingId: o.trackingId,
          carrier: o.carrier,
          trackingHistory: o.trackingHistory,
          discountApplied: o.discountApplied,
          ...itemData,
          createdAt: o.createdAt ? o.createdAt.toISOString() : undefined
        };
      });
    } else if (norm === 'subscriptions' || norm === 'subscription') {
      const items = await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' } });
      return items.map(s => ({
        id: s.id,
        customerId: s.customerId,
        customerEmail: s.customerEmail,
        customerName: s.customerName,
        planId: s.planId,
        planName: s.planName,
        amount: Number(s.amount),
        currency: s.currency,
        status: s.status,
        billingInterval: s.billingInterval,
        nextBillingDate: s.nextBillingDate ? s.nextBillingDate.toISOString() : null,
        worldpayTransactionId: s.worldpayTransactionId,
        worldpayRecurringHref: s.worldpayRecurringHref,
        worldpaySchemeReference: s.worldpaySchemeReference,
        lastPaymentStatus: s.lastPaymentStatus,
        lastPaymentId: s.lastPaymentId,
        lastPaymentAt: s.lastPaymentAt ? s.lastPaymentAt.toISOString() : null,
        failedPaymentCount: s.failedPaymentCount,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString()
      }));
    } else if (norm === 'products') {
      const items = await prisma.product.findMany();
      return items.map(p => (p.data && typeof p.data === 'object') ? { ...(p.data as object), id: p.id } : p);
    } else if (norm === 'collections') {
      const items = await prisma.collection.findMany();
      return items.map(c => (c.data && typeof c.data === 'object') ? { ...(c.data as object), id: c.id } : c);
    } else if (norm === 'blogs') {
      const items = await prisma.blogPost.findMany();
      return items.map(b => (b.data && typeof b.data === 'object') ? { ...(b.data as object), id: b.id } : b);
    } else if (norm === 'discounts') {
      const items = await prisma.discount.findMany();
      return items.map(d => (d.data && typeof d.data === 'object') ? { ...(d.data as object), id: d.id } : d);
    } else if (norm === 'customers') {
      const items = await prisma.customer.findMany();
      return items.map(c => (c.data && typeof c.data === 'object') ? { ...(c.data as object), id: c.id } : c);
    } else if (norm === 'files' || norm === 'fileentry' || norm === 'fileentries') {
      const items = await prisma.fileEntry.findMany({ orderBy: { createdAt: 'desc' } });
      return items.map(f => (f.data && typeof f.data === 'object') ? { ...(f.data as object), id: f.id, url: f.url } : f);
    } else if (norm === 'custompages' || norm === 'pages') {
      const items = await prisma.customPage.findMany();
      return items.map(cp => {
        let pageObj: any = (cp.data && typeof cp.data === 'object') ? { ...(cp.data as object) } : {};
        pageObj.id = cp.id || pageObj.id;
        pageObj.title = cp.title || pageObj.title;
        pageObj.slug = cp.slug ?? pageObj.slug;
        pageObj.visibility = cp.visibility || pageObj.visibility;
        pageObj.isHomepage = cp.isHomepage !== undefined ? cp.isHomepage : pageObj.isHomepage;

        const colSections = Array.isArray(cp.sections) ? (cp.sections as any[]) : [];
        const dataSections = Array.isArray(pageObj.sections) ? (pageObj.sections as any[]) : [];

        if (colSections.length > 0) {
          pageObj.sections = colSections;
        } else if (dataSections.length > 0) {
          pageObj.sections = dataSections;
        } else {
          pageObj.sections = [];
        }
        return pageObj;
      });
    } else if (norm === 'analytics' || norm === 'analyticsrecords' || norm === 'analyticsrecord') {
      const items = await prisma.analyticsRecord.findMany();
      return items.map(a => (a.metadata && typeof a.metadata === 'object') ? { ...(a.metadata as object), id: a.id } : a);
    }
  } catch (err: any) {
    console.warn(`[fetchFromPrismaModel] ${norm} query warning:`, err?.message);
  }
  return [];
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

      const storeResourceList = (records || []).map(r => r.data as any);
      const directModelList = await fetchFromPrismaModel(normResource);

      // Merge by ID to ensure items in direct Prisma model (e.g. Order table) are included
      const mergedMap = new Map<string, any>();
      for (const item of storeResourceList) {
        if (!item) continue;
        const key = String(item.id || item.slug || item.orderId || '');
        if (key) mergedMap.set(key, item);
      }
      for (const item of directModelList) {
        if (!item) continue;
        const key = String(item.id || item.slug || item.orderId || '');
        if (key) {
          if (!mergedMap.has(key)) {
            mergedMap.set(key, item);
            // Sync missing item back to StoreResource table
            prisma.storeResource.upsert({
              where: { resource_itemId: { resource: normResource, itemId: key } },
              update: { data: item },
              create: { resource: normResource, itemId: key, data: item }
            }).catch(() => {});
          } else {
            // Prefer item with more populated details or keep storeResource
            const existing = mergedMap.get(key);
            let mergedItem = { ...existing, ...item };

            // For customPages, preserve populated sections array from either source
            if (normResource === 'customPages' || normResource === 'custompages' || normResource === 'pages') {
              const itemSecs = Array.isArray(item?.sections) ? item.sections : [];
              const existingSecs = Array.isArray(existing?.sections) ? existing.sections : [];
              if (itemSecs.length > 0) {
                mergedItem.sections = itemSecs;
              } else if (existingSecs.length > 0) {
                mergedItem.sections = existingSecs;
              } else {
                mergedItem.sections = [];
              }
            }

            // For blogs, preserve populated cover image
            if (normResource === 'blogs' && !mergedItem.image && existing?.image) {
              mergedItem.image = existing.image;
            }

            mergedMap.set(key, mergedItem);
          }
        }
      }

      if (mergedMap.size > 0) {
        const list = Array.from(mergedMap.values());
        memoryCache[normResource] = list;
        persistMemoryCacheToBackup();
        return list;
      }

      // Pre-seed Neon PostgreSQL if table for resource is empty
      const defaultList = memoryCache[normResource] || memoryCache[resource] || [];
      if (defaultList.length > 0) {
        console.log(`[Neon DB] Seeding initial ${normResource} (${defaultList.length} items)...`);
        const BATCH_SIZE = 25;
        for (let i = 0; i < defaultList.length; i += BATCH_SIZE) {
          const batch = defaultList.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (item) => {
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
            }).catch(() => {});
            syncToPrismaModel(normResource, item).catch(() => {});
          }));
        }
      }
      return defaultList;
    } catch (err) {
      console.error(`[Neon DB] Error fetching resource ${normResource}:`, err);
    }
  }

  return memoryCache[normResource] || memoryCache[resource] || [];
}

export async function saveResource(resource: string, list: any[] | any): Promise<any[]> {
  const normResource = normalizeResourceName(resource);
  const normalizedList = Array.isArray(list) ? list : (list ? [list] : []);
  if (!Array.isArray(normalizedList)) return memoryCache[normResource] || [];

  memoryCache[normResource] = [...normalizedList];
  if (normResource !== resource) memoryCache[resource] = memoryCache[normResource];
  persistMemoryCacheToBackup();

  const isConnected = await getDb();
  if (isConnected) {
    try {
      const validItemIds: string[] = [];
      const BATCH_SIZE = 25;

      for (let i = 0; i < normalizedList.length; i += BATCH_SIZE) {
        const batch = normalizedList.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item) => {
          if (!item) return;
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
          }).catch((e: any) => console.warn(`[StoreResource Sync] ${normResource} ${itemId} warning:`, e?.message));

          // Dual sync to dedicated Prisma model table
          syncToPrismaModel(normResource, item).catch(() => {});
        }));
      }

      // Delete items removed from list in StoreResource
      if (validItemIds.length > 0) {
        await prisma.storeResource.deleteMany({
          where: {
            resource: normResource,
            itemId: {
              notIn: validItemIds
            }
          }
        }).catch((e: any) => console.warn(`[StoreResource deleteMany] ${normResource} warning:`, e?.message));
      }

      // Delete items removed from list in dedicated Prisma tables
      const norm = normResource.toLowerCase();
      if (norm === 'orders') {
        await prisma.order.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'products') {
        await prisma.product.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'collections') {
        await prisma.collection.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'customers') {
        await prisma.customer.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'blogs') {
        await prisma.blogPost.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'discounts') {
        await prisma.discount.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'custompages' || norm === 'pages') {
        await prisma.customPage.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      } else if (norm === 'files' || norm === 'fileentry' || norm === 'fileentries') {
        await prisma.fileEntry.deleteMany({ where: { id: { notIn: validItemIds } } }).catch(() => {});
      }
    } catch (err) {
      console.error(`[Neon DB] Error saving resource ${normResource}:`, err);
    }
  }

  return normalizedList;
}

export async function fetchStoreSetting(id: string, defaultVal: any = null): Promise<any> {
  let settingsData: any = null;
  const isConnected = await getDb();
  if (isConnected) {
    try {
      const setting = await prisma.storeSetting.findUnique({
        where: { id }
      });
      if (setting && setting.data) {
        settingsData = setting.data;
      }
    } catch (err) {
      console.error(`[Neon DB] Error fetching store setting ${id}:`, err);
    }
  }

  if (!settingsData) {
    const filePath = path.join(process.cwd(), `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        settingsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {}
    }
  }

  return settingsData || defaultVal;
}

export async function saveStoreSetting(id: string, data: any): Promise<any> {
  const filePath = path.join(process.cwd(), `${id}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}

  const isConnected = await getDb();
  if (isConnected) {
    try {
      await prisma.storeSetting.upsert({
        where: { id },
        update: { data },
        create: { id, data }
      });
    } catch (err) {
      console.error(`[Neon DB] Error saving store setting ${id}:`, err);
    }
  }

  return data;
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
      syncToPrismaModel(normResource, item).catch(() => {});
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
    memoryCache[normResource] = memoryCache[normResource].filter((i: any) => String(i.id) !== String(id) && String(i.slug || '') !== String(id));
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

      const norm = normResource.toLowerCase();
      if (norm === 'orders') {
        await prisma.order.deleteMany({ where: { id } }).catch(() => {});
      } else if (norm === 'products') {
        await prisma.product.deleteMany({ where: { id } }).catch(() => {});
      } else if (norm === 'collections') {
        await prisma.collection.deleteMany({ where: { id } }).catch(() => {});
      } else if (norm === 'customers') {
        await prisma.customer.deleteMany({ where: { id } }).catch(() => {});
      } else if (norm === 'blogs') {
        await prisma.blogPost.deleteMany({ where: { id } }).catch(() => {});
      } else if (norm === 'discounts') {
        await prisma.discount.deleteMany({ where: { id } }).catch(() => {});
      } else if (norm === 'custompages' || norm === 'pages') {
        await prisma.customPage.deleteMany({ where: { id } }).catch(() => {});
      }
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

export async function getUploadedImage(idOrFilename: string): Promise<{ base64Data: string; mimeType: string } | null> {
  if (memoryImages[idOrFilename]) return memoryImages[idOrFilename];

  const dotIndex = idOrFilename.lastIndexOf('.');
  const idNoExt = dotIndex !== -1 ? idOrFilename.substring(0, dotIndex) : idOrFilename;
  if (memoryImages[idNoExt]) return memoryImages[idNoExt];

  const isConnected = await getDb();
  if (isConnected) {
    try {
      const record = await prisma.storeResource.findFirst({
        where: {
          resource: 'uploaded_images',
          OR: [
            { itemId: idOrFilename },
            { itemId: idNoExt }
          ]
        }
      });
      if (record && record.data) {
        const data = record.data as any;
        const result = { base64Data: data.base64Data, mimeType: data.mimeType };
        memoryImages[idOrFilename] = result;
        memoryImages[idNoExt] = result;
        return result;
      }
    } catch (e) {
      console.warn('[Neon DB] Failed to retrieve uploaded image:', e);
    }
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
