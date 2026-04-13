import express from 'express';

const router = express.Router();

const stripDataUrlPrefix = (value) => value.replace(/^data:.*;base64,/, '');
const DEFAULT_BREW_RATIO = 15.5;
const toNumberOrNull = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

const GRINDER_MODEL_GUIDES = [
  {
    match: /(comandante|c40)/i,
    name: 'Comandante C40',
    ranges: {
      espresso: '10–15 klikov',
      moka: '16–22 klikov',
      pourover: '22–30 klikov',
      filter: '22–30 klikov',
      aeropress: '18–25 klikov',
      frenchpress: '30–38 klikov',
    },
  },
  {
    match: /(1zpresso|k-ultra|j-ultra|x-pro|q2)/i,
    name: '1Zpresso',
    ranges: {
      espresso: '2.0.0–3.0.0',
      moka: '3.0.0–4.0.0',
      pourover: '4.0.0–6.0.0',
      filter: '4.0.0–6.0.0',
      aeropress: '3.5.0–5.0.0',
      frenchpress: '6.0.0–8.0.0',
    },
  },
  {
    match: /(timemore|chestnut|c2|c3)/i,
    name: 'Timemore Chestnut',
    ranges: {
      espresso: '8–12 klikov',
      moka: '12–15 klikov',
      pourover: '15–22 klikov',
      filter: '15–22 klikov',
      aeropress: '12–18 klikov',
      frenchpress: '22–28 klikov',
    },
  },
];

const normalizeMethodKey = (value) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('espresso')) return 'espresso';
  if (text.includes('moka')) return 'moka';
  if (text.includes('french')) return 'frenchpress';
  if (text.includes('aeropress')) return 'aeropress';
  if (text.includes('v60') || text.includes('origami') || text.includes('kalita')
    || text.includes('chemex') || text.includes('pour') || text.includes('filter')) return 'pourover';
  return 'filter';
};

