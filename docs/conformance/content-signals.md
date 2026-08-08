# Content Signals / AI Crawl Control

## 対象仕様
- pay per crawl (blog): https://blog.cloudflare.com/introducing-pay-per-crawl/ — 参照試行 2026-08-08, **取得不可（egress blocked）**
- verified bots (docs): https://developers.cloudflare.com/bots/concepts/bot/verified-bots/ — 参照試行 2026-08-08, **取得不可**
- 実装が依拠する公開標準: RFC 9309 (Robots Exclusion Protocol)。Content Signals はrobots.txt上のディレクティブ／コメント規約として解釈する。

公開状態: 提供中。2026-09-15にmixed-useクローラーのデフォルト挙動が変更予定（タスク前提）。**この変更予定挙動をコードで断定しない。** 事実と一次情報URLのみ記録に残す。

<!-- CONFORMANCE-TAG: PENDING-B | framework=content-signals | 2026-09-15 mixed-use crawler default change: recorded as a scheduled fact only; behavior NOT asserted in code; primary source unretrieved | ref=https://blog.cloudflare.com/introducing-pay-per-crawl/ -->

## 実装したもの
（M4で記載）

## この環境で確認したこと
（M4で記載）

## 未消化（区分B）
- 実ドメインに対するrobots.txt取得（取得部はインターフェース分離、PENDING-B）。
- 日本のドメイン群を対象にした集計。

## 自社定義（UNVERIFIED）
（M4で記載: Content Signals トークンの解釈範囲）
