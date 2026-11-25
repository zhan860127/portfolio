# 線上市集 Online Market — 開發報告

清嶼手記線上市集的完整實作報告。涵蓋架構決策、資料庫設計、
訂單公平性的保證方式、候補通知機制的設計，以及目前**尚未完成**的部分。

---

## 1. 整體決策

### 1.1 市集訂單與既有購物車訂單刻意分開

既有的 `orders` / `order_items` 是「購物車多品項、匯款後確認」的流程。
市集是「一單一件、先付訂金、人工核對、有候補佇列」，狀態機完全不同。
硬塞進同一張表會讓兩邊的狀態互相污染，因此新增獨立的 `market_orders`。

**既有的 `/products`、`/cart`、`/orders` 完全沒有改動行為。**

### 1.2 市集商品改走資料庫，不走 Google Sheet

既有商品以 Google Sheet 為來源（`server/utils/catalog.ts`）。
市集不能這樣做 —— Sheets API 的讀取配額約每分鐘每使用者 60 次，
開搶瞬間會立刻 429，而且 `values.append` 本身沒有併發安全保證。
市集商品一律存在 Postgres。

### 1.3 全螢幕瀏覽器使用獨立 layout

`layouts/default.vue` 把所有內容包進 `UContainer` 並固定一個置頂導覽列，
會讓全螢幕瀏覽器被限寬、頂部進度條被導覽列蓋住。
因此新增 `layouts/immersive.vue`，由頁面自己填滿視窗。

### 1.4 品牌色

`app.config.ts` 原本設 `primary: 'green'`（Tailwind 內建綠），註解寫的是「如 #a7be8c」。
現在於 `app/assets/css/main.css` 的 `@theme` 定義 `--color-brand-*`，
其中 **500 就是 `#a7be8c` 本身**，並把 `primary` 指向 `brand`。
這會讓全站的 primary 元件改用真正的品牌色，不再是近似的綠。

---

## 2. 資料庫設計

Migration：`server/database/migrations/0001_online_market.sql`（純新增，不改既有表結構，
唯一的例外是 `users` 新增一個有預設值的 `role` 欄位）。

後續：`0002_shipping_requests.sql` 新增寄貨單（一個 enum、一張表，
以及 `market_orders` 一個可為 NULL 的 `shipping_request_id`）。
**已套用在本機開發資料庫；Vercel 上的 Neon 還沒跑。**

| 表 | 用途 |
|---|---|
| `markets` | 活動：起訖時間、狀態、訂金期限、候補窗口長度 |
| `market_products` | 商品：價格、**每件獨立的訂金**、圖片與規格（jsonb）、狀態、排序 |
| `market_orders` | 訂單：一單一件，金額與名稱快照 |
| `payment_submissions` | 匯款資料：末五碼、金額、時間、備註 |
| `product_follows` | 追蹤 |
| `waitlist_entries` | 候補：狀態、通知時間、優先購買窗口截止時間 |
| `shipping_requests` | 寄貨單：7-ELEVEN 貨到付款的收件資訊與金額快照（見 `docs/shipping.md`） |
| `audit_logs` | 管理員操作紀錄 |

### 2.1 訂單公平性的根基：三個唯一約束

```sql
-- 一件商品最多只能有一筆「未取消」的訂單
CREATE UNIQUE INDEX market_orders_one_active_per_product_idx
  ON market_orders (product_id) WHERE status <> 'cancelled';

-- 同一人對同一件商品只能有一筆「進行中」的候補
CREATE UNIQUE INDEX waitlist_entries_active_user_product_idx
  ON waitlist_entries (user_id, product_id) WHERE status in ('waiting', 'notified');

-- 不能重複追蹤
CREATE UNIQUE INDEX product_follows_user_product_idx
  ON product_follows (user_id, product_id);
```

候補用 partial index 而不是整表唯一，是為了讓「取消後可以重新加入（排到隊尾）」仍然成立。

