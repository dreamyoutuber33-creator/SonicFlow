import { ReverbPreset } from '../types/audio.ts';

/**
 * Generates high-quality algorithmic impulse responses for Web Audio ConvolverNode.
 * Produces stereo decorrelated reflections, early reflections, and natural frequency damping.
 */
export function generateImpulseResponse(
  ctx: BaseAudioContext,
  preset: ReverbPreset,
  customDecay?: number,
  customDampening?: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  
  // Preset defaults
  const presetConfigs: Record<ReverbPreset, { decay: number; preDelay: number; reverse: boolean; damping: number }> = {
    bedroom: { decay: 1.2, preDelay: 0.01, reverse: false, damping: 3500 },
    studio: { decay: 2.0, preDelay: 0.02, reverse: false, damping: 5000 },
    hall: { decay: 3.5, preDelay: 0.035, reverse: false, damping: 4000 },
    cathedral: { decay: 6.0, preDelay: 0.05, reverse: false, damping: 2500 },
    stadium: { decay: 7.5, preDelay: 0.08, reverse: false, damping: 3000 },
    space: { decay: 10.0, preDelay: 0.1, reverse: false, damping: 8000 }
  };

  const config = presetConfigs[preset] || presetConfigs.hall;
  const decayTime = customDecay ?? config.decay;
  const length = Math.max(0.5, Math.min(12, decayTime)) * sampleRate;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const preDelaySamples = Math.floor(config.preDelay * sampleRate);
  const dampingFactor = (customDampening ?? config.damping) / sampleRate;

  // Simple lowpass filter state for frequency damping
  let lastL = 0;
  let lastR = 0;

  for (let i = 0; i < length; i++) {
    if (i < preDelaySamples) {
      left[i] = 0;
      right[i] = 0;
      continue;
    }

    const t = (i - preDelaySamples) / sampleRate;
    // Exponential decay envelope
    const envelope = Math.exp(-3 * (t / decayTime));

    // White noise stereo source with decorrelation
    let rawL = (Math.random() * 2 - 1);
    let rawR = (Math.random() * 2 - 1);

    // Add discrete early reflections
    if (t < 0.1) {
      if (Math.random() > 0.85) rawL *= 2.0;
      if (Math.random() > 0.85) rawR *= 2.0;
    }

    // One-pole IIR lowpass filter for natural HF absorption over distance
    const alpha = Math.min(1, Math.max(0.05, dampingFactor * Math.exp(-t)));
    lastL += alpha * (rawL - lastL);
    lastR += alpha * (rawR - lastR);

    left[i] = lastL * envelope;
    right[i] = lastR * envelope;
  }

  return buffer;
}
