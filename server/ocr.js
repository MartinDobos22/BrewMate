import express from 'express';

import { correctOcrText, performOcrPipeline } from './services/ocr/index.js';

const router = express.Router();

router.post('/api/ocr-correct', async (req, res, next) => {
  try {
    const { imageBase64, languageHints } = req.body || {};

    console.log('[OCR] request received', {
      imageBase64Length: imageBase64?.length ?? 0,
      languageHints,
    });

    if (!imageBase64) {
      console.warn('[OCR] missing imageBase64');
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!visionApiKey) {
      console.error('[OCR] Google Vision API key missing');
      return res.status(500).json({ error: 'Google Vision API key is not configured.' });
    }

    const result = await performOcrPipeline({
      imageBase64,
      languageHints: Array.isArray(languageHints) ? languageHints : [],
      visionApiKey,
    });

    if (!result.rawText) {
      console.warn('[OCR] No text detected in image');
      return res.status(422).json({ error: 'No text detected in the image.' });
    }

    console.log('[OCR] Vision OCR text extracted', {
      rawTextLength: result.rawText.length,
      cleanedTextLength: result.cleanedText.length,
    });

    const { correctedText, usedAi } = await correctOcrText({
      text: result.cleanedText,
      openAiApiKey: process.env.OPENAI_API_KEY,
    });

    return res.status(200).json({
      ...result,
      correctedText,
      metadata: {
        ...result.metadata,
        usedAiCorrection: usedAi,
      },
    });
  } catch (error) {
    if (error?.details) {
      console.error('[OCR] OCR pipeline error', error.details);
    } else {
      console.error('[OCR] Unexpected error', error);
    }
    return next(error);
  }
});

export default router;
