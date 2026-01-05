/**
 * Editor - Core editing logic for LRC timestamps
 */

import { formatTimestamp, generateTimestamps, serializeLRC } from './lrc-parser.js';

export class LyricEditor {
  constructor() {
    this.lines = [];
    this.metadata = {};
    this.selectedIndex = 0;
    this.currentPlayingIndex = -1;
    
    // Callbacks
    this.onLineSelect = null;
    this.onLineUpdate = null;
    this.onLyricsChange = null;
  }
  
  /**
 * Load parsed lyrics data
 * @param {{ metadata: object, lines: Array }} data
 */
  loadLyrics(data) {
    this.metadata = { ...data.metadata };
    this.lines = data.lines.map((line, index) => ({
      ...line,
      id: index
    }));
    this.selectedIndex = 0;
    this.currentPlayingIndex = -1;
    
    if (this.onLyricsChange) {
      this.onLyricsChange(this.lines, this.metadata);
    }
  }
  
  /**
   * Clear all lyrics and metadata
   */
  clear() {
    this.lines = [];
    this.metadata = {};
    this.selectedIndex = 0;
    this.currentPlayingIndex = -1;
    
    if (this.onLyricsChange) {
      this.onLyricsChange(this.lines, this.metadata);
    }
  }
  
  /**
   * Check if lyrics have any unsynced lines (null timestamps)
   * @returns {boolean}
   */
  hasUnsyncedLines() {
    return this.lines.some(l => l.time === null);
  }
  
  /**
   * Select a line by index
   * @param {number} index
   */
  selectLine(index) {
    if (index < 0 || index >= this.lines.length) return;
    
    this.selectedIndex = index;
    
    if (this.onLineSelect) {
      this.onLineSelect(index, this.lines[index]);
    }
  }
  
  /**
   * Select next line
   */
  selectNextLine() {
    this.selectLine(Math.min(this.selectedIndex + 1, this.lines.length - 1));
  }
  
  /**
   * Select previous line
   */
  selectPreviousLine() {
    this.selectLine(Math.max(this.selectedIndex - 1, 0));
  }
  
  /**
   * Mark current line with timestamp and advance to next line
   * @param {number} currentTime - Current playback time
   * @returns {{ markedIndex: number, nextIndex: number }} Indices of marked and next lines
   */
  markAndAdvance(currentTime) {
    const markedIndex = this.selectedIndex;
    
    // Set timestamp for current line
    this.setTimestamp(markedIndex, currentTime);
    
    // Advance to next line (if not at end)
    if (this.selectedIndex < this.lines.length - 1) {
      this.selectNextLine();
    }
    
    return {
      markedIndex,
      nextIndex: this.selectedIndex
    };
  }
  
  /**
   * Get currently selected line
   * @returns {{ time: number, text: string, id: number } | null}
   */
  getSelectedLine() {
    return this.lines[this.selectedIndex] || null;
  }
  
  /**
   * Adjust timestamp of selected line
   * @param {number} delta - Time adjustment in seconds
   * @returns {number} New timestamp
   */
  adjustTimestamp(delta) {
    if (this.lines.length === 0) return 0;
    
    const line = this.lines[this.selectedIndex];
    if (!line) return 0;
    
    // Calculate bounds based on adjacent lines (only if they have timestamps)
    const prevLine = this.lines[this.selectedIndex - 1];
    const nextLine = this.lines[this.selectedIndex + 1];
    
    // Only use bounds from lines that have actual timestamps
    const minTime = (prevLine?.time !== null && prevLine?.time !== undefined) ? prevLine.time : 0;
    const maxTime = (nextLine?.time !== null && nextLine?.time !== undefined) ? nextLine.time : Infinity;
    
    // Clamp the new time within bounds
    let newTime = (line.time || 0) + delta;
    newTime = Math.max(minTime, Math.min(maxTime, newTime));
    
    this.lines[this.selectedIndex] = { ...line, time: newTime };
    
    if (this.onLineUpdate) {
      this.onLineUpdate(this.selectedIndex, this.lines[this.selectedIndex]);
    }
    
    return newTime;
  }
  
