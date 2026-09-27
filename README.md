# OCR 單字本

一個 Chrome 擴充功能：在任何網頁上框選英文單字，透過 Google Gemini 辨識並翻譯成中文，自動收進你的個人單字本。

## 功能

- **框選翻譯**：按快捷鍵 `Alt+Shift+O`，或在網頁上按右鍵選「OCR 選取單字」，拖曳滑鼠框選英文單字或片語，畫面上會立即顯示中文翻譯。圖片、影片字幕、PDF 等無法選取的文字也能辨識。
- **自動收藏**：每個查詢過的單字都會存進單字本，重複的單字不會再次加入。
- **卡片式單字本**：每張卡片包含單字、詞性、中文翻譯、英文例句與例句翻譯（由 AI 生成），可以「置頂」或「刪除」，也支援搜尋。
- **資料留在本機**：單字與 API Key 都只存在你的瀏覽器中，不會上傳到其他地方（辨識時的截圖會送到 Google Gemini）。

## 安裝

1. 下載此專案：點右上角綠色的 **Code** → **Download ZIP** 並解壓縮，或使用 `git clone https://github.com/JudyYeh0919/ocr-vocab.git`。
2. 在 Chrome 網址列輸入 `chrome://extensions`。
3. 開啟右上角的 **開發人員模式**。
4. 點 **載入未封裝項目**，選擇專案資料夾（有 `manifest.json` 的那一層）。

## 設定 API Key

1. 到 [Google AI Studio](https://aistudio.google.com/apikey) 免費取得 Gemini API Key。
2. 點瀏覽器工具列上的擴充功能圖示 → **設定 API Key**。
3. 貼上 Key，按 **測試連線**，成功後會自動儲存並選好可用的模型。

## 使用方式

| 動作 | 方法 |
|---|---|
| 開始框選 | `Alt+Shift+O`，或右鍵選單「OCR 選取單字」 |
| 取消框選 / 關閉翻譯 | `Esc` |
| 開啟單字本 | 點擴充功能圖示 → **開啟單字列表** |
| 修改快捷鍵 | `chrome://extensions/shortcuts` |

> `chrome://` 開頭的頁面與 Chrome 線上應用程式商店不允許擴充功能執行，這些頁面無法使用框選。

## 專案結構

```
manifest.json         擴充功能設定
background.js         背景程式：快捷鍵、右鍵選單、截圖裁切、呼叫 Gemini
content/overlay.js    注入網頁的框選介面與翻譯浮窗
lib/gemini.js         Gemini API 呼叫與模型清單
lib/storage.js        單字與設定的儲存
popup/                點擊擴充圖示後的面板
words/                單字本頁面
options/              設定頁面
icons/                圖示
```

## 版本紀錄

- **v1.0.0**：第一版。框選辨識翻譯、單字本（置頂 / 刪除 / 搜尋）、設定頁可自動載入可用模型。
