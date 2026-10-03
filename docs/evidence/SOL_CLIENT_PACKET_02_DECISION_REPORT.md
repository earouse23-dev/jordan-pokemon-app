# SOL CLIENT-02 — Delivery and certificate-access decision report

Date: 2026-09-18; certificate-access follow-up updated 2026-09-18
Status: Capacitor direction approved subject to real-iPhone validation; certificate-access research only; no purchase, account action, application change, dependency, platform, provider request, or deployment

## Evidence controls

- Read `AGENTS.md`, `docs/MICA_SOFTWARE_ROADMAP.md`, `docs/MICA_CLIENT_PIVOT_2026-09-17.md`, and the accepted CLIENT-01 report before forming the recommendation.
- Inspected the current build, camera, Supabase session, owner-bound draft, service-worker, domain, and package configuration paths. This was read-only; the only changed file for CLIENT-02 is this report.
- Used official Apple, Capacitor, Supabase, PSA/Collectors, and Beckett material. No certificate account access or commercial license was inferred from public documentation.
- Made no provider request, pricing probe, credential read, dependency installation, platform creation, migration, paid-service action, or deployment.

## Recommendation

Use a **thin Capacitor 8 iOS container around the existing bundled web app**, with the web assets shipped inside the app rather than loaded from a remote `server.url`. Keep the existing Supabase data model and Vercel server APIs. Add only the native pieces the first beta actually needs:

- Capacitor core, CLI, iOS, App, and Preferences packages.
- A small app-local Swift Keychain bridge for Supabase session storage. Do not add a third-party secure-storage package.
- Universal links on a client-owned HTTPS domain for email confirmation, password reset, and session return.
- An approved HTTPS API origin for native builds so existing `/api/*` requests still reach the Vercel backend. Provider and service-role credentials remain server-only.

First test the existing `getUserMedia` live-camera flow in `WKWebView`, with `NSCameraUsageDescription` and the existing saved-photo fallback. Do **not** add Capacitor Camera yet: its documented contract is still-photo capture/picking, not a replacement for Mica's live-video frame flow. Also defer Capacitor Network; the existing online event plus real request failures is the smaller and more truthful recovery signal. Add either plugin only if the real-iPhone gate demonstrates a gap.

This is the smallest credible TestFlight route because it preserves the accepted product and pricing safeguards, supplies a signed iOS binary, can return from authentication links, protects refresh tokens with Keychain, and can be exercised on real hardware. Apple still decides whether it satisfies App Review guideline 4.2; integrated capture, durable signed-in work, and collection workflows must be evident in the review build.

### Viable alternative

| Route | Benefits | Costs and risks | Decision |
|---|---|---|---|
| Bundled Capacitor shell | Reuses the current UI and domain logic; one backend; smallest implementation and regression surface | Must validate camera behavior, lifecycle, and deep links in `WKWebView`; needs a native API base and secure session adapter | **Recommend for the first beta** |
| Native SwiftUI client using the same Supabase/Vercel backend | Best native lifecycle, camera, and platform fit | Rewrites and duplicates the current client, creates two UI implementations, and materially delays the first beta | Keep as a fallback only if the thin-shell device gate fails or Apple rejects the experience as insufficiently app-like |

A remote-hosted web view is not a credible third option: it makes launch depend on the network, allows deployed web behavior to drift from the reviewed binary, and increases the guideline 4.2 risk. A PWA is not a TestFlight binary.

## Current implementation and minimum delivery work

Repository inspection found a static JavaScript application built by esbuild, no iOS project, and no native dependencies. The existing code already provides live `getUserMedia` capture, `<video playsinline>`, camera switching, frame capture, a file-input fallback, Supabase authentication, owner-bound interrupted drafts, an online retry, and network-only handling for API routes in the service worker. Those behaviors should be reused, not replaced.

