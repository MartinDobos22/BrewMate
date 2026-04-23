import express from 'express';

import { db, ensureAppUserExists } from './db.js';
import { requireSession } from './session.js';
import { AIError, callOpenAI, parseAIJson, validateAISchema, aiErrorToResponse } from './aiFetch.js';
import { aiRateLimit } from './rateLimit.js';
import * as aiCache from './aiCache.js';
import { sendError } from './errors.js';
import {
  DEFAULT_ESPRESSO_RATIO,
  DEFAULT_FILTER_RATIO,
  hasAnyEspressoInput,
  hasAnyFilterInput,
  normalizeEspressoBrew,
  normalizeFilterBrew,
} from './brewCalc.js';

const router = express.Router();

const stripDataUrlPrefix = (value) => value.replace(/^data:.*;base64,/, '');
const toNumberOrNull = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
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
  userQuestionnaire = null,
) => {
  const userContextBlock = userQuestionnaire
    ? `\n\nProfil používateľa (z dotazníka):\n`
      + `- Chuťový vektor: ${JSON.stringify(userQuestionnaire.tasteVector || {})}\n`
      + `- Tolerancie: ${JSON.stringify(userQuestionnaire.toleranceVector || {})}\n`
      + `- Otvorenosť: ${userQuestionnaire.openness || 'neznáme'}\n`
      + `- Zhrnutie preferencií: ${userQuestionnaire.profileSummary || 'nedostupné'}\n`
      + `Prispôsob recept chuťovým preferenciám používateľa. Ak má nízku toleranciu na niektorú os `
      + `(napr. "dislike" pri kyslosti), prispôsob teplotu vody, hrubosť mletia a postup tak, aby sa daná chuť potlačila. `
      + `V poli whyThisRecipe zohľadni aj používateľský profil.`
    : '';

  return {
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
          + (userQuestionnaire
            ? 'Ak je dostupný profil používateľa, prispôsob recept jeho chuťovým preferenciám a toleranciám. '
            : '')
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
        )}${userContextBlock}\n\nAk používateľ zadal len vodu alebo len gramáž, dopočítaj druhú hodnotu podľa pomeru.
Ak používateľ nezadal pomer, použi predvolený pomer 1:15.5.
Ak používateľ zadal pomer, použi ho na prepočet chýbajúcej dávky alebo vody.
Pole whyThisRecipe napíš v 1-2 vetách veľmi zrozumiteľne.\nVytvor detailný recept.`,
      },
    ],
  };
};

const buildEspressoRecipePayload = (
  analysis,
  drinkType,
  machineType,
  brewPreferences = null,
  grinderProfile = null,
  userQuestionnaire = null,
) => {
  const userContextBlock = userQuestionnaire
    ? `\n\nProfil používateľa (z dotazníka):\n`
      + `- Chuťový vektor: ${JSON.stringify(userQuestionnaire.tasteVector || {})}\n`
      + `- Tolerancie: ${JSON.stringify(userQuestionnaire.toleranceVector || {})}\n`
      + `- Otvorenosť: ${userQuestionnaire.openness || 'neznáme'}\n`
      + `- Zhrnutie preferencií: ${userQuestionnaire.profileSummary || 'nedostupné'}\n`
      + `- Preferencia mlieka: ${userQuestionnaire.milkPreference || 'neznáme'}\n`
      + `Prispôsob recept chuťovým preferenciám používateľa. Ak má nízku toleranciu na niektorú os `
      + `(napr. "dislike" pri horkosti), prispôsob pomer, teplotu a čas extrakcie. `
      + `V poli whyThisRecipe zohľadni aj používateľský profil.`
    : '';

  return {
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
          + (userQuestionnaire
            ? 'Ak je dostupný profil používateľa, prispôsob recept jeho chuťovým preferenciám a toleranciám. '
            : '')
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
        )}${userContextBlock}\n\nAk používateľ zadal len dávku alebo len výťažok, dopočítaj druhú hodnotu podľa pomeru.
Ak používateľ nezadal pomer, použi predvolený pomer pre daný typ nápoja.
Pole whyThisRecipe napíš v 1-2 vetách veľmi zrozumiteľne.\nVytvor detailný espresso recept.`,
      },
    ],
  };
};


