const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

let pipeline;

async function getTranscriber() {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
  }
  // Load the whisper-tiny model (multilingual) for fast inference
  return await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
}

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcriber = await getTranscriber();

    // The uploaded file is a raw Int16 PCM array at 16kHz
    const buffer = req.file.buffer;
    const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    
    // Convert Int16 to Float32 array, which is expected by Whisper
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Run Whisper inference
    const output = await transcriber(float32Array);

    res.json({ text: output.text });
  } catch (error) {
    console.error("Transcribe error:", error);
    res.status(500).json({ error: "Transcription failed" });
  }
});

module.exports = router;
