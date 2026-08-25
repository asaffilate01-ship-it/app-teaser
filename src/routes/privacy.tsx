import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy notice — CricLume" },
      {
        name: "description",
        content: "How CricLume handles account, match, video, coaching and device data.",
      },
    ],
    links: [{ rel: "canonical", href: "https://app-teaser.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" subtitle="Effective 25 August 2026">
      <p>
        CricLume is a product of iTechLounge Ltd. This notice explains how the public website,
        device scoring preview and cloud services for enrolled clubs, schools, academies and leagues
        handle information. A participating organisation may also give you its own notice explaining
        its responsibilities for player and member information.
      </p>

      <h2>Information handled by the scoring preview</h2>
      <p>
        Team names, player names, grounds, weather, delivery records, timestamps, notes and match
        settings are saved in your browser&apos;s local storage. They stay on the device unless you
        choose to export the match as a JSON file. CricLume does not receive this local match data.
      </p>
      <p>
        Videos selected in the coaching lab are opened locally through your browser. The preview
        does not upload those videos unless you deliberately join a cloud camera room and confirm an
        upload. Closing or refreshing a local-only review ends that temporary session.
      </p>

      <h2>Accounts and cloud matches</h2>
      <p>
        When cloud access is enabled, we process your email address, display name, organisation,
        membership role, invitations, authentication and security records. Cloud match records can
        include teams, players, fixtures, grounds, weather, ball-by-ball events, scorer edits,
        device identifiers, timestamps and audit history. Access is restricted by organisation and
        match roles. A narrow public scoreboard can be enabled by an authorised match administrator.
      </p>

      <h2>Camera rooms, video and AI review</h2>
      <p>
        A cloud camera room can process device health, camera position, time offset, recordings,
        upload status, annotations and links between clips and deliveries. Each video has a consent
        state, retention date and optional face or full-person blur setting. AI analysis is
        advisory, confidence-scored and subject to human review; it does not change the score
        automatically. Junior identity recognition is disabled and junior media requires additional
        safeguarding controls.
      </p>

      <h2>Website and regional pricing data</h2>
      <p>
        The pricing page asks ipapi.co for a country code so it can suggest a region and currency.
        That request exposes your IP address to ipapi.co under its own privacy terms. You may
        manually select a region. Our hosting provider may process standard security and access
        logs, such as IP address, browser type, requested page and request time.
      </p>

      <h2>Contact and pilot requests</h2>
      <p>
        If you email us to request a club or league pilot, we use your name, email address and
        message to answer the request and manage the prospective relationship. We keep that
        correspondence only as long as needed for the enquiry, our legitimate business records and
        applicable legal requirements.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        CricLume does not use advertising cookies. Browser local storage is used for matches you
        create, authentication where cloud access is enabled, offline event queues, device pairing
        and installable-app files. You can erase local matches inside the app or clear site data in
        your browser. Operational monitoring may record errors, route, release, browser type and
        request time, with unnecessary personal data excluded.
      </p>

      <h2>Payments, providers and retention</h2>
      <p>
        Stripe processes subscription and payment details; CricLume stores customer, subscription,
        plan and entitlement references rather than full card details. Hosting, database, storage,
        email, video processing, monitoring, authorised rain-rule and AI providers process data only
        for their configured service. Retention depends on the record and organisation policy.
        Junior recordings default to a shorter period, and expired cloud media is deleted unless a
        documented legal hold applies. Database and security records may be kept longer where needed
        for integrity, legal obligations or disputes.
      </p>

      <h2>Children and player information</h2>
      <p>
        A club, school or scorer entering player information is responsible for having an
        appropriate lawful basis and giving any required notices. Do not add unnecessary personal
        details. Junior video must only be recorded and reviewed with the permissions and
        safeguarding controls required by the club, school, governing body and applicable law.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, restrict or
        object to our processing of personal information, and to complain to a data-protection
        authority. Local match data is controlled on your device; email us for requests concerning
        information held by iTechLounge Ltd.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:hello@criclume.com">hello@criclume.com</a>. This notice and the
        organisation&apos;s own player notice should be reviewed before a club or league activates
        cloud video, AI analysis, payments or public scoreboards.
      </p>
    </LegalPage>
  );
}

export function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f0d17] text-slate-100">
      <header className="border-b border-white/10 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link to="/">
            <img src={logoAsset.url} alt="CricLume" className="h-10 w-auto" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400">
            <ArrowLeft className="size-4" /> Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-16">
        <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
          <ShieldCheck className="size-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">
          CricLume legal
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold md:text-6xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        <article className="legal-copy mt-10 space-y-5">{children}</article>
        <a
          href="mailto:hello@criclume.com"
          className="mt-10 inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold"
        >
          <Mail className="size-4 text-amber-300" /> Contact CricLume
        </a>
      </main>
    </div>
  );
}
