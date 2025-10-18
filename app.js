import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import apiRoutes from './routes/api.js';
import fileBrowserRoutes from './routes/file_browser.js';
import { PrismaClient } from '@prisma/client';

dotenv.config();

export const prisma = new PrismaClient(); // export for route modules

const app = express();
app.use(express.json());

// Ensure uploads directory exists
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Mount routes
app.use("/", fileBrowserRoutes);
app.use('/api', apiRoutes);
app.use('/browser', fileBrowserRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
