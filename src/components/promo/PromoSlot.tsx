import { useEffect, useState } from "react";
import { promoDwellMs, type PromoItem, type PromoSlot as Slot } from "@/lib/promo-targeting";

/**
 * One rotating ad banner (top or side). Images and GIFs stay for their set time; MP4s play muted
 * to the end (capped at a minute). House adverts are text cards from CricLume.
 */
export function PromoSlot({
  items,
  slot,
  onPlay,
  variant = "page",
  className = "",
}: {
  items: PromoItem[];
  slot: Slot;
  onPlay?: (creativeId: string) => void;
  variant?: "page" | "ground";
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const playable = items.filter((item) => !failed.has(item.creativeId));
  const current = playable.length ? playable[index % playable.length] : undefined;
  const currentId = current?.creativeId ?? "none";

  useEffect(() => {
    setIndex(0);
  }, [items]);

  // Each turn on screen counts as one play (the server counts at most one a minute per viewer).
  useEffect(() => {
    if (!current) return;
    onPlay?.(current.creativeId);
    const timer = window.setTimeout(() => setIndex((value) => value + 1), promoDwellMs(current));
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, currentId]);

  if (!current) return null;
  const skip = () => setFailed((prev) => new Set(prev).add(current.creativeId));
  const media =
    current.kind === "house" && current.card ? (
      <span key={current.creativeId} className="promo-house">
        <span className="promo-house-brand">CricLume</span>
        <span className="promo-house-copy">
          <strong>{current.card.headline}</strong>
          <span>{current.card.line}</span>
        </span>
        {variant === "page" && <span className="promo-house-cta">{current.card.cta}</span>}
      </span>
    ) : current.kind === "video" ? (
      <video
        key={`${current.creativeId}-${index}`}
        src={current.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setIndex((value) => value + 1)}
        onError={skip}
        aria-label={current.alt}
      />
    ) : (
      <img
        key={current.creativeId}
        src={current.url}
        alt={current.alt}
        onError={skip}
        decoding="async"
      />
    );

  const clickable = variant === "page" && current.clickUrl;
  return (
    <aside
      className={`promo-slot promo-slot-${slot} promo-${variant} ${className}`}
      aria-label={`Advert from ${current.advertiser}`}
    >
      {clickable ? (
        <a
          href={current.clickUrl!}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="promo-media"
        >
          {media}
        </a>
      ) : (
        <div className="promo-media">{media}</div>
      )}
      <span className="promo-tag">
        {current.source === "club"
          ? "Club sponsor"
          : current.source === "house"
            ? "CricLume"
            : "Ad"}
      </span>
    </aside>
  );
}
