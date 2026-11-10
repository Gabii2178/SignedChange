# Website blueprint

New public pages use `https://signedchange.com` in copy and canonical plans. Do not edit the live canonical tags, `site/CNAME`, or PayPal return URLs in Milestone 4’s first pass unless that work is explicitly separated. The visual spec assumes the public origin is signedchange.com. The frozen payment links stay whatever `site/app.js` already posts.

## Header

64 px navy. Horizontal dark logo. Links: Product, Solutions, Resources, Pricing, About. Tertiary “Account” opens the app key screen. Accent button “Create a change record”.

Desktop width: content 1120 px. Link gap 24 px.

## Homepage

1. Hero, two columns from 768 px. Left: H1 “When agreements change, make it official.” Lead: “Put the change in writing. Get both sides to sign. Keep a record you can both open.” Primary “Create a change record”. Secondary “See how it works”. Right: a product image of the review sheet, max 480 px, not a stock photo. The current `demo.mp4` may stay as a control below the hero, 280 px wide, with a visible play button. It is not the hero.
2. Problem. One column, 720 px. Three examples: extra work, a new price, a new date. Each is two sentences.
3. How it works. Four steps in a row from 768 px, stacked below: Write, Review, Sign, Download. Each step is an H3 and one sentence.
4. Solutions. Four cards: contractors, freelancers, employers, agencies. Same wizard, different template name.
5. What you keep. A definition list: names, the change, amount, signatures, the public verify page. Do not say the record is legally certified.
6. Trust. Short statements that match the product: the signing link is the other person’s access, documents can be deleted by the owner, verification can be unavailable (`503`), a mismatched record is rejected (`409`). Link to the privacy page.
7. Pricing. Three cards, current offers only.
8. FAQ. The existing questions, in a single column. Then the accent button again.

Section gap: 48 px mobile, 64 px desktop. Page margin: 16 / 24 / 32 px.

## Other marketing pages

| Page | Content |
|---|---|
| Product | How it works, what is stored, what verify shows, a sample PDF link that already exists |
| Solutions | The four audiences, each linking to the app with the existing `template` query if that template exists |
| Resources | Free tools, guides, blog. Tools stay browser-only calculators |
| Pricing | The three plans below |
| About | Who operates the product, contact |
| FAQ | The homepage questions plus signing and deletion |
| Contact | The published support address already on the site. No new form that stores messages unless a later milestone adds an API |
| Account entry | Explains the existing private key. Not a password form |

## Pricing presentation

Do not change amounts or what they buy.

| Plan | Price | What the card says |
|---|---|---|
| Free | $0 | 3 documents. The server counts creates, not files left after delete |
| Pro Monthly | $9 per month | Unlimited documents while the subscription is active. Cancel in PayPal |
| Pro Lifetime | $49 once | Unlimited documents for this account while the service runs |

Cards are equal height from 768 px. Lifetime has a “Best value” badge that is text, not a ribbon that covers the price. The buttons on the marketing page go to the app. The app’s existing PayPal buttons stay the payment UI. Do not redraw them as a new checkout.

## Footer

Navy `#0E1A27` if the page is light, or the dark surface. Columns: Product, Company, Legal. Legal includes privacy and terms. Cookie settings stays a button. Muted footer text uses `#C5D0DC` on `#0E1A27` (11.23:1).