const TASTE_AXES = ['acidity', 'sweetness', 'bitterness', 'body', 'fruity', 'roast'];
const TOLERANCE_WEIGHTS = { tolerant: 0.4, neutral: 0.7, dislike: 1.0 };
const MATCH_TIER_THRESHOLDS = { perfect: 85, great: 70, worthTrying: 50, experiment: 30 };
const MATCH_ALGORITHM_VERSION = 'vector-v1';
const MATCH_CACHE_VERSION = 'match-hybrid-v1';
const MATCH_LLM_FALLBACK_VERSION = 'llm-fallback-v1';
const CALIBRATION_RATING_MAP = { 1: 10, 2: 35, 3: 60, 3.5: 70, 4: 80, 5: 95 };
const CALIBRATION_MAX_OFFSET = 15;

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

// Compute a calibration offset from a user's past feedback rows.
// Positive offset means past predictions were higher than actual ratings
// (the algorithm is over-confident for this user) — we subtract it from new scores.
const computeCalibrationOffset = (feedbackRows) => {
  if (!Array.isArray(feedbackRows) || feedbackRows.length < 2) {
    return { offset: 0, sampleSize: feedbackRows?.length || 0 };
  }

  let totalDiff = 0;
  let count = 0;
  for (const row of feedbackRows) {
    const predicted = Number(row?.predicted_score);
    const actualMapped = CALIBRATION_RATING_MAP[Number(row?.actual_rating)];
    if (Number.isFinite(predicted) && Number.isFinite(actualMapped)) {
      totalDiff += predicted - actualMapped;
      count += 1;
    }
  }

  if (count === 0) {
    return { offset: 0, sampleSize: 0 };
  }

  const rawOffset = totalDiff / count;
  const clamped = Math.max(-CALIBRATION_MAX_OFFSET, Math.min(CALIBRATION_MAX_OFFSET, rawOffset));
  return { offset: Math.round(clamped), sampleSize: count };
};

