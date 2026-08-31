# Mica Step 1 visual evidence manifest

Captured 2026-08-31. No production account was authenticated and no private
record was opened. Local authenticated surfaces were revealed using the same
configuration-neutral DOM method used by the browser regression tests; they
prove visible layout only, not Auth, persistence, or live API behavior.

## Coverage

| Surface                       | Desktop                                                 | Mobile                                                                              | Evidence class                                        |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Signed-out Auth               | `auth-production-desktop.png`, `auth-local-desktop.png` | `auth-production-mobile.png`, `auth-local-mobile.png`                               | Public production plus configuration-neutral local    |
| Onboarding                    | `onboarding-local-desktop.png`                          | `onboarding-local-mobile.png`                                                       | Synthetic local                                       |
| Dashboard                     | `dashboard-local-desktop.png`                           | `dashboard-local-mobile.png`                                                        | Synthetic local                                       |
| Collection and grading launch | `collection-local-desktop.png`                          | `collection-local-mobile.png`                                                       | Synthetic local                                       |
| Add/manual/photo/sealed entry | `scan-local-desktop.png`                                | `scan-local-mobile.png`                                                             | Synthetic local                                       |
| Trade comparison              | `trade-local-desktop.png`                               | `trade-local-mobile.png`                                                            | Synthetic local                                       |
| Profile/settings              | `profile-local-desktop.png`                             | `profile-local-mobile.png`                                                          | Synthetic local                                       |
| Broken direct `/profile`      | `profile-404-production-desktop.png`                    | `profile-404-production-mobile.png`                                                 | Public production                                     |
| Grading report                | —                                                       | `../digital-grading-report-full-mobile.png`, `../digital-grading-report-mobile.png` | Synthetic local                                       |
| Grading empty launch          | `../browser/collection-grade-empty-sheet.png`           | —                                                                                   | Synthetic local                                       |
| Collection with sample cards  | `../browser/production-collection.png`                  | —                                                                                   | Public shell/synthetic account state; no private rows |

Files in the first eight rows are under `.artifacts/step1-before-state/`.

## SHA-256

```text
fcdaa54fa310d140dbd78ae93449355152c48e040aa33383517e74ace8384365  .artifacts/step1-before-state/auth-local-desktop.png
1cd16464ad21c01496db0e6c936c2b797c844c632252444cf4cdcb84860fc7d0  .artifacts/step1-before-state/auth-local-mobile.png
7f0969fe57ab494ff89657d6e63c62a90ff0921959ce196bdacdc3437b7f82c9  .artifacts/step1-before-state/auth-production-desktop.png
b5ae3abb25c325b28d64f63bf4299001774faeb461a60789ae03dcfc479c3431  .artifacts/step1-before-state/auth-production-mobile.png
8e20c019e1405ac97d47a4a9235efd2cd4aac505877718bf1de97e5f46669163  .artifacts/step1-before-state/collection-local-desktop.png
aff063dc984d77cbdb1dbba320b154543c9050ca226b5def145102b309cdddaa  .artifacts/step1-before-state/collection-local-mobile.png
4fd0928f8b583626efc24ab94200743916c45cc2c34146080648e2daf19bc380  .artifacts/step1-before-state/dashboard-local-desktop.png
c53d0fe4ca78beaccad8157d2ff84089551d9cb0a5cfca823fae5c58775eb14a  .artifacts/step1-before-state/dashboard-local-mobile.png
041b2112b4fdb5ed61892f5bc8ab419f3c3473ad038c024de2e59c818dc1d795  .artifacts/step1-before-state/onboarding-local-desktop.png
b39f65bbe52da06cc1224055de0535405e86793c7b5873e940332d7d74932bcd  .artifacts/step1-before-state/onboarding-local-mobile.png
4cd0aaa6fbb1736a1386da82a3a1357d373e8d200d532001959622367ed83d1b  .artifacts/step1-before-state/profile-404-production-desktop.png
56a66e3ec4fb79a21408128b2597e8d1d6fc7a280245a696f5f98eecdc414638  .artifacts/step1-before-state/profile-404-production-mobile.png
1a29ecc0b641ef84b451d2e77e821b6b3921df234ab824b39d4745afb334f89b  .artifacts/step1-before-state/profile-local-desktop.png
511e492fb15a86fa6a0986fc725cce8577a7e9620de98bf2d392172fac986e92  .artifacts/step1-before-state/profile-local-mobile.png
2a6bc5a257cd094a24f69167b4321beed32bc4cde3e33aeba5529a63d840aea8  .artifacts/step1-before-state/scan-local-desktop.png
7354172156e68c7ac17a1e20323cf760d88dcec908af23331dcbcda114217a43  .artifacts/step1-before-state/scan-local-mobile.png
0a82b353bcf434bd50e28bd80caff71701c24c04ffefb072351ad8abb45cb49c  .artifacts/step1-before-state/trade-local-desktop.png
7f135a6f6b0c133c14f82c30b7a5b2ae0b3a20a68dd8debcee9da16f1994a6e1  .artifacts/step1-before-state/trade-local-mobile.png
4677fa36b0a6d23f8e9bc6d2b14d7f46959b42e5675695f78ca501a21fcd88ed  .artifacts/digital-grading-report-full-mobile.png
db31c078f94a096656362b359d872ec4274ae7e00200151db22a0af6144f2d8b  .artifacts/digital-grading-report-mobile.png
34b094b3e5c460d2ba02e9df84a016358bead811157e76fe566913c55faab57c  .artifacts/browser/collection-grade-empty-sheet.png
800515d06bc47951f8fd031740c3a3508047062decc789e6da3edb2d7aec512e  .artifacts/browser/production-collection.png
```

## Explicitly unavailable before-state evidence

Stateful card detail mutations, recovery email, physical camera, CSV partial
failure, foreground notifications, paid-provider outage, consent withdrawal,
and complete deletion require a disposable authenticated environment or physical
device. Step 1 classifies them as unverified; Steps 5, 7, 9, 11, and 12 own the
corresponding implementation and release evidence.
