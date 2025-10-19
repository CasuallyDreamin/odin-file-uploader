import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma, UPLOAD_DIR } from '../app.js';

const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});
const upload = multer({ storage });

/* ------------------------------
   DIRECTORY ENDPOINTS
--------------------------------*/

// Create directory
router.post('/directory', async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Directory name required' });

    if (parentId) {
      const parent = await prisma.directory.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(400).json({ error: 'Parent directory not found' });
    }

    const dir = await prisma.directory.create({ data: { name, parentId: parentId || null } });

    const dirPath = parentId ? path.join(UPLOAD_DIR, parentId, name) : path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    res.json({ success: true, directory: dir });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create directory' });
  }
});

// GET /api/directories/top
router.get('/directories/top', async (req, res) => {
  try {
    const dirs = await prisma.directory.findMany({
      where: { parentId: null },
      include: { children: true, files: true },
    });
    res.json({ success: true, directories: dirs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch top-level directories' });
  }
});


// List directory contents
router.get('/directory/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const directory = await prisma.directory.findUnique({
      where: { id },
      include: { children: true, files: true },
    });

    if (!directory) return res.status(404).json({ error: 'Directory not found' });

    res.json({ success: true, directory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list directory contents' });
  }
});

/* ------------------------------
   FILE ENDPOINTS
--------------------------------*/

// Upload files — redirect to '/' on success
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { directoryId } = req.body;
    let targetDir = UPLOAD_DIR;

    if (directoryId) {
      const dir = await prisma.directory.findUnique({ where: { id: directoryId } });
      if (!dir) return res.status(400).send('Directory not found');

      targetDir = path.join(UPLOAD_DIR, directoryId);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const f of req.files) {
      const filePath = path.join(targetDir, f.originalname);
      fs.renameSync(f.path, filePath);

      await prisma.file.create({
        data: {
          originalName: f.originalname,
          storagePath: path.relative(UPLOAD_DIR, filePath),
          mimeType: f.mimetype,
          size: f.size,
          directoryId: directoryId || null,
        },
      });
    }

    // Redirect back to root or to directory if specified
    const redirectPath = directoryId ? `/browser/directory/${directoryId}` : '/';
    res.redirect(redirectPath);
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed');
  }
});

// List all files
router.get('/files', async (req, res) => {
  try {
    const files = await prisma.file.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch files' });
  }
});

// Download file
router.get('/files/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(UPLOAD_DIR, file.storagePath);
    if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'File removed from storage' });

    res.download(filePath, file.originalName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Delete file
router.delete('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(UPLOAD_DIR, file.storagePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.file.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
