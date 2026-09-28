import { getSettings, addWord } from './lib/storage.js';
import { recognizeWord } from './lib/gemini.js';

const MENU_ID = 'start-ocr';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'OCR 選取單字',
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab) startSelection(tab);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'start-ocr') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) startSelection(tab);
});

async function startSelection(tab) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/overlay.js'],
    });
    const { apiKey } = await getSettings();
    await chrome.tabs.sendMessage(tab.id, { type: 'start-selection', needsKey: !apiKey });
  } catch (err) {
    // chrome://、Chrome 線上應用程式商店等頁面無法注入腳本
    console.warn('無法在此頁面啟動 OCR：', err);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'capture':
      handleCapture(msg, sender.tab).then(sendResponse);
      return true;
    case 'open-options':
      chrome.runtime.openOptionsPage();
      break;
    case 'open-words':
      chrome.tabs.create({ url: chrome.runtime.getURL('words/words.html') });
      break;
  }
});

async function handleCapture({ rect, viewportWidth }, tab) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) return { ok: false, needsKey: true, error: '尚未設定 Gemini API Key。' };

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const base64 = await cropImage(dataUrl, rect, viewportWidth);
    const result = await recognizeWord(settings, base64);

    if (!result.word?.trim()) return { ok: false, error: '未辨識到英文或韓文單字，請重新框選。' };

    const { word, duplicate } = await addWord(result);
    return { ok: true, word, duplicate };
  } catch (err) {
    return { ok: false, needsSettings: !!err.modelNotFound, error: err.message || String(err) };
  }
}

// 依 CSS 像素座標裁切截圖；以實際截圖寬度換算比例，可涵蓋 DPI 與頁面縮放
async function cropImage(dataUrl, rect, viewportWidth) {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = bitmap.width / viewportWidth;

  const sx = Math.max(0, Math.round(rect.x * scale));
  const sy = Math.max(0, Math.round(rect.y * scale));
  const sw = Math.min(bitmap.width - sx, Math.round(rect.width * scale));
  const sh = Math.min(bitmap.height - sy, Math.round(rect.height * scale));

  const canvas = new OffscreenCanvas(sw, sh);
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();

  const out = await canvas.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
