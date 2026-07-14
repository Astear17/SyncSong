/**
 * Editor - Core editing logic for LRC timestamps
 */

import { formatTimestamp, generateTimestamps, serializeLRC, serializeEnhancedLRC, serializeSRT, hasWordTimings } from './lrc-parser.js';

export class LyricEditor {
  constructor() {
    this.lines = [];
    this.metadata = {};
    this.selectedIndex = 0;
    this.currentPlayingIndex = -1;
    
    // Word-by-word mode state
    this.wordMode = false;
    this.selectedWordIndex = 0;
    
    // Callbacks
    this.onLineSelect = null;
    this.onLineUpdate = null;
    this.onLyricsChange = null;
    this.onWordUpdate = null;
  }
  
  /**
   * Load parsed lyrics data
   * @param {{ metadata: object, lines: Array }} data
   */
  loadLyrics(data) {
    this.metadata = { ...data.metadata };
    this.lines = data.lines.map((line, index) => ({
      ...line,
      endTime: line.endTime ?? null,
      id: index,
      words: line.words ? line.words.map(w => ({ ...w })) : undefined
    }));
    this.selectedIndex = 0;
    this.currentPlayingIndex = -1;
    this.selectedWordIndex = 0;
    
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
    const previousIndex = markedIndex - 1;
    const currentLine = this.lines[markedIndex];

    if (!currentLine) return { markedIndex, nextIndex: this.selectedIndex };

    if (currentLine.time !== null && currentTime > currentLine.time) {
      this.setEndTime(markedIndex, currentTime);
    } else if (previousIndex >= 0) {
      this.setEndTime(previousIndex, currentTime);

      // Set timestamp for current line only the first time it is marked.
      if (currentLine.time === null) {
        this.setTimestamp(markedIndex, currentTime);
      }
    } else if (currentLine.time === null) {
      this.setTimestamp(markedIndex, currentTime);
    }
    
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
    
    const oldTime = this.lines[index].time;
    const newTime = Math.max(0, time);
    
    if (oldTime !== null && this.lines[index].words && this.lines[index].words.length > 0) {
      const delta = newTime - oldTime;
      const wouldBreak = this.lines[index].words.some((w, i) => {
        if (w.startTime == null) return false;
        const shifted = w.startTime + delta;
        const prev = i > 0 ? this.lines[index].words[i - 1].startTime : null;
        if (prev != null && shifted < prev) return true;
        return shifted < 0;
      });
      
      if (!wouldBreak) {
        this.shiftWordTimings(index, delta);
      }
    }
    
    this.lines[index] = { ...this.lines[index], time: newTime };
    
    if (this.onLineUpdate) {
      this.onLineUpdate(index, this.lines[index]);
    }
  }

