/**
 * UI - DOM manipulation and event handling for wizard interface
 */

import { formatTimestamp } from './lrc-parser.js';
import { AudioPlayer } from './audio-player.js';
import * as musicMetadata from 'music-metadata';

export class UI {
  constructor(editor, player) {
    this.editor = editor;
    this.player = player;
    this.currentStep = 1;
    this.editingLineIndex = null; // Track which line is being edited
    this._isUserSeeking = false; // Prevent auto-selection during user-initiated seeks
    this._seekTimeoutId = null; // Debounce timeout for user seeking
    this._isMarkingMode = false; // Prevent auto-selection during tap-to-sync marking
    this.audioMetadata = null; // Extracted audio file metadata (artist, title, album, duration)
    
    // Cache DOM elements
    this.elements = {
      // Wizard steps
      step1Content: document.getElementById('step-1-content'),
      step2Content: document.getElementById('step-2-content'),
      step3Content: document.getElementById('step-3-content'),
      step4Content: document.getElementById('step-4-content'),
      
      // Step indicators
      stepIndicators: document.querySelectorAll('.step-indicator'),
      
      // Step 1: Song
      audioDropZone: document.getElementById('audio-drop-zone'),
      songInfo: document.getElementById('song-info'),
      songFilename: document.getElementById('song-filename'),
      songDuration: document.getElementById('song-duration'),
      btnChangeSong: document.getElementById('btn-change-song'),
      
      // Step 2: Lyrics
      btnSearchLrclib: document.getElementById('btn-search-lrclib'),
      btnOpenLyrics: document.getElementById('btn-open-lyrics'),
      lrclibSearch: document.getElementById('lrclib-search'),
      lrclibQuery: document.getElementById('lrclib-query'),
      btnLrclibSearch: document.getElementById('btn-lrclib-search'),
      lrclibResults: document.getElementById('lrclib-results'),
      lyricsInput: document.getElementById('lyrics-input'),
      metaArtist: document.getElementById('meta-artist'),
      metaTitle: document.getElementById('meta-title'),
      metaAlbum: document.getElementById('meta-album'),
      btnBack2: document.getElementById('btn-back-2'),
      btnNext2: document.getElementById('btn-next-2'),
      
      // Shared player (steps 2 and 3)
      playerPanel: document.getElementById('player-panel'),
      waveform: document.getElementById('waveform'),
      btnPlay: document.getElementById('btn-play'),
      trackName: document.getElementById('track-name'),
      timeCurrent: document.getElementById('time-current'),
      timeTotal: document.getElementById('time-total'),
      autoPlayToggle: document.getElementById('auto-play-toggle'),
      
      // Step 3: Sync
      lineCounter: document.getElementById('line-counter'),
      lyricsDisplay: document.getElementById('lyrics-display'),
      btnAddLine: document.getElementById('btn-add-line'),
      btnAdjustDown: document.getElementById('btn-adjust-down'),
      btnAdjustUp: document.getElementById('btn-adjust-up'),
      btnMark: document.getElementById('btn-mark'),
      btnBack3: document.getElementById('btn-back-3'),
      btnNext3: document.getElementById('btn-next-3'),
      
      // Step 4: Export
      lrcPreview: document.getElementById('lrc-preview'),
      btnCopy: document.getElementById('btn-copy'),
      btnDownload: document.getElementById('btn-download'),
      btnPublish: document.getElementById('btn-publish'),
      publishStatus: document.getElementById('publish-status'),
      btnBack4: document.getElementById('btn-back-4'),
      btnStartOver: document.getElementById('btn-start-over'),
    };
    
    this._setupEventListeners();
    this._setupEditorCallbacks();
    this._setupPlayerCallbacks();
  }
  
