import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';

// Verify and determine yt-dlp path
const YTDLP_BIN = fs.existsSync('/usr/local/bin/yt-dlp') ? '/usr/local/bin/yt-dlp' : 'yt-dlp';
const CACHE_DIR = '/tmp/yt-audio-cache';

if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create cache dir:', err);
  }
}

// In-flight caching promises to prevent duplicate download tasks for the same video
const activeCachingTasks = new Map<string, Promise<string>>();

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Match standard youtube urls (youtube.com/watch?v=, youtu.be/, shorts/, embed/, music.youtube.com)
  const regExp = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

export interface VideoMeta {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // in seconds
  durationFormatted: string;
  views?: string;
}

/**
 * Fetch video metadata using fast oEmbed + yt-dlp JSON dump
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMeta> {
  let title = 'YouTube Track';
  let artist = 'YouTube Creator';
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let duration = 0;

  // 1. Ultra-fast oEmbed fetch (<200ms) guarantees instant title, author, and base thumbnail
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      if (oembed.title) title = oembed.title;
      if (oembed.author_name) artist = oembed.author_name;
      if (oembed.thumbnail_url) thumbnail = oembed.thumbnail_url;
    }
  } catch (e) {
    console.warn('oEmbed fetch error:', e);
  }

  // 2. Fetch duration & high-res metadata via yt-dlp -j in non-blocking timeout
  try {
    const jsonMeta = await new Promise<any>((resolve, reject) => {
      const proc = spawn(YTDLP_BIN, [
        '--no-warnings',
        '--no-playlist',
        '--dump-json',
        `https://www.youtube.com/watch?v=${videoId}`
      ]);

      let stdoutData = '';
      let stderrData = '';
      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
        reject(new Error('yt-dlp metadata timeout'));
      }, 6000);

      proc.stdout.on('data', (c) => (stdoutData += c.toString()));
      proc.stderr.on('data', (c) => (stderrData += c.toString()));

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdoutData.trim()) {
          try {
            resolve(JSON.parse(stdoutData.trim()));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(stderrData || `yt-dlp exited with code ${code}`));
        }
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    if (jsonMeta.title) title = jsonMeta.title;
    if (jsonMeta.uploader || jsonMeta.channel) artist = jsonMeta.uploader || jsonMeta.channel;
    if (typeof jsonMeta.duration === 'number') duration = jsonMeta.duration;
    if (jsonMeta.thumbnail) thumbnail = jsonMeta.thumbnail;
  } catch (err: any) {
    console.warn('yt-dlp metadata fetch warning (using oEmbed metadata):', err?.message);
  }

  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  const durationFormatted = duration > 0 ? `${mins}:${secs < 10 ? '0' : ''}${secs}` : '--:--';

  // Trigger background caching immediately so audio is ready or buffering ahead
  startBackgroundAudioCache(videoId).catch((e) => {
    console.warn('Background caching hint:', e?.message);
  });

  return {
    id: videoId,
    title,
    artist,
    thumbnail,
    duration,
    durationFormatted,
  };
}

/**
 * Cache audio to disk as high-quality MP3 (192kbps)
 */
export function startBackgroundAudioCache(videoId: string): Promise<string> {
  const targetPath = path.join(CACHE_DIR, `${videoId}.mp3`);

  // If already cached and valid size (>50KB)
  if (fs.existsSync(targetPath)) {
    try {
      const stats = fs.statSync(targetPath);
      if (stats.size > 50000) {
        return Promise.resolve(targetPath);
      }
    } catch {}
  }

  // If a download task is currently running
  const existing = activeCachingTasks.get(videoId);
  if (existing) {
    return existing;
  }

  const task = new Promise<string>((resolve, reject) => {
    const tempPath = path.join(CACHE_DIR, `${videoId}.tmp.mp3`);
    
    // yt-dlp pipes best audio directly to ffmpeg to encode standard MP3
    const ytdlp = spawn(YTDLP_BIN, [
      '--no-warnings',
      '--no-playlist',
      '-f', 'bestaudio/best',
      '-o', '-',
      `https://www.youtube.com/watch?v=${videoId}`
    ]);

    const ffmpeg = spawn('ffmpeg', [
      '-loglevel', 'quiet',
      '-i', 'pipe:0',
      '-f', 'mp3',
      '-acodec', 'libmp3lame',
      '-b:a', '192k',
      'pipe:1'
    ]);

    ytdlp.stdout.pipe(ffmpeg.stdin);

    const outStream = fs.createWriteStream(tempPath);
    ffmpeg.stdout.pipe(outStream);

    let failed = false;
    const handleError = (err: any) => {
      if (failed) return;
      failed = true;
      try { ytdlp.kill('SIGKILL'); } catch {}
      try { ffmpeg.kill('SIGKILL'); } catch {}
      try { fs.unlinkSync(tempPath); } catch {}
      activeCachingTasks.delete(videoId);
      reject(err);
    };

    ytdlp.on('error', handleError);
    ffmpeg.on('error', handleError);

    outStream.on('error', handleError);

    outStream.on('finish', () => {
      if (failed) return;
      try {
        if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 10000) {
          fs.renameSync(tempPath, targetPath);
          activeCachingTasks.delete(videoId);
          resolve(targetPath);
        } else {
          handleError(new Error('Audio file was too small or empty'));
        }
      } catch (err) {
        handleError(err);
      }
    });
  });

  activeCachingTasks.set(videoId, task);
  return task;
}

