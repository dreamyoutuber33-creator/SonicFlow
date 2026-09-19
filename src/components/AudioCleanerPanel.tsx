import React from 'react';
import { AudioEngineSettings } from '../types/audio.ts';
import { audioEngine } from '../audio/audio-engine.ts';
import {
  Sparkles,
  ShieldCheck,
  VolumeX,
  Zap,
  CheckCircle2,
  Waves,
  Mic,
  Activity,
  Filter
} from 'lucide-react';

interface AudioCleanerPanelProps {
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

export const AudioCleanerPanel: React.FC<AudioCleanerPanelProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const handleToggleDenoise = () => {
    const next = !settings.denoiseEnabled;
    onUpdateSettings({ denoiseEnabled: next });
    audioEngine.settings.denoiseEnabled = next;
    audioEngine.updateDenoiser();
  };

  const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onUpdateSettings({ denoiseIntensity: val, denoiseEnabled: true });
    audioEngine.settings.denoiseEnabled = true;
    audioEngine.settings.denoiseIntensity = val;
    audioEngine.updateDenoiser();
  };

  const handleToggleHum = () => {
    const next = !settings.deHumEnabled;
    onUpdateSettings({ deHumEnabled: next });
    audioEngine.settings.deHumEnabled = next;
    audioEngine.updateDenoiser();
  };

  const handleToggleHiss = () => {
    const next = !settings.deHissEnabled;
    onUpdateSettings({ deHissEnabled: next });
    audioEngine.settings.deHissEnabled = next;
    audioEngine.updateDenoiser();
  };

  const handleToggleClarity = () => {
    const next = !settings.vocalClarityBoost;
    onUpdateSettings({ vocalClarityBoost: next });
    audioEngine.settings.vocalClarityBoost = next;
    audioEngine.updateDenoiser();
  };

  const applyCleanPreset = (preset: 'crystal' | 'deep' | 'gentle' | 'vocal') => {
    let newSet: Partial<AudioEngineSettings> = {};
    if (preset === 'crystal') {
      newSet = {
        denoiseEnabled: true,
        denoiseIntensity: 70,
        deHumEnabled: true,
        deHissEnabled: true,
        vocalClarityBoost: true,
      };
    } else if (preset === 'deep') {
      newSet = {
        denoiseEnabled: true,
        denoiseIntensity: 92,
        deHumEnabled: true,
        deHissEnabled: true,
        vocalClarityBoost: true,
      };
    } else if (preset === 'gentle') {
      newSet = {
        denoiseEnabled: true,
        denoiseIntensity: 40,
        deHumEnabled: true,
        deHissEnabled: false,
        vocalClarityBoost: true,
      };
    } else if (preset === 'vocal') {
      newSet = {
        denoiseEnabled: true,
        denoiseIntensity: 80,
        deHumEnabled: true,
        deHissEnabled: true,
        vocalClarityBoost: true,
      };
    }

    onUpdateSettings(newSet);
    Object.assign(audioEngine.settings, newSet);
    audioEngine.updateDenoiser();
  };

  // Estimated noise floor reduction in dB
  const noiseFloorReduction = settings.denoiseEnabled
    ? Math.round(6 + (settings.denoiseIntensity / 100) * 18)
    : 0;

  return (
    <div
      id="audio-cleaner-panel"
      className="rounded-3xl bg-slate-900/80 border border-emerald-500/20 p-5 md:p-6 backdrop-blur-xl shadow-xl shadow-emerald-950/20 flex flex-col gap-5 relative overflow-hidden"
    >
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Power Toggle */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Clean Song & Noise Remover
              </h3>
              {settings.denoiseEnabled ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  CLEAN (NO NOISE)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-white/5">
                  BYPASS
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Cuts background hum, tape hiss, mic rumble, and acoustic noise
            </p>
          </div>
        </div>

        {/* Master Power Toggle Button */}
        <button
          id="toggle-clean-song-btn"
          type="button"
          onClick={handleToggleDenoise}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            settings.denoiseEnabled
              ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50 shadow-lg shadow-emerald-900/40'
              : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{settings.denoiseEnabled ? 'Active' : 'Turn On'}</span>
        </button>
      </div>

      {/* Quick Clean Presets */}
      <div className="flex flex-col gap-2 relative z-10">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Clean Song Presets:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            id="preset-crystal-clean-btn"
            type="button"
            onClick={() => applyCleanPreset('crystal')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
              settings.denoiseEnabled && settings.denoiseIntensity === 70
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-300 border-white/5 hover:border-emerald-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Crystal Clean</span>
          </button>

          <button
            id="preset-deep-denoise-btn"
            type="button"
            onClick={() => applyCleanPreset('deep')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
              settings.denoiseEnabled && settings.denoiseIntensity === 92
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-300 border-white/5 hover:border-emerald-500/30'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5 text-teal-400" />
            <span>Zero Noise Deep</span>
          </button>

          <button
            id="preset-vocal-clarity-btn"
            type="button"
            onClick={() => applyCleanPreset('vocal')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
              settings.denoiseEnabled && settings.denoiseIntensity === 80
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-300 border-white/5 hover:border-emerald-500/30'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vocal Clarity</span>
          </button>

          <button
            id="preset-gentle-polish-btn"
            type="button"
            onClick={() => applyCleanPreset('gentle')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
              settings.denoiseEnabled && settings.denoiseIntensity === 40
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-300 border-white/5 hover:border-emerald-500/30'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Gentle Filter</span>
          </button>
        </div>
      </div>

      {/* Main Intensity Slider */}
      <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-950/60 border border-white/5 relative z-10">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            De-Noise Cleaning Intensity
          </span>
          <span className="font-mono font-bold text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            {settings.denoiseIntensity}% ({noiseFloorReduction > 0 ? `-${noiseFloorReduction} dB noise` : 'Off'})
          </span>
        </div>

        <input
          id="denoise-intensity-slider"
          type="range"
          min="10"
          max="100"
          step="1"
          value={settings.denoiseIntensity}
          onChange={handleIntensityChange}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-emerald-400 focus:outline-none"
        />

        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>Mild Clean</span>
          <span>Studio Polish</span>
          <span>Zero Background Noise</span>
        </div>
      </div>

      {/* Clean Filters Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
        {/* 1. 50/60Hz Mains AC Hum */}
        <button
          id="toggle-dehum-btn"
          type="button"
          onClick={handleToggleHum}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
            settings.deHumEnabled && settings.denoiseEnabled
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              De-Hum 60Hz
            </span>
            <span className={`w-2 h-2 rounded-full ${settings.deHumEnabled && settings.denoiseEnabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Removes electrical AC grounding hum & amplifier buzzing
          </p>
        </button>

        {/* 2. De-Hiss High Shelf */}
        <button
          id="toggle-dehiss-btn"
          type="button"
          onClick={handleToggleHiss}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
            settings.deHissEnabled && settings.denoiseEnabled
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              De-Hiss Highs
            </span>
            <span className={`w-2 h-2 rounded-full ${settings.deHissEnabled && settings.denoiseEnabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Filters out analog tape hiss, mic self-noise & static
          </p>
        </button>

        {/* 3. Vocal & Instrument Clarity */}
        <button
          id="toggle-clarity-btn"
          type="button"
          onClick={handleToggleClarity}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
            settings.vocalClarityBoost && settings.denoiseEnabled
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              Crystal Clarity
            </span>
            <span className={`w-2 h-2 rounded-full ${settings.vocalClarityBoost && settings.denoiseEnabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Sharpens vocals, lyrics, and lead instruments
          </p>
        </button>
      </div>

      {/* Telemetry Status Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Rumble Cut: {settings.denoiseEnabled ? `${Math.round(32 + (settings.denoiseIntensity / 100) * 28)} Hz` : '10 Hz (Bypass)'}</span>
        </div>
        <div>
          <span>Hiss Cutoff: {settings.denoiseEnabled && settings.deHissEnabled ? `${Math.round((11500 - (settings.denoiseIntensity / 100) * 3000) / 100) / 10} kHz` : 'Bypass'}</span>
        </div>
      </div>
    </div>
  );
};