const computeMatchPrediction = ({
  analysis,
  selectedPreparation,
  strengthPreference,
  brewPath,
  userQuestionnaire,
  calibration,
}) => {
  const hasQuestionnaire = Boolean(userQuestionnaire?.tasteVector);
  const coffeeVector = analysis?.tasteVector;
  const calibrationOffset = Number(calibration?.offset) || 0;
  const calibrationSample = Number(calibration?.sampleSize) || 0;

  if (hasQuestionnaire && coffeeVector) {
    const userVector = userQuestionnaire.tasteVector;
    const tolerance = userQuestionnaire.toleranceVector || {};

    let totalWeight = 0;
    let weightedDistance = 0;
    const axes = [];
    for (const axis of TASTE_AXES) {
      const toleranceLevel = tolerance[axis] || 'neutral';
      const weight = TOLERANCE_WEIGHTS[toleranceLevel] || TOLERANCE_WEIGHTS.neutral;
      const coffeeValue = clampAxis(coffeeVector[axis]);
      const userValue = clampAxis(userVector[axis]);
      const diff = Math.abs(userValue - coffeeValue);
      totalWeight += weight;
      weightedDistance += diff * weight;
      let status = 'neutral';
      if (diff <= 15) { status = 'match'; }
      else if (diff >= 40 && (toleranceLevel === 'dislike' || toleranceLevel === 'neutral')) {
        status = 'conflict';
      }
      axes.push({
        axis,
        label: AXIS_LABELS[axis],
        coffeeValue,
        userValue,
        diff: Math.round(diff),
        tolerance: toleranceLevel,
        weight,
        status,
      });
    }

    const normalizedDistance = totalWeight > 0 ? weightedDistance / totalWeight : 0;
    const baseScore = Math.round(100 - normalizedDistance);

    let pathBonus = 0;
    const recommendedPath = String(analysis?.recommendedBrewPath || 'both').toLowerCase();
    if (brewPath === 'espresso' && (recommendedPath === 'espresso' || recommendedPath === 'both')) {
      pathBonus = 3;
    } else if (brewPath === 'filter') {
      const preferredMethods = Array.isArray(analysis?.recommendedPreparations)
        ? analysis.recommendedPreparations.map((item) => String(item?.method || '').toLowerCase())
        : [];
      const selected = String(selectedPreparation || '').toLowerCase();
      if (preferredMethods.slice(0, 2).includes(selected)) {
        pathBonus = 3;
      }
    }

    const preCalibrationScore = baseScore + pathBonus;
    const score = Math.max(0, Math.min(99, preCalibrationScore - calibrationOffset));
    const tier = matchScoreToTier(score);

    return {
      score,
      matchTier: tier,
      verdict: TIER_VERDICTS[tier],
      reason: buildVectorMatchReason(coffeeVector, userVector, tolerance),
      hasQuestionnaire: true,
      algorithmVersion: MATCH_ALGORITHM_VERSION,
      breakdown: {
        mode: 'vector',
        baseScore,
        pathBonus,
        calibrationOffset,
        calibrationSampleSize: calibrationSample,
        confidence: Number(analysis?.confidence) || null,
        axes,
      },
    };
  }

  // Fallback heuristic when no questionnaire data is available
  const confidence = Math.min(1, Math.max(0, Number(analysis?.confidence) || 0.5));
  const baseScore = Math.round(confidence * 100);
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
  const preCalibrationScore = baseScore + pathBonus + strengthBonus;
  const score = Math.max(0, Math.min(99, preCalibrationScore - calibrationOffset));
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
    algorithmVersion: MATCH_ALGORITHM_VERSION,
    breakdown: {
      mode: 'heuristic',
      baseScore,
      pathBonus,
      strengthBonus,
      calibrationOffset,
      calibrationSampleSize: calibrationSample,
      confidence,
      axes: [],
    },
  };
};

