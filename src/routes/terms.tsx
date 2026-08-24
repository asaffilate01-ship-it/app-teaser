import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Preview terms — CricLume" },
      {
        name: "description",
        content: "Terms for using the CricLume cricket scoring and coaching preview.",
      },
    ],
    links: [{ rel: "canonical", href: "https://app-teaser.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Preview terms" subtitle="Effective 24 August 2026">
      <p>
        These terms apply to the free CricLume website and device-only product preview provided by
        iTechLounge Ltd. By using the preview, you agree to these terms. Paid subscriptions, cloud
        accounts and league services will have separate terms before they launch.
      </p>

      <h2>Preview status</h2>
      <p>
        CricLume is under active development. The preview is provided for evaluation and pilot
        scoring. Features may change, and local browser data may be lost because of device failure,
        browser settings, cleared storage or product updates. Export important matches and maintain
        any official scorebook or backup required by your competition.
      </p>

      <h2>Scoring responsibility</h2>
      <p>
        The scorer remains responsible for checking players, runs, extras, wickets, overs, results
        and competition rules. The preview does not currently calculate rain-adjusted targets and
        must not be treated as an official DLS or other licensed rain-rule calculator.
      </p>

      <h2>Video, consent and safeguarding</h2>
      <p>
        You may only record, load, annotate or share video when you have the rights and permissions
        to do so. You are responsible for venue rules, privacy notices, player and spectator
        consent, junior safeguarding and any governing-body requirements. Do not use CricLume to
        harass, discriminate, surveil unlawfully or infringe another person&apos;s rights.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not attempt to disrupt the service, introduce malicious code, bypass access controls,
        scrape protected areas, misrepresent affiliation with CricLume, or use the preview for an
        unlawful purpose. You must not resell the preview or remove CricLume branding without
        written permission.
      </p>

      <h2>Intellectual property</h2>
      <p>
        CricLume&apos;s software, design, brand and original content belong to iTechLounge Ltd or
        its licensors. You retain rights in match information and video you lawfully provide. Using
        the local preview does not transfer that user material to CricLume.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The preview is supplied as available, without a promise that it will be uninterrupted or
        error-free. Nothing in these terms excludes liability that cannot lawfully be excluded. To
        the fullest extent permitted by law, iTechLounge Ltd is not responsible for indirect loss,
        lost data, missed fixtures, incorrect unofficial records or decisions made from preview
        analytics.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update the preview and these terms as the product develops. Material terms for cloud
        accounts or paid services will be presented before those services are activated. Questions
        can be sent to <a href="mailto:hello@criclume.com">hello@criclume.com</a>.
      </p>
    </LegalPage>
  );
}
