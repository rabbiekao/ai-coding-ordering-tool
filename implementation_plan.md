# 新增功能：客製化選單項目

為了解決手搖飲或是便當店常有的客製化需求（如甜度、冰塊、加飯等），我們將在目前的系統中擴充「客製化選項」的功能。

## User Review Required

> [!IMPORTANT]  
> 為了不讓 Google Sheets 表格結構變得過度複雜，我們建議採用以下簡單的文字格式讓您可以直接在試算表中設定多組分層選項。請確認這樣的使用方式是否符合您的期待！

## Proposed Changes

### 資料庫架構擴充 (`Menu` 工作表)
我們需要在 `Menu` 表格中新增第 5 欄（E 欄）：**「客製選單」**。
設定語法非常直覺：
- 使用 `:` 分隔選項名稱與內容
- 使用 `,` 分隔多個單選項目
- 使用 `|` 分隔不同的選項群組

**範例寫法**：
如果在珍奶的「客製選單」欄位填入：`甜度:正常,少糖,半糖,微糖,無糖 | 冰塊:正常,少冰,微冰,去冰,完全去冰`
（如果沒有客製化選項，留空即可）

### [MODIFY] [index.html](file:///Users/rabbiekao/Documents/Rabbie%20Files/Rabbie%20Coding/2026-vibecoding-camp/ai-coding-ordering-tool/index.html)
- 無需大幅修改，點餐卡片中的自訂選項皆會透過 JavaScript 動態生成。

### [MODIFY] [all.css](file:///Users/rabbiekao/Documents/Rabbie%20Files/Rabbie%20Coding/2026-vibecoding-camp/ai-coding-ordering-tool/all.css)
- 新增下拉式選單 (`<select>`) 與對應標籤 (`<label>`) 的版面樣式，使其匹配原本具備現代感與 RWD 支援的卡片設計。

### [MODIFY] [all.js](file:///Users/rabbiekao/Documents/Rabbie%20Files/Rabbie%20Coding/2026-vibecoding-camp/ai-coding-ordering-tool/all.js)
1. **讀取設定**：讀取 `Menu` 範圍時，從 `A2:D` 擴展至 `A2:E`，並解析第 5 欄的字串。
2. **生成介面**：在繪製點餐卡片時，如果有解析到客製選單，則在「備註輸入框」上方自動為它產生對應數量的下拉式選單。
3. **送出訂單**：按下點餐時，組合這些下拉選單的值（例如：`[半糖][微冰]`），前綴在使用者手動輸入的「備註」前方，最後一起寫入 `Orders` 工作表原本的「備註」欄位內。這樣就不影響已有的 Orders 結構與一鍵複製功能！

## Open Questions

> [!NOTE]  
> 1. 您是否同意在 `Menu` 表的 E 欄增加這項設定格式（`項目:值1,值2 | 項目2:值3...`）？
> 2. 將選出來的客製化項目（甜度/冰塊）合併紀錄到 `Orders` 既有的「備註」欄位，這樣在複製清單時就能一目瞭然，是否符合您的需求呢？
> 3. 目前設計為所有的客製化選項皆為「單選下拉選單（Select）」，如果有需要多選（可複選），實作上會變得較複雜。目前全面採用下拉式單選是否足夠使用？

## Verification Plan
1. 更新設定後，我會調整代碼並請您在試算表加入測試資料（如甜度與冰塊設定）來驗證介面是否正確生成下拉選單。
2. 測試選取不同甜度與備註，點餐後觀察 `Orders` 表格的備註欄是否有確實結合這兩者的資訊。
