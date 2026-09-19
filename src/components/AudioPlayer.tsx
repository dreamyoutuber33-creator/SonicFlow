import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { backgroundService, BackgroundServiceStatus } from '../audio/background-service.ts';
import { AudioTrackMeta } from '../types/audio.ts';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Volume2,
  VolumeX,
  Download,
  Music2,
  Radio,
  ExternalLink,
  Sparkles,
  Trash2,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface AudioPlayerProps {
  currentTrack: AudioTrackMeta | null;
  audioSrc: string | null;
  isPlaying: boolean;
  isCleanActive: boolean;
  onPlayPause: () => void;
  onOpenExportModal: () => void;
  onClearSong: () => void;
  onToggleCleanSong: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  audioSrc,
  isPlaying,
  isCleanActive,
  onPlayPause,
  onOpenExportModal,
  onClearSong,
  onToggleCleanSong,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [seekHoverTime, setSeekHoverTime] = useState<number | null>(null);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);

  // Centralized playback synchronization
  const syncPlayback = useCallback(async (shouldPlay: boolean) => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (shouldPlay) {
      try {
        audioEngine.init(audio);
        await audioEngine.resumeContext();
        await audio.play();
        setIsBuffering(false);
        backgroundService.requestWakeLock();
        audioEngine.notifyPlaybackListeners(true);
      } catch (e: any) {
        console.warn('Playback error (e.g. autoplay restriction):', e?.message || 'Autoplay prevented');
        setIsBuffering(false);
      }
    } else {
      audio.pause();
      backgroundService.releaseWakeLock();
      audioEngine.notifyPlaybackListeners(false);
    }
  }, [audioSrc]);

  // Initialize Web Audio graph on first user mount / audio ref
  useEffect(() => {
    if (audioRef.current) {
      audioEngine.init(audioRef.current);
    }
  }, []);

  // Sync track metadata to engine and media session
  useEffect(() => {
    if (currentTrack) {
      audioEngine.setTrackMetadata(currentTrack);
      if (currentTrack.duration && currentTrack.duration > 0) {
        setDuration(currentTrack.duration);
      }
    }
  }, [currentTrack]);

  // Handle audioSrc change: reset position, initialize duration, and load stream
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioSrc) {
      const currentSrc = audio.getAttribute('src') || audio.src;
      if (currentSrc !== audioSrc && !currentSrc.endsWith(audioSrc)) {
        audio.src = audioSrc;
        audio.load();
      }
      if (currentTrack?.duration) {
        setDuration(currentTrack.duration);
      }
      if (isPlaying) {
        setIsBuffering(true);
        syncPlayback(true);
      }
    } else {
      audio.pause();
      audio.removeAttribute('src');
      setCurrentTime(0);
      setDuration(0);
      setIsBuffering(false);
    }
  }, [audioSrc, isPlaying, syncPlayback]);

  // Handle play / pause trigger from parent + background wake lock
  useEffect(() => {
    syncPlayback(isPlaying);
  }, [isPlaying, syncPlayback]);

  // Sync with lock-screen, notification, or headphone play/pause controls
  useEffect(() => {
    const unsubscribe = audioEngine.onPlaybackChange((playing) => {
      if (playing !== isPlaying) {
        onPlayPause();
      }
    });
    return unsubscribe;
  }, [isPlaying, onPlayPause]);

  // Audio element event listeners
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    audioEngine.updateMediaSessionPositionState();
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (dur && !isNaN(dur) && isFinite(dur)) {
      setDuration(dur);
    } else if (currentTrack?.duration) {
      setDuration(currentTrack.duration);
    }
    audioEngine.applyAllSettings();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Math.min(duration || 99999, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleLoopToggle = () => {
    if (!audioRef.current) return;
    const nextVal = !isLooping;
    setIsLooping(nextVal);
    audioRef.current.loop = nextVal;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    audioEngine.settings.volume = v;
    audioEngine.updateMaster();
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      audioEngine.settings.volume = volume > 0 ? volume : 0.85;
      audioEngine.updateMaster();
    } else {
      setIsMuted(true);
      audioEngine.settings.volume = 0;
      audioEngine.updateMaster();
    }
  };

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || !isFinite(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      id="main-audio-player"
      className="relative rounded-3xl bg-slate-900/80 border border-white/15 p-5 md:p-6 backdrop-blur-2xl shadow-2xl shadow-purple-950/40 overflow-hidden flex flex-col gap-5"
    >
      {/* Hidden audio element bound to Web Audio Engine */}
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        crossOrigin={audioSrc?.startsWith('blob:') ? undefined : 'anonymous'}
        loop={isLooping}
        preload="auto"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onCanPlay={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onPause={() => setIsBuffering(false)}
        onError={() => {
          if (!audioSrc) return;
          const mediaErr = audioRef.current?.error;
          const errMsg = mediaErr
            ? `Media error code ${mediaErr.code}: ${mediaErr.message || 'decode failed'}`
            : 'Audio tag playback error';
          console.warn('Audio playback status:', errMsg);
          setIsBuffering(false);
        }}
        onEnded={() => {
          if (!isLooping && isPlaying) {
            onPlayPause();
          }
        }}
      />

      {/* Ambient background glow from artwork */}
      {currentTrack?.thumbnail && (
        <div
          className="absolute -right-10 -top-10 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${currentTrack.thumbnail})`,
            backgroundSize: 'cover',
          }}
        />
      )}

      {/* Top Player Info Row: Artwork + Track Details + Action Buttons */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Artwork Thumbnail */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl overflow-hidden border border-white/20 shadow-xl shadow-purple-950/60 group">
          {currentTrack?.thumbnail ? (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900 via-slate-900 to-cyan-950 flex items-center justify-center">
              <Music2 className="w-10 h-10 text-purple-300 opacity-60" />
            </div>
          )}

          {/* Buffering or Live Indicator Badge */}
          {isPlaying && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-purple-500/40 text-[10px] font-mono text-purple-300 flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE</span>
            </div>
          )}
        </div>

        {/* Track Title, Artist, and Badges */}
        <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {currentTrack?.isLocal ? 'LOCAL AUDIO' : 'YOUTUBE STREAM'}
            </span>
            
            {/* One-Click Clean Song (No Noise) Quick Toggle */}
            <button
              id="player-clean-song-toggle-btn"
              type="button"
              onClick={onToggleCleanSong}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase border transition-all flex items-center gap-1 cursor-pointer ${
                isCleanActive
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 border-white/10 hover:text-emerald-300'
              }`}
              title="Toggle Audio De-Noiser (Remove background hum, hiss, and noise)"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{isCleanActive ? 'CLEAN (NO NOISE)' : 'CLEAN SONG: OFF'}</span>
            </button>

            {isBuffering && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                BUFFERING...
              </span>
            )}
          </div>

          <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight mt-1 truncate max-w-full">
            {currentTrack?.title || 'No Song Loaded'}
          </h2>

          <p className="text-sm font-medium text-slate-400 mt-0.5 truncate max-w-full">
            {currentTrack?.artist || 'Search a YouTube URL above or pick a demo track'}
          </p>

          <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-500 flex-wrap">
            <span>Rate: {audioEngine.settings.playbackRate.toFixed(2)}x</span>
            <span>•</span>
            <span className={audioEngine.settings.spatialEnabled ? 'text-purple-300 font-semibold' : ''}>
              {audioEngine.settings.spatialDimension || 8}D Spatial: {audioEngine.settings.spatialEnabled ? 'Active' : 'Bypass'}
            </span>
            <span>•</span>
            <span className={isCleanActive ? 'text-emerald-400 font-semibold' : ''}>
              Clean: {isCleanActive ? 'Noise Filtered' : 'Bypass'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Background Playback: Active
            </span>
          </div>
        </div>

        {/* Action Buttons: Clear Song + Export & Download */}
        <div className="flex sm:flex-col items-center gap-2 shrink-0">
          <button
            id="export-download-btn"
            type="button"
            onClick={onOpenExportModal}
            disabled={!audioSrc}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export & Download</span>
          </button>

          {/* Option: Clear Song */}
          <button
            id="clear-song-btn"
            type="button"
            onClick={onClearSong}
            disabled={!currentTrack}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-slate-400 hover:text-rose-300 bg-slate-950/80 hover:bg-rose-950/40 border border-white/10 hover:border-rose-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Clear and eject current song"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear Song</span>
          </button>
        </div>
      </div>

      {/* Scrub Bar / Timeline */}
      <div className="relative z-10 flex flex-col gap-1.5">
        <div className="relative group w-full flex items-center">
          <input
            id="audio-scrub-slider"
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioSrc || duration === 0}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-800/80 accent-purple-400 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #a855f7 0%, #06b6d4 ${progressPercent}%, #1e293b ${progressPercent}%, #1e293b 100%)`,
            }}
          />
        </div>

        {/* Time Labels */}
        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
          <span className="font-semibold text-purple-300">{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Player Controls Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-white/5">
        {/* Left: Loop & Secondary Toggles */}
        <div className="flex items-center gap-2">
          <button
            id="loop-toggle-btn"
            type="button"
            onClick={handleLoopToggle}
            className={`p-2.5 rounded-xl border transition-all ${
              isLooping
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm'
                : 'text-slate-400 hover:text-white border-white/5 bg-slate-950/50'
            }`}
            title="Loop Track"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Rewind, Primary Play/Pause, Forward */}
        <div className="flex items-center gap-3">
          {/* Rewind 10s */}
          <button
            id="skip-back-10-btn"
            type="button"
            onClick={() => handleSkip(-10)}
            disabled={!audioSrc}
            className="p-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-950/60 hover:bg-slate-950 border border-white/5 transition-all disabled:opacity-40"
            title="Rewind 10 Seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            id="play-pause-btn"
            type="button"
            onClick={onPlayPause}
            disabled={!audioSrc}
            className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-xl shadow-purple-600/40 border border-white/20 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            id="skip-fwd-10-btn"
            type="button"
            onClick={() => handleSkip(10)}
            disabled={!audioSrc}
            className="p-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-950/60 hover:bg-slate-950 border border-white/5 transition-all disabled:opacity-40"
            title="Forward 10 Seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Master Volume Slider */}
        <div className="flex items-center gap-2">
          <button
            id="mute-toggle-btn"
            type="button"
            onClick={handleMuteToggle}
            className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-300" />
            )}
          </button>
          <input
            id="master-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 md:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
        </div>
      </div>
    </div>
  );
};
