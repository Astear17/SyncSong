/**
 * Audio Player - Handle audio playback with WaveSurfer.js waveform visualization
 */

import WaveSurfer from 'wavesurfer.js';

export class AudioPlayer {
  constructor() {
    this.wavesurfer = null;
    this.container = null;
    this.isPlaying = false;
    this.duration = 0;
    this.currentTime = 0;
    this.fileName = '';
    this._isReady = false;
    this._pendingFile = null;
    
    // Callbacks
    this.onTimeUpdate = null;
    this.onDurationChange = null;
    this.onPlay = null;
    this.onPause = null;
    this.onEnded = null;
    this.onError = null;
    this.onReady = null;
  }
  
  /**
   * Initialize WaveSurfer instance with a container
   * @param {string|HTMLElement} container - Container element or selector
   */
  init(container) {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    
    this.container = container;
    this.wavesurfer = WaveSurfer.create({
      container: container,
      waveColor: '#64748b',
      progressColor: '#6366f1',
      cursorColor: '#a5b4fc',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 60,
      normalize: true,
    });
    
    this._setupEventListeners();
    
    // Load pending file if any
    if (this._pendingFile) {
      this._loadFileInternal(this._pendingFile);
      this._pendingFile = null;
    }
  }
  
  _setupEventListeners() {
    if (!this.wavesurfer) return;
    
    this.wavesurfer.on('timeupdate', (time) => {
      this.currentTime = time;
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.currentTime);
      }
    });
    
    this.wavesurfer.on('ready', () => {
      this.duration = this.wavesurfer.getDuration();
      this._isReady = true;
      if (this.onDurationChange) {
        this.onDurationChange(this.duration);
      }
      if (this.onReady) {
        this.onReady();
      }
    });
    
    this.wavesurfer.on('play', () => {
      this.isPlaying = true;
      if (this.onPlay) this.onPlay();
    });
    
    this.wavesurfer.on('pause', () => {
      this.isPlaying = false;
      if (this.onPause) this.onPause();
    });
    
    this.wavesurfer.on('finish', () => {
      this.isPlaying = false;
      if (this.onEnded) this.onEnded();
    });
    
    this.wavesurfer.on('error', (e) => {
      console.error('WaveSurfer error:', e);
      if (this.onError) this.onError(e);
    });
  }
  
  _loadFileInternal(file) {
    this._isReady = false;
    this.fileName = file.name;
    const url = URL.createObjectURL(file);
    this.wavesurfer.load(url);
  }
  
  /**
   * Load audio from a File object
   * @param {File} file - Audio file
   */
  loadFile(file) {
    if (!this.wavesurfer) {
      // Store file to load when init is called
      this._pendingFile = file;
      this.fileName = file.name;
      return;
    }
    
    this._loadFileInternal(file);
  }
  
  /**
   * Check if player is ready
   * @returns {boolean}
   */
  get isReady() {
    return this._isReady;
  }
  
  /**
   * Play audio
   */
  play() {
    if (this.wavesurfer && this._isReady) {
      this.wavesurfer.play();
    }
  }
  
  /**
   * Pause audio
   */
  pause() {
    if (this.wavesurfer) {
      this.wavesurfer.pause();
    }
  }
  
  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.wavesurfer && this._isReady) {
      this.wavesurfer.playPause();
    }
  }
  
  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  seek(time) {
    if (this.wavesurfer && this._isReady && this.duration > 0) {
      const clampedTime = Math.max(0, Math.min(time, this.duration));
      this.wavesurfer.setTime(clampedTime);
    }
  }
  
  /**
   * Seek relative to current time
   * @param {number} delta - Time delta in seconds
   */
  seekRelative(delta) {
    this.seek(this.currentTime + delta);
  }
  
  /**
   * Set volume
   * @param {number} volume - Volume level 0-1
   */
  setVolume(volume) {
    if (this.wavesurfer) {
      this.wavesurfer.setVolume(Math.max(0, Math.min(1, volume)));
    }
  }
  
  /**
   * Get current volume
   * @returns {number}
   */
  getVolume() {
    return this.wavesurfer ? this.wavesurfer.getVolume() : 1;
  }
  
  /**
   * Format time as mm:ss
   * @param {number} seconds
   * @returns {string}
   */
  static formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    this._isReady = false;
    this.duration = 0;
    this.currentTime = 0;
  }
}
