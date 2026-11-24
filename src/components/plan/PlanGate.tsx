import { useEffect, useState, type ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  gateWhenPlanUnknown,
  planGate,
  readPlanId,
  type PlanFeature,
  type PlanId,
} from "@/lib/plans";

interface PlanAccess {
  plan: PlanId;
  videoAddon: boolean;
}

/** The club's plan, readable by every member (billing details stay admin-only). */
export function useClubPlan(organisationId: string): PlanAccess | null {
  const [access, setAccess] = useState<PlanAccess | null>(null);
  useEffect(() => {
    let live = true;
    setAccess(null);
    void supabase.rpc("club_plan_access", { p_org: organisationId }).then(({ data, error }) => {
      if (!live || error) return;
      const row = data as { plan?: unknown; videoAddon?: unknown } | null;
      setAccess({ plan: readPlanId(row?.plan), videoAddon: row?.videoAddon === true });
    });
    return () => {
      live = false;
    };
  }, [organisationId]);
  return access;
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
  if (!access) return <>{children}</>;
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
