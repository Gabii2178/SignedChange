# Document lifecycle coordination

Milestone 1 coordinates signing, decline, cancellation, and deletion for one document. Payment, gift, and usage counters do not use this protocol. They still call `claim`, `use`, `unuse`, `get`, and `revoke` on other Durable Object names.

## What is authoritative

Workers KV is eventually consistent. A write is usually visible in the same location and can take about 60 seconds to show up elsewhere. A read can return a stale body or a stale "missing" result. KV is not a transaction. Source: Cloudflare KV, "How KV works" (consistency section).

Durable Object storage is strongly consistent for that object and survives eviction. In-memory fields do not. The configured compatibility date stays `2024-09-23`. `GiftLock` is already declared with `new_sqlite_classes` and keeps using the async storage key-value API (`get` / `put` / `transaction`). No new migration and no new compatibility date were added. Current Durable Object guidance says not to hold `blockConcurrencyWhile()` across a Workers KV call on every request, and says a storage transaction is the atomic read-modify-write primitive. This protocol follows that: the decision is committed in a storage transaction, and the KV write happens after.

The Durable Object record `life` on the object named `sign:{documentId}` is the authority for status. KV `doc:{id}` is the body. Those two are not one atomic commit.

## Protocol

1. Read KV. The value may be stale. It is never trusted over `life`.
2. In one `storage.transaction`:
   - Load `life`. If a legacy `claim` exists and the body is still `pending`, mark the document consumed and do not start a second signature. The old signer path stored the view key in `claim` and this worker no longer writes that key for new signatures.
   - If there is no `life` and no body, return not-found and do not write a tombstone. A missing body can be replication lag after create.
   - If the body exists and there is no `life`, bootstrap from that body.
   - Owner cancel and delete require the authenticated account to match the body or the stored owner. Anyone else's request is not-found and does not change state.
   - Delete of a document this account owns, including one that is already signed, declined, or cancelled, stores a `deleted` tombstone and drops any in-flight signature payload.
   - Sign, decline, and cancel of a non-terminal document validate the fresh body (token hash, expiry, consent, PNG, content hash) and store the terminal decision, including the view key and signature hash for a signature. The signature image is stored only under `pendingSig` until KV acknowledges it, then deleted.
3. Write KV to match `life`: put the cancelled, declined, or signed body, or delete the document, attachment, and index keys.
4. Acknowledge with a second transaction that sets `kvGen = gen` only if `life.gen` is still the generation just written. If a newer generation won, this attempt does not acknowledge the old one.
5. On the next call, if KV does not match `life`, heal KV. A deleted tombstone deletes a resurrected key. A stale pending body cannot become signed once `life` says cancelled or deleted.

Retries of the same sign, after a failed KV write, reuse the stored view key and finish the same body. After `kvGen` has caught up, a repeated sign or decline returns the existing one-time error (`410`). A repeated cancel returns `409`. A repeated delete returns `404`. The link format `sign.html#d=&t=` and the view bookmark `sign.html#d=&v=` are unchanged.

If the Durable Object binding is missing, the storage transaction API is missing, or the object cannot be reached, the mutation returns `503` and does not write KV. There is no fallback to the old read-modify-write path.

`GET /doc/get` uses the same object. A terminal decision is honored even when KV still looks pending. If coordination is down, that read fails closed with `503`.

## Verification and listing (milestone 2)

`GET /doc/verify`, `GET /doc/status`, and `GET /doc/pdf` call the same `peek` operation. They do not treat a KV body as the decision.

- A deleted tombstone is not found, including when a stale body is still in KV. The peek heals that key away when it can see it.
- A terminal `life` status is published only when the KV body has that same status after the peek. If the body is still behind, the response is `503`, not a mixture of an old body and a new status.
- If the Durable Object cannot be reached, those three routes return `503`. They do not fall back to KV.
- Verify, status, and PDF recompute the content fingerprint, the signed-record fingerprint when one is stored, and each attachment fingerprint. A mismatch is `409`. A signed body with no signed-record fingerprint is `503`.
- The PDF is still rendered on read. The check refuses a body that does not match its stored fingerprints. It does not freeze PDF bytes against a future renderer change.
- KV itself can still be stale for up to about 60 seconds in another location. The coordinator's read is not a strongly consistent KV read. Healing runs when a peek or mutation observes the disagreement.

`GET /account/me` lists `adoc:{account}:` in lexicographic order. Those keys are newest-first because the timestamp portion is inverted. The default page size remains 50 and the existing fields are unchanged. Optional `limit` (1–50) and `cursor` select a page. `nextCursor` is present only when another page exists. A cursor is bound to the authenticated account and to that limit; any other cursor is `400`. The account id in the prefix comes from the bearer key, not from the query string. Rows whose tombstone is deleted are omitted. A row whose body disagrees with a terminal `life`, or whose coordinator is down, fails the list with `503` instead of showing the stale row.

A document created or deleted while someone is turning pages can be skipped or repeated. A key that sorts before the cursor will not appear on a later page, and KV may keep a deleted index key until that cache expires. The list does not scan the whole account.

## Failure recovery

| Failure | State left behind | Next call |
|---|---|---|
| Crash before the `life` transaction commits | KV unchanged | The operation starts over |
| Crash after `life` commits and before the KV write | Decision durable, body old, `pendingSig` kept for a signature | Same operation finishes the body and returns the original sign result. A delete from the owner replaces that decision with a tombstone |
| Crash after the KV write and before ack | Body already matches, `kvGen` behind | Ack, or heal if the body was overwritten |
| KV write throws | Same as a crash before the write | `503`. Retry finishes one body |
| Stale KV read | Ignored when `life` is terminal | Heal toward `life`, never back to pending |
| Delete wins, then an old sign write lands | Tombstone is newer | The sign acknowledgement fails. A later call deletes the key again |

Two-year `expirationTtl` and the rule that delete does not refund a free document are unchanged. Account bearer keys are unchanged. `proStatus`, PayPal IPN, PayPal REST, prices, and entitlement keys are not part of this path.
