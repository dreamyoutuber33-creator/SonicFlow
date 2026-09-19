import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { extractYouTubeId, fetchVideoMetadata, streamYouTubeAudio } from './yt-service.js';
import { Readable } from 'stream';

function serveLocalFile(filePath: string, req: IncomingMessage, res: ServerResponse): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const range = req.headers.range;

    const mime = filePath.endsWith('.wav')
      ? 'audio/wav'
      : filePath.endsWith('.ogg')
      ? 'audio/ogg'
      : 'audio/mpeg';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize || (end && end >= totalSize) || start > end) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        res.end();
        return true;
      }

      const chunkSize = end - start + 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunkSize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', (err) => {
        console.error('File stream error:', err);
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
      stream.pipe(res);
      return true;
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Length', totalSize);
      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        console.error('File stream error:', err);
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
      stream.pipe(res);
      return true;
    }
  } catch (err) {
    console.error('serveLocalFile error:', err);
    return false;
  }
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  // 0. Audio files direct serving: /audio/* or /api/audio/*
  if (pathname.startsWith('/audio/') || pathname.startsWith('/api/audio/')) {
    const filename = path.basename(pathname);
    const publicAudioPath = path.join(process.cwd(), 'public', 'audio', filename);
    if (serveLocalFile(publicAudioPath, req, res)) {
      return true;
    }
    const directPublicPath = path.join(process.cwd(), 'public', pathname.replace(/^\/api/, ''));
    if (serveLocalFile(directPublicPath, req, res)) {
      return true;
    }
  }

  // 1. Video Info Endpoint: /api/yt/info?url=... or /api/yt/info?id=...
  if (pathname === '/api/yt/info') {
    const rawUrl = urlObj.searchParams.get('url') || urlObj.searchParams.get('id') || '';
    const videoId = extractYouTubeId(rawUrl);

    if (!videoId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid or missing YouTube URL / Video ID' }));
      return true;
    }

    try {
      const meta = await fetchVideoMetadata(videoId);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(meta));
    } catch (err: any) {
      console.error('API /yt/info error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Failed to fetch video information' }));
    }
    return true;
  }

  // 2. Audio Stream Endpoint: /api/yt/stream?id=... or /api/yt/stream?url=...
  // Powered by yt-dlp child-process stream with standard MP3 chunking and HTTP 206 Partial Content
  if (pathname === '/api/yt/stream') {
    const rawUrl = urlObj.searchParams.get('url') || urlObj.searchParams.get('id') || '';
    const videoId = extractYouTubeId(rawUrl);

    if (!videoId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid or missing YouTube video ID' }));
      return true;
    }

    try {
      await streamYouTubeAudio(videoId, req, res);
    } catch (err: any) {
      console.error('API /yt/stream error:', err);
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Could not stream YouTube audio. Please try another link, drop a local MP3/WAV file, or select a studio demo track.'
        }));
      }
    }
    return true;
  }

  // 3. Audio Proxy for CORS external audio loading: /api/proxy-audio?url=...
  if (pathname === '/api/proxy-audio') {
    const targetUrl = urlObj.searchParams.get('url');
    if (!targetUrl) {
      res.statusCode = 400;
      res.end('Missing url parameter');
      return true;
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (!response.ok || !response.body) {
        res.statusCode = response.status;
        res.end('Failed to proxy audio');
        return true;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Accept-Ranges', 'bytes');
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
      return true;
    } catch (err: any) {
      res.statusCode = 500;
      res.end(err.message || 'Proxy error');
      return true;
    }
  }

  return false;
}
