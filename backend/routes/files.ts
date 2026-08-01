import { Router } from "express";
import { prisma } from "../../src/lib/prisma";
import { deleteFromCloudinary } from "../services/cloudinary";
import { checkMediaReferences } from "./media";
import { fetchResource, saveResource } from "../../serverDb";

const router = Router();

// GET all files directly from PostgreSQL FileEntry table with fallback
router.get("/", async (req, res) => {
  try {
    const data = await prisma.fileEntry.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.json(data);
  } catch (err: any) {
    console.warn("[Files Router] Prisma GET failed, falling back to StoreResource:", err?.message || err);
    try {
      const fallbackData = await fetchResource("files");
      return res.json(fallbackData);
    } catch (fallbackErr: any) {
      console.error("[Files Router] GET Error:", fallbackErr);
      return res.status(500).json({ error: fallbackErr.message || "Failed to fetch files" });
    }
  }
});

// POST update/sync files
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Files API expects an array of documents" });
    }

    try {
      for (const file of payload) {
        if (!file.id || !file.url) continue;

        const sizeVal = file.size ?? file.fileSize;
        const sizeStr = typeof sizeVal === 'number'
          ? (sizeVal > 1024 * 1024 ? `${(sizeVal / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(sizeVal / 1024)} KB`)
          : (sizeVal ? String(sizeVal) : null);

        const rawPublicId = file.publicId;
        const publicIdStr = (rawPublicId && typeof rawPublicId === 'string' && rawPublicId.trim() !== '')
          ? rawPublicId.trim()
          : null;

        const fileData = {
          fileName: file.fileName || file.originalFilename || 'Media Asset',
          altText: file.altText ? String(file.altText) : 'Media Asset',
          size: sizeStr,
          fileSize: sizeStr,
          references: file.references ? String(file.references) : 'Direct Upload',
          url: String(file.url),
          secureUrl: file.secureUrl ? String(file.secureUrl) : String(file.url),
          mimeType: file.mimeType ? String(file.mimeType) : null,
          publicId: publicIdStr,
          resourceType: file.resourceType ? String(file.resourceType) : 'image',
          format: file.format ? String(file.format) : null,
          folder: file.folder ? String(file.folder) : 'storefront_media',
          width: typeof file.width === 'number' ? file.width : (parseInt(String(file.width), 10) || null),
          height: typeof file.height === 'number' ? file.height : (parseInt(String(file.height), 10) || null)
        };

        try {
          await prisma.fileEntry.upsert({
            where: { id: String(file.id) },
            update: fileData,
            create: {
              id: String(file.id),
              ...fileData
            }
          });
        } catch (upsertErr: any) {
          if (upsertErr?.code === 'P2002') {
            await prisma.fileEntry.upsert({
              where: { id: String(file.id) },
              update: { ...fileData, publicId: null },
              create: {
                id: String(file.id),
                ...fileData,
                publicId: null
              }
            });
          } else {
            throw upsertErr;
          }
        }
      }

      const updated = await prisma.fileEntry.findMany({
        orderBy: { createdAt: "desc" }
      });
      return res.json(updated);
    } catch (prismaErr: any) {
      console.warn("[Files Router] Prisma POST failed, saving to StoreResource fallback:", prismaErr?.message || prismaErr);
      const fallbackSaved = await saveResource("files", payload);
      return res.json(fallbackSaved);
    }
  } catch (err: any) {
    console.error("[Files Router] POST Error:", err);
    return res.status(500).json({ error: err.message || "Failed to persist files" });
  }
});

// DELETE single file by id or url
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

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
              error: 'File is currently referenced in your store.',
              references: refs,
              canForce: true
            });
          }
        }

        if (existing.publicId) {
          await deleteFromCloudinary(existing.publicId, existing.resourceType || 'image');
        }

        await prisma.fileEntry.delete({ where: { id: existing.id } });
      }

      const updated = await prisma.fileEntry.findMany({
        orderBy: { createdAt: "desc" }
      });
      return res.json(updated);
    } catch (prismaErr: any) {
      console.warn("[Files Router] Prisma DELETE failed, falling back to StoreResource:", prismaErr?.message || prismaErr);
      const files = await fetchResource("files");
      const filtered = files.filter((f: any) => f.id !== id && f.url !== id && f.publicId !== id);
      const updated = await saveResource("files", filtered);
      return res.json(updated);
    }
  } catch (err: any) {
    console.error("[Files Router] DELETE Error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete file" });
  }
});

export default router;

