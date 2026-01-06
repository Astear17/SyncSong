/**
 * Transcriber Web Worker
 * Runs Whisper transcription off the main thread to keep UI responsive
 * 
 * Audio decoding happens on main thread (Web Audio API not available in workers),
 * then decoded samples are transferred here for transcription.
 */

import { pipeline } from '@huggingface/transformers';

let transcriber = null;
let currentModel = null;

/**
 * Initialize the transcription pipeline
 */
async function initTranscriber(modelId, onProgress) {
  // If already initialized with the same model, skip
  if (transcriber && currentModel === modelId) return;
  
  // If switching models, dispose the old one
  if (transcriber && currentModel !== modelId) {
    console.log(`[Worker] Switching model from ${currentModel} to ${modelId}`);
    if (transcriber.dispose) {
      await transcriber.dispose();
    }
    transcriber = null;
  }
  
  console.log(`[Worker] Loading model: ${modelId}`);
  transcriber = await pipeline(
    'automatic-speech-recognition',
    modelId,
    {
      dtype: 'fp32',
      device: 'wasm',
      progress_callback: onProgress
    }
  );
  currentModel = modelId;
}

/**
 * Clean transcribed text
 */
function cleanTranscribedText(text) {
  return text
    .replace(/[♪♫♬♩🎵🎶]/g, '')
    .replace(/\([^)]*(?:music|applause|laughter|silence|pause|singing|humming|whistling)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(?:music|applause|laughter|silence|pause|singing|humming|whistling)[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert Whisper output to LRC-compatible lines
 */
function convertToLines(result, maxLineLength = 80, pauseThreshold = 1.5) {
  if (!result.chunks || result.chunks.length === 0) {
    const lines = result.text.split(/[.!?\n]+/).filter(s => s.trim());
    return lines.map((text) => ({
      time: null,
      text: cleanTranscribedText(text)
    })).filter(l => l.text);
  }
  
  const lines = [];
  let currentLine = [];
  let lineStartTime = null;
  let lastEndTime = 0;
  
  for (const chunk of result.chunks) {
    let word = cleanTranscribedText(chunk.text);
    if (!word) continue;
    
    const [startTime, endTime] = chunk.timestamp;
    
    const currentText = currentLine.join(' ');
    const wouldBeTooLong = (currentText + ' ' + word).length > maxLineLength;
    const significantPause = lineStartTime !== null && (startTime - lastEndTime) > pauseThreshold;
    
    if (currentLine.length > 0 && (significantPause || wouldBeTooLong)) {
      const lineText = currentText.trim();
      if (lineText) {
        lines.push({ time: lineStartTime, text: lineText });
      }
      currentLine = [];
      lineStartTime = null;
    }
    
    if (lineStartTime === null) {
      lineStartTime = startTime;
    }
    currentLine.push(word);
    lastEndTime = endTime;
  }
  
  if (currentLine.length > 0) {
    const lineText = currentLine.join(' ').trim();
    if (lineText) {
      lines.push({ time: lineStartTime, text: lineText });
    }
  }
  
  return lines;
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (e) => {
  const { type, data } = e.data;
  
  if (type === 'init') {
    try {
      await initTranscriber(data.modelId, (progress) => {
        self.postMessage({ type: 'init-progress', data: progress });
      });
      self.postMessage({ type: 'init-complete' });
    } catch (error) {
      self.postMessage({ type: 'error', data: error.message });
    }
  }
  
  if (type === 'transcribe') {
    try {
      // Samples already decoded on main thread
      const { samples, duration } = data;
      
      // Calculate expected chunks for progress
      const chunkLength = 30;
      const totalChunks = Math.ceil(duration / chunkLength) || 1;
      const startTime = Date.now();
      
      self.postMessage({ 
        type: 'status', 
        data: `Starting transcription (${duration.toFixed(0)}s of audio)...` 
      });
      
      // Run transcription
      let result;
      try {
        result = await transcriber(samples, {
          return_timestamps: 'word',
          chunk_length_s: chunkLength,
          stride_length_s: 5,
          callback_function: (progress) => {
            if (progress.progress !== undefined) {
              const currentChunk = Math.floor(progress.progress * totalChunks);
              const elapsed = (Date.now() - startTime) / 1000;
              const rate = progress.progress > 0 ? elapsed / progress.progress : 0;
              const remaining = rate * (1 - progress.progress);
              
              self.postMessage({
                type: 'transcribe-progress',
                data: {
                  progress: progress.progress,
                  chunk: currentChunk + 1,
                  totalChunks,
                  elapsed,
                  remaining: remaining > 0 ? remaining : undefined
                }
              });
            }
          }
        });
      } catch (error) {
        // Fallback without timestamps
        if (error.message?.includes('cross attentions') || error.message?.includes('timestamps')) {
          console.warn('[Worker] Retrying without timestamps');
          self.postMessage({ type: 'status', data: 'Retrying without timestamps...' });
          result = await transcriber(samples, {
            return_timestamps: false,
            chunk_length_s: chunkLength,
            stride_length_s: 5
          });
        } else {
          throw error;
        }
      }
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`[Worker] Transcription complete in ${totalTime.toFixed(1)}s`);
      
      // Convert to lines
      const lines = convertToLines(result);
      
      self.postMessage({ 
        type: 'transcribe-complete', 
        data: { lines, duration: totalTime }
      });
      
    } catch (error) {
      console.error('[Worker] Transcription error:', error);
      self.postMessage({ type: 'error', data: error.message });
    }
  }
};