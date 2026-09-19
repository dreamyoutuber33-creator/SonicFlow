import { DemoTrack } from '../types/audio.ts';

export const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'demo-synthwave',
    title: 'Neon Odyssey (Retro Synthwave)',
    artist: 'CyberPulse Soundworks',
    thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
    url: '/audio/synthwave.mp3',
    duration: 145,
    tag: 'Synthwave 8D'
  },
  {
    id: 'demo-lofi',
    title: 'Midnight Rain & Warm Coffee',
    artist: 'Aura Chillhop Records',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    url: '/audio/lofi.mp3',
    duration: 172,
    tag: 'Slowed + Reverb'
  },
  {
    id: 'demo-cyberpunk',
    title: 'Tokyo Hyperdrive (Bass Boosted)',
    artist: 'Sector 9 Industrial',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    url: '/audio/cyberpunk.mp3',
    duration: 138,
    tag: 'Heavy Bass'
  },
  {
    id: 'demo-celestial',
    title: 'Astral Echoes (Cathedral Reverb)',
    artist: 'Serenade Ensemble',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
    url: '/audio/celestial.mp3',
    duration: 184,
    tag: 'Spatial 3D'
  },
  {
    id: 'demo-rickroll',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    url: '/audio/demo-rickroll.mp3',
    duration: 213,
    tag: 'Studio Master'
  }
];
