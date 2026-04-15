import express from 'express';

import { db } from './db.js';
import { requireSession } from './session.js';

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

const DEFAULT_ESPRESSO_RATIO = 2;

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
          'roastLevel',
          'recommendedBrewPath',
          'recommendedPreparations',
          'confidence',
          'summary',
          'tasteVector',
        ],
        properties: {
          tasteProfile: { type: 'string' },
          flavorNotes: {
            type: 'array',
            items: { type: 'string' },
          },
          roastLevel: {
            type: 'string',
            enum: ['light', 'medium', 'medium-dark', 'dark'],
          },
          recommendedBrewPath: {
            type: 'string',
            enum: ['espresso', 'filter', 'both'],
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
        'Si profesionálny barista a senzorický analytik. Na základe textu z etikety kávy odhadni chuťový profil '
        + 'a navrhni 3-4 najvhodnejšie spôsoby prípravy. '
        + 'Odhadni úroveň praženia (roastLevel) z informácií na etikete — ak nie je explicitne uvedená, odhadni ju z chuťových tónov, pôvodu a spracovania. '
        + 'Odporúč cestu prípravy (recommendedBrewPath): "espresso" ak je káva tmavšie pražená alebo vhodná na espresso, '
        + '"filter" ak je svetlejšie pražená alebo single-origin vhodná na filter, "both" ak je univerzálna. '
        + 'Zahrň tasteVector — číselný profil (0, 25, 50, 75, 100) pre acidity, sweetness, bitterness, body, fruity, roast. '
        + 'Ak informácia nie je jasná, nastav 50 a zníž confidence. '
        + 'Odpovedaj po slovensky, stručne, bez marketingových fráz. '
        + 'Výstup musí presne sedieť na JSON schému.',
    },
    {
      role: 'user',
      content: `Vyhodnoť chuť kávy z etikety a navrhni prípravy:\n\n${text}`,
    },
  ],
});

const buildFilterRecipePayload = (
  analysis,
  strengthPreference,
  selectedPreparation,
  brewPreferences = null,
  grinderProfile = null,
  customPreparationText = null,
) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.35,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'filter_coffee_recipe',
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
        'Si profesionálny barista špecializovaný na filter kávu. Vytvor krok za krokom recept pre vybraný spôsob prípravy. '
        + 'Recept má byť konkrétny (gramy, teplota, čas) a prispôsobený chuťovému profilu a sile kávy. '
        + 'Nikdy negeneruj náhodné dávky vody/kávy: rešpektuj používateľský vstup a dopočítaj chýbajúce hodnoty konzistentne. '
        + 'Ak používateľ zadal model mlynčeka, rozpoznaj ho (Comandante, 1Zpresso, Timemore, Baratza, Eureka, Niche, Wilfa, Hario, Fellow, Lagom atď.) '
        + 'a odporúč konkrétne nastavenie mletia pre danú metódu prípravy. '
        + 'Ak model nepoznáš, použi typ mlynčeka (ručný/elektrický) a škálu používateľa na relatívne odporúčanie (jemné/stredné/hrubé). '
        + 'Ak používateľ nemá mlynček, odporúč hrubosť mletia slovne a navrhni kúpu predmletej kávy v správnej hrubosti. '
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
      )}\nPreferencie používateľa pre výpočet dávky/vody/pomeru: ${JSON.stringify(
        brewPreferences || {},
      )}\n\nAk používateľ zadal len vodu alebo len gramáž, dopočítaj druhú hodnotu podľa pomeru.
