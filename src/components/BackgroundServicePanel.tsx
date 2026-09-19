import React, { useEffect, useState } from 'react';
import { backgroundService, BackgroundServiceStatus } from '../audio/background-service.ts';
import { audioEngine } from '../audio/audio-engine.ts';
import {
  Radio,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Lock,
  Headphones,
  Info
} from 'lucide-react';

interface BackgroundServicePanelProps {
  isPlaying: boolean;
}

export const BackgroundServicePanel: React.FC<BackgroundServicePanelProps> = ({ isPlaying }) => {
  const [status, setStatus] = useState<BackgroundServiceStatus>(backgroundService.getStatus());
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  useEffect(() => {
    const unsubscribe = backgroundService.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleToggle = () => {
    const nextVal = !status.enabled;
    backgroundService.setEnabled(nextVal);
  };

  const handleTestMediaSession = () => {
    audioEngine.setupMediaSession();
    audioEngine.updateMediaSessionPositionState();
    setTestNotificationSent(true);
    setTimeout(() => setTestNotificationSent(false), 3000);
  };

  return (
    <div id="background-service-panel" className="rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border transition-colors ${
            status.enabled
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-white text-base tracking-wide">
                Background Playback Service
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border shadow-sm ${
                  status.enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {status.enabled ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    SERVICE ACTIVE • 100% PERSISTENT
                  </>
                ) : (
                  'SERVICE BYPASS'
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous background audio, lock-screen controls, and spatial orbit keep-alive
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <button
          id="toggle-background-service-btn"
          onClick={handleToggle}
          type="button"
          aria-pressed={status.enabled}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            status.enabled ? 'bg-emerald-600 shadow-lg shadow-emerald-600/40' : 'bg-slate-700'
          }`}
          title={status.enabled ? 'Disable Background Service' : 'Enable Background Service'}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              status.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Feature Matrix Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Tab & Screen Lock Playback */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              Lock Screen Play
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Audio keeps streaming when you switch tabs, minimize, or lock your phone screen.
          </p>
          <div className="mt-auto pt-1 font-mono text-[10px] text-purple-300">
            State: {status.isBackgrounded ? 'Background / Locked' : 'Foreground / Visible'}
          </div>
        </div>

        {/* Card 2: 1D–32D Spatial Background LFO */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              Background Spatial
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Dual-clock engine routes 1D–32D spatial rotation through background timer so orbits never freeze.
          </p>
          <div className="mt-auto pt-1 font-mono text-[10px] text-cyan-300">
            Dual Clock: Active (rAF + Interval)
          </div>
        </div>

        {/* Card 3: Screen & CPU Wake Lock */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              Device Wake Lock
            </span>
            <span className={`text-[10px] font-mono font-bold ${
              status.wakeLockActive ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {status.wakeLockActive ? 'ACTIVE' : isPlaying ? 'STANDBY' : 'PAUSED'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Requests hardware wake lock during active playback to prevent mobile OS CPU suspension.
          </p>
          <div className="mt-auto pt-1 font-mono text-[10px] text-amber-300">
            Supported: {status.wakeLockSupported ? 'Yes (Native API)' : 'Emulated Fallback'}
          </div>
        </div>

        {/* Card 4: Service Worker & MediaSession */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Worker & Media
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-400">
              PWA v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            PWA service worker keeps session active with lock-screen notification media controls.
          </p>
          <div className="mt-auto pt-1 font-mono text-[10px] text-emerald-300">
            Heartbeat: {status.keepAlivePings} pings
          </div>
        </div>
      </div>

      {/* Info & Test Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-white/5 flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Lock your phone screen, turn off the display, or switch tabs—audio and spatial panning continue without stopping.
          </span>
        </div>

        <button
          id="test-media-session-btn"
          type="button"
          onClick={handleTestMediaSession}
          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium text-xs transition cursor-pointer flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          {testNotificationSent ? 'Lock-Screen Sync Pushed!' : 'Sync Lock-Screen Controls'}
        </button>
      </div>
    </div>
  );
};
