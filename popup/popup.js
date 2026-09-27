document.getElementById('open-words').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('words/words.html') });
  window.close();
});

document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// 顯示使用者實際設定的快捷鍵
chrome.commands.getAll().then((commands) => {
  const cmd = commands.find((c) => c.name === 'start-ocr');
  const kbd = document.getElementById('shortcut');
  kbd.textContent = cmd?.shortcut || '未設定';
});
