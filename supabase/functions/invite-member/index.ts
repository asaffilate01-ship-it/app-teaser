import { errorResponse, handleOptions, json, sha256 } from "../_shared/http.ts";
import { requireOrganisationRole, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    const { client, user } = await requireUser(request);
    const body = (await request.json()) as {
      organisationId?: string;
      email?: string;
      role?: string;
      redirectTo?: string;
    };
    if (!body.organisationId || !body.email || !body.role)
      throw new Error("Organisation, email and role are required.");
    const allowedInviteRoles = [
      "league_admin",
      "club_admin",
      "safeguarding_officer",
      "scorer",
      "coach",
      "player",
      "viewer",
    ];
    if (!allowedInviteRoles.includes(body.role))
      throw new Error("That invitation role is not allowed.");
    await requireOrganisationRole(client, user.id, body.organisationId, [
      "owner",
      "league_admin",
      "club_admin",
    ]);

    const email = body.email.trim().toLowerCase();
    const { data: invite, error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: body.redirectTo,
      data: { organisation_id: body.organisationId, organisation_role: body.role },
    });
    if (inviteError) throw inviteError;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: recordError } = await client.from("invitations").insert({
      organisation_id: body.organisationId,
      email_hash: await sha256(email),
      invited_email: email,
      role: body.role,
      invited_by: user.id,
      expires_at: expiresAt,
    });
    if (recordError) throw recordError;
    if (invite.user?.id) {
      const { error: membershipError } = await client.from("organisation_members").upsert(
        {
          organisation_id: body.organisationId,
          user_id: invite.user.id,
          role: body.role,
          status: invite.user.email_confirmed_at ? "active" : "invited",
        },
        { onConflict: "organisation_id,user_id" },
      );
      if (membershipError) throw membershipError;
    }
    return json({ invited: true, userId: invite.user?.id ?? null, expiresAt }, 200, request);
  } catch (error) {
    return errorResponse(error, 400, request);
  }
});
