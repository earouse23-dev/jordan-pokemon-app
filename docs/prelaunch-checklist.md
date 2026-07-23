# Mica prelaunch checklist

This checklist records the owner decisions made on July 22, 2026. Review it before
submitting Mica to an app store or opening public registration.

## Provider activation

- [ ] Upgrade PkmnPrices to Pro.
- [ ] Set `PKMNPRICES_PLAN=pro` in Vercel Production, Preview, and Development.
- [ ] Verify raw, graded, sealed, history, offers, and sold-listing responses with
      real cards before removing developer-mode explanations.
- [ ] Confirm PkmnPrices commercial retention, redistribution, and derived-data
      rights in writing.
- [ ] Keep Vercel AI Gateway on the included credit during private development.
- [ ] Before public launch, add an AI budget alert and verify the production model,
      usage cap, fallback behavior, and image-retention policy.

## Authentication and account security

- [ ] Upgrade the Mica Supabase project to Pro if password sign-in will remain
      available.
- [ ] Enable Supabase Auth leaked-password protection immediately after that
      upgrade (`password_hibp_enabled=true`) and rerun the security advisor.
- [ ] Configure production SMTP, sender-domain authentication, and support
      monitoring for magic links and password recovery.
- [ ] Recheck allowed redirect URLs after the final public domain and native deep
      links are known.

## Native app and notifications

- [ ] Configure Apple/Google developer accounts, bundle identifiers, signing, and
      native builds.
- [ ] Configure APNs and Android push credentials, permission prompts, deep links,
      delivery retries, and notification preference controls.
- [ ] Verify that a watchlist alert opens the exact card and an approved purchase
      destination.
- [ ] Test camera permissions, background/resume behavior, and photo privacy on
      physical iOS and Android devices.

## Legal, trust, and release operations

- [ ] Replace provisional legal text with the owner's legal entity, jurisdiction,
      support email, privacy contact, and deletion contact.
- [ ] Publish final Terms, Privacy Policy, data-source attribution, AI disclosure,
      and account-deletion instructions at stable public URLs.
- [ ] Complete App Store privacy labels and Google Play data-safety disclosures
      from the actual production data flows.
- [ ] Add production error monitoring, uptime checks, provider-health alerts,
      backup verification, and a rollback owner.
- [ ] Run the full automated suite and a signed-in physical-device regression pass
      immediately before submission.

Do not mark the app public-launch ready until every item above is either completed
or explicitly removed by the owner with a documented reason.