### 2.2 候補順位不存欄位

順位一律以 `created_at` 排序即時計算（`waitlistPosition()`）。
存 `position` 欄位的話，任何一筆取消都要把後面整串重編號，併發下必然算錯。

---

## 3. 下單的併發設計

`server/utils/marketOrders.ts` 的 `reserveProductAndCreateOrder()`：

```ts
// 1. 條件式 UPDATE 搶保留權，搶輸的人 affected rows = 0
UPDATE market_products SET status = 'reserved'
WHERE id = $1 AND status = 'available'

// 2. 同一個 transaction 內建立訂單，撞到 partial unique index 一樣失敗
```

兩層保護都由資料庫負責：

- 條件式 UPDATE 會在 transaction 結束前鎖住該列，併發請求自然排隊，不需要 Redis。
- 就算有人繞過這個函式直接 insert，partial unique index 仍然擋得住。

**這段刻意抽離 event handler**，因為「同一件商品只能有一筆有效訂單」必須用真實併發驗證，
而 h3 handler 需要完整的 event 才能呼叫。測試見 `tests/db/market-orders.spec.ts`。

---

## 4. 候補通知與優先購買窗口（需求 10 要求在報告中提出設計）

需求明確要求：**不可自行假設通知後商品會自動保留給第一順位**。採用的設計是：

### 4.1 機制

1. 管理員在後台對某件**已回到「開放選購」**的商品按「通知候補者」，可指定人數與窗口長度。
2. 系統取佇列最前面 N 筆 `waiting`，改為 `notified`，
   並寫入 `window_expires_at = now + 窗口長度`。
3. 窗口有效期間，**這件商品只接受被通知者下單**；其他人（含未登入者）的
   `canPurchase` 為 `false`，畫面顯示「候補優先購買時段」。
4. 窗口到期後自動失效，商品回到所有人都能買的狀態 —— **不需要排程回收**，
   因為窗口是用時間戳即時判斷的（`resolvePriorityWindow()`）。
5. 被通知者下單成功時，他的候補紀錄自動標記為 `converted`。

### 4.2 為什麼這樣設計

- **不自動建立訂單、不把商品鎖在任何人名下** —— 符合需求的明確限制。
  （後台「取消並釋放商品」是唯一的例外，理由見 4.4。）
- 但順位仍然有實質意義：第一順位在窗口內是唯一能買的人。
- 窗口長度可在**活動層級設定**（`markets.waitlist_window_hours`，預設 24 小時），
  也可以在每次通知時單獨覆寫。
- 窗口過期不需要任何背景工作介入，少一個會出錯的元件。

### 4.3 商品售出後

`confirm_sold` 會把該商品既有的 `waiting` / `notified` 候補一併標記為 `expired`（需求 10.2）。
若活動或商品設定允許「已售完仍可候補」，使用者可以重新加入，形成新的佇列。

### 4.4 取消並釋放時直接保留給第一順位（刻意偏離 4.2）

4.2 說「不自動建立訂單、不把商品鎖在任何人名下」。後台的**取消並釋放商品**
是唯一的例外：這條路徑會直接把作品保留給候補第一順位並建立他的訂單
（`promoteFirstWaitlistEntry()`）。

需要先區分兩條路徑：需求的限制講的是**通知之後**不可以假設商品會自動保留給
第一順位，而「通知 → 優先購買窗口」那條路徑仍然完全照 4.1 實作，一行都沒改。
偏離的只有管理員手動取消並釋放這一條。

#### 為什麼偏離

直接原因是 10.1：**候補通知沒有實際寄送管道**。沒有通知可收的時候，
「限時優先購買窗口」對當事人等於不存在 —— 他不會知道窗口開了，
窗口到期後作品就落到剛好在重新整理的人手上，順位形同虛設。

在還沒有寄送管道的前提下，兩個選項是：

