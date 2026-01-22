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

const buildCoffeeProfilePayload = (text) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.3,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'coffee_profile',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'flavorNotes',
          'tasteProfile',
          'expertSummary',
          'laymanSummary',
          'preferenceHint',
          'confidence',
          'source',
          'reasoning',
          'missingInfo',
        ],
        properties: {
          flavorNotes: {
            type: 'array',
            items: { type: 'string' },
          },
          tasteProfile: { type: 'string' },
          expertSummary: { type: 'string' },
          laymanSummary: { type: 'string' },
          preferenceHint: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source: {
            type: 'string',
            enum: ['label', 'inferred', 'mixed', 'low_info'],
          },
          reasoning: { type: 'string' },
          missingInfo: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'You are a coffee sensory analyst. Infer a coffee flavor profile from the provided package text. '
        + 'If flavor notes are explicitly stated, use them verbatim. If not, infer likely notes from origin, '
        + 'processing, and roast if present. If the text is sparse, provide a cautious guess with low confidence. '
        + 'Explain briefly why the notes were chosen. Output must match the JSON schema exactly.',
    },
    {
      role: 'user',
      content: `Analyze this package text and produce the coffee flavor profile JSON:\n\n${text}`,
    },
  ],
});

const buildCoffeeQuestionnairePayload = (answers) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.3,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'coffee_questionnaire',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'profileSummary',
          'recommendedStyle',
          'recommendedOrigins',
          'brewingTips',
        ],
        properties: {
          profileSummary: { type: 'string' },
          recommendedStyle: { type: 'string' },
          recommendedOrigins: { type: 'string' },
          brewingTips: { type: 'string' },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'Si coffee sensory analytik pre baristu. Z odpovedí zákazníka odhadni profil chutí '
        + 'a odporuč štýl kávy. Odpovedaj po slovensky a drž sa stručných odstavcov. '
        + 'Výstup musí presne sedieť na JSON schému.',
    },
    {
      role: 'user',
      content: `Vyhodnoť chuťový dotazník zákazníka a odporuč kávu. Odpovede:\n\n${answers}`,
    },
  ],
});

