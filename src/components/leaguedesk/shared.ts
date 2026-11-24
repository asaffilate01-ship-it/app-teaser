import { toast } from "sonner";
import type { PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";

export interface DeskProps {
  organisationId: string;
  role: PlatformRole;
  kind: string;
  club: PlatformDashboardData;
}

export const isLeagueAdmin = (p: DeskProps) =>
  p.kind === "league" && (p.role === "owner" || p.role === "league_admin");
export const isClubAdmin = (p: DeskProps) =>
  p.kind !== "league" && (p.role === "owner" || p.role === "club_admin");
export const isTeamManager = (p: DeskProps) =>
  p.kind !== "league" && ["owner", "club_admin", "team_manager", "coach"].includes(p.role);

export async function must<T = unknown>(
  request: PromiseLike<{ error: { message: string } | null; data?: T }>,
): Promise<T | undefined> {
  const { error, data } = await request;
  if (error) throw new Error(error.message);
  return data;
}

/** Run a change, show the outcome, then reload. */
export async function attempt(
  action: () => Promise<unknown>,
  done: string,
  reload?: () => Promise<void> | void,
) {
  try {
    await action();
    toast.success(done);
  } catch (reason) {
    toast.error(
      reason instanceof Error ? reason.message.replace(/^.*?ERROR:\s*/, "") : "That didn't work.",
    );
  } finally {
    await reload?.();
  }
}

export const money = (minor: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
};
export const toMinor = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));
