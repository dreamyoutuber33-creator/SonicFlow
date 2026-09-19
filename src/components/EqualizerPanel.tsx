import React from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { AudioEngineSettings, EQPreset } from '../types/audio.ts';
import { SlidersHorizontal, Volume2, RotateCcw, Sparkles } from 'lucide-react';

interface EqualizerPanelProps {
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

const EQ_PRESETS: EQPreset[] = [
  { name: 'Flat', subBass: 0, punch: 0, mid: 0, presence: 0, air: 0, bassBoost: 0 },
  { name: 'Bass Cannon', subBass: 7, punch: 4, mid: -1, presence: 1, air: 2, bassBoost: 6 },
  { name: 'Lo-Fi Vinyl', subBass: 3, punch: 2, mid: 4, presence: -3, air: -5, bassBoost: 1 },
  { name: 'Vocal Clarity', subBass: -2, punch: -1, mid: 3, presence: 4, air: 3, bassBoost: 0 },
  { name: 'Club / EDM', subBass: 6, punch: 3, mid: -2, presence: 2, air: 4, bassBoost: 4 },
  { name: 'Warm Acoustic', subBass: 2, punch: 3, mid: 1, presence: 0, air: 2, bassBoost: 1 },
];

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const handleToggle = () => {
    const nextVal = !settings.eqEnabled;
    onUpdateSettings({ eqEnabled: nextVal });
    audioEngine.settings.eqEnabled = nextVal;
    audioEngine.updateEQ();
  };

  const handleBandChange = (band: keyof AudioEngineSettings, val: number) => {
    onUpdateSettings({ [band]: val });
    (audioEngine.settings as any)[band] = val;
    audioEngine.updateEQ();
  };

  const applyPreset = (preset: EQPreset) => {
    const nextSettings = {
      subBass: preset.subBass,
      punch: preset.punch,
      mid: preset.mid,
      presence: preset.presence,
      air: preset.air,
      bassBoost: preset.bassBoost,
    };
    onUpdateSettings(nextSettings);
    Object.assign(audioEngine.settings, nextSettings);
    audioEngine.updateEQ();
  };

  const bands = [
    { key: 'subBass' as const, label: 'Sub-Bass', freq: '60 Hz', val: settings.subBass, min: -12, max: 15 },
    { key: 'punch' as const, label: 'Bass Punch', freq: '150 Hz', val: settings.punch, min: -12, max: 12 },
    { key: 'mid' as const, label: 'Mid / Vocals', freq: '1.0 kHz', val: settings.mid, min: -12, max: 12 },
    { key: 'presence' as const, label: 'Presence', freq: '3.5 kHz', val: settings.presence, min: -12, max: 12 },
    { key: 'air' as const, label: 'Air / Sparkle', freq: '10 kHz', val: settings.air, min: -12, max: 15 },
  ];

  // Approximate SVG curve points from bands
  const curvePoints = bands.map((b, i) => {
    const x = 30 + i * 85;
    // val range -12 to 15 -> map to height 120 (0dB = 60)
    const effectiveVal = b.key === 'subBass' ? b.val + settings.bassBoost * 1.5 : b.val;
    const y = 60 - (effectiveVal * 2.5);
    return `${x},${Math.max(10, Math.min(110, y))}`;
  }).join(' ');

  return (
    <div id="equalizer-panel" className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide">Multi-Band EQ & Bass Boost</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-pink-500/20 text-pink-300 border border-pink-500/30">
                5-Band Precision
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Parametric filters with low-end sub-bass resonance and air shelving
            </p>
          </div>
        </div>

        {/* EQ On/Off Switch */}
        <button
          id="toggle-eq-btn"
          onClick={handleToggle}
          type="button"
          aria-pressed={settings.eqEnabled}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            settings.eqEnabled ? 'bg-pink-600 shadow-lg shadow-pink-600/40' : 'bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              settings.eqEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Interactive EQ Curve Visualizer Preview */}
      <div className="relative h-24 rounded-xl bg-slate-950/80 border border-white/5 overflow-hidden flex items-center justify-center p-2">
        {/* dB Guidelines */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 px-3 pointer-events-none opacity-30 text-[9px] font-mono text-slate-400">
          <div className="flex justify-between border-b border-white/10 pb-0.5"><span>+12 dB</span><span>TREBLE</span></div>
          <div className="flex justify-between border-b border-white/20 pb-0.5 text-pink-400"><span>0 dB (FLAT)</span><span>CENTER</span></div>
          <div className="flex justify-between border-t border-white/10 pt-0.5"><span>-12 dB</span><span>BASS</span></div>
        </div>

        {/* SVG Dynamic Curve */}
        <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="eqGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="eqAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {settings.eqEnabled && (
            <>
              {/* Fill under curve */}
              <polygon
                points={`0,120 0,60 ${curvePoints} 400,60 400,120`}
                fill="url(#eqAreaGradient)"
              />
              {/* Stroke line */}
              <polyline
                points={`0,60 ${curvePoints} 400,60`}
                fill="none"
                stroke="url(#eqGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {!settings.eqEnabled && (
            <line x1="0" y1="60" x2="400" y2="60" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="4 4" />
          )}
        </svg>
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 mr-1 uppercase font-mono">Presets:</span>
        {EQ_PRESETS.map((p) => (
          <button
            key={p.name}
            id={`eq-preset-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-btn`}
            type="button"
            onClick={() => applyPreset(p)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950/60 border border-white/5 text-slate-300 hover:text-white hover:border-pink-500/40 transition-all"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* 5 Vertical Sliders + Bass Boost Master */}
      <div className={`grid grid-cols-5 md:grid-cols-6 gap-3 transition-opacity ${settings.eqEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* 5 EQ Frequencies */}
        {bands.map((band) => (
          <div key={band.key} className="flex flex-col items-center p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="font-mono text-xs font-bold text-pink-300">
              {band.val > 0 ? `+${band.val}` : band.val} dB
            </span>
            <div className="h-28 flex items-center justify-center my-2">
              <input
                id={`eq-${band.key}-slider`}
                type="range"
                min={band.min}
                max={band.max}
                step="0.5"
                value={band.val}
                onChange={(e) => handleBandChange(band.key, parseFloat(e.target.value))}
                className="h-24 w-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-pink-500 [writing-mode:vertical-lr] [direction:rtl]"
              />
            </div>
            <span className="text-xs font-medium text-slate-200 text-center">{band.label}</span>
            <span className="text-[10px] font-mono text-slate-500">{band.freq}</span>
          </div>
        ))}

        {/* Master Bass Boost Knob / Control */}
        <div className="col-span-5 md:col-span-1 flex flex-col items-center justify-between p-2.5 rounded-xl bg-gradient-to-b from-pink-950/30 to-purple-950/30 border border-pink-500/30">
          <div className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
            <span className="text-xs font-bold text-pink-300">BASS PUSH</span>
          </div>

          <div className="flex flex-col items-center my-2">
            <span className="font-mono text-lg font-black text-pink-300">
              +{settings.bassBoost}
            </span>
            <input
              id="bass-boost-slider"
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.bassBoost}
              onChange={(e) => handleBandChange('bassBoost', parseInt(e.target.value, 10))}
              className="w-20 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-pink-500 mt-2"
            />
          </div>

          <span className="text-[10px] text-pink-200/80 font-mono text-center">Sub-Harmonics</span>
        </div>
      </div>
    </div>
  );
};
