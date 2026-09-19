import React from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { AudioEngineSettings, ReverbPreset } from '../types/audio.ts';
import { Waves, Disc, Flame, CloudRain } from 'lucide-react';

interface SlowedReverbPanelProps {
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

export const SlowedReverbPanel: React.FC<SlowedReverbPanelProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const handleToggleReverb = () => {
    const nextVal = !settings.reverbEnabled;
    onUpdateSettings({ reverbEnabled: nextVal });
    audioEngine.settings.reverbEnabled = nextVal;
    audioEngine.updateReverb();
  };

  const handleSpeedChange = (rate: number) => {
    onUpdateSettings({ playbackRate: rate });
    audioEngine.settings.playbackRate = rate;
    audioEngine.updatePlaybackRate();
  };

  const handlePitchToggle = () => {
    const nextVal = !settings.preservePitch;
    onUpdateSettings({ preservePitch: nextVal });
    audioEngine.settings.preservePitch = nextVal;
    audioEngine.updatePlaybackRate();
  };

  const handlePresetSelect = (preset: ReverbPreset) => {
    onUpdateSettings({ reverbPreset: preset });
    audioEngine.settings.reverbPreset = preset;
    audioEngine.regenerateReverbIR(preset);
    audioEngine.updateReverb();
  };

  const handleWetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wet = parseFloat(e.target.value);
    onUpdateSettings({ reverbWet: wet });
    audioEngine.settings.reverbWet = wet;
    audioEngine.updateReverb();
  };

  const handleDecayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const decay = parseFloat(e.target.value);
    onUpdateSettings({ reverbDecay: decay });
    audioEngine.settings.reverbDecay = decay;
    audioEngine.regenerateReverbIR(undefined, decay);
  };

  const reverbPresetsList: { id: ReverbPreset; label: string; desc: string }[] = [
    { id: 'bedroom', label: 'Cozy Room', desc: 'Warm intimate reflections' },
    { id: 'studio', label: 'Acoustic Studio', desc: 'Tightly controlled acoustic space' },
    { id: 'hall', label: 'Concert Hall', desc: 'Lush wide orchestral acoustics' },
    { id: 'cathedral', label: 'Cathedral', desc: 'Huge soaring stone reverberations' },
    { id: 'stadium', label: 'Mega Stadium', desc: 'Massive open-air arena resonance' },
    { id: 'space', label: 'Astral Space', desc: 'Infinite ambient celestial wash' },
  ];

  return (
    <div id="slowed-reverb-panel" className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide">Slowed & Reverb</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Vibing Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Analog tape slowdown & algorithmic impulse convolution reverb
            </p>
          </div>
        </div>

        {/* Toggle Reverb Switch */}
        <button
          id="toggle-reverb-btn"
          onClick={handleToggleReverb}
          type="button"
          aria-pressed={settings.reverbEnabled}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            settings.reverbEnabled ? 'bg-cyan-600 shadow-lg shadow-cyan-600/40' : 'bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              settings.reverbEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* SECTION 1: Playback Speed & Tape Pitch */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc className={`w-4 h-4 ${settings.playbackRate !== 1 ? 'text-cyan-400 animate-spin' : 'text-slate-400'}`} style={{ animationDuration: `${3 / settings.playbackRate}s` }} />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Playback Tempo & Pitch</span>
          </div>

          {/* Tape slow pitch toggle */}
          <button
            id="toggle-tape-pitch-btn"
            type="button"
            onClick={handlePitchToggle}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              !settings.preservePitch
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-white/5 hover:text-white'
            }`}
            title="Vintage Tape mode drops pitch proportionally with speed for true Slowed + Reverb sound"
          >
            {!settings.preservePitch ? 'Vintage Tape Drop (On)' : 'Preserve Pitch (On)'}
          </button>
        </div>

        {/* Speed Slider */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Speed Multiplier</span>
            <span className="font-mono text-cyan-400 font-bold text-sm">
              {settings.playbackRate.toFixed(2)}x
            </span>
          </div>
          <input
            id="playback-speed-slider"
            type="range"
            min="0.5"
            max="1.5"
            step="0.01"
            value={settings.playbackRate}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-white/5"
          />
        </div>

        {/* Quick Speed Preset Chips */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          {[
            { rate: 0.75, label: '0.75x Chopped' },
            { rate: 0.85, label: '0.85x Slowed ★' },
            { rate: 1.0, label: '1.0x Normal' },
            { rate: 1.25, label: '1.25x Nightcore' },
          ].map((item) => (
            <button
              key={item.rate}
              id={`speed-preset-${item.rate * 100}-btn`}
              type="button"
              onClick={() => handleSpeedChange(item.rate)}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                Math.abs(settings.playbackRate - item.rate) < 0.02
                  ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-white/5 hover:text-white hover:border-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 2: Convolution Reverb Impulse Presets & Controls */}
      <div className={`flex flex-col gap-3 transition-opacity ${settings.reverbEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Acoustic Convolution Environment (IR)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {reverbPresetsList.map((preset) => (
              <button
                key={preset.id}
                id={`reverb-preset-${preset.id}-btn`}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                  settings.reverbPreset === preset.id && settings.reverbEnabled
                    ? 'bg-cyan-950/60 text-cyan-200 border-cyan-400/60 shadow-md shadow-cyan-950/40'
                    : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/15 hover:text-slate-200'
                }`}
              >
                <span className="text-xs font-semibold text-slate-100">{preset.label}</span>
                <span className="text-[10px] text-slate-400 line-clamp-1">{preset.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Wet/Dry Mix and Decay Time Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {/* Reverb Wet / Dry */}
          <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Reverb Mix (Wet / Dry)</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {Math.round(settings.reverbWet * 100)}%
              </span>
            </div>
            <input
              id="reverb-wet-slider"
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={settings.reverbWet}
              onChange={handleWetChange}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Decay Duration */}
          <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Decay Time</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {settings.reverbDecay.toFixed(1)}s
              </span>
            </div>
            <input
              id="reverb-decay-slider"
              type="range"
              min="0.5"
              max="10"
              step="0.2"
              value={settings.reverbDecay}
              onChange={handleDecayChange}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