const buildGrinderGuidance = (grinderProfile, selectedPreparation) => {
  if (!grinderProfile || typeof grinderProfile !== 'object') {
    return null;
  }

  const grinderModel = String(grinderProfile.grinderModel || '');
  const methodKey = normalizeMethodKey(selectedPreparation);
  const modelGuide = GRINDER_MODEL_GUIDES.find((guide) => guide.match.test(grinderModel));
  if (!modelGuide) {
    return {
      matchedModel: null,
      targetRange: null,
      instruction: 'Ak model nie je známy, nepoužívaj náhodné čísla. Uveď relatívne mletie (jemné/stredné/hrubé) a prispôsob ho škále, ktorú zadal používateľ.',
    };
  }

  const range = modelGuide.ranges[methodKey] || modelGuide.ranges.filter;
  return {
    matchedModel: modelGuide.name,
    targetRange: range,
    instruction: `Preferuj rozpätie ${range} pre metódu ${selectedPreparation}. Ak zadaná škála používa iné značky, mapuj odporúčanie do tejto škály a vysvetli to priamo v poli grind.`,
  };
};

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
          'tasteVector',
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
          tasteVector: {
            type: 'object',
            additionalProperties: false,
            required: ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'],
            properties: {
              acidity: { type: 'number', enum: [0, 25, 50, 75, 100] },
              sweetness: { type: 'number', enum: [0, 25, 50, 75, 100] },
              bitterness: { type: 'number', enum: [0, 25, 50, 75, 100] },
              body: { type: 'number', enum: [0, 25, 50, 75, 100] },
              fruity: { type: 'number', enum: [0, 25, 50, 75, 100] },
              roast: { type: 'number', enum: [0, 25, 50, 75, 100] },
            },
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
        + 'Explain briefly why the notes were chosen. '
        + 'Also return tasteVector numeric profile (0, 25, 50, 75, 100 only) for acidity, sweetness, bitterness, '
        + 'body, fruity, and roast. If unclear, set 50 and lower confidence. '
        + 'Output must match the JSON schema exactly.',
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
          'tasteVector',
          'toleranceVector',
          'openness',
          'confidence',
        ],
        properties: {
          profileSummary: { type: 'string' },
          recommendedStyle: { type: 'string' },
          recommendedOrigins: { type: 'string' },
          brewingTips: { type: 'string' },
          tasteVector: {
            type: 'object',
            additionalProperties: false,
            required: ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'],
            properties: {
              acidity: { type: 'number', enum: [0, 25, 50, 75, 100] },
              sweetness: { type: 'number', enum: [0, 25, 50, 75, 100] },
              bitterness: { type: 'number', enum: [0, 25, 50, 75, 100] },
              body: { type: 'number', enum: [0, 25, 50, 75, 100] },
              fruity: { type: 'number', enum: [0, 25, 50, 75, 100] },
              roast: { type: 'number', enum: [0, 25, 50, 75, 100] },
            },
          },
          toleranceVector: {
            type: 'object',
            additionalProperties: false,
            required: ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'],
            properties: {
              acidity: { type: 'string', enum: ['dislike', 'neutral', 'tolerant'] },
              sweetness: { type: 'string', enum: ['dislike', 'neutral', 'tolerant'] },
              bitterness: { type: 'string', enum: ['dislike', 'neutral', 'tolerant'] },
              body: { type: 'string', enum: ['dislike', 'neutral', 'tolerant'] },
              fruity: { type: 'string', enum: ['dislike', 'neutral', 'tolerant'] },
              roast: { type: 'string', enum: ['dislike', 'neutral', 'tolerant'] },
            },
          },
          openness: { type: 'string', enum: ['conservative', 'moderate', 'adventurous'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
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
        + 'Zahrň tasteVector (0, 25, 50, 75, 100) pre acidity, sweetness, bitterness, body, fruity, roast. '
        + 'Zahrň toleranceVector — pre každú os urči či zákazník danú vlastnosť "dislike" (aktívne odmietá), '
        + '"neutral" (je mu to jedno, nemusí tam byť ale nevadí) alebo "tolerant" (toleruje aj keď to priamo nehľadá). '
        + 'DÔLEŽITÉ: "Nechcem" v dotazníku môže znamenať "aktívne odmietam" ale aj "nie je to moja priorita". '
        + 'Pozri sa na kontext celého dotazníka — ak zákazník odpovedal napr. že mu nič nevadí alebo chce výraznú chuť, '
        + 'tak pravdepodobne toleruje aj to čo explicitne nehľadá. '
        + 'Zahrň openness — odhadni z odpovedí mieru ochoty experimentovať: '
        + '"conservative" (chce presne to čo pozná), "moderate" (otvorený ale opatrný), "adventurous" (rád skúša nové). '
        + 'Ak niečo nie je jasné, daj 50 a zníž confidence. '
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
  temperature: 0.3,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'coffee_match',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'matchScore',
          'matchTier',
          'confidence',
          'baristaSummary',
          'laymanSummary',
          'keyMatches',
          'keyConflicts',
          'suggestedAdjustments',
          'adventureNote',
        ],
        properties: {
          matchScore: { type: 'number', minimum: 0, maximum: 100 },
          matchTier: {
            type: 'string',
            enum: [
              'perfect_match',
              'great_choice',
              'worth_trying',
              'interesting_experiment',
              'not_for_you',
            ],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          baristaSummary: { type: 'string' },
          laymanSummary: { type: 'string' },
          keyMatches: { type: 'array', items: { type: 'string' } },
          keyConflicts: { type: 'array', items: { type: 'string' } },
          suggestedAdjustments: { type: 'string' },
          adventureNote: { type: 'string' },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'Si priateľský coffee sensory analytik. Porovnaj profil chutí z dotazníka s profilom kávy z etikety. '
        + 'DÔLEŽITÉ: Nebuď príliš striktný. Svet chutí je spektrum, nie binárne áno/nie. '
        + 'Väčšina kvalitných specialty káv dokáže potešiť aj ľudí mimo ich "komfortnú zónu". '
        + 'Rozlišuj medzi DEALBREAKER-mi (človek aktívne odmietá niečo a káva to má veľmi výrazne) a MENŠÍMI ODCHÝLKAMI (káva je trochu iná než profil, ale stále pitná a zaujímavá). '
        + 'Zohľadni pole "tolerance" z dotazníka — ak je tam hodnota "tolerujem" alebo "je mi to jedno", nepenalizuj odchýlky v danej vlastnosti. '
        + 'Zohľadni aj "openness" (ochotu experimentovať) — ak je zákazník otvorený novým chutiam, buď zhovievavejší. '
        + '\n\nmatchScore (0-100): 85-100 = perfektná zhoda, 70-84 = veľmi dobrá voľba, 50-69 = zaujímavý experiment (stojí za to skúsiť), 30-49 = mimo komfortnú zónu (ale môže prekvapiť), 0-29 = skutočný konflikt v kľúčových preferenciách. '
        + 'matchTier: perfect_match (85+), great_choice (70-84), worth_trying (50-69), interesting_experiment (30-49), not_for_you (0-29). '
        + 'adventureNote: Vždy napíš čo zaujímavé môže káva ponúknuť aj keď nie je presná zhoda. '
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

const buildPhotoCoffeeAnalysisPayload = (text) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.3,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'photo_coffee_analysis',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'tasteProfile',
          'flavorNotes',
          'recommendedPreparations',
          'confidence',
          'summary',
        ],
        properties: {
          tasteProfile: { type: 'string' },
          flavorNotes: {
            type: 'array',
            items: { type: 'string' },
          },
          recommendedPreparations: {
            type: 'array',
            minItems: 3,
            maxItems: 5,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['method', 'description'],
              properties: {
                method: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          summary: { type: 'string' },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'Si profesionálny barista a senzorický analytik. Na základe textu z etikety kávy odhadni chuťový profil '
        + 'a navrhni 3-4 najvhodnejšie spôsoby prípravy. Odpovedaj po slovensky, stručne, bez marketingových fráz. '
        + 'Výstup musí presne sedieť na JSON schému.',
    },
    {
      role: 'user',
      content: `Vyhodnoť chuť kávy z etikety a navrhni prípravy:\n\n${text}`,
    },
  ],
});

const buildPhotoCoffeeRecipePayload = (
  analysis,
  strengthPreference,
  selectedPreparation,
  brewPreferences = null,
  grinderProfile = null,
  customPreparationText = null,
) => {
  const grinderGuidance = buildGrinderGuidance(grinderProfile, selectedPreparation);
  return {
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.35,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'photo_coffee_recipe',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'method',
          'strengthPreference',
          'dose',
          'water',
          'grind',
          'waterTemp',
          'totalTime',
          'steps',
          'baristaTips',
          'whyThisRecipe',
        ],
        properties: {
          title: { type: 'string' },
          method: { type: 'string' },
          strengthPreference: { type: 'string' },
          dose: { type: 'string' },
          water: { type: 'string' },
          grind: { type: 'string' },
          waterTemp: { type: 'string' },
          totalTime: { type: 'string' },
          steps: {
            type: 'array',
            minItems: 4,
            items: { type: 'string' },
          },
          baristaTips: {
            type: 'array',
            minItems: 2,
            items: { type: 'string' },
          },
          whyThisRecipe: { type: 'string' },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'Si profesionálny barista. Vytvor krok za krokom recept pre vybraný spôsob prípravy. '
        + 'Recept má byť konkrétny (gramy, teplota, čas) a prispôsobený chuťovému profilu a sile kávy. '
        + 'Nikdy negeneruj náhodné dávky vody/kávy: rešpektuj používateľský vstup a dopočítaj chýbajúce hodnoty konzistentne. '
        + 'Odporúčanie mletia musí rešpektovať model mlynčeka používateľa, ak bol zadaný. '
        + 'Odpovedaj po slovensky a drž sa JSON schémy.',
    },
    {
      role: 'user',
      content: `Chuťový profil:\n${JSON.stringify(
        analysis,
        null,
        2,
      )}\n\nVybraný spôsob prípravy: ${selectedPreparation}\nVlastná príprava od používateľa: ${customPreparationText || 'nie'}\nPožadovaná sila: ${strengthPreference}\nProfil mlynčeka používateľa: ${JSON.stringify(
        grinderProfile || {},
      )}\nKalibrácia mlynčeka podľa známych modelov: ${JSON.stringify(
        grinderGuidance || {},
      )}\nPreferencie používateľa pre výpočet dávky/vody/pomeru: ${JSON.stringify(
        brewPreferences || {},
      )}\n\nAk používateľ zadal len vodu alebo len gramáž, dopočítaj druhú hodnotu podľa pomeru.
Ak používateľ nezadal pomer, použi predvolený pomer 1:15.5.
Ak používateľ zadal pomer, použi ho na prepočet chýbajúcej dávky alebo vody.
Ak používateľ zadal profil mlynčeka alebo model, odporuč mletie podľa kalibrácie modelu a škály používateľa; nepíš extrémne čísla mimo rozsahu danej metódy.
Pole whyThisRecipe napíš v 1-2 vetách veľmi zrozumiteľne.\nVytvor detailný recept.`,
    },
  ],
};
};


