/** The single canonical public host for CricLume marketing and legal pages. */
export const CRICLUME_ORIGIN = "https://criclume.com";
export const CRICLUME_OG_IMAGE = `${CRICLUME_ORIGIN}/icon-512.png`;
export const HOME_TITLE = "CricLume | Cricket Scoring App, Scorecards & Club Management";
export const HOME_DESCRIPTION =
  "Score cricket ball by ball, create match scorecards, review batting and bowling, and explore cricket club, academy and league tools with CricLume.";

export const cricketSearchTopics = [
  "cricket scoring app",
  "ball-by-ball cricket scoring",
  "cricket scorecard",
  "cricket scorekeeper",
  "live cricket scoreboard",
  "cricket batting statistics",
  "cricket bowling analysis",
  "cricket wagon wheel",
  "cricket team management",
  "cricket league fixtures",
  "cricket academy management",
  "cricket video analysis",
] as const;

export function canonicalUrl(path = "/"): string {
  return new URL(path, CRICLUME_ORIGIN).toString();
}

/**
 * Only describe verifiable product functionality. Do not invent reviews,
 * ratings, named customers, live match stats or paid plan availability.
 */
export const criclumeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${CRICLUME_ORIGIN}/#publisher`,
      name: "CricLume",
      url: canonicalUrl("/"),
      logo: CRICLUME_OG_IMAGE,
      parentOrganization: {
        "@type": "Organization",
        name: "iTechLounge Ltd",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${CRICLUME_ORIGIN}/#website`,
      name: "CricLume",
      url: canonicalUrl("/"),
      inLanguage: ["en", "de", "nl", "af", "fr"],
      publisher: { "@id": `${CRICLUME_ORIGIN}/#publisher` },
      description: HOME_DESCRIPTION,
    },
    {
      "@type": "WebApplication",
      "@id": `${CRICLUME_ORIGIN}/#scorer`,
      name: "CricLume Cricket Scorer",
      url: canonicalUrl("/app"),
      applicationCategory: "SportsApplication",
      operatingSystem: "Web browser",
      description: HOME_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
        description: "Local ball-by-ball cricket scoring",
      },
      featureList: [
        "Record runs, wickets and extras ball by ball",
        "Create cricket scorecards",
        "Save local match records and export score backups",
        "Review recorded cricket footage on a device",
      ],
      publisher: { "@id": `${CRICLUME_ORIGIN}/#publisher` },
    },
  ],
};
