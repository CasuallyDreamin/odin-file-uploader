import express from 'express';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { UPLOAD_DIR } from '../app.js';

const router = express.Router();
const API_BASE = 'http://localhost:4000/api';

/* ------------------------------
   Helper: fetch top-level directories
--------------------------------*/
async function getTopDirectories() {
  try {
    const resp = await axios.get(`${API_BASE}/directories/top`);
    return resp.data.success ? resp.data.directories : [];
  } catch (err) {
    console.error('Failed fetching top directories:', err.message);
    return [];
  }
}

// Helper: flatten directories recursively
async function getAllDirectories() {
  try {
    const resp = await axios.get(`${API_BASE}/directories/top`);
    const topDirs = resp.data.success ? resp.data.directories : [];

    const flatList = [];

    function traverse(dir, prefix = '') {
      flatList.push({ id: dir.id, name: prefix + dir.name });
      if (dir.children) {
        dir.children.forEach(child => traverse(child, prefix + dir.name + '/'));
      }
    }

    topDirs.forEach(d => traverse(d));
    return flatList;
  } catch (err) {
    console.error('Failed fetching all directories:', err.message);
    return [];
  }
}


/* ------------------------------
   Homepage — list top-level directories & recent files
--------------------------------*/
router.get('/', async (req, res) => {
  try {
    const filesResp = await axios.get(`${API_BASE}/files`);
    const files = filesResp.data;

    const directories = await getTopDirectories();

    res.render('index', { title: 'File Browser', files, directories });
  } catch (err) {
    console.error('Failed fetching homepage data:', err.message);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load data' });
  }
});

/* ------------------------------
   Directory view
--------------------------------*/
router.get('/directory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resp = await axios.get(`${API_BASE}/directory/${id}`);
    const data = resp.data;

    if (!data.success) return res.status(404).render('error', { title: 'Error', message: 'Directory not found' });

    res.render('directory', { title: data.directory.name, directory: data.directory });
  } catch (err) {
    console.error(err.message);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load directory' });
  }
});

/* ------------------------------
   Upload page
--------------------------------*/
router.get('/upload', async (req, res) => {
  try {
    const directories = await getAllDirectories();
    res.render('upload', { title: 'Upload Files', directories });
  } catch (err) {
    console.error(err.message);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load upload page' });
  }
});

/* ------------------------------
   POST Create new directory — redirects back
--------------------------------*/
router.post('/directory', async (req, res) => {
  try {
    const { name, parentId } = req.body;
    await axios.post(`${API_BASE}/directory`, { name, parentId: parentId || null });

    const redirectPath = parentId ? `/browser/directory/${parentId}` : '/browser';
    res.redirect(redirectPath);
  } catch (err) {
    console.error(err.message);
    res.status(500).render('error', { title: 'Error', message: 'Failed to create directory' });
  }
});

/* ------------------------------
   POST Upload files — redirects back
--------------------------------*/
router.post('/upload', async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).render('error', { title: 'Error', message: 'No files selected' });
    }

    const { directoryId } = req.body;
    const formData = new FormData();

    for (const f of req.files) {
      formData.append('files', fs.createReadStream(f.path), f.originalname);
    }

    if (directoryId) formData.append('directoryId', directoryId);

    await axios.post(`${API_BASE}/upload`, formData, { headers: formData.getHeaders() });

    const redirectPath = directoryId ? `/browser/directory/${directoryId}` : '/browser';
    res.redirect(redirectPath);
  } catch (err) {
    console.error(err.message);
    res.status(500).render('error', { title: 'Error', message: 'Upload failed' });
  }
});

export default router;