const buildCoffeeMatchPayload = (questionnaire, coffeeProfile) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.2,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'coffee_match',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'willLike',
          'confidence',
          'baristaSummary',
          'laymanSummary',
          'keyMatches',
          'keyConflicts',
          'suggestedAdjustments',
        ],
        properties: {
          willLike: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          baristaSummary: { type: 'string' },
          laymanSummary: { type: 'string' },
          keyMatches: { type: 'array', items: { type: 'string' } },
          keyConflicts: { type: 'array', items: { type: 'string' } },
          suggestedAdjustments: { type: 'string' },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'Si coffee sensory analytik. Porovnaj profil chutí z dotazníka s profilom kávy z etikety. '
        + 'Vráť verdikt či bude káva chutiť, s istotou, a vysvetlenie pre baristu aj laika. '
        + 'Buď konkrétny, odkazuj na zhody/konflikty v preferenciách (kyslosť, horkosť, telo, sladkosť, ovocnosť, intenzita). '
        + 'Výstup musí presne sedieť na JSON schému.',
    },
    {
      role: 'user',
      content: `Dotazník (profil + odpovede):\n${JSON.stringify(
        questionnaire,
        null,
        2,
      )}\n\nProfil kávy:\n${JSON.stringify(coffeeProfile, null, 2)}`,
    },
  ],
});

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

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[OCR] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    const cleanedBase64 = stripDataUrlPrefix(imageBase64);
    const visionPayload = buildVisionPayload(cleanedBase64, Array.isArray(languageHints) ? languageHints : []);

    console.log('[OCR] sending Google Vision request', {
      payloadSize: JSON.stringify(visionPayload).length,
    });

    const visionRequestStart = Date.now();
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
    console.log('[OCR] Google Vision response received', {
      status: visionResponse.status,
      durationMs: Date.now() - visionRequestStart,
    });

    if (!visionResponse.ok) {
      console.error('[OCR] Google Vision request failed', {
        status: visionResponse.status,
        details: visionData,
      });
      return res.status(502).json({
        error: 'Google Vision API request failed.',
        details: visionData,
      });
    }

    if (visionData?.responses?.[0]?.error) {
      console.error('[OCR] Google Vision returned error', visionData.responses[0].error);
      return res.status(502).json({
        error: 'Google Vision API returned an error.',
        details: visionData.responses[0].error,
      });
    }

    const rawText = extractVisionText(visionData).trim();
    if (!rawText) {
      console.warn('[OCR] No text detected in image');
      return res.status(422).json({ error: 'No text detected in the image.' });
    }

    console.log('[OCR] Vision OCR text extracted', {
      rawTextLength: rawText.length,
    });

    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOpenAiPayload(rawText)),
    });

    const openAiData = await openAiResponse.json();
    console.log('[OCR] OpenAI correction response received', {
      status: openAiResponse.status,
      durationMs: Date.now() - openAiRequestStart,
    });

    if (!openAiResponse.ok) {
      console.error('[OCR] OpenAI request failed', {
        status: openAiResponse.status,
        details: openAiData,
      });
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const correctedText = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!correctedText) {
      console.error('[OCR] OpenAI response missing corrected text', {
        openAiData,
      });
      return res.status(502).json({ error: 'OpenAI did not return corrected text.' });
    }

    console.log('[OCR] OpenAI corrected text ready', {
      correctedTextLength: correctedText.length,
    });

    return res.status(200).json({
      rawText,
      correctedText,
    });
  } catch (error) {
    console.error('[OCR] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-profile', async (req, res, next) => {
  try {
    const { text, rawText } = req.body || {};
    const sourceText = typeof text === 'string' && text.trim()
      ? text.trim()
      : typeof rawText === 'string'
        ? rawText.trim()
        : '';

    console.log('[CoffeeProfile] request received', {
      textLength: sourceText.length,
    });

    if (!sourceText) {
      return res.status(400).json({ error: 'text is required.' });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[CoffeeProfile] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCoffeeProfilePayload(sourceText)),
    });

    const openAiData = await openAiResponse.json();
    console.log('[CoffeeProfile] OpenAI response received', {
      status: openAiResponse.status,
      durationMs: Date.now() - openAiRequestStart,
    });

    if (!openAiResponse.ok) {
      console.error('[CoffeeProfile] OpenAI request failed', {
        status: openAiResponse.status,
        details: openAiData,
      });
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const profileContent = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!profileContent) {
      console.error('[CoffeeProfile] OpenAI response missing profile content', {
        openAiData,
      });
      return res.status(502).json({ error: 'OpenAI did not return a coffee profile.' });
    }

    let profile;
    try {
      profile = JSON.parse(profileContent);
    } catch (parseError) {
      console.error('[CoffeeProfile] Failed to parse profile JSON', {
        profileContent,
        parseError,
      });
      return res.status(502).json({
        error: 'Failed to parse coffee profile response.',
        rawProfile: profileContent,
      });
    }

    return res.status(200).json({ profile });
  } catch (error) {
    console.error('[CoffeeProfile] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-questionnaire', async (req, res, next) => {
  try {
    const { answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers are required.' });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[CoffeeQuestionnaire] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    const formattedAnswers = answers
      .map((item, index) => `${index + 1}. ${item.question}: ${item.answer}`)
      .join('\n');

    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCoffeeQuestionnairePayload(formattedAnswers)),
    });

    const openAiData = await openAiResponse.json();
    console.log('[CoffeeQuestionnaire] OpenAI response received', {
      status: openAiResponse.status,
      durationMs: Date.now() - openAiRequestStart,
    });

    if (!openAiResponse.ok) {
      console.error('[CoffeeQuestionnaire] OpenAI request failed', {
        status: openAiResponse.status,
        details: openAiData,
      });
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const profileContent = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!profileContent) {
      console.error('[CoffeeQuestionnaire] OpenAI response missing content', {
        openAiData,
      });
      return res.status(502).json({ error: 'OpenAI did not return a questionnaire profile.' });
    }

    let profile;
    try {
      profile = JSON.parse(profileContent);
    } catch (parseError) {
      console.error('[CoffeeQuestionnaire] Failed to parse response JSON', {
        profileContent,
        parseError,
      });
      return res.status(502).json({
        error: 'Failed to parse questionnaire response.',
        rawProfile: profileContent,
      });
    }

    return res.status(200).json({ profile });
  } catch (error) {
    console.error('[CoffeeQuestionnaire] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-match', async (req, res, next) => {
  try {
    const { questionnaire, coffeeProfile } = req.body || {};

    if (!questionnaire || !coffeeProfile) {
      return res.status(400).json({
        error: 'questionnaire and coffeeProfile are required.',
      });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[CoffeeMatch] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCoffeeMatchPayload(questionnaire, coffeeProfile)),
    });

    const openAiData = await openAiResponse.json();
    console.log('[CoffeeMatch] OpenAI response received', {
      status: openAiResponse.status,
      durationMs: Date.now() - openAiRequestStart,
    });

    if (!openAiResponse.ok) {
      console.error('[CoffeeMatch] OpenAI request failed', {
        status: openAiResponse.status,
        details: openAiData,
      });
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const matchContent = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!matchContent) {
      console.error('[CoffeeMatch] OpenAI response missing content', {
        openAiData,
      });
      return res.status(502).json({ error: 'OpenAI did not return a match result.' });
    }

    let match;
    try {
      match = JSON.parse(matchContent);
    } catch (parseError) {
      console.error('[CoffeeMatch] Failed to parse response JSON', {
        matchContent,
        parseError,
      });
      return res.status(502).json({
        error: 'Failed to parse match response.',
        rawMatch: matchContent,
      });
    }

    return res.status(200).json({ match });
  } catch (error) {
    console.error('[CoffeeMatch] Unexpected error', error);
    return next(error);
  }
});

export default router;