// Deterministic match between a coffee profile and a user questionnaire.
// Mirrors the vector branch of computeMatchPrediction but without brewPath
// coupling. Used by /api/coffee-match to produce stable score + tier; the LLM
// then only writes the human-readable texts consistent with that score.
const computeCoffeeProfileMatch = ({ coffeeProfile, userQuestionnaire, calibration }) => {
  const coffeeVector = coffeeProfile?.tasteVector;
  const userVector = userQuestionnaire?.tasteVector;
  const calibrationOffset = Number(calibration?.offset) || 0;
  const calibrationSample = Number(calibration?.sampleSize) || 0;

  if (!coffeeVector || !userVector) {
    return {
      hasVector: false,
      calibrationOffset,
      calibrationSampleSize: calibrationSample,
    };
  }

  const tolerance = userQuestionnaire.toleranceVector || {};
  const opennessRaw = String(userQuestionnaire.openness || 'moderate').toLowerCase();
  const openness = ['conservative', 'moderate', 'adventurous'].includes(opennessRaw)
    ? opennessRaw
    : 'moderate';

  let totalWeight = 0;
  let weightedDistance = 0;
  const axes = [];
  const keyMatches = [];
  const keyConflicts = [];

  for (const axis of TASTE_AXES) {
    const toleranceLevel = tolerance[axis] || 'neutral';
    const weight = TOLERANCE_WEIGHTS[toleranceLevel] || TOLERANCE_WEIGHTS.neutral;
    const coffeeValue = clampAxis(coffeeVector[axis]);
    const userValue = clampAxis(userVector[axis]);
    const diff = Math.abs(userValue - coffeeValue);
    totalWeight += weight;
    weightedDistance += diff * weight;

    let status = 'neutral';
    if (diff <= 15) {
      status = 'match';
      keyMatches.push(AXIS_LABELS[axis]);
    } else if (diff >= 40 && (toleranceLevel === 'dislike' || toleranceLevel === 'neutral')) {
      status = 'conflict';
      keyConflicts.push(AXIS_LABELS[axis]);
    }

    axes.push({
      axis,
      label: AXIS_LABELS[axis],
      coffeeValue,
      userValue,
      diff: Math.round(diff),
      tolerance: toleranceLevel,
      weight,
      status,
    });
  }

  const normalizedDistance = totalWeight > 0 ? weightedDistance / totalWeight : 0;
  const baseScore = Math.round(100 - normalizedDistance);

  let opennessBonus = 0;
  if (openness === 'adventurous') { opennessBonus = 4; }
  else if (openness === 'conservative') { opennessBonus = -3; }

  const rawProfileConfidence = Number(coffeeProfile?.confidence);
  const profileConfidence = Number.isFinite(rawProfileConfidence)
    ? Math.max(0, Math.min(1, rawProfileConfidence))
    : null;

  let confidencePenalty = 0;
  if (profileConfidence !== null && profileConfidence < 0.5) {
    confidencePenalty = Math.round((0.5 - profileConfidence) * 10);
  }

  const preCalibrationScore = baseScore + opennessBonus - confidencePenalty;
  const matchScore = Math.max(0, Math.min(99, preCalibrationScore - calibrationOffset));
  const matchTier = matchScoreToTier(matchScore);

  return {
    hasVector: true,
    matchScore,
    matchTier,
    confidence: profileConfidence ?? 0.7,
    keyMatches,
    keyConflicts,
    axes,
    algorithmVersion: MATCH_ALGORITHM_VERSION,
    breakdown: {
      mode: 'vector',
      baseScore,
      opennessBonus,
      confidencePenalty,
      calibrationOffset,
      calibrationSampleSize: calibrationSample,
      openness,
    },
  };
};

const buildCoffeeMatchTextPayload = (questionnaire, coffeeProfile, vectorResult) => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.4,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'coffee_match_text',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['baristaSummary', 'laymanSummary', 'suggestedAdjustments', 'adventureNote'],
        properties: {
          baristaSummary: { type: 'string' },
          laymanSummary: { type: 'string' },
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
        'Si priateľský coffee sensory analytik. Deterministický algoritmus UŽ vypočítal numerické skóre zhody '
        + 'a kľúčové zhody/konflikty medzi profilom zákazníka a kávou. '
        + 'Tvoja úloha je IBA napísať ľudské texty — baristaSummary, laymanSummary, suggestedAdjustments, adventureNote — '
        + 'ktoré sú v súlade so skóre a tierom. NEprepisuj skóre, NEhádaj iný tier, drž sa toho čo dostaneš. '
        + 'baristaSummary: odborný pohľad pre baristu (2-3 vety, senzorické termíny, konkrétne osi). '
        + 'laymanSummary: zrozumiteľný sumár pre bežného kávičkára (2-3 vety, bez žargónu). '
        + 'suggestedAdjustments: konkrétny tip čo pri príprave skúsiť aby sa káva priblížila profilu zákazníka '
        + '(napr. úprava teploty, mletia, pomeru) — alebo prázdny string ak netreba. '
        + 'adventureNote: vždy napíš aspoň jednu vetu čo zaujímavé môže káva ponúknuť, aj keď nie je perfect match. '
        + 'Odpovedaj po slovensky, bez marketingových fráz. Výstup musí presne sedieť na JSON schému.',
    },
    {
      role: 'user',
      content: `Deterministické skóre: ${vectorResult.matchScore}/100 (tier: ${vectorResult.matchTier}).\n`
        + `Zhoda v osách: ${vectorResult.keyMatches.join(', ') || '—'}.\n`
        + `Konflikty v osách: ${vectorResult.keyConflicts.join(', ') || '—'}.\n`
        + `Openness zákazníka: ${questionnaire?.openness || 'moderate'}.\n\n`
        + `Dotazník (profil):\n${JSON.stringify(
          {
            tasteVector: questionnaire?.tasteVector || {},
            toleranceVector: questionnaire?.toleranceVector || {},
            openness: questionnaire?.openness,
            profileSummary: questionnaire?.profileSummary,
          },
          null,
          2,
        )}\n\nProfil kávy:\n${JSON.stringify(
          {
            tasteVector: coffeeProfile?.tasteVector || {},
            flavorNotes: coffeeProfile?.flavorNotes || [],
            tasteProfile: coffeeProfile?.tasteProfile,
            expertSummary: coffeeProfile?.expertSummary,
            preferenceHint: coffeeProfile?.preferenceHint,
            confidence: coffeeProfile?.confidence,
          },
          null,
          2,
        )}\n\nNapíš texty konzistentné s vyššie uvedeným skóre a tierom.`,
    },
  ],
});

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

  const { content: correctedText } = await callOpenAI({
    apiKey: openAiApiKey,
    payload: buildOpenAiPayload(rawText),
    label: 'OCR-Correction',
  });

  return { rawText, correctedText };
};

