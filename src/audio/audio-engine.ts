import { AudioEngineSettings, AudioTrackMeta, ReverbPreset, SpatialPattern } from '../types/audio.ts';
import { generateImpulseResponse } from './reverb-generator.ts';
import { audioBufferToWavBlob } from './wav-encoder.ts';

// Generates a soft-clipping tube saturation curve
function makeDistortionCurve(amount: number = 0): Float32Array<ArrayBuffer> {
  const k = typeof amount === 'number' ? amount : 0;
  const n_samples = 44100;
  const buffer = new ArrayBuffer(n_samples * 4);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  
  if (k === 0) {
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = x;
    }
    return curve;
  }

  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Classic soft saturation sigmoid
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Multi-Dimensional Spatial Trajectory Calculation (1D to 32D)
export function calculateSpatialPosition(
  phase: number,
  dimension: number,
  width: number,
  pattern: SpatialPattern
): { x: number; y: number; pan: number } {
  const d = Math.max(1, Math.min(32, Math.round(dimension || 8)));

  if (d === 1) {
    // 1D: Mono Center Anchor
    return { x: 0, y: 0, pan: 0 };
  }

  if (d === 2) {
    // 2D: Stereo Static Panorama (no continuous rotation)
    return { x: 0, y: 1, pan: 0 };
  }

  let x = 0;
  let y = 1;

  if (d === 3) {
    // 3D: Binaural Depth Field (front-back depth emphasized)
    x = Math.sin(phase) * width;
    y = Math.cos(phase) * width * 0.75;
  } else if (d === 4) {
    // 4D: Quad-Corner Matrix (4 distinct cardinal corners with smooth transitions)
    const step = Math.PI / 2;
    const sector = Math.floor(phase / step);
    const frac = (phase % step) / step;
    const smoothFrac = (1 - Math.cos(frac * Math.PI)) / 2;
    const angle = (sector + smoothFrac) * step;
    x = Math.sin(angle) * width;
    y = Math.cos(angle) * width;
  } else if (d === 8 && pattern === 'circular') {
    // 8D: Pure 360-degree circular orbit
    x = Math.sin(phase) * width;
    y = Math.cos(phase) * width;
  } else if (pattern === 'figure8') {
    // Figure-8 infinity trajectory
    x = Math.sin(phase) * width;
    y = Math.sin(2 * phase) * 0.5 * width;
  } else if (pattern === 'pendulum') {
    // Pendulum left-to-right sweep
    x = Math.sin(phase) * width;
    y = 0.5;
  } else {
    // nD (5D to 32D): Multi-vertex spatial polygon trajectory with harmonic overtone matrix
    const step = (2 * Math.PI) / d;
    const sector = Math.floor(phase / step);
    const frac = (phase % step) / step;
    const smoothFrac = (1 - Math.cos(frac * Math.PI)) / 2;
    const baseAngle = (sector + smoothFrac) * step;

    // Higher dimensions (9D to 32D) introduce subtle harmonic Lissajous depth modulation
    let harmonicX = 0;
    let harmonicY = 0;
    if (d >= 9) {
      const harmonicOrder = Math.max(2, Math.floor(d / 4));
      const harmonicWeight = Math.min(0.2, 0.04 + (d / 150));
      harmonicX = Math.sin(harmonicOrder * phase) * harmonicWeight;
      harmonicY = Math.cos((harmonicOrder + 1) * phase) * (harmonicWeight * 0.75);
    }

    x = (Math.sin(baseAngle) + harmonicX) * width;
    y = (Math.cos(baseAngle) + harmonicY) * width;
  }

  const pan = Math.max(-1, Math.min(1, x));
  return { x, y, pan };
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Nodes
  private denoiseRumbleFilter: BiquadFilterNode | null = null;
  private denoiseHumFilter: BiquadFilterNode | null = null;
  private denoiseHissFilter: BiquadFilterNode | null = null;
  private denoiseClarityFilter: BiquadFilterNode | null = null;
  private saturationNode: WaveShaperNode | null = null;
  private eqSubBass: BiquadFilterNode | null = null;
  private eqPunch: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqPresence: BiquadFilterNode | null = null;
  private eqAir: BiquadFilterNode | null = null;
  
  // Reverb
  private convolverNode: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private reverbDampFilter: BiquadFilterNode | null = null;

  // Spatial Panning (8D / 1D-32D)
  private pannerNode: StereoPannerNode | null = null;
  private spatialLfoFrame: number | null = null;
  private spatialIntervalId: number | null = null;
  private spatialPhase: number = 0;
  private currentPanPosition: { x: number; y: number; pan: number } = { x: 0, y: 1, pan: 0 };
  private panListeners: Array<(pos: { x: number; y: number; pan: number }) => void> = [];
  private playbackListeners: Array<(playing: boolean) => void> = [];
  private visibilityListenerAttached = false;

  // Master & Limiter
  private masterGain: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  public analyserNode: AnalyserNode | null = null;
  public streamDestination: MediaStreamAudioDestinationNode | null = null;

  // MediaRecorder for real-time capture
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Track Meta & Settings
  public currentTrack: AudioTrackMeta | null = null;
  public settings: AudioEngineSettings = {
    volume: 0.85,
    playbackRate: 1.0,
    preservePitch: false, // Vintage tape slowdown feels legendary on slowed tracks!

    spatialEnabled: true,
    spatialDimension: 8, // 1D to 32D (Default 8D)
    spatialSpeed: 10, // 10 seconds per rotation
    spatialWidth: 0.85,
    spatialPattern: 'circular',

    reverbEnabled: false,
    reverbPreset: 'hall',
    reverbWet: 0.35,
    reverbDecay: 3.5,
    reverbDampening: 4000,

    eqEnabled: true,
    subBass: 3,
    punch: 1.5,
    mid: 0,
    presence: 1,
    air: 2,
    bassBoost: 2,

    saturationEnabled: false,
    saturationDrive: 3,
    stereoWidth: 1.0,
    limiterEnabled: true,

    // Audio De-Noise & Clean Audio
    denoiseEnabled: false,
    denoiseIntensity: 60,
    deHumEnabled: true,
    deHissEnabled: true,
    noiseGateThreshold: -50,
    vocalClarityBoost: true
  };

  private isInitialized = false;

  constructor() {
    // Lazy initialized on first user interaction
  }

  public init(audioEl: HTMLAudioElement): void {
    if (this.isInitialized && this.ctx && this.ctx.state !== 'closed' && this.audioEl === audioEl) {
      return;
    }

    // If an existing context is running with this audio element, reuse it
    if (this.ctx && this.ctx.state !== 'closed' && this.audioEl === audioEl && this.sourceNode) {
      this.isInitialized = true;
      return;
    }

    this.audioEl = audioEl;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContextClass();
    }

    // 1. Source - attach audio element to audio context
    if (!this.sourceNode) {
      this.sourceNode = this.ctx.createMediaElementSource(audioEl);
    }

    // 1b. De-Noise & Clean Audio DSP Filter Chain
    // Low rumble highpass (cuts sub-35Hz rumble/thumps)
    this.denoiseRumbleFilter = this.ctx.createBiquadFilter();
    this.denoiseRumbleFilter.type = 'highpass';
    this.denoiseRumbleFilter.frequency.value = 10;
    this.denoiseRumbleFilter.Q.value = 0.707;

    // 50/60Hz Mains AC hum notch
    this.denoiseHumFilter = this.ctx.createBiquadFilter();
    this.denoiseHumFilter.type = 'notch';
    this.denoiseHumFilter.frequency.value = 60;
    this.denoiseHumFilter.Q.value = 8;

    // De-Hiss highshelf (removes tape hiss, quantization, high noise floor)
    this.denoiseHissFilter = this.ctx.createBiquadFilter();
    this.denoiseHissFilter.type = 'highshelf';
    this.denoiseHissFilter.frequency.value = 9500;
    this.denoiseHissFilter.gain.value = 0;

    // Acoustic & Vocal presence clarifier
    this.denoiseClarityFilter = this.ctx.createBiquadFilter();
    this.denoiseClarityFilter.type = 'peaking';
    this.denoiseClarityFilter.frequency.value = 2800;
    this.denoiseClarityFilter.Q.value = 1.0;
    this.denoiseClarityFilter.gain.value = 0;

    // 2. Saturation
    this.saturationNode = this.ctx.createWaveShaper();
    this.saturationNode.curve = makeDistortionCurve(0);
    this.saturationNode.oversample = '4x';

    // 3. Multi-Band EQ
    // 60Hz Sub-Bass Shelf
    this.eqSubBass = this.ctx.createBiquadFilter();
    this.eqSubBass.type = 'lowshelf';
    this.eqSubBass.frequency.value = 60;

    // 150Hz Punch Peaking
    this.eqPunch = this.ctx.createBiquadFilter();
    this.eqPunch.type = 'peaking';
    this.eqPunch.frequency.value = 150;
    this.eqPunch.Q.value = 1.0;

    // 1000Hz Vocal / Mid
    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.9;

    // 3500Hz Presence / Snare
    this.eqPresence = this.ctx.createBiquadFilter();
    this.eqPresence.type = 'peaking';
    this.eqPresence.frequency.value = 3500;
    this.eqPresence.Q.value = 1.0;

    // 10000Hz Air / Crisp Shelf
    this.eqAir = this.ctx.createBiquadFilter();
    this.eqAir.type = 'highshelf';
    this.eqAir.frequency.value = 10000;

    // 4. Reverb Convolver & Routing
    this.convolverNode = this.ctx.createConvolver();
    this.convolverNode.buffer = generateImpulseResponse(this.ctx, this.settings.reverbPreset, this.settings.reverbDecay);

    this.reverbDampFilter = this.ctx.createBiquadFilter();
    this.reverbDampFilter.type = 'lowpass';
    this.reverbDampFilter.frequency.value = this.settings.reverbDampening;

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();

    // 5. 8D Spatial Panner
    this.pannerNode = this.ctx.createStereoPanner();

    // 6. Master & Limiter
    this.masterGain = this.ctx.createGain();
    
    // Compressor / Limiter protects against clipping when boosting bass
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -2.0; // dB
    this.limiterNode.knee.value = 4.0;
    this.limiterNode.ratio.value = 12.0;
    this.limiterNode.attack.value = 0.003;
    this.limiterNode.release.value = 0.15;

    // 7. Visualizer Analyser
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.85;

    // 8. Stream destination for recording
    this.streamDestination = this.ctx.createMediaStreamDestination();

    // CONNECT GRAPH:
    // source -> De-Noise / Clean filter chain -> saturation -> EQ chain
    this.sourceNode.connect(this.denoiseRumbleFilter);
    this.denoiseRumbleFilter.connect(this.denoiseHumFilter);
    this.denoiseHumFilter.connect(this.denoiseHissFilter);
    this.denoiseHissFilter.connect(this.denoiseClarityFilter);
    this.denoiseClarityFilter.connect(this.saturationNode);
    this.saturationNode.connect(this.eqSubBass);
    this.eqSubBass.connect(this.eqPunch);
    this.eqPunch.connect(this.eqMid);
    this.eqMid.connect(this.eqPresence);
    this.eqPresence.connect(this.eqAir);

    // From eqAir split to Dry & Wet paths:
    this.eqAir.connect(this.dryGain);

    // Wet: eqAir -> dampFilter -> convolver -> wetGain
    this.eqAir.connect(this.reverbDampFilter);
    this.reverbDampFilter.connect(this.convolverNode);
    this.convolverNode.connect(this.wetGain);

    // Sum Dry & Wet into spatial panner
    this.dryGain.connect(this.pannerNode);
    this.wetGain.connect(this.pannerNode);

    // Panner -> Master Gain -> Limiter
    this.pannerNode.connect(this.masterGain);
    this.masterGain.connect(this.limiterNode);

    // Limiter -> Analyser
    this.limiterNode.connect(this.analyserNode);

    // Analyser -> Output Destination + Stream Destination
    this.analyserNode.connect(this.ctx.destination);
    this.analyserNode.connect(this.streamDestination);

    this.isInitialized = true;
    this.applyAllSettings();
    this.initVisibilityListener();
    this.startSpatialLfo();
    this.setupMediaSession();
  }

  private initVisibilityListener(): void {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return;
    this.visibilityListenerAttached = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden or screen locked: switch to background interval timer
        if (this.spatialLfoFrame) {
          cancelAnimationFrame(this.spatialLfoFrame);
          this.spatialLfoFrame = null;
        }
        this.startBackgroundSpatialTimer();
        
        // Auto-resume audio context if browser suspended it during transition
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      } else {
        // Tab foregrounded: cancel interval and resume 60fps requestAnimationFrame
        if (this.spatialIntervalId) {
          clearInterval(this.spatialIntervalId);
          this.spatialIntervalId = null;
        }
        this.startSpatialLfo();
      }
    });
  }

  public async resumeContext(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('AudioContext resume warning:', err);
      }
    }
  }

  public setTrackMetadata(meta: AudioTrackMeta): void {
    this.currentTrack = meta;
    this.setupMediaSession();
  }

  // Updates Media Session API for background/lock-screen controls
  public setupMediaSession(): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title,
        artist: this.currentTrack.artist || 'YouTube Audio Studio',
        album: 'AuraWave 8D DAW Master',
        artwork: [
          { src: this.currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
          { src: this.currentTrack.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: this.currentTrack.thumbnail, sizes: '128x128', type: 'image/jpeg' },
        ]
      });
    }

    const audio = this.audioEl;
    if (!audio) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        audio.play().catch((err: any) => {
          console.warn('MediaSession play error:', err?.message || 'Autoplay prevented');
        });
        this.notifyPlaybackListeners(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        this.notifyPlaybackListeners(false);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(audio.duration || 999999, audio.currentTime + (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          audio.currentTime = details.seekTime;
        }
      });
    } catch (e) {
      // Ignore unsupported action handler errors
    }
  }

  public notifyPlaybackListeners(playing: boolean): void {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
    for (const listener of this.playbackListeners) {
      listener(playing);
    }
  }

  public onPlaybackChange(cb: (playing: boolean) => void): () => void {
    this.playbackListeners.push(cb);
    return () => {
      this.playbackListeners = this.playbackListeners.filter(l => l !== cb);
    };
  }

  public updateMediaSessionPositionState(): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!this.audioEl || isNaN(this.audioEl.duration) || !isFinite(this.audioEl.duration)) return;

    try {
      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration: this.audioEl.duration,
          playbackRate: this.audioEl.playbackRate,
          position: this.audioEl.currentTime
        });
      }
    } catch (e) {
      // Ignore position state errors
    }
  }

  private stepSpatialLfo(delta: number): void {
    if (!this.pannerNode || !this.ctx) return;

    if (this.settings.spatialEnabled) {
      const speed = Math.max(1, this.settings.spatialSpeed);
      // Advance phase
      this.spatialPhase += (delta / speed) * 2 * Math.PI;
      if (this.spatialPhase > 2 * Math.PI) {
        this.spatialPhase -= 2 * Math.PI;
      }

      const pos = calculateSpatialPosition(
        this.spatialPhase,
        this.settings.spatialDimension || 8,
        this.settings.spatialWidth,
        this.settings.spatialPattern
      );

      const panValue = pos.pan;
      const x = pos.x;
      const y = pos.y;

      // Apply smooth transition to avoid audio clicks
      this.pannerNode.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, panValue)),
        this.ctx.currentTime,
        0.02
      );

      this.currentPanPosition = { x, y, pan: panValue };
      for (const listener of this.panListeners) {
        listener(this.currentPanPosition);
      }
    } else {
      this.pannerNode.pan.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.currentPanPosition = { x: 0, y: 1, pan: 0 };
      for (const listener of this.panListeners) {
        listener(this.currentPanPosition);
      }
    }
  }

  // Continuous LFO loop for Spatial Sound rotation in foreground (60fps requestAnimationFrame)
  private startSpatialLfo(): void {
    if (this.spatialLfoFrame) {
      cancelAnimationFrame(this.spatialLfoFrame);
      this.spatialLfoFrame = null;
    }

    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      this.stepSpatialLfo(delta);
      this.spatialLfoFrame = requestAnimationFrame(loop);
    };

    this.spatialLfoFrame = requestAnimationFrame(loop);
  }

  // Continuous LFO timer for background playback when screen is locked or tab is hidden
  private startBackgroundSpatialTimer(): void {
    if (this.spatialIntervalId) {
      clearInterval(this.spatialIntervalId);
      this.spatialIntervalId = null;
    }

    let lastTimestamp = performance.now();
    // 30ms interval = ~33 updates/sec in background without throttling
    this.spatialIntervalId = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      this.stepSpatialLfo(delta);
    }, 30);
  }

  public onPanUpdate(cb: (pos: { x: number; y: number; pan: number }) => void): () => void {
    this.panListeners.push(cb);
    return () => {
      this.panListeners = this.panListeners.filter(l => l !== cb);
    };
  }

  public applyAllSettings(): void {
    this.updatePlaybackRate();
    this.updateDenoiser();
    this.updateEQ();
    this.updateReverb();
    this.updateSaturation();
    this.updateMaster();
  }

  public updatePlaybackRate(): void {
    if (!this.audioEl) return;
    this.audioEl.playbackRate = this.settings.playbackRate;
    // When preservePitch is FALSE, pitch slows down naturally (vintage tape / slowed & reverbed vibe)
    if ('preservesPitch' in this.audioEl) {
      (this.audioEl as any).preservesPitch = this.settings.preservePitch;
    }
    if ('mozPreservesPitch' in this.audioEl) {
      (this.audioEl as any).mozPreservesPitch = this.settings.preservePitch;
    }
    if ('webkitPreservesPitch' in this.audioEl) {
      (this.audioEl as any).webkitPreservesPitch = this.settings.preservePitch;
    }
    this.updateMediaSessionPositionState();
  }

  public updateEQ(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isEq = this.settings.eqEnabled;

    // Sub-bass (lowshelf 60Hz) with Bass Boost multiplier
    const totalSub = isEq ? (this.settings.subBass + (this.settings.bassBoost * 1.5)) : 0;
    this.eqSubBass?.gain.setTargetAtTime(Math.max(-20, Math.min(24, totalSub)), now, 0.03);

    // Punch 150Hz
    const totalPunch = isEq ? (this.settings.punch + (this.settings.bassBoost * 0.5)) : 0;
    this.eqPunch?.gain.setTargetAtTime(Math.max(-18, Math.min(18, totalPunch)), now, 0.03);

    // Mid 1000Hz
    this.eqMid?.gain.setTargetAtTime(isEq ? this.settings.mid : 0, now, 0.03);

    // Presence 3500Hz
    this.eqPresence?.gain.setTargetAtTime(isEq ? this.settings.presence : 0, now, 0.03);

    // Air 10000Hz
    this.eqAir?.gain.setTargetAtTime(isEq ? this.settings.air : 0, now, 0.03);
  }

  public updateReverb(): void {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;
    const now = this.ctx.currentTime;

    if (!this.settings.reverbEnabled) {
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.03);
      return;
    }

    const wet = Math.max(0, Math.min(1, this.settings.reverbWet));
    // Equal-power crossfade between Dry and Wet
    const dryVal = Math.cos(wet * 0.5 * Math.PI);
    const wetVal = Math.sin(wet * 0.5 * Math.PI);

    this.dryGain.gain.setTargetAtTime(dryVal, now, 0.03);
    this.wetGain.gain.setTargetAtTime(wetVal, now, 0.03);

    if (this.reverbDampFilter) {
      this.reverbDampFilter.frequency.setTargetAtTime(this.settings.reverbDampening, now, 0.03);
    }
  }

  public regenerateReverbIR(preset?: ReverbPreset, decay?: number): void {
    if (!this.ctx || !this.convolverNode) return;
    const p = preset || this.settings.reverbPreset;
    const d = decay ?? this.settings.reverbDecay;
    this.convolverNode.buffer = generateImpulseResponse(this.ctx, p, d, this.settings.reverbDampening);
  }

  public updateSaturation(): void {
    if (!this.saturationNode) return;
    const amount = this.settings.saturationEnabled ? this.settings.saturationDrive * 5 : 0;
    this.saturationNode.curve = makeDistortionCurve(amount);
  }

  public updateMaster(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.volume, now, 0.03);

    if (this.limiterNode) {
      if (this.settings.limiterEnabled) {
        this.limiterNode.ratio.setTargetAtTime(12, now, 0.03);
      } else {
        this.limiterNode.ratio.setTargetAtTime(1, now, 0.03); // bypass compression
      }
    }
  }

  public updateDenoiser(): void {
    if (!this.ctx || !this.denoiseRumbleFilter || !this.denoiseHumFilter || !this.denoiseHissFilter || !this.denoiseClarityFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    const isEnabled = this.settings.denoiseEnabled;
    const intensity = Math.max(0, Math.min(100, this.settings.denoiseIntensity)) / 100;

    if (!isEnabled) {
      // Clean bypass: Rumble highpass down to 10Hz, Hum notch down to 10Hz, Hiss gain to 0dB, Clarity gain to 0dB
      this.denoiseRumbleFilter.frequency.setTargetAtTime(10, now, 0.03);
      this.denoiseHumFilter.frequency.setTargetAtTime(10, now, 0.03);
      this.denoiseHissFilter.gain.setTargetAtTime(0, now, 0.03);
      this.denoiseClarityFilter.gain.setTargetAtTime(0, now, 0.03);
      return;
    }

    // 1. High-pass filter cuts sub-rumble, HVAC, mic handling noise below 35Hz - 60Hz
    const rumbleFreq = 32 + (intensity * 28);
    this.denoiseRumbleFilter.frequency.setTargetAtTime(rumbleFreq, now, 0.03);

    // 2. 50Hz/60Hz Mains AC hum notch filter
    if (this.settings.deHumEnabled) {
      this.denoiseHumFilter.frequency.setTargetAtTime(60, now, 0.03);
      this.denoiseHumFilter.Q.setTargetAtTime(8 + (intensity * 6), now, 0.03);
    } else {
      this.denoiseHumFilter.frequency.setTargetAtTime(10, now, 0.03);
    }

    // 3. De-Hiss high-shelf filter (cleans tape hiss, mic noise floor, analog static)
    if (this.settings.deHissEnabled) {
      const hissAtten = -(3 + (intensity * 10)); // -3dB down to -13dB
      const hissFreq = 11500 - (intensity * 3000); // 11.5kHz down to 8.5kHz
      this.denoiseHissFilter.frequency.setTargetAtTime(hissFreq, now, 0.03);
      this.denoiseHissFilter.gain.setTargetAtTime(hissAtten, now, 0.03);
    } else {
      this.denoiseHissFilter.gain.setTargetAtTime(0, now, 0.03);
    }

    // 4. Vocal & Instrument Clarity Exciter (+1.5dB to +4.0dB in the 2.8kHz presence sweet spot)
    if (this.settings.vocalClarityBoost) {
      const clarityBoost = 1.5 + (intensity * 2.5);
      this.denoiseClarityFilter.frequency.setTargetAtTime(2800, now, 0.03);
      this.denoiseClarityFilter.gain.setTargetAtTime(clarityBoost, now, 0.03);
    } else {
      this.denoiseClarityFilter.gain.setTargetAtTime(0, now, 0.03);
    }
  }

  public clearTrack(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    }
    this.currentTrack = null;
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }

  // Real-time recording via MediaRecorder API
  public startLiveRecording(): void {
    if (!this.streamDestination) throw new Error('Audio engine not initialized');
    this.recordedChunks = [];
    
    // Choose best supported mimeType
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = '';
    }

    const options = mimeType ? { mimeType } : undefined;
    this.mediaRecorder = new MediaRecorder(this.streamDestination.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250);
  }

  public stopLiveRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording active'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = [];
        this.mediaRecorder = null;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Offline Rendering: Renders the entire track with all active effects
   * (8D rotation, Slowed & Reverb IR, EQ, Bass Boost, Saturation, Master Limiter)
   * into a studio-grade 16-bit 44.1kHz stereo WAV file.
   */
  public async exportRenderedWav(
    audioBlobOrUrl: string | Blob,
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    onProgress?.(5);

    // 1. Fetch & decode audio source buffer
    let arrayBuffer: ArrayBuffer;
    if (typeof audioBlobOrUrl === 'string') {
      const resp = await fetch(audioBlobOrUrl);
      if (!resp.ok) throw new Error('Failed to download source audio for export');
      arrayBuffer = await resp.arrayBuffer();
    } else {
      arrayBuffer = await audioBlobOrUrl.arrayBuffer();
    }

    onProgress?.(20);

    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sourceBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close();

    onProgress?.(35);

    // 2. Setup OfflineAudioContext
    const sampleRate = 44100;
    // Calculate new length based on playback rate
    const rate = this.settings.playbackRate;
    const targetLength = Math.ceil((sourceBuffer.length / rate) + (this.settings.reverbEnabled ? this.settings.reverbDecay * sampleRate : 0));
    
    const offlineCtx = new OfflineAudioContext(2, targetLength, sampleRate);

    // 3. Build DSP graph in OfflineAudioContext
    const bufSource = offlineCtx.createBufferSource();
    bufSource.buffer = sourceBuffer;
    bufSource.playbackRate.value = rate;

    // De-Noise & Clean Audio Offline Filter Chain
    const offRumble = offlineCtx.createBiquadFilter();
    offRumble.type = 'highpass';
    const intensity = Math.max(0, Math.min(100, this.settings.denoiseIntensity)) / 100;
    offRumble.frequency.value = this.settings.denoiseEnabled ? (32 + (intensity * 28)) : 10;
    offRumble.Q.value = 0.707;

    const offHum = offlineCtx.createBiquadFilter();
    offHum.type = 'notch';
    offHum.frequency.value = (this.settings.denoiseEnabled && this.settings.deHumEnabled) ? 60 : 10;
    offHum.Q.value = 8 + (intensity * 6);

    const offHiss = offlineCtx.createBiquadFilter();
    offHiss.type = 'highshelf';
    if (this.settings.denoiseEnabled && this.settings.deHissEnabled) {
      offHiss.frequency.value = 11500 - (intensity * 3000);
      offHiss.gain.value = -(3 + (intensity * 10));
    } else {
      offHiss.frequency.value = 9500;
      offHiss.gain.value = 0;
    }

    const offClarity = offlineCtx.createBiquadFilter();
    offClarity.type = 'peaking';
    offClarity.frequency.value = 2800;
    offClarity.Q.value = 1.0;
    offClarity.gain.value = (this.settings.denoiseEnabled && this.settings.vocalClarityBoost) ? (1.5 + (intensity * 2.5)) : 0;

    // Saturation
    const sat = offlineCtx.createWaveShaper();
    sat.curve = makeDistortionCurve(this.settings.saturationEnabled ? this.settings.saturationDrive * 5 : 0);
    sat.oversample = '4x';

    // EQ
    const eqSub = offlineCtx.createBiquadFilter();
    eqSub.type = 'lowshelf';
    eqSub.frequency.value = 60;
    eqSub.gain.value = this.settings.eqEnabled ? (this.settings.subBass + (this.settings.bassBoost * 1.5)) : 0;

    const eqPunch = offlineCtx.createBiquadFilter();
    eqPunch.type = 'peaking';
    eqPunch.frequency.value = 150;
    eqPunch.gain.value = this.settings.eqEnabled ? (this.settings.punch + (this.settings.bassBoost * 0.5)) : 0;

    const eqMid = offlineCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.gain.value = this.settings.eqEnabled ? this.settings.mid : 0;

    const eqPres = offlineCtx.createBiquadFilter();
    eqPres.type = 'peaking';
    eqPres.frequency.value = 3500;
    eqPres.gain.value = this.settings.eqEnabled ? this.settings.presence : 0;

    const eqAir = offlineCtx.createBiquadFilter();
    eqAir.type = 'highshelf';
    eqAir.frequency.value = 10000;
    eqAir.gain.value = this.settings.eqEnabled ? this.settings.air : 0;

    // Reverb
    const dry = offlineCtx.createGain();
    const wet = offlineCtx.createGain();
    const conv = offlineCtx.createConvolver();
    conv.buffer = generateImpulseResponse(offlineCtx, this.settings.reverbPreset, this.settings.reverbDecay, this.settings.reverbDampening);

    const damp = offlineCtx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = this.settings.reverbDampening;

    if (this.settings.reverbEnabled) {
      const wetAmt = Math.max(0, Math.min(1, this.settings.reverbWet));
      dry.gain.value = Math.cos(wetAmt * 0.5 * Math.PI);
      wet.gain.value = Math.sin(wetAmt * 0.5 * Math.PI);
    } else {
      dry.gain.value = 1.0;
      wet.gain.value = 0.0;
    }

    // 8D Panner automation
    const panner = offlineCtx.createStereoPanner();
    if (this.settings.spatialEnabled) {
      const speed = Math.max(1, this.settings.spatialSpeed);
      const totalDuration = targetLength / sampleRate;
      const step = 0.05; // 20 times per second
      for (let t = 0; t < totalDuration; t += step) {
        const phase = (t / speed) * 2 * Math.PI;
        const pos = calculateSpatialPosition(
          phase,
          this.settings.spatialDimension || 8,
          this.settings.spatialWidth,
          this.settings.spatialPattern
        );
        panner.pan.setValueAtTime(pos.pan, t);
      }
    } else {
      panner.pan.value = 0;
    }

    // Master & Limiter
    const master = offlineCtx.createGain();
    master.gain.value = this.settings.volume;

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -2.0;
    limiter.ratio.value = this.settings.limiterEnabled ? 12.0 : 1.0;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;

    // Connections
    bufSource.connect(offRumble);
    offRumble.connect(offHum);
    offHum.connect(offHiss);
    offHiss.connect(offClarity);
    offClarity.connect(sat);
    sat.connect(eqSub);
    eqSub.connect(eqPunch);
    eqPunch.connect(eqMid);
    eqMid.connect(eqPres);
    eqPres.connect(eqAir);

    eqAir.connect(dry);
    eqAir.connect(damp);
    damp.connect(conv);
    conv.connect(wet);

    dry.connect(panner);
    wet.connect(panner);

    panner.connect(master);
    master.connect(limiter);
    limiter.connect(offlineCtx.destination);

    bufSource.start(0);

    onProgress?.(55);

    // 4. Render audio
    const renderedBuffer = await offlineCtx.startRendering();

    onProgress?.(85);

    // 5. Encode into WAV Blob
    const wavBlob = audioBufferToWavBlob(renderedBuffer);

    onProgress?.(100);
    return wavBlob;
  }

  public destroy(): void {
    if (this.spatialLfoFrame) {
      cancelAnimationFrame(this.spatialLfoFrame);
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch((err: any) => {
        console.warn('AudioContext close note:', err?.message || 'Context closed');
      });
    }
  }
}

// Global engine singleton
export const audioEngine = new AudioEngine();
