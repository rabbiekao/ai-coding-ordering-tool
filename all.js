/**
 * 全域常數設定
 * 來自使用者的 Google Client ID 與 Spreadsheet ID
 */
const CLIENT_ID = '1077270862460-acnr3pkogakm5qjuj156qvu5142atrc9.apps.googleusercontent.com';
const SPREADSHEET_ID = '1qRULp8mhgaYubCBSfs0AD0mA4bGVOj28UEQSTiBjE0k';
// 我們需要存取試算表，以及獲取使用者的 email
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email';

/**
 * 狀態管理
 */
let tokenClient;
let accessToken = null;
let currentUser = {
    email: null,
    name: null,
    role: null // "管理員" 或 "一般成員"
};
// 暫存資料
let todayConfigList = []; // ["50嵐", "梁社漢"]
let fullMenuData = []; // [{ restaurant: '50嵐', name: '珍奶', price: '60', category: '飲品' }]
let ordersData = []; // 今日訂單紀錄

/**
 * 初始化 Google API 與 Token Client
 */
window.onload = function() {
    // 確保留在登入頁
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('app-view').classList.add('hidden');

    // 實例化 GIS Token Client
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                document.getElementById('loading-msg').classList.remove('hidden');
                document.getElementById('login-error').classList.add('hidden');
                
                // 開始系統初始化流程
                await initApp();
            }
        },
    });
};

/**
 * 觸發登入
 */
function handleLogin() {
    if (!tokenClient) return;
    // prompt: '' 讓使用者選擇帳號並授權
    tokenClient.requestAccessToken({ prompt: '' });
}

/**
 * 登出
 */
function handleLogout() {
    // 移除 Token
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Token revoked.');
        });
    }
    accessToken = null;
    currentUser = { email: null, name: null, role: null };
    
    // 切換視圖
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('loading-msg').classList.add('hidden');
}

/**
 * 系統初始化
 * 1. 初始化 gapi client
 * 2. 獲取使用者 email
 * 3. 驗證權限
 * 4. 載入資料
 */
async function initApp() {
    try {
        // 1. 初始化 gapi
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        gapi.client.setToken({ access_token: accessToken });

        // 2. 透過 OAuth API 取得使用者 Email
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userInfo = await userInfoRes.json();
        const userEmail = userInfo.email;

        if (!userEmail) {
            throw new Error("無法取得 Google 帳號 Email");
        }

        // 3. 取得 Users 表並驗證
        const usersResp = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Users!A2:C', // 假設 A:姓名 B:Email C:權限
        });
        const usersRows = usersResp.result.values || [];
        
        let foundUser = null;
        for (const row of usersRows) {
            if (row[1] && row[1].toLowerCase() === userEmail.toLowerCase()) {
                foundUser = {
                    name: row[0],
                    email: row[1],
                    role: row[2]
                };
                break;
            }
        }

        if (!foundUser) {
            showLoginError("未獲授權：此帳號不在系統名單中。");
            return;
        }

        currentUser = foundUser;
        
        // 4. 初始化介面
        setupUI();
        await loadCoreData();

    } catch (err) {
        console.error('Init App Error:', err);
        showLoginError("系統發生錯誤，或無法存取試算表。請確認是否已授予讀寫權限。");
    }
}

function showLoginError(msg) {
    document.getElementById('loading-msg').classList.add('hidden');
    const errEl = document.getElementById('login-error');
    errEl.innerText = msg;
    errEl.classList.remove('hidden');
}

/**
 * 根據使用者角色隱藏或顯示介面
 */
function setupUI() {
    // 填寫基本資料
    document.getElementById('user-display-name').innerText = currentUser.name;
    const roleBadge = document.getElementById('user-role');
    roleBadge.innerText = currentUser.role;
    roleBadge.className = currentUser.role === '管理員' ? 'badge badge-admin' : 'badge badge-user';

    // 判斷是否為管理員，決定是否顯示管理區塊
    const isAdmin = currentUser.role === '管理員';
    if (isAdmin) {
        document.getElementById('admin-config-section').classList.remove('hidden');
        document.getElementById('admin-danger-section').classList.remove('hidden');
    } else {
        document.getElementById('admin-config-section').classList.add('hidden');
        document.getElementById('admin-danger-section').classList.add('hidden');
    }

    // 切換視圖
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
}

