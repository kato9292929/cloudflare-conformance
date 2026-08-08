# Monetization Gateway

## 対象仕様
一次情報は**実行環境外で**取得した（経緯は `docs/sources.md` 末尾）。取得済みソース:
- **S6** Monetization Gateway (blog): https://blog.cloudflare.com/monetization-gateway/ — 参照日 2026-08-08（取得済）
- **S7** Cloudflare Agents x402 (docs): https://developers.cloudflare.com/agents/x402 — 参照日 2026-08-08（取得済）

未取得（据え置き）: x402 / Cloudflare (blog) https://blog.cloudflare.com/x402/、pay per crawl (blog) https://blog.cloudflare.com/introducing-pay-per-crawl/。

- 実装が依拠する公開標準: HTTP 402 Payment Required (RFC 7231 §6.5.2)、および自社が既に運用しているx402実装。

公開状態: 2026-07-01発表、waitlist、一般提供前（タスク前提）。したがって差し替えは行わず、差し替え可能な境界のみ作る。

S6で確認できた「402ペイロードが価格・受け付ける資産・支払い先を含む」「課金がルート×VERB×価格の粒度」は `VERIFIED`（根拠: S6）に昇格した。一方 **Gatewayのルール記述スキーマそのものは未公開** のため、自社定義のルールファイル形式は `UNVERIFIED` のまま据え置く。

## 実装したもの
- `data/billing-rules.json` — 課金ルールの宣言的定義（パス、価格、通貨、ネットワーク）。実装から独立した唯一の真実。スキーマ`x402inc.billing-rules/v0`は**自社定義（UNVERIFIED）**で、Cloudflareの用語に寄せていない。
- `src/x402/rules.mjs` — ルールの読み込み・検証（不正スキーマ/不正金額は例外）、`resolveRule(path, method)`、および小数→アトミック単位の変換（`decimalToAtomic`, BigIntによる厳密計算。浮動小数点は使わない）。
- `src/x402/checker.mjs` — 402レスポンスの形状（status=402 / `application/json` / `x402Version` / `accepts[]`の必須フィールドと型 / `maxAmountRequired`がアトミック整数文字列）を静的検査し、さらにbilling-rulesと突き合わせ（network/asset/scheme/金額/payTo）。**問題はすべて列挙して報告し、デフォルト値で通さない**。
- `src/x402/gateway-adapter.mjs` — アダプタ境界。`localProvider`（billing-rules→x402 accepts、現行の自前実装）と`gatewayProvider`（Gatewayルール形式への写像。**未実装で例外**、推測しない）を同一インターフェースで提供。差し替え点だけを用意し、今は差し替えない。
- fixtures: `fixtures/monetization-gateway/valid/*`（正常）と `invalid/*`（金額不一致・status誤り・content-type誤り・必須欠落・非アトミック金額・ルール不在）。
- CLI: `scripts/x402-check.mjs`（`--expect-ok` / `--expect-fail`）。

## この環境で確認したこと
- `test/x402.test.mjs`（12件）全pass。小数→アトミック変換、ルール解決、検査器の各違反検出、アダプタ境界（localは検査器と整合、gatewayは例外）を確認。
- CLI実行:
  - valid fixtures を `--expect-ok` で実行 → 2/2 PASS（exit 0）。
  - invalid fixtures を `--expect-fail` で実行 → 3/3 が正しく拒否（検出された具体的な違反を出力）。
- 生出力: `evidence/monetization-gateway/2026-08-08/`（`check-valid.txt`, `check-invalid.txt`, `test-output.txt`）。

## 未消化（区分B）
- waitlist通過後の実ルール投入。
- エッジでの実課金挙動の確認。
- Gateway側のルール記述フォーマットの一次仕様取得。

## VERIFIED（S6で裏取り済み）
- **402ペイロードが価格・受け付ける資産・支払い先を含むこと**（検査器が `maxAmountRequired` / `asset` / `payTo` を必須化）→ `VERIFIED`（S6）（`src/x402/checker.mjs`）。
- **課金の粒度がルート×VERB×価格であること** → `VERIFIED`（S6）（`src/x402/rules.mjs`）。

## 自社定義（UNVERIFIED / PENDING-B）
- **billing-rules スキーマ `x402inc.billing-rules/v0` のフィールド名・型・ファイル構成** → `UNVERIFIED`。Gatewayのルール記述形式が未公開のため、Gateway固有項目は一切埋めていない。フィールド名はCloudflare用語に似せていない（`src/x402/rules.mjs`）。粒度（ルート×VERB×価格）自体はS6で確定。
- **価格・資産・支払い先以外のx402フィールド集合**（`x402Version` / `scheme` / `network` / `resource` / `maxTimeoutSeconds`）→ `PENDING-B`。x402プロトコルの知識に基づく検査だが、x402仕様本文とGateway自身の402契約は未取得（`src/x402/checker.mjs`）。
- **Gatewayルール形式への写像**（`gatewayProvider`）→ `PENDING-B`。未実装。形式が公開されるまで推測しない（`src/x402/gateway-adapter.mjs`）。
- 既定の`asset`/`payTo`はプレースホルダ（`0x…0`等）であり、本番値ではない。
