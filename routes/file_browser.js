import express from 'express';

const router = express.Router();

// homepage — list directories
router.get('/', async (req, res) => {
  try {
    const resp = await fetch('http://localhost:4000/api/files');
    const files = await resp.json();

    const dirResp = await fetch('http://localhost:4000/api/directory/ROOT_ID'); // optional if you track top-level dirs
    const directories = dirResp.ok ? await dirResp.json() : [];

    res.render('index', { title: 'File Browser', files, directories });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load data' });
  }
});

// upload page
router.get('/upload', async (req, res) => {
  res.render('upload', { title: 'Upload Files' });
});

// directory view
router.get('/directory/:id', async (req, res) => {
  try {
    const resp = await fetch(`http://localhost:4000/api/directory/${req.params.id}`);
    const data = await resp.json();
    if (!data.success) return res.status(404).render('error', { message: 'Directory not found' });

    res.render('directory', { title: data.directory.name, directory: data.directory });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load directory' });
  }
});

export default router;
