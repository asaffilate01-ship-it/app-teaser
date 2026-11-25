import { useEffect, useState, type ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  gateWhenPlanUnknown,
  planGate,
  parsePlanAccess,
  type PlanFeature,
  type PlanAccess,
} from "@/lib/plans";

/** The club's plan, readable by every member (billing details stay admin-only). */
export function useClubPlan(organisationId: string): PlanAccess | null {
  const [snapshot, setSnapshot] = useState<{
    organisationId: string;
    access: PlanAccess | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const { data, error } = await supabase.rpc("club_plan_access", { p_org: organisationId });
        if (active && current === request)
          setSnapshot({ organisationId, access: error ? null : parsePlanAccess(data) });
      } catch {
        if (active && current === request) setSnapshot({ organisationId, access: null });
      }
    };
    setSnapshot(null);
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(onVisible, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [organisationId]);
  return snapshot?.organisationId === organisationId ? snapshot.access : null;
}

const featureName: Record<PlanFeature, string> = {
  basicScoring: "Basic scoring",
  scoringAnalytics: "Scoring analytics",
  video: "Video & video analytics",
  customDomain: "Own-domain website",
};
const needs: Record<PlanFeature, string> = {
  basicScoring: "every plan",
  scoringAnalytics: "the Club or League plan",
  video: "the video add-on on a Club or League plan",
  customDomain: "the League plan",
};

/** Wraps a paid screen: shows it as normal, with a "Paid plan" note before go-live, or a lock card after. */
export function PlanGate({
  organisationId,
  feature,
  children,
}: {
  organisationId: string;
  feature: PlanFeature | undefined;
  children: ReactNode;
}) {
  const access = useClubPlan(organisationId);
  if (!feature) return <>{children}</>;
  // Loading or failed entitlement lookups must not unlock paid features
  // after production enforcement is enabled. Before launch, preserve the
  // existing, clearly labelled free-preview experience.
  if (!access && gateWhenPlanUnknown(feature) === "locked") {
    return (
      <section className="office-card plan-lock" role="status">
        <h2 className="font-display text-2xl font-bold">Unable to verify club access</h2>
        <p className="office-meta">
          Paid feature permissions are temporarily unavailable. Refresh the page or contact your
          club administrator. Your scoring records remain safe.
        </p>
      </section>
    );
  }
  if (!access) {
    if (feature === "basicScoring") return <>{children}</>;
    return (
      <div className="space-y-4">
        <p role="status" className="plan-note">
          Plan access is not verified. This paid feature is available in preview mode only.
        </p>
        {children}
      </div>
    );
  }
  const gate = planGate(access.plan, feature, { videoAddon: access.videoAddon });
  if (gate === "open") return <>{children}</>;
  if (gate === "locked")
    return (
      <section
        className="office-card plan-lock"
        aria-label={`${featureName[feature]} needs a paid plan`}
      >
        <span className="icon-tile flex size-11 items-center justify-center">
          <Lock className="size-5 text-gold" />
        </span>
        <h2 className="font-display text-2xl font-bold">{featureName[feature]}</h2>
        <p className="office-meta">
          This part of CricLume comes with {needs[feature]}. Basic scoring stays free.
        </p>
        <a href="/pricing" className="action-primary">
          See plans
        </a>
      </section>
    );
  return (
    <div className="space-y-4">
      <div className="plan-note" role="note">
        <Sparkles className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <p>
          <strong>Paid plan feature.</strong> {featureName[feature]} comes with {needs[feature]}.
          It's open to every club while CricLume launches.
        </p>
        <a href="/pricing" className="plan-note-link">
          Plans
        </a>
      </div>
      {children}
    </div>
  );
}
