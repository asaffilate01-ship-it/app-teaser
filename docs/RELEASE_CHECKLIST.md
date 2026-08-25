# Release checklist

## Web and PWA

- [ ] Production Supabase, Stripe, email, monitoring, video and AI environments configured.
- [ ] Custom domain, TLS, DNS email records and Auth redirect URLs verified.
- [ ] Full match pilot passed on current Safari/iOS and Chrome/Android, including offline replay.
- [ ] Public scoreboard load-tested and checked for accidental private-data exposure.
- [ ] Legal pages contain the registered entity name, address, contact and current policies.
- [ ] Privacy impact assessment, safeguarding review and processor agreements approved.
- [ ] Backup restore and incident-response exercises completed.

## Native app stores

- [ ] Apple Developer and Google Play Console organisations verified.
- [ ] Native camera implementation supports long recordings, screen lock, storage pressure and interruptions.
- [ ] Microphone/camera/photo permissions have precise purpose strings and just-in-time explanations.
- [ ] App Privacy Details, Data Safety form, age rating and encryption/export questions completed.
- [ ] Account deletion and subscription management are reachable inside the app.
- [ ] In-app purchases reviewed where store rules require them; external Stripe billing is not assumed valid.
- [ ] Junior/child-directed classification reviewed by safeguarding and legal specialists.
- [ ] Signed staging builds pass TestFlight and closed Play testing on the supported device matrix.
- [ ] Store screenshots, support URL, privacy URL, review notes and demo credentials prepared.

The current repository is an installable PWA and cloud-ready web platform. Native store binaries still
require a native capture wrapper, signing identities and store-account review; a remote WebView alone is
not treated as a finished camera product.
