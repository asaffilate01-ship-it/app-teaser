/** Player auction maths: purse left, squad size, and the most a team can bid while still filling its squad. */
export interface AuctionLot { status: string; sold_team_id: string | null; sold_price_minor: number | null; base_price_minor: number }

export function teamPosition(lots: readonly AuctionLot[], teamId: string, purseMinor: number, maxSquad: number, minLotMinor = 0) {
  const bought = lots.filter((l) => l.status === "sold" && l.sold_team_id === teamId);
  const spent = bought.reduce((sum, l) => sum + (l.sold_price_minor ?? 0), 0);
  const left = purseMinor - spent;
  const slots = Math.max(0, maxSquad - bought.length);
  // Keep enough to buy the remaining places at the cheapest base price.
  const maxBid = slots === 0 ? 0 : Math.max(0, left - (slots - 1) * minLotMinor);
  return { bought: bought.length, spent, left, slots, maxBid };
}

/** "Name, role, base price" lines pasted from a spreadsheet. */
export function parseLots(text: string): { player_name: string; role: string | null; base_price_minor: number }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[,\t;]/).map((cell) => cell.trim()))
    .filter((cells) => (cells[0] ?? "").length >= 2)
    .slice(0, 300)
    .map(([name, role, base]) => ({ player_name: name!.slice(0, 80), role: role ? role.slice(0, 40) : null, base_price_minor: Math.max(0, Math.round((Number(base) || 0) * 100)) }));
}