/**
 * 核心資料載入 (Menu, Config, Orders)
 */
async function loadCoreData() {
    try {
        // 批次取得這三張表，提升效能
        const resp = await gapi.client.sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ['TodayConfig!A2:A', 'Menu!A2:E', 'Orders!A2:F']
        });

        const valRanges = resp.result.valueRanges;
        
        // 解析 TodayConfig
        const configRows = valRanges[0].values || [];
        todayConfigList = configRows.map(row => row[0]).filter(Boolean);
        
        document.getElementById('today-restaurants-label').innerText = todayConfigList.length > 0 
            ? `本日提供：${todayConfigList.join(' , ')}` 
            : '本日尚未設定餐廳。';

        // 解析 Menu
        const menuRows = valRanges[1].values || [];
        fullMenuData = menuRows.map(row => ({
            restaurant: row[0] || '',
            name: row[1] || '',
            price: row[2] || '0',
            category: row[3] || '',
            options: row[4] || ''
        }));

        // 渲染管理員餐廳勾選功能
        if (currentUser.role === '管理員') {
            renderAdminCheckboxes();
        }

        // 渲染點餐卡片
        renderMenuCards();

        // 解析並渲染訂單
        ordersData = valRanges[2].values || [];
        renderOrders();

    } catch (err) {
        console.error('Load Data Error:', err);
        alert('取得資料失敗！');
    }
}

/**
 * 管理員：渲染下拉清單提供設定
 */
function renderAdminCheckboxes() {
    const container = document.getElementById('restaurant-checkboxes');
    container.innerHTML = '';
    
    // 找出所有獨立的餐廳名稱
    const uniqueRes = [...new Set(fullMenuData.map(item => item.restaurant).filter(Boolean))];

    uniqueRes.forEach(res => {
        const checked = todayConfigList.includes(res) ? 'checked' : '';
        const id = `chk-${res}`;
        container.innerHTML += `
            <label class="checkbox-label" for="${id}">
                <input type="checkbox" id="${id}" value="${res}" ${checked}>
                ${res}
            </label>
        `;
    });

    // 若沒有任何餐廳
    if (uniqueRes.length === 0) {
        container.innerHTML = '<p class="text-sm text-muted">尚未在 Menu 建立任何餐廳！</p>';
    }
}

/**
 * 儲存今日餐廳設定
 */
async function saveTodayConfig() {
    const btn = document.getElementById('btn-save-config');
    btn.disabled = true;
    btn.innerText = '儲存中...';

    try {
        // 收集勾選的餐廳
        const inputs = document.querySelectorAll('#restaurant-checkboxes input[type="checkbox"]:checked');
        const selected = Array.from(inputs).map(inp => [inp.value]);
        
        // 1. 先清空整個 A 欄 (清除舊設定) - 簡單做法是寫入很多空字串，或使用 batchClear
        await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'TodayConfig!A2:A'
        });

        // 2. 如果有選擇，則寫入
        if (selected.length > 0) {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'TodayConfig!A2',
                valueInputOption: 'USER_ENTERED',
                resource: { values: selected } // array of arrays
            });
        }

        // 顯示成功並重整資料
        const msg = document.getElementById('admin-config-msg');
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
        
        await loadCoreData(); // 重新讀取套用設定
    } catch (err) {
        console.error("Save config error:", err);
        alert('儲存失敗！');
    } finally {
        btn.disabled = false;
        btn.innerText = '儲存設定';
    }
}

/**
 * 一般成員：渲染點餐卡片
 */
