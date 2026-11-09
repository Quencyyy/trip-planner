# 旅遊計劃（trip-planner）

把行程放在 Git 上的靜態網頁。點網址就能看，只有編輯需要 GitHub 權杖。

## 頁面

| 網址 | 內容 |
|---|---|
| `#/` | 旅程列表 |
| `#/t/<id>`、`#/t/<id>/day/<日期>` | 行程，一次一天，用日期標籤切換；旅行中預設今天 |
| `#/t/<id>/book` | 待訂／已訂 |
| `#/t/<id>/money` | 記帳總覽：信用卡／現金合計、分帳、台幣換算 |
| `#/t/<id>/before`、`/after` | 出發前／回國清單（大標摺疊，打勾只記在這台裝置） |
| `#/edit`、`#/edit/<id>` | 新增行程；拖拉排序、跨天移動、依時間排序、設定匯率 |
| `#/settings` | 貼 GitHub 權杖 |

## 資料

- `public/data/index.json`：行程列表
- `public/data/trips/<id>.json`：每趟行程。`guide` 指定清單、`twdRate` 是固定匯率（不填就用即時匯率）
- `public/data/guides/<名稱>.json`：出發前／回國清單內容（目前有 `japan`）

## 儲存方式

- 編輯頁：整趟行程用 GitHub Contents API 寫回 repo，GitHub Actions 重新部署，約 1～2 分鐘後網站更新
- 記帳：在行程頁每個項目下按「＋ 記帳」，選信用卡或現金，馬上存到 GitHub。只有貼過權杖的裝置看得到記帳按鈕
- 有權杖的裝置直接讀 GitHub 上最新的資料，不用等網站更新

## 分帳

兩人各用一種方式付：一人刷卡、一人付現。記帳分頁會算出兩邊各付多少，各付一半的話誰要給誰多少。

## 離線

- 打開過一次之後，沒網路也能看行程（瀏覽器會留一份最後看到的資料）
- 沒網路時不能記帳，會顯示錯誤，不會默默遺失
- 台幣換算用 open.er-api.com 的公開匯率（每台裝置 12 小時抓一次），也可以在編輯頁固定一個匯率

## 第一次設定（只做一次）

1. 在 GitHub 建立 **public** repo（例如 `trip-planner`），把這個資料夾推上去
2. repo → Settings → Pages → Source 選 **GitHub Actions**
3. 等 Actions 跑完，網址是 `https://<帳號>.github.io/<repo>/`
4. 建立權杖：GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
   - Repository access：Only select repositories → 選這個 repo
   - Permissions：**Contents: Read and write**
   - 期限自己決定（到期後重新產生、重新貼上即可）
5. 在網站的「編輯 → 設定」貼上權杖，按「測試並儲存」。每台要編輯的裝置各貼一次

## 注意

- repo 是公開的：行程、飯店、記帳金額，任何人在 GitHub 上都看得到。不要寫訂位代號、護照號碼、詳細住址
- 權杖只存在該裝置的瀏覽器（localStorage）。換手機或清除網站資料後要重新貼
- 編輯頁開著時，別台裝置記了帳：存檔會自動合併，記帳不會被蓋掉
- 兩台裝置同時用編輯頁改行程本身：後存的會被擋下，修改還留在頁面上，記下來再重新載入
- 編輯頁的連結只接受 `http://`、`https://` 開頭
- 每記一筆帳就是一次 Git commit，也會觸發一次部署
- 刪除行程只是從網站移除，Git 紀錄裡仍可找回

## 開發

```bash
/Users/user/.local/bin/kabi-dev run -- npm install
/Users/user/.local/bin/kabi-dev run -- npm run dev
/Users/user/.local/bin/kabi-dev run -- npm test
/Users/user/.local/bin/kabi-dev run -- npm run build
```
