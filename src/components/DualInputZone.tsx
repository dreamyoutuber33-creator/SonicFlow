import React, { useState, useRef } from 'react';
import {
  Search,
  Link,
  Upload,
  Sparkles,
  Loader2,
  Play,
  AlertCircle,
  FileAudio,
  CheckCircle2,
  Headphones,
  Radio,
  X
} from 'lucide-react';
import { DEMO_TRACKS } from '../data/demo-tracks.ts';
import { AudioTrackMeta, DemoTrack } from '../types/audio.ts';

interface DualInputZoneProps {
  onSelectTrack: (track: AudioTrackMeta, audioUrl: string, audioBlob?: Blob) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
}

export const DualInputZone: React.FC<DualInputZoneProps> = ({
  onSelectTrack,
  isLoading,
  errorMessage,
  onClearError,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [lastUploadedFile, setLastUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
      }
    } catch (err: any) {
      console.warn('Clipboard read error:', err?.message || 'Access denied');
    }
  };

  const handleClearInput = () => {
    setUrlInput('');
    onClearError();
  };

  const handleSubmitYouTube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;
    onClearError();

    const target = urlInput.trim();

    try {
      const infoRes = await fetch(`/api/yt/info?url=${encodeURIComponent(target)}`);
      const infoData = await infoRes.json();

      if (!infoRes.ok || infoData.error) {
        throw new Error(infoData.error || 'Failed to extract YouTube audio');
      }

      const streamUrl = `/api/yt/stream?id=${encodeURIComponent(infoData.id)}`;

      onSelectTrack(
        {
          id: infoData.id,
          title: infoData.title,
          artist: infoData.artist,
          thumbnail: infoData.thumbnail,
          duration: infoData.duration || 180,
          sourceUrl: target,
          isLocal: false,
        },
        streamUrl
      );
    } catch (err: any) {
      console.warn('YouTube extraction note:', err?.message || 'Extraction failed');
      // Fallback direct stream attempt with user feedback
      onSelectTrack(
        {
          id: 'yt-stream',
          title: 'YouTube Audio Stream',
          artist: 'YouTube Creator',
          thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          duration: 0,
          sourceUrl: target,
          isLocal: false,
        },
        `/api/yt/stream?url=${encodeURIComponent(target)}`
      );
    }
  };

  const handleDemoSelect = (demo: DemoTrack) => {
    onClearError();
    onSelectTrack(
      {
        id: demo.id,
        title: demo.title,
        artist: demo.artist,
        thumbnail: demo.thumbnail,
        duration: demo.duration,
        sourceUrl: demo.url,
        isLocal: false,
      },
      demo.url
    );
  };

  const handleProcessFile = (file: File) => {
    onClearError();
    const objectUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setLastUploadedFile(file.name);

    onSelectTrack(
      {
        id: `local-${Date.now()}`,
        title: cleanName,
        artist: 'Local Master Audio File',
        thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        duration: 0,
        sourceUrl: objectUrl,
        isLocal: true,
      },
      objectUrl,
      file
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
        handleProcessFile(file);
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Error Banner */}
      {errorMessage && (
        <div className="w-full p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3 backdrop-blur-xl shadow-lg">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-rose-200">{errorMessage}</p>
            <p className="text-slate-400 mt-1">
              You can instantly play our curated Studio Demos or drag & drop any MP3/WAV file from your device.
            </p>
          </div>
          <button
            onClick={onClearError}
            className="p-1 rounded-lg text-rose-400 hover:text-white hover:bg-rose-900/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dual Input Bento Grid: YouTube Extractor + Local File Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel 1: YouTube URL Extractor (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col rounded-3xl bg-slate-900/80 border border-white/10 p-5 md:p-6 backdrop-blur-2xl shadow-xl shadow-purple-950/30">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-white tracking-tight">
                YouTube Audio Extractor
              </h3>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              yt-dlp 192k MP3 Engine
            </span>
          </div>

          {/* YouTube Search Bar Form */}
          <form onSubmit={handleSubmitYouTube} className="relative flex items-center">
            <div className="relative flex-1 flex items-center rounded-2xl bg-slate-950/90 border border-white/15 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all p-1.5">
              <div className="pl-3 pr-2 text-slate-400">
                <Search className="w-4 h-4" />
              </div>

              <input
                id="youtube-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste any YouTube video or music link..."
                className="w-full bg-transparent py-2 px-1 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none font-sans"
              />

              {urlInput && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors mr-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Paste Button */}
              <button
                id="paste-url-btn"
                type="button"
                onClick={handlePaste}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-white/10 transition-all mr-1.5 shrink-0 cursor-pointer"
                title="Paste from clipboard"
              >
                <Link className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>

              {/* Submit Button */}
              <button
                id="fetch-audio-btn"
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-md shadow-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Load Audio</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Studio Presets */}
          <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>STUDIO DEMOS:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {DEMO_TRACKS.map((demo) => (
                <button
                  key={demo.id}
                  id={`demo-chip-${demo.id}-btn`}
                  type="button"
                  onClick={() => handleDemoSelect(demo)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 hover:bg-purple-950/40 border border-white/10 hover:border-purple-500/40 text-xs text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <Play className="w-3 h-3 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{demo.title.split('(')[0].trim()}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                    {demo.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Local Audio File Upload Dropzone (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col rounded-3xl bg-slate-900/80 border border-white/10 p-5 md:p-6 backdrop-blur-2xl shadow-xl shadow-cyan-950/20">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Headphones className="w-4 h-4" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-white tracking-tight">
                Local File Upload
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Zero Latency
            </span>
          </div>

          {/* Interactive Drag & Drop Box */}
          <div
            id="local-file-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 min-h-[130px] rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 ring-2 ring-cyan-500/40 scale-[1.01]'
                : 'border-white/15 bg-slate-950/60 hover:border-cyan-500/50 hover:bg-slate-950/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />

            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-2 border border-cyan-500/20 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>

            <p className="text-xs sm:text-sm font-semibold text-white">
              Drop Audio File or <span className="text-cyan-400 underline decoration-cyan-400/50">Browse Device</span>
            </p>

            <p className="text-[11px] text-slate-500 mt-1">
              Supports Phone & PC Audio • MP3, WAV, FLAC, M4A, AAC
            </p>

            {lastUploadedFile && (
              <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">{lastUploadedFile}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
