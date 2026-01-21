import sharp from 'sharp';

const stripDataUrlPrefix = (value) => value.replace(/^data:.*;base64,/, '');

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

const average = (values) => {
  if (!values || values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
};

const normalizeImageBase64 = async (base64Image) => {
  const buffer = Buffer.from(base64Image, 'base64');
  const normalizedBuffer = await sharp(buffer)
    .rotate()
    .grayscale()
    .median(3)
    .normalize()
    .linear(1.15, -8)
    .sharpen()
    .toFormat('png')
    .toBuffer();

  return normalizedBuffer.toString('base64');
};

const buildWord = (word) => {
  const symbols = word?.symbols ?? [];
  let text = '';
  let breakType = null;
  const confidences = [];

  symbols.forEach((symbol) => {
    if (symbol?.text) {
      text += symbol.text;
    }
    if (typeof symbol?.confidence === 'number') {
      confidences.push(symbol.confidence);
    }
    if (symbol?.property?.detectedBreak?.type) {
      breakType = symbol.property.detectedBreak.type;
    }
  });

  return {
    text,
    breakType,
    confidence: average(confidences) ?? word?.confidence ?? null,
  };
};

const extractBlocksAndLines = (visionResponse) => {
  const blocks = [];
  const lines = [];
  const fullTextAnnotation = visionResponse?.responses?.[0]?.fullTextAnnotation;

  if (!fullTextAnnotation?.pages) {
    return { blocks, lines };
  }

  fullTextAnnotation.pages.forEach((page) => {
    page.blocks?.forEach((block) => {
      const blockLines = [];
      let currentLine = { text: '', confidences: [] };

      const pushLine = () => {
        const lineText = currentLine.text.trim();
        if (lineText) {
          const confidence = average(currentLine.confidences);
          const lineEntry = {
            text: lineText,
            confidence,
          };
          blockLines.push(lineEntry);
          lines.push(lineEntry);
        }
        currentLine = { text: '', confidences: [] };
      };

      block.paragraphs?.forEach((paragraph) => {
        paragraph.words?.forEach((word) => {
          const wordInfo = buildWord(word);
          if (!wordInfo.text) {
            return;
          }

          if (currentLine.text && !currentLine.text.endsWith(' ')) {
            currentLine.text += ' ';
          }
          currentLine.text += wordInfo.text;

          if (typeof wordInfo.confidence === 'number') {
            currentLine.confidences.push(wordInfo.confidence);
          }

          if (['SPACE', 'SURE_SPACE', 'EOL_SURE_SPACE'].includes(wordInfo.breakType)) {
            currentLine.text += ' ';
          }

          if (['LINE_BREAK', 'EOL_SURE_SPACE'].includes(wordInfo.breakType)) {
            pushLine();
          }
        });
      });

      if (currentLine.text.trim()) {
        pushLine();
      }

      const blockText = blockLines.map((line) => line.text).join('\n');
      const blockConfidence = average(blockLines.map((line) => line.confidence).filter((value) => typeof value === 'number'));

      blocks.push({
        text: blockText,
        confidence: blockConfidence,
        lines: blockLines,
      });
    });
  });

  return { blocks, lines };
};

const extractRawText = (visionResponse) => {
  const response = visionResponse?.responses?.[0];
  return (
    response?.fullTextAnnotation?.text
    || response?.textAnnotations?.[0]?.description
    || ''
  );
};

const normalizeUnicode = (value) => value.normalize('NFKC');

const stripDiacritics = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const normalizeLine = (line) =>
  normalizeUnicode(line)
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

const isArtifactLine = (line) => {
  if (!line) {
    return true;
  }
  if (/^[\W_]+$/.test(line)) {
    return true;
  }
  if (/(.)\1{4,}/.test(line)) {
    return true;
  }
  const alphaCount = (line.match(/[A-Za-zÀ-ž]/g) || []).length;
  const digitCount = (line.match(/[0-9]/g) || []).length;
  const symbolCount = line.length - alphaCount - digitCount;
  const alphaRatio = alphaCount / line.length;
  const symbolRatio = symbolCount / line.length;

  if (alphaRatio < 0.2 && digitCount < 2) {
    return true;
  }
  if (symbolRatio > 0.6) {
    return true;
  }

  return false;
};

const cleanLines = (lines) => {
  const seen = new Set();
  const cleaned = [];

  lines.forEach((line) => {
    const normalized = normalizeLine(line);
    if (!normalized) {
      return;
    }

    if (isArtifactLine(normalized)) {
      return;
    }

    const dedupeKey = stripDiacritics(normalized).toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    cleaned.push(normalized);
  });

  return cleaned;
};

const detectLanguage = (text, languageHints = []) => {
  const normalized = normalizeUnicode(text);
  const scores = {
    sk: 0,
    cs: 0,
    en: 0,
  };

  const skChars = /[áäčďéíĺľňóôŕšťúýž]/gi;
  const csChars = /[áčďéěíňóřšťúůýž]/gi;
  const enChars = /[a-z]/gi;

  scores.sk = (normalized.match(skChars) || []).length;
  scores.cs = (normalized.match(csChars) || []).length;
  scores.en = (normalized.match(enChars) || []).length;

  const hintSet = new Set(languageHints.map((hint) => hint.toLowerCase()));
  if (hintSet.size > 0) {
    Object.keys(scores).forEach((key) => {
      if (!hintSet.has(key)) {
        scores[key] *= 0.6;
      }
    });
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
};

const buildOcrResult = ({ rawText, lines, blocks, languageHints }) => {
  const cleanedLines = cleanLines(lines.map((line) => line.text));
  const cleanedText = cleanedLines.join('\n');
  const normalizedText = stripDiacritics(cleanedText);
  const averageConfidence = average(
    lines
      .map((line) => line.confidence)
      .filter((value) => typeof value === 'number'),
  );
  const detectedLanguage = detectLanguage(cleanedText, languageHints);

  return {
    rawText,
    cleanedText,
    normalizedText,
    blocks,
    lines,
    metadata: {
      detectedLanguage,
      confidence: averageConfidence,
    },
  };
};

const runVisionOcr = async ({ base64Image, languageHints, apiKey }) => {
  const visionPayload = buildVisionPayload(base64Image, languageHints);
  const visionResponse = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
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

  return visionData;
};

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

const maybeCorrectTextWithOpenAi = async (rawText, apiKey) => {
  if (!apiKey) {
    return { correctedText: rawText, usedAi: false };
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildOpenAiPayload(rawText)),
  });

  const openAiData = await openAiResponse.json();

  if (!openAiResponse.ok) {
    console.error('[OCR] OpenAI request failed', {
      status: openAiResponse.status,
      details: openAiData,
    });
    return { correctedText: rawText, usedAi: false };
  }

  const correctedText = openAiData?.choices?.[0]?.message?.content?.trim();
  if (!correctedText) {
    console.error('[OCR] OpenAI response missing corrected text', {
      openAiData,
    });
    return { correctedText: rawText, usedAi: false };
  }

  return { correctedText, usedAi: true };
};

export const performOcrPipeline = async ({
  imageBase64,
  languageHints = [],
  visionApiKey,
}) => {
  const cleanedBase64 = stripDataUrlPrefix(imageBase64);
  const normalizedBase64 = await normalizeImageBase64(cleanedBase64);
  const visionData = await runVisionOcr({
    base64Image: normalizedBase64,
    languageHints,
    apiKey: visionApiKey,
  });
  const rawText = extractRawText(visionData).trim();
  const { blocks, lines } = extractBlocksAndLines(visionData);

  return buildOcrResult({
    rawText,
    lines,
    blocks,
    languageHints,
  });
};

export const correctOcrText = async ({ text, openAiApiKey }) =>
  maybeCorrectTextWithOpenAi(text, openAiApiKey);

export const normalizeInputImage = async (imageBase64) =>
  normalizeImageBase64(stripDataUrlPrefix(imageBase64));
