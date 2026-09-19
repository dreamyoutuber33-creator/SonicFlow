import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApiRequest } from './server/api-handler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// API & audio routes handled directly
app.use(async (req, res, next) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/audio/')) {
    try {
      const handled = await handleApiRequest(req, res);
      if (handled) return;
    } catch (err) {
      console.error('API server error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
      return;
    }
  }
  next();
});

// Serve static assets from public and dist if built
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YouTube Audio Studio server running on port ${PORT}`);
});
