/** Paste-in code for the live score widget on another website. */
export function embedCode(origin: string, slug: string, theme: "dark" | "light" = "dark"): string {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  const src = `${origin.replace(/\/$/, "")}/embed/${safeSlug}${theme === "light" ? "?theme=light" : ""}`;
  return `<iframe src="${src}" title="Live cricket score" width="320" height="150" style="border:0;border-radius:14px;max-width:100%" loading="lazy"></iframe>`;
}
