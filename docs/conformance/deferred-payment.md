# deferred payment scheme (x402)

## 対象仕様
- x402 / Cloudflare (blog): https://blog.cloudflare.com/x402/ — 参照試行 2026-08-08, **取得不可（egress blocked）**
- deferred payment scheme はx402への提案段階（タスク前提）。確定仕様は存在しない。

**提案段階のため、後払い・バッチ集約に対応した実装は書かない。** 台帳のデータ構造が「1件即時決済」以外を後から入れられる形になっているかだけを確認し、記録に残す（M5）。

<!-- CONFORMANCE-TAG: UNVERIFIED | framework=deferred-payment | deferred payment scheme is a proposal to x402 with no finalized spec; no deferred/batch settlement code is written, only ledger extensibility is checked | ref=https://blog.cloudflare.com/x402/ -->

## 実装したもの
（M5で記載: エージェント支出台帳）

## この環境で確認したこと
（M5で記載）

## 未消化（区分B）
- deferred payment scheme の確定仕様の取得（提案が採択・公開された後）。

## 自社定義（UNVERIFIED）
- 台帳レコードのスキーマ（settlement種別の拡張点を含む）。詳細はM5。