  /**
   * Set timestamp for a specific line
   * @param {number} index - Line index
   * @param {number} time - New timestamp
   */
  setTimestamp(index, time) {
    if (index < 0 || index >= this.lines.length) return;
    
    this.lines[index] = { ...this.lines[index], time: Math.max(0, time) };
    
    if (this.onLineUpdate) {
      this.onLineUpdate(index, this.lines[index]);
    }
  }
  
  /**
   * Update the currently playing line based on current time
   * @param {number} currentTime - Current playback time
   * @returns {number} Index of current line
   */
  updatePlayingLine(currentTime) {
    let newIndex = -1;
    
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].time !== null && this.lines[i].time <= currentTime) {
        newIndex = i;
      } else if (this.lines[i].time !== null && this.lines[i].time > currentTime) {
        break;
      }
    }
    
    if (newIndex !== this.currentPlayingIndex) {
      this.currentPlayingIndex = newIndex;
    }
    
    return this.currentPlayingIndex;
  }
  
  /**
   * Update metadata
   * @param {string} key - Metadata key (artist, album, title)
   * @param {string} value - New value
   */
  updateMetadata(key, value) {
    this.metadata[key] = value;
  }
  
  /**
   * Get LRC formatted output
   * @returns {string}
   */
  toLRC() {
    // Sort lines by time before serializing
    const sortedLines = [...this.lines].sort((a, b) => {
      if (a.time === null && b.time === null) return 0;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });
    
    return serializeLRC({
      metadata: this.metadata,
      lines: sortedLines
    });
  }
  
  /**
   * Add a new line at the specified time
   * @param {number} time - Timestamp for the new line
   * @param {string} text - Text for the new line (optional)
   * @returns {number} Index where the line was inserted
   */
  addLine(time, text = '') {
    const newLine = {
      time,
      text,
      id: Date.now() // Unique ID
    };
    
    // Find the correct position to insert based on time
    let insertIndex = this.lines.findIndex(line => line.time !== null && line.time > time);
    if (insertIndex === -1) {
      insertIndex = this.lines.length;
    }
    
    this.lines.splice(insertIndex, 0, newLine);
    
    if (this.onLyricsChange) {
      this.onLyricsChange(this.lines, this.metadata);
    }
    
    // Select the newly added line
    this.selectLine(insertIndex);
    
    return insertIndex;
  }
  
  /**
   * Update the text of a line
   * @param {number} index - Line index
   * @param {string} text - New text
   */
  updateLineText(index, text) {
    if (index < 0 || index >= this.lines.length) return;
    
    this.lines[index] = { ...this.lines[index], text };
    
    if (this.onLineUpdate) {
      this.onLineUpdate(index, this.lines[index]);
    }
  }
  
  /**
   * Delete a line
   * @param {number} index - Line index to delete
   */
  deleteLine(index) {
    if (index < 0 || index >= this.lines.length) return;
    if (this.lines.length <= 1) return; // Keep at least one line
    
    this.lines.splice(index, 1);
    
    // Adjust selected index if needed
    if (this.selectedIndex >= this.lines.length) {
      this.selectedIndex = this.lines.length - 1;
    } else if (this.selectedIndex > index) {
      this.selectedIndex--;
    }
    
    if (this.onLyricsChange) {
      this.onLyricsChange(this.lines, this.metadata);
    }
    
    // Re-select the current line
    if (this.onLineSelect) {
      this.onLineSelect(this.selectedIndex, this.lines[this.selectedIndex]);
    }
  }
  
  /**
   * Get line count
   * @returns {number}
   */
  get lineCount() {
    return this.lines.length;
  }
  
  /**
   * Check if lyrics are loaded
   * @returns {boolean}
   */
  get hasLyrics() {
    return this.lines.length > 0;
  }
}
