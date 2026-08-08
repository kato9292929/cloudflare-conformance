# Content Signals / AI Crawl Control

## 対象仕様
一次情報は**実行環境外で**取得した（経緯は `docs/sources.md` 末尾）。取得済みの関連ソース:
- **S8** AI Crawl Control worker templates (docs): https://developers.cloudflare.com/ai-crawl-control/reference/worker-templates — 参照日 2026-08-08（取得済）。AI Crawl Controlの位置づけと `x402-proxy` テンプレートによる支払いゲートを確認。**ただしContent Signalsのトークン語彙・意味は本ソースにも書かれていない。**

未取得（据え置き）: Content Signals Policy のトークン語彙定義元、pay per crawl (blog) https://blog.cloudflare.com/introducing-pay-per-crawl/、verified bots (docs) https://developers.cloudflare.com/bots/concepts/bot/verified-bots/。

- 実装が依拠する公開標準: RFC 9309 (Robots Exclusion Protocol)。Content Signals はrobots.txt上のディレクティブ／コメント規約として解釈する。

公開状態: 提供中。2026-09-15にmixed-useクローラーのデフォルト挙動が変更予定（タスク前提）。**この変更予定挙動をコードで断定しない。** 事実と一次情報URLのみ記録に残す。トークン語彙の一次情報は未取得のため、`RECOGNIZED_TOKENS` の解釈は `UNVERIFIED` のまま据え置く。

<!-- CONFORMANCE-TAG: PENDING-B | framework=content-signals | 2026-09-15 mixed-use crawler default change: recorded as a scheduled fact only; behavior NOT asserted in code; primary source unretrieved | ref=https://blog.cloudflare.com/introducing-pay-per-crawl/ -->

## 実装したもの
実装は RFC 9309（公開標準）に基づく robots.txt の解析・判定と、`Content-Signal:` ディレクティブの**構造的抽出**に限定する。トークンの意味やクローラーの遵守挙動は断定しない（一次情報未取得）。

- `src/content-signals/robots.mjs`：RFC 9309 パーサ＋マッチャ。user-agent グループ、`Allow`/`Disallow`（`*`・`$` 対応）、`Sitemap`、最長一致・同長時 Allow 優先の可否判定（`isAllowed`）。`Content-Signal:` 行は**逐語で抽出するのみ**でここでは解釈しない。
- `src/content-signals/signals.mjs`：`Content-Signal:` の `token=value` を抽出。認識トークン集合（`search`/`ai-input`/`ai-train`）は**自社定義（UNVERIFIED）**で、Cloudflare の語彙の転記でも挙動の主張でもない。値なしトークンも `value=null` として黙殺せず可視化。
- `src/content-signals/source.mjs`：取得元の境界。`localFileSource`（実装済）と `networkSource`（この環境は egress 遮断のため未実装・throw・区分B）。
- `scripts/parse-signals.mjs`（`npm run signals:parse`）：パスを CLI 引数で受け取り、グループ・アクセス判定・抽出済み Content-Signal を表示。
- フィクスチャ：`fixtures/content-signals/*.robots.txt`（合成・実ドメインではない）。
- テスト：`test/content-signals.test.mjs`（`node:test`、外部依存なし）。

## この環境で確認したこと
- `npm test`：全 54 テスト green（うち M4 分 8）。生ログ: [`evidence/content-signals/2026-08-08/test-output.txt`](../../evidence/content-signals/2026-08-08/test-output.txt)。
- `npm run signals:parse`：RFC 9309 判定（`/private/` 拒否だが `/private/public-note.txt` は Allow が勝つ、`/*.pdf$` 拒否、ルールなしは既定 allow）と Content-Signal 抽出を実演。生ログ: [`evidence/content-signals/2026-08-08/parse-signals.txt`](../../evidence/content-signals/2026-08-08/parse-signals.txt)。
- **2026-09-15 の mixed-use クローラー既定変更はコードで断定していない**（記録上の事実・URL のみ）。実ドメインからの取得は未実施（区分B）。

## 未消化（区分B）
- 実ドメインに対するrobots.txt取得（取得部はインターフェース分離、`networkSource` が PENDING-B で throw）。
- 日本のドメイン群を対象にした集計。
- Cloudflare の Content Signals トークン集合・意味の一次情報取得（egress blocked）。

## 自社定義（UNVERIFIED）
- 認識する Content-Signal トークンの範囲と値の正規化（`src/content-signals/signals.mjs`）。Cloudflare の確定語彙・意味は未取得のため、いかなるクローラー挙動も主張しない。コード側に UNVERIFIED マーカーを対で記載。
