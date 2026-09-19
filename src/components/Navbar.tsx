import React, { useEffect, useState } from 'react';
import { Radio, Headphones, RotateCcw, Sliders, Cpu, Trash2, ShieldCheck, Sparkles } from 'lucide-react';
import { audioEngine } from '../audio/audio-engine.ts';
import { backgroundService, BackgroundServiceStatus } from '../audio/background-service.ts';

interface NavbarProps {
  onResetAllEffects: () => void;
  onClearSong: () => void;
  isCleanActive: boolean;
  onToggleCleanSong: () => void;
  hasTrack: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onResetAllEffects,
  onClearSong,
  isCleanActive,
  onToggleCleanSong,
  hasTrack,
}) => {
  const [bgStatus, setBgStatus] = useState<BackgroundServiceStatus>(backgroundService.getStatus());

  useEffect(() => {
    const unsub = backgroundService.onStatusChange((s) => setBgStatus(s));
    return unsub;
  }, []);

  const handleToggleBackground = () => {
    backgroundService.setEnabled(!bgStatus.enabled);
  };
  return (
    <header className="w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-cyan-400 p-0.5 shadow-lg shadow-purple-950/60 flex items-center justify-center">
          <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-black tracking-tight text-white">
              YouTube Audio Studio
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              1D–32D DAW
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">
            Professional Web Audio Workstation • 1D to 32D Spatial Dimensions • Audio Cleaner & De-Noiser
          </p>
        </div>
      </div>

      {/* Center tip: Headphones */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-300">
        <Headphones className="w-4 h-4 text-cyan-400" />
        <span>Headphones recommended for 8D binaural spatial experience</span>
      </div>

      {/* Right Controls: Background Service + Clean Song + Clear Song + Reset */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Background Service Status / Toggle */}
        <button
          id="navbar-bg-service-btn"
          type="button"
          onClick={handleToggleBackground}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            bgStatus.enabled
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
              : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
          }`}
          title="Background Playback Service (Continues audio when tab is switched or screen is locked)"
        >
          <span className={`w-2 h-2 rounded-full ${bgStatus.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span>{bgStatus.enabled ? 'Background: ON' : 'Background: OFF'}</span>
        </button>

        {/* Quick Clean Song toggle */}
        <button
          id="navbar-clean-song-btn"
          type="button"
          onClick={onToggleCleanSong}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isCleanActive
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-emerald-300 border-white/10'
          }`}
          title="Toggle Clean Song (Removes noise, hum, and hiss)"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isCleanActive ? 'Clean Song: ON' : 'Clean Song'}</span>
        </button>

        {/* Clear Song Option */}
        <button
          id="navbar-clear-song-btn"
          type="button"
          onClick={onClearSong}
          disabled={!hasTrack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 bg-slate-900 hover:bg-rose-950/30 border border-white/10 hover:border-rose-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Clear current song"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Clear Song</span>
        </button>

        {/* Reset All Effects */}
        <button
          id="reset-all-effects-btn"
          type="button"
          onClick={onResetAllEffects}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 transition-all cursor-pointer"
          title="Reset all effects to default flat state"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Reset DSP</span>
        </button>
      </div>
    </header>
  );
};