Ak používateľ nezadal pomer, použi predvolený pomer 1:15.5.
Ak používateľ zadal pomer, použi ho na prepočet chýbajúcej dávky alebo vody.
Pole whyThisRecipe napíš v 1-2 vetách veľmi zrozumiteľne.\nVytvor detailný recept.`,
    },
  ],
});

const buildEspressoRecipePayload = (
  analysis,
  drinkType,
  machineType,
  brewPreferences = null,
  grinderProfile = null,
) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.35,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'espresso_coffee_recipe',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'drinkType',
          'machineType',
          'dose',
          'yield',
          'ratio',
          'grind',
          'waterTemp',
          'extractionTime',
          'pressure',
          'steps',
          'baristaTips',
          'milkInstructions',
          'whyThisRecipe',
        ],
        properties: {
          title: { type: 'string' },
          drinkType: { type: 'string' },
          machineType: { type: 'string' },
          dose: { type: 'string' },
          yield: { type: 'string' },
          ratio: { type: 'string' },
          grind: { type: 'string' },
          waterTemp: { type: 'string' },
          extractionTime: { type: 'string' },
          pressure: { type: 'string' },
          steps: {
            type: 'array',
            minItems: 3,
            items: { type: 'string' },
          },
          baristaTips: {
            type: 'array',
            minItems: 2,
            items: { type: 'string' },
          },
          milkInstructions: { type: 'string' },
          whyThisRecipe: { type: 'string' },
        },
      },
    },
  },
  messages: [
    {
      role: 'system',
      content:
        'Si profesionálny barista špecializovaný na espresso. Vytvor detailný recept pre espresso nápoj. '
        + 'Recept má byť konkrétny (gramy, teplota, čas extrakcie, tlak) a prispôsobený chuťovému profilu kávy. '
        + 'Pre typ nápoja prispôsob pomer: espresso 1:2, ristretto 1:1.5, lungo 1:3, doppio 1:2 s dvojitou dávkou. '
        + 'Pre mliečne nápoje (latte, cappuccino, flat white, cortado, macchiato) zahrň detailné inštrukcie '
        + 'k príprave mlieka v poli milkInstructions — teplota, technika napenenia, pomer mlieka k espressu. '
        + 'Ak nejde o mliečny nápoj, vráť v milkInstructions prázdny reťazec. '
        + 'Ak používateľ zadal model mlynčeka, rozpoznaj ho a odporúč konkrétne nastavenie mletia pre espresso. '
        + 'Ak model nepoznáš, použi typ mlynčeka a škálu na relatívne odporúčanie (veľmi jemné mletie, takmer prášok). '
        + 'Pre pákový stroj odporúč 9 bar tlak a prispôsob teplotu (90-94°C). '
        + 'Pre automatický kávovar nastav pressure na "automatický" a zameraj sa na mletie a dávku. '
        + 'Odpovedaj po slovensky a drž sa JSON schémy.',
    },
    {
      role: 'user',
      content: `Chuťový profil kávy:\n${JSON.stringify(
        analysis,
        null,
        2,
      )}\n\nTyp nápoja: ${drinkType}\nTyp stroja: ${machineType}\nProfil mlynčeka: ${JSON.stringify(
        grinderProfile || {},
      )}\nPreferencie dávkovania: ${JSON.stringify(
        brewPreferences || {},
      )}\n\nAk používateľ zadal len dávku alebo len výťažok, dopočítaj druhú hodnotu podľa pomeru.
