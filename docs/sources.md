# Sources

取得日: 2026-08-08。取得元は本ファイル記載のURL。取得はリポジトリの実行環境外で行った（実行環境からCloudflareドメインへの egress が遮断されているため）。

各項目の「確認できた記述」は取得時点の本文に基づく要約であり、原文の再掲ではない。ページが更新されている可能性があるため、記述を根拠に使う場合は参照日を併記すること。

---

## S1. Web Bot Auth（docs）

- URL: https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth
- 種別: 一次（Cloudflare公式docs）
- 参照日: 2026-08-08

確認できた記述:

- Web Bot Authは、HTTPメッセージ内の暗号署名によってリクエストが自動化されたbotから来たことを検証する認証方式。verified botsとsigned agentsの両方で検証手段として使われる
- 2本のIETFドラフトに依拠する。鍵を公開するためのdirectoryドラフトと、鍵の使い方を定めるprotocolドラフト
- botのリクエストには3つのヘッダを付ける
- `Signature-Agent` は鍵ディレクトリを指すURI。次の場合にCloudflare側の検証が失敗する: (a) 値が `https://` でない (b) URIが有効でもダブルクォートで囲まれていない（structured fieldのため） (c) `Signature-Input` のコンポーネント一覧に `signature-agent` を含めていない
- CloudflareはRFC 9421の全コンポーネント・全パラメータをサポートしていない。`@query-params` を含めると検証は失敗し、クエリ全体を署名する `@query` の使用が推奨される。`@status` はリクエストパスに含められないためサポートされない
- `expires` が短すぎてCloudflareのサーバに届く時点で失効している場合も失敗する

対応する実装: M1（`@query-param(s)` / `@status` を拒否する制約テスト、`Signature-Agent` の形式検査）

→ **M1のラベル昇格対象**。上記に該当する箇所は `VERIFIED`（根拠: S1）にできる。

---

## S2. Verified Botsへのメッセージ署名の統合（blog）

- URL: https://blog.cloudflare.com/verified-bots-with-cryptography/
- 種別: 一次（Cloudflare公式blog、2025-07-01）
- 参照日: 2026-08-08

確認できた記述:

- Cloudflareのメッセージ署名検証は `Signature` / `Signature-Input` / `Signature-Agent` の3ヘッダを見る
- `Signature-Input` の `keyid` パラメータが、Cloudflare側が既に知っている鍵を指しているかを確認する
- リクエストの `expires` パラメータを見る
- HTTPメッセージ署名をVerified Botsプログラムに統合し、署名する事業者の登録を簡素化する方針が示されている

対応する実装: M1（`keyid` の扱い、`expires` の扱い）

---

## S3. Web Bot Auth 参照実装（Cloudflare公式リポジトリ）

- URL: https://github.com/cloudflare/web-bot-auth
- 種別: 一次（Cloudflare公式リポジトリ、Apache 2.0）
- 参照日: 2026-08-08

確認できた記述:

- `draft-meunier-web-bot-auth-architecture` が定める構成要素を実装した参照実装
- Cloudflare Researchがテスト用の環境を公開している（`http-message-signatures-example.research.cloudflare.com`）。RFC 9421のed25519テスト鍵で署名された `Signature` ヘッダの有無を検証し、`/.well-known/http-message-signatures-directory` にbot directoryを露出し、署名・JWK key ID・directoryのデバッグツールを提供する
- 監査は受けていない旨が明記されている

対応する実装: M1（JWKS生成のパス `/.well-known/http-message-signatures-directory`、および区分Bの疎通先）

→ 自前実装の妥当性確認先が実在することが確認できた。疎通そのものは引き続き区分B。

---

## S4. Signature Agent Card / registry（IETFドラフト）

- URL: https://www.ietf.org/archive/id/draft-meunier-webbotauth-registry-01.html
- 種別: 一次（IETF Internet-Draft、Informational、著者にCloudflareとAmazon）
- 参照日: 2026-08-08

