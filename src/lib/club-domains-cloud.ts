import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { friendly } from "./club-office-cloud";
import type { DomainStatus } from "./club-domain-records";

export type ClubDomainRow = Database["public"]["Tables"]["club_site_domains"]["Row"];
export type StaffDomainRow =
  Database["public"]["Functions"]["admin_club_site_domains"]["Returns"][number];

function fail(error: { message: string } | null) {
  if (error) throw new Error(friendly(error.message));
}

export const clubDomainCloud = {
  async load(organisationId: string): Promise<{ allowed: boolean; domain: ClubDomainRow | null }> {
    const [allowed, domain] = await Promise.all([
      supabase.rpc("club_custom_domain_allowed", { p_org: organisationId }),
      supabase
        .from("club_site_domains")
        .select("*")
        .eq("organisation_id", organisationId)
        .neq("status", "declined")
        .maybeSingle(),
    ]);
    fail(allowed.error);
    fail(domain.error);
    return { allowed: allowed.data === true, domain: domain.data };
  },
  async request(organisationId: string, hostname: string) {
    const { error } = await supabase.rpc("request_club_site_domain", {
      p_organisation_id: organisationId,
      p_hostname: hostname,
    });
    fail(error);
  },
  async requestCriclume(organisationId: string, label: string) {
    const { error } = await supabase.rpc("request_club_criclume_address", {
      p_organisation_id: organisationId,
      p_label: label,
    });
    fail(error);
  },
  async remove(organisationId: string) {
    const { error } = await supabase.rpc("remove_club_site_domain", {
      p_organisation_id: organisationId,
    });
    fail(error);
  },
};

export const staffDomainCloud = {
  async list(): Promise<StaffDomainRow[]> {
    const { data, error } = await supabase.rpc("admin_club_site_domains");
    fail(error);
    return data ?? [];
  },
  async update(
    id: string,
    patch: { status: DomainStatus; aTarget: string; records: string; note: string },
  ) {
    const { error } = await supabase.rpc("admin_update_club_site_domain", {
      p_id: id,
      p_status: patch.status,
      p_dns_a_target: patch.aTarget,
      p_dns_txt_value: patch.records,
      p_staff_note: patch.note,
    });
    fail(error);
  },
};
