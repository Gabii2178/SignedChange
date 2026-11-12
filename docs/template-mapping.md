# Template mapping

Inspected from `site/app.js` (`TPL`) and `site/templates.js` (`CATS`). The nine categories contain 45 named starting points. Blank is `custom`. `contractor` and `deposit` are existing extra starting points and are not catalogue cards. They use the same named-template rules so a direct request cannot skip them.

No template adds a private field. Every starting point uses the same document fields. The difference is which of those fields are required. Examples in the starter text are not legal terms and are not enforced as wording.

## Fields

Named starting points do not share one required list.

- Most named starting points require `title`, `job`, `biz`, `client`, `desc`, `price`, `currency`, and `date`.
- Schedule starting points `jobschedule`, `deadline`, `deliverydate`, and `course` require `title`, `job`, `biz`, `client`, `desc`, `date`, and `newDate`. A zero amount is allowed. A price above zero still needs a real currency.
- `duration` requires the shared money fields and `newDate`.
- A zero amount on any other starting point is accepted only when `priceDir` is `none`. An increase or decrease of zero is rejected.
- `currency` must be a real ISO 4217 code. `ZZZ` is rejected.

Required on Blank (`custom`): `biz`, `client`, `desc`, `price`, `currency`, `date`. `title` and `job` are optional. An empty title is stored as “Signed Change Record”.

Optional on every starting point: `bizCo`, `bizRole`, `contact`, `clientCo`, `clientRole`, `contractDate`, `origAmount`, `taxRate`, `newDate`, `daysAdded`, `payTerms`, `payCustom`, `payMethod`, `priceDir`, `lines`, `lang`.

Conditional, for every starting point:

- `clientContact` is required when the document is sent as a link, and optional in person. This is the existing delivery rule.
- `payCustom` is required when `payTerms` is `custom`.
- `price` may be zero when `priceDir` is `none`. Otherwise it must be a positive amount shaped like `250` or `250.00`.
- `newDate`, `contractDate`, and `date` must be real calendar dates. An impossible date such as 31 February is rejected.
- Square-bracket placeholders in the title, job, description, or custom terms are rejected until they are edited.

A field name that is not in this list is rejected when a starting point is named. It is not stored and it does not enter the fingerprint.

Omitting `template` is rejected with “Choose a starting point.” Explicit `custom` is Blank. Naming a starting point, including from a direct API call, enforces that starting point. An unknown id is rejected. A legacy record that has no template is left as stored and is not rewritten.

## The 45 catalogue starting points

| Id | Category | Required beyond the shared named set |
|---|---|---|
| freelance | Freelancers and creative work | None. Starter payment terms: completion. |
| designrev | Freelancers and creative work | None. Starter payment terms: completion. |
| webbuild | Freelancers and creative work | None. Starter payment terms: completion. |
| writing | Freelancers and creative work | None. Starter payment terms: completion. |
| photovideo | Freelancers and creative work | None. Starter payment terms: completion. |
| freelancemilestone | Freelancers and creative work | `payCustom` if the starter’s custom terms are kept. |
| software | Software, IT and digital services | None. Starter payment terms: net 30. |
| sitemaint | Software, IT and digital services | None. Starter payment terms: net 30. |
| saaschange | Software, IT and digital services | None. Starter payment terms: net 30. |
| itsupport | Software, IT and digital services | None. Starter payment terms: net 30. |
| techconsult | Software, IT and digital services | None. Starter payment terms: net 30. |
| construction | Construction, engineering and property | None. Starter payment terms: completion. |
| materials | Construction, engineering and property | None. Starter payment terms: completion. |
| renovation | Construction, engineering and property | None. Starter payment terms: completion. |
| propmaint | Construction, engineering and property | None. |
| landlord | Construction, engineering and property | None. |
| jobschedule | Construction, engineering and property | None. Starter price direction is “no price change”; a zero amount is valid only while that direction is kept. |
| duties | Employment and human resources | None. |
| employment | Employment and human resources | None. |
| compensation | Employment and human resources | None. |
| rolechange | Employment and human resources | None. |
| duration | Employment and human resources | None. |
| campaign | Agencies, marketing and media | None. Starter payment terms: net 30. |
| social | Agencies, marketing and media | None. Starter payment terms: net 30. |
| adbudget | Agencies, marketing and media | None. Starter payment terms: net 30. |
| branding | Agencies, marketing and media | None. Starter payment terms: net 30. |
| agency | Agencies, marketing and media | None. Starter payment terms: net 30. |
| supplier | Business operations and commerce | None. |
| purchase | Business operations and commerce | None. |
| deliverydate | Business operations and commerce | None. Starter price direction is “no price change”. |
| partner | Business operations and commerce | None. |
| consultant | Business operations and commerce | None. Starter payment terms: net 30. |
| smallbiz | Business operations and commerce | None. |
| installments | Finance and payment arrangements | `payCustom` if the starter’s custom terms are kept. |
| deadline | Finance and payment arrangements | None. Starter price direction is “no price change”. |
| paymiles | Finance and payment arrangements | `payCustom` if the starter’s custom terms are kept. |
| balance | Finance and payment arrangements | `payCustom` if the starter’s custom terms are kept. |
| training | Education, training and events | None. |
| course | Education, training and events | None. Starter price direction is “no price change”. |
| event | Education, training and events | None. |
| eventbudget | Education, training and events | None. |
| transport | Logistics and professional services | None. |
| servicemaint | Logistics and professional services | None. |
| hospitality | Logistics and professional services | None. |
| agriculture | Logistics and professional services | None. |

## Blank and the two extra starting points

| Id | Where it appears | Required |
|---|---|---|
| custom | Pinned Blank card | `biz`, `client`, `desc`, `price`, `currency`, `date`. Title and job optional. |
| contractor | Template list and `?template=contractor`, not a catalogue card | Same as a named starting point. |
| deposit | Template list and `?template=deposit`, not a catalogue card | Same as a named starting point. The starter text contains `[date]`, which the server rejects until the person replaces it. |

Starter payment terms and price direction are defaults the form fills in. The server does not lock a document to the starter’s payment term. It enforces the field types and the conditional rules above.
