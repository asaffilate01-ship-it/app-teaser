import { useEffect, useState } from "react";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { usePromos } from "@/hooks/use-promos";
import { getCloudClient, listOrganisationMemberships } from "@/lib/cloud";

/**
 * Ads inside the scorer app. Signed in, plays credit the club that owns the open cloud match
 * (or the person's first club); signed out, the ads still run and nobody is credited.
 */
export function useAppPromos(cloudMatchId?: string | null) {
  const { session } = useCloudSession();
  const userId = session?.user.id ?? null;
  const [organisationId, setOrganisationId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOrganisationId(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        if (cloudMatchId) {
          const { data } = await getCloudClient()
            .from("matches")
            .select("owner_organisation_id")
            .eq("id", cloudMatchId)
            .maybeSingle();
          const owner = (data as { owner_organisation_id?: string } | null)?.owner_organisation_id;
          if (owner) {
            if (active) setOrganisationId(owner);
            return;
          }
        }
        const memberships = await listOrganisationMemberships();
        if (active) setOrganisationId(memberships[0]?.organisationId ?? null);
      } catch {
        if (active) setOrganisationId(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, cloudMatchId]);

  return usePromos({ surface: "app", member: userId ? { organisationId } : null });
}
