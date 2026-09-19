import React, { useEffect, useState, useMemo } from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { AudioEngineSettings, SpatialPattern } from '../types/audio.ts';
import { DIMENSIONS, getDimensionProfile } from '../data/dimensions.ts';
import { Compass, Headphones, Sparkles, Sliders, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

interface SpatialPannerPanelProps {
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

// Popular quick preset dimensions
const QUICK_DIMENSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 24, 32];

export const SpatialPannerPanel: React.FC<SpatialPannerPanelProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [panPos, setPanPos] = useState<{ x: number; y: number; pan: number }>({ x: 0, y: 1, pan: 0 });
  const activeDim = settings.spatialDimension || 8;
  const currentProfile = useMemo(() => getDimensionProfile(activeDim), [activeDim]);

  useEffect(() => {
    const unsubscribe = audioEngine.onPanUpdate((pos) => {
      setPanPos(pos);
    });
    return unsubscribe;
  }, []);

  const handleToggle = () => {
    const nextVal = !settings.spatialEnabled;
    onUpdateSettings({ spatialEnabled: nextVal });
    audioEngine.settings.spatialEnabled = nextVal;
  };

  const handleDimensionChange = (d: number) => {
    const clamped = Math.max(1, Math.min(32, Math.round(d)));
    onUpdateSettings({ spatialDimension: clamped });
    audioEngine.settings.spatialDimension = clamped;
  };

  const handlePatternChange = (pattern: SpatialPattern) => {
    onUpdateSettings({ spatialPattern: pattern });
    audioEngine.settings.spatialPattern = pattern;
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    onUpdateSettings({ spatialSpeed: speed });
    audioEngine.settings.spatialSpeed = speed;
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const width = parseFloat(e.target.value);
    onUpdateSettings({ spatialWidth: width });
    audioEngine.settings.spatialWidth = width;
  };

  // Convert normalized x (-1 to 1) and y (-1 to 1) to percentage inside radar container
  const orbXPercent = 50 + (panPos.x * 38);
  const orbYPercent = 50 + (panPos.y * 38);

  // Compute node coordinates around the circle for the selected dimension (up to 32 nodes)
  const nodePositions = useMemo(() => {
    const count = activeDim === 1 ? 1 : activeDim;
    const nodes: Array<{ x: number; y: number; angle: number }> = [];
    if (activeDim === 1) {
      nodes.push({ x: 50, y: 50, angle: 0 });
      return nodes;
    }
    if (activeDim === 2) {
      nodes.push({ x: 15, y: 50, angle: Math.PI * 1.5 });
      nodes.push({ x: 85, y: 50, angle: Math.PI * 0.5 });
      return nodes;
    }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const x = 50 + Math.cos(angle) * 38;
      const y = 50 + Math.sin(angle) * 38;
      nodes.push({ x, y, angle });
    }
    return nodes;
  }, [activeDim]);

  return (
    <div id="spatial-audio-panel" className="rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-5 shadow-xl">
      {/* Header with Switch */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-white text-base tracking-wide">
                1D — 32D Multi-Dimensional Audio
              </h3>
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border shadow-sm"
                style={{
                  backgroundColor: `${currentProfile.color}22`,
                  borderColor: `${currentProfile.color}66`,
                  color: currentProfile.color,
                }}
              >
                {currentProfile.label} • {currentProfile.tag}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Full 1D to 32D binaural spatial vector engine with cranial motion modeling
            </p>
          </div>
        </div>

        {/* Tactile Toggle Switch */}
        <button
          id="toggle-spatial-btn"
          onClick={handleToggle}
          type="button"
          aria-pressed={settings.spatialEnabled}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            settings.spatialEnabled ? 'bg-purple-600 shadow-lg shadow-purple-600/40' : 'bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              settings.spatialEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 1D - 32D Dimension Selector Bar */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              Active Dimension:
            </span>
            <span className="font-mono font-extrabold text-sm text-purple-300">
              {currentProfile.label}
            </span>
            <span className="text-slate-400 font-medium text-xs hidden sm:inline">
              ({currentProfile.name})
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <button
              id="dim-prev-btn"
              type="button"
              disabled={activeDim <= 1}
              onClick={() => handleDimensionChange(activeDim - 1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 cursor-pointer"
              title="Previous Dimension"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-bold text-white">{activeDim}D / 32D</span>
            <button
              id="dim-next-btn"
              type="button"
              disabled={activeDim >= 32}
              onClick={() => handleDimensionChange(activeDim + 1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 cursor-pointer"
              title="Next Dimension"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Continuous 1D to 32D Slider */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-mono text-slate-500 font-bold">1D</span>
          <input
            id="dimension-stepper-slider"
            type="range"
            min="1"
            max="32"
            step="1"
            value={activeDim}
            onChange={(e) => handleDimensionChange(parseInt(e.target.value, 10))}
            className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-400 border border-white/10"
          />
          <span className="text-[10px] font-mono text-cyan-400 font-bold">32D</span>
        </div>

        {/* Quick-Access Preset Chips (1D, 2D, 3D, 4D, 5D, 6D, 7D, 8D, 9D, 10D, 12D, 16D, 24D, 32D) */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {QUICK_DIMENSIONS.map((d) => {
            const isSelected = activeDim === d;
            return (
              <button
                key={d}
                id={`dim-preset-${d}d-btn`}
                type="button"
                onClick={() => handleDimensionChange(d)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/40 scale-105'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border-white/5 hover:border-white/20'
                }`}
              >
                {d}D
              </button>
            );
          })}
        </div>

        {/* Selected Dimension Audio Character Description */}
        <p className="text-[11px] text-slate-300 mt-1 italic leading-relaxed border-t border-white/5 pt-2">
          <span className="font-semibold text-purple-300 not-italic">Acoustic Field: </span>
          {currentProfile.description}
        </p>
      </div>

      {/* Main Grid: Interactive 3D/nD Radar + Orbit Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Visual Multi-Vector Spatial Radar */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-44 h-44 rounded-full bg-slate-950/90 border border-purple-500/30 flex items-center justify-center shadow-inner overflow-hidden">
            {/* Concentric distance rings */}
            <div className="absolute inset-3 rounded-full border border-purple-500/15 border-dashed" />
            <div className="absolute inset-8 rounded-full border border-purple-500/20" />
            <div className="absolute inset-16 rounded-full border border-purple-500/10" />

            {/* Radar Crosshairs */}
            <div className="absolute w-full h-[1px] bg-purple-500/15" />
            <div className="absolute h-full w-[1px] bg-purple-500/15" />

            {/* Render Dimension Vector Nodes (Speakers) */}
            {nodePositions.map((node, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full transition-all duration-300 pointer-events-none"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  backgroundColor: currentProfile.color,
                  opacity: activeDim <= 8 ? 0.8 : activeDim <= 16 ? 0.6 : 0.45,
                  boxShadow: `0 0 6px ${currentProfile.color}`,
                }}
              />
            ))}

            {/* Listener's Head in Center */}
            <div className="relative z-10 w-12 h-12 rounded-full bg-purple-950/90 border border-purple-400/60 flex items-center justify-center shadow-lg">
              <Headphones className="w-5 h-5 text-purple-200" />
            </div>

            {/* Direction Labels */}
            <span className="absolute top-1 text-[9px] font-mono text-purple-400/70 uppercase">Front</span>
            <span className="absolute bottom-1 text-[9px] font-mono text-purple-400/70 uppercase">Rear</span>
            <span className="absolute left-1.5 text-[9px] font-mono text-purple-400/70 uppercase">L</span>
            <span className="absolute right-1.5 text-[9px] font-mono text-purple-400/70 uppercase">R</span>

            {/* Orbiting Sound Source */}
            {settings.spatialEnabled && (
              <div
                className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full shadow-lg z-20 transition-all duration-75 flex items-center justify-center"
                style={{
                  left: `${orbXPercent}%`,
                  top: `${orbYPercent}%`,
                  backgroundColor: currentProfile.color,
                  boxShadow: `0 0 14px ${currentProfile.color}`,
                }}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              </div>
            )}
          </div>

          {/* Current Pan & Vector Readout */}
          <div className="mt-2.5 flex items-center gap-2 font-mono text-xs text-slate-300">
            <span>Pan:</span>
            <span className="font-semibold text-purple-300">
              {settings.spatialEnabled ? (
                activeDim === 1 ? (
                  '1D Center Mono'
                ) : panPos.pan < -0.05 ? (
                  `${Math.abs(Math.round(panPos.pan * 100))}% Left`
                ) : panPos.pan > 0.05 ? (
                  `${Math.round(panPos.pan * 100)}% Right`
                ) : (
                  'Center'
                )
              ) : (
                'Center (Bypassed)'
              )}
            </span>
          </div>
        </div>

        {/* Orbit Controls & Sliders */}
        <div className="md:col-span-7 flex flex-col gap-4">
          {/* Orbit Trajectory Pattern Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Trajectory Geometry
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'circular', label: '360° Circular' },
                { id: 'figure8', label: 'Figure-8 ∞' },
                { id: 'pendulum', label: 'Pendulum ↔' },
              ].map((p) => (
                <button
                  key={p.id}
                  id={`pattern-${p.id}-btn`}
                  type="button"
                  onClick={() => handlePatternChange(p.id as SpatialPattern)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center cursor-pointer ${
                    settings.spatialPattern === p.id
                      ? 'bg-purple-600/40 text-purple-100 border-purple-400 shadow-sm shadow-purple-600/30 font-semibold'
                      : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white hover:border-white/15'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speed Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-medium text-slate-300">Orbit Speed / Frequency</span>
              <span className="font-mono text-purple-300 font-semibold">
                {settings.spatialSpeed}s / cycle
              </span>
            </div>
            <input
              id="spatial-speed-slider"
              type="range"
              min="2"
              max="24"
              step="0.5"
              value={settings.spatialSpeed}
              onChange={handleSpeedChange}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500 border border-white/5"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>Hyper Fast (2s)</span>
              <span>Hypnotic Slow (24s)</span>
            </div>
          </div>

          {/* Spatial Width / Depth Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-medium text-slate-300">Spatial Orbit Depth / Field Width</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {Math.round(settings.spatialWidth * 100)}%
              </span>
            </div>
            <input
              id="spatial-width-slider"
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={settings.spatialWidth}
              onChange={handleWidthChange}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-white/5"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>Tight Intracranial</span>
              <span>Expansive Out-of-Head</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
