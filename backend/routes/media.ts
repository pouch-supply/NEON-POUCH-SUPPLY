import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../../src/lib/prisma';
import { 
  uploadToCloudinary, 
  deleteFromCloudinary, 
  isCloudinaryConfigured, 
  buildOptimizedCloudinaryUrl 
} from '../services/cloudinary';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * Check where a media file (URL or ID) is referenced across the storefront
 */
export async function checkMediaReferences(fileUrl: string): Promise<string[]> {
  const references: string[] = [];
  if (!fileUrl) return references;

  try {
    // 1. Check Products
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { image: { equals: fileUrl } },
          { media: { has: fileUrl } }
        ]
      },
      select: { title: true }
    });
    products.forEach(p => references.push(`Product: ${p.title}`));

    // 2. Check Collections
    const collections = await prisma.collection.findMany({
      where: {
        OR: [
          { image: { equals: fileUrl } },
          { ogImage: { equals: fileUrl } }
        ]
      },
      select: { title: true }
    });
    collections.forEach(c => references.push(`Collection: ${c.title}`));

    // 3. Check Custom Pages
    const pages = await prisma.customPage.findMany({
      select: { title: true, sections: true }
    });
    pages.forEach(p => {
      const secStr = JSON.stringify(p.sections || '');
      if (secStr.includes(fileUrl)) {
        references.push(`Page: ${p.title}`);
      }
    });

    // 4. Check Blog Posts
    const blogs = await prisma.blogPost.findMany({
      where: { image: { equals: fileUrl } },
      select: { title: true }
    });
    blogs.forEach(b => references.push(`Blog: ${b.title}`));

    // 5. Check Layout Settings
    const layout = await prisma.layoutSetting.findFirst({
      where: { id: 'layout_settings' }
    });
    if (layout) {
      if (layout.headerLogoImage === fileUrl || layout.footerLogoImage === fileUrl) {
        references.push(`Header/Footer Settings`);
      }
      const menuStr = JSON.stringify(layout.menuItems || '');
      if (menuStr.includes(fileUrl)) {
        references.push(`Navigation Settings`);
      }
    }
  } catch (err) {
    console.error('[ReferenceCheck] Error checking references:', err);
  }

  return references;
}

// GET /api/media - List all media assets
router.get('/', async (req: Request, res: Response) => {
  try {
    const files = await prisma.fileEntry.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(files);
  } catch (err: any) {
    console.error('[Media API] GET error:', err);
    res.status(500).json({ error: err.message || 'Failed to list media files' });
  }
});

// GET /api/media/check-references - Check usage of media file
router.post('/check-references', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const references = await checkMediaReferences(url);
    res.json({ inUse: references.length > 0, references });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error checking media references' });
  }
});

// POST /api/media/upload - Single or multiple file upload to Cloudinary
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let fileBuffer: Buffer | null = null;
    let fileName = 'Uploaded Asset';
    let mimeType = 'image/png';
    let folder = (req.body.folder as string) || 'storefront_media';

    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname || 'Uploaded Asset';
      mimeType = req.file.mimetype || 'image/png';
    } else if (req.body.data) {
      const dataStr = req.body.data as string;
      fileName = (req.body.filename as string) || (req.body.fileName as string) || 'Uploaded Asset';
      if (dataStr.startsWith('data:')) {
        const matches = dataStr.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          fileBuffer = Buffer.from(matches[2], 'base64');
        }
      } else {
        fileBuffer = Buffer.from(dataStr.replace(/^data:[^;]+;base64,/, ''), 'base64');
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file data or buffer was provided' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(400).json({
        error: 'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are required to upload media.'
      });
    }

    const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)$/i.test(fileName);
    const resourceType = isVideo ? 'video' : 'auto';

    const uploadResult = await uploadToCloudinary(fileBuffer, {
      folder,
      originalFilename: fileName,
      resourceType
    });

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const displaySize = uploadResult.fileSize > 1024 * 1024
      ? `${(uploadResult.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(uploadResult.fileSize / 1024)} KB`;

    // Save ONLY metadata to Neon PostgreSQL
    const savedEntry = await prisma.fileEntry.create({
      data: {
        id: fileId,
        publicId: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        secureUrl: uploadResult.secureUrl,
        resourceType: uploadResult.resourceType,
        format: uploadResult.format,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        fileSize: displaySize,
        folder: uploadResult.folder,
        originalFilename: fileName,
        fileName: fileName,
        altText: fileName.split('.')[0] || 'Uploaded Media Asset',
        dateAdded: new Date().toISOString().split('T')[0],
        references: 'Direct Upload',
        mimeType: mimeType
      }
    });

    res.json({
      success: true,
      file: savedEntry,
      url: savedEntry.url,
      publicId: savedEntry.publicId,
      id: savedEntry.id
    });
  } catch (err: any) {
    console.error('[Media API] Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload media to Cloudinary' });
  }
});

// PATCH /api/media/:id - Rename / update metadata
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fileName, altText, folder } = req.body;

    const existing = await prisma.fileEntry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Media file not found' });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update media file metadata' });
  }
});

// DELETE /api/media/:id - Delete media from Cloudinary and PostgreSQL
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    const existing = await prisma.fileEntry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Media file not found' });
    }

    // Check references unless forced
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

    // Delete from Cloudinary CDN if publicId exists
    if (existing.publicId) {
      const resType = existing.resourceType || 'image';
      await deleteFromCloudinary(existing.publicId, resType);
    }

    // Delete from Neon PostgreSQL
    await prisma.fileEntry.delete({ where: { id } });

    res.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('[Media API] Delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete media asset' });
  }
});

export default router;
