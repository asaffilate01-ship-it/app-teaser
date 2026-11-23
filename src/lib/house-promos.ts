import type { PromoItem, PromoSlot } from "./promo-targeting";

/**
 * iTechLounge's own CricLume adverts. They fill any banner with no paid or club advert booked,
 * are never counted and earn clubs no revenue share.
 */
const cards: Array<{ id: string; headline: string; line: string; cta: string; path: string }> = [
  { id: "scoring", headline: "Score every ball, even offline", line: "Free basic scoring for every club. Syncs when you're back online.", cta: "Start free", path: "/#pricing" },
  { id: "analytics", headline: "Full analytics on Club & League plans", line: "Wagon wheels, Manhattans, worms, win chances and player stats.", cta: "See plans", path: "/#pricing" },
  { id: "video", headline: "Turn club phones into cameras", line: "Up to 16 angles per match with replays and coaching review.", cta: "Video add-on", path: "/#features" },
  { id: "ground", headline: "Your scoreboard on the big screen", line: "Rotating score, stats and charts for the crowd at your ground.", cta: "Find out more", path: "/#features" },
  { id: "earn", headline: "Paid clubs earn from adverts", line: "30% of advert money on paid plans, 50% with the video add-on.", cta: "See plans", path: "/#pricing" },
];

export const houseAdvertiser = "CricLume by iTechLounge";

function build(slot: PromoSlot): PromoItem[] {
  return cards.map((card) => ({
    creativeId: `house-${slot}-${card.id}`,
    slot,
    kind: "house",
    url: "",
    durationSeconds: 8,
    advertiser: houseAdvertiser,
    alt: `${card.headline}. ${card.line}`,
    clickUrl: `https://criclume.com${card.path}`,
    source: "house",
    card: { headline: card.headline, line: card.line, cta: card.cta },
  }));
}

export const housePromos: Record<PromoSlot, PromoItem[]> = { top: build("top"), side: build("side") };