| 做法 | 候補者實際拿到作品的機率 | 代價 |
|---|---|---|
| 開窗口等他自己發現 | 取決於他有沒有剛好登入看 `/me` | 順位沒有實質保障 |
| 直接保留給他 | 確定拿到 | 收到一筆自己沒按過的訂單 |

選了後者：順位有保障比較接近候補的本意。

**接上寄送管道之後應該重新評估這個決定。** 有通知可收時，窗口的設計其實
更尊重當事人意願 —— 現在的做法會讓訂金期限在他不知情的情況下開始倒數。

#### 實作上的注意事項

- 保留和取消在**同一個 transaction** 內完成，商品不會出現對外可見的
  「開放選購」瞬間，所以沒有別人搶先下單的空檔。
- 活動已結束（`isMarketPurchasable()` 為 false）時不會自動保留，
  避免在已關閉的活動裡生出新訂單。
- 第二順位之後的人維持 `waiting`，不受影響。
- 自動保留會額外寫一筆 `waitlist.promote` 稽核紀錄，和釋放那筆分開記。
- 商品在這之前就被別人搶走時回 `null`，候補紀錄保持原狀，之後還能再通知他。

---

## 5. 待付訂金流程（需求 9）

```
送出訂單 → pending_deposit（商品 reserved）
    ↓ 使用者填寫末五碼
payment_submitted（商品仍然 reserved）
    ↓ 管理員比對銀行實際入帳
deposit_confirmed（商品仍然 reserved）
    ↓ 管理員確認售出
completed（商品 sold，候補佇列結束）
```

**關鍵保證**：`canAdminTransition()` 不允許 `payment_submitted → completed`。
「確認訂金入帳」與「確認售出」是兩個獨立的人工動作，必須分兩步、留下兩筆稽核紀錄。
使用者自己填的末五碼永遠不會讓訂單自動前進。

---

## 6. 手勢設計（需求 5）

### 6.1 單一手勢來源

整個瀏覽器只有 `MarketStoryViewer` 監聽 pointer 事件。
`MarketZoomImage` 不自己監聽，而是暴露 `applyPinch()` / `pan()` / `toggleZoom()` 方法由上層呼叫。
兩個元件各自搶 pointer 事件正是手勢打架最常見的成因。

### 6.2 優先權（`app/utils/gestures.ts`）

1. **兩指以上** → 交給縮放，裁決器不介入
2. **照片已放大** → 單指拖曳一律是移動照片，絕不切換商品
3. **快照列表開啟** → 左右只捲動列表、向下關閉
4. **其餘** → 左右切換商品、向上開啟列表

斜向滑動（主軸未超過副軸 1.2 倍）一律不處理，避免同時觸發兩個動作。
點擊區左右各 30%，**中間 40% 留空**，不會蓋到底部的追蹤與購買按鈕。

### 6.3 瀏覽器預設行為

`.market-gesture-surface` 下 `touch-action: none` 與 `overscroll-behavior: contain`，
避免 iOS Safari 的邊緣返回與捲頁。快照列表的縮圖列改用 `touch-action: pan-x`，
走原生水平捲動，事件不會冒泡到手勢層。

---

## 7. 需要你設定的項目

### 7.1 執行 migration

```powershell
pnpm run db:migrate
```

### 7.2 設定第一位管理員

在環境變數加入（逗號分隔可多人）：

```
ADMIN_EMAILS=you@example.com
```

這些信箱**下次登入時**會自動被提權成 `admin`。
從 `ADMIN_EMAILS` 移除**不會**自動降權 —— 否則改個環境變數就能無聲踢掉既有管理員。
降權請直接改 DB 的 `users.role`。

### 7.3 填寫匯款帳戶

`app/app.config.ts` 的 `market.bank`，目前是空白佔位值：

```ts
market: {
  bank: {
    bankName: '請於後台設定銀行名稱',
    bankCode: '',
    accountName: '清嶼手記',
    accountNumber: '',
    note: '...'
  }
}
```

### 7.4 建立第一場活動

