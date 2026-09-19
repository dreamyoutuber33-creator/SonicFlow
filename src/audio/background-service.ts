// Background Playback Service
// Keeps audio playing and multi-dimensional spatial effects running when tabs are switched or screen is locked.

export interface BackgroundServiceStatus {
  enabled: boolean;
  serviceWorkerRegistered: boolean;
  wakeLockSupported: boolean;
  wakeLockActive: boolean;
  isBackgrounded: boolean;
  mediaSessionActive: boolean;
  keepAlivePings: number;
}

type StatusListener = (status: BackgroundServiceStatus) => void;

class BackgroundPlaybackService {
  private enabled = true;
  private wakeLockSentinel: any = null;
  private serviceWorkerReg: ServiceWorkerRegistration | null = null;
  private statusListeners: StatusListener[] = [];
  private keepAliveInterval: number | null = null;
  private keepAlivePings = 0;
  private isBackgrounded = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    this.isBackgrounded = document.visibilityState === 'hidden';

    // 1. Register Service Worker
    this.registerServiceWorker();

    // 2. Listen to document visibility changes (tab switch / screen lock)
    document.addEventListener('visibilitychange', () => {
      this.isBackgrounded = document.visibilityState === 'hidden';
      this.notifyListeners();

      if (this.isBackgrounded) {
        // Tab moved to background or screen locked
        this.onTabBackgrounded();
      } else {
        // Tab restored to foreground
        this.onTabForegrounded();
      }
    });

    // 3. Keep-alive heartbeat interval to prevent mobile browser deep sleep
    this.startKeepAlive();
  }

  private async registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.serviceWorkerReg = reg;
      this.notifyListeners();
    } catch (err) {
      console.warn('Service Worker registration note:', err);
    }
  }

  private startKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = window.setInterval(() => {
      this.keepAlivePings++;
      
      // Ping service worker if active
      if (this.serviceWorkerReg?.active) {
        this.serviceWorkerReg.active.postMessage({
          type: 'BACKGROUND_AUDIO_ACTIVE',
          timestamp: Date.now()
        });
      }

      this.notifyListeners();
    }, 4000);
  }

  private async onTabBackgrounded() {
    if (!this.enabled) return;

    // Ping service worker
    if (this.serviceWorkerReg?.active) {
      this.serviceWorkerReg.active.postMessage({
        type: 'BACKGROUND_AUDIO_ACTIVE',
        state: 'hidden'
      });
    }

    // Re-ensure wake lock if active
    if (!this.wakeLockSentinel && 'wakeLock' in navigator) {
      await this.requestWakeLock();
    }
  }

  private onTabForegrounded() {
    // Tab back in view
    this.notifyListeners();
  }

  public async requestWakeLock(): Promise<boolean> {
    if (!this.enabled) return false;
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return false;

    try {
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
        this.notifyListeners();
      });

      this.notifyListeners();
      return true;
    } catch (e) {
      // WakeLock may be rejected if page is not visible or power saving restricts it
      return false;
    }
  }

  public async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch (e) {
        // Ignore release errors
      }
      this.wakeLockSentinel = null;
      this.notifyListeners();
    }
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) {
      this.releaseWakeLock();
    }
    this.notifyListeners();
  }

  public getStatus(): BackgroundServiceStatus {
    return {
      enabled: this.enabled,
      serviceWorkerRegistered: !!this.serviceWorkerReg,
      wakeLockSupported: typeof window !== 'undefined' && 'wakeLock' in navigator,
      wakeLockActive: !!this.wakeLockSentinel,
      isBackgrounded: this.isBackgrounded,
      mediaSessionActive: typeof window !== 'undefined' && 'mediaSession' in navigator,
      keepAlivePings: this.keepAlivePings,
    };
  }

  public onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

export const backgroundService = new BackgroundPlaybackService();
