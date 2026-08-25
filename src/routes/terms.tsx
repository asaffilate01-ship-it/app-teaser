import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Platform terms — CricLume" },
      {
        name: "description",
        content: "Terms for using the CricLume cricket scoring, competition and coaching platform.",
      },
    ],
    links: [{ rel: "canonical", href: "https://app-teaser.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Platform terms" subtitle="Effective 25 August 2026">
      <p>
        These terms apply to the free CricLume website, device scoring preview and any cloud pilot
        service provided by iTechLounge Ltd. By using CricLume, you agree to these terms. A paid or
        organisation-wide service may also have an order form and data-processing agreement; those
        documents take priority where they expressly differ.
      </p>

      <h2>Preview status</h2>
      <p>
        CricLume is under active development. The preview is provided for evaluation and pilot
        scoring. Features may change, and local browser data may be lost because of device failure,
        browser settings, cleared storage or product updates. Export important matches and maintain
        any official scorebook or backup required by your competition. Cloud features are available
        only when the relevant organisation and service integrations have been activated.
      </p>

      <h2>Scoring responsibility</h2>
      <p>
        The scorer remains responsible for checking players, runs, extras, wickets, overs, results
        and competition rules. A rain-adjusted target may be used only when the competition has
        selected an authorised, versioned provider. CricLume must not be treated as an official DLS
        or other licensed calculator when that provider is not configured.
      </p>

      <h2>Accounts, roles and subscriptions</h2>
      <p>
        Keep sign-in links and devices secure and use only the role assigned to you. Organisation
        owners control member invitations, permissions and public match visibility. Paid plans renew
        according to the checkout terms shown by Stripe until cancelled. Store-platform billing may
        apply separately to a future native app. Loss of an entitlement must not remove an
        organisation&apos;s lawful access to export its records.
      </p>

      <h2>AI and coaching suggestions</h2>
      <p>
        Automated findings are suggestions, not official decisions. A human must review evidence,
        confidence and the original delivery before changing a score, coaching a player or taking
        safeguarding action. Do not use CricLume for prohibited biometric identification or to make
        solely automated decisions with legal or similarly significant effects.
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
        its licensors. You retain rights in match information and video you lawfully provide and
        grant the limited permission needed to host, synchronize, process and return material for
        the service you select.
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
        We may update the platform and these terms as the product develops. Material commercial
        changes will be presented before they take effect. Questions can be sent to{" "}
        <a href="mailto:hello@criclume.com">hello@criclume.com</a>.
      </p>
    </LegalPage>
  );
}
