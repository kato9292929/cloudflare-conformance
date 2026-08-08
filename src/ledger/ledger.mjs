// Agent spending ledger — an append-only record of an agent's outbound payments.
//
// The deferred payment scheme is a PROPOSAL to x402 with no finalized spec, so
// this module deliberately writes NO deferred/batch settlement behavior. The one
// thing M5 verifies is that the ledger's data structure can ACCOMMODATE a
// settlement type other than "single immediate settlement" WITHOUT a schema
// change — i.e. that `settlement.type` is a real extension point rather than a
// hardcoded assumption.
//
// Concretely: each ledger entry carries a discriminated `settlement` object, and
// each ledger instance has a per-instance registry of known settlement types.
// Only `immediate` is registered by default. An entry whose settlement.type is
// not registered is REJECTED LOUDLY (never silently accepted, never guessed).
// Registering a new type is how a future `deferred`/`batch` scheme would plug in
// once its spec is finalized — the entry schema itself does not change.
//
// The entry schema is SELF-DEFINED; field names do not mimic any x402 proposal
// terminology.
// CONFORMANCE-TAG: UNVERIFIED | framework=deferred-payment | ledger-entry schema (x402inc.ledger-entry/v0) is self-defined; settlement.type is an explicit extension point but NO deferred/batch settlement logic is implemented (proposal stage, no finalized spec) — unregistered settlement types are rejected loudly, not guessed | ref=src/ledger/ledger.mjs

const ENTRY_SCHEMA = 'x402inc.ledger-entry/v0';

// Create a ledger. Each ledger owns its settlement-type registry, pre-seeded with
// `immediate` only. This is the extension point: `registerSettlementType` adds a
// new type without touching the entry schema or the append path.
export function createLedger() {
  const entries = [];
  const ids = new Set();
  const settlementTypes = new Map();

  function registerSettlementType(type, validate) {
    if (typeof type !== 'string' || type === '') throw new Error('registerSettlementType: type must be a non-empty string');
    if (settlementTypes.has(type)) throw new Error(`registerSettlementType: "${type}" already registered`);
    if (typeof validate !== 'function') throw new Error('registerSettlementType: validate must be a function');
    settlementTypes.set(type, validate);
  }

  // `immediate` = the payment is settled at the moment it is recorded. This is the
  // ONLY settlement type this repo implements; it is the baseline the extension
  // point is measured against.
  registerSettlementType('immediate', (s) => {
    // No extra required fields beyond `type`; a settledRef is optional.
    if (s.settledRef !== undefined && typeof s.settledRef !== 'string') {
      throw new Error('settlement(immediate): settledRef must be a string when present');
    }
  });

  function appendPayment(entry) {
    validateEntryShape(entry);
    if (ids.has(entry.id)) throw new Error(`ledger: duplicate entry id "${entry.id}"`);

    const type = entry.settlement.type;
    const validate = settlementTypes.get(type);
    if (!validate) {
      throw new Error(
        `ledger: unknown settlement.type "${type}" — not registered. ` +
          'Deferred/batch settlement is a proposal with no finalized spec and is intentionally not implemented; ' +
          'register the type explicitly once its spec exists (see docs/conformance/deferred-payment.md).'
      );
    }
    validate(entry.settlement);

    const stored = {
      schema: ENTRY_SCHEMA,
      seq: entries.length,
      id: entry.id,
      ts: entry.ts,
      payeeId: entry.payeeId ?? null,
      payTo: entry.payTo,
      amountAtomic: entry.amountAtomic,
      asset: entry.asset,
      network: entry.network,
      settlement: { ...entry.settlement },
      ref: entry.ref ?? null,
    };
    entries.push(stored);
    ids.add(entry.id);
    return stored;
  }

  // Aggregate spend. Sums are BigInt string math (no float). Keyed by
  // "<network>:<asset>" and broken down by settlement type.
  function totals() {
    const byAssetNetwork = {};
    const bySettlementType = {};
    for (const e of entries) {
      const key = `${e.network}:${e.asset}`;
      byAssetNetwork[key] = (BigInt(byAssetNetwork[key] ?? '0') + BigInt(e.amountAtomic)).toString();
      const t = e.settlement.type;
      bySettlementType[t] = (BigInt(bySettlementType[t] ?? '0') + BigInt(e.amountAtomic)).toString();
    }
    return { count: entries.length, byAssetNetwork, bySettlementType };
  }

  // Total settled atomic amount for one (asset, network) — the value that feeds
  // the M3 spend policy's running-total check.
  function spentAtomic(asset, network) {
    let sum = 0n;
    for (const e of entries) {
      if (e.asset.toLowerCase() === asset.toLowerCase() && e.network === network) sum += BigInt(e.amountAtomic);
    }
    return sum.toString();
  }

  return {
    appendPayment,
    registerSettlementType,
    totals,
    spentAtomic,
    knownSettlementTypes: () => [...settlementTypes.keys()],
    entries: () => entries.slice(),
  };
}

function validateEntryShape(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('ledger: entry must be an object');
  for (const f of ['id', 'ts', 'payTo', 'amountAtomic', 'asset', 'network', 'settlement']) {
    if (entry[f] === undefined || entry[f] === null) throw new Error(`ledger: entry.${f} is required`);
  }
  if (typeof entry.amountAtomic !== 'string' || !/^\d+$/.test(entry.amountAtomic)) {
    throw new Error(`ledger: entry.amountAtomic "${entry.amountAtomic}" must be an atomic-unit integer string`);
  }
  if (typeof entry.settlement !== 'object' || typeof entry.settlement.type !== 'string' || entry.settlement.type === '') {
    throw new Error('ledger: entry.settlement.type must be a non-empty string');
  }
}