  _setupEventListeners() {
    // Step navigation buttons
    this.elements.btnBack2?.addEventListener('click', () => this._goToStep(1));
    this.elements.btnNext2?.addEventListener('click', async () => {
      await this._parseLyricsInput();
      this._goToStep(3);
    });
    this.elements.btnBack3?.addEventListener('click', () => this._goToStep(2));
    this.elements.btnNext3?.addEventListener('click', () => {
      this._updateLrcPreview();
      this._goToStep(4);
    });
    this.elements.btnBack4?.addEventListener('click', () => this._goToStep(3));
    this.elements.btnStartOver?.addEventListener('click', () => this._startOver());
    
    // Step indicators (clickable)
    this.elements.stepIndicators.forEach(indicator => {
      indicator.addEventListener('click', () => {
        const step = parseInt(indicator.dataset.step, 10);
        if (this._canGoToStep(step)) {
          this._goToStep(step);
        }
      });
    });
    
    // Step 1: Audio drop zone
    this._setupDropZone(this.elements.audioDropZone, this._handleAudioFile.bind(this));
    this.elements.btnChangeSong?.addEventListener('click', () => {
      this.elements.songInfo.classList.add('hidden');
      this.elements.audioDropZone.classList.remove('hidden');
    });
    
    // Step 2: lrclib search
    this.elements.btnSearchLrclib?.addEventListener('click', () => {
      this._openLrclibSearch();
    });
    this.elements.btnLrclibSearch?.addEventListener('click', () => {
      this._searchLrclib();
    });
    this.elements.lrclibQuery?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._searchLrclib();
    });
    
    // Step 2: Open file button
    this.elements.btnOpenLyrics?.addEventListener('click', () => {
      this._openLyricsFile();
    });
    
    // Step 2: Lyrics textarea as drop zone
    this._setupTextareaDropZone(this.elements.lyricsInput, this._handleLyricsFile.bind(this));
    
    // Lyrics input change detection
    this.elements.lyricsInput?.addEventListener('input', () => {
      this._updateLyricsNextButton();
    });
    
    // Step 3: Player controls
    this.elements.btnPlay?.addEventListener('click', () => {
      this.player.togglePlay();
    });
    
    // Lyrics display keyboard/wheel controls
    this.elements.lyricsDisplay?.addEventListener('keydown', (e) => {
      this._handleKeyboard(e);
    });
    
    // Add line button
    this.elements.btnAddLine?.addEventListener('click', () => {
      this._addNewLine();
    });
    
    // Mobile sync controls
    this.elements.btnAdjustDown?.addEventListener('click', () => {
      this._adjustTimestamp(-0.1);
    });
    
    this.elements.btnAdjustUp?.addEventListener('click', () => {
      this._adjustTimestamp(0.1);
    });
    
    this.elements.btnMark?.addEventListener('click', () => {
      this._markCurrentLine();
    });
    
    // Step 4: Export buttons
    this.elements.btnCopy?.addEventListener('click', () => this._copyToClipboard());
    this.elements.btnDownload?.addEventListener('click', () => this._downloadLRC());
    this.elements.btnPublish?.addEventListener('click', () => this._publishToLrclib());
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && 
          e.target !== this.elements.lyricsInput && 
          e.target !== this.elements.lrclibQuery &&
          this.currentStep === 3) {
        e.preventDefault();
        this.player.togglePlay();
      }
    });
  }
  
  _setupDropZone(element, handler) {
    if (!element) return;
    
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', () => {
      element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handler(file);
    });
    
    element.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*,.mp3,.flac,.ogg,.m4a,.wav';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handler(file);
      };
      input.click();
    });
  }
  
  async _handleAudioFile(file) {
    this.player.loadFile(file);
    
    // Show song info
    this.elements.songFilename.textContent = file.name;
    this.elements.songInfo.classList.remove('hidden');
    this.elements.audioDropZone.classList.add('hidden');
    
    // Extract metadata from audio file
    await this._extractAudioMetadata(file);
    
    // Auto-advance to step 2
    this._goToStep(2);
  }
  
  async _extractAudioMetadata(file) {
    try {
      const metadata = await musicMetadata.parseBlob(file);
      const { artist, album, title } = metadata.common;
      
      // Store metadata for lrclib lookups
      this.audioMetadata = {
        artist: artist || null,
        title: title || null,
        album: album || null
      };
      
      // Build display name from tags or fall back to filename
      let displayName;
      if (title) {
        displayName = artist ? `${artist} - ${title}` : title;
      } else {
        // Remove file extension for display
        displayName = file.name.replace(/\.[^/.]+$/, '');
      }
      
      // Update track name display
      if (this.elements.trackName) {
        this.elements.trackName.textContent = displayName;
      }
      
      // Pre-fill metadata fields if available
      if (artist && this.elements.metaArtist) {
        this.elements.metaArtist.value = artist;
      }
      if (title && this.elements.metaTitle) {
        this.elements.metaTitle.value = title;
      }
      if (album && this.elements.metaAlbum) {
        this.elements.metaAlbum.value = album;
      }
    } catch (err) {
      console.warn('Could not read audio metadata:', err);
      this.audioMetadata = null;
      // Fall back to filename
      const displayName = file.name.replace(/\.[^/.]+$/, '');
      if (this.elements.trackName) {
        this.elements.trackName.textContent = displayName;
      }
    }
  }
  
  _setupTextareaDropZone(element, handler) {
    if (!element) return;
    
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', () => {
      element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handler(file);
    });
  }
  
  _openLyricsFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc,.txt,text/plain';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) this._handleLyricsFile(file);
    };
    input.click();
  }
  
  _handleLyricsFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.elements.lyricsInput.value = content;
      this._updateLyricsNextButton();
      
      // Try to extract metadata from LRC content
      this._extractMetadataFromLyrics(content);
    };
    reader.onerror = () => {
      console.error('Failed to read lyrics file');
    };
    reader.readAsText(file);
  }
  
  async _extractMetadataFromLyrics(content) {
    const { parseLRC, isSyncedLyrics } = await import('./lrc-parser.js');
    
    if (isSyncedLyrics(content)) {
      const data = parseLRC(content);
      if (data.metadata.artist && this.elements.metaArtist) {
        this.elements.metaArtist.value = data.metadata.artist;
      }
      if (data.metadata.title && this.elements.metaTitle) {
        this.elements.metaTitle.value = data.metadata.title;
      }
      if (data.metadata.album && this.elements.metaAlbum) {
        this.elements.metaAlbum.value = data.metadata.album;
      }
    }
  }
  
  _goToStep(step) {
    if (!this._canGoToStep(step)) return;
    
    // Hide current step
    this._hideStep(this.currentStep);
    
    // Show new step
    this._showStep(step);
    
    // Update current step before indicators so they reflect the correct state
    this.currentStep = step;
    
    // Update indicators
    this._updateAllStepIndicators();
    
    // Move player panel into appropriate slot (visible on steps 2 and 3)
    if (step === 2 || step === 3) {
      const slot = document.getElementById(`player-slot-${step}`);
      if (slot && this.elements.playerPanel) {
        slot.appendChild(this.elements.playerPanel);
        this.elements.playerPanel.classList.remove('hidden');
      }
      // Initialize wavesurfer if not already done
      if (!this.player.wavesurfer && this.elements.waveform) {
        this.player.init(this.elements.waveform);
      }
    } else {
      this.elements.playerPanel?.classList.add('hidden');
    }
    
    // Step-specific actions
    if (step === 3) {
      this._renderLyrics(this.editor.lines);
      this.elements.lyricsDisplay.focus();
    } else if (step === 4) {
      // Pause audio since player isn't available on export page
      this.player.pause();
      this._updateLrcPreview();
    }
  }
  
  _hideStep(step) {
    const content = document.getElementById(`step-${step}-content`);
    if (content) content.classList.add('hidden');
  }
  
  _showStep(step) {
    const content = document.getElementById(`step-${step}-content`);
    if (content) {
      content.classList.remove('hidden');
      content.classList.add('animate-fadeIn');
    }
  }
  
  _canGoToStep(step) {
    if (step === 1) return true;
    if (step === 2) return this.player.fileName !== '';
    if (step === 3) return this.player.duration > 0 && this.editor.hasLyrics;
    if (step === 4) return this.player.duration > 0 && this.editor.hasLyrics;
    return false;
  }
  
  _updateAllStepIndicators() {
    this.elements.stepIndicators.forEach(indicator => {
      const step = parseInt(indicator.dataset.step, 10);
      indicator.classList.remove('active', 'completed');
      
      if (step < this.currentStep) {
        indicator.classList.add('completed');
      } else if (step === this.currentStep) {
        indicator.classList.add('active');
      }
    });
  }
  
  _updateStepIndicator(step, state) {
    const indicator = document.querySelector(`.step-indicator[data-step="${step}"]`);
    if (indicator) {
      indicator.classList.remove('active', 'completed');
      if (state) indicator.classList.add(state);
    }
  }
  
  _updateLyricsNextButton() {
    const hasText = this.elements.lyricsInput?.value.trim().length > 0;
    if (this.elements.btnNext2) {
      this.elements.btnNext2.disabled = !hasText;
    }
  }
  
  async _parseLyricsInput() {
    const content = this.elements.lyricsInput.value.trim();
    if (!content) return;
    
    const { parseLRC, isSyncedLyrics, parsePlainLyrics } = await import('./lrc-parser.js');
    let data;
    
    if (isSyncedLyrics(content)) {
      data = parseLRC(content);
    } else {
      data = {
        metadata: {},
        lines: parsePlainLyrics(content)
      };
    }
    
    // Add metadata from form fields
    data.metadata.artist = this.elements.metaArtist?.value || data.metadata.artist;
    data.metadata.title = this.elements.metaTitle?.value || data.metadata.title;
    data.metadata.album = this.elements.metaAlbum?.value || data.metadata.album;
    
    this.editor.loadLyrics(data);
  }
  
  async _openLrclibSearch() {
    const meta = this.audioMetadata;
    const duration = this.player.duration ? Math.round(this.player.duration) : null;
    
    // Build search query from metadata
    const searchTerms = [];
    if (meta?.artist) searchTerms.push(meta.artist);
    if (meta?.title) searchTerms.push(meta.title);
    const searchQuery = searchTerms.join(' - ');
    
    // If we have metadata, try direct lookup first
    if (meta?.artist && meta?.title) {
      this.elements.lrclibSearch.classList.remove('hidden');
      this.elements.lrclibResults.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Looking up lyrics...</p>';
      
      // Show what we're searching for and disable controls during lookup
      if (this.elements.lrclibQuery) {
        this.elements.lrclibQuery.value = searchQuery;
        this.elements.lrclibQuery.disabled = true;
      }
      if (this.elements.btnLrclibSearch) {
        this.elements.btnLrclibSearch.disabled = true;
      }
      
      // Build URL for direct GET endpoint
      const params = new URLSearchParams();
      params.set('artist_name', meta.artist);
      params.set('track_name', meta.title);
      if (meta.album) params.set('album_name', meta.album);
      if (duration) params.set('duration', duration.toString());
      
      try {
        const response = await fetch(`https://lrclib.net/api/get?${params}`);
        if (response.ok) {
          const result = await response.json();
          if (result && (result.syncedLyrics || result.plainLyrics)) {
            // Found exact match! Apply it directly
            this._applyLrclibResult(result);
            this.elements.lrclibSearch.classList.add('hidden');
            this._enableLrclibSearch();
            return;
          }
        }
      } catch (err) {
        console.warn('Direct lrclib lookup failed:', err);
      }
      
      // Direct lookup failed, fall back to search
      this._enableLrclibSearch();
      this.elements.lrclibResults.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">No exact match found. Try searching below.</p>';
    } else {
      // No metadata, just show search panel
      this.elements.lrclibSearch.classList.toggle('hidden');
      
      // Pre-populate search field with metadata if available
      if (this.elements.lrclibQuery && !this.elements.lrclibQuery.value && searchQuery) {
        this.elements.lrclibQuery.value = searchQuery;
      }
    }
  }
  
  _enableLrclibSearch() {
    if (this.elements.lrclibQuery) {
      this.elements.lrclibQuery.disabled = false;
    }
    if (this.elements.btnLrclibSearch) {
      this.elements.btnLrclibSearch.disabled = false;
    }
  }
  
  _applyLrclibResult(item) {
    const lyrics = item.syncedLyrics || item.plainLyrics || '';
    this.elements.lyricsInput.value = lyrics;
    if (item.artistName) this.elements.metaArtist.value = item.artistName;
    if (item.trackName) this.elements.metaTitle.value = item.trackName;
    if (item.albumName) this.elements.metaAlbum.value = item.albumName;
    this._updateLyricsNextButton();
  }
  
  async _searchLrclib() {
    const query = this.elements.lrclibQuery?.value.trim();
    if (!query) return;
    
    // Disable controls during search
    if (this.elements.lrclibQuery) this.elements.lrclibQuery.disabled = true;
    if (this.elements.btnLrclibSearch) this.elements.btnLrclibSearch.disabled = true;
    
    this.elements.lrclibResults.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Searching...</p>';
    
    try {
      const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      if (results.length === 0) {
        this.elements.lrclibResults.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">No results found</p>';
        this._enableLrclibSearch();
        return;
      }
      
      this.elements.lrclibResults.innerHTML = results.slice(0, 10).map(item => `
        <div class="lrclib-result p-2 hover:bg-slate-700 rounded cursor-pointer" 
             data-synced="${item.syncedLyrics || ''}"
             data-plain="${item.plainLyrics || ''}"
             data-artist="${item.artistName || ''}"
             data-title="${item.trackName || ''}"
             data-album="${item.albumName || ''}">
          <p class="text-sm text-slate-200 truncate">${item.trackName || 'Unknown'}</p>
          <p class="text-xs text-slate-400 truncate">${item.artistName || 'Unknown'} - ${item.albumName || ''}</p>
          ${item.syncedLyrics ? '<span class="text-xs text-green-500">⏱ Synced</span>' : '<span class="text-xs text-slate-500">Plain</span>'}
        </div>
      `).join('');
      
      // Add click handlers
      this.elements.lrclibResults.querySelectorAll('.lrclib-result').forEach(el => {
        el.addEventListener('click', () => {
          this._applyLrclibResult({
            syncedLyrics: el.dataset.synced,
            plainLyrics: el.dataset.plain,
            artistName: el.dataset.artist,
            trackName: el.dataset.title,
            albumName: el.dataset.album
          });
          this.elements.lrclibSearch.classList.add('hidden');
        });
      });
      
      this._enableLrclibSearch();
    } catch (err) {
      console.error('lrclib search failed:', err);
      this.elements.lrclibResults.innerHTML = '<p class="text-red-400 text-sm text-center py-4">Search failed</p>';
      this._enableLrclibSearch();
    }
  }
  
  _setupEditorCallbacks() {
    this.editor.onLyricsChange = (lines, metadata) => {
      if (this.currentStep === 3) {
        this._renderLyrics(lines);
      }
      this._updateLineCounter();
    };
    
    this.editor.onLineSelect = (index, line) => {
      this._highlightSelectedLine(index);
      this._updateLineCounter();
    };
    
    this.editor.onLineUpdate = (index, line) => {
      this._updateLineDisplay(index, line);
    };
  }
  
  _setupPlayerCallbacks() {
    this.player.onTimeUpdate = (time) => {
      if (this.elements.timeCurrent) {
        this.elements.timeCurrent.textContent = AudioPlayer.formatTime(time);
      }
      
      // Skip playing line updates during user-initiated seeks to avoid flickering
      if (this._isUserSeeking) return;
      
      const playingIndex = this.editor.updatePlayingLine(time);
      this._highlightPlayingLine(playingIndex);
      
      // Only auto-select line if playing (and not in tap-to-sync mode)
      if (this.player.isPlaying && playingIndex >= 0 && playingIndex !== this.editor.selectedIndex && !this._isMarkingMode) {
        this.editor.selectLine(playingIndex);
      }
    };
    
    this.player.onDurationChange = (duration) => {
      if (this.elements.timeTotal) {
        this.elements.timeTotal.textContent = AudioPlayer.formatTime(duration);
      }
      if (this.elements.songDuration) {
        this.elements.songDuration.textContent = AudioPlayer.formatTime(duration);
      }
    };
    
    this.player.onPlay = () => {
      const playIcon = document.getElementById('play-icon');
      const pauseIcon = document.getElementById('pause-icon');
      if (playIcon) playIcon.classList.add('hidden');
      if (pauseIcon) pauseIcon.classList.remove('hidden');
      // Focus lyrics display so keyboard shortcuts work
      if (this.currentStep === 3) {
        this.elements.lyricsDisplay?.focus();
      }
    };
    
    this.player.onPause = () => {
      const playIcon = document.getElementById('play-icon');
      const pauseIcon = document.getElementById('pause-icon');
      if (playIcon) playIcon.classList.remove('hidden');
      if (pauseIcon) pauseIcon.classList.add('hidden');
      
      // Exit marking mode when paused
      this._exitMarkingMode();
    };
  }
  
  _renderLyrics(lines) {
    if (!this.elements.lyricsDisplay) return;
    
    if (lines.length === 0) {
      this.elements.lyricsDisplay.innerHTML = '<p class="text-slate-500 text-center py-8">No lyrics loaded</p>';
      return;
    }
    
    const html = lines.map((line, index) => `
      <div class="lyric-line ${index === this.editor.selectedIndex ? 'selected' : ''}" data-index="${index}">
        <span class="lyric-timestamp">${line.time !== null ? formatTimestamp(line.time) : '--:--'}</span>
        <span class="lyric-text ${!line.text.trim() ? 'empty' : ''}">${this._escapeHtml(line.text) || '(instrumental)'}</span>
        <div class="lyric-actions">
          <button class="lyric-btn lyric-btn-edit" data-action="edit" data-index="${index}" title="Edit line">✏️</button>
          <button class="lyric-btn lyric-btn-delete" data-action="delete" data-index="${index}" title="Delete line">🗑️</button>
        </div>
      </div>
    `).join('');
    
    this.elements.lyricsDisplay.innerHTML = html;
    
    // Click on line to select and seek
    this.elements.lyricsDisplay.querySelectorAll('.lyric-line').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't select if clicking on action buttons
        if (e.target.closest('.lyric-actions')) return;
        
        const index = parseInt(el.dataset.index, 10);
        
        // If clicking on the line being edited (or its input), don't trigger playback
        if (this.editingLineIndex === index || e.target.closest('.lyric-edit-input')) {
          return;
        }
        
        // If we're in edit mode and clicking a different line, exit edit mode first
        if (this.editingLineIndex !== null) {
          this._exitEditMode();
        }
        
        // Exit marking mode when manually selecting a line
        this._exitMarkingMode();
        
        this.editor.selectLine(index);
        const line = this.editor.lines[index];
        if (line && line.time !== null) {
          this.player.seek(line.time);
          // Auto-play when clicking a line (if enabled)
          if (!this.player.isPlaying && this.elements.autoPlayToggle?.checked) {
            this.player.play();
          }
        }
      });
    });
    
    // Edit button handlers
    this.elements.lyricsDisplay.querySelectorAll('.lyric-btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        this._editLine(index);
      });
    });
    
    // Delete button handlers
    this.elements.lyricsDisplay.querySelectorAll('.lyric-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        this._deleteLine(index);
      });
    });
    
    this.elements.lyricsDisplay.focus();
  }
  
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  _addNewLine() {
    const currentTime = this.player.currentTime || 0;
    const index = this.editor.addLine(currentTime, '');
    // Immediately edit the new line
    setTimeout(() => this._editLine(index), 100);
  }
  
  _editLine(index) {
    const line = this.editor.lines[index];
    if (!line) return;
    
    const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${index}"]`);
    if (!lineEl) return;
    
    const textEl = lineEl.querySelector('.lyric-text');
    if (!textEl) return;
    
    // Pause playback when entering edit mode
    if (this.player.isPlaying) {
      this.player.pause();
    }
    
    // Track that we're editing this line
    this.editingLineIndex = index;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = line.text;
    input.className = 'lyric-edit-input';
    
    // Replace text with input
    const originalText = textEl.innerHTML;
    textEl.innerHTML = '';
    textEl.appendChild(input);
    input.focus();
    input.select();
    
    const saveEdit = () => {
      const newText = input.value.trim();
      this.editor.updateLineText(index, newText);
      textEl.innerHTML = this._escapeHtml(newText) || '(instrumental)';
      textEl.classList.toggle('empty', !newText);
      this.editingLineIndex = null;
      this.elements.lyricsDisplay.focus();
    };
    
    const cancelEdit = () => {
      textEl.innerHTML = originalText;
      this.editingLineIndex = null;
      this.elements.lyricsDisplay.focus();
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        // Shift+Enter: Split line at cursor position
        e.preventDefault();
        input.removeEventListener('blur', saveEdit);
        
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos).trim();
        const textAfter = input.value.substring(cursorPos).trim();
        
        // Update current line with text before cursor
        this.editor.updateLineText(index, textBefore);
        textEl.innerHTML = this._escapeHtml(textBefore) || '(instrumental)';
        textEl.classList.toggle('empty', !textBefore);
        this.editingLineIndex = null;
        
        // Insert new line after current with text after cursor
        this._splitLineInsert(index, textAfter);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.removeEventListener('blur', saveEdit);
        cancelEdit();
      }
      e.stopPropagation(); // Prevent keyboard shortcuts while editing
    });
  }
  
  _splitLineInsert(afterIndex, text) {
    // Calculate timestamp: midpoint between current line and next line
    // If no next line, use current + 0.1s
    const currentLine = this.editor.lines[afterIndex];
    const nextLine = this.editor.lines[afterIndex + 1];
    const currentTime = currentLine?.time || 0;
    
    let newTime;
    if (nextLine && nextLine.time !== null) {
      // Midpoint between current and next
      newTime = (currentTime + nextLine.time) / 2;
    } else {
      // No next line, add 0.1 seconds
      newTime = currentTime + 0.1;
    }
    
    // Insert a new line after the given index
    const newLine = {
      time: newTime,
      text,
      id: Date.now()
    };
    
    // Insert at position afterIndex + 1
    this.editor.lines.splice(afterIndex + 1, 0, newLine);
    
    if (this.editor.onLyricsChange) {
      this.editor.onLyricsChange(this.editor.lines, this.editor.metadata);
    }
    
    // Select and edit the new line with cursor at start
    const newIndex = afterIndex + 1;
    this.editor.selectLine(newIndex);
    
    // Wait for re-render then edit the new line
    setTimeout(() => {
      this._editLineAtStart(newIndex);
    }, 50);
  }
  
  _editLineAtStart(index) {
    const line = this.editor.lines[index];
    if (!line) return;
    
    const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${index}"]`);
    if (!lineEl) return;
    
    const textEl = lineEl.querySelector('.lyric-text');
    if (!textEl) return;
    
    // Track that we're editing this line
    this.editingLineIndex = index;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = line.text;
    input.className = 'lyric-edit-input';
    
    // Replace text with input
    const originalText = textEl.innerHTML;
    textEl.innerHTML = '';
    textEl.appendChild(input);
    input.focus();
    // Place cursor at the start instead of selecting all
    input.setSelectionRange(0, 0);
    
    const saveEdit = () => {
      const newText = input.value.trim();
      this.editor.updateLineText(index, newText);
      textEl.innerHTML = this._escapeHtml(newText) || '(instrumental)';
      textEl.classList.toggle('empty', !newText);
      this.editingLineIndex = null;
      this.elements.lyricsDisplay.focus();
    };
    
    const cancelEdit = () => {
      textEl.innerHTML = originalText;
      this.editingLineIndex = null;
      this.elements.lyricsDisplay.focus();
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        // Shift+Enter: Split line at cursor position
        e.preventDefault();
        input.removeEventListener('blur', saveEdit);
        
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos).trim();
        const textAfter = input.value.substring(cursorPos).trim();
        
        // Update current line with text before cursor
        this.editor.updateLineText(index, textBefore);
        textEl.innerHTML = this._escapeHtml(textBefore) || '(instrumental)';
        textEl.classList.toggle('empty', !textBefore);
        this.editingLineIndex = null;
        
        // Insert new line after current with text after cursor
        this._splitLineInsert(index, textAfter);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.removeEventListener('blur', saveEdit);
        cancelEdit();
      }
      e.stopPropagation(); // Prevent keyboard shortcuts while editing
    });
  }
  
  _exitEditMode() {
    if (this.editingLineIndex === null) return;
    
    const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${this.editingLineIndex}"]`);
    if (lineEl) {
      const input = lineEl.querySelector('.lyric-edit-input');
      if (input) {
        input.blur(); // This will trigger saveEdit
      }
    }
  }
  
  _deleteLine(index) {
    if (this.editor.lines.length <= 1) {
      return; // Don't delete the last line
    }
    this.editor.deleteLine(index);
  }
  
  _highlightSelectedLine(index) {
    this.elements.lyricsDisplay?.querySelectorAll('.lyric-line.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${index}"]`);
    if (lineEl) {
      lineEl.classList.add('selected');
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  _highlightPlayingLine(index) {
    this.elements.lyricsDisplay?.querySelectorAll('.lyric-line.active').forEach(el => {
      el.classList.remove('active');
    });
    
    if (index >= 0) {
      const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${index}"]`);
      if (lineEl) {
        lineEl.classList.add('active');
      }
    }
  }
  
  _updateLineDisplay(index, line) {
    const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${index}"]`);
    if (lineEl) {
      const timestampEl = lineEl.querySelector('.lyric-timestamp');
      if (timestampEl) {
        timestampEl.textContent = line.time !== null ? formatTimestamp(line.time) : '--:--';
      }
    }
  }
  
  _handleKeyboard(e) {
    if (!this.editor.hasLyrics) return;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this._exitMarkingMode();
        this.editor.selectPreviousLine();
        // Seek to the newly selected line's timestamp
        const upLine = this.editor.getSelectedLine();
        if (upLine?.time !== null) {
          this._jumpToTime(upLine.time);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._exitMarkingMode();
        this.editor.selectNextLine();
        // Seek to the newly selected line's timestamp
        const downLine = this.editor.getSelectedLine();
        if (downLine?.time !== null) {
          this._jumpToTime(downLine.time);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        const decreasedTime = this.editor.adjustTimestamp(-0.1);
        this._jumpToTime(decreasedTime);
        break;
      case 'ArrowRight':
        e.preventDefault();
        const increasedTime = this.editor.adjustTimestamp(0.1);
        this._jumpToTime(increasedTime);
        break;
      case 'Enter':
        e.preventDefault();
        this._markCurrentLine();
        break;
      case 'Backspace':
        e.preventDefault();
        this.editor.selectPreviousLine();
        // Seek to the newly selected line's timestamp
        const prevLine = this.editor.getSelectedLine();
        if (prevLine?.time !== null) {
          this._jumpToTime(prevLine.time);
        }
        break;
    }
  }
  
  _jumpToTime(time) {
    // Temporarily prevent auto-selection during user-initiated seek
    this._isUserSeeking = true;
    this.player.seek(time);
    
    // Debounce: clear any existing timeout and set a new one
    // This keeps the flag true while adjustments keep coming in
    if (this._seekTimeoutId) {
      clearTimeout(this._seekTimeoutId);
    }
    this._seekTimeoutId = setTimeout(() => {
      this._isUserSeeking = false;
      this._seekTimeoutId = null;
    }, 200);
  }
  
  /**
   * Adjust timestamp of selected line (for mobile buttons)
   * @param {number} delta - Time adjustment in seconds
   */
  _adjustTimestamp(delta) {
    if (!this.editor.hasLyrics) return;
    
    const newTime = this.editor.adjustTimestamp(delta);
    this._jumpToTime(newTime);
  }
  
  /**
   * Mark current line with current playback time and advance (tap-to-sync)
   */
  _markCurrentLine() {
    if (!this.editor.hasLyrics) return;
    
    // Enable marking mode to prevent auto-selection from overriding
    this._isMarkingMode = true;
    
    const currentTime = this.player.currentTime;
    this.editor.markAndAdvance(currentTime);
    
    // Start playing if not already (auto-play on mark)
    if (!this.player.isPlaying) {
      this.player.play();
    }
  }
  
  /**
   * Exit marking mode (called when user manually selects a line or pauses)
   */
  _exitMarkingMode() {
    this._isMarkingMode = false;
  }
  
  _updateLrcPreview() {
    if (this.elements.lrcPreview && this.editor.hasLyrics) {
      this.elements.lrcPreview.textContent = this.editor.toLRC();
    }
  }
  
  async _copyToClipboard() {
    if (!this.editor.hasLyrics) return;
    
    const lrc = this.editor.toLRC();
    
    try {
      await navigator.clipboard.writeText(lrc);
      const btn = this.elements.btnCopy;
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span>✅</span> Copied!';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }
  
  _downloadLRC() {
    if (!this.editor.hasLyrics) return;
    
    const lrc = this.editor.toLRC();
    const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const filename = this.editor.metadata.title 
      ? `${this.editor.metadata.artist || 'Unknown'} - ${this.editor.metadata.title}.lrc`
      : 'lyrics.lrc';
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  async _publishToLrclib() {
    const status = this.elements.publishStatus;
    status.classList.remove('hidden');
    status.textContent = 'Publishing is not yet implemented...';
    status.className = 'text-xs text-slate-500 mt-2 text-center';
  }
  
  _updateLineCounter() {
    if (this.elements.lineCounter && this.editor.hasLyrics) {
      const current = this.editor.selectedIndex + 1;
      const total = this.editor.lineCount;
      this.elements.lineCounter.textContent = `Line ${current} of ${total}`;
    }
  }
  
  _startOver() {
    this.player.pause();
    this.editor.clear();
    this.elements.lyricsInput.value = '';
    this.elements.metaArtist.value = '';
    this.elements.metaTitle.value = '';
    this.elements.metaAlbum.value = '';
    this.elements.songInfo.classList.add('hidden');
    this.elements.audioDropZone.classList.remove('hidden');
    this.elements.btnNext2.disabled = true;
    this._goToStep(1);
  }
}
