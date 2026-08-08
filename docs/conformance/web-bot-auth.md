# Web Bot Auth

## 対象仕様
一次情報は**実行環境外で**取得した（環境内からは egress 遮断で到達不可。経緯は `docs/sources.md` 末尾）。取得済みソース:
- **S1** Web Bot Auth (docs): https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth — 参照日 2026-08-08（取得済）
- **S2** verified bots with cryptography (blog): https://blog.cloudflare.com/verified-bots-with-cryptography/ — 参照日 2026-08-08（取得済）
- **S3** web-bot-auth 参照実装 (repo): https://github.com/cloudflare/web-bot-auth — 参照日 2026-08-08（取得済）
- **S4** Signature Agent Card / registry (IETF draft): https://www.ietf.org/archive/id/draft-meunier-webbotauth-registry-01.html — 参照日 2026-08-08（ドラフト段階・RFCではない）
- **S5** アーキテクチャドラフト: https://datatracker.ietf.org/doc/html/draft-meunier-web-bot-auth-architecture-04 — 参照日 2026-08-08（**本文未取得**、版数のみ確認）

未取得（据え置き）: signed agents docs (https://developers.cloudflare.com/bots/concepts/bot/signed-agents) と blog (https://blog.cloudflare.com/signed-agents/)。

- 実装が依拠する公開標準: RFC 9421 (HTTP Message Signatures), RFC 8032 (Ed25519), RFC 7517/8037 (JWK / OKP), RFC 7638 (thumbprint)。

S1〜S3で確認できたCloudflare固有の記述（3ヘッダ構成、`Signature-Agent`の形式制約、`@query-params`/`@status`拒否、`keyid`/`expires`の扱い、ディレクトリのパス）は `VERIFIED`（根拠ID併記）に昇格した。本文未取得のS5に依拠する記述、および未取得のsigned agents docs/blogに関わる記述は `PENDING-B` のまま据え置く。

<!-- CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | signed-agents docs/blog and the S5 architecture-draft BODY were not retrieved; statements resting on them (and live Cloudflare acceptance) stay unconfirmed | ref=docs/sources.md -->

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

## VERIFIED（S1〜S3で裏取り済み）
一次情報（環境外取得）で確認できたため昇格した。根拠IDはコード内マーカーに併記。

- **3ヘッダ構成**（`Signature` / `Signature-Input` / `Signature-Agent`）→ `VERIFIED`（S1, S2）（`src/web-bot-auth/signer.mjs`）。
- **`Signature-Agent`の形式制約**（`https://`必須・SF String引用・`Signature-Input`のコンポーネントに含める）→ `VERIFIED`（S1）。`https://`と包含を署名時に強制（`src/web-bot-auth/signer.mjs`）。
- **`@query-params`/`@status`を署名対象に含めると失敗する制約** → `VERIFIED`（S1）（`src/web-bot-auth/components.mjs`）。
- **`keyid`が既知鍵を指すことの確認と、失効した`expires`の拒否** → `VERIFIED`（S1, S2）（`src/web-bot-auth/verifier.mjs`）。
- **ディレクトリのパス** `/.well-known/http-message-signatures-directory` → `VERIFIED`（S3）（`src/web-bot-auth/directory.mjs`）。

## 未消化（区分B）
- Cloudflare実サイトへの署名リクエスト受理確認。
- bots and agents directory への申請と掲載確認。
- S5（アーキテクチャドラフト）本文、signed agents docs/blogの取得。

## 自社定義（UNVERIFIED / PENDING-B）
一次情報で確定できていない以下は昇格せず据え置く。

- **必須covered componentsの完全な集合**。`signature-agent`を含める必要（S1）は確定だが、それ以外の必須集合と`tag`値の規約は未確認 → `PENDING-B`（`src/web-bot-auth/signer.mjs`）。
- **ディレクトリ応答のメディアタイプ** → `PENDING-B`（`src/web-bot-auth/directory.mjs`）。パス自体はS3で確定。
- `kid`にRFC 7638サムプリントを用いる点は実装判断 → `UNVERIFIED`（`src/web-bot-auth/keys.mjs`）。Cloudflareが別の`kid`規約を要求する可能性は未確認（S2は「既知鍵を指すか」を確認するとのみ述べ、`kid`の値の作り方は規定しない）。

これらはいずれもコード内の`CONFORMANCE-TAG`マーカーとして機械可読に残してあり、`docs/conformance/matrix.md`に集約される。
