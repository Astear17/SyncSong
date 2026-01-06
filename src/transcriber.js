/**
 * Transcriber - Lazy-loaded Whisper-based speech-to-text for lyrics
 * 
 * This module is designed to be lazy-loaded only when the user requests transcription.
 * The Whisper model is downloaded on first use and cached by the browser.
 */

let pipeline = null;
let transcriber = null;

/**
 * Initialize the transcription pipeline (downloads model on first use)
 * @param {function} onProgress - Progress callback ({ status, progress, file, loaded, total })
 * @returns {Promise<void>}
 */
export async function initTranscriber(onProgress) {
  if (transcriber) return; // Already initialized
  
  // Lazy-load the transformers library
  if (!pipeline) {
    const transformers = await import('@huggingface/transformers');
    pipeline = transformers.pipeline;
  }
  
  // Create the transcription pipeline with whisper-tiny for speed/size balance
  // Using Xenova model which properly supports timestamps
  // Model will be downloaded and cached on first use (~39MB)
  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny.en',
    {
      dtype: 'fp32', // Use fp32 for better compatibility
      device: 'wasm', // Use WASM for broader compatibility
      progress_callback: onProgress
    }
  );
}

/**
 * Convert audio file to Float32Array samples at 16kHz (Whisper's expected format)
 * @param {File|Blob} file - Audio file
 * @param {function} onStatus - Status callback for progress updates
 * @returns {Promise<{ samples: Float32Array, duration: number }>}
 */