  /**
   * Set end timestamp for a specific line
   * @param {number} index - Line index
   * @param {number} time - New end timestamp
   */
  setEndTime(index, time) {
    if (index < 0 || index >= this.lines.length) return;

    const line = this.lines[index];
    const endTime = Math.max(0, time);
    if (line.time === null || !Number.isFinite(endTime) || endTime <= line.time) return;

    this.lines[index] = { ...line, endTime };

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
   * @param {boolean} enhanced - If true, output Enhanced LRC with word timings
   * @returns {string}
   */
  toLRC(enhanced = false) {
    // Sort lines by time before serializing
    const sortedLines = [...this.lines].sort((a, b) => {
      if (a.time === null && b.time === null) return 0;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });
    
    const data = {
      metadata: this.metadata,
      lines: sortedLines
    };
    
    if (enhanced && this.hasAnyWordTimings) {
      return serializeEnhancedLRC(data);
    }
    
    return serializeLRC(data);
  }

  /**
   * Get SRT formatted output
   * @param {number} audioDuration - Audio duration in seconds
   * @returns {string}
   */
  toSRT(audioDuration) {
    // Sort lines by time before serializing
    const sortedLines = [...this.lines].sort((a, b) => {
      if (a.time === null && b.time === null) return 0;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });

    return serializeSRT(sortedLines, audioDuration);
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
      endTime: null,
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
   * @returns {string|undefined} 'words_reset' if word timings were cleared due to text change
   */
  updateLineText(index, text) {
    if (index < 0 || index >= this.lines.length) return;
    
    let result;
    if (this.lines[index].words && this.lines[index].words.length > 0) {
      result = this.updateLineTextPreservingWords(index, text);
    } else {
      this.lines[index] = { ...this.lines[index], text };
    }
    
    if (this.onLineUpdate) {
      this.onLineUpdate(index, this.lines[index]);
    }
    
    return result;
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
  
  // ─── Word-by-Word Mode ──────────────────────────────────────────────────

  setWordMode(enabled) {
    this.wordMode = enabled;
    if (enabled) {
      this.ensureWordsForLine(this.selectedIndex);
      this.selectedWordIndex = 0;
    }
  }
  
  ensureWordsForLine(index) {
    const line = this.lines[index];
    if (!line) return;
    if (line.words && line.words.length > 0) return;
    
    const tokens = this._tokenizeText(line.text);
    const count = tokens.length;
    if (count === 0) return;
    
    // Create word objects without timestamps — they will be set by the
    // user via syncCurrentWordAndAdvance.  When the line already has a
    // timestamp we pre-fill evenly-distributed rough times as before.
    if (line.time !== null) {
      const lineStart = line.time;
      const nextLine = this.lines[index + 1];
      const lineEnd = (nextLine && nextLine.time !== null) ? nextLine.time : lineStart + 3;
      const span = (lineEnd - lineStart) / count;
      line.words = tokens.map((tok, i) => ({
        text: tok,
        startTime: lineStart + i * span,
        leadingSpace: i > 0 ? ' ' : '',
        trailingSpace: ''
      }));
    } else {
      line.words = tokens.map((tok, i) => ({
        text: tok,
        startTime: null,
        leadingSpace: i > 0 ? ' ' : '',
        trailingSpace: ''
      }));
    }
  }
  
  _tokenizeText(text) {
    if (!text || !text.trim()) return [];
    const tokens = [];
    const re = /(\S+)(\s*)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      tokens.push(m[1]);
    }
    return tokens;
  }
  
  selectWord(index) {
    const line = this.lines[this.selectedIndex];
    if (!line || !line.words) return;
    this.selectedWordIndex = Math.max(0, Math.min(index, line.words.length - 1));
  }
  
  selectNextWord() {
    const line = this.lines[this.selectedIndex];
    if (!line || !line.words) return false;
    if (this.selectedWordIndex < line.words.length - 1) {
      this.selectedWordIndex++;
      return true;
    }
    return false;
  }
  
  selectPreviousWord() {
    if (this.selectedWordIndex > 0) {
      this.selectedWordIndex--;
      return true;
    }
    return false;
  }
  
  markWordAndAdvance(currentTime) {
    const result = this.syncCurrentWordAndAdvance(currentTime);
    return {
      markedWord: result.markedWordIndex,
      advanced: result.action !== 'finished'
    };
  }
  
  /**
   * Central word-sync method. Timestamps the currently selected word, then
   * advances selection to the next word. When the last word of a line is
   * synced the selection crosses to the first word of the next non-empty
   * line WITHOUT timestamping it. When the last word of the last line is
   * synced the selection stays put and `action` is 'finished'.
   *
   * @param {number} currentTime
   * @returns {{ markedLineIndex: number, markedWordIndex: number, action: 'synced'|'advanced'|'crossed_line'|'finished' }}
   */
  syncCurrentWordAndAdvance(currentTime) {
    if (this.lines.length === 0) {
      return { markedLineIndex: -1, markedWordIndex: -1, action: 'finished' };
    }
    
    // Ensure words exist for the current line
    this.ensureWordsForLine(this.selectedIndex);
    
    let line = this.lines[this.selectedIndex];
    if (!line || !line.words || line.words.length === 0) {
      // Empty or tokenizable-less line — skip to next usable line
      const skipped = this._advanceToNextLineWithWords();
      return {
        markedLineIndex: -1,
        markedWordIndex: -1,
        action: skipped ? 'crossed_line' : 'finished'
      };
    }
    
    const wordIdx = this.selectedWordIndex;
    const word = line.words[wordIdx];
    if (!word) {
      return { markedLineIndex: this.selectedIndex, markedWordIndex: wordIdx, action: 'finished' };
    }
    
    // Timestamp the word
    word.startTime = currentTime;
    
    // If this is the first word being synced on the line and the line has
    // no timestamp yet, adopt the word's timestamp as the line timestamp.
    if (line.time === null) {
      line.time = currentTime;
      if (this.onLineUpdate) {
        this.onLineUpdate(this.selectedIndex, line);
      }
    }
    
    const markedLineIdx = this.selectedIndex;
    const markedWordIdx = wordIdx;
    const isLastWord = wordIdx >= line.words.length - 1;
    
    if (!isLastWord) {
      // Advance to the next word within the same line
      this.selectedWordIndex = wordIdx + 1;
      return { markedLineIndex: markedLineIdx, markedWordIndex: markedWordIdx, action: 'advanced' };
    }
    
    // Last word of the line was just synced — move to next line's first word
    const moved = this._advanceToNextLineWithWords();
    if (moved) {
      return { markedLineIndex: markedLineIdx, markedWordIndex: markedWordIdx, action: 'crossed_line' };
    }
    
    // No more lines — stay on the last word
    return { markedLineIndex: markedLineIdx, markedWordIndex: markedWordIdx, action: 'finished' };
  }
  
  /**
   * Move selection to the next line that has (or can have) words, setting
   * selectedWordIndex to 0. Returns true if a suitable line was found.
   */
  _advanceToNextLineWithWords() {
    for (let i = this.selectedIndex + 1; i < this.lines.length; i++) {
      const candidate = this.lines[i];
      if (!candidate || candidate.text.trim() === '') continue; // skip empty lines
      
      this.selectLine(i);
      this.ensureWordsForLine(i);
      this.selectedWordIndex = 0;
      return true;
    }
    return false;
  }
  
  /**
   * Find the first unsynced word starting from the current selection.
   * If the current line has unsynced words, selects the first one.
   * Otherwise moves forward looking for a line with unsynced words.
   * Returns false if everything is already synced.
   */
  selectFirstUnsyncedWord() {
    // Check current line first
    const currentLine = this.lines[this.selectedIndex];
    if (currentLine && currentLine.words) {
      const unsyncedIdx = currentLine.words.findIndex(w => w.startTime == null);
      if (unsyncedIdx >= 0) {
        this.selectedWordIndex = unsyncedIdx;
        return true;
      }
    }
    
    // Scan forward
    for (let i = this.selectedIndex + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line || line.text.trim() === '') continue;
      this.ensureWordsForLine(i);
      if (line.words) {
        const unsyncedIdx = line.words.findIndex(w => w.startTime == null);
        if (unsyncedIdx >= 0) {
          this.selectLine(i);
          this.selectedWordIndex = unsyncedIdx;
          return true;
        }
      }
    }
    
    return false;
  }
  
  adjustWordTimestamp(delta) {
    const line = this.lines[this.selectedIndex];
    if (!line || !line.words) return;
    
    const word = line.words[this.selectedWordIndex];
    if (!word) return;
    
    const prevWord = line.words[this.selectedWordIndex - 1];
    const nextWord = line.words[this.selectedWordIndex + 1];
    
    const minTime = prevWord && prevWord.startTime != null ? prevWord.startTime : (line.time || 0);
    const maxTime = nextWord && nextWord.startTime != null ? nextWord.startTime : Infinity;
    
    let newTime = (word.startTime || 0) + delta;
    newTime = Math.max(minTime, Math.min(maxTime, newTime));
    word.startTime = Math.round(newTime * 100) / 100;
    
    if (this.onWordUpdate) {
      this.onWordUpdate(this.selectedIndex, this.selectedWordIndex);
    }
  }
  
  clearWordTimingsForLine(index) {
    const line = this.lines[index];
    if (!line) return;
    delete line.words;
    this.selectedWordIndex = 0;
  }
  
  generateWordTimingsForLine(index) {
    const line = this.lines[index];
    if (!line || line.time === null) return;
    
    const tokens = this._tokenizeText(line.text);
    const count = tokens.length;
    if (count === 0) return;
    
    const lineStart = line.time;
    const nextLine = this.lines[index + 1];
    const lineEnd = (nextLine && nextLine.time !== null) ? nextLine.time : lineStart + 3;
    const span = (lineEnd - lineStart) / count;
    
    line.words = tokens.map((tok, i) => ({
      text: tok,
      startTime: Math.round((lineStart + i * span) * 100) / 100,
      leadingSpace: i > 0 ? ' ' : '',
      trailingSpace: ''
    }));
  }
  
  generateAllWordTimings() {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].time !== null && (!this.lines[i].words || this.lines[i].words.length === 0)) {
        this.generateWordTimingsForLine(i);
      }
    }
  }
  
  updateLineTextPreservingWords(index, newText) {
    const line = this.lines[index];
    if (!line) return;
    
    if (!line.words || line.words.length === 0) {
      line.text = newText;
      return;
    }
    
    const newTokens = this._tokenizeText(newText);
    const oldWords = line.words;
    
    const canPreserve = newTokens.length === oldWords.length &&
      newTokens.every((t, i) => t === oldWords[i].text);
    
    if (canPreserve) {
      line.text = newText;
      for (let i = 0; i < oldWords.length; i++) {
        oldWords[i].leadingSpace = i > 0 ? ' ' : '';
        oldWords[i].trailingSpace = '';
      }
    } else {
      delete line.words;
      line.text = newText;
      this.selectedWordIndex = 0;
      return 'words_reset';
    }
  }
  
  shiftWordTimings(index, delta) {
    const line = this.lines[index];
    if (!line || !line.words) return;
    
    for (const w of line.words) {
      if (w.startTime != null) {
        w.startTime = Math.round((w.startTime + delta) * 100) / 100;
      }
    }
  }
  
  getActiveWordIndex(currentTime) {
    const line = this.lines[this.currentPlayingIndex];
    if (!line || !line.words) return -1;
    
    for (let i = line.words.length - 1; i >= 0; i--) {
      if (line.words[i].startTime != null && line.words[i].startTime <= currentTime) {
        return i;
      }
    }
    return -1;
  }
  
  toEnhancedLRC() {
    const sortedLines = [...this.lines].sort((a, b) => {
      if (a.time === null && b.time === null) return 0;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });
    
    return serializeEnhancedLRC({
      metadata: this.metadata,
      lines: sortedLines
    });
  }
  
  get hasAnyWordTimings() {
    return hasWordTimings({ lines: this.lines });
  }
}
