export type VisualizerMode = 'spectrum' | 'waveform' | 'radial';

export type SpatialPattern = 'circular' | 'figure8' | 'pendulum';

export type ReverbPreset = 'bedroom' | 'studio' | 'hall' | 'cathedral' | 'stadium' | 'space';

export interface EQPreset {
  name: string;
  subBass: number; // 60Hz (-15 to 15)
  punch: number;   // 150Hz (-12 to 12)
  mid: number;     // 1000Hz (-12 to 12)
  presence: number;// 3500Hz (-12 to 12)
  air: number;     // 10000Hz (-12 to 15)
  bassBoost: number; // 0 to 10
}

export interface AudioTrackMeta {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // seconds
  sourceUrl?: string;
  isLocal?: boolean;
}

export interface AudioEngineSettings {
  // Master
  volume: number; // 0 to 1
  playbackRate: number; // 0.5 to 1.5
  preservePitch: boolean;

  // 8D Dimensional Audio
  spatialEnabled: boolean;
  spatialDimension: number; // 1 to 32 (1D, 2D, 3D, 4D ... 32D)
  spatialSpeed: number; // in seconds per rotation (e.g., 2s - 20s)
  spatialWidth: number; // 0 to 1 (depth of orbit)
  spatialPattern: SpatialPattern;

  // Slowed & Reverb
  reverbEnabled: boolean;
  reverbPreset: ReverbPreset;
  reverbWet: number; // 0 to 1
  reverbDecay: number; // 0.5s to 10s
  reverbDampening: number; // 1000Hz to 18000Hz lowpass filter

  // Equalizer
  eqEnabled: boolean;
  subBass: number; // dB
  punch: number;   // dB
  mid: number;     // dB
  presence: number;// dB
  air: number;     // dB
  bassBoost: number; // extra sub-bass push (0 to 10)

  // Extra Mastering Polish
  saturationEnabled: boolean;
  saturationDrive: number; // 0 to 10
  stereoWidth: number; // 1 to 2
  limiterEnabled: boolean;

  // Audio De-Noise & Clean Song DSP
  denoiseEnabled: boolean;
  denoiseIntensity: number; // 0 to 100%
  deHumEnabled: boolean; // 50/60Hz electrical hum notch filter
  deHissEnabled: boolean; // High frequency tape/mic hiss filter
  noiseGateThreshold: number; // -70dB to -30dB
  vocalClarityBoost: boolean; // Harmonic presence clarifier
}

export interface DemoTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  url: string;
  duration: number;
  tag: string;
}