const buildLikePrediction = ({ analysis, selectedPreparation, strengthPreference }) => {
  const baseFromAnalysis = Math.round(Math.min(1, Math.max(0, Number(analysis?.confidence) || 0.5)) * 100);
  const preferredMethods = Array.isArray(analysis?.recommendedPreparations)
    ? analysis.recommendedPreparations.map((item) => String(item?.method || '').toLowerCase())
    : [];
  const selected = String(selectedPreparation || '').toLowerCase();
  const inTopRecommendations = preferredMethods.slice(0, 2).includes(selected);
  const strengthBonus = ['jemné chute', 'slabšie', 'výraznejšie'].includes(String(strengthPreference)) ? 4 : 0;
  const methodBonus = inTopRecommendations ? 8 : 0;
  const score = Math.max(0, Math.min(99, baseFromAnalysis + methodBonus + strengthBonus));

  return {
    score,
    verdict: score >= 70
      ? 'Tento recept má vysokú šancu, že ti bude chutiť.'
      : 'Tento recept ešte nemusí sadnúť tvojmu profilu.',
    reason: inTopRecommendations
      ? 'Vybraná metóda patrí medzi najlepšie odporúčania pre túto kávu.'
      : 'Vybraná metóda nie je medzi top odporúčaniami, skús prvé návrhy od AI.',
  };
};

