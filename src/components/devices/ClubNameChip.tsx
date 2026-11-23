import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Shield } from "lucide-react";
import { listOrganisationMemberships } from "@/lib/cloud";

/** The signed-in person's club on screen, so a borrowed login always shows the wrong club. */
export function ClubNameChip({ session }: { session: Session | null }) {
  const [name, setName] = useState<string | null>(null);
  const userId = session?.user.id ?? null;
  useEffect(() => {
    setName(null);
    if (!userId) return;
    let active = true;
    void listOrganisationMemberships()
      .then((items) => {
        if (!active) return;
        let saved: string | null = null;
        try {
          saved = window.localStorage.getItem("criclume:selected-organisation");
        } catch {
          /* optional */
        }
        const pick = items.find((item) => item.organisationId === saved) ?? items[0];
        setName(pick?.organisationName ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);
  if (!name) return null;
  return (
    <span
      className="hidden max-w-44 items-center gap-1.5 truncate rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 sm:inline-flex"
      title={`Signed in for ${name}`}
    >
      <Shield className="size-3.5 shrink-0 text-amber-300" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}
