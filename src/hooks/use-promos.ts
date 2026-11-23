import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMemberPromos, getPromos, reportMemberPromoPlays, reportPromoPlays, reportViewerBoardPlays } from "@/lib/promo.functions";
import { currentCloudSession } from "@/lib/cloud";
import { countsTowardShare, fillPromoSlots, type PromoItem, type PromoSlot, type PromoSurface } from "@/lib/promo-targeting";
import { housePromos } from "@/lib/house-promos";

type PromoSet = Record<PromoSlot, PromoItem[]>;

/**
 * Loads CricLume ad banners for a screen and reports plays in small batches.
 * Signed-in app screens pass `member` so plays can credit the person's club.
 * Order per banner: paid CricLume adverts, then the club's own, then iTechLounge house adverts
 * (also shown offline). Only paid adverts are counted toward a club's revenue share.
 */
export function usePromos(options: { surface: PromoSurface; slug?: string; member?: { organisationId: string | null } | null }) {
  const { surface, slug, member } = options;
  const [loaded, setLoaded] = useState<PromoSet>({ top: [], side: [] });
  const promos = useMemo(() => fillPromoSlots(loaded, { top: [], side: [] }, housePromos), [loaded]);
  const fetchPublic = useServerFn(getPromos);
  const fetchMember = useServerFn(getMemberPromos);
  const reportPublic = useServerFn(reportPromoPlays);
  const reportMember = useServerFn(reportMemberPromoPlays);
  const reportViewer = useServerFn(reportViewerBoardPlays);
  // On a public scoreboard, a signed-in viewer's plays can count for their own club.
  const [viewerSignedIn, setViewerSignedIn] = useState(false);
  const queue = useRef<string[]>([]);
  const signedIn = member != null;
  const organisationId = member?.organisationId ?? null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      try {
        const next = signedIn ? await fetchMember({ data: { organisationId } }) : await fetchPublic({ data: slug ? { surface, slug } : { surface } });
        if (active) setLoaded(next);
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
  }, [surface, slug, signedIn, organisationId, fetchMember, fetchPublic]);

  useEffect(() => {
    if (surface !== "scoreboard" || !slug) return;
    let active = true;
    void currentCloudSession()
      .then((session) => {
        if (active) setViewerSignedIn(Boolean(session));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [surface, slug]);

  useEffect(() => {
    const flush = () => {
      const batch = [...new Set(queue.current)].slice(0, 20);
      queue.current = [];
      if (batch.length === 0) return;
      const sent = signedIn
        ? reportMember({ data: { organisationId, creativeIds: batch } })
        : viewerSignedIn && slug && surface === "scoreboard"
          ? reportViewer({ data: { slug, creativeIds: batch } })
          : reportPublic({ data: slug ? { surface, slug, creativeIds: batch } : { surface, creativeIds: batch } });
      void sent.catch(() => undefined);
    };
    const timer = window.setInterval(flush, 30_000);
    return () => {
      window.clearInterval(timer);
      flush();
    };
  }, [surface, slug, signedIn, viewerSignedIn, organisationId, reportMember, reportPublic, reportViewer]);

  const onPlay = useCallback((creativeId: string) => {
    const item = [...promos.top, ...promos.side].find((entry) => entry.creativeId === creativeId);
    if (!item || !countsTowardShare(item)) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    queue.current.push(creativeId);
  }, [promos]);

  return { promos, onPlay };
}
