// 注入網頁的框選介面與翻譯浮窗（Shadow DOM 隔離網頁樣式）
(() => {
  if (window.__ocrVocabLoaded) return;
  window.__ocrVocabLoaded = true;

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .mask {
      position: fixed; inset: 0; z-index: 2147483647;
      cursor: crosshair; background: rgba(15, 23, 42, 0.25);
    }
    .hint {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      padding: 8px 14px; border-radius: 8px;
      background: rgba(15, 23, 42, 0.9); color: #fff;
      font: 13px/1.4 system-ui, "Microsoft JhengHei", "Malgun Gothic", sans-serif;
      pointer-events: none;
    }
    .rect {
      position: fixed; border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.12);
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.15);
      pointer-events: none;
    }
    .bubble {
      position: fixed; z-index: 2147483647;
      width: max-content; max-width: 320px; min-width: 200px;
      padding: 12px 14px; border-radius: 10px;
      background: #fff; color: #1e293b;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
      font: 14px/1.5 system-ui, "Microsoft JhengHei", "Malgun Gothic", sans-serif;
    }
    .word { font-size: 18px; font-weight: 700; margin-right: 6px; }
    .reading { color: #64748b; font-size: 13px; margin-right: 6px; }
    .pos {
      display: inline-block; padding: 1px 8px; border-radius: 999px;
      background: #eff6ff; color: #1d4ed8; font-size: 12px; vertical-align: 2px;
    }
    .trans { margin-top: 6px; font-size: 15px; }
    .meta {
      margin-top: 8px; display: flex; justify-content: space-between; align-items: center;
      gap: 12px; font-size: 12px; color: #64748b;
    }
    .error { color: #b91c1c; }
    .loading { color: #475569; }
    a { color: #2563eb; cursor: pointer; text-decoration: underline; }
  `;

  let host = null;
  let root = null;
  let bubble = null;

  function ensureRoot() {
    if (host && host.isConnected) return;
    host = document.createElement('ocr-vocab-root');
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.appendChild(style);
    document.documentElement.appendChild(host);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- 浮窗 ----------

  function closeBubble() {
    bubble?.remove();
    bubble = null;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onBubbleKey, true);
  }

  function onOutsideClick(e) {
    if (e.composedPath().includes(host)) return;
    closeBubble();
  }

  function onBubbleKey(e) {
    if (e.key === 'Escape') closeBubble();
  }

  function showBubble(rect, content) {
    ensureRoot();
    closeBubble();
    bubble = el('div', 'bubble');
    bubble.append(...content);
    root.appendChild(bubble);

    // 預設放在選取框下方，空間不足則放上方；水平方向不超出視窗
    const margin = 8;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    let top = rect.y + rect.height + margin;
    if (top + bh > innerHeight - margin) top = Math.max(margin, rect.y - bh - margin);
    let left = Math.min(Math.max(margin, rect.x), innerWidth - bw - margin);
    bubble.style.top = `${top}px`;
    bubble.style.left = `${Math.max(margin, left)}px`;

    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onBubbleKey, true);
  }

  function link(text, type) {
    const a = el('a', null, text);
    a.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type });
      closeBubble();
    });
    return a;
  }

  function showNeedsKey(rect, text = '尚未設定 Gemini API Key。') {
    const msg = el('div', 'error', text);
    const meta = el('div', 'meta');
    meta.append(link('開啟設定', 'open-options'));
    showBubble(rect, [msg, meta]);
  }

  function showResult(rect, res) {
    if (!res?.ok) {
      if (res?.needsKey) return showNeedsKey(rect);
      if (res?.needsSettings) return showNeedsKey(rect, res.error);
      return showBubble(rect, [el('div', 'error', res?.error || '發生未知錯誤。')]);
    }
    const { word, duplicate } = res;
    const head = el('div');
    head.append(el('span', 'word', word.word));
    if (word.reading) head.append(el('span', 'reading', word.reading));
    if (word.partOfSpeech) head.append(el('span', 'pos', word.partOfSpeech));
    const trans = el('div', 'trans', word.translation);
    const meta = el('div', 'meta');
    meta.append(
      el('span', null, duplicate ? '已在單字本中' : '✓ 已加入單字本'),
      link('開啟單字本', 'open-words'),
    );
    showBubble(rect, [head, trans, meta]);
  }

  // ---------- 框選 ----------

  function startSelection(needsKey) {
    ensureRoot();
    closeBubble();
    if (root.querySelector('.mask')) return;

    const mask = el('div', 'mask');
    const hint = el('div', 'hint', '拖曳滑鼠框選英文或韓文單字（Esc 取消）');
    mask.appendChild(hint);
    root.appendChild(mask);

    let start = null;
    let rectEl = null;

    const cleanup = () => {
      mask.remove();
      document.removeEventListener('keydown', onKey, true);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      }
    };
    document.addEventListener('keydown', onKey, true);

    const currentRect = (e) => ({
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      width: Math.abs(e.clientX - start.x),
      height: Math.abs(e.clientY - start.y),
    });

    mask.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY };
      hint.remove();
      rectEl = el('div', 'rect');
      mask.appendChild(rectEl);
    });

    mask.addEventListener('mousemove', (e) => {
      if (!start) return;
      const r = currentRect(e);
      Object.assign(rectEl.style, {
        left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px`,
      });
    });

    mask.addEventListener('mouseup', (e) => {
      if (!start) return;
      const rect = currentRect(e);
      cleanup();
      if (rect.width < 5 || rect.height < 5) return;
      if (needsKey) return showNeedsKey(rect);
      capture(rect);
    });
  }

  function capture(rect) {
    // 等遮罩移除後的畫面重繪完成，再請 background 截圖
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        const pending = chrome.runtime.sendMessage({
          type: 'capture',
          rect,
          viewportWidth: window.innerWidth,
        });
        // 浮窗在選取框外，不會被裁進截圖
        setTimeout(() => {
          if (!bubble) showBubble(rect, [el('div', 'loading', '辨識中…')]);
        }, 150);
        let res;
        try {
          res = await pending;
        } catch (err) {
          res = { ok: false, error: '擴充功能已更新，請重新整理此頁面後再試。' };
        }
        showResult(rect, res);
      }),
    );
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'start-selection') startSelection(msg.needsKey);
  });
})();