確認できた記述:

- directoryを使うクライアントが自身の情報を広告するためのJSON形式（Signature Agent Card）を定義する
- 内容は識別情報、用途、レート期待値、暗号鍵
- Signature Agent CardのパラメータについてのregistryをIANAに設ける

対応する実装: M1（ディレクトリ側のメタデータ形式）

→ ドラフト段階であることを記録に明記すること。RFCではない。

---

## S5. Web Bot Auth アーキテクチャドラフト

- URL: https://datatracker.ietf.org/doc/html/draft-meunier-web-bot-auth-architecture-04
- 種別: 一次（IETF Internet-Draft）
- 参照日: 2026-08-08（本文未取得、IETF 124発表資料経由で版数を確認）

確認できた記述:

- RFC 9421のHTTPメッセージ署名を、ブラウザ向けサイトに対する非ブラウザクライアントの認証に使う
- 発見に `Signature-Agent`、追加パラメータの要求に `Accept-Signature`、リプレイ防止に nonce を使う

→ 本文を取得していないため、この項目のみ根拠の強さが他と異なる。実装の根拠に使う場合は本文取得後に昇格させること。

---

## S6. Monetization Gateway（blog）

- URL: https://blog.cloudflare.com/monetization-gateway/
- 種別: 一次（Cloudflare公式blog、2026-07-01）
- 参照日: 2026-08-08

確認できた記述:

- Pay Per Crawlの次の段階として、クローラーへのコンテンツ課金だけでなく、API・データ・MCPツール呼び出しなど、Cloudflare配下の任意のリソースに対して任意の呼び出し元へ課金できるようにするもの。決済の仕組みを自前で作る必要がない
- x402の流れ: クライアントが課金対象リソースを要求すると、サーバは200を返さず402 Payment Requiredと小さなペイロードを返す。ペイロードには価格、受け付ける資産、支払い先が入る。クライアントは支払い、支払い証明を添えて同じリクエストを繰り返す。facilitatorが検証し、サーバがリソースを返す
- 通常のHTTPリクエスト/レスポンスの中で完結し、チェックアウトページへのリダイレクトも別の決済APIの呼び出しもない
- 課金ルールの例: 特定ルートのVERB単位課金（`/api/premium/*` へのGET/POSTごとに$0.01など）、処理の重さに応じた可変価格、オリジンが返す401を402に差し替えて価格と支払い指示を返す
- ルールはダッシュボード、Cloudflare API、Terraformで設定できる
- 330都市以上のネットワーク上で動き、x402のハンドシェイクが買い手の近くで起きる

対応する実装: M2（402レスポンスの構成要素、課金ルール宣言ファイルの粒度）

→ **M2の一部が昇格対象**。402ペイロードが「価格・資産・支払い先」を含むこと、ルールの単位がルート×VERB×価格であることは `VERIFIED`（根拠: S6）。ただし **Gatewayのルール記述のスキーマそのものは公開されていない** ため、自社定義のルールファイル形式は `UNVERIFIED` のまま据え置くこと。

---

## S7. Cloudflare Agents docs の x402 ページ

- URL: https://developers.cloudflare.com/agents/x402
- 種別: 一次（Cloudflare公式docs）
- 参照日: 2026-08-08

確認できた記述:

- x402は402 Payment Requiredを中心に据えたオープンな決済標準。サービスは402と支払い指示を返し、クライアントはアカウント・セッション・APIキーなしにプログラム的に支払う
- 用途として、Workerプロキシによる HTTPコンテンツのゲート、`paidTool` によるMCPツールの呼び出し単位課金、Agents SDKの `withX402Client` によるMCPクライアントのラップ、コーディングツール向けのOpenCodeプラグインとClaude Codeフックが挙げられている

対応する実装: M2（アダプタ境界の差し替え先候補）

---

