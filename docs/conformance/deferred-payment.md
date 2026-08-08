# deferred payment scheme (x402)

## 対象仕様
- x402 / Cloudflare (blog): https://blog.cloudflare.com/x402/ — 参照試行 2026-08-08, **取得不可（egress blocked）**
- deferred payment scheme はx402への提案段階（タスク前提）。確定仕様は存在しない。

**提案段階のため、後払い・バッチ集約に対応した実装は書かない。** 台帳のデータ構造が「1件即時決済」以外を後から入れられる形になっているかだけを確認し、記録に残す（M5）。

<!-- CONFORMANCE-TAG: UNVERIFIED | framework=deferred-payment | deferred payment scheme is a proposal to x402 with no finalized spec; no deferred/batch settlement code is written, only ledger extensibility is checked | ref=https://blog.cloudflare.com/x402/ -->

## 実装したもの
提案段階のため**後払い・バッチ集約のロジックは書かない**。台帳の実装と、その構造が「1件即時決済」以外の settlement 種別を後から**スキーマ変更なしで**受け入れられるか（拡張点があるか）だけを実装・検証する。

- `src/ledger/ledger.mjs`：追記専用のエージェント支出台帳（`createLedger`）。エントリスキーマ `x402inc.ledger-entry/v0`（自社定義）。`settlement.type` を識別子とする判別ユニオンを持ち、台帳インスタンスごとに settlement 種別のレジストリを保持。既定では `immediate`（記録時点で即時決済）**のみ**登録。
  - **未登録の settlement 種別（例 `deferred`）は握りつぶさず throw**。後払い/バッチは確定仕様がないため実装せず、推測もしない。
  - `registerSettlementType(type, validate)` が拡張点。将来 deferred/batch の仕様が確定したら、この登録を足すだけでよく、エントリスキーマは変えない。
  - `totals()` / `spentAtomic(asset, network)`：BigInt による集計（M3 スペンドポリシーの累計チェックに供給できる）。
- `scripts/gen-ledger.mjs`（`npm run ledger`）：支払いイベント列（CLI 引数のパス）から台帳を構築し、`immediate` は記録・`deferred` は拒否される様子と合計を表示。
- フィクスチャ：`fixtures/deferred-payment/payments.json`（合成。`deferred` エントリは「拒否される」ことを示すため意図的に混入）。
- テスト：`test/ledger.test.mjs`（`node:test`、外部依存なし）。

## この環境で確認したこと
- `npm test`：全 59 テスト green（うち M5 分 5）。生ログ: [`evidence/deferred-payment/2026-08-08/test-output.txt`](../../evidence/deferred-payment/2026-08-08/test-output.txt)。
- `npm run ledger`：`immediate` 3 件を記録し合計 135000（atomic）、`deferred` は理由つきで拒否。生ログ: [`evidence/deferred-payment/2026-08-08/gen-ledger.txt`](../../evidence/deferred-payment/2026-08-08/gen-ledger.txt)。
- 拡張点の検証：テストで暫定 settlement 種別を登録するとエントリスキーマを変えずに受理できることを確認（テスト内スタブであり、deferred の仕様主張ではない）。

## 未消化（区分B）
- deferred payment scheme の確定仕様の取得（提案が採択・公開された後）。取得後に settlement 種別を登録し、この記録を更新する。

## 自社定義（UNVERIFIED）
- 台帳レコードのスキーマ `x402inc.ledger-entry/v0`（`settlement.type` 拡張点を含む）。コード側に UNVERIFIED マーカーを対で記載（`src/ledger/ledger.mjs`）。deferred/batch のロジックは未実装であり、いかなる後払い挙動も主張しない。
