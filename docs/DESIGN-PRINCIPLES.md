# Codex × PersonalEncyclopedia 設計思想共有書

> 本書は [thuvstu/PersonalEncyclopedia](https://github.com/thuvstu/personalencyclopedia)（以下 PE / Android Room 版）と本プロジェクト（Codex / Next.js + Drizzle + PostgreSQL）で**プラットフォーム非依存の設計思想を共有する**ための対応表です。
> PE 側の正規文書は `DESIGN.md`（§2 設計思想・7つの原則）。本書はそれを Web スタックに写した対写であり、**どちらのリポジトリからでも同じ約束が読める**ことを目指します。

アーキテクチャ（Next.js App Router + Drizzle ORM + PostgreSQL）は PE の Android/Room とは異なりますが、**原則は一切変えません**。

---

## 原則対応表（7原則）

### 原則1：単一の真実 + 可搬性
- **PE（正の写し）**: データ本体は `encyclopedia.db` のみ。Web クライアントは DB を持たず API 経由。
- **Codex（対写）**: PostgreSQL が唯一の本体。`cards / links / link_candidates / whiteboard_* / reviews / card_revisions / progress_events` 以外に状態を持たない。
- **可搬性の保証**: `/api/export` は **JSON 完全版（往復互換）・SQLite ダンプ・Markdown 書籍**の3形式を提供。`/api/import` は自形式 JSON と素の配列を受理。
- **往復は検証で固定**: `scripts/roundtrip-test.mjs` が「export → 全消去 → import → 件数/辺/ボード配置が一致」を機械的に確認する（原則3の受け入れ条件を恒久化）。
- **新機能の必須確認**: 「export に含まれるか・import で復元できるか」を差分レビューで必ず確認する。

### 原則2：承認制（最重要）
- **PE（正の写し）**: 自動接続は `connection_candidate(pending)` に積み、approve で初めて `connection` に昇格。却下は再提案しない。理由：自動連結によるグラフの**毛玉化防止**。
- **Codex（対写）**: 本文中の `[[リンク]]` 抽出は `links` に**直接書かず** `link_candidates(status=pending)` に積む。
  - 承認 → `links` に昇格（知識グラフの辺として初めて生える）
  - 却下 → `status=rejected`（同一ペアは二度と再提案しない）
  - 本文から参照が消えた候補は自動撤回（削除）
  - 承認済みペアと候補の両立は禁止（approval supersedes extraction）
- **置き場**: `/connections`（一覧＋一括承認は警告付き）、エントリ詳細の右サイド「接続の候補」、ナビの未承認バッジ。
- **既存データ・シード**: ユーザーが著した既知のリンクなので初めから approved 扱い（移行不要）。

### 原則3：決定論が主・AIは従
- **PE（正の写し）**: 採点・検索・重複判定の一次判定は規則・正規表現・コサイン類似度。AI は判断の補助のみ。API 未設定でもフル動作（graceful degradation）。
- **Codex（対写）**: 検索は **pg_trgm 類似度 + フィールド重み**（タイトル > 別名 > 要約 > 本文）の完全決定論。拡張未導入環境では **ILIKE にフォールバック**して必ず答える。
- **表記揺れ**: `aliases[]`（別名・読み仮名・旧称）がファジー検索に参加（例：「WW1」→「第一次世界大戦」）。
- **AI**: **一切導入しない**（依存ゼロ方針・無料運用と両立）。将来入れる場合も I/F の裏に隔離し、未設定で全機能が動くことを条件とする。

### 原則4：履歴は無制限・最新は導出
- **PE（正の写し）**: `srs_review` は全履歴を保存し、`SrsCurrentView` が最新スナップショットを導出。アルゴリズム差替えが履歴を壊さない。
- **Codex（対写）**: 3つの append-only 履歴を持ち、現在状態は常に導出する。
  - `card_revisions`：更新のたび旧版を保存（上書き前）。復元も**新版として残る**ので取り消し可能。
  - `reviews`：全復習イベント。現行 SRS 状態は `DISTINCT ON (card_id) … ORDER BY reviewed_at DESC` で導出（SM-2）。
  - `progress_events`：全活動イベント。ストリーク・ヒートマップは集計ビューのように導出。
- **AI確認の挙動を固定**: なし（決定論のみ）。

### 原則5：フォールバック必須
- **PE（正の写し）**: `runStep` の3フェーズ個別 try-catch。外部依存の失敗は「壊れるのではなく劣化」。
- **Codex（対写）**:
  - **依存ゼロ方針を宣言的に維持**: React Flow / xyflow・外部 Markdown ライブラリ・CDN を**使わない**。グラフ描画・Markdown・wiki-link は全て自前実装。
  - pg_trgm 未導入環境 → ILIKE に自動フォールバック（ログに degraded と記録）。
  - サーバーが死んでも export された .sql/.md は読める（原則1=可搬性と直結）。

### 原則6：1機能1コミット
- **PE（正の写し）**: `★最適化R1〜R7`、`★新採点システムC1〜C7` というマーカーで要件→実装のトレーサビリティを刻む。
- **Codex（対写）**: 移植は「タスク順序厳守・各1セッション」の順で実施。各タスクで「実装 → ビルド → 受け入れ確認 → 次へ」を1サイクルとし、エラーが3ファイル以上に波及したら巻き戻す。

### 原則7：無料・一人運用・10年
- **PE（正の写し）**: 有料サービスを使わない。
- **Codex（対写）**:
  - 月額固定費ゼロ：外部 AI・通知・ホスティング依存を増やさない。
  - 常駐ワーカーなし：復習期限は**リクエスト時に導出**（バッジ + トップ警告帯）で構成。バックグラウンド通知は別計画（原則外）。
  - 10年の担保：**オープン標準で取り出せる**（.sql / .md）ことが寿命保証そのもの。

---

## 写してきた具体機能（PE → Codex）

| PE の概念 | Codex での対応実装 | 状態 |
|---|---|---|
| 承認制接続（connection_candidate） | `link_candidates` + `/connections` + サイドバ候補パネル + バッジ | ✅ タスク1 |
| ハイブリッド検索（決定論部） | pg_trgm 重み付きランキング + `aliases` + ILIKE フォールバック | ✅ タスク2 |
| 往復ポータビリティ | `/api/export`(json/sqlite/md) + `/api/import` + 往復テストスクリプト | ✅ タスク3 |
| SRS 履歴⇔最新導出（SrsCurrentView） | `reviews` append-only + `DISTINCT ON` 導出（SM-2） | ✅ 既存 |
| カード履歴（版） | `card_revisions` + `/wiki/[slug]/history` 復元UI | ✅ 既存 |
| イベント→ヒートマップ/ストリーク | `progress_events` + `/stats` | ✅ 既存 |
| 13エントリ型 | `kind`（9型に絞った）+ 型バッジ/フィルタ | ✅ 既存 |
| 別名・読み（entry_definition.reading） | `aliases[]` + ファジー検索参加 | ✅ タスク2 |
| 未解決リンク検出 | `/stats` の赤リンク一覧（次に書くべきトピック） | ✅ 既存 |
| データ主権（Room DB ⇄ PostgreSQL） | 正準スキーマ契約 + `/schema` + `/api/schema` | ✅ 共有 |
| 端末横断の同一性 / 削除の伝播 | `uid` + `deleted_at` tombstone | ✅ 共有 |
| 複製（PE ⇄ Codex） | `/api/sync/pull` `/api/sync/push`（冪等・LWW・PE形式自動判別） | ✅ 共有 |
| PE web クライアント（PC 入力専用） | `/capture` + `/api/capture` + ブックマークレット | ✅ 移植 |

## やらないこと（PE 側のスコープ外宣言と揃える）
- Android / Room / Ktor / SAF の移植（プラットフォームが違う）
- AI / Gemini / Ollama / Embedding の導入（依存ゼロ・無料運用と衝突）
- Tiptap 等のリッチエディタ（依存ゼロ方針と衝突、Markdown 自前を維持）
- リアルタイム協調・認証・共有（単一ユーザーのスコープ外）
- バックグラウンド通知（別計画。まず復習期限バッジ+トップ警告帯のみ）
- 1セッションで複数機能を同時に導入すること
- 同期に CRDT / 常駐ワーカー / 双方向リアルタイム購読を持ち込むこと（LWW + 手動 pull/push で足りる）

---

## 変更時の約束（どちらのリポジトリでも）

1. 新しいデータが生えたら、まず export/import の往復に含める（原則1）。
2. 新しい自動処理は書き込み前に「候補」に積むことを検討する（原則2）。
3. 外部依存を増やす前に「決定論で足りないか」を考える（原則3・5・7）。
4. 上書き更新は原則禁止。履歴に積んで最新を導出する（原則4）。

---

## スキーマ共有と複製（SQLite ⇄ PostgreSQL）

「DB エンジンが違う」ことと「設計が違う」ことは別問題である。**論理設計は共有し、方言差だけを 1 箇所に閉じ込める。**

### 1. 正準スキーマ契約（single definition → 両方言）
`src/lib/schema-contract.ts` に**方言非依存**でテーブル・カラム・制約を定義し、そこから生成する。

```
CONTRACT ─┬─> postgresDDL()  … Codex 実体（drizzle と一致）
          ├─> sqliteDDL()    … PE / Room / 可搬複製
          └─> roomNotes()    … Kotlin 型・@TypeConverter の写経ガイド
```

| 論理型 | PostgreSQL | SQLite / Room |
|---|---|---|
| `uid` | `text` UNIQUE | `TEXT` UNIQUE / `String` |
| `text[]` | `text[]` | `TEXT`(JSON配列) / `List<String>` + TypeConverter |
| `bool` | `boolean` | `INTEGER 0|1` / `Boolean` |
| `ts` | `timestamptz` | `TEXT` ISO-8601 UTC / `Long` epochMillis |
| `ts?` | `timestamptz NULL` | 同上（nullable）＝ tombstone |

- 参照: `/schema`（人間向け）、`GET /api/schema?format=sqlite|postgres|json`（機械向け）
- **約束**：スキーマを変えるときは契約を先に変える。契約に無いカラムは作らない。

### 2. 同一性・競合・削除（決定論のみ／AI不使用）
| 論点 | 決定 | 理由 |
|---|---|---|
| 同一性 | `uid`（UUID）。採番 `id` は同期に使わない | 端末ごとに採番が衝突するため |
| 競合 | `updated_at` の Last-Write-Wins、同値はローカル維持 | 一人運用に CRDT は過剰（原則7） |
| 削除 | `deleted_at` tombstone を送受信。未知カードの削除も墓標として記録 | 物理削除は「無かったこと」になり復活する |
| 履歴 | `reviews` / `progress_events` は append-only。自然キー＋±2ms 窓で重複排除 | PG はマイクロ秒・JSON はミリ秒で丸め差が出るため |
| リンク | `approved: true` のみ辺として取り込み、他は候補 | 原則2（毛玉化防止）は同期経路でも貫く |
| 孤児イベント | 参照先が purge 済みのイベントは複製しない | 参照を往復できず毎回複製されるため |

### 3. エンドポイント
| メソッド | パス | 役割 |
|---|---|---|
| GET | `/api/sync` | 複製状態（件数・tombstone 数・`lastCardUpdate`） |
| GET | `/api/sync/pull?since=ISO8601` | 差分取得（tombstone 込み。省略で全件） |
| POST | `/api/sync/push` | 差分反映（冪等・LWW）。**PE の entries 形式も自動判別** |
| GET | `/api/schema?format=…` | 契約と生成済み DDL |

PE 型 → Codex `kind` の写像は `PE_KIND_MAP`（thought→idea / definition→word / webpage→link / book,video,paper→work …）。
`reading` と `term` は `aliases[]` に落ちるので、PE 側の読み仮名がそのまま表記揺れ検索に効く。

### 4. PC 入力専用クライアント（PE web 機能の移植）
`/capture` は「**入れるだけ**」に特化した画面。読む・整理する・つなぐは他画面に任せる。
- Enter だけで保存 → フォーカスは入力欄に残り続ける
- URL を貼ると自動で `link` 型＋出典付与
- 一括モード：1行1件、`タイトル | 要約` 記法、URL 行の自動判別
- ブックマークレット（`POST /api/capture`）で閲覧中のページを取り込み
- 分類・タグ・接続は**強制しない**（未分類許容・後整理前提）

### 5. 検証（緑を維持する）
`node scripts/roundtrip-test.mjs` が以下を機械確認する。
1. `pull → push → push` が完全な no-op（冪等・LWW）で、全カードに uid があること
2. 全消去が **tombstone を残す**こと（＝削除が複製可能であること）
3. export → 全消去 → import で live 状態が完全一致すること
