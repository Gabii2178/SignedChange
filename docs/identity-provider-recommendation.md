# Identity provider recommendation

This is a recommendation for a later decision. No provider is integrated. Verification stays optional, and a browser request still cannot mark an account verified.

Prices and document lists below were checked against vendor or secondary pages in November 2026. They can change. The owner should confirm coverage and a written price before any contract.

## Recommendation

Use Smile ID if the owner wants the first real check to work for Cameroon documents. Use Persona instead if the owner wants a larger global vendor and accepts that Cameroon document types must be confirmed on a current coverage list before launch.

Do not use a payment company’s identity product for this. The payment freeze stays in place, and this check is not a checkout.

## Smile ID

- Site: https://smile.id/countries/cameroon and https://docs.usesmileid.com/
- Countries and documents: Smile ID’s document list, last noted by its own docs as checked in June 2026, includes Cameroon national ID, driver’s licence, passport, resident ID, travel document, and voter ID. The Cameroon product page also describes those document checks plus a selfie comparison.
- Verification quality: document authenticity, text extraction, and a selfie compared with the document photo. The vendor states ISO 27001 and SOC 2. That claim is the vendor’s, not an audit performed here.
- Fraud signals: document authentication and face match. A manual-review path should be part of the contract. This product does not become fraud-proof by adding it.
- API: server-side job creation, a hosted or SDK capture so SignedChange does not store the ID image, and a signed webhook for the result. The existing callback shape can carry that signed result. `VERIFIED` would still be set only after the signature check.
- Data: the vendor processes the images. SignedChange should keep status, a provider reference, and the time. It should not copy the ID image or the full ID number into KV.
- Privacy: ask for the retention period, deletion process, and where images are stored. Cameroon’s data-protection rules need a lawyer’s reading before launch. Do not describe the check as proof of residence.
- Price: Smile ID does not publish a per-check price. A secondary review on 26 October 2026 said the pricing page sends buyers to a sales conversation. Budget a quote, not a guessed unit price.
- Reliability: hosted capture and webhooks need a retry and a manual-review queue. If the webhook never arrives, the account stays `PENDING` and then `EXPIRED`. The account keeps working.
- Recovery: declined and uncertain results map to `REJECTED` and `REQUIRES_REVIEW`. A person can start again. Invited signers never enter this flow.

## Persona, as the alternative

- Site: https://withpersona.com/pricing/ and https://docs.withpersona.com/
- Countries: Persona markets identity checks across a very wide country list that includes Cameroon. The public country list does not, by itself, name which Cameroon documents can be read. Confirm the national ID, passport, and driver’s licence on a current coverage export before choosing it.
- Verification quality: government ID, selfie, and configurable review cases. The vendor publishes SOC 2 Type 2, GDPR/CCPA, and optional EU hosting.
- API: inquiries, webhooks, and a dashboard review queue. The same rule applies: only a signature-checked webhook may set `VERIFIED`.
- Price: Persona’s Essential plan help page describes $250 per month on an annual contract, including 500 verifications or reports, then $1.50 each. Unused included checks do not roll over. Growth pricing is custom.
- Gap: weaker public evidence that Cameroon’s national ID is a first-class document, compared with Smile ID’s named list.

## What not to do yet

- Do not enable `IDENTITY_MOCK` outside tests.
- Do not store raw ID images or full ID numbers.
- Do not block document creation or invited signing on this check.
- Do not sign a contract until the owner accepts the vendor, the price, and the document list in writing.