Ak používateľ nezadal pomer, použi predvolený pomer pre daný typ nápoja.
Pole whyThisRecipe napíš v 1-2 vetách veľmi zrozumiteľne.\nVytvor detailný espresso recept.`,
    },
  ],
});


const TASTE_AXES = ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'];
const TOLERANCE_WEIGHTS = { tolerant: 0.4, neutral: 0.7, dislike: 1.0 };
const MATCH_TIER_THRESHOLDS = { perfect: 85, great: 70, worthTrying: 50, experiment: 30 };

const clampAxis = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
};

const matchScoreToTier = (score) => {
  if (score >= MATCH_TIER_THRESHOLDS.perfect) { return 'perfect_match'; }
  if (score >= MATCH_TIER_THRESHOLDS.great) { return 'great_choice'; }
  if (score >= MATCH_TIER_THRESHOLDS.worthTrying) { return 'worth_trying'; }
  if (score >= MATCH_TIER_THRESHOLDS.experiment) { return 'interesting_experiment'; }
  return 'not_for_you';
};

const TIER_VERDICTS = {
  perfect_match: 'Tento recept je presne tvoj štýl!',
  great_choice: 'Veľmi dobrá voľba pre tvoj profil.',
  worth_trying: 'Stojí za vyskúšanie — môže ťa príjemne prekvapiť.',
  interesting_experiment: 'Zaujímavý experiment mimo tvoju komfortnú zónu.',
  not_for_you: 'Táto kombinácia asi nie je pre teba.',
};

const AXIS_LABELS = {
  acidity: 'kyslosť',
  sweetness: 'sladkosť',
  bitterness: 'horkosť',
  body: 'telo',
  fruity: 'ovocnosť',
  roast: 'praženie',
};

const buildVectorMatchReason = (coffeeVector, userVector, tolerance) => {
  const matches = [];
  const conflicts = [];

  for (const axis of TASTE_AXES) {
    const diff = Math.abs(clampAxis(userVector[axis]) - clampAxis(coffeeVector[axis]));
    const label = AXIS_LABELS[axis];
    if (diff <= 15) {
      matches.push(label);
    } else if (diff >= 40 && (tolerance[axis] === 'dislike' || tolerance[axis] === 'neutral')) {
      conflicts.push(label);
    }
  }

  const parts = [];
  if (matches.length > 0) {
    parts.push(`Zhoda v: ${matches.slice(0, 3).join(', ')}.`);
  }
  if (conflicts.length > 0) {
    parts.push(`Väčší rozdiel v: ${conflicts.slice(0, 2).join(', ')}.`);
  }

  return parts.join(' ') || 'Predikcia je založená na porovnaní tvojho chuťového profilu s touto kávou.';
};

const computeMatchPrediction = ({ analysis, selectedPreparation, strengthPreference, brewPath, userQuestionnaire }) => {
  const hasQuestionnaire = Boolean(userQuestionnaire?.tasteVector);
  const coffeeVector = analysis?.tasteVector;

  if (hasQuestionnaire && coffeeVector) {
    const userVector = userQuestionnaire.tasteVector;
    const tolerance = userQuestionnaire.toleranceVector || {};

    let totalWeight = 0;
    let weightedDistance = 0;
    for (const axis of TASTE_AXES) {
      const toleranceLevel = tolerance[axis] || 'neutral';
      const weight = TOLERANCE_WEIGHTS[toleranceLevel] || TOLERANCE_WEIGHTS.neutral;
      totalWeight += weight;
      weightedDistance += Math.abs(clampAxis(userVector[axis]) - clampAxis(coffeeVector[axis])) * weight;
    }

    const normalizedDistance = totalWeight > 0 ? weightedDistance / totalWeight : 0;
    let vectorScore = Math.round(100 - normalizedDistance);

    // Small bonus for brew path alignment
    const recommendedPath = String(analysis?.recommendedBrewPath || 'both').toLowerCase();
    if (brewPath === 'espresso' && (recommendedPath === 'espresso' || recommendedPath === 'both')) {
      vectorScore += 3;
    } else if (brewPath === 'filter') {
      const preferredMethods = Array.isArray(analysis?.recommendedPreparations)
        ? analysis.recommendedPreparations.map((item) => String(item?.method || '').toLowerCase())
        : [];
      const selected = String(selectedPreparation || '').toLowerCase();
      if (preferredMethods.slice(0, 2).includes(selected)) {
        vectorScore += 3;
      }
    }

    const score = Math.max(0, Math.min(99, vectorScore));
    const tier = matchScoreToTier(score);

    return {
      score,
      matchTier: tier,
      verdict: TIER_VERDICTS[tier],
      reason: buildVectorMatchReason(coffeeVector, userVector, tolerance),
      hasQuestionnaire: true,
    };
  }

  // Fallback heuristic when no questionnaire data is available
  const baseFromAnalysis = Math.round(Math.min(1, Math.max(0, Number(analysis?.confidence) || 0.5)) * 100);
  const recommendedPath = String(analysis?.recommendedBrewPath || 'both').toLowerCase();

  let pathBonus = 0;
  if (brewPath === 'espresso' && (recommendedPath === 'espresso' || recommendedPath === 'both')) {
    pathBonus = 8;
  } else if (brewPath === 'filter') {
    const preferredMethods = Array.isArray(analysis?.recommendedPreparations)
      ? analysis.recommendedPreparations.map((item) => String(item?.method || '').toLowerCase())
      : [];
    const selected = String(selectedPreparation || '').toLowerCase();
    pathBonus = preferredMethods.slice(0, 2).includes(selected) ? 8 : 0;
  }

  const strengthBonus = strengthPreference === 'vyvážene' ? 4 : 0;
  const score = Math.max(0, Math.min(99, baseFromAnalysis + pathBonus + strengthBonus));
  const tier = matchScoreToTier(score);

  return {
    score,
    matchTier: tier,
    verdict: TIER_VERDICTS[tier],
    reason: brewPath === 'espresso'
      ? (pathBonus > 0
        ? 'Táto káva je vhodná na espresso prípravu.'
        : 'Táto káva je primárne odporúčaná na filter, espresso môže byť experiment.')
      : (pathBonus > 0
        ? 'Vybraná metóda patrí medzi najlepšie odporúčania pre túto kávu.'
        : 'Vybraná metóda nie je medzi top odporúčaniami, skús prvé návrhy od AI.'),
    hasQuestionnaire: false,
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
      brewPath,
      // Filter-specific
      strengthPreference,
      selectedPreparation,
      customPreparationText,
      // Espresso-specific
      drinkType,
      machineType,
      // Shared
      grinderProfile,
      brewPreferences,
    } = req.body || {};

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({ error: 'analysis is required.' });
    }

    if (brewPath !== 'espresso' && brewPath !== 'filter') {
      return res.status(400).json({ error: 'brewPath must be "espresso" or "filter".' });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[PhotoRecipe] OpenAI API key missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured.' });
    }

    let aiPayload;
    let effectivePreparation = '';

    if (brewPath === 'espresso') {
      // --- ESPRESSO PATH ---
      if (!drinkType || typeof drinkType !== 'string') {
        return res.status(400).json({ error: 'drinkType is required for espresso path.' });
      }
      if (!machineType || typeof machineType !== 'string') {
        return res.status(400).json({ error: 'machineType is required for espresso path.' });
      }

      const sanitizedBrewPreferences = {
        targetDoseG: toNumberOrNull(brewPreferences?.targetDoseG),
        targetYieldG: toNumberOrNull(brewPreferences?.targetYieldG),
        targetRatio: toNumberOrNull(brewPreferences?.targetRatio),
      };

      if (!sanitizedBrewPreferences.targetDoseG && !sanitizedBrewPreferences.targetYieldG) {
        return res.status(400).json({ error: 'At least one of targetDoseG or targetYieldG is required.' });
      }

      const ratioForCalculation = sanitizedBrewPreferences.targetRatio || DEFAULT_ESPRESSO_RATIO;
      if (!sanitizedBrewPreferences.targetDoseG && sanitizedBrewPreferences.targetYieldG) {
        sanitizedBrewPreferences.targetDoseG = toNumberOrNull(
          sanitizedBrewPreferences.targetYieldG / ratioForCalculation,
        );
      }
      if (!sanitizedBrewPreferences.targetYieldG && sanitizedBrewPreferences.targetDoseG) {
        sanitizedBrewPreferences.targetYieldG = toNumberOrNull(
          sanitizedBrewPreferences.targetDoseG * ratioForCalculation,
        );
      }
      if (!sanitizedBrewPreferences.targetRatio && sanitizedBrewPreferences.targetDoseG && sanitizedBrewPreferences.targetYieldG) {
        sanitizedBrewPreferences.targetRatio = toNumberOrNull(
          sanitizedBrewPreferences.targetYieldG / sanitizedBrewPreferences.targetDoseG,
        );
      }

      effectivePreparation = drinkType;

      console.log('[PhotoRecipe] Espresso request started', {
        drinkType,
        machineType,
        brewPreferences: sanitizedBrewPreferences,
        grinderProfile: grinderProfile || null,
      });

      aiPayload = buildEspressoRecipePayload(
        analysis,
        drinkType,
        machineType,
        sanitizedBrewPreferences,
        grinderProfile || null,
      );
    } else {
      // --- FILTER PATH ---
      effectivePreparation = typeof selectedPreparation === 'string' && selectedPreparation.trim()
        ? selectedPreparation.trim()
        : typeof customPreparationText === 'string' && customPreparationText.trim()
          ? customPreparationText.trim()
          : '';

      if (!strengthPreference || !effectivePreparation) {
        return res.status(400).json({
          error: 'strengthPreference and selectedPreparation/customPreparationText are required for filter path.',
        });
      }

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

      if (!sanitizedBrewPreferences.targetDoseG && !sanitizedBrewPreferences.targetWaterMl) {
        return res.status(400).json({ error: 'At least one of targetDoseG or targetWaterMl is required.' });
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

      console.log('[PhotoRecipe] Filter request started', {
        selectedPreparation: effectivePreparation,
        strengthPreference,
        brewPreferences: sanitizedBrewPreferences,
        grinderProfile: grinderProfile || null,
      });

      aiPayload = buildFilterRecipePayload(
        analysis,
        strengthPreference,
        effectivePreparation,
        sanitizedBrewPreferences,
        grinderProfile || null,
        customPreparationText || null,
      );
    }

    const openAiRequestStart = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiPayload),
    });

    const openAiData = await openAiResponse.json();
    console.log('[PhotoRecipe] OpenAI response received', {
      brewPath,
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

    // Optionally load user's questionnaire for personalized match prediction
    let userQuestionnaire = null;
    try {
      const session = await requireSession(req);
      const qResult = await db.query(
        `SELECT questionnaire_profile
         FROM user_questionnaires
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [session.uid],
      );
      if (qResult.rows.length > 0) {
        const raw = qResult.rows[0].questionnaire_profile;
        userQuestionnaire = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch {
      // No session or DB error — proceed without questionnaire data
    }

    const likePrediction = computeMatchPrediction({
      analysis,
      selectedPreparation: effectivePreparation,
      strengthPreference: strengthPreference || null,
      brewPath,
      userQuestionnaire,
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