## S8. AI Crawl Control の Worker テンプレート（docs）

- URL: https://developers.cloudflare.com/ai-crawl-control/reference/worker-templates
- 種別: 一次（Cloudflare公式docs）
- 参照日: 2026-08-08

確認できた記述:

- AI Crawl Controlのanalyticsでどのクローラーが来ているかを把握し、Workerテンプレートで扱いを変える構成
- `x402-proxy` テンプレートがx402による支払いゲートを実装する。クローラーのアクセスの収益化、特定ルートのペイウォール、botには課金しつつ人間は無料で通す用途が挙がっている

対応する実装: M4（AI Crawl Control側の位置づけ）

---

## S9. Cloudflare Wallets / cloudflare.pay（press release）

- URL: https://www.cloudflare.com/press/press-releases/2026/cloudflare-gives-ai-agents-an-identity-and-a-wallet/
- 種別: 一次（Cloudflare公式press release、2026-08-04）
- 参照日: 2026-08-08

確認できた記述:

- Cloudflare上に配置されたエージェントに、安定した識別子と、人間の設定した制限の範囲内で購買する能力を与えるもの
- Cloudflareアカウントに一意のWebアドレスが付き、安定したIDとして働く。識別を個々のエージェントに拡張でき、リクエストを受けた事業者は誰が承認したのかを確認できる
- Account Walletが中心の残高として働き、stablecoinの受領・保有・管理を行う
- そこから個々のエージェントにVirtual Walletを割り当て、エージェントはオンライン上のリソースに対して支出する
- Virtual Walletには最初からguardrailsが入る。ユーザーは支出上限、承認済みマーチャントのリスト、エージェントが単独で超えられない1回あたりの上限額を定義できる
- Monetization Gatewayと組み合わせることで、エージェント決済の売り手側と買い手側が揃う
- 現時点で開始しているのはハンドルの予約。資金の入出金とVirtual Walletの発行を含む全機能は今後数ヶ月のうちに提供される
- press release全体がforward-looking statementsの注記付き

対応する実装: M3（ポリシーの3項目）

→ **M3の一部が昇格対象**。「承認済みマーチャントのリスト」「1回あたりの上限」「支出上限」という3種の制御が存在することは `VERIFIED`（根拠: S9）。一方で **フィールド名・型・API・スキーマは一切公開されていない** ため、`x402inc.spend-policy/v0` と `x402inc.payee-allowlist/v0` は `UNVERIFIED` のまま据え置くこと。用語をCloudflare側の語に寄せて確定仕様に見せないこと。

---

## 未取得（次の取得対象）

以下は今回取得していない。該当する実装のラベルは据え置く。

- Content Signals Policy の一次情報（トークン語彙の定義元）→ M4の `UNVERIFIED` は据え置き
- 2026-09-15のmixed-useクローラーのデフォルト変更に関するCloudflare公式の一次情報 → M4の記録は事実の記載のみを維持し、コード側で挙動を断定しない
- deferred payment scheme の提案本文 → M5の `PENDING-B` は据え置き。後払い・バッチ集約の実装は引き続き書かない
- pay per crawl（https://blog.cloudflare.com/introducing-pay-per-crawl/）
- x402 Foundation 関連（https://blog.cloudflare.com/x402/）

---

## 実装が依拠する公開標準

コードは以下の安定した公開標準に対して実装している（コードコメントに spec basis として明記）。これらは本環境で再取得したものではなく、確立された技術知識から参照している。標準からのCloudflare固有の逸脱は `PENDING-B` / `UNVERIFIED` とし、`VERIFIED` にはしない。

