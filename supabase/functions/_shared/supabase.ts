import { createClient } from "npm:@supabase/supabase-js@2.112.3";

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required.");
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Authentication required.");
  return { client, user: data.user, token };
}

export async function requireOrganisationRole(
  client: ReturnType<typeof adminClient>,
  userId: string,
  organisationId: string,
  allowedRoles: string[],
) {
  const { data, error } = await client
    .from("organisation_members")
    .select("role, status")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data || !allowedRoles.includes(data.role))
    throw new Error("You do not have permission for this action.");
  return data;
}
