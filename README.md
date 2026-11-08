# 旅遊計劃（trip-planner）

把行程放在 Git 上的靜態網頁。點網址就能看，只有編輯需要 GitHub 權杖。

- 查看：`#/` 旅程列表 → `#/t/<id>` 全部行程（旅行中會自動捲到今天）→ `#/t/<id>/today` 只看今天
- 編輯：`#/edit`（新增行程）→ `#/edit/<id>`（拖拉排序、跨天移動、依時間排序）
- 資料：`public/data/index.json`（列表）、`public/data/trips/<id>.json`（每趟行程）
- 儲存：編輯頁用 GitHub Contents API 把 JSON 寫回 repo → GitHub Actions 重新部署，約 1～2 分鐘後網站更新

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

- repo 是公開的：拿到網址的人都看得到行程，資料檔在 GitHub 上也看得到。不要寫訂位代號、護照號碼、詳細住址
- 權杖只存在該裝置的瀏覽器（localStorage）。換手機或清除網站資料後要重新貼
- 兩台裝置同時編輯同一趟行程時，後存的會被擋下（提示「檔案在別處被改過了」），重新載入後再改
- 刪除行程只是從網站移除，Git 紀錄裡仍可找回

## 開發

```bash
/Users/user/.local/bin/kabi-dev run -- npm install
/Users/user/.local/bin/kabi-dev run -- npm run dev
/Users/user/.local/bin/kabi-dev run -- npm test
/Users/user/.local/bin/kabi-dev run -- npm run build
```

`example-kyoto` 是範例行程，正式使用前可在編輯頁刪除。
