// Google Gemini API 呼叫

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const OCR_PROMPT = `You are an English vocabulary assistant for Traditional Chinese (Taiwan) speakers.
The image is a cropped region of a web page. Read the English word or phrase in it.
- If the image contains several words, pick the main word or phrase the user most likely wants to look up (a phrase like "take off" is fine).
- Return the word in its original form as shown (keep proper capitalization only for proper nouns; otherwise lowercase).
- partOfSpeech: abbreviation plus Chinese, e.g. "n. 名詞", "v. 動詞", "adj. 形容詞", "adv. 副詞", "phr. 片語".
- translation: concise Traditional Chinese meaning(s) fitting the most common usage.
- example: one natural English example sentence using the word.
- exampleTranslation: Traditional Chinese translation of the example.
If there is no readable English text in the image, return an empty string for every field.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    word: { type: 'STRING' },
    partOfSpeech: { type: 'STRING' },
    translation: { type: 'STRING' },
    example: { type: 'STRING' },
    exampleTranslation: { type: 'STRING' },
  },
  required: ['word', 'partOfSpeech', 'translation', 'example', 'exampleTranslation'],
};

async function generate({ apiKey, model }, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('無法連線到 Gemini，請檢查網路連線。');
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {}
    if (res.status === 400 && /API key/i.test(detail)) throw new Error('API Key 無效，請到設定頁確認。');
    if (res.status === 401 || res.status === 403) throw new Error('API Key 無效或沒有權限，請到設定頁確認。');
    if (res.status === 404) {
      const err = new Error(`找不到模型「${model}」，可能已停用，請到設定頁重新選擇模型。`);
      err.modelNotFound = true;
      throw err;
    }
    if (res.status === 429) throw new Error('已超過 Gemini 使用額度，請稍後再試。');
    throw new Error(`Gemini 錯誤 (${res.status})${detail ? '：' + detail : ''}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini 沒有回傳內容，請再試一次。');
  return text;
}

export async function recognizeWord(settings, base64Png) {
  const text = await generate(settings, {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: 'image/png', data: base64Png } },
          { text: OCR_PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('無法解析 Gemini 的回應，請再試一次。');
  }
}

// 列出此 API Key 可用、支援 generateContent 的一般對話模型（排除 TTS、嵌入、生圖等）
export async function listModels(apiKey) {
  let res;
  try {
    res = await fetch(`${API_BASE}?pageSize=1000`, { headers: { 'x-goog-api-key': apiKey } });
  } catch {
    throw new Error('無法連線到 Gemini，請檢查網路連線。');
  }
  if (!res.ok) {
    if ([400, 401, 403].includes(res.status)) throw new Error('API Key 無效或沒有權限，請確認後再試。');
    throw new Error(`無法取得模型清單 (${res.status})`);
  }
  const { models = [] } = await res.json();
  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini') && !/tts|embedding|image|live|audio|computer-use/i.test(id));
}

// 從可用清單中挑預設模型：優先最新的 flash 別名，其次版本號最大的 flash
export function pickDefaultModel(ids) {
  if (ids.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  const flash = ids
    .filter((id) => /flash/.test(id) && !/lite|preview|exp/.test(id))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return flash[0] || ids[0] || '';
}

export async function testConnection(settings) {
  await generate(settings, {
    contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }],
  });
}