登入後從右上角的齒輪進入 `/admin/market` → 新增活動 → 新增作品 → 上架。

### 7.5 本機開發用的資料庫

`.env` 原本沒有 `DATABASE_URL`，市集沒有資料庫就跑不起來。
本機開發建議用一個拋棄式的 Postgres 容器，不要指向 Vercel 上的正式資料庫：

```powershell
docker run -d --name tranquil-market-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=market -p 55432:5432 postgres:17-alpine
```

`.env` 已加入對應的連線字串（port 55432，不會撞到既有服務）：

```
DATABASE_URL=postgres://postgres:devpass@127.0.0.1:55432/market
DATABASE_URL_UNPOOLED=postgres://postgres:devpass@127.0.0.1:55432/market
ADMIN_EMAILS=donlin_zhan@tutk.com
```

容器重建後資料會清空，重跑 `pnpm run db:migrate` 即可。

同一個容器裡另外開了一個 `market_test` 給 `pnpm run test:db` 用，
跟開發用的 `market` 分開，測試寫進去的資料不會出現在後台：

```powershell
docker exec tranquil-market-db psql -U postgres -c "CREATE DATABASE market_test"
```

容器沒跑的時候 `pnpm run db:migrate` 會是 `ECONNREFUSED 127.0.0.1:55432`，
先 `docker start tranquil-market-db` 再跑。

---

## 8. 商業規則（已與你確認）

| 規則 | 決定 |
|---|---|
| 管理員身分 | `users.role` 欄位 + `ADMIN_EMAILS` 環境變數種子 |
| 訂金金額 | **每件商品個別設定**（`market_products.deposit_cents`） |
| 逾期未付訂金 | **只標記逾期，商品仍保留**，由管理員手動取消才釋放 |
| 同時保留件數 | **不限制** |
| 候補通知 | 不自動保留，改用限時優先購買窗口（見第 4 節） |
| 取消並釋放 | **直接保留給候補第一順位**，刻意偏離上一條（見 4.4） |
| 末五碼 | 僅轉為「待人工核對」，必須管理員確認入帳 |

### 逾期的實作方式

因為選擇「只標記、等人工」，所以**不需要任何排程**：
後台訂單列表會即時算出 `overdue` 旗標（`expires_at < now` 且仍在 `pending_deposit`），
標紅顯示，管理員再決定要「標記逾期」或「取消並釋放商品」。

---

## 9. 測試

```powershell
pnpm run test
```

| 專案 | 內容 | 數量 |
|---|---|---|
| `unit` | 手勢裁決、縮放數學、訂單狀態機、候補與寄貨單規則 | 93 |
| `nuxt` | 元件渲染與互動（Nuxt runtime） | 64 |
| `db` | 真實 Postgres 的併發與唯一約束 | 17（沒設連線時跳過） |

資料庫整合測試需要指向一個**可以被清空的測試資料庫**。
開發容器裡已經另外開了一個 `market_test`，與開發用的 `market` 分開，
測試資料不會混進你平常在後台看到的內容：

```powershell
$env:DATABASE_URL_TEST = "postgres://postgres:devpass@127.0.0.1:55432/market_test"; pnpm run test:db
```

這 17 個測試全部實際跑過並通過（含兩次連續執行，確認清理是冪等的）。

### 24 個測試項目的覆蓋對照

