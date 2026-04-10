# 公司內部點餐工具 實作計畫

此計畫旨在透過純 HTML5, CSS3, JavaScript 建立公司內部的點餐工具。工具將採用 Google Identity Services 進行登入，並直接串接 Google Sheets API 來作為資料庫。

## User Review Required

> [!IMPORTANT]  
> 為了讓前端程式碼能成功呼叫 Google API，我們需要在 JavaScript 中設定以下兩個重要常數：
> 1. **Google Client ID**: 在 GCP 主控台建立的 OAuth 用戶端 ID。
> 2. **Spreadsheet ID**: 你的 Google 試算表 ID（可以從試算表網址中 `/d/` 到 `/edit` 之間找到）。
> 
> 我會在 `all.js` 的最上方預留這兩個常數供您填寫。若您希望我在產出程式碼時就直接填入，請提供這兩個資訊。

## Proposed Changes

---

### 前端介面與邏輯 (Frontend implementation)

#### [NEW] [index.html](file:///Users/rabbiekao/Documents/Rabbie%20Files/Rabbie%20Coding/2026-vibecoding-camp/ai-coding-ordering-tool/index.html)
- 引入 Google Identity Services API (`https://accounts.google.com/gsi/client`) 以及 Google API Client Library (`https://apis.google.com/js/api.js`)。
- 畫面結構規劃：
  - **登入視圖 (Login View)**: 顯示 Google 登入按鈕。
  - **應用程式視圖 (App View)**:
    - **Header**: 顯示使用者姓名、身分及切換視圖的導覽列。
    - **今日菜單區 (Menu Section)**: 讓一般成員點餐。
    - **訂單確認區 (Orders Section)**: 彙整今日訂單，提供一鍵複製至 LINE 的功能。
    - **管理員專區 (Admin Section)**: 僅管理員可見。提供設定今日餐廳、清空今日點餐的按鈕。

#### [NEW] [all.css](file:///Users/rabbiekao/Documents/Rabbie%20Files/Rabbie%20Coding/2026-vibecoding-camp/ai-coding-ordering-tool/all.css)
- **現代化設計**: 採用深淺色皆宜的現代色系（預計為主色系：藍紫色配上簡潔白底）。
- **RWD (響應式設計)**: 確保在手機與電腦版皆有良好的瀏覽體驗。
- **UI 元件**:
  - 卡片式選單與餐點呈現。
  - 清楚的按鈕設計（以紅色特別標註危險操作如：「清空今日點餐」）。
  - 微動畫（Hover 效果、點擊回饋）。

#### [NEW] [all.js](file:///Users/rabbiekao/Documents/Rabbie%20Files/Rabbie%20Coding/2026-vibecoding-camp/ai-coding-ordering-tool/all.js)
- **變數設定**: 檔案頂端宣告 `CLIENT_ID`, `SPREADSHEET_ID`, `SCOPES` 等常數。
- **Google API 初始化**: 實作 `initTokenClient` 與取得 Access Token 的流程。
- **身分驗證**: 
  - 獲取 Token 後，呼叫 Sheets API 取得 `Users` 表格。
  - 驗證目前登入的 Google 帳戶是否在名單內，並確認權限（管理員 / 一般成員）。
- **功能實作**:
  1. **載入菜單**: 根據管理員在 `TodayConfig` 的設定，自 `Menu` 過濾出今日提供的餐點。
  2. **送出訂單**: 收集餐點資訊，呼叫 API 寫入一橫列至 `Orders` 表格。
  3. **一鍵複製**: 取得今日所有的訂單紀錄格式化為文字，寫入使用者的剪貼簿。
  4. **管理員功能 - 設定餐廳**: 讀取 `Menu` 所有餐廳並讓管理員勾選，複寫 `TodayConfig`。
  5. **管理員功能 - 清空訂單**: 呼叫 API 使用 `batchClear` 刪除 `Orders` 中第二列以下的所有資料。

## Open Questions

> [!NOTE]  
> 1. 您希望目前就由我填入你的 Google Client ID 和 Spreadsheet ID 嗎？還是我先預留空字串給您自行填寫即可？
> 2. `Menu` 中的資料會有很多嗎？在「設定今日餐廳」時，直接使用 checkbox 讓管理員複選是否符合您的期望？
> 3. 目前 Google Login 建議使用 GIS (Google Identity Services) Token Model 讓前端直接拿到 access_token 去呼叫 Google Sheets API。在此架構下，使用者按下「登入」時會彈出 Google 的權限授權視窗，請求對該試算表的存取權（因為您提到「用戶也會另外獲得本試算表的授權」）。這樣是否符合您的期望？

## Verification Plan

### Manual Verification
- **登入與權限**: 使用者點擊登入後，未在列表者應被拒絕；在列表者將依照管理員/一般成員進入不同畫面。
- **點餐流程**: 一般使用者在畫面上點餐，到試算表看 `Orders` 應有對應的資料新增。
- **管理員操作**: 測試設定今日開放餐廳，並檢視 `TodayConfig` 有無被成功覆寫。測試清空訂單，看試算表資料是否只剩表頭。
- **一鍵複製**: 複製後貼上文字編輯器，確認排版易讀、適合在通訊軟體上閱讀。
