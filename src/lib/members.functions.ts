import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignableRoles, platformRoles, type PlatformRole } from "@/lib/platform";
import { safeInviteRedirect } from "@/lib/invite-redirect";

const input = z.object({
  organisationId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(platformRoles),
  origin: z.string().url().max(200),
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Invites someone to the club with one role. The caller must be an active member who is
 * allowed to hand out that role (owners: any; club/league admins: roles below them).
 * The database guard on memberships re-checks every later role change.
 */
export const inviteClubMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("organisation_members")
      .select("role,status")
      .eq("organisation_id", data.organisationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const actor = me?.status === "active" ? (me.role as PlatformRole) : null;
    if (!actor || data.role === "owner" || !assignableRoles(actor).includes(data.role)) {
      return { ok: false as const, reason: "You can't give that role." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingId } = await supabaseAdmin.rpc("find_user_id_by_email", {
      p_email: data.email,
    });
    let userId = (existingId as string | null) ?? null;
    let confirmed = false;
    if (userId) {
      const { data: existing } = await supabaseAdmin
        .from("organisation_members")
        .select("role")
        .eq("organisation_id", data.organisationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing && !assignableRoles(actor).includes(existing.role as PlatformRole)) {
        return {
          ok: false as const,
          reason: "That person already has a higher role in this club.",
        };
      }
      const { data: found } = await supabaseAdmin.auth.admin.getUserById(userId);
      confirmed = Boolean(found.user?.email_confirmed_at);
    } else {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        {
          redirectTo: safeInviteRedirect(data.origin),
        },
      );
      if (error || !invited.user)
        return {
          ok: false as const,
          reason: "The invitation email could not be sent. Try again shortly.",
        };
      userId = invited.user.id;
    }

    const { error: memberError } = await supabaseAdmin
      .from("organisation_members")
      .upsert(
        {
          organisation_id: data.organisationId,
          user_id: userId,
          role: data.role,
          status: confirmed ? "active" : "invited",
        },
        { onConflict: "organisation_id,user_id" },
      );
    if (memberError) return { ok: false as const, reason: "The membership could not be saved." };
    await supabaseAdmin.from("invitations").insert({
      organisation_id: data.organisationId,
      email_hash: await sha256Hex(data.email),
      invited_email: data.email,
      role: data.role,
      invited_by: context.userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return { ok: true as const, alreadyHadAccount: confirmed };
  });
