/** Fan Player of the Match vote: standings from the public tally (player refs → votes). */
export interface FanVoteRow {
  ref: string;
  name: string;
  votes: number;
  share: number;
}

export function fanVoteStandings(
  votes: Record<string, number>,
  names: Record<string, string>,
): FanVoteRow[] {
  const total = Object.entries(votes).reduce(
    (sum, [ref, n]) => (names[ref] ? sum + Math.max(0, n) : sum),
    0,
  );
  return Object.entries(names)
    .map(([ref, name]) => {
      const n = Math.max(0, votes[ref] ?? 0);
      return { ref, name, votes: n, share: total ? Math.round((n / total) * 100) : 0 };
    })
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
}

/** One anonymous id per phone, so a fan can change their vote but not vote twice. */
export function fanVoterId(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  random: () => string,
): string {
  const key = "criclume.fan-voter.v1";
  const existing = storage?.getItem(key);
  if (existing && existing.length >= 16) return existing;
  const id = random();
  try {
    storage?.setItem(key, id);
  } catch {
    /* private mode */
  }
  return id;
}
