import type { Lang } from "./content.ts";

export type HelpQuestion = { q: string; a: string };

type HelpCopy = {
  search: string;
  placeholder: string;
  clear: string;
  empty: string;
  emptyHint: string;
  contact: string;
  count: string;
  items: HelpQuestion[];
};

export const helpCopy: Record<Lang, HelpCopy> = {
  en: {
    search: "Search questions and answers",
    placeholder: "Try cameras, scoring or privacy",
    clear: "Clear search",
    empty: "No matching questions",
    emptyHint: "Try a different search or contact our team.",
    contact: "Contact support",
    count: "Questions shown",
    items: [
      {
        q: "Can I install CricLume on my phone or tablet?",
        a: "CricLume is an installable web app (PWA). Open it in a supported browser and use the install or Add to Home Screen option. Native App Store and Google Play releases require separate approval.",
      },
      {
        q: "Can a phone measure bowling speed like a speed gun?",
        a: "The video speed tool estimates average delivery speed from measured distance, frame timing and calibration. Review the uncertainty range and use high-frame-rate footage. It is not a certified radar reading.",
      },
      {
        q: "What happens if live scores stop updating?",
        a: "The Live Centre retains the last successfully loaded scores when a refresh fails, labels them as stale and retries automatically. You can also retry manually.",
      },
      {
        q: "Does AI change the official score or select players?",
        a: "No. Coaching and match-analysis suggestions are advisory and require human review. Provider-backed tasks require an approved connection, entitlement and certified budgeted worker. AI does not change official scores.",
      },
      {
        q: "How do I protect junior players and private recordings?",
        a: "Use club-approved consent and safeguarding procedures before recording, set access and retention rules, and avoid publishing identifiable junior information without appropriate permission.",
      },
      {
        q: "How can I back up a match before changing phones?",
        a: "Export a match backup from the scorer, keep it securely, and confirm the cloud queue has cleared if using cloud scoring. Browser storage is device-specific and can be erased.",
      },
      {
        q: "Can staff have different access permissions?",
        a: "Club and match roles separate scoring, coaching and administration. Sign in to the club workspace and have an authorised administrator assign the appropriate access.",
      },
      {
        q: "Why are some video, billing or AI features unavailable?",
        a: "Cloud services require the relevant plan, approved club access and configured integrations. Ask CricLume support to confirm availability for your organisation before relying on them.",
      },
    ],
  },
  de: {
    search: "Fragen und Antworten suchen",
    placeholder: "Zum Beispiel Kameras, Scoring oder Datenschutz",
    clear: "Suche löschen",
    empty: "Keine passenden Fragen",
    emptyHint: "Suche anders oder kontaktiere unser Team.",
    contact: "Support kontaktieren",
    count: "Angezeigte Fragen",
    items: [
      {
        q: "Kann ich CricLume auf Handy oder Tablet installieren?",
        a: "CricLume ist eine installierbare Web-App (PWA). Öffne sie in einem unterstützten Browser und nutze die Installationsfunktion oder die Option zum Startbildschirm. Native App-Store- und Google-Play-Versionen benötigen eine separate Freigabe.",
      },
      {
        q: "Kann ein Handy die Bowling-Geschwindigkeit wie ein Radar messen?",
        a: "Das Videowerkzeug schätzt die mittlere Ballgeschwindigkeit anhand gemessener Distanz, Bildzeit und Kalibrierung. Prüfe den Unsicherheitsbereich und nutze Aufnahmen mit hoher Bildrate. Es ist keine zertifizierte Radarmessung.",
      },
      {
        q: "Was passiert, wenn Live-Scores nicht aktualisiert werden?",
        a: "Das Live-Centre behält die zuletzt erfolgreich geladenen Ergebnisse, kennzeichnet sie als veraltet und versucht die Aktualisierung erneut. Du kannst auch manuell aktualisieren.",
      },
      {
        q: "Ändert KI den offiziellen Spielstand oder wählt sie Spieler aus?",
        a: "Nein. Trainings- und Analysevorschläge sind Empfehlungen, die Menschen prüfen müssen. Externe Modelle benötigen eine freigegebene Verbindung, Berechtigung und einen geprüften budgetierten Dienst. KI ändert keine offiziellen Spielstände.",
      },
      {
        q: "Wie schütze ich Jugendspieler und private Aufnahmen?",
        a: "Beachte die Einwilligungs- und Schutzregeln des Vereins, lege Zugriffsrechte und Aufbewahrungsfristen fest und veröffentliche identifizierbare Jugenddaten nur mit entsprechender Erlaubnis.",
      },
      {
        q: "Wie sichere ich ein Spiel vor dem Handywechsel?",
        a: "Exportiere eine Sicherung im Scorer, verwahre sie sicher und prüfe bei Cloud-Scoring, ob alle Änderungen gesendet wurden. Browserspeicher ist gerätegebunden und kann gelöscht werden.",
      },
      {
        q: "Können Mitarbeiter unterschiedliche Rechte erhalten?",
        a: "Vereins- und Spielrollen trennen Scoring, Training und Verwaltung. Melde dich im Vereinsbereich an und lass die zuständige Administration passende Rechte vergeben.",
      },
      {
        q: "Warum sind manche Video-, Zahlungs- oder KI-Funktionen nicht verfügbar?",
        a: "Cloud-Dienste benötigen den passenden Tarif, freigegebenen Vereinszugang und konfigurierte Integrationen. Frage den CricLume-Support nach der Verfügbarkeit für deinen Verein.",
      },
    ],
  },
  nl: {
    search: "Zoek vragen en antwoorden",
    placeholder: "Probeer camera's, scoren of privacy",
    clear: "Wis zoekopdracht",
    empty: "Geen passende vragen",
    emptyHint: "Probeer een andere zoekterm of neem contact op.",
    contact: "Contact met support",
    count: "Getoonde vragen",
    items: [
      {
        q: "Kan ik CricLume op mijn telefoon of tablet installeren?",
        a: "CricLume is een installeerbare webapp (PWA). Open de app in een ondersteunde browser en kies installeren of toevoegen aan het beginscherm. Native App Store- en Google Play-versies vereisen aparte goedkeuring.",
      },
      {
        q: "Kan een telefoon de balsnelheid meten zoals een radar?",
        a: "De videotool schat de gemiddelde balsnelheid met gemeten afstand, beeldtiming en kalibratie. Bekijk de onzekerheidsmarge en gebruik beelden met een hoge beeldsnelheid. Het is geen gecertificeerde radarmeting.",
      },
      {
        q: "Wat als live scores niet meer worden bijgewerkt?",
        a: "Het Live Centre bewaart de laatst succesvol geladen scores, markeert ze als verouderd en probeert opnieuw. Je kunt ook handmatig vernieuwen.",
      },
      {
        q: "Wijzigt AI de officiële score of kiest AI spelers?",
        a: "Nee. Coaching- en analysevoorstellen zijn adviezen die menselijke beoordeling vereisen. Externe modellen vereisen een goedgekeurde verbinding, toegangsrecht en gecertificeerde dienst met budgetcontrole. AI wijzigt geen officiële scores.",
      },
      {
        q: "Hoe bescherm ik jeugdspelers en privéopnamen?",
        a: "Volg de toestemmings- en beschermingsregels van de club, stel toegang en bewaartermijnen in en publiceer herkenbare jeugdgegevens alleen met passende toestemming.",
      },
      {
        q: "Hoe maak ik een back-up voor ik van telefoon wissel?",
        a: "Exporteer een wedstrijdback-up vanuit de scorer, bewaar die veilig en controleer bij cloudscoring of alle wijzigingen zijn verzonden. Browseropslag is apparaatgebonden en kan worden gewist.",
      },
      {
        q: "Kunnen medewerkers verschillende toegangsrechten krijgen?",
        a: "Club- en wedstrijdrollen scheiden scoren, coaching en beheer. Meld je aan bij de clubomgeving en laat een bevoegde beheerder de juiste toegang toewijzen.",
      },
      {
        q: "Waarom zijn bepaalde video-, betaal- of AI-functies niet beschikbaar?",
        a: "Clouddiensten vereisen een passend abonnement, goedgekeurde clubtoegang en geconfigureerde integraties. Vraag CricLume-support naar de beschikbaarheid voor je organisatie.",
      },
    ],
  },
  af: {
    search: "Soek vrae en antwoorde",
    placeholder: "Probeer kameras, telling of privaatheid",
    clear: "Vee soektog uit",
    empty: "Geen passende vrae nie",
    emptyHint: "Probeer 'n ander soekterm of kontak ons span.",
    contact: "Kontak ondersteuning",
    count: "Vrae gewys",
    items: [
      {
        q: "Kan ek CricLume op my foon of tablet installeer?",
        a: "CricLume is 'n installeerbare webtoepassing (PWA). Maak dit in 'n ondersteunde blaaier oop en kies installeer of voeg by die tuisskerm. Inheemse App Store- en Google Play-weergawes vereis aparte goedkeuring.",
      },
      {
        q: "Kan 'n foon boulspoed soos 'n spoedmeter meet?",
        a: "Die videohulpmiddel skat gemiddelde balspoed uit gemete afstand, raamtyd en kalibrasie. Hersien die onsekerheidsgrens en gebruik hoëraamtempo-video. Dit is nie 'n gesertifiseerde radarmeting nie.",
      },
      {
        q: "Wat as regstreekse tellings ophou bywerk?",
        a: "Die Live Centre behou die laaste suksesvol gelaaide tellings, merk dit as verouderd en probeer weer. Jy kan ook self verfris.",
      },
      {
        q: "Verander KI die amptelike telling of kies dit spelers?",
        a: "Nee. Afrigtings- en ontledingsvoorstelle is advies wat menslike hersiening vereis. Eksterne modelle vereis 'n goedgekeurde verbinding, toegang en 'n gesertifiseerde diens met begrotingsbeheer. KI verander nie amptelike tellings nie.",
      },
      {
        q: "Hoe beskerm ek juniorspelers en private opnames?",
        a: "Volg die klub se toestemmings- en beskermingsprosedures, bepaal toegang en bewaringstydperke en publiseer identifiseerbare juniorinligting slegs met toepaslike toestemming.",
      },
      {
        q: "Hoe rugsteun ek 'n wedstryd voordat ek van foon verander?",
        a: "Voer 'n wedstrydrugsteun uit die tellingstelsel uit, bewaar dit veilig en bevestig dat wolkveranderings gestuur is. Blaaierberging is toestelgebonde en kan uitgevee word.",
      },
      {
        q: "Kan personeel verskillende toegangsregte hê?",
        a: "Klub- en wedstrydrolle skei telling, afrigting en administrasie. Meld by die klubruimte aan en laat 'n gemagtigde administrateur die regte toegang toeken.",
      },
      {
        q: "Waarom is sekere video-, betalings- of KI-funksies nie beskikbaar nie?",
        a: "Wolkdienste vereis die toepaslike plan, goedgekeurde klubtoegang en opgestelde integrasies. Vra CricLume-ondersteuning oor beskikbaarheid vir jou organisasie.",
      },
    ],
  },
  fr: {
    search: "Rechercher des questions et réponses",
    placeholder: "Essayez caméra, score ou confidentialité",
    clear: "Effacer la recherche",
    empty: "Aucune question correspondante",
    emptyHint: "Essayez une autre recherche ou contactez notre équipe.",
    contact: "Contacter le support",
    count: "Questions affichées",
    items: [
      {
        q: "Puis-je installer CricLume sur mon téléphone ou ma tablette ?",
        a: "CricLume est une application web installable (PWA). Ouvrez-la dans un navigateur compatible et utilisez l’installation ou l’ajout à l’écran d’accueil. Les versions natives App Store et Google Play nécessitent une approbation distincte.",
      },
      {
        q: "Un téléphone peut-il mesurer la vitesse de balle comme un radar ?",
        a: "L’outil vidéo estime la vitesse moyenne à partir de la distance mesurée, du temps entre images et du calibrage. Vérifiez la marge d’incertitude et utilisez une cadence élevée. Ce n’est pas une mesure radar certifiée.",
      },
      {
        q: "Que se passe-t-il si les scores en direct ne sont plus actualisés ?",
        a: "Le Live Centre conserve les derniers scores chargés avec succès, les indique comme anciens et réessaie automatiquement. Vous pouvez aussi relancer manuellement.",
      },
      {
        q: "L’IA modifie-t-elle le score officiel ou sélectionne-t-elle les joueurs ?",
        a: "Non. Les suggestions d’entraînement et d’analyse sont consultatives et nécessitent une validation humaine. Les modèles externes exigent une connexion approuvée, des droits et un service certifié avec contrôle budgétaire. L’IA ne modifie pas les scores officiels.",
      },
      {
        q: "Comment protéger les jeunes joueurs et les enregistrements privés ?",
        a: "Suivez les procédures de consentement et de protection du club, définissez les droits et durées de conservation, et ne publiez des données identifiantes de mineurs qu’avec l’autorisation appropriée.",
      },
      {
        q: "Comment sauvegarder un match avant de changer de téléphone ?",
        a: "Exportez une sauvegarde depuis le marqueur, conservez-la en lieu sûr et vérifiez que les modifications cloud ont été envoyées. Le stockage du navigateur est propre à l’appareil et peut être effacé.",
      },
      {
        q: "Le personnel peut-il disposer de droits différents ?",
        a: "Les rôles du club et du match séparent marquage, entraînement et administration. Connectez-vous à l’espace club et demandez à un administrateur autorisé de vous attribuer les droits adaptés.",
      },
      {
        q: "Pourquoi certaines fonctions vidéo, paiement ou IA sont-elles indisponibles ?",
        a: "Les services cloud nécessitent l’offre appropriée, un accès club approuvé et des intégrations configurées. Demandez au support CricLume de confirmer la disponibilité pour votre organisation.",
      },
    ],
  },
};

function normalized(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Accent-insensitive, multi-term matching across both questions and answers. */
export function searchHelpQuestions<T extends HelpQuestion>(
  items: readonly T[],
  query: string,
): T[] {
  const terms = normalized(query.slice(0, 160)).trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const text = normalized(`${item.q} ${item.a}`);
    return terms.every((term) => text.includes(term));
  });
}
