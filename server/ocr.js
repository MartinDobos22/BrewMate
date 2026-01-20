import express from 'express';

const router = express.Router();

const stripDataUrlPrefix = (value) => value.replace(/^data:.*;base64,/, '');

const extractVisionText = (visionResponse) => {
  const response = visionResponse?.responses?.[0];
  return (
    response?.fullTextAnnotation?.text
    || response?.textAnnotations?.[0]?.description
    || ''
  );
};

const buildVisionPayload = (base64Image, languageHints = []) => ({
  requests: [
    {
      image: {
        content: base64Image,
      },
      features: [
        {
          type: 'TEXT_DETECTION',
        },
      ],
      ...(languageHints.length > 0
        ? {
          imageContext: {
            languageHints,
          },
        }
        : {}),
    },
  ],
});

const buildOpenAiPayload = (rawText) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.2,
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant that corrects OCR text while preserving meaning.',
    },
    {
      role: 'user',
      content: `Please correct spelling, punctuation, and formatting issues in this OCR text. Return only the corrected text:\n\n${rawText}`,
    },
  ],
});

router.post('/api/ocr-correct', async (req, res, next) => {
  try {
    const { imageBase64, languageHints } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!visionApiKey) {
      return res.status(500).json({ error: 'Google Vision API key is not configured.' });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    const cleanedBase64 = stripDataUrlPrefix(imageBase64);
    const visionPayload = buildVisionPayload(cleanedBase64, Array.isArray(languageHints) ? languageHints : []);

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visionPayload),
      },
    );

    const visionData = await visionResponse.json();

    if (!visionResponse.ok) {
      return res.status(502).json({
        error: 'Google Vision API request failed.',
        details: visionData,
      });
    }

    if (visionData?.responses?.[0]?.error) {
      return res.status(502).json({
        error: 'Google Vision API returned an error.',
        details: visionData.responses[0].error,
      });
    }

    const rawText = extractVisionText(visionData).trim();
    if (!rawText) {
      return res.status(422).json({ error: 'No text detected in the image.' });
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOpenAiPayload(rawText)),
    });

    const openAiData = await openAiResponse.json();

    if (!openAiResponse.ok) {
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const correctedText = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!correctedText) {
      return res.status(502).json({ error: 'OpenAI did not return corrected text.' });
    }

    return res.status(200).json({
      rawText,
      correctedText,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
