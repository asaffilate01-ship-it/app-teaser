export type OrganisationDraft = {
  requestId: string;
  name: string;
  kind: "club" | "league" | "school" | "academy";
};
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
export const onboardingKey = (userId: string) => `criclume:organisation-request:${userId}`;
export function readOrganisationDraft(
  storage: DraftStorage,
  userId: string,
): OrganisationDraft | null {
  try {
    const value = JSON.parse(storage.getItem(onboardingKey(userId)) ?? "null");
    if (
      value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestId) &&
      typeof value.name === "string" &&
      value.name.trim().length >= 2 &&
      value.name.length <= 120 &&
      ["club", "league", "school", "academy"].includes(value.kind)
    )
      return value;
  } catch {
    /* Storage may be blocked or corrupt. */
  }
  return null;
}
export function storeOrganisationDraft(
  storage: DraftStorage,
  userId: string,
  draft: OrganisationDraft,
): boolean {
  try {
    storage.setItem(onboardingKey(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