| Area | Minimum requirement before TestFlight | Real-iPhone acceptance check |
|---|---|---|
| Camera | Add `NSCameraUsageDescription`; keep the present web capture and saved-photo fallback; do not claim support until `WKWebView` testing passes | First prompt, allow, deny, revoke in Settings, retry, rear/front camera, rotation, background/resume, capture interruption, HEIC/JPEG import, and real PSA/BGS slabs |
| Authentication and session return | Register an HTTPS universal link, serve its `apple-app-site-association` file, add the Associated Domains entitlement and Supabase redirect allowlist entry, route it through Capacitor App, and resume the existing Supabase flow | Sign-up confirmation, password reset, cold-start link, warm return, background/foreground, token refresh, expired session, sign-out, and account switch |
| Secure storage | Replace browser `localStorage` for Supabase refresh/session tokens with a custom async Keychain-backed storage adapter; delete its entries on sign-out/account deletion. The publishable Supabase key may ship in the app; service-role and provider secrets may not | Session persists across relaunch; secrets are absent from app assets/logs; sign-out clears the session; a second account cannot restore the first account's private draft |
| Draft/preferences storage | Use Capacitor Preferences only for small non-secret interrupted-draft metadata and preferences because iOS may clear WebView local storage. Keep durable signed-in records in Supabase | Kill/relaunch and low-storage lifecycle; owner binding remains intact; no private draft crosses accounts |
| Network and recovery | Bundle the web shell; disable service-worker registration in the native shell; resolve `/api/*` to one approved HTTPS Vercel origin; rely on request failures and current retry before adding a network plugin | Offline launch, Wi-Fi/cellular transitions, airplane mode, timeout, 401/403/429/5xx, kill during capture/save, retry without duplicate records, and truthful sparse-price states |
| Signing and review | Active Apple Developer Program team, immutable bundle ID, App Store Connect app record, automatic signing, icons/launch assets, privacy manifest, privacy answers/policy URL, support URL, and review/demo account | Signed archive uploads and processes; internal install succeeds; external Beta App Review succeeds if external testers are used |
| Physical coverage | Test Jordan's target iPhone/iOS and one iOS 15 device if iOS 15 remains the claimed minimum. Simulator results are insufficient for camera and lifecycle acceptance | Complete the capture, auth, recovery, account-bound draft, and sparse-price matrix above on physical devices |

Capacitor 8 currently documents iOS 15+ and Xcode 26+. Apple also currently requires Xcode 26 or later for iOS-family uploads. Internal TestFlight testing supports up to 100 App Store Connect users; client/friend testers who are not App Store Connect users require an external group and Beta App Review. Builds remain testable for up to 90 days.

## Official certificate integration feasibility

Manual/OCR entry is a recovery path only. It does not satisfy the requirement for official PSA and Beckett records, and it must never silently become an `official` or `verified` source.

### PSA — practical route exists, commercial terms remain unresolved

**Recommended route.** The client business owner should create or designate a business-controlled Collectors/PSA account, use PSA's official [Public API registration](https://www.psacard.com/publicapi), review the API End User Agreement presented after sign-in, and request commercial-app confirmation from PSA's official API contact, `collectors-apis@collectors.com`. Do not accept the agreement, buy a membership, or provision credentials until the client approves its terms and any cost. If approved, Mica should call the API from its server only.

