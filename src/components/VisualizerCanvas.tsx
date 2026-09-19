import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../audio/audio-engine.ts';
import { VisualizerMode } from '../types/audio.ts';
import { Activity, Radio, BarChart3, Zap } from 'lucide-react';

interface VisualizerCanvasProps {
  isPlaying: boolean;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [peakDb, setPeakDb] = useState<number>(-60);
  const [rmsDb, setRmsDb] = useState<number>(-60);
  const peakDecayRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI display
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);
    updateSize();

    let frameCount = 0;

    const render = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const analyser = audioEngine.analyserNode;
      if (!analyser || !isPlaying) {
        // Idle ambient pulse
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.lineWidth = 2;
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin((x * 0.02) + (performance.now() * 0.002)) * 4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (frameCount++ % 10 === 0) {
          setPeakDb(prev => Math.max(-60, prev - 2));
          setRmsDb(prev => Math.max(-60, prev - 2));
        }

        animId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Calculate Peak and RMS for DAW meter
      let sumSquares = 0;
      let maxSample = 0;
      for (let i = 0; i < timeData.length; i++) {
        const norm = (timeData[i] - 128) / 128;
        sumSquares += norm * norm;
        if (Math.abs(norm) > maxSample) maxSample = Math.abs(norm);
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      const currentRmsDb = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
      const currentPeakDb = maxSample > 0.0001 ? 20 * Math.log10(maxSample) : -60;

      if (frameCount++ % 4 === 0) {
        setRmsDb(Math.round(currentRmsDb));
        setPeakDb(Math.round(currentPeakDb));
      }

      // 1. SPECTRUM ANALYZER
      if (mode === 'spectrum') {
        const barCount = Math.min(64, Math.floor(width / 6));
        const barWidth = Math.max(3, (width / barCount) - 2);

        // Keep peak decay array sized
        if (peakDecayRef.current.length !== barCount) {
          peakDecayRef.current = new Array(barCount).fill(0);
        }

        // Draw frequency bars
        for (let i = 0; i < barCount; i++) {
          // Logarithmic distribution to emphasize bass and mids
          const freqIndex = Math.floor(Math.pow(i / barCount, 1.8) * (bufferLength * 0.5));
          const val = freqData[freqIndex] || 0;
          const barHeight = (val / 255) * (height - 20);

          // Update peak decay
          if (barHeight >= peakDecayRef.current[i]) {
            peakDecayRef.current[i] = barHeight;
          } else {
            peakDecayRef.current[i] = Math.max(0, peakDecayRef.current[i] - 1.2);
          }

          const x = i * (barWidth + 2) + 2;
          const y = height - barHeight;

          // Gradient from cyan through purple to magenta
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.85)'); // Cyan
          grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.9)'); // Violet
          grad.addColorStop(1, 'rgba(236, 72, 153, 0.95)'); // Pink / Magenta

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Peak hold cap
          const peakY = height - peakDecayRef.current[i] - 2;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillRect(x, Math.max(2, peakY), barWidth, 2);
        }
      }

      // 2. OSCILLOSCOPE WAVEFORM
      else if (mode === 'waveform') {
        ctx.lineWidth = 2.5;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.5, '#a855f7');
        grad.addColorStop(1, '#ec4899');
        ctx.strokeStyle = grad;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      // 3. RADIAL / CIRCULAR 360 RADAR
      else if (mode === 'radial') {
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(centerX, centerY) * 0.45;

        // Glowing center core
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius);
        coreGrad.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
        coreGrad.addColorStop(0.8, 'rgba(6, 182, 212, 0.1)');
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Radial frequency rays
        const rays = 64;
        for (let i = 0; i < rays; i++) {
          const angle = (i / rays) * Math.PI * 2;
          const freqIndex = Math.floor(Math.pow(i / rays, 1.4) * (bufferLength * 0.4));
          const val = freqData[freqIndex] || 0;
          const rayLength = (val / 255) * (Math.min(centerX, centerY) * 0.45);

          const r1 = baseRadius;
          const r2 = baseRadius + rayLength;

          const x1 = centerX + Math.cos(angle) * r1;
          const y1 = centerY + Math.sin(angle) * r1;
          const x2 = centerX + Math.cos(angle) * r2;
          const y2 = centerY + Math.sin(angle) * r2;

          ctx.strokeStyle = `hsla(${260 + (i / rays) * 60}, 90%, 65%, 0.8)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Inner glowing ring
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [mode, isPlaying]);

  return (
    <div id="waveform-visualizer-card" className="relative rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-xl p-4 flex flex-col overflow-hidden shadow-2xl shadow-purple-950/20">
      {/* Header with Mode Switcher and dB Meter */}
      <div className="flex items-center justify-between gap-2 mb-2 z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-purple-300">
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>REALTIME DSP</span>
          </div>
          <span className="hidden sm:inline text-xs text-slate-400 font-mono">
            44.1 kHz • 2048 FFT
          </span>
        </div>

        {/* Meters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-500">RMS:</span>
            <span className={`font-semibold ${rmsDb > -6 ? 'text-rose-400' : rmsDb > -14 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {rmsDb} dB
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-500">PEAK:</span>
            <span className={`font-semibold ${peakDb >= -0.5 ? 'text-rose-400 font-bold' : peakDb > -3 ? 'text-amber-400' : 'text-cyan-400'}`}>
              {peakDb} dB
            </span>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center rounded-xl bg-slate-950/80 p-0.5 border border-white/10">
            <button
              id="mode-spectrum-btn"
              onClick={() => setMode('spectrum')}
              title="Spectrum Analyzer"
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                mode === 'spectrum'
                  ? 'bg-purple-600/40 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Spectrum</span>
            </button>
            <button
              id="mode-waveform-btn"
              onClick={() => setMode('waveform')}
              title="Oscilloscope Waveform"
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                mode === 'waveform'
                  ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Waveform</span>
            </button>
            <button
              id="mode-radial-btn"
              onClick={() => setMode('radial')}
              title="Circular 360 Radar"
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                mode === 'radial'
                  ? 'bg-pink-600/40 text-pink-200 border border-pink-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden md:inline">360° Radar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Canvas container */}
      <div ref={containerRef} className="w-full h-36 md:h-44 relative rounded-xl bg-slate-950/60 overflow-hidden border border-white/5">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
