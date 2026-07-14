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
    this._wordStatusTimeout = null;
    
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
      btnTryDemo: document.getElementById('btn-try-demo'),
      
      // Step 2: Transcription (panel shown when transcribing)
      transcribePanel: document.getElementById('transcribe-panel'),
      transcribeStatus: document.getElementById('transcribe-status'),
      transcribeProgressBar: document.getElementById('transcribe-progress-bar'),
      btnTranscribe: document.getElementById('btn-transcribe'),
      btnTranscribeDropdown: document.getElementById('btn-transcribe-dropdown'),
      transcribeDropdownMenu: document.getElementById('transcribe-dropdown-menu'),
      transcribeBtnGroup: document.getElementById('transcribe-btn-group'),
      
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
      
      // Word mode
      wordModeToggle: document.getElementById('word-mode-toggle'),
      wordPanel: document.getElementById('word-panel'),
      wordPanelLabel: document.getElementById('word-panel-label'),
      wordChips: document.getElementById('word-chips'),
      wordStatus: document.getElementById('word-status'),
      btnWordGenerateLine: document.getElementById('btn-word-generate-line'),
      btnWordGenerateAll: document.getElementById('btn-word-generate-all'),
      btnWordClear: document.getElementById('btn-word-clear'),
      syncHintsLine: document.getElementById('sync-hints-line'),
      wordHintsLine: document.getElementById('word-hints-line'),
      exportModeEnhancedLabel: document.getElementById('export-mode-enhanced-label'),
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
      // Reset transcription state
      this._audioFile = null;
      this.elements.transcribePanel?.classList.remove('hidden');
      this.elements.transcribeProgress?.classList.add('hidden');
      this.elements.transcribeActions?.classList.remove('hidden');
    });
    this.elements.btnTryDemo?.addEventListener('click', () => {
      this._loadDemo();
    });
    
    // Step 2: Auto-Transcribe button (uses default model)
    this.elements.btnTranscribe?.addEventListener('click', () => {
      this._startTranscription();
    });
    
    // Step 2: Transcribe dropdown toggle
    this.elements.btnTranscribeDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleTranscribeDropdown();
    });
    
    // Step 2: Model selection from dropdown
    document.querySelectorAll('.model-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modelId = btn.dataset.model;
        this._closeTranscribeDropdown();
        this._startTranscription(modelId);
      });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.elements.transcribeBtnGroup?.contains(e.target)) {
        this._closeTranscribeDropdown();
      }
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
    
    // Export mode radio
    document.querySelectorAll('input[name="export-mode"]').forEach(radio => {
      radio.addEventListener('change', () => this._updateLrcPreview());
    });
    
    // Word mode toggle
    this.elements.wordModeToggle?.addEventListener('change', () => {
      this._toggleWordMode(this.elements.wordModeToggle.checked);
    });
    
    // Word panel buttons
    this.elements.btnWordGenerateLine?.addEventListener('click', () => this._generateWordTimingsLine());
    this.elements.btnWordGenerateAll?.addEventListener('click', () => this._generateWordTimingsAll());
    this.elements.btnWordClear?.addEventListener('click', () => this._clearWordTimingsLine());
    
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
    // Store the file for potential transcription
    this._audioFile = file;
    
    this.player.loadFile(file);
    
    // Show song info
    this.elements.songFilename.textContent = file.name;
    this.elements.songInfo.classList.remove('hidden');
    this.elements.audioDropZone.classList.add('hidden');
    
    // Extract metadata from audio file
    await this._extractAudioMetadata(file);
    
    // Auto-advance to Step 2 where user can add lyrics
    this._goToStep(2);
  }
  
  /**
   * Load demo song and lyrics for users to try the app
   */
  async _loadDemo() {
    const demoSongUrl = 'https://c.madeye.dev/syncsongdemo.mp3';
    const demoTitle = 'Sing It Wrong';
    const demoArtist = 'Joshua Hendricks';
    
    // Demo lyrics (unsynced)
    const demoLyrics = `Pulled up at the red light
Windows down, I'm feelin' brave
Belting out that power ballad
Like I'm center stage
"I can see clearly now, Lorraine is gone"
Yeah I hit that note so proud
'Til my girl starts cry-laugh-crying
Rollin' in the passenger seat, way too loud

I sing it wrong, sing it strong
Got the messed up words, but the vibe's still on
Bone apple tea to the fancy song
If it sounds kinda right, I'm gonna sing along
Yeah, call me out, I'll just sing it louder
Confidence, baby, that's my superpower
I sing it wrong, sing it strong
But you're still dancin' when you hear this song

At church I went full gospel
Thought I knew that chorus line
"Round John Virgin, mother and child"
Pastor gave me side-eye from the shrine
At the bar it's classic rock night
I'm their beautiful disaster, man
"Hold me closer, Tony Danza"
Got the whole place clappin' with their cans

I sing it wrong, sing it strong
Got the messed up words, but the vibe's still on
Bone apple tea to the fancy song
If it sounds kinda right, I'm gonna sing along
Yeah, call me out, I'll just sing it louder
Confidence, baby, that's my superpower
I sing it wrong, sing it strong
But you're still dancin' when you hear this song

Your mama in the kitchen like, "Boy, behave"
But I still toast up, "Bone apple tea," wave
Misheard grace, got a gravy stain prayer
"Lead us not into Penn Station" in the air
Your playlist's poetry, mine's karaoke crime
But I turn wrong lyrics into pickup lines
Leanin' in close, low and slow, I grin
"Is it you're the one that I want, or you're the one that I won?"

I sing it wrong, sing it strong
Got the messed up words, but the vibe's still on
Bone apple tea to the fancy song
If it sounds kinda right, I'm gonna sing along
Yeah, call me out, I'll just sing it louder
Confidence, baby, that's my superpower
I sing it wrong, sing it strong
But you're still dancin' when you hear this song`;

    // Load audio from URL
    this.player.loadUrl(demoSongUrl, `${demoArtist} - ${demoTitle}`);
    
    // Update UI to show song is loaded
    this.elements.songFilename.textContent = `${demoArtist} - ${demoTitle}`;
    this.elements.songInfo.classList.remove('hidden');
    this.elements.audioDropZone.classList.add('hidden');
    
    // Fetch the demo audio as a File so transcription is available
    try {
      const response = await fetch(demoSongUrl);
      const blob = await response.blob();
      this._audioFile = new File([blob], 'demo-song.mp3', { type: 'audio/mpeg' });
    } catch (err) {
      console.warn('Could not fetch demo audio for transcription:', err);
      this._audioFile = null;
    }
    
    // Set metadata
    this.audioMetadata = {
      artist: demoArtist,
      title: demoTitle,
      album: null
    };
    
    // Update track name display
    if (this.elements.trackName) {
      this.elements.trackName.textContent = `${demoArtist} - ${demoTitle}`;
    }
    
    // Pre-fill metadata fields
    if (this.elements.metaArtist) {
      this.elements.metaArtist.value = demoArtist;
    }
    if (this.elements.metaTitle) {
      this.elements.metaTitle.value = demoTitle;
    }
    
    // Pre-fill lyrics textarea
    if (this.elements.lyricsInput) {
      this.elements.lyricsInput.value = demoLyrics;
      this._updateLyricsNextButton();
    }
    
    // Go to step 2
    this._goToStep(2);
  }
  
  /**
   * Toggle transcription model dropdown
   */
  _toggleTranscribeDropdown() {
    this.elements.transcribeDropdownMenu?.classList.toggle('hidden');
  }
  
  /**
   * Close transcription model dropdown
   */
  _closeTranscribeDropdown() {
    this.elements.transcribeDropdownMenu?.classList.add('hidden');
  }
  
  /**
   * Start AI transcription of the loaded audio file
   * @param {string} [modelId] - Model to use (defaults to whisper-tiny.en)
   */
  async _startTranscription(modelId) {
    if (!this._audioFile) {
      console.error('No audio file loaded for transcription');
      alert('Please add an audio file first before transcribing.');
      return;
    }
    
    // Clear existing lyrics to make room for transcription
    if (this.elements.lyricsInput) {
      this.elements.lyricsInput.value = '';
    }
    
    // Show progress panel, disable buttons
    this.elements.transcribePanel?.classList.remove('hidden');
    this.elements.btnTranscribe?.setAttribute('disabled', 'true');
    this.elements.btnTranscribeDropdown?.setAttribute('disabled', 'true');
    this._updateTranscribeStatus('Loading AI model...');
    this._updateTranscribeProgress(0);
    
    try {
      console.log('[UI] Starting transcription workflow...');
      
      // Lazy-load the transcriber module (runs in Web Worker for UI responsiveness)
      console.log('[UI] Lazy-loading transcriber module...');
      const { initTranscriber, transcribe, DEFAULT_MODEL, WHISPER_MODELS } = await import('./transcriber.js');
      
      // Use default model if none specified
      const selectedModel = modelId || DEFAULT_MODEL;
      const modelInfo = WHISPER_MODELS[selectedModel];
      console.log(`[UI] Using model: ${selectedModel} (${modelInfo?.size || 'unknown size'})`);
      
      // Initialize (downloads model on first use)
      console.log('[UI] Initializing Whisper model...');
      await initTranscriber((progress) => {
        if (progress.status === 'progress' && progress.progress !== undefined) {
          const pct = Math.round(progress.progress);
          this._updateTranscribeStatus(`Downloading ${modelInfo?.name || 'model'}... ${pct}%`);
          this._updateTranscribeProgress(pct * 0.3); // First 30% is download
        } else if (progress.status === 'done') {
          console.log('[UI] Model file downloaded:', progress.file);
        } else if (progress.status === 'ready') {
          console.log('[UI] Model ready');
          this._updateTranscribeStatus('Model loaded, preparing audio...');
        } else if (progress.file) {
          this._updateTranscribeStatus(`Loading ${progress.file.split('/').pop()}...`);
        }
      }, selectedModel);
      
      this._updateTranscribeStatus('Preparing audio for transcription...');
      this._updateTranscribeProgress(30);
      
      // Transcribe the audio file (now returns lines directly from worker)
      console.log('[UI] Starting transcription...');
      const lines = await transcribe(this._audioFile, (progress) => {
        // Handle status updates (text descriptions)
        if (progress.status) {
          this._updateTranscribeStatus(progress.status);
        }
        
        // Handle numeric progress
        if (progress.progress !== undefined) {
          // 30-95% is transcription progress
          const pct = 30 + Math.round(progress.progress * 65);
          this._updateTranscribeProgress(pct);
          
          // Build detailed status message
          let status = `Transcribing: ${Math.round(progress.progress * 100)}%`;
          if (progress.chunk && progress.totalChunks) {
            status = `Transcribing chunk ${progress.chunk}/${progress.totalChunks}`;
          }
          if (progress.remaining && progress.remaining > 0) {
            const mins = Math.floor(progress.remaining / 60);
            const secs = Math.round(progress.remaining % 60);
            if (mins > 0) {
              status += ` (~${mins}m ${secs}s remaining)`;
            } else {
              status += ` (~${secs}s remaining)`;
            }
          }
          this._updateTranscribeStatus(status);
        }
      });
      
      console.log(`[UI] Transcription complete: ${lines.length} lines`);
      this._updateTranscribeProgress(100);
      
      // Check if we have timestamps
      const hasTimestamps = lines.some(line => line.time !== null);
      
      // Populate the lyrics textarea for user to review/edit
      if (this.elements.lyricsInput) {
        // If we have timestamps, format as LRC so they're preserved
        if (hasTimestamps) {
          const lrcLines = lines.map(l => {
            if (l.time !== null) {
              // formatTimestamp already includes brackets, so just concatenate
              return `${formatTimestamp(l.time)}${l.text}`;
            }
            return l.text;
          });
          this.elements.lyricsInput.value = lrcLines.join('\n');
        } else {
          this.elements.lyricsInput.value = lines.map(l => l.text).join('\n');
        }
        this._updateLyricsNextButton();
      }
      
      // Hide progress panel, show success briefly
      this._updateTranscribeStatus(`✓ Transcribed ${lines.length} lines`);
      setTimeout(() => {
        this.elements.transcribePanel?.classList.add('hidden');
        this.elements.btnTranscribe?.removeAttribute('disabled');
        this.elements.btnTranscribeDropdown?.removeAttribute('disabled');
        this._updateTranscribeProgress(0);
      }, 1500);
      
    } catch (error) {
      console.error('Transcription failed:', error);
      this._updateTranscribeStatus(`Error: ${error.message}`);
      
      // Hide progress panel after showing error
      setTimeout(() => {
        this.elements.transcribePanel?.classList.add('hidden');
        this.elements.btnTranscribe?.removeAttribute('disabled');
        this.elements.btnTranscribeDropdown?.removeAttribute('disabled');
        this._updateTranscribeProgress(0);
      }, 3000);
    }
  }
  
  /**
   * Update transcription status text
   */
  _updateTranscribeStatus(text) {
    if (this.elements.transcribeStatus) {
      this.elements.transcribeStatus.textContent = text;
    }
  }
  
  /**
   * Update transcription progress bar
   */
  _updateTranscribeProgress(percent) {
    if (this.elements.transcribeProgressBar) {
      this.elements.transcribeProgressBar.style.width = `${Math.min(100, percent)}%`;
    }
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
    if (step === 2) {
      // Enable/disable transcribe buttons based on whether we have a file to transcribe
      if (this._audioFile) {
        this.elements.btnTranscribe?.removeAttribute('disabled');
        this.elements.btnTranscribeDropdown?.removeAttribute('disabled');
        this.elements.btnTranscribe && (this.elements.btnTranscribe.title = '');
      } else {
        this.elements.btnTranscribe?.setAttribute('disabled', 'true');
        this.elements.btnTranscribeDropdown?.setAttribute('disabled', 'true');
        this.elements.btnTranscribe && (this.elements.btnTranscribe.title = 'Transcription requires an audio file (not available for demo/URL)');
      }
    } else if (step === 3) {
      this._renderLyrics(this.editor.lines);
      this.elements.lyricsDisplay.focus();
      if (this.editor.wordMode) {
        this.editor.ensureWordsForLine(this.editor.selectedIndex);
        this._renderWordChips();
      }
      this._updateWordModeUI();
    } else if (step === 4) {
      // Pause audio since player isn't available on export page
      this.player.pause();
      
      // Show/hide enhanced LRC option based on whether word timings exist
      if (this.elements.exportModeEnhancedLabel) {
        const hasWords = this.editor.hasAnyWordTimings;
        this.elements.exportModeEnhancedLabel.classList.toggle('hidden', !hasWords);
        if (!hasWords) {
          const stdRadio = document.querySelector('input[name="export-mode"][value="standard"]');
          if (stdRadio) stdRadio.checked = true;
        }
      }
      
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
    
    const { parseLRC, parseEnhancedLRC, isSyncedLyrics, parsePlainLyrics } = await import('./lrc-parser.js');
    let data;
    
    if (isSyncedLyrics(content)) {
      // Use enhanced parser to pick up <mm:ss.xx> word tags if present
      data = parseEnhancedLRC(content);
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
      if (this.editor.wordMode) {
        this.editor.ensureWordsForLine(index);
        this._renderWordChips();
      }
    };
    
    this.editor.onLineUpdate = (index, line) => {
      this._updateLineDisplay(index, line);
    };
    
    this.editor.onWordUpdate = (lineIndex, wordIndex) => {
      this._renderWordChips();
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
      
      // Highlight current word in word mode
      if (this.editor.wordMode) {
        this._highlightPlayingWord(time);
      }
      
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
      
      if (this._isMarkingMode) {
        this.editor.setEndTime(this.editor.selectedIndex, this.player.getCurrentTime());
      }
      
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
    
    const html = lines.map((line, index) => {
      const hasWords = line.words && line.words.some(w => w.startTime != null);
      const wordBadge = hasWords ? ' <span class="text-[10px] text-green-500 font-mono" title="Has word timings">W</span>' : '';
      return `
      <div class="lyric-line ${index === this.editor.selectedIndex ? 'selected' : ''}" data-index="${index}">
        <span class="lyric-timestamp">${line.time !== null ? formatTimestamp(line.time) : '--:--'}</span>
        <span class="lyric-text ${!line.text.trim() ? 'empty' : ''}">${this._escapeHtml(line.text) || '(instrumental)'}${wordBadge}</span>
        <div class="lyric-actions">
          <button class="lyric-btn lyric-btn-edit" data-action="edit" data-index="${index}" title="Edit line">✏️</button>
          <button class="lyric-btn lyric-btn-delete" data-action="delete" data-index="${index}" title="Delete line">🗑️</button>
        </div>
      </div>
    `}).join('');
    
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
      const result = this.editor.updateLineText(index, newText);
      textEl.innerHTML = this._escapeHtml(newText) || '(instrumental)';
      textEl.classList.toggle('empty', !newText);
      this.editingLineIndex = null;
      if (result === 'words_reset') {
        this._showWordStatus('Word timings reset for this line');
        if (this.editor.wordMode) this._renderWordChips();
      }
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
      endTime: null,
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
      const result = this.editor.updateLineText(index, newText);
      textEl.innerHTML = this._escapeHtml(newText) || '(instrumental)';
      textEl.classList.toggle('empty', !newText);
      this.editingLineIndex = null;
      if (result === 'words_reset') {
        this._showWordStatus('Word timings reset for this line');
        if (this.editor.wordMode) this._renderWordChips();
      }
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
    
    const wordMode = this.editor.wordMode;
    
    // Word mode: Tab marks current word and advances, Shift+Tab goes to previous word
    if (wordMode) {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          this._selectPreviousWord();
        } else {
          this._markCurrentWord();
        }
        return;
      }
      
      // Alt+Arrow for word timestamp adjustment
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -0.1 : 0.1;
        const fineDelta = e.shiftKey ? delta / 10 : delta;
        this.editor.adjustWordTimestamp(fineDelta);
        this._renderWordChips();
        return;
      }
      
      // In word mode, Enter still marks line (not word)
      // ArrowUp/Down navigate lines and update word panel
    }
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this._exitMarkingMode();
        this.editor.selectPreviousLine();
        if (wordMode) {
          this.editor.selectedWordIndex = 0;
          this.editor.ensureWordsForLine(this.editor.selectedIndex);
          this._renderWordChips();
        }
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
        if (wordMode) {
          this.editor.selectedWordIndex = 0;
          this.editor.ensureWordsForLine(this.editor.selectedIndex);
          this._renderWordChips();
        }
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
        if (wordMode) {
          this.editor.selectedWordIndex = 0;
          this.editor.ensureWordsForLine(this.editor.selectedIndex);
          this._renderWordChips();
        }
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
   * Mark current line with current playback time and advance (tap-to-sync).
   * When word mode is ON this syncs one word instead of the whole line.
   */
  _markCurrentLine() {
    if (!this.editor.hasLyrics) return;
    
    // Enable marking mode to prevent auto-selection from overriding
    this._isMarkingMode = true;
    
    const currentTime = this.player.getCurrentTime();
    
    if (this.editor.wordMode) {
      this._markCurrentWord(currentTime);
    } else {
      this.editor.markAndAdvance(currentTime);
    }
    
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
      this.elements.lrcPreview.textContent = this._getExportContent();
    }
  }

  _getSelectedExportMode() {
    return document.querySelector('input[name="export-mode"]:checked')?.value || 'standard';
  }

  _getExportContent() {
    const mode = this._getSelectedExportMode();
    if (mode === 'srt') {
      return this.editor.toSRT(this.player.duration);
    }

    return this.editor.toLRC(mode === 'enhanced');
  }
  
  async _copyToClipboard() {
    if (!this.editor.hasLyrics) return;
    
    const exportContent = this._getExportContent();
    
    try {
      await navigator.clipboard.writeText(exportContent);
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
    
    const mode = this._getSelectedExportMode();
    const exportContent = this._getExportContent();
    const extension = mode === 'srt' ? 'srt' : 'lrc';
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const filename = this.editor.metadata.title 
      ? `${this.editor.metadata.artist || 'Unknown'} - ${this.editor.metadata.title}.${extension}`
      : `lyrics.${extension}`;
    
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
    this.editor.setWordMode(false);
    if (this.elements.wordModeToggle) this.elements.wordModeToggle.checked = false;
    this.elements.lyricsInput.value = '';
    this.elements.metaArtist.value = '';
    this.elements.metaTitle.value = '';
    this.elements.metaAlbum.value = '';
    this.elements.songInfo.classList.add('hidden');
    this.elements.audioDropZone.classList.remove('hidden');
    this.elements.btnNext2.disabled = true;
    this._goToStep(1);
  }
  
  // ─── Word Mode ─────────────────────────────────────────────────────────

  _toggleWordMode(enabled) {
    this.editor.setWordMode(enabled);
    this._updateWordModeUI();
    if (enabled) {
      this.editor.ensureWordsForLine(this.editor.selectedIndex);
      this._renderWordChips();
    } else {
      if (this.elements.wordPanel) this.elements.wordPanel.classList.add('hidden');
    }
    this._updateMarkButtonLabel();
  }
  
  _updateWordModeUI() {
    const wm = this.editor.wordMode;
    if (this.elements.wordPanel) {
      this.elements.wordPanel.classList.toggle('hidden', !wm);
    }
    if (this.elements.syncHintsLine) {
      this.elements.syncHintsLine.classList.toggle('hidden', wm);
    }
    if (this.elements.wordHintsLine) {
      this.elements.wordHintsLine.classList.toggle('hidden', !wm);
    }
  }
  
  _updateMarkButtonLabel() {
    const btn = this.elements.btnMark;
    if (!btn) return;
    const label = btn.querySelector('.text-xs');
    if (!label) return;
    label.textContent = this.editor.wordMode ? 'Sync Word' : 'Mark';
    btn.title = this.editor.wordMode
      ? 'Sync current word and advance to next'
      : 'Set timestamp to current time and advance';
  }
  
  _renderWordChips() {
    if (!this.elements.wordChips) return;
    const line = this.editor.lines[this.editor.selectedIndex];
    if (!line || !line.words || line.words.length === 0) {
      this.elements.wordChips.innerHTML = '<span class="text-xs text-slate-500">No words for this line</span>';
      if (this.elements.wordPanelLabel) this.elements.wordPanelLabel.textContent = 'Word timing';
      return;
    }
    
    if (this.elements.wordPanelLabel) {
      this.elements.wordPanelLabel.textContent = `Word timing — Line ${this.editor.selectedIndex + 1}`;
    }
    
    const chips = line.words.map((w, i) => {
      const isSelected = i === this.editor.selectedWordIndex;
      const isTimed = w.startTime != null;
      const cls = [
        'word-chip',
        isSelected ? 'selected' : '',
        isTimed ? 'timed' : ''
      ].filter(Boolean).join(' ');
      const tsLabel = isTimed ? ` <span class="word-ts">${formatTimestamp(w.startTime)}</span>` : '';
      return `<span class="${cls}" data-word-index="${i}">${this._escapeHtml(w.text)}${tsLabel}</span>`;
    }).join('');
    
    this.elements.wordChips.innerHTML = chips;
    
    this.elements.wordChips.querySelectorAll('.word-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.dataset.wordIndex, 10);
        this.editor.selectWord(idx);
        this._renderWordChips();
        this.elements.lyricsDisplay?.focus();
      });
    });
  }
  
  _markCurrentWord(currentTime = this.player.getCurrentTime()) {
    if (!this.editor.wordMode) return;
    
    const result = this.editor.syncCurrentWordAndAdvance(currentTime);
    
    // Refresh UI
    this._renderWordChips();
    this._renderLyrics(this.editor.lines);
    this._highlightSelectedLine(this.editor.selectedIndex);
    
    if (result.action === 'finished') {
      this._showWordStatus('All words synced');
    }
  }
  
  _selectPreviousWord() {
    if (!this.editor.wordMode) return;
    this.editor.selectPreviousWord();
    this._renderWordChips();
  }
  
  _generateWordTimingsLine() {
    this.editor.generateWordTimingsForLine(this.editor.selectedIndex);
    this.editor.selectedWordIndex = 0;
    this._renderWordChips();
    this._renderLyrics(this.editor.lines);
    this._showWordStatus('Generated word timings for this line');
  }
  
  _generateWordTimingsAll() {
    this.editor.generateAllWordTimings();
    this._renderWordChips();
    this._renderLyrics(this.editor.lines);
    this._showWordStatus('Generated word timings for all lines');
  }
  
  _clearWordTimingsLine() {
    this.editor.clearWordTimingsForLine(this.editor.selectedIndex);
    this._renderWordChips();
    this._renderLyrics(this.editor.lines);
    this._showWordStatus('Cleared word timings for this line');
  }
  
  _highlightPlayingWord(currentTime) {
    if (!this.elements.wordChips) return;
    const line = this.editor.lines[this.editor.currentPlayingIndex];
    if (!line || !line.words) return;
    
    if (this.editor.currentPlayingIndex !== this.editor.selectedIndex) return;
    
    const chips = this.elements.wordChips.querySelectorAll('.word-chip');
    chips.forEach(chip => chip.classList.remove('playing'));
    
    const wordIdx = this.editor.getActiveWordIndex(currentTime);
    if (wordIdx >= 0 && chips[wordIdx]) {
      chips[wordIdx].classList.add('playing');
    }
    
    // Also highlight word text in the lyrics display
    const lineEl = this.elements.lyricsDisplay?.querySelector(`[data-index="${this.editor.currentPlayingIndex}"]`);
    if (lineEl) {
      const textEl = lineEl.querySelector('.lyric-text');
      if (textEl && line.words) {
        const activeIdx = this.editor.getActiveWordIndex(currentTime);
        let html = '';
        for (let i = 0; i < line.words.length; i++) {
          const w = line.words[i];
          const prefix = w.leadingSpace || '';
          if (i === activeIdx) {
            html += `${prefix}<span class="lyric-word-highlight">${this._escapeHtml(w.text)}</span>`;
          } else {
            html += `${prefix}${this._escapeHtml(w.text)}`;
          }
        }
        if (html) textEl.innerHTML = html;
      }
    }
  }
  
  _showWordStatus(msg) {
    if (!this.elements.wordStatus) return;
    this.elements.wordStatus.textContent = msg;
    this.elements.wordStatus.classList.remove('hidden');
    if (this._wordStatusTimeout) clearTimeout(this._wordStatusTimeout);
    this._wordStatusTimeout = setTimeout(() => {
      this.elements.wordStatus.classList.add('hidden');
    }, 2000);
  }
}
