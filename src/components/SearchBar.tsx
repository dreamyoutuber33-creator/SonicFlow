import React, { useState, useRef } from 'react';
import { Search, Link, Upload, Music, Sparkles, Loader2, Play, AlertCircle } from 'lucide-react';
import { DEMO_TRACKS } from '../data/demo-tracks.ts';
import { AudioTrackMeta, DemoTrack } from '../types/audio.ts';

interface SearchBarProps {
  onSelectTrack: (track: AudioTrackMeta, audioUrl: string, audioBlob?: Blob) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSelectTrack,
  isLoading,
  errorMessage,
  onClearError,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
      }
    } catch (err: any) {
      console.warn('Clipboard read note:', err?.message || 'Permission denied');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;
    onClearError();

    const target = urlInput.trim();
    
    // Call our server API to get info
    try {
      const infoRes = await fetch(`/api/yt/info?url=${encodeURIComponent(target)}`);
      const infoData = await infoRes.json();

      if (!infoRes.ok || infoData.error) {
        throw new Error(infoData.error || 'Failed to extract YouTube info');
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
      console.warn('Fetch note:', err?.message || 'Request failed');
      // If direct API failed, pass to parent so it displays clear error with fallback
      onSelectTrack(
        {
          id: 'yt-error',
          title: 'YouTube Track',
          artist: 'YouTube Audio',
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

  const handleFileUpload = (file: File) => {
    onClearError();
    const objectUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    
    onSelectTrack(
      {
        id: `local-${Date.now()}`,
        title: cleanName,
        artist: 'Local Audio File',
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
        handleFileUpload(file);
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Search Bar Container */}
      <div className="w-full max-w-3xl">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center rounded-2xl bg-slate-900/80 border border-white/15 p-2 shadow-2xl shadow-purple-950/40 backdrop-blur-2xl transition-all focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20"
        >
          <div className="pl-3 pr-2 text-slate-400">
            <Search className="w-5 h-5" />
          </div>

          <input
            id="youtube-url-input"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste any YouTube link (e.g., https://youtu.be/... or music video URL)"
            className="w-full bg-transparent py-2 px-1 text-sm md:text-base text-slate-100 placeholder:text-slate-500 focus:outline-none font-sans"
          />

          {/* Quick Paste Button */}
          <button
            id="paste-url-btn"
            type="button"
            onClick={handlePaste}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-white/5 transition-all mr-2 shrink-0"
            title="Paste from clipboard"
          >
            <Link className="w-3.5 h-3.5" />
            <span>Paste</span>
          </button>

          {/* Extract & Load Button */}
          <button
            id="fetch-audio-btn"
            type="submit"
            disabled={isLoading || !urlInput.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-purple-500 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Load Audio</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="w-full max-w-3xl p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold">{errorMessage}</span>
            <p className="text-slate-400 mt-1">
              Tip: You can instantly select any of the curated Studio Tracks below or drag & drop any MP3/WAV file from your computer!
            </p>
          </div>
          <button
            onClick={onClearError}
            className="text-rose-400 hover:text-white text-xs font-mono ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Launch Studio Presets & Local Upload Bar */}
      <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Curated Demo Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono font-semibold mr-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>STUDIO DEMOS:</span>
          </div>

          {DEMO_TRACKS.map((demo) => (
            <button
              key={demo.id}
              id={`demo-chip-${demo.id}-btn`}
              type="button"
              onClick={() => handleDemoSelect(demo)}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/70 hover:bg-purple-950/40 border border-white/10 hover:border-purple-500/40 text-xs text-slate-300 hover:text-white transition-all shadow-sm"
            >
              <Play className="w-3 h-3 text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">{demo.title.split('(')[0]}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                {demo.tag}
              </span>
            </button>
          ))}
        </div>

        {/* Local File Upload Drag Target */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
            isDragging
              ? 'bg-purple-600/30 border-purple-400 text-purple-200 ring-2 ring-purple-500/50'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
          }`}
          title="Or upload an MP3/WAV file from your computer"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Upload Audio File</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
