import { getSettings, saveSettings, DEFAULT_MODEL } from '../lib/storage.js';
import { testConnection, listModels, pickDefaultModel } from '../lib/gemini.js';

const form = document.getElementById('form');
const keyEl = document.getElementById('api-key');
const modelEl = document.getElementById('model');
const statusEl = document.getElementById('status');
const testBtn = document.getElementById('test');
const loadBtn = document.getElementById('load-models');

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

function readForm() {
  return {
    apiKey: keyEl.value.trim(),
    model: modelEl.value || DEFAULT_MODEL,
  };
}

function setModelOptions(ids, selected) {
  modelEl.replaceChildren(
    ...ids.map((id) => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = id;
      return opt;
    }),
  );
  modelEl.value = selected;
}

// 從 API 取得可用模型；若目前選的模型已不可用，自動換成建議的模型。回傳是否有更換
async function loadModels() {
  const apiKey = keyEl.value.trim();
  if (!apiKey) throw new Error('請先輸入 API Key。');
  const ids = await listModels(apiKey);
  if (!ids.length) throw new Error('此 API Key 沒有可用的 Gemini 模型。');
  const current = modelEl.value;
  const next = ids.includes(current) ? current : pickDefaultModel(ids);
  setModelOptions(ids, next);
  return current && next !== current ? { from: current, to: next } : null;
}

getSettings().then(async ({ apiKey, model }) => {
  keyEl.value = apiKey;
  setModelOptions([model], model);
  if (!apiKey) return;
  try {
    const changed = await loadModels();
    if (changed) setStatus(`模型「${changed.from}」已無法使用，已改選「${changed.to}」，請按「儲存」。`, 'error');
  } catch {
    // 開啟頁面時靜默失敗，使用者可按按鈕重試
  }
});

document.getElementById('toggle-key').addEventListener('click', (e) => {
  const show = keyEl.type === 'password';
  keyEl.type = show ? 'text' : 'password';
  e.target.textContent = show ? '隱藏' : '顯示';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings(readForm());
  setStatus('已儲存 ✓', 'ok');
});

loadBtn.addEventListener('click', async () => {
  loadBtn.disabled = true;
  setStatus('載入模型清單中…');
  try {
    const changed = await loadModels();
    setStatus(
      changed ? `已載入，原模型不可用，改選「${changed.to}」。` : `已載入 ${modelEl.options.length} 個可用模型。`,
      'ok',
    );
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    loadBtn.disabled = false;
  }
});

testBtn.addEventListener('click', async () => {
  testBtn.disabled = true;
  setStatus('測試中…');
  try {
    await loadModels();
    const settings = readForm();
    await testConnection(settings);
    await saveSettings(settings);
    setStatus(`連線成功，已儲存（模型：${settings.model}）✓`, 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    testBtn.disabled = false;
  }
});

document.getElementById('shortcuts-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

chrome.commands.getAll().then((commands) => {
  const cmd = commands.find((c) => c.name === 'start-ocr');
  if (cmd?.shortcut) document.getElementById('shortcut').textContent = cmd.shortcut;
});
