# Identity provider evaluation

SignedChange does not integrate an identity provider yet. This is the checklist for a later owner decision. It is not a recommendation of a vendor, and it does not claim that any provider covers Cameroon.

A provider can be considered only after the owner approves the vendor and its cost. Until then, account identity status stays `NOT_STARTED` or `PENDING`. The product must not mark an account `VERIFIED` from a browser request.

## Questions

- Which countries and which identity documents can the provider check?
- What does a pass, a fail, and a manual review mean in the provider's result?
- Which fraud signals does the provider return, and which of those would SignedChange store?
- How is the API authenticated, and how is a webhook signature checked?
- Where is the data processed, how long does the provider keep it, and can a person ask for deletion?
- What privacy notice and consent text are required before a check starts?
- What is the price of a check, and who pays it?
- What happens when the provider is down, and how does a person reach manual review?
- Can the result be stored as a status only, without an ID image or a full ID number?

## Product rules that stay in force

- Ordinary accounts work without a verified status.
- An invited signer uses the signing link and does not create an account.
- Public document verification does not show identity documents or this status.
- No raw IP address is stored for this check.
