// 單字與設定的儲存（chrome.storage.local）

// 「-latest」別名會自動指向最新的 Flash 模型，避免舊版本停用後失效
export const DEFAULT_MODEL = 'gemini-flash-latest';

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { apiKey: '', model: DEFAULT_MODEL, ...(settings || {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getWords() {
  const { words } = await chrome.storage.local.get('words');
  return Array.isArray(words) ? words : [];
}

async function setWords(words) {
  await chrome.storage.local.set({ words });
}

export function findWord(words, word) {
  const key = word.trim().toLowerCase();
  return words.find((w) => w.word.trim().toLowerCase() === key);
}

// 重複時不新增，回傳既有資料與 duplicate: true
export async function addWord(entry) {
  const words = await getWords();
  const existing = findWord(words, entry.word);
  if (existing) return { word: existing, duplicate: true };

  const word = {
    id: crypto.randomUUID(),
    word: entry.word.trim(),
    partOfSpeech: entry.partOfSpeech || '',
    translation: entry.translation || '',
    example: entry.example || '',
    exampleTranslation: entry.exampleTranslation || '',
    pinned: false,
    createdAt: Date.now(),
  };
  words.push(word);
  await setWords(words);
  return { word, duplicate: false };
}

export async function deleteWord(id) {
  const words = await getWords();
  await setWords(words.filter((w) => w.id !== id));
}

export async function togglePin(id) {
  const words = await getWords();
  const word = words.find((w) => w.id === id);
  if (!word) return;
  word.pinned = !word.pinned;
  word.pinnedAt = word.pinned ? Date.now() : null;
  await setWords(words);
}

// 置頂優先（最近置頂在前），其餘依新增時間新到舊
export function sortWords(words) {
  return [...words].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned) return (b.pinnedAt || 0) - (a.pinnedAt || 0);
    return b.createdAt - a.createdAt;
  });
}