router.post('/api/ocr-correct', aiRateLimit, async (req, res, next) => {
  try {
    await requireSession(req);
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
    if (error instanceof AIError) {
      const resp = aiErrorToResponse(error);
      return res.status(resp.status).json(resp.body);
    }
    if (error.status) {
      const code = error.status === 401 ? 'auth_error' : 'ocr_error';
      return sendError(res, code, error.message);
    }
    console.error('[OCR] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-photo-analysis', aiRateLimit, async (req, res, next) => {
  try {
    await requireSession(req);
    const { imageBase64, languageHints } = req.body || {};
    console.log('[PhotoAnalysis] request received', {
      imageBase64Length: imageBase64?.length ?? 0,
      languageHints,
    });

    const cacheKey = aiCache.hashKey(['photo-analysis', imageBase64]);
    const cached = aiCache.get(cacheKey);
    if (cached) {
      console.log('[PhotoAnalysis] Cache hit', { cacheKey: cacheKey.slice(0, 12) });
      return res.status(200).json({ ...cached, cached: true });
    }

    const { rawText, correctedText } = await runOcr({
      imageBase64,
      languageHints,
    });

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return sendError(res, 'config_error', 'OpenAI API key is not configured.');
    }

    const { content: analysisContent } = await callOpenAI({
      apiKey: openAiApiKey,
      payload: buildPhotoCoffeeAnalysisPayload(correctedText),
      label: 'PhotoAnalysis',
    });

    const analysis = validateAISchema(
      parseAIJson(analysisContent, 'PhotoAnalysis'),
      ['tasteProfile', 'flavorNotes', 'recommendedPreparations', 'confidence', 'summary'],
      'PhotoAnalysis',
    );

    const responseBody = { rawText, correctedText, analysis };
    aiCache.set(cacheKey, responseBody, undefined, 'photo-analysis');

    return res.status(200).json(responseBody);
  } catch (error) {
    if (error instanceof AIError) {
      const resp = aiErrorToResponse(error);
      return res.status(resp.status).json(resp.body);
    }
    if (error.status) {
      const code = error.status === 401 ? 'auth_error' : 'api_error';
      return sendError(res, code, error.message);
    }
    console.error('[PhotoAnalysis] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-photo-recipe', aiRateLimit, async (req, res, next) => {
  try {
    const session = await requireSession(req);
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
      return sendError(res, 'validation_error', 'analysis is required.');
    }

    if (brewPath !== 'espresso' && brewPath !== 'filter') {
      return sendError(res, 'validation_error', 'brewPath must be "espresso" or "filter".');
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[PhotoRecipe] OpenAI API key missing');
      return sendError(res, 'config_error', 'OpenAI API key is not configured.');
    }

    // Load user's questionnaire + feedback history for personalized recipe
    let userQuestionnaire = null;
    let calibration = { offset: 0, sampleSize: 0 };
    try {
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

      const feedbackResult = await db.query(
        `SELECT predicted_score, actual_rating
         FROM user_recipe_feedback
         WHERE user_id = $1
           AND algorithm_version = $2
         ORDER BY created_at DESC
         LIMIT 20`,
        [session.uid, MATCH_ALGORITHM_VERSION],
      );
      calibration = computeCalibrationOffset(feedbackResult.rows);
    } catch (dbError) {
      console.warn('[PhotoRecipe] Failed to load personalization data', dbError?.message);
    }

    let aiPayload;
    let effectivePreparation = '';

    if (brewPath === 'espresso') {
      // --- ESPRESSO PATH ---
      if (!drinkType || typeof drinkType !== 'string') {
        return sendError(res, 'validation_error', 'drinkType is required for espresso path.');
      }
      if (!machineType || typeof machineType !== 'string') {
        return sendError(res, 'validation_error', 'machineType is required for espresso path.');
      }

      if (!hasAnyEspressoInput({ dose: brewPreferences?.targetDoseG, yieldG: brewPreferences?.targetYieldG })) {
        return sendError(res, 'validation_error', 'At least one of targetDoseG or targetYieldG is required.');
      }

      const sanitizedBrewPreferences = normalizeEspressoBrew({
        dose: brewPreferences?.targetDoseG,
        yieldG: brewPreferences?.targetYieldG,
        ratio: brewPreferences?.targetRatio,
      });

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
        userQuestionnaire,
      );
    } else {
      // --- FILTER PATH ---
      effectivePreparation = typeof selectedPreparation === 'string' && selectedPreparation.trim()
        ? selectedPreparation.trim()
        : typeof customPreparationText === 'string' && customPreparationText.trim()
          ? customPreparationText.trim()
          : '';

      if (!strengthPreference || !effectivePreparation) {
        return sendError(
          res,
          'validation_error',
          'strengthPreference and selectedPreparation/customPreparationText are required for filter path.',
        );
      }

      if (!hasAnyFilterInput({ dose: brewPreferences?.targetDoseG, water: brewPreferences?.targetWaterMl })) {
        return sendError(res, 'validation_error', 'At least one of targetDoseG or targetWaterMl is required.');
      }

      const sanitizedBrewPreferences = normalizeFilterBrew({
        dose: brewPreferences?.targetDoseG,
        water: brewPreferences?.targetWaterMl,
        ratio: brewPreferences?.targetRatio,
      });

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
        userQuestionnaire,
      );
    }

    const { content: recipeContent } = await callOpenAI({
      apiKey: openAiApiKey,
      payload: aiPayload,
      label: 'PhotoRecipe',
    });

    const recipe = validateAISchema(
      parseAIJson(recipeContent, 'PhotoRecipe'),
      ['title', 'dose', 'steps', 'baristaTips'],
      'PhotoRecipe',
    );

    const likePrediction = computeMatchPrediction({
      analysis,
      selectedPreparation: effectivePreparation,
      strengthPreference: strengthPreference || null,
      brewPath,
      userQuestionnaire,
      calibration,
    });

    return res.status(200).json({ recipe, likePrediction, personalizedForUser: Boolean(userQuestionnaire) });
  } catch (error) {
    if (error instanceof AIError) {
      const resp = aiErrorToResponse(error);
      return res.status(resp.status).json(resp.body);
    }
    if (error.status) {
      const code = error.status === 401 ? 'auth_error' : 'api_error';
      return sendError(res, code, error.message);
    }
    console.error('[PhotoRecipe] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-profile', aiRateLimit, async (req, res, next) => {
  try {
    await requireSession(req);
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
      return sendError(res, 'validation_error', 'text is required.');
    }

    const cacheKey = aiCache.hashKey(['coffee-profile', sourceText]);
    const cached = aiCache.get(cacheKey);
    if (cached) {
      console.log('[CoffeeProfile] Cache hit', { cacheKey: cacheKey.slice(0, 12) });
      return res.status(200).json({ ...cached, cached: true });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[CoffeeProfile] OpenAI API key missing');
      return sendError(res, 'config_error', 'OpenAI API key is not configured.');
    }

    const { content: profileContent } = await callOpenAI({
      apiKey: openAiApiKey,
      payload: buildCoffeeProfilePayload(sourceText),
      label: 'CoffeeProfile',
    });

    const profile = parseAIJson(profileContent, 'CoffeeProfile');

    const responseBody = { profile };
    aiCache.set(cacheKey, responseBody, undefined, 'coffee-profile');

    return res.status(200).json(responseBody);
  } catch (error) {
    if (error instanceof AIError) {
      const resp = aiErrorToResponse(error);
      return res.status(resp.status).json(resp.body);
    }
    if (error.status) {
      const code = error.status === 401 ? 'auth_error' : 'api_error';
      return sendError(res, code, error.message);
    }
    console.error('[CoffeeProfile] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-questionnaire', aiRateLimit, async (req, res, next) => {
  try {
    await requireSession(req);
    const { answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return sendError(res, 'validation_error', 'answers are required.');
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[CoffeeQuestionnaire] OpenAI API key missing');
      return sendError(res, 'config_error', 'OpenAI API key is not configured.');
    }

    const formattedAnswers = answers
      .map((item, index) => `${index + 1}. ${item.question}: ${item.answer}`)
      .join('\n');

    const { content: profileContent } = await callOpenAI({
      apiKey: openAiApiKey,
      payload: buildCoffeeQuestionnairePayload(formattedAnswers),
      label: 'CoffeeQuestionnaire',
    });

    const profile = parseAIJson(profileContent, 'CoffeeQuestionnaire');

    return res.status(200).json({ profile });
  } catch (error) {
    if (error instanceof AIError) {
      const resp = aiErrorToResponse(error);
      return res.status(resp.status).json(resp.body);
    }
    if (error.status) {
      const code = error.status === 401 ? 'auth_error' : 'api_error';
      return sendError(res, code, error.message);
    }
    console.error('[CoffeeQuestionnaire] Unexpected error', error);
    return next(error);
  }
});

router.post('/api/coffee-match', aiRateLimit, async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { questionnaire, coffeeProfile } = req.body || {};

    if (!questionnaire || !coffeeProfile) {
      return sendError(res, 'validation_error', 'questionnaire and coffeeProfile are required.');
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      console.error('[CoffeeMatch] OpenAI API key missing');
      return sendError(res, 'config_error', 'OpenAI API key is not configured.');
    }

    const cacheKey = aiCache.hashKey([
      'coffee-match',
      MATCH_CACHE_VERSION,
      session.uid,
      questionnaire,
      coffeeProfile,
    ]);

    const memoryHit = aiCache.get(cacheKey);
    if (memoryHit) {
      console.log('[CoffeeMatch] In-memory cache hit', { cacheKey: cacheKey.slice(0, 12) });
      return res.status(200).json({ match: memoryHit, cached: true });
    }

    try {
      const dbHit = await db.query(
        'SELECT match FROM coffee_match_cache WHERE user_id = $1 AND cache_key = $2',
        [session.uid, cacheKey],
      );
      if (dbHit.rows.length > 0) {
        const row = dbHit.rows[0];
        const cachedMatch = typeof row.match === 'string' ? JSON.parse(row.match) : row.match;
        console.log('[CoffeeMatch] DB cache hit', { cacheKey: cacheKey.slice(0, 12) });
        aiCache.set(cacheKey, cachedMatch, undefined, 'coffee-match');
        return res.status(200).json({ match: cachedMatch, cached: true });
      }
    } catch (dbError) {
      console.warn('[CoffeeMatch] DB cache lookup failed', dbError?.message);
    }

    // Load user's coffee-match feedback history for calibration offset.
    let calibration = { offset: 0, sampleSize: 0 };
    try {
      const feedbackResult = await db.query(
        `SELECT predicted_score, actual_rating
         FROM user_coffee_match_feedback
         WHERE user_id = $1
           AND algorithm_version = $2
         ORDER BY created_at DESC
         LIMIT 20`,
        [session.uid, MATCH_ALGORITHM_VERSION],
      );
      calibration = computeCalibrationOffset(feedbackResult.rows);
    } catch (dbError) {
      console.warn('[CoffeeMatch] Failed to load calibration feedback', dbError?.message);
    }

    const vectorResult = computeCoffeeProfileMatch({
      coffeeProfile,
      userQuestionnaire: questionnaire,
      calibration,
    });

    let match;
    if (vectorResult.hasVector) {
      const { content: textContent } = await callOpenAI({
        apiKey: openAiApiKey,
        payload: buildCoffeeMatchTextPayload(questionnaire, coffeeProfile, vectorResult),
        label: 'CoffeeMatch-Text',
      });
      const texts = parseAIJson(textContent, 'CoffeeMatch-Text');

      match = {
        matchScore: vectorResult.matchScore,
        matchTier: vectorResult.matchTier,
        confidence: vectorResult.confidence,
        baristaSummary: typeof texts?.baristaSummary === 'string' ? texts.baristaSummary : '',
        laymanSummary: typeof texts?.laymanSummary === 'string' ? texts.laymanSummary : '',
        keyMatches: vectorResult.keyMatches,
        keyConflicts: vectorResult.keyConflicts,
        suggestedAdjustments:
          typeof texts?.suggestedAdjustments === 'string' ? texts.suggestedAdjustments : '',
        adventureNote: typeof texts?.adventureNote === 'string' ? texts.adventureNote : '',
        algorithmVersion: vectorResult.algorithmVersion,
        breakdown: vectorResult.breakdown,
      };
    } else {
      console.log('[CoffeeMatch] Vector unavailable, falling back to LLM-only path');
      const { content: matchContent } = await callOpenAI({
        apiKey: openAiApiKey,
        payload: buildCoffeeMatchPayload(questionnaire, coffeeProfile),
        label: 'CoffeeMatch',
      });
      match = parseAIJson(matchContent, 'CoffeeMatch');
      match.algorithmVersion = MATCH_LLM_FALLBACK_VERSION;
    }

    aiCache.set(cacheKey, match, undefined, 'coffee-match');

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
      await db.query(
        `INSERT INTO coffee_match_cache (user_id, cache_key, match, algorithm_version)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (user_id, cache_key)
         DO UPDATE SET match = EXCLUDED.match,
                       algorithm_version = EXCLUDED.algorithm_version,
                       updated_at = now()`,
        [
          session.uid,
          cacheKey,
          JSON.stringify(match),
          match.algorithmVersion || MATCH_CACHE_VERSION,
        ],
      );
    } catch (dbError) {
      console.warn('[CoffeeMatch] Failed to persist match cache', dbError?.message);
    }

    return res.status(200).json({ match });
  } catch (error) {
    if (error instanceof AIError) {
      const resp = aiErrorToResponse(error);
      return res.status(resp.status).json(resp.body);
    }
    if (error.status) {
      const code = error.status === 401 ? 'auth_error' : 'api_error';
      return sendError(res, code, error.message);
    }
    console.error('[CoffeeMatch] Unexpected error', error);
    return next(error);
  }
});

export default router;