async function audioFileToFloat32Array(file, onStatus) {
  console.log(`[Transcriber] Decoding audio file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  onStatus?.('Decoding audio file...');
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000 // Whisper expects 16kHz
  });
  
  console.log('[Transcriber] Reading file into memory...');
  const arrayBuffer = await file.arrayBuffer();
  
  console.log('[Transcriber] Decoding audio data to 16kHz...');
  onStatus?.('Converting audio to 16kHz...');
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const duration = audioBuffer.duration;
  console.log(`[Transcriber] Audio duration: ${duration.toFixed(1)}s`);
  
  // Get the first channel (mono)
  const channelData = audioBuffer.getChannelData(0);
  
  await audioContext.close();
  
  console.log(`[Transcriber] Audio decoded: ${channelData.length} samples at 16kHz`);
  return { samples: channelData, duration };
}

/**
 * Transcribe audio and return timestamped segments
 * @param {Float32Array|ArrayBuffer|Blob|File|string} audio - Audio data, file, or URL
 * @param {function} onProgress - Progress callback ({ progress, status, chunk, totalChunks })
 * @returns {Promise<{ text: string, chunks: Array<{ text: string, timestamp: [number, number] }> }>}
 */
export async function transcribe(audio, onProgress) {
  if (!transcriber) {
    throw new Error('Transcriber not initialized. Call initTranscriber first.');
  }
  
  // Convert File/Blob to Float32Array
  let audioData = audio;
  let audioDuration = 0;
  
  if (audio instanceof File || audio instanceof Blob) {
    const result = await audioFileToFloat32Array(audio, (status) => {
      onProgress?.({ status });
    });
    audioData = result.samples;
    audioDuration = result.duration;
  }
  
  // Calculate expected chunks for progress
  const chunkLength = 30; // seconds per chunk
  const totalChunks = Math.ceil(audioDuration / chunkLength) || 1;
  let currentChunk = 0;
  
  console.log(`[Transcriber] Starting transcription: ~${totalChunks} chunks expected`);
  console.log(`[Transcriber] Estimated time: ${(audioDuration * 1.5).toFixed(0)}-${(audioDuration * 3).toFixed(0)}s (depends on device)`);
  
  onProgress?.({ 
    status: `Starting transcription (${audioDuration.toFixed(0)}s of audio)...`,
    totalChunks,
    audioDuration
  });
  
  const startTime = Date.now();
  
  // Try with timestamps first, fall back to without if not supported
  try {
    const result = await transcriber(audioData, {
      return_timestamps: 'word',
      chunk_length_s: chunkLength,
      stride_length_s: 5,
      callback_function: (data) => {
        if (data.progress !== undefined) {
          currentChunk = Math.floor(data.progress * totalChunks);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = data.progress > 0 ? elapsed / data.progress : 0;
          const remaining = rate * (1 - data.progress);
          
          console.log(`[Transcriber] Progress: ${(data.progress * 100).toFixed(1)}% (chunk ~${currentChunk + 1}/${totalChunks})`);
          
          onProgress?.({ 
            progress: data.progress,
            chunk: currentChunk + 1,
            totalChunks,
            elapsed,
            remaining: remaining > 0 ? remaining : undefined,
            status: `Transcribing chunk ${currentChunk + 1} of ${totalChunks}...`
          });
        }
      }
    });
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`[Transcriber] Transcription complete in ${totalTime.toFixed(1)}s`);
    console.log(`[Transcriber] Found ${result.chunks?.length || 0} word chunks`);
    
    return result;
  } catch (error) {
    // If timestamps failed, try without
    if (error.message?.includes('cross attentions') || error.message?.includes('timestamps')) {
      console.warn('[Transcriber] Timestamp extraction not supported, retrying without timestamps');
      onProgress?.({ status: 'Retrying without timestamps...' });
      
      const result = await transcriber(audioData, {
        return_timestamps: false,
        chunk_length_s: chunkLength,
        stride_length_s: 5,
        callback_function: (data) => {
          if (data.progress !== undefined) {
            currentChunk = Math.floor(data.progress * totalChunks);
            onProgress?.({ 
              progress: data.progress,
              chunk: currentChunk + 1,
              totalChunks,
              status: `Transcribing chunk ${currentChunk + 1} of ${totalChunks}...`
            });
          }
        }
      });
      
      console.log(`[Transcriber] Transcription complete (no timestamps)`);
      return result;
    }
    throw error;
  }
}

/**
 * Clean transcribed text by removing artifacts from speech-to-text
 * @param {string} text - Raw transcribed text
 * @returns {string} Cleaned text
 */
function cleanTranscribedText(text) {
  return text
    // Remove music note emojis (various Unicode music symbols)
    .replace(/[♪♫♬♩🎵🎶]/g, '')
    // Remove mood/scene descriptions like (upbeat music), [applause], etc.
    .replace(/\([^)]*(?:music|applause|laughter|silence|pause|singing|humming|whistling)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(?:music|applause|laughter|silence|pause|singing|humming|whistling)[^\]]*\]/gi, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert Whisper output to LRC-compatible lines
 * Groups words into lines based on pauses and timing
 * @param {object} result - Whisper transcription result
 * @param {number} [maxLineLength=80] - Max characters per line
 * @param {number} [pauseThreshold=1.5] - Seconds of pause to trigger new line
 * @returns {Array<{ time: number, text: string }>}
 */
export function convertToLines(result, maxLineLength = 80, pauseThreshold = 1.5) {
  if (!result.chunks || result.chunks.length === 0) {
    // If no chunks, split by sentences/newlines
    const lines = result.text.split(/[.!?\n]+/).filter(s => s.trim());
    return lines.map((text, i) => ({
      time: null, // No timestamps available
      text: cleanTranscribedText(text)
    })).filter(l => l.text); // Remove empty lines after cleaning
  }
  
  const lines = [];
  let currentLine = [];
  let lineStartTime = null;
  let lastEndTime = 0;
  
  for (const chunk of result.chunks) {
    let word = cleanTranscribedText(chunk.text);
    if (!word) continue;
    
    const [startTime, endTime] = chunk.timestamp;
    
    // Start a new line if:
    // 1. This is the first word
    // 2. There's a significant pause
    // 3. Current line is too long
    const currentText = currentLine.join(' ');
    const wouldBeTooLong = (currentText + ' ' + word).length > maxLineLength;
    const significantPause = lineStartTime !== null && (startTime - lastEndTime) > pauseThreshold;
    
    if (currentLine.length > 0 && (significantPause || wouldBeTooLong)) {
      // Save current line
      const lineText = currentText.trim();
      if (lineText) {
        lines.push({
          time: lineStartTime,
          text: lineText
        });
      }
      currentLine = [];
      lineStartTime = null;
    }
    
    // Add word to current line
    if (lineStartTime === null) {
      lineStartTime = startTime;
    }
    currentLine.push(word);
    lastEndTime = endTime;
  }
  
  // Don't forget the last line
  if (currentLine.length > 0) {
    const lineText = currentLine.join(' ').trim();
    if (lineText) {
      lines.push({
        time: lineStartTime,
        text: lineText
      });
    }
  }
  
  return lines;
}

/**
 * Check if WebGPU is available (for better performance)
 * @returns {Promise<boolean>}
 */
export async function isWebGPUAvailable() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Dispose of the transcriber to free memory
 */
export async function disposeTranscriber() {
  if (transcriber) {
    await transcriber.dispose();
    transcriber = null;
  }
}
