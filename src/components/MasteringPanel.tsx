import React from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { AudioEngineSettings } from '../types/audio.ts';
import { Flame, ShieldCheck, Gauge, Sliders } from 'lucide-react';

interface MasteringPanelProps {
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

export const MasteringPanel: React.FC<MasteringPanelProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const handleToggleSaturation = () => {
    const nextVal = !settings.saturationEnabled;
    onUpdateSettings({ saturationEnabled: nextVal });
    audioEngine.settings.saturationEnabled = nextVal;
    audioEngine.updateSaturation();
  };

  const handleDriveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const drive = parseFloat(e.target.value);
    onUpdateSettings({ saturationDrive: drive });
    audioEngine.settings.saturationDrive = drive;
    audioEngine.updateSaturation();
  };

  const handleToggleLimiter = () => {
    const nextVal = !settings.limiterEnabled;
    onUpdateSettings({ limiterEnabled: nextVal });
    audioEngine.settings.limiterEnabled = nextVal;
    audioEngine.updateMaster();
  };

  return (
    <div id="mastering-panel" className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide">Mastering & Analog Warmth</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                DSP Rack
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Soft-clipping harmonic saturation & studio peak limiting
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Analog Saturation */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className={`w-4 h-4 ${settings.saturationEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Tube Warmth / Saturation</span>
            </div>
            <button
              id="toggle-saturation-btn"
              onClick={handleToggleSaturation}
              type="button"
              className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-all ${
                settings.saturationEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-white/5'
              }`}
            >
              {settings.saturationEnabled ? 'ACTIVE' : 'BYPASS'}
            </button>
          </div>

          <div className={`${settings.saturationEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Harmonic Drive</span>
              <span className="font-mono text-amber-400 font-bold">{settings.saturationDrive.toFixed(1)}</span>
            </div>
            <input
              id="saturation-drive-slider"
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.saturationDrive}
              onChange={handleDriveChange}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>Subtle Warmth</span>
              <span>Heavy Crunch</span>
            </div>
          </div>
        </div>

        {/* Studio Peak Limiter */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${settings.limiterEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Dynamics Peak Limiter</span>
            </div>
            <button
              id="toggle-limiter-btn"
              onClick={handleToggleLimiter}
              type="button"
              className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-all ${
                settings.limiterEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-white/5'
              }`}
            >
              {settings.limiterEnabled ? 'ENGAGED' : 'OFF'}
            </button>
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-slate-400">
            <p>
              Auto-clamps signal peaks above -2.0 dB with a 12:1 fast lookahead ratio, preventing digital harshness and inter-sample clipping when boosting bass.
            </p>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 mt-1">
              <span>Threshold: -2.0 dB</span>
              <span>Ratio: 12:1</span>
              <span>Attack: 3ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
