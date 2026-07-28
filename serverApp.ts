import express from "express";
import path from "path";
import fs from "fs";
import { 
  fetchResource, saveResource, saveUploadedImage, getUploadedImage, 
  getConnectionStatus, updateDatabaseUrl, getDb, getDatabaseDetails, 
  fetchLayoutSettings, saveLayoutSettings 
} from "./serverDb";

// Import modular routers for products, collections, customers, orders, files, discounts, custom pages, and blogs
import productsRouter from "./backend/routes/products";
import collectionsRouter from "./backend/routes/collections";
import ordersRouter from "./backend/routes/orders";
import filesRouter from "./backend/routes/files";
import customersRouter from "./backend/routes/customers";
import discountsRouter from "./backend/routes/discounts";
import customPagesRouter from "./backend/routes/customPages";
import blogsRouter from "./backend/routes/blogs";

import mediaRouter from "./backend/routes/media";
import { uploadToCloudinary, isCloudinaryConfigured } from "./backend/services/cloudinary";
import { prisma } from "./src/lib/prisma";

export async function createExpressApp() {
  const app = express();

  // Hydrate environment variables (including Cloudinary) from stored layout settings
  try {
    await fetchLayoutSettings();
  } catch (err) {}

  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return next();
    }
    express.json({
      limit: "1000mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return next();
    }
    express.urlencoded({ limit: "1000mb", extended: true })(req, res, next);
  });

  let uploadsPath = path.join(process.cwd(), "uploads");
  try {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      uploadsPath = "/tmp/uploads";
    }
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
  } catch (err) {
    console.warn("[Uploads Setup] Failed to create uploads directory at", uploadsPath, err);
    uploadsPath = "/tmp/uploads";
    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }
    } catch (tmpErr) {
      console.error("[Uploads Setup] Fatal: failed to create /tmp/uploads:", tmpErr);
    }
  }

  const serveMediaBuffer = (req: express.Request, res: express.Response, buffer: Buffer, mimeType: string) => {
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

      const chunksize = (end - start) + 1;
      const chunk = buffer.subarray(start, end + 1);

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000",
      });
      return res.end(chunk);
    } else {
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": fileSize,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
      });
      return res.end(buffer);
    }
  };

  app.get("/uploads/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(uploadsPath, filename);
      
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
      
      const dotIndex = filename.lastIndexOf(".");
      const id = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
      
      const imgDoc = await getUploadedImage(filename) || await getUploadedImage(id);
      if (imgDoc && imgDoc.base64Data) {
        try {
          fs.writeFileSync(filePath, Buffer.from(imgDoc.base64Data, "base64"));
          return res.sendFile(filePath);
        } catch (e) {}
        const imgBuffer = Buffer.from(imgDoc.base64Data, "base64");
        return serveMediaBuffer(req, res, imgBuffer, imgDoc.mimeType || "image/png");
      }
    } catch (err) {
      console.error("[Uploads] Error reading uploaded file:", err);
    }
    return res.status(404).send("File not found");
  });

  app.use("/uploads", express.static(uploadsPath));

  app.post("/api/upload", async (req, res) => {
    try {
      const { data, filename } = req.body;
      if (!data) {
        return res.status(400).json({ error: "Missing data payload for upload." });
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

      // 1. If Cloudinary is configured, upload directly to Cloudinary
      if (isCloudinaryConfigured()) {
        const fileBuffer = Buffer.from(base64String, "base64");
        const uploadResult = await uploadToCloudinary(fileBuffer, {
          folder: 'storefront_media',
          originalFilename: displayName,
          resourceType: isVideo ? 'video' : 'auto'
        });

        const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const displaySize = uploadResult.fileSize > 1024 * 1024
          ? `${(uploadResult.fileSize / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(uploadResult.fileSize / 1024)} KB`;

        const newFile = await prisma.fileEntry.create({
          data: {
            id,
            publicId: uploadResult.publicId,
            url: uploadResult.secureUrl || uploadResult.url,
            secureUrl: uploadResult.secureUrl,
            resourceType: uploadResult.resourceType,
            format: uploadResult.format,
            width: uploadResult.width || null,
            height: uploadResult.height || null,
            fileSize: displaySize,
            folder: uploadResult.folder,
            originalFilename: displayName,
            fileName: displayName,
            altText: displayName.split('.')[0] || 'Uploaded Asset',
            dateAdded: new Date().toISOString().split('T')[0],
            references: 'Direct Upload',
            mimeType: mimeType
          }
        });

        return res.json({
          url: newFile.url,
          secureUrl: newFile.secureUrl,
          publicId: newFile.publicId,
          id: newFile.id,
          fileName: displayName,
          mimeType
        });
      }

      // 2. Fallback if Cloudinary environment variables are missing
      const id = `file-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      let extension = "png";
      if (filename && filename.includes(".")) {
        extension = filename.split(".").pop()?.toLowerCase() || "png";
      } else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
        extension = "jpg";
      } else if (mimeType.includes("mp4")) {
        extension = "mp4";
      }

      const filenameOnDisk = `${id}.${extension}`;
      const filePath = path.join(uploadsPath, filenameOnDisk);
      try {
        fs.writeFileSync(filePath, Buffer.from(base64String, "base64"));
      } catch (fsErr) {
        console.error("[API Upload] Failed to write file to local disk:", fsErr);
      }

      await saveUploadedImage(id, base64String, mimeType);
      
      const fileUrl = `/uploads/${filenameOnDisk}`;
      const rawBytes = Math.round(base64String.length * 0.75);
      const calculatedSize = rawBytes > 1024 * 1024 
        ? `${(rawBytes / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(rawBytes / 1024)} KB`;

      try {
        await prisma.fileEntry.create({
          data: {
            id,
            fileName: displayName,
            url: fileUrl,
            altText: displayName.split('.')[0] || 'Uploaded Media Asset',
            mimeType: mimeType,
            size: calculatedSize,
            fileSize: calculatedSize,
            references: 'Direct Upload',
            dateAdded: new Date().toISOString().split('T')[0]
          }
        });
      } catch (fileRegErr) {}

      res.json({ url: fileUrl, id, fileName: displayName, mimeType });
    } catch (err: any) {
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
    } catch (err: any) {
      res.status(500).send("Internal server error serving media");
    }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/db-status", async (req, res) => {
    try {
      await getDb();
    } catch (e) {}
    res.json(await getConnectionStatus());
  });

  app.get("/api/db-details", async (req, res) => {
    try {
      const details = await getDatabaseDetails();
      res.json(details);
    } catch (err: any) {
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
    } catch (err: any) {
      console.error("[API update-db-uri] Error updating connection string:", err);
      res.status(500).json({ error: err.message || "Failed to update connection string" });
    }
  });

  app.get("/api/layoutsettings", async (req, res) => {
    try {
      const data = await fetchLayoutSettings();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load layout settings" });
    }
  });

  app.post("/api/layoutsettings", async (req, res) => {
    try {
      const saved = await saveLayoutSettings(req.body);
      res.json({ status: "success", data: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save layout settings" });
    }
  });

  // Mount modular backend routers
  app.use("/api/media", mediaRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/collections", collectionsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/discounts", discountsRouter);
  app.use("/api/custompages", customPagesRouter);
  app.use("/api/blogs", blogsRouter);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      const lastSegment = url.split('/').pop() || '';
      if (url.startsWith("/api") || lastSegment.includes(".")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      const url = req.originalUrl;
      const lastSegment = url.split('/').pop() || '';
      if (url.startsWith("/api") || lastSegment.includes(".")) {
        return res.status(404).send("API or File Asset Not Found");
      }
      
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(500).send("Internal Server Error: Missing compiled static resources.");
        }
      });
    });
  }

  return app;
}