| # | 項目 | 覆蓋方式 |
|---|---|---|
| 1 | 首頁入口 | `tests/nuxt/market-pages.spec.ts` |
| 2 | 活動列表 | `tests/nuxt/market-pages.spec.ts` |
| 3 | 活動詳情 | `tests/nuxt/story-viewer.spec.ts` |
| 4 | 左右滑動切換 | `tests/unit/gestures.spec.ts` |
| 5 | 點擊左右區域 | `tests/unit/gestures.spec.ts` |
| 6 | 雙指縮放 | `tests/unit/zoom.spec.ts`（數學層）⚠️ |
| 7 | 放大後拖曳不誤切 | `tests/unit/gestures.spec.ts` + `zoom.spec.ts` |
| 8 | 上滑開啟列表 | `tests/unit/gestures.spec.ts` |
| 9 | 列表左右滑動 | `tests/unit/gestures.spec.ts` |
| 10 | 點縮圖跳轉 | `tests/nuxt/snapshot-sheet.spec.ts` |
| 11 | 關閉後回到正確商品 | `tests/nuxt/snapshot-sheet.spec.ts` |
| 12 | 追蹤 / 取消追蹤 | `tests/nuxt/story-viewer.spec.ts` |
| 13 | 成功送出訂單 | `tests/db` + `tests/unit/market-rules.spec.ts` |
| 14 | 下單者看到待付訂金 | `tests/nuxt/story-viewer.spec.ts` |
| 15 | 其他人看到保留中 | `tests/unit/market-rules.spec.ts` + `story-viewer` |
| 16 | 可以加入候補 | `tests/unit/market-rules.spec.ts` |
| 17 | 不能重複排隊 | `tests/db/market-orders.spec.ts`（唯一約束，已實跑） |
| 18 | **併發只有一筆有效訂單** | `tests/db/market-orders.spec.ts`（真實併發，已實跑） |
| 19 | 末五碼不會自動售完 | `tests/unit/market-rules.spec.ts` |
| 20 | 確認訂金後才能售出 | `tests/unit/market-rules.spec.ts` |
| 21 | 已售完不能購買 | `tests/unit/market-rules.spec.ts` + `story-viewer` |
| 22 | 取消後釋放商品 | `tests/db/market-orders.spec.ts`（有候補時改為直接保留，見 4.4） |
| 23 | 候補通知與窗口 | `tests/unit/market-rules.spec.ts` |
| 24 | 非管理員不能操作後台 | ⚠️ 見下方未完成項目 |

---

## 10. 尚未完成 / 需要你決定的項目

### 10.1 ⚠️ 候補通知沒有實際寄送管道

**這是最大的一個缺口。** 目前實作了通知的**狀態與效力**：
候補紀錄會變成 `notified`、優先購買窗口會生效、使用者在 `/me` 的「我的候補」
看得到「已通知，優先購買至 X」。

但**沒有真的寄出 email 或推播** —— 專案目前完全沒有郵件基礎建設
（沒有 nodemailer / Resend / SendGrid 任何一個），也還沒有決定要用哪個服務。
使用者必須自己回到網站才會看到通知。

要補上的話需要先決定服務商，我可以接著做。

### 10.2 ⚠️ 測試項目 24（非管理員不能執行後台操作）尚未自動化

權限本身**已經實作且是伺服器端強制的**：
所有 `/api/admin/**` 都走 `requireAdminUser()`，非管理員一律回 404。
但要自動化測試這一條，需要能偽造登入 session 的整合測試環境，
這比其他測試多一層設定成本，目前只做到人工驗證。

### 10.3 商品圖片是填網址，不是上傳

後台的作品照片欄位目前是貼圖片網址。專案已經有 Cloudinary 整合
（`server/api/cloudinary.ts`），但現有端點只有列出圖片、沒有上傳。
要做成直接上傳需要新增一個簽名上傳端點。

### 10.4 真實裝置尚未驗證

雙指縮放、iOS Safari 邊緣返回、safe-area 這些都已依規格實作
（pointer events、`touch-action: none`、`env(safe-area-inset-*)`），
但**沒有在真實 iPhone / Android 上測過**。多點觸控在模擬環境裡測不出來。
建議上線前用實機走一次。

### 10.5 已登入的流程尚未實走

下單、填末五碼、加入候補、後台操作都需要 Google 登入，
本機驗證時沒有實際登入（那是你的帳號）。這些路徑有單元與元件測試覆蓋，
但沒有從瀏覽器端到端跑過一次。建議你自己登入後走一遍下單 → 填末五碼 →
後台確認訂金 → 確認售出。

