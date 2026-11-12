# Counterproposal and version history

This is the design for the negotiation model. The implementation follows it. It does not replace the existing sign, decline, cancel, or delete rules.

## What stays

The Durable Object named `sign:{documentId}` remains the authority. Workers KV `doc:{id}` remains the current body. A terminal signed, declined, cancelled, or deleted decision is still made in one storage transaction, and KV is updated afterward. If the object is unreachable, the mutation returns 503 and does not write KV. A signed body stays immutable. Cancel and delete stay owner-only. An invited person still uses the signing link and does not create an account. Public verification does not receive the negotiation thread.

## Data model

Version 1 is the document created by the account holder. Each later proposal is a new version. Nothing writes over an earlier version.

The current KV body gains these fields. They are not part of the content fingerprint:

- `version` — current version number, starting at 1.
- `template` — starting-point id, or `custom` for Blank and for older clients that omit it.
- `ownerApprovedHash` — the content fingerprint the account holder has signed. It is set when they create or when they accept or counter. An invited counter clears it.

The content fingerprint (`hash`) and, once signed, `finalHash` still cover the terms and the signatures. They do not cover the version number. Changing the terms produces a new fingerprint.

The Durable Object stores `versions`, an append-only list. Each entry is:

- `n` — version number
- `parent` — previous version number, or null for version 1
- `docId` — the thread id, which is the document id
- `by` — `owner` or `invitee`
- `at` — timestamp
- `action` — `create`, `counter`, `accept`, `sign`, or `decline`
- `hash` — content fingerprint of that version
- `template`
- `fields` — the terms of that version

KV key `ver:{documentId}:{n}` receives the same entry after the transaction commits. A write of that key happens only when it is absent. The object is the authority if KV is behind.

The current signing token is stored only as `signHash` on the current body, as it is today. A counter replaces that hash. The previous token cannot open or sign the new version.

## Transitions

All of these run inside the existing lifecycle transaction.

| Action | Who | Rule |
|---|---|---|
| Create | Account holder | Version 1. Their signature approves that fingerprint. Status is pending, or signed immediately for in-person. |
| Counter | Account holder, or the invited person who holds the current token | Document must be pending. `baseHash` must equal the current fingerprint. Version `n+1` is appended. The proposer’s terms are stored. The other party’s approval of the old fingerprint is cleared. A new signing token is issued. |
| Accept | Account holder | Their signature is stored against the current fingerprint only. It does not sign for the invited person. |
| Sign | Invited person, current token | The submitted fingerprint must equal the current body. The account holder must already have approved that same fingerprint. The signed record is terminal. |
| Decline | Invited person, current token | The current version is marked declined. Older versions remain. The link is finished. |
| Cancel or delete | Account holder | Unchanged. History is kept until delete removes the document keys. |

A second counter whose `baseHash` is stale returns 409. It does not create another version. A signing link from version `n` fails token verification on version `n+1`.

## Both parties, one version

The invited signature is accepted only when `ownerApprovedHash` equals the current content fingerprint. Creating a document sets that equality. An invited counter clears it, so the old signature no longer approves the new terms. The account holder accepts the new fingerprint, and only then can the invited person sign it. The signed `finalHash` is computed from that content fingerprint and the two signatures, as it is today.

## Compatibility

Documents created before this change have no `version` and no `ownerApprovedHash`. They are treated as version 1, and the invited person can still sign them. New documents write version 1 explicitly. Existing sign, decline, cancel, and delete tests do not send a counter, so their results stay the same.

## What public verification shows

Status, the current fingerprints, and the parties already shown. It does not show the version list, earlier terms, or the signing token.
