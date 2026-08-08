# Monetization Gateway

## 対象仕様
- Monetization Gateway (blog): https://blog.cloudflare.com/monetization-gateway/ — 参照試行 2026-08-08, **取得不可（egress blocked）**
- x402 / Cloudflare (blog): https://blog.cloudflare.com/x402/ — 参照試行 2026-08-08, **取得不可**
- pay per crawl (blog): https://blog.cloudflare.com/introducing-pay-per-crawl/ — 参照試行 2026-08-08, **取得不可**
- 実装が依拠する公開標準: HTTP 402 Payment Required (RFC 7231 §6.5.2)、および自社が既に運用しているx402実装。

公開状態: 2026-07-01発表、waitlist、一般提供前（タスク前提）。したがって差し替えは行わず、差し替え可能な境界のみ作る。

## 実装したもの
（M2で記載）

## この環境で確認したこと
（M2で記載）

## 未消化（区分B）
- waitlist通過後の実ルール投入。
- エッジでの実課金挙動の確認。
- Gateway側のルール記述フォーマットの一次仕様取得。

## 自社定義（UNVERIFIED）
（M2で記載: 課金ルールファイルのスキーマ）
