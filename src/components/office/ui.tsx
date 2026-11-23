import type { ReactNode } from "react";
import type { PlatformRole } from "@/lib/platform";
import type { ClubOfficeData } from "@/lib/club-office-cloud";
import type { PlatformDashboardData } from "@/lib/platform-cloud";
import { regions } from "@/lib/pricing";

export interface OfficeProps {
  organisationId: string;
  role: PlatformRole;
  data: ClubOfficeData;
  club: PlatformDashboardData;
  /** Runs a change, shows a message and reloads. Resolves false when the database refused it. */
  act: (action: () => Promise<void>, done?: string) => Promise<boolean>;
}

export function OfficeCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="office-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3>{title}</h3>
          {description && <p className="office-meta mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function OfficeField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="office-label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="office-meta rounded-xl border border-dashed border-border p-4 text-center">{children}</p>;
}

export function Pill({ tone, children }: { tone?: "good" | "warn" | "bad" | undefined; children: ReactNode }) {
  return <span className={`office-pill ${tone ? `office-pill-${tone}` : ""}`}>{children}</span>;
}

export const currencies = [...new Set(regions.map((region) => region.currency))];

export function nameOfPlayer(club: PlatformDashboardData, id: string | null | undefined): string {
  return club.players.find((player) => player.id === id)?.name ?? "Player";
}

export function nameOfMember(club: PlatformDashboardData, userId: string | null | undefined): string {
  return club.members.find((member) => member.userId === userId)?.displayName ?? "Club member";
}

export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function day(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** datetime-local value → ISO string (local time), or null. */
export function fromLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function upcoming<T extends { starts_at: string; cancelled_at?: string | null }>(rows: T[], hoursBack = 6): T[] {
  const cutoff = Date.now() - hoursBack * 3_600_000;
  return rows.filter((row) => new Date(row.starts_at).getTime() >= cutoff && !row.cancelled_at);
}