The route is practical because PSA expressly describes the API as a way to [display certification details in an application](https://www.psacard.com/publicapi) and documents single-certificate lookup. It is not yet cleared for Mica because the governing API agreement is behind sign-in, while the current [Collectors User Agreement](https://app.collectors.com/collectorsuseragreement) defaults site content to personal, non-commercial use unless Collectors gives written permission.

| Question | Officially documented now | Verified for a Mica account |
|---|---|---|
| Registration and eligibility | A PSA/Collectors account is required; users may sign in or register for API access. The Collectors agreement permits an authorized person to create an account on behalf of a business. No Collectors Club subscription is stated as an API prerequisite. | **No account registration or eligibility check performed.** |
| Authentication | PSA documents OAuth 2 password-grant authentication that turns PSA login credentials into a bearer token, and warns against exposing credentials in client code. | **No token requested and no authenticated request made.** A production-safe service-account/token lifecycle must be confirmed with PSA before implementation. |
| Scope | The public overview says cert verification is currently available for single-item searches by certificate number. HTTP 200 alone is not success; `IsValidRequest` and `ServerMessage` must also be checked. | **No response verified.** |
| Quota and cost | No rate limit, daily/monthly quota, overage rule, API price, or required paid plan is published on the public pages or schema. | **Unknown; provider response required.** |
| Commercial record rights | The public API is presented for application display, but public account terms otherwise prohibit commercial reuse without written authorization. The account-only API agreement may supply the controlling grant. | **No right to display, store, cache, refresh, or redistribute API data verified.** |
| Images | The official schema exposes an image-by-cert route, but its response is only typed as a generic object. PSA's [terms](https://www.psacard.com/termsandconditions) state that PSA owns submission data/images, and the public SecureScan description is not a commercial redistribution license. | **No image-display, caching, transformation, CDN, retention, or thumbnail right verified.** Treat images as separately blocked. |

#### PSA fields

These are schema declarations, not Mica response evidence. The official [OpenAPI schema](https://api.psacard.com/publicapi/swagger.json) currently declares:

- **Identity:** certificate number, Spec ID, Spec number, year, brand, category, card number, subject, variety, reverse-barcode flag, PSA/DNA and dual-cert flags, primary/other signers, and item status. It does not declare a card-language field.
- **Grade and label:** label type, grade description, card grade, and autograph grade. PSA does not provide Beckett-style centering/corner/edge/surface subgrades.
- **Qualifier:** the main public-cert model has no distinct qualifier-code field. `QualifierCode` appears in the separately documented `GetByCertNumberForFileAppend` response model, but the public overview limits current access to single-item cert verification. Mica must ask whether that route and field are authorized; it must not infer a qualifier from text.
- **Population:** total population, population with qualifier, population higher, and two T206-specific totals. The population's update cadence is not published.
- **Images:** `GetImagesByCertNumber` exists, but the schema does not document image properties, sizes, availability, provenance, or retention rules.

#### PSA provider-response gate

Responsible owner: **Elliott/client business owner** sends the approved inquiry, reviews the account-only agreement with appropriate legal/business advice, decides whether costs and rights are acceptable, and securely provisions any approved server credential. **Astra** reviews the resulting scope against the product requirement. **Sol** may later perform a minimal server-side proof only after a new implementation packet and explicit approval.

Provider confirmation must cover: business eligibility; permitted endpoints and fields; production/sandbox authentication; token expiry/refresh and service-account options; quotas, rate limits, SLA and pricing; commercial display; storage/cache duration; refresh cadence; deletion on revocation; attribution/trademark rules; geographic/user limits; and separate image display, storage, derivative, thumbnail, and CDN rights.

#### Ready-to-send PSA inquiry — do not send without client approval

Subject: Commercial PSA certificate API access for Mica collector app

> Hello Collectors API team,
>
> Mica is an early-stage commercial collecting app for graded Pokémon cards. A user photographs the front of a slab, supplies or confirms its certificate number, and Mica would retrieve the official PSA certificate record to confirm card identity and grade. We will not scrape PSA pages or expose credentials in the client.
>
> Please confirm the correct business registration and agreement for production API access; eligible certificate, grade/label/qualifier, population and image fields; authentication and sandbox options; quotas, rate limits, SLA and pricing; and whether we may display, store, cache and periodically refresh those records in our app. For images, please state separate rights for in-app display, server/CDN caching, thumbnails or other transformations, retention and required attribution. Please also provide any geographic, branding, security, deletion or audit requirements.
>
> We expect low beta volume initially and can provide projected usage and business details through an approved secure channel. No credentials are included in this message.
>
> Thank you,
> Elliott / Mica

### Beckett/BGS — direct commercial partnership is the only evidenced route

**Recommended route.** The client business owner should submit the inquiry below through Beckett's official [contact channel](https://www.beckett.com/contact), identifying it as a commercial BGS certificate-data/API request. Beckett's [terms](https://www.beckett.com/tos) direct commercial users to `mpadmin@beckett.com`; that address can be copied for routing, but its published example is Marketplace-dealer access, not proof of an API program. Beckett must route Mica to the correct grading-data/licensing owner and provide written commercial terms.

No official public developer portal, certificate API, API registration flow, authentication scheme, machine-readable schema, quota, or API price was found. As of this follow-up, Beckett's official maintenance page says its digital platforms and online tools may be unavailable during infrastructure work. Therefore the prior public lookup is neither currently reliable access nor a legitimate integration route.

| Question | Officially documented now | Verified for a Mica account |
|---|---|---|
| Registration and eligibility | Beckett documents consumer accounts, grading services and a public certificate lookup, plus an official contact route for commercial use. It does not document a developer account or commercial certificate-data program. | **No business/API eligibility verified.** |
| Authentication | No official certificate API authentication method is published. Historical public lookup access is not API authorization. | **None verified.** |
| Quota and cost | Beckett publishes card-grading service prices, but those are unrelated to data integration. No API/data quota, rate limit, SLA or price is published. | **Unknown; provider proposal required.** |
| Commercial record rights | Beckett's terms make its web services personal/non-commercial by default and state that Beckett owns grading submission data. | **No right to automate, display, store, cache, refresh, or redistribute certificate records verified.** |
| Images | Beckett's terms state that Beckett owns submission images. A card lookup may show an image when available, but public display is not a commercial reuse license. | **No image rights verified.** Treat images as a separate license request. |

#### Beckett fields

These are fields visible or described in official Beckett materials, not an API contract and not a response verified during the current maintenance period:

- **Identity:** certification number and card description; earlier official lookup results displayed set name, player/card name and grading date. No stable language, printing-ID, variation, or machine-schema guarantee is published.
- **Grade and label:** overall grade and the current Black/Gold/Silver label categories; autograph grade/designation may exist. No stable public qualifier-code schema is documented.
- **Subgrades:** Beckett documents centering, corners, edges and surface. Some service levels/cards may omit subgrades, so missing values cannot be treated as zero or inferred.
- **Population:** official materials describe copies graded and counts higher/lower; earlier lookup results also showed total graded and cards graded above. No field contract or refresh cadence is published.
- **Images:** public results may include an image, but availability, URL lifetime, dimensions and licensing are undocumented.

#### Beckett provider-response gate

Responsible owner: **Elliott/client business owner** sends the approved inquiry and owns negotiation, contract acceptance and cost approval. **Astra** reviews whether the offered fields and reliability meet the product requirement. **Sol** performs no lookup automation or integration until a new packet confirms written rights and supplies an approved credential path.

The response must identify: the grading-data or partnership owner; whether an official API, partner feed or licensed batch service exists; business eligibility; authentication and sandbox; supported BGS/BVG/BCCG records; exact schema; coverage and uptime; quota, SLA and price; permitted display/storage/cache/refresh; revocation/deletion; attribution and trademark rules; geographic/user limits; and separate image rights. If Beckett offers no direct route, a licensed intermediary is acceptable only after Beckett or a binding provider contract evidences source authorization and Mica's commercial redistribution rights for both records and, separately, images.

#### Ready-to-send Beckett inquiry — do not send without client approval

Subject: Commercial BGS certificate-record API or data partnership for Mica

> Hello Beckett team,
>
> Mica is an early-stage commercial collecting app for graded Pokémon cards. A user photographs the front of a BGS slab, supplies or confirms its certificate number, and Mica needs the official Beckett record to confirm card identity, overall grade, label/qualifier, available subgrades and population facts. We will not scrape Beckett pages or bypass access controls.
>
> Please route us to the owner of commercial grading-data/API partnerships. Does Beckett offer an official API, partner feed or licensed lookup service for this use? If so, please provide the application and eligibility process; supported BGS/BVG/BCCG fields; authentication and sandbox options; quotas, rate limits, SLA and pricing; and terms for displaying, storing, caching and refreshing records. Please address certificate images separately, including display, server/CDN caching, thumbnails or transformations, retention and attribution rights.
>
> If access is provided through an authorized intermediary, please identify the partner and confirm that its agreement permits redistribution in a commercial collecting app. We expect low beta volume initially and can provide projected usage and business details through an approved secure channel.
>
> Thank you,
> Elliott / Mica

### Current feasibility decision

| Provider | Legitimate route | Can verify now | Requires provider response before implementation |
|---|---|---|---|
| PSA | Official Public API registration plus commercial confirmation from Collectors API team | Registration path, bearer-token model, endpoint/schema declarations and default account terms | Account eligibility for Mica, API agreement, live response, quota/cost, cache/refresh rights, service credentials and image license |
| Beckett/BGS | Direct commercial data/API partnership inquiry through Beckett | Public lookup/service exists conceptually, grading fields described, default terms and official contact path | Whether a data product exists at all, then authentication, schema, live response, quota/cost, SLA, record rights and image license |
| Licensed intermediary | Contingency only | No candidate with adequate provider and redistribution evidence identified | Provider authorization plus contractual record and image redistribution rights |

Neither provider is implementation-ready today. PSA is the nearer path because it has a real API and schema; Beckett is a business-development dependency. Manual entry remains available for recovery but cannot close either official-record gate.

## CLIENT-01 limitation carried forward

The final strict matcher is locally accepted, but its live sampled coverage remains sparse. In the six-cell PSA/BGS × English/Japanese/German matrix, six rows were received and zero were accepted: three English rows were a different Flying Pikachu card and three German rows lacked printing identity and had unknown attribution; four cells were empty. The sampled BGS 9.5/half-grade checks returned no rows. One English PSA 10 McDonald's example did complete through the local application handler with ten rows received, eight accepted, and two excluded. These are limited samples, not proof that a language or grade is unsupported provider-wide.

Certificate enrichment must not be used to loosen sale identity matching, fill missing market evidence, or imply that a certificate match authenticates a physical slab. PkmnPrices supplied no verified certificate record or certificate-image capability in CLIENT-01.

## Approval questions and inputs required before implementation

Astra/client approval is required for all items below; no implementation should begin until the platform route and dependency set are approved.

1. **Route and dependencies:** The client has approved bundled Capacitor as the direction, subject to real-iPhone validation. Does the client also approve the iOS 15 minimum and, in a later implementation packet, only `@capacitor/core`, `@capacitor/cli` (development), `@capacitor/ios`, `@capacitor/app`, and `@capacitor/preferences`?
2. **Apple account:** Is an active Apple Developer Program membership available, and should the app use an individual or organization team? An organization must have legal-entity/D-U-N-S and domain-backed identity readiness. Invite the engineer with the minimum App Store Connect role; do not share Apple credentials or certificates in chat.
3. **App identity and testers:** What permanent bundle ID, app display name, SKU, signing team, and TestFlight group are approved? Will testers be App Store Connect users, or is external Beta App Review required?
4. **Links and API:** What client-owned HTTPS domain/path is approved for universal links and its association file, and what production HTTPS origin should the native build use for `/api/*`? May the matching Supabase redirect allowlist entry be added?
5. **Review and devices:** Are the app privacy answers, privacy-policy URL, support URL, camera-purpose wording, review notes, and a non-privileged demo account approved? Which real iPhone models and iOS versions will Jordan and the review team test?
6. **Local security:** Does the client approve the Keychain session adapter and Preferences for small, non-secret local state? Supabase publishable configuration may be embedded; Supabase service-role, PkmnPrices, PSA, and any future Beckett secrets must remain in server-managed environment variables and never be pasted into chat or bundled in the app.
7. **PSA access:** Does the client approve sending the drafted PSA inquiry and, separately after review, creating a business-controlled API account? Any agreement, cost, or credential provisioning requires its own approval.
8. **Beckett access:** Does the client approve sending the drafted Beckett inquiry and entering commercial discussions? Any agreement, intermediary, cost, or credential provisioning requires its own approval and documented redistribution rights.
9. **Recovery representation:** Does the client approve retaining manual/OCR input only as a clearly labeled recovery path while blocking an `official` status until a provider response is returned? User-captured images remain the only slab imagery until provider rights are documented.
10. **Change gates:** Does the client confirm that paid enrollment, new dependencies, an iOS platform directory, signing configuration, and any provider agreement remain separate approval-gated implementation actions?

## Client-owned Apple account and domain checklist

- Choose the legal owner: client-controlled Apple ID with two-factor authentication, and individual or organization enrollment; an organization needs its legal entity, D-U-N-S record and domain-backed business identity.
- Keep payment, tax, banking and agreement acceptance with the client Account Holder. No Apple password, recovery code, certificate private key or provider credential goes in chat.
- Approve the permanent bundle ID, app name and signing team, then create the App Store Connect record under the client team.
- Invite Sol with the minimum role needed for a later implementation packet; use automatic signing unless a reviewed requirement demands manual certificates.
- Control an HTTPS production domain and DNS. Approve a universal-link path, host its `apple-app-site-association` file, and retain control of the API and support/privacy-policy origins.
- Provide the privacy-policy and support URLs, App Privacy answers, review contact/demo account, intended internal/external tester list, and at least one real target iPhone.
- Do not purchase enrollment or deploy a build under this research packet.

## Exit-gate status

- Delivery route: **Capacitor approved as the direction, not implemented; real-iPhone validation remains mandatory**.
- Purchases and deployment: **not authorized or performed**.
- Apple account/signing/TestFlight access: **not verified**.
- Real-iPhone camera, lifecycle, authentication, storage, and recovery tests: **not run**.
- PSA route: **official API exists; Mica account eligibility, API agreement, commercial rights, quota/cost and image rights are not verified**.
- Beckett route: **commercial inquiry identified; no official commercial API/data product or rights are verified**.
- Manual/OCR input: **recovery only; it cannot satisfy or replace the official-record requirement**.

The CLIENT-02 certificate gate remains open until both providers return acceptable written access and use terms. If either provider offers no practical direct route, the client must approve a licensed intermediary whose authorization and redistribution rights are evidenced; manual entry alone cannot close the gate.

## Official sources

### Delivery, iOS, and authentication

- [Capacitor overview](https://capacitorjs.com/docs)
- [Capacitor iOS requirements and workflow](https://capacitorjs.com/docs/ios)
- [Capacitor App lifecycle and URL handling](https://capacitorjs.com/docs/apis/app)
- [Capacitor Preferences storage limits](https://capacitorjs.com/docs/apis/preferences)
- [Capacitor Camera contract](https://capacitorjs.com/docs/apis/camera)
- [Apple camera usage-description requirement](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription)
- [Apple camera authorization guidance](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media)
- [Apple Keychain Services](https://developer.apple.com/documentation/security/adding-a-password-to-the-keychain)
- [Apple Developer Program enrollment](https://developer.apple.com/programs/enroll/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple upload-build requirements](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Apple internal TestFlight testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)
- [Apple external TestFlight testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase sessions and custom storage](https://supabase.com/docs/guides/auth/sessions)

### Certificate providers

- [PSA public API documentation](https://www.psacard.com/publicapi/documentation)
- [PSA official API schema](https://api.psacard.com/publicapi/swagger.json)
- [Collectors User Agreement](https://app.collectors.com/collectorsuseragreement)
- [PSA certificate verification cautions](https://www.psacard.com/cert)
- [PSA security and SecureScan description](https://www.psacard.com/security)
- [PSA terms and conditions](https://www.psacard.com/termsandconditions)
- [Beckett grading fields and services](https://www.beckett.com/grading)
- [Beckett current maintenance/service status](https://maintenance.beckett.com/)
- [Beckett official contact route](https://www.beckett.com/contact)
- [Beckett terms of service](https://www.beckett.com/tos)

## Ponytail constraint applied

The proposal deliberately stops at the first credible route: reuse the existing web application in a bundled shell, pursue PSA's own API and a direct Beckett commercial inquiry, and reject speculative scrapers or unproven intermediaries. Camera/network plugins and a SwiftUI rewrite remain deferred until real-device evidence requires them. Security, owner isolation, licensing, validation, and failure recovery were not simplified away.