/**
 * Streams YouTube audio with proper chunked headers and HTTP 206 Partial Content byte ranges.
 * This completely fixes the 00:00 stuck player bug!
 */
export async function streamYouTubeAudio(
  videoId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const targetPath = path.join(CACHE_DIR, `${videoId}.mp3`);

  // Common CORS and streaming headers
  const setCommonHeaders = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
  };

  // 1. Check if file is already cached on disk or in public audio directory
  const publicAudioPath = path.join(process.cwd(), 'public', 'audio', `${videoId}.mp3`);
  const publicDemoPath = path.join(process.cwd(), 'public', 'audio', `${videoId.replace(/^demo-/, '')}.mp3`);
  const resolvedPath = fs.existsSync(targetPath)
    ? targetPath
    : fs.existsSync(publicAudioPath)
    ? publicAudioPath
    : fs.existsSync(publicDemoPath)
    ? publicDemoPath
    : null;

  if (resolvedPath) {
    try {
      const stats = fs.statSync(resolvedPath);
      const totalSize = stats.size;

      if (totalSize > 5000) {
        setCommonHeaders();
        res.setHeader('Cache-Control', 'public, max-age=86400');

        const range = req.headers.range;
        if (range) {
          // Parse bytes=start-end
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

          if (isNaN(start) || start >= totalSize || (end && end >= totalSize) || start > end) {
            res.statusCode = 416; // Requested Range Not Satisfiable
            res.setHeader('Content-Range', `bytes */${totalSize}`);
            res.end();
            return;
          }

          const chunkSize = end - start + 1;
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          res.setHeader('Content-Length', chunkSize);

          const readStream = fs.createReadStream(resolvedPath, { start, end });
          readStream.on('error', (err) => {
            console.error('ReadStream error:', err);
            if (!res.headersSent) res.statusCode = 500;
            res.end();
          });
          readStream.pipe(res);
          return;
        } else {
          // No range requested: Send full file with total length
          res.statusCode = 200;
          res.setHeader('Content-Length', totalSize);
          const readStream = fs.createReadStream(resolvedPath);
          readStream.on('error', (err) => {
            console.error('ReadStream error:', err);
            if (!res.headersSent) res.statusCode = 500;
            res.end();
          });
          readStream.pipe(res);
          return;
        }
      }
    } catch (e) {
      console.warn('Error reading cached audio file, falling back to live stream:', e);
    }
  }

  // 2. File not yet cached: Stream LIVE from yt-dlp + ffmpeg while simultaneously writing to disk cache
  const tempPath = path.join(CACHE_DIR, `${videoId}.tmp.mp3`);
  let outStream: fs.WriteStream | null = null;
  try {
    outStream = fs.createWriteStream(tempPath);
  } catch (e) {
    console.warn('Could not create temp file stream:', e);
  }

  const ytdlp = spawn(YTDLP_BIN, [
    '--no-warnings',
    '--no-playlist',
    '-f', 'bestaudio/best',
    '-o', '-',
    `https://www.youtube.com/watch?v=${videoId}`
  ]);

  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-f', 'mp3',
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    'pipe:1'
  ]);

  ytdlp.stdout.pipe(ffmpeg.stdin);

  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try { ytdlp.kill('SIGKILL'); } catch {}
    try { ffmpeg.kill('SIGKILL'); } catch {}
    if (outStream) {
      try { outStream.end(); } catch {}
    }
  };

  req.on('close', () => {
    if (!res.writableEnded) {
      cleanup();
    }
  });

  let headersSent = false;
  let hasReceivedData = false;

  ffmpeg.stdout.on('data', (chunk: Buffer) => {
    hasReceivedData = true;
    if (!headersSent) {
      headersSent = true;
      setCommonHeaders();
      res.statusCode = 200;
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.write(chunk);
    if (outStream && !outStream.destroyed) {
      outStream.write(chunk);
    }
  });

  ffmpeg.stdout.on('end', () => {
    if (!hasReceivedData) {
      // Failed to extract audio bytes (e.g. YouTube bot detection or dead video)
      cleanup();
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'YouTube audio extraction is currently restricted for this URL by bot detection. Please select one of our studio demo tracks or drag & drop any local audio file!'
        }));
      }
    } else {
      res.end();
      if (outStream) {
        outStream.end();
      }
    }
  });

  ytdlp.on('error', (err) => {
    console.error('yt-dlp process error:', err);
    cleanup();
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to extract audio from YouTube' }));
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('ffmpeg process error:', err);
    cleanup();
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to encode audio stream' }));
    }
  });

  ffmpeg.on('close', (code) => {
    if (code === 0 && hasReceivedData) {
      try {
        if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 20000) {
          fs.renameSync(tempPath, targetPath);
        }
      } catch (err) {
        console.warn('Could not finalize cache file:', err);
      }
    }
  });
}
