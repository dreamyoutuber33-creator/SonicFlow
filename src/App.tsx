import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DualInputZone } from './components/DualInputZone.tsx';
import { AudioPlayer } from './components/AudioPlayer.tsx';
import { VisualizerCanvas } from './components/VisualizerCanvas.tsx';
import { AudioCleanerPanel } from './components/AudioCleanerPanel.tsx';
import { SpatialPannerPanel } from './components/SpatialPannerPanel.tsx';
import { SlowedReverbPanel } from './components/SlowedReverbPanel.tsx';
import { EqualizerPanel } from './components/EqualizerPanel.tsx';
import { MasteringPanel } from './components/MasteringPanel.tsx';
import { BackgroundServicePanel } from './components/BackgroundServicePanel.tsx';
import { ExportModal } from './components/ExportModal.tsx';
import { DEMO_TRACKS } from './data/demo-tracks.ts';
import { audioEngine } from './audio/audio-engine.ts';
import { AudioTrackMeta, AudioEngineSettings } from './types/audio.ts';
import { Sliders, Sparkles, Disc3, Layers } from 'lucide-react';

export default function App() {
  // Preload first demo track so the user can immediately experience the DAW
  const [currentTrack, setCurrentTrack] = useState<AudioTrackMeta | null>({
    id: DEMO_TRACKS[0].id,
    title: DEMO_TRACKS[0].title,
    artist: DEMO_TRACKS[0].artist,
    thumbnail: DEMO_TRACKS[0].thumbnail,
    duration: DEMO_TRACKS[0].duration,
    sourceUrl: DEMO_TRACKS[0].url,
    isLocal: false,
  });
  const [audioSrc, setAudioSrc] = useState<string | null>(DEMO_TRACKS[0].url);
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Synced engine settings state
  const [settings, setSettings] = useState<AudioEngineSettings>(() => ({
    ...audioEngine.settings,
  }));

  const handleUpdateSettings = (newSettings: Partial<AudioEngineSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleSelectTrack = (track: AudioTrackMeta, url: string, blob?: Blob) => {
    setCurrentTrack(track);
    setAudioSrc(url);
    setAudioBlob(blob);
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    if (!audioSrc) return;
    setIsPlaying((prev) => !prev);
  };

  const handleClearSong = () => {
    audioEngine.clearTrack();
    setCurrentTrack(null);
    setAudioSrc(null);
    setAudioBlob(undefined);
    setIsPlaying(false);
  };

  const handleToggleCleanSong = () => {
    const next = !settings.denoiseEnabled;
    const newSettings: Partial<AudioEngineSettings> = {
      denoiseEnabled: next,
      denoiseIntensity: next ? (settings.denoiseIntensity || 65) : settings.denoiseIntensity,
      deHumEnabled: true,
      deHissEnabled: true,
      vocalClarityBoost: true,
    };
    setSettings((prev) => ({ ...prev, ...newSettings }));
    Object.assign(audioEngine.settings, newSettings);
    audioEngine.updateDenoiser();
  };

  const handleResetAllEffects = () => {
    const defaultSettings: AudioEngineSettings = {
      volume: 0.85,
      playbackRate: 1.0,
      preservePitch: false,

      spatialEnabled: false,
      spatialDimension: 8,
      spatialSpeed: 10,
      spatialWidth: 0.85,
      spatialPattern: 'circular',

      reverbEnabled: false,
      reverbPreset: 'hall',
      reverbWet: 0.35,
      reverbDecay: 3.5,
      reverbDampening: 4000,

      eqEnabled: true,
      subBass: 0,
      punch: 0,
      mid: 0,
      presence: 0,
      air: 0,
      bassBoost: 0,

      saturationEnabled: false,
      saturationDrive: 3,
      stereoWidth: 1.0,
      limiterEnabled: true,

      denoiseEnabled: false,
      denoiseIntensity: 60,
      deHumEnabled: true,
      deHissEnabled: true,
      noiseGateThreshold: -50,
      vocalClarityBoost: true,
    };

    setSettings(defaultSettings);
    Object.assign(audioEngine.settings, defaultSettings);
    audioEngine.applyAllSettings();
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 font-sans flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
      {/* DAW Header */}
      <Navbar
        onResetAllEffects={handleResetAllEffects}
        onClearSong={handleClearSong}
        isCleanActive={settings.denoiseEnabled}
        onToggleCleanSong={handleToggleCleanSong}
        hasTrack={!!currentTrack}
      />

      {/* Main Studio Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Top Dual Input Zone: YouTube URL Extractor + Local File Dropzone */}
        <section aria-label="Audio Source Selection">
          <DualInputZone
            onSelectTrack={handleSelectTrack}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        </section>

        {/* Primary Audio Player & Visualizer Bento */}
        <section aria-label="Playback and Visualizer" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Audio Player Card */}
          <div className="lg:col-span-7 flex flex-col">
            <AudioPlayer
              currentTrack={currentTrack}
              audioSrc={audioSrc}
              isPlaying={isPlaying}
              isCleanActive={settings.denoiseEnabled}
              onPlayPause={handlePlayPause}
              onOpenExportModal={() => setIsExportOpen(true)}
              onClearSong={handleClearSong}
              onToggleCleanSong={handleToggleCleanSong}
            />
          </div>

          {/* Real-time HTML5 Canvas Audio Visualizer */}
          <div className="lg:col-span-5 flex flex-col">
            <VisualizerCanvas isPlaying={isPlaying} />
          </div>
        </section>

        {/* Section Header: Premium Editor Panel */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Premium Editor Panel
              </h2>
              <p className="text-xs text-slate-400">
                Real-time Web Audio API signal processing chain & noise cleaner
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Active DSP: 32-Bit Floating Point</span>
          </div>
        </div>

        {/* Background Playback Service Panel */}
        <section aria-label="Background Playback Service">
          <BackgroundServicePanel isPlaying={isPlaying} />
        </section>

        {/* Feature Spotlight: Audio Cleaner & Zero Noise Panel */}
        <section aria-label="Clean Song and Audio De-Noiser">
          <AudioCleanerPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        </section>

        {/* DSP Effects Bento Grid */}
        <section aria-label="Audio Effects Suite" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. 8D / 16D Spatial Audio Panel */}
          <SpatialPannerPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* 2. Slowed & Reverb Panel */}
          <SlowedReverbPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* 3. 5-Band Equalizer & Bass Boost Panel */}
          <EqualizerPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* 4. Mastering & Saturation Panel */}
          <MasteringPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        </section>
      </main>

      {/* Export & Download Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        currentTrack={currentTrack}
        audioSrc={audioSrc}
        audioBlob={audioBlob}
        isPlaying={isPlaying}
        onStartPlaying={() => setIsPlaying(true)}
      />

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        YouTube Audio Studio • Professional Web Audio DAW • Clean Song & Audio De-Noiser • 8D Spatial Audio • Convolver Reverb
      </footer>
    </div>
  );
}
