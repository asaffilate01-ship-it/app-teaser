import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMemberPromos, getPromos, reportMemberPromoPlays, reportPromoPlays } from "@/lib/promo.functions";
import type { PromoItem, PromoSlot, PromoSurface } from "@/lib/promo-targeting";

type PromoSet = Record<PromoSlot, PromoItem[]>;

/**
 * Loads CricLume ad banners for a screen and reports plays in small batches.
 * Signed-in app screens pass `member` so plays can credit the person's club.
 * Fails quietly (offline, no ads booked): the banners simply don't appear.
 */
export function usePromos(options: { surface: PromoSurface; slug?: string; member?: { organisationId: string | null } | null }) {
  const { surface, slug, member } = options;
  const [promos, setPromos] = useState<PromoSet>({ top: [], side: [] });
  const fetchPublic = useServerFn(getPromos);
  const fetchMember = useServerFn(getMemberPromos);
  const reportPublic = useServerFn(reportPromoPlays);
  const reportMember = useServerFn(reportMemberPromoPlays);
  const queue = useRef<string[]>([]);
  const signedIn = member != null;
  const organisationId = member?.organisationId ?? null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      try {
        const next = signedIn ? await fetchMember() : await fetchPublic({ data: slug ? { surface, slug } : { surface } });
        if (active) setPromos(next);
      } catch {
        // No ads is a fine outcome.
      }
    };
    void load();
    // File links last six hours; refresh well before that and pick up new bookings.
    const timer = window.setInterval(() => void load(), 15 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [surface, slug, signedIn, fetchMember, fetchPublic]);

  useEffect(() => {
    const flush = () => {
      const batch = [...new Set(queue.current)].slice(0, 20);
      queue.current = [];
      if (batch.length === 0) return;
      const sent = signedIn
        ? reportMember({ data: { organisationId, creativeIds: batch } })
        : reportPublic({ data: slug ? { surface, slug, creativeIds: batch } : { surface, creativeIds: batch } });
      void sent.catch(() => undefined);
    };
    const timer = window.setInterval(flush, 30_000);
    return () => {
      window.clearInterval(timer);
      flush();
    };
  }, [surface, slug, signedIn, organisationId, reportMember, reportPublic]);

  const onPlay = useCallback((creativeId: string) => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    queue.current.push(creativeId);
  }, []);

  return { promos, onPlay };
}