### 10.6 本機實跑時修掉的兩個問題

在瀏覽器實際操作後發現並修正：

1. **底部的追蹤／詳細資訊按鈕是白底白字。** 全站固定 light mode，
   Nuxt UI 的 `neutral` + `outline` 在 light 下底色是白的，
   原本只給了 `text-white` 就看不見了。改成自己指定半透明底
   （`bg-white/10` / `hover:bg-white/20`），不依賴主題配色。
2. **連點右側無法快速翻閱。** 300ms 內的第二下會被判成雙擊縮放，
   停在同一件作品。現在左右點擊區不參與雙擊判定，
   雙擊縮放只在中央區（以及已放大時）生效。已加測試鎖住
   （`tests/nuxt/story-viewer.spec.ts`）。

另外 `AppHeader` 在 375px 寬會溢出畫面（加上「市集」之後更明顯），
已改成不超出視窗、放不下時整列可水平捲動。

### 10.9 ⚠️ 上線前必須拆開 preview 與 production 資料庫

目前 Vercel 的 Preview 與 Production 兩個環境指向**完全同一個 Neon endpoint 與同一個 `neondb`**：

```
preview     ep-sparkling-recipe-bi4af4ru...ap-southeast-1.aws.neon.tech/neondb
production  ep-sparkling-recipe-bi4af4ru...ap-southeast-1.aws.neon.tech/neondb
```

現階段這樣反而方便：在 preview 建好的活動同時就是正式資料，只要建一次。
目前也沒有真實訂單可以被弄髒。

**但在開放收單之前一定要拆開。** 否則 preview 上的一筆測試訂單會混進真實訂單，
而且後台按「確認售出」會把一件真的作品標成已售完。

做法（擇一）：

- **一條長期的 `preview` branch**：Neon dashboard 從 `main` 建分支，
  再把 Vercel Preview 環境的 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 改指向它。
  注意之後 `main` 的新 migration 不會自動同步到這條分支，要單獨跑或砍掉重建。
- **每個 preview 部署自動開 branch**：Neon 的 Vercel integration 內建選項，
  每次從 `main` 複製，schema 自動跟上，但對單人開發是多餘的複雜度。

改完都要重新部署才生效（Vercel 的環境變數是部署當下綁定的）。

### 10.7 既有程式碼的 lint 問題

`pnpm run lint` 目前仍然失敗，但**失敗的都是這次沒有動到的既有檔案**：
`app/app.vue`、`app/components/landing/Hero.vue`、`app/pages/orders.vue`、
`app/pages/privacy.vue`、`app/pages/products/*`、`app/stores/cloudinary.ts`、
`app/stores/product.ts`、`nuxt.config.ts`、`server/api/cloudinary.ts`、
`server/api/folder/[folder].ts`。

這次新增與修改的檔案全部通過 lint。沒有一併 `lint:fix` 全專案，
是因為其中幾個是你正在編輯中的未提交檔案，自動重排會造成無謂的衝突。
需要的話跑 `pnpm run lint:fix` 即可，都是純樣式規則。

### 10.8 順帶修掉的既有錯誤

`pnpm run typecheck` 在這次開工前就有 7 個錯誤，已一併修正：

- `app/components/AppHeader.vue` — session `User` 型別是空物件（新增 `auth.d.ts` 模組擴充）
- `app/components/landing/Mappage.vue` — 對自動匯入元件用 `typeof` 取型別
- `app/pages/cart.vue` — `Product.id` 是 string 但函式簽名寫 number、`item.image` 是陣列卻當字串用
- Nuxt UI v4 的 `color="gray"` / `color="red"` 已更名為 `neutral` / `error`

---

### 10.10 第一次實跑資料庫測試揪出的既有 bug

`tests/db` 這組測試一直沒有真的跑過（本機沒有 Postgres）。
開了開發容器、第一次實際執行之後，10 個測試有 3 個失敗，而且是同一個原因：

