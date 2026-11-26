import { assignableRoles, can, type PlatformRole } from "./platform.ts";

export type MemberChange = { role?: PlatformRole; status?: "active" | "suspended" };

export function canManageMember(
  role: PlatformRole,
  actorId: string | null,
  member: { userId: string; role: PlatformRole },
): boolean {
  return Boolean(
    actorId &&
    actorId !== member.userId &&
    can(role, "members.manage") &&
    assignableRoles(role).includes(member.role),
  );
}

/** An empty result is not a confirmed write; RLS may have hidden or rejected the row. */
export function confirmedMemberChange(
  result: { user_id: string; role: string; status: string } | null,
  userId: string,
  change: MemberChange,
): boolean {
  return Boolean(
    result &&
    result.user_id === userId &&
    (change.role !== undefined || change.status !== undefined) &&
    (change.role === undefined || result.role === change.role) &&
    (change.status === undefined || result.status === change.status),
  );
}
