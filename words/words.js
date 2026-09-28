import { getWords, deleteWord, togglePin, sortWords } from '../lib/storage.js';

const grid = document.getElementById('grid');
const tpl = document.getElementById('card-tpl');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
const noMatchEl = document.getElementById('no-match');
const searchEl = document.getElementById('search');
const langEl = document.getElementById('lang-filter');

const LANG_LABELS = { en: '英', ko: '韓' };

let words = [];

// 舊資料沒有 language 欄位，一律視為英文
function langOf(word) {
  return word.language || 'en';
}

function matches(word, query, lang) {
  if (lang && langOf(word) !== lang) return false;
  if (!query) return true;
  return [word.word, word.reading, word.translation].some((s) => s?.toLowerCase().includes(query));
}

function renderCard(word) {
  const card = tpl.content.firstElementChild.cloneNode(true);
  card.classList.toggle('pinned', word.pinned);
  card.querySelector('.lang').textContent = LANG_LABELS[langOf(word)] || '';
  card.querySelector('.word').textContent = word.word;
  card.querySelector('.reading').textContent = word.reading || '';
  card.querySelector('.pos').textContent = word.partOfSpeech;
  card.querySelector('.translation').textContent = word.translation;
  card.querySelector('.example-en').textContent = word.example;
  card.querySelector('.example-zh').textContent = word.exampleTranslation;

  const pinBtn = card.querySelector('.pin');
  pinBtn.textContent = word.pinned ? '取消置頂' : '置頂';
  pinBtn.classList.toggle('active', word.pinned);
  pinBtn.addEventListener('click', () => togglePin(word.id));

  card.querySelector('.delete').addEventListener('click', () => {
    if (confirm(`確定要刪除「${word.word}」嗎？`)) deleteWord(word.id);
  });
  return card;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const lang = langEl.value;
  const visible = sortWords(words).filter((w) => matches(w, query, lang));

  grid.replaceChildren(...visible.map(renderCard));
  countEl.textContent = `共 ${words.length} 個單字`;
  emptyEl.hidden = words.length > 0;
  noMatchEl.hidden = words.length === 0 || visible.length > 0;
}

async function load() {
  words = await getWords();
  render();
}

searchEl.addEventListener('input', render);
langEl.addEventListener('change', render);

// 在其他分頁新增/修改單字時即時更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.words) {
    words = changes.words.newValue || [];
    render();
  }
});

chrome.commands.getAll().then((commands) => {
  const cmd = commands.find((c) => c.name === 'start-ocr');
  if (cmd?.shortcut) document.getElementById('shortcut').textContent = cmd.shortcut;
});

load();
