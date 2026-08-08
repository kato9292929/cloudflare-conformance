# Cloudflare Wallets / cloudflare.pay

## 対象仕様
- Cloudflare Wallets / cloudflare.pay (press): https://www.cloudflare.com/press/press-releases/2026/cloudflare-gives-ai-agents-an-identity-and-a-wallet/ — 参照試行 2026-08-08, **取得不可（egress blocked）**
- Virtual Wallet の構造（上限額・承認済みマーチャントのリスト・1回あたりの上限）はタスク前提として与えられているが、一次情報の本文は未取得。

公開状態: 2026-08-04発表、ハンドル予約のみ開始。資金投入・支出・API仕様は未公開（タスク前提）。よって入力ポリシー・出力（許可先リスト）スキーマはともに自社定義（UNVERIFIED）とし、Cloudflareの用語に似せない。

## 実装したもの
実装は「自社定義のスペンドポリシー → 承認済み支払先リスト（allowlist）生成 ＋ ローカルでの支払い可否判定」に限定し、Cloudflare Wallets API には触れない（未公開のため）。

- `src/wallet/policy.mjs`
  - `x402inc.spend-policy/v0`（入力・自社定義）の読み込みと**厳格な**検証（`validatePolicy`）。スキーマ不一致・非十進金額・payee id/payTo 重複・per-transaction > total などの矛盾は握りつぶさず throw。
  - `buildAllowlist(policy)`：`x402inc.payee-allowlist/v0`（出力・自社定義）を生成。金額は `x402/rules.mjs` の `decimalToAtomic` を再利用し BigInt で atomic 変換（浮動小数を使わない）。payee ごとの上限上書きを反映。
  - `evaluatePayment(policy, request, state)`：単一支払いの可否を「許可先か／ネットワーク・アセット一致／1回上限／累計上限」で判定。**拒否は理由つきの戻り値**（402 checker と同じ姿勢）、**入力の異常（不正金額・payTo 欠落）は throw**。
- `src/wallet/wallet-adapter.mjs`：M2 と同じアダプタ境界。`localAllowlistProvider`（実装済）と `cloudflareWalletsProvider`（未実装・throw・区分B）。
- `scripts/gen-allowlist.mjs`（`npm run allowlist`）：ポリシーパスを**CLI引数**で受け取り（実データは endpoint リポジトリ等を指す前提でコミットしない）、allowlist を `out/wallet/` に出力し、サンプル支払いの許可/拒否を表示。
- `data/spend-policy.json`：明らかに合成のサンプル（アドレスは `0x1111…`〜`0x3333…`）。
- テスト：`test/wallet.test.mjs`（`node:test`、外部依存なし）。

## この環境で確認したこと
- `npm test`：全 46 テスト green（うち M3 分 13）。生ログ: [`evidence/cloudflare-wallets/2026-08-08/test-output.txt`](../../evidence/cloudflare-wallets/2026-08-08/test-output.txt)。
- `npm run allowlist`：allowlist 生成とローカル判定（allow / per-transaction 超過 / payee 上書き上限超過 / 非許可先 / 累計上限超過）を実演。生ログ: [`evidence/cloudflare-wallets/2026-08-08/gen-allowlist.txt`](../../evidence/cloudflare-wallets/2026-08-08/gen-allowlist.txt)、生成物: [`payee-allowlist.json`](../../evidence/cloudflare-wallets/2026-08-08/payee-allowlist.json)。
- 確認した範囲はローカル実装のみ。実 Virtual Wallet への反映・実支払いは**この環境では未確認**（区分B）。

## 未消化（区分B）
- 実際のVirtual Walletへの許可先リスト投入（Cloudflare Wallets API 未公開）。
- API仕様の一次情報取得（press リリース本文が egress blocked）。
- 実データ（endpoint リポジトリの `data/endpoints.json` 等）を入力にした生成。

<!-- CONFORMANCE-TAG: PENDING-B | framework=cloudflare-wallets | live injection of the generated payee-allowlist into a Cloudflare Virtual Wallet and real spend authorization are unverified here — the Wallets funding/spend/API spec is unpublished (handle reservation only) and the press release body was egress-blocked | ref=docs/sources.md -->

## 自社定義（UNVERIFIED）
- 入力スキーマ `x402inc.spend-policy/v0` と出力スキーマ `x402inc.payee-allowlist/v0`。フィールド名は Cloudflare Wallets の用語を意図的に模倣していない。マーカーは `src/wallet/policy.mjs` にコード側と対で記載。
- `cloudflareWalletsProvider` は未実装で throw する（`src/wallet/wallet-adapter.mjs`、区分B マーカー）。
