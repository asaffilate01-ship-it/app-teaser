import { createServerFn } from "@tanstack/react-start";

/**
 * The visitor's country as reported by our hosting network (two-letter code or null).
 * Used only to pick the default price list; nothing is stored or sent elsewhere.
 */
export const getVisitorCountry = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ country: string | null }> => {
    try {
      const { getRequest, getRequestHeader } = await import("@tanstack/react-start/server");
      const { readVisitorPlace } = await import("./promo-targeting");
      let cf: Record<string, unknown> | null = null;
      try {
        cf = ((getRequest() as unknown as { cf?: Record<string, unknown> }).cf ?? null) as Record<
          string,
          unknown
        > | null;
      } catch {
        cf = null;
      }
      return { country: readVisitorPlace((name) => getRequestHeader(name) ?? null, cf).country };
    } catch {
      return { country: null };
    }
  },
);
