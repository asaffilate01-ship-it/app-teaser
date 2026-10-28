export type EvidenceFilters = {
  search: string;
  kind: "all" | "image" | "video";
  people: "all" | "adult" | "junior";
};
export const defaultEvidenceFilters: EvidenceFilters = { search: "", kind: "all", people: "all" };
export const evidencePageSize = 24;
export function evidencePageRequest(filters: EvidenceFilters, page: number) {
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000)
    throw new Error("Invalid evidence page.");
  if (
    !["all", "image", "video"].includes(filters.kind) ||
    !["all", "adult", "junior"].includes(filters.people)
  )
    throw new Error("Invalid evidence filter.");
  const search = filters.search.trim();
  if (search.length > 150) throw new Error("Use a search of up to 150 characters.");
  return {
    from: page * evidencePageSize,
    to: page * evidencePageSize + evidencePageSize,
    // Literal substring search: SQL pattern characters must not expand the search.
    pattern: search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null,
  };
}
