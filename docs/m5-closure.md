# M5 final closure

## Deferred redesigns

These redesigns are future work, not failed M5 requirements. Their existing pages stay as they are, and their existing wording is available in French:

- Blog redesign
- Calculator redesign
- Landing-page redesign
- Locations redesign
- Statistics redesign

## French

Interface language is English or French (`localStorage` key `sc_lang`). It persists across pages and reloads. Agreement language is separate. Changing the interface language does not rewrite a draft the person already edited, and it does not change a signed record or its fingerprint.

Product-authored starter text is written into a new agreement only when the agreement language is French and the form still contains the product starter.

The French wording of templates, guides, and legal pages is a reading translation. It is not a certified legal translation and it does not add a legal guarantee.

## Signing status

When the lifecycle has accepted a signature but the stored record has not caught up, status and public verify return `confirming`. They do not say the document is signed, and they do not say coordination is unavailable. A consistent local store reports `signed` immediately.

## Product email

The only product email in the worker is the Pro welcome message, which is sent only after a payment grant. It was not edited in this closure pass.
