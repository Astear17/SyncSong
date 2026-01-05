/**
 * LRC Editor - Main entry point
 */

import './style.css';
import { AudioPlayer } from './audio-player.js';
import { LyricEditor } from './editor.js';
import { UI } from './ui.js';

// Initialize the application
function init() {
  // Create core instances
  const player = new AudioPlayer();
  const editor = new LyricEditor();
  
  // Initialize UI (connects everything together)
  const ui = new UI(editor, player);
  
  // Expose for debugging in development
  if (import.meta.env.DEV) {
    window.__lrcEditor = { player, editor, ui };
  }
  
  console.log('🎵 LRC Editor initialized');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
