# Web Bot Auth

## 対象仕様
- Cloudflare Web Bot Auth (docs): https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth — 参照試行 2026-08-08, **取得不可（egress blocked）**
- signed agents (docs): https://developers.cloudflare.com/bots/concepts/bot/signed-agents — 参照試行 2026-08-08, **取得不可**
- signed agents (blog): https://blog.cloudflare.com/signed-agents/ — 参照試行 2026-08-08, **取得不可**
- 実装が依拠する公開標準: RFC 9421 (HTTP Message Signatures), RFC 8032 (Ed25519), RFC 7517/8037 (JWK / OKP)。詳細は `docs/sources.md`。

この環境からCloudflare一次情報を取得できなかったため、Cloudflare固有の記述は `VERIFIED` にしない。RFC準拠の一般機構として実装し、Cloudflare固有の制約は `PENDING-B` とする。

<!-- CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | Primary Cloudflare docs (web-bot-auth, signed-agents) not retrievable from this environment (egress blocked); spec text confirmation deferred to a network-enabled environment | ref=docs/sources.md -->

## 実装したもの
（M1で記載）

## この環境で確認したこと
（M1で記載）

## 未消化（区分B）
- Cloudflare実サイトへの署名リクエスト受理確認。
- bots and agents directory への申請と掲載確認。
- 一次docsの本文取得による、署名対象コンポーネント制約の裏取り。

## 自社定義（UNVERIFIED）
（M1で記載）
