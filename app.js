import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const UPLOAD_DIR = process.env.UPLOAD_DIR 
  ? path.resolve(process.env.UPLOAD_DIR) 
  : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${timestamp}_${safeName}`);
    }
});

const upload = multer({ storage });

app.post('/upload', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.'});
        }
        const created = [];
        for (const f of req.files) {
            const record = await prisma.file.create({
                data: {
                    originalName: f.originalname,
                    storagePath: f.filename,
                    mimeType: f.mimetype,
                    size: f.size
                }
            });
        created.push(record);
        }
        res.json({ success: true, files: created })
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed'});
    }
});

app.get('/files', async (req, res) => {
    try {
        const files = await prisma.file.findMany({ orderBy: { uploadedAt: 'desc'} });
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not fetch files' });
    }
});

app.get('/files/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const file = await prisma.file.findUnique({ where: { id }});
        if (!file) return res.status(404).json({ error: 'File not found'});

        const filePath = path.join(UPLOAD_DIR, file.storagePath);
        if (!fs.existsSync(filePath)) {
            return res.status(410).json({ error: 'File removed from storage'});
        }
        console.log("Trying to Download: ", filePath);
        res.download(filePath, file.originalName);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Download failed'});
    }
});

app.delete('/files/:id', async (req, res) => {
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

app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true, db: 'connected'});
    } catch (err) {
        res.status(500).json({ ok: false, db: 'down'});
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
