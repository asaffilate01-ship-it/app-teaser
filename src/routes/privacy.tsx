import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy notice — CricLume" },
      {
        name: "description",
        content: "How the CricLume scoring preview handles match, video and device data.",
      },
    ],
    links: [{ rel: "canonical", href: "https://app-teaser.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" subtitle="Effective 24 August 2026">
      <p>
        CricLume is a product of iTechLounge Ltd. This notice explains how the public website and
        device-only scoring preview handle information. The preview does not yet provide accounts,
        cloud match storage or synchronized remote-camera rooms.
      </p>

      <h2>Information handled by the scoring preview</h2>
      <p>
        Team names, player names, grounds, weather, delivery records, timestamps, notes and match
        settings are saved in your browser&apos;s local storage. They stay on the device unless you
        choose to export the match as a JSON file. CricLume does not receive this local match data.
      </p>
      <p>
        Videos selected in the coaching lab are opened locally through your browser. The preview
        does not upload or retain those videos. Closing or refreshing the page ends that temporary
        review session.
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
        The current preview does not set advertising or analytics cookies. Browser local storage is
        used to keep matches that you deliberately create. You can erase those matches inside the
        app or clear site data in your browser.
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
        Email <a href="mailto:hello@criclume.com">hello@criclume.com</a>. This notice will be
        updated before accounts, cloud storage, payments, AI processing or live multi-device capture
        are released.
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