function renderMenuCards() {
    const container = document.getElementById('menu-grid');
    container.innerHTML = '';

    // 篩選出今日有開放的餐點
    const availableItems = fullMenuData.filter(item => todayConfigList.includes(item.restaurant));

    if (availableItems.length === 0) {
        container.innerHTML = '<p class="text-muted">目前沒有可供應的餐點。請聯絡管理員設定。</p>';
        return;
    }

    availableItems.forEach((item, index) => {
        let optionsHTML = '';
        if (item.options) {
            // 支援半形或全形的 | ｜
            const groups = item.options.split(/[|｜]/).map(s => s.trim());
            groups.forEach((g, gIndex) => {
                // 支援半形或全形的 : ：
                const parts = g.split(/[:：]/);
                if (parts.length >= 2) {
                    const groupName = parts[0].trim();
                    // 支援半形或全形的 , ，
                    const choices = parts[1].split(/[,，]/).map(c => c.trim());
                    
                    let opts = choices.map(c => `<option value="${c}">${c}</option>`).join('');
                    optionsHTML += `
                        <div class="custom-option-group">
                            <label class="custom-option-label">${groupName}</label>
                            <select id="option-${index}-${gIndex}" class="custom-option-select">
                                ${opts}
                            </select>
                        </div>
                    `;
                }
            });
        } else if (item.category && (item.category.includes('飲') || item.category === '茶' || item.category === '咖啡')) {
            // 如果試算表沒有特別設定，但分類被標記為「飲品」，則自動提供預設的糖冰下拉選單
            optionsHTML += `
                <div class="custom-option-group">
                    <label class="custom-option-label">甜度</label>
                    <select id="option-${index}-sugar" class="custom-option-select">
                        <option value="正常糖">正常糖</option>
                        <option value="少糖">少糖</option>
                        <option value="半糖">半糖</option>
                        <option value="微糖">微糖</option>
                        <option value="無糖">無糖</option>
                    </select>
                </div>
                <div class="custom-option-group">
                    <label class="custom-option-label">溫度</label>
                    <select id="option-${index}-ice" class="custom-option-select">
                        <option value="正常冰">正常冰</option>
                        <option value="少冰">少冰</option>
                        <option value="微冰">微冰</option>
                        <option value="去冰">去冰</option>
                        <option value="溫的">溫的</option>
                        <option value="熱的">熱的</option>
                    </select>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'menu-item-card';
        card.innerHTML = `
            <div class="menu-item-header">
                <div>
                    <div class="menu-item-title">${item.name} <span class="badge" style="background:#E5E7EB; color:#4B5563;">${item.category}</span></div>
                    <div class="menu-item-res">${item.restaurant}</div>
                </div>
                <div class="menu-item-price">$${item.price}</div>
            </div>
            ${optionsHTML}
            <input type="text" id="note-${index}" class="menu-item-input" placeholder="加註備註 (例如：少飯、微糖少冰等)">
            <button class="btn btn-primary" style="margin-top:auto;" onclick="submitOrder(${index}, '${item.restaurant}', '${item.name}', '${item.price}')">
                點 餐
            </button>
        `;
        container.appendChild(card);
    });
}

/**
 * 點餐並寫入 Records
 */
async function submitOrder(index, restaurant, itemName, price) {
    const noteEl = document.getElementById(`note-${index}`);
    const noteVal = noteEl ? noteEl.value.trim() : '';

    // 處理下拉式選單的客製化項目
    const optSelects = document.querySelectorAll(`select[id^="option-${index}-"]`);
    let combinedOptions = "";
    optSelects.forEach(select => {
        combinedOptions += `[${select.value}]`;
    });
    
    let finalNote = combinedOptions;
    if (combinedOptions && noteVal) {
        finalNote += " " + noteVal;
    } else if (noteVal) {
        finalNote = noteVal;
    }
    
    // 取得當前時間 yyyy/mm/dd hh:mm
    const now = new Date();
    const timeStr = now.getFullYear() + '/' + 
        String(now.getMonth()+1).padStart(2, '0') + '/' + 
        String(now.getDate()).padStart(2, '0') + ' ' + 
        String(now.getHours()).padStart(2, '0') + ':' + 
        String(now.getMinutes()).padStart(2, '0');

    // 寫入 Orders 工作表：[點餐時間, 訂購人 Email, 餐廳名稱, 餐點內容, 金額, 備註]
    // 為了避免 Google 試算表把日期解析成浮點數序號，我們前面加上單引號強制存為文字
    const rowData = ["'" + timeStr, currentUser.email, restaurant, itemName, price, finalNote];

    try {
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A:F',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData]
            }
        });

        // 提示成功
        showToast();
        if(noteEl) noteEl.value = ''; // 清空輸入框
        
        // 重新讀取訂單以更新畫面
        await loadOrdersOnly();

    } catch (err) {
        console.error("Order submit failed:", err);
        alert('點餐失敗，請重試！');
    }
}

function showToast() {
    const t = document.getElementById('order-success-msg');
    t.classList.remove('hidden');
    setTimeout(() => {
        t.classList.add('hidden');
    }, 3000);
}

/**
 * 單獨重新載入訂單 (優化體驗，不整頁刷)
 */
async function loadOrdersOnly() {
    try {
        const resp = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A2:F'
        });
        ordersData = resp.result.values || [];
        renderOrders();
    } catch(err) {
        console.error(err);
    }
}

/**
 * 渲染訂單表格
 */
function renderOrders() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '';
    let total = 0;

    // 取得今天的日期字串 yyyy/mm/dd，用來過濾？
    // 依據原始需求，會列出"今日餐點列表"，為簡化我們假設 Orders 表內都是今天的資料（因為管理員每天會清空）。
    // 或著可以藉用時間字串的第一段。這裡安全起見我們直接呈現 Orders 內所有資料。

    if (ordersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6B7280;">目前尚無訂單</td></tr>';
        document.getElementById('total-price-span').innerText = '0';
        return;
    }

    // 將資料顛倒排列讓最新的一筆在最前面（選項性，這裡按照輸入順序也可）
    ordersData.forEach(row => {
        // [點餐時間, Email, 餐廳名稱, 餐點內容, 金額, 備註]
        let time = row[0] || '';
        
        // 如果舊資料已經被轉成 Google Sheets 的五萬多數字序號，在這邊動態轉回文字
        if (!isNaN(time) && Number(time) > 40000) {
            const excelDate = Number(time);
            const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
            const yy = date.getUTCFullYear();
            const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(date.getUTCDate()).padStart(2, '0');
            const hh = String(date.getUTCHours()).padStart(2, '0');
            const min = String(date.getUTCMinutes()).padStart(2, '0');
            time = `${yy}/${mm}/${dd} ${hh}:${min}`;
        }
        
        const email = row[1] || '';
        const res = row[2] || '';
        const item = row[3] || '';
        const price = parseInt(row[4] || '0', 10);
        const note = row[5] || '';

        // 為了在 UI 好辨認，我們可以去找對應 email 的姓名
        const tdEmail = email.split('@')[0]; // 若沒時間撈原始姓名，就顯示 email 前綴
        
        total += isNaN(price) ? 0 : price;

        tbody.innerHTML += `
            <tr>
                <td>${time}</td>
                <td>${tdEmail}</td>
                <td>${res}</td>
                <td>${item}</td>
                <td>$${price}</td>
                <td>${note}</td>
            </tr>
        `;
    });

    document.getElementById('total-price-span').innerText = total;
}

/**
 * 一鍵複製今日訂單
 */
function copyOrdersToClipboard() {
    if (ordersData.length === 0) {
        alert('目前無訂單可複製');
        return;
    }

    let text = "【今日點餐清單】\n";
    // 依照餐廳分組
    let grouped = {};
    ordersData.forEach(row => {
        const res = row[2] || '未知餐廳';
        if(!grouped[res]) grouped[res] = [];
        grouped[res].push(row);
    });

    for(let res in grouped) {
        text += `\n🏠 ${res} :\n`;
        let resTotal = 0;
        grouped[res].forEach(row => {
            const email = (row[1] || '').split('@')[0];
            const item = row[3] || '';
            const price = parseInt(row[4] || '0', 10);
            const note = row[5] ? `(${row[5]})` : '';
            resTotal += isNaN(price) ? 0 : price;
            
            text += `- ${email}: ${item} $${price} ${note}\n`;
        });
        text += `> ${res} 小計: $${resTotal}\n`;
    }

    let allTotal = document.getElementById('total-price-span').innerText;
    text += `\n💰 總計: $${allTotal}\n`;

    navigator.clipboard.writeText(text).then(() => {
        const m = document.getElementById('copy-msg');
        m.classList.remove('hidden');
        setTimeout(() => m.classList.add('hidden'), 3000);
    }).catch(err => {
        alert('複製失敗，請手動圈選。');
    });
}

/**
 * 管理員：清空今日點餐 (Orders)
 */
async function clearOrders() {
    const confirmation = confirm("確定要清空所有訂單記錄嗎？此動作將刪除 Orders 表格內的所有點餐資料（不可復原）！");
    if(!confirmation) return;

    try {
        await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            // 僅保留第一行的標題，清除第二行以後的所有行數與列 G
            range: 'Orders!A2:Z'
        });

        alert("🗑️ 已成功清空所有點餐紀錄！");
        await loadOrdersOnly();

    } catch(err) {
        console.error("Clear error:", err);
        alert("清空失敗。");
    }
}
