/**
 * Which club earns the share of an ad play on a public match screen.
 * Same rule as the app: a signed-in viewer's plays count for their own club — here, when that club is
 * one of the two playing. Anyone else (signed out, or from another club) counts for the host club.
 * The ground big screen has no signed-in viewer, so it always counts for the host.
 */
export function creditedClub(options: {
  host: string;
  playing: readonly string[];
  viewerClubs: readonly string[];
}): string {
  const mine = options.playing.find((club) => options.viewerClubs.includes(club));
  return mine ?? options.host;
}