const runOcr = async ({ imageBase64, languageHints }) => {
  if (!imageBase64) {
    const error = new Error('imageBase64 is required.');
    error.status = 400;
    throw error;
  }

  const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!visionApiKey) {
    const error = new Error('Google Vision API key is not configured.');
    error.status = 500;
    throw error;
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    const error = new Error('OpenAI API key is not configured.');
    error.status = 500;
    throw error;
  }

  const cleanedBase64 = stripDataUrlPrefix(imageBase64);
  const visionPayload = buildVisionPayload(
    cleanedBase64,
    Array.isArray(languageHints) ? languageHints : [],
  );

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
    const error = new Error('Google Vision API request failed.');
    error.status = 502;
    error.details = visionData;
    throw error;
  }

  if (visionData?.responses?.[0]?.error) {
    const error = new Error('Google Vision API returned an error.');
    error.status = 502;
    error.details = visionData.responses[0].error;
    throw error;
  }

  const rawText = extractVisionText(visionData).trim();
  if (!rawText) {
    const error = new Error('No text detected in the image.');
    error.status = 422;
    throw error;
  }

  console.log('[OCR] Vision OCR text extracted', {
    rawTextLength: rawText.length,
  });

  console.log('[OCR] OpenAI correction request started', {
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
  console.log('[OCR] OpenAI correction response content', {
    content: openAiData?.choices?.[0]?.message?.content ?? null,
  });

  if (!openAiResponse.ok) {
    const error = new Error('OpenAI API request failed.');
    error.status = 502;
    error.details = openAiData;
    throw error;
  }

  const correctedText = openAiData?.choices?.[0]?.message?.content?.trim();
  if (!correctedText) {
    const error = new Error('OpenAI did not return corrected text.');
    error.status = 502;
    throw error;
  }

  console.log('[OCR] OpenAI corrected text ready', {
    correctedTextLength: correctedText.length,
  });

  return { rawText, correctedText };
};

router.post('/api/ocr-correct', async (req, res, next) => {
  try {
    const { imageBase64, languageHints } = req.body || {};

    console.log('[OCR] request received', {
      imageBase64Length: imageBase64?.length ?? 0,
      languageHints,
    });

    const { rawText, correctedText } = await runOcr({
      imageBase64,
      languageHints,
    });

    return res.status(200).json({ rawText, correctedText });
  } catch (error) {
    if (error.status) {
      console.error('[OCR] Request failed', error);
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }
    console.error('[OCR] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-photo-analysis', async (req, res, next) => {
  try {
    const { imageBase64, languageHints } = req.body || {};
    console.log('[PhotoAnalysis] request received', {
      imageBase64Length: imageBase64?.length ?? 0,
      languageHints,
    });

    const { rawText, correctedText } = await runOcr({
      imageBase64,
      languageHints,
    });

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[PhotoAnalysis] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    console.log('[PhotoAnalysis] OpenAI request started', {
      correctedTextLength: correctedText.length,
    });
    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPhotoCoffeeAnalysisPayload(correctedText)),
    });

    const openAiData = await openAiResponse.json();
    console.log('[PhotoAnalysis] OpenAI response received', {
      status: openAiResponse.status,
      durationMs: Date.now() - openAiRequestStart,
    });
    console.log('[PhotoAnalysis] OpenAI response content', {
      content: openAiData?.choices?.[0]?.message?.content ?? null,
    });

    if (!openAiResponse.ok) {
      console.error('[PhotoAnalysis] OpenAI request failed', {
        status: openAiResponse.status,
        details: openAiData,
      });
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const analysisContent = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!analysisContent) {
      console.error('[PhotoAnalysis] OpenAI response missing content', {
        openAiData,
      });
      return res.status(502).json({ error: 'OpenAI did not return photo analysis.' });
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error('[PhotoAnalysis] Failed to parse response JSON', {
        analysisContent,
        parseError,
      });
      return res.status(502).json({
        error: 'Failed to parse photo analysis response.',
        rawAnalysis: analysisContent,
      });
    }

    return res.status(200).json({
      rawText,
      correctedText,
      analysis,
    });
  } catch (error) {
    if (error.status) {
      console.error('[PhotoAnalysis] Request failed', error);
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }
    console.error('[PhotoAnalysis] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-photo-recipe', async (req, res, next) => {
  try {
    const {
      analysis,
      strengthPreference,
      selectedPreparation,
      customPreparationText,
      grinderProfile,
      brewPreferences,
    } = req.body || {};
    const effectivePreparation = typeof selectedPreparation === 'string' && selectedPreparation.trim()
      ? selectedPreparation.trim()
      : typeof customPreparationText === 'string' && customPreparationText.trim()
        ? customPreparationText.trim()
        : '';
    const sanitizedBrewPreferences = {
      targetDoseG: toNumberOrNull(brewPreferences?.targetDoseG),
      targetWaterMl: toNumberOrNull(brewPreferences?.targetWaterMl),
      targetRatio: toNumberOrNull(brewPreferences?.targetRatio),
      providedByUser: {
        targetDoseG: Boolean(brewPreferences?.providedByUser?.targetDoseG),
        targetWaterMl: Boolean(brewPreferences?.providedByUser?.targetWaterMl),
        targetRatio: Boolean(brewPreferences?.providedByUser?.targetRatio),
      },
    };

    if (!analysis || !strengthPreference || !effectivePreparation) {
      return res.status(400).json({
        error: 'analysis, strengthPreference, and selectedPreparation/customPreparationText are required.',
      });
    }
    if (!sanitizedBrewPreferences.targetDoseG && !sanitizedBrewPreferences.targetWaterMl) {
      return res.status(400).json({
        error: 'At least one of targetDoseG or targetWaterMl is required.',
      });
    }

    const ratioForCalculation = sanitizedBrewPreferences.targetRatio || DEFAULT_BREW_RATIO;
    if (!sanitizedBrewPreferences.targetDoseG && sanitizedBrewPreferences.targetWaterMl) {
      sanitizedBrewPreferences.targetDoseG = toNumberOrNull(
        sanitizedBrewPreferences.targetWaterMl / ratioForCalculation,
      );
    }
    if (!sanitizedBrewPreferences.targetWaterMl && sanitizedBrewPreferences.targetDoseG) {
      sanitizedBrewPreferences.targetWaterMl = toNumberOrNull(
        sanitizedBrewPreferences.targetDoseG * ratioForCalculation,
      );
    }
    if (!sanitizedBrewPreferences.targetRatio && sanitizedBrewPreferences.targetDoseG && sanitizedBrewPreferences.targetWaterMl) {
      sanitizedBrewPreferences.targetRatio = toNumberOrNull(
        sanitizedBrewPreferences.targetWaterMl / sanitizedBrewPreferences.targetDoseG,
      );
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[PhotoRecipe] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    console.log('[PhotoRecipe] OpenAI request started', {
      selectedPreparation: effectivePreparation,
      strengthPreference,
      brewPreferences: sanitizedBrewPreferences,
      grinderProfile: grinderProfile || null,
    });
    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildPhotoCoffeeRecipePayload(
          analysis,
          strengthPreference,
          effectivePreparation,
          sanitizedBrewPreferences,
          grinderProfile,
          customPreparationText || null,
        ),
      ),
    });

    const openAiData = await openAiResponse.json();
    console.log('[PhotoRecipe] OpenAI response received', {
      status: openAiResponse.status,
      durationMs: Date.now() - openAiRequestStart,
    });
    console.log('[PhotoRecipe] OpenAI response content', {
      content: openAiData?.choices?.[0]?.message?.content ?? null,
    });

    if (!openAiResponse.ok) {
      console.error('[PhotoRecipe] OpenAI request failed', {
        status: openAiResponse.status,
        details: openAiData,
      });
      return res.status(502).json({
        error: 'OpenAI API request failed.',
        details: openAiData,
      });
    }

    const recipeContent = openAiData?.choices?.[0]?.message?.content?.trim();
    if (!recipeContent) {
      console.error('[PhotoRecipe] OpenAI response missing content', {
        openAiData,
      });
      return res.status(502).json({ error: 'OpenAI did not return a recipe.' });
    }

    let recipe;
    try {
      recipe = JSON.parse(recipeContent);
    } catch (parseError) {
      console.error('[PhotoRecipe] Failed to parse response JSON', {
        recipeContent,
        parseError,
      });
      return res.status(502).json({
        error: 'Failed to parse photo recipe response.',
        rawRecipe: recipeContent,
      });
    }

    const likePrediction = buildLikePrediction({
      analysis,
      selectedPreparation: effectivePreparation,
      strengthPreference,
    });

    return res.status(200).json({ recipe, likePrediction });
  } catch (error) {
    console.error('[PhotoRecipe] Unexpected error', error);
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

    console.log('[CoffeeProfile] OpenAI request started', {
      textLength: sourceText.length,
    });
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
    console.log('[CoffeeProfile] OpenAI response content', {
      content: openAiData?.choices?.[0]?.message?.content ?? null,
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

    console.log('[CoffeeQuestionnaire] OpenAI request started', {
      answersCount: answers.length,
    });
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
    console.log('[CoffeeQuestionnaire] OpenAI response content', {
      content: openAiData?.choices?.[0]?.message?.content ?? null,
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

    console.log('[CoffeeMatch] OpenAI request started', {
      questionnaireCount: Array.isArray(questionnaire) ? questionnaire.length : undefined,
    });
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
    console.log('[CoffeeMatch] OpenAI response content', {
      content: openAiData?.choices?.[0]?.message?.content ?? null,
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
