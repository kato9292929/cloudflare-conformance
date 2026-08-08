# Web Bot Auth

## 対象仕様
- Cloudflare Web Bot Auth (docs): https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth — 参照試行 2026-08-08, **取得不可（egress blocked）**
- signed agents (docs): https://developers.cloudflare.com/bots/concepts/bot/signed-agents — 参照試行 2026-08-08, **取得不可**
- signed agents (blog): https://blog.cloudflare.com/signed-agents/ — 参照試行 2026-08-08, **取得不可**
- 実装が依拠する公開標準: RFC 9421 (HTTP Message Signatures), RFC 8032 (Ed25519), RFC 7517/8037 (JWK / OKP)。詳細は `docs/sources.md`。

この環境からCloudflare一次情報を取得できなかったため、Cloudflare固有の記述は `VERIFIED` にしない。RFC準拠の一般機構として実装し、Cloudflare固有の制約は `PENDING-B` とする。

<!-- CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | Primary Cloudflare docs (web-bot-auth, signed-agents) not retrievable from this environment (egress blocked); spec text confirmation deferred to a network-enabled environment | ref=docs/sources.md -->

## 実装したもの
- `src/web-bot-auth/keys.mjs` — Ed25519鍵生成（Nodeビルトインcrypto）、公開/秘密鍵のOKP JWKエクスポート、RFC 7638サムプリントを`kid`として付与。
- `src/web-bot-auth/sfv.mjs` — RFC 9421が使うRFC 8941構造化フィールドの必要最小サブセット（inner list + params）の直列化/解析。未対応の形式は握りつぶさず例外にする。
- `src/web-bot-auth/components.mjs` — RFC 9421派生コンポーネント（`@method`/`@authority`/`@path`/`@query`ほか）の解決。`@query-param(s)` と `@status` を**拒否**する（Cloudflare制約）。
- `src/web-bot-auth/signature-base.mjs` — 署名ベース文字列の生成（署名側）と、受信した`@signature-params`をそのまま使う再構築（検証側）。
- `src/web-bot-auth/signer.mjs` — `Signature-Agent` / `Signature-Input` / `Signature` の3ヘッダを組み立てる。`alg`は`ed25519`のみ実装（他algは例外）。
- `src/web-bot-auth/verifier.mjs` — 自前の検証器。**fail-closed**（有効な署名でのみ`{valid:true}`、それ以外は例外）。署名なしリクエストへ通すパスは存在しない。
- `src/web-bot-auth/directory.mjs` — 公開鍵ディレクトリ（JWKS, RFC 7517）の生成と、`kid`引き当てresolverの生成。
- CLI: `scripts/wba-keygen.mjs`, `scripts/wba-jwks.mjs`, `scripts/wba-sign.mjs`。

## この環境で確認したこと
- `test/web-bot-auth.test.mjs`（14件, `node --test`）が全pass。内容:
  - 鍵生成→JWK→`kid`（RFC 7638サムプリント）が安定。
  - 署名生成→自前検証の**往復が成功**し、covered componentsを報告する。
  - `@authority`改ざん、署名バイト反転で検証が**例外**（フォールバックしない）。
  - `@query-param` / `@query-params` / `@status` を署名対象に含めると署名時に**例外**。受信側でも`@status`を含む`Signature-Input`を**拒否**。
  - ヘッダ欠落・期限切れ・未知`keyid`はいずれも大きく失敗（許可的な戻り値を返さない）。
  - JWKS生成→resolver→検証成功、重複`kid`拒否。
  - 署名ベースがRFC 9421の形に一致（決定的）。
- 実行コマンドと出力: `evidence/web-bot-auth/2026-08-08/`（`test-output.txt`, `sign-verify-demo.txt`, `keygen.txt`, `jwks-build.txt`, `public.jwk.json`, `jwks.json`）。秘密鍵は`out/`（gitignore）に留め、コミットしない。

## 未消化（区分B）
- Cloudflare実サイトへの署名リクエスト受理確認。
- bots and agents directory への申請と掲載確認。
- 一次docsの本文取得による、署名対象コンポーネント制約の裏取り。

## 自社定義（UNVERIFIED / PENDING-B）
一次docsを取得できていないため、Cloudflare固有の以下は`VERIFIED`にせず、実装上の既定値として選んだにとどめる。

- **既定のcovered componentsの集合**（`@authority` + `signature-agent`）。RFC 9421の機構自体は確定だが、Cloudflareが要求する必須集合は未確認 → `PENDING-B`（`src/web-bot-auth/signer.mjs`）。
- **`@query-params`/`@status`を含めると失敗する制約**。タスク指示書が「docsにある」とする記述に従って実装・テスト化したが、docs本文は未取得 → `PENDING-B`（`src/web-bot-auth/components.mjs`）。
- **`Signature-Agent`ヘッダ値のSF String（引用符）表現、`tag="web-bot-auth"`、JWKSの提供パス/メディアタイプ** → `PENDING-B`（`src/web-bot-auth/signer.mjs`, `directory.mjs`）。
- `kid`にRFC 7638サムプリントを用いる点は実装判断（`UNVERIFIED`寄り）。Cloudflareが別の`kid`規約を要求する可能性は未確認。

これらはいずれもコード内の`CONFORMANCE-TAG`マーカーとして機械可読に残してあり、`docs/conformance/matrix.md`に集約される。