| Standard | Used by | Note |
|---|---|---|
| RFC 9421 — HTTP Message Signatures | M1 Web Bot Auth | Signature-Input / Signature 構築、`@`派生コンポーネント。 |
| RFC 8032 — EdDSA (Ed25519) | M1 | 鍵生成・署名アルゴリズム。 |
| RFC 7517 / RFC 8037 — JWK / OKP keys | M1 | Ed25519公開鍵ディレクトリ（JWKS）の形。 |
| RFC 7638 — JWK Thumbprint | M1 | `kid` に用いる（採用は自社判断・UNVERIFIED）。 |
| RFC 9309 — Robots Exclusion Protocol | M4 | robots.txt文法。 |
| RFC 7231 §6.5.2 — HTTP 402 Payment Required | M2 | チェッカが表明するステータスコード。 |

---

## この実行環境からの取得可否（経緯）

一次情報の取得は**リポジトリの実行環境の外で**行った。実行環境自体はCloudflareドメインへの egress が遮断されており（開いたWebに到達できず、パッケージレジストリのみ到達可能）、環境内からは一次情報を取得できなかった。**到達できなかったこと自体を記録として残す。**

環境内からの取得試行はいずれも `EGRESS_BLOCKED` を返した（2026-08-08）。生ログ: [`evidence/_meta/2026-08-08/source-retrieval-attempts.txt`](../evidence/_meta/2026-08-08/source-retrieval-attempts.txt)。

| # | Framework | URL | 環境内での取得試行 | 環境外での取得 |
|---|---|---|---|---|
| 1 | Web Bot Auth (docs) | https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth | UNREACHABLE (egress blocked) | S1 で取得済 |
| 2 | verified bots with cryptography (blog) | https://blog.cloudflare.com/verified-bots-with-cryptography/ | UNREACHABLE (egress blocked) | S2 で取得済 |
| 3 | web-bot-auth 参照実装 (repo) | https://github.com/cloudflare/web-bot-auth | UNREACHABLE (egress blocked) | S3 で取得済 |
| 4 | Monetization Gateway (blog) | https://blog.cloudflare.com/monetization-gateway/ | UNREACHABLE (egress blocked) | S6 で取得済 |
| 5 | Cloudflare Agents x402 (docs) | https://developers.cloudflare.com/agents/x402 | UNREACHABLE (egress blocked) | S7 で取得済 |
| 6 | AI Crawl Control worker templates (docs) | https://developers.cloudflare.com/ai-crawl-control/reference/worker-templates | UNREACHABLE (egress blocked) | S8 で取得済 |
| 7 | Cloudflare Wallets / cloudflare.pay (press) | https://www.cloudflare.com/press/press-releases/2026/cloudflare-gives-ai-agents-an-identity-and-a-wallet/ | UNREACHABLE (egress blocked) | S9 で取得済 |
| 8 | signed agents (docs) | https://developers.cloudflare.com/bots/concepts/bot/signed-agents | UNREACHABLE (egress blocked) | 未取得（据え置き） |
| 9 | signed agents (blog) | https://blog.cloudflare.com/signed-agents/ | UNREACHABLE (egress blocked) | 未取得（据え置き） |
| 10 | pay per crawl (blog) | https://blog.cloudflare.com/introducing-pay-per-crawl/ | UNREACHABLE (egress blocked) | 未取得（据え置き） |
| 11 | x402 / Cloudflare (blog) | https://blog.cloudflare.com/x402/ | UNREACHABLE (egress blocked) | 未取得（据え置き） |

---

## VERIFIEDへの昇格手順（残りの区分B）

未取得の一次情報（上表の「未取得」および `未取得（次の取得対象）` 節）については、次の手順で昇格する。

1. egress の開いた環境からURLを取得する。
2. 生の本文を `evidence/<framework>/<YYYY-MM-DD>/` に保存する。
3. 参照日を記録し、本ファイルに項目（S番号）を追加する。
4. 該当する `docs/conformance/<framework>.md` の「対象仕様」節に引用と根拠ソースIDを入れ、対応する `PENDING-B` / `UNVERIFIED` マーカーを、本文が支持する範囲でのみ `VERIFIED` に変更する。
