import React, { useState } from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { AudioTrackMeta } from '../types/audio.ts';
import { X, Download, Disc, Sparkles, CheckCircle2, AlertCircle, Loader2, Mic } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrackMeta | null;
  audioSrc: string | null;
  audioBlob?: Blob;
  isPlaying: boolean;
  onStartPlaying: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  audioSrc,
  audioBlob,
  isPlaying,
  onStartPlaying,
}) => {
  const [exportFormat, setExportFormat] = useState<'wav' | 'live-record'>('wav');
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live recording state
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  if (!isOpen) return null;

  const sanitizeFilename = (title: string, ext: string) => {
    const clean = title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    return `${clean}_8D_Mastered.${ext}`;
  };

  const handleStartOfflineRender = async () => {
    if (!audioSrc && !audioBlob) return;
    setIsRendering(true);
    setRenderProgress(5);
    setErrorMessage(null);
    setDownloadUrl(null);

    try {
      // If audioBlob is passed (local upload), use that directly; otherwise use audioSrc (URL)
      const source = audioBlob || audioSrc!;
      const wavBlob = await audioEngine.exportRenderedWav(source, (pct) => {
        setRenderProgress(pct);
      });

      const url = URL.createObjectURL(wavBlob);
      setExportedBlob(wavBlob);
      setDownloadUrl(url);
    } catch (err: any) {
      console.warn('Offline render note:', err?.message || 'Render failed');
      setErrorMessage(
        err.message ||
        'Direct offline rendering could not decode the remote stream (likely due to CORS or stream chunking). You can use Live Audio Capture below to record the audio stream in real-time!'
      );
    } finally {
      setIsRendering(false);
    }
  };

  const handleToggleLiveRecording = async () => {
    if (isLiveRecording) {
      try {
        const blob = await audioEngine.stopLiveRecording();
        const url = URL.createObjectURL(blob);
        setExportedBlob(blob);
        setDownloadUrl(url);
        setIsLiveRecording(false);
      } catch (err: any) {
        setErrorMessage(err.message || 'Live recording failed');
        setIsLiveRecording(false);
      }
    } else {
      setErrorMessage(null);
      setDownloadUrl(null);
      setLiveSeconds(0);
      try {
        if (!isPlaying) {
          onStartPlaying();
        }
        audioEngine.startLiveRecording();
        setIsLiveRecording(true);

        const interval = setInterval(() => {
          setLiveSeconds((prev) => {
            if (!audioEngine.isRecording()) {
              clearInterval(interval);
              return prev;
            }
            return prev + 1;
          });
        }, 1000);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to start recording');
      }
    }
  };

  const triggerDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    const ext = exportFormat === 'wav' ? 'wav' : 'webm';
    a.download = sanitizeFilename(currentTrack?.title || 'YouTube_Audio', ext);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      id="export-audio-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-white/15 p-6 shadow-2xl shadow-purple-950/80 flex flex-col gap-5 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 shadow-lg shadow-purple-600/30">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight text-white">
                Export & Download Audio
              </h3>
              <p className="text-xs text-slate-400">
                Render all applied 8D spatial motion, reverb, and EQ directly into audio
              </p>
            </div>
          </div>

          <button
            id="close-export-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Track Metadata Pill */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-white/5">
          <img
            src={currentTrack?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200'}
            alt=""
            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate">{currentTrack?.title}</h4>
            <p className="text-xs text-slate-400 truncate">{currentTrack?.artist}</p>
          </div>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950/80 border border-white/10">
          <button
            id="format-wav-tab"
            type="button"
            onClick={() => { setExportFormat('wav'); setDownloadUrl(null); }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              exportFormat === 'wav'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio Master (WAV Lossless)</span>
          </button>
          <button
            id="format-live-tab"
            type="button"
            onClick={() => { setExportFormat('live-record'); setDownloadUrl(null); }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              exportFormat === 'live-record'
                ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Live Stream Capture</span>
          </button>
        </div>

        {/* Active Engine Settings Summary */}
        <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 text-xs flex flex-col gap-1.5 font-mono">
          <div className="text-slate-400 font-bold tracking-wider uppercase text-[10px]">DSP Effects Baked In:</div>
          <div className="grid grid-cols-2 gap-1 text-slate-300 text-[11px]">
            <div>• {audioEngine.settings.spatialDimension || 8}D Spatial: <span className="text-purple-300">{audioEngine.settings.spatialEnabled ? `${audioEngine.settings.spatialDimension || 8}D ${audioEngine.settings.spatialPattern} (${audioEngine.settings.spatialSpeed}s)` : 'Bypass'}</span></div>
            <div>• Slowed: <span className="text-cyan-300">{audioEngine.settings.playbackRate.toFixed(2)}x tempo</span></div>
            <div>• Reverb: <span className="text-pink-300">{audioEngine.settings.reverbEnabled ? `${audioEngine.settings.reverbPreset} (${Math.round(audioEngine.settings.reverbWet * 100)}% wet)` : 'Disabled'}</span></div>
            <div>• EQ: <span className="text-amber-300">{audioEngine.settings.eqEnabled ? `5-Band (+${audioEngine.settings.bassBoost} Bass)` : 'Flat'}</span></div>
            <div className="col-span-2">• Clean & De-Noise: <span className="text-emerald-300">{audioEngine.settings.denoiseEnabled ? `Active (Zero Noise, ${audioEngine.settings.denoiseIntensity}% intensity)` : 'Bypass'}</span></div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Section */}
        {exportFormat === 'wav' ? (
          <div className="flex flex-col gap-3">
            {!downloadUrl ? (
              <button
                id="render-wav-btn"
                type="button"
                onClick={handleStartOfflineRender}
                disabled={isRendering}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 via-purple-500 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Rendering DSP Graph ({renderProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Render & Generate Lossless WAV</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mastered Audio Ready for Download!</span>
                </div>
                <button
                  id="save-rendered-wav-btn"
                  type="button"
                  onClick={triggerDownload}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-xl shadow-emerald-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>Save WAV File to Device</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">
              Captures the ongoing audio stream directly from the Web Audio DSP output in real time. Perfect for YouTube live streams or longer sessions.
            </p>

            <button
              id="toggle-live-record-btn"
              type="button"
              onClick={handleToggleLiveRecording}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isLiveRecording
                  ? 'bg-rose-600 hover:bg-rose-500 animate-pulse shadow-lg shadow-rose-950/60'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-950/60'
              }`}
            >
              {isLiveRecording ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                  <span>Stop Recording ({liveSeconds}s)</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Start Live Recording Stream</span>
                </>
              )}
            </button>

            {downloadUrl && !isLiveRecording && (
              <button
                id="save-recorded-stream-btn"
                type="button"
                onClick={triggerDownload}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Save Recorded Audio File</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
