/**
 * Transcriber - Lazy-loaded Whisper-based speech-to-text for lyrics
 * 
 * This module runs transcription in a Web Worker to keep the UI responsive.
 * Audio decoding happens on the main thread (Web Audio API), then samples
 * are transferred to the worker for transcription.
 */

let worker = null;
let currentModel = null;

/**
 * Available Whisper models (English-only for lyrics)
 */
export const WHISPER_MODELS = {
  'Xenova/whisper-tiny.en': { name: 'Tiny', size: '~39 MB' },
  'Xenova/whisper-base.en': { name: 'Base', size: '~74 MB' },
  'Xenova/whisper-small.en': { name: 'Small', size: '~244 MB' },
  'Xenova/whisper-medium.en': { name: 'Medium', size: '~769 MB' },
};

export const DEFAULT_MODEL = 'Xenova/whisper-tiny.en';

/**
 * Get or create the transcriber worker
 */
function getWorker() {
  if (!worker) {
    worker = new Worker(
      new URL('./transcriber-worker.js', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

/**
 * Decode audio file to Float32Array at 16kHz on main thread
 * @param {File|Blob} file - Audio file
 * @param {function} onStatus - Status callback
 * @returns {Promise<{ samples: Float32Array, duration: number }>}
 */
async function decodeAudioFile(file, onStatus) {
  console.log(`[Transcriber] Decoding audio: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  onStatus?.({ status: 'Decoding audio file...' });
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000
  });
  
  const arrayBuffer = await file.arrayBuffer();
  onStatus?.({ status: 'Converting audio to 16kHz...' });
  
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0);
  
  await audioContext.close();
  
  console.log(`[Transcriber] Audio decoded: ${channelData.length} samples, ${duration.toFixed(1)}s`);
  return { samples: channelData, duration };
}

/**
 * Initialize the transcription pipeline (downloads model on first use)
 * @param {function} onProgress - Progress callback ({ status, progress, file, loaded, total })
 * @param {string} [modelId] - Model to use (defaults to whisper-tiny.en)
 * @returns {Promise<void>}
 */
export function initTranscriber(onProgress, modelId = DEFAULT_MODEL) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    
    // If same model already loaded, skip
    if (currentModel === modelId) {
      resolve();
      return;
    }
    
    const handleMessage = (e) => {
      const { type, data } = e.data;
      
      if (type === 'init-progress') {
        onProgress?.(data);
      } else if (type === 'init-complete') {
        currentModel = modelId;
        w.removeEventListener('message', handleMessage);
        resolve();
      } else if (type === 'error') {
        w.removeEventListener('message', handleMessage);
        reject(new Error(data));
      }
    };
    
    w.addEventListener('message', handleMessage);
    w.postMessage({ type: 'init', data: { modelId } });
  });
}

/**
 * Transcribe audio file and return lines with timestamps
 * @param {File|Blob} audioFile - Audio file to transcribe
 * @param {function} onProgress - Progress callback ({ progress, status, chunk, totalChunks })
 * @returns {Promise<Array<{ time: number|null, text: string }>>}
 */
export async function transcribe(audioFile, onProgress) {
  const w = getWorker();
  
  // Decode audio on main thread (Web Audio API not available in workers)
  const { samples, duration } = await decodeAudioFile(audioFile, onProgress);
  
  // Transfer samples to worker for transcription
  return new Promise((resolve, reject) => {
    const handleMessage = (e) => {
      const { type, data } = e.data;
      
      if (type === 'status') {
        onProgress?.({ status: data });
      } else if (type === 'transcribe-progress') {
        onProgress?.(data);
      } else if (type === 'transcribe-complete') {
        w.removeEventListener('message', handleMessage);
        console.log(`[Transcriber] Complete: ${data.lines.length} lines in ${data.duration.toFixed(1)}s`);
        resolve(data.lines);
      } else if (type === 'error') {
        w.removeEventListener('message', handleMessage);
        reject(new Error(data));
      }
    };
    
    w.addEventListener('message', handleMessage);
    
    // Transfer the samples buffer to the worker (zero-copy)
    w.postMessage({ 
      type: 'transcribe', 
      data: { samples, duration } 
    }, [samples.buffer]);
  });
}

/**
 * Dispose of the worker to free memory
 */
export function disposeTranscriber() {
  if (worker) {
    worker.terminate();
    worker = null;
    currentModel = null;
  }
}