`server/utils/marketOrders.ts` 的 `isUniqueViolation()` 只比對最外層的
`error.code`，但 **Drizzle 從 0.44 起會把驅動的錯誤包進 `DrizzleQueryError`**，
真正帶著 SQLSTATE `23505` 的 `PostgresError` 掛在 `cause` 上，
所以這個函式在這個版本永遠回 false。

實際後果：`reserveProductAndCreateOrder()` 撞到 partial unique index 時，
不會回傳 `{ ok: false, reason: 'taken' }`，而是把例外往外丟 ——
客人看到的是 500 而不是「有人剛剛搶先一步，可以加入候補」。
（平常的競態由條件式 UPDATE 擋住，所以這條路是第二層防線，影響範圍有限，
但程式碼的原意是壞的。）

已修正成沿著 `cause` 往下找，三個測試隨即通過。

---

## 11. 檔案清單

### 新增

```
server/database/migrations/0001_online_market.sql
server/database/migrations/0002_shipping_requests.sql
server/utils/market.ts            純邏輯：狀態推導、權限判斷、序列化
server/utils/marketData.ts        viewer context 組裝（避免 N+1）
server/utils/marketOrders.ts      搶保留權（可測試的併發核心）
server/utils/shipping.ts          寄貨單的純邏輯：金額、收件資訊驗證、狀態轉換
server/utils/admin.ts             requireAdminUser
server/utils/audit.ts             操作紀錄
server/api/market/**              前台 API（活動、商品、訂單、追蹤、候補）
server/api/admin/market/**        後台 API
server/api/me.get.ts              目前登入者的權威 role

app/utils/gestures.ts             手勢裁決（純函式）
app/utils/zoom.ts                 縮放數學（純函式）
app/stores/market.ts
app/composables/useGuestFollows.ts
app/middleware/admin.ts
app/layouts/immersive.vue
app/components/market/            MarketEntry / StoryViewer / ZoomImage /
                                  SnapshotSheet / ProductDetail / BankInfo /
                                  ShippingForm
app/pages/market/                 index.vue、[marketId].vue
app/pages/me.vue
app/pages/admin/market/           index.vue、[marketId].vue、orders.vue、shipping.vue

tests/unit/、tests/nuxt/、tests/db/
                                  （含 shipping-rules / shipping-form / db 的 shipping）
vitest.config.ts
auth.d.ts
```

### 修改

| 檔案 | 改動 |
|---|---|
| `server/database/schema.ts` | 新增 7 張表 + `users.role`；之後再加 `shipping_requests` 與 `market_orders.shipping_request_id` |
| `server/utils/user.ts` | 依 `ADMIN_EMAILS` 提權（只升不降） |
| `server/routes/auth/google.get.ts` | session 帶入 `role` |
| `app/pages/index.vue` | 以具名插槽把市集入口放進 Hero 的 logo 正下方 |
| `app/components/landing/Hero.vue` | 新增 `afterLogo` 插槽；沒有傳插槽時版型與原本完全一致 |
| `app/components/AppHeader.vue` | 市集連結、個人頁、後台入口 |
| `app/pages/me.vue` | 新增「寄貨單」分頁 |
| `server/utils/audit.ts` | 新增 `shipping.*` 操作紀錄 |
| `server/utils/marketOrders.ts` | 修正 `isUniqueViolation()` 沒有穿透 `DrizzleQueryError` 的 bug（見 10.10） |
| `app/app.config.ts` | `primary: 'brand'`、匯款資訊 |
| `app/assets/css/main.css` | 品牌色 token、safe-area、手勢與動畫類別 |
| `package.json` | 測試指令與相依 |
| `.github/workflows/ci.yml` | CI 加跑測試 |
| `app/components/landing/Mappage.vue`、`app/pages/cart.vue` | 修既有 typecheck 錯誤 |
