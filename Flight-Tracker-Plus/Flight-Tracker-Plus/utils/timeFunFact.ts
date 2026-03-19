/**
 * getTimeFunFact
 * --------------
 * Returns a punchy, relatable comparison for a given number of minutes
 * spent in the air. Used on the Year Recap and Monthly Recap share cards.
 *
 * All durations below are in minutes.
 * References:
 *  - Game of Thrones full series:  4,228 min (71h 8m)
 *  - Breaking Bad full series:      2,965 min (49h 25m)
 *  - The Office (US) full series:   3,021 min (50h 21m)
 *  - Friends full series:           3,900 min (65h)
 *  - FIFA World Cup final (90' + ET): ~120 min
 *  - Average football match (PL):   ~97 min
 *  - Average NBA game:              ~130 min
 *  - Formula 1 race (average):      ~95 min
 *  - Standard transatlantic flight: ~480 min (8h)
 *  - Apollo 11 Moon transit (one way): ~4,320 min (72h)
 *  - Average sleep per night:        480 min (8h)
 *  - Average work day:               480 min (8h)
 *  - Titanic (film):                 194 min
 *  - Lord of the Rings extended trilogy: 682 min
 *  - Average commute (UK/EU, round trip): 90 min
 *  - Full marathon run (average):    ~240 min
 *  - Average shower:                   8 min
 */

const TIERS: Array<{ max: number; facts: Array<(min: number) => string> }> = [
  {
    // < 60 min
    max: 60,
    facts: [
      (m) => `enough to watch ${Math.floor(m / 24)} episodes of Friends \u2615`,
      (m) => `${m} showers if you\u2019re quick about it \uD83D\uDEBF`,
      (m) => `almost a full football match \u26BD`,
      (m) => `enough to binge ${Math.floor(m / 22)} sitcom episodes \uD83D\uDCFA`,
      (m) => `a ${m}-minute power nap you absolutely earned \uD83D\uDE34`,
    ],
  },
  {
    // 60–179 min (1–3h)
    max: 180,
    facts: [
      (m) => `${Math.floor(m / 97)} full Premier League matches \u26BD`,
      (m) => `enough to watch Titanic (and still have ${m - 194 > 0 ? 0 : 194 - m} minutes to spare) \uD83D\uDEA2`,
      (m) => `${(m / 60).toFixed(1)} hours \u2014 that\u2019s a solid power nap \u2708\uFE0F`,
      (m) => `enough to run ${Math.floor(m / 10)} km if you dare \uD83C\uDFC3`,
      (m) => `${Math.floor(m / 8)} showers. Please take at least one. \uD83D\uDEBF`,
      (m) => `almost a full F1 race \uD83C\uDFCE\uFE0F`,
    ],
  },
  {
    // 180–479 min (3–8h)
    max: 480,
    facts: [
      (m) => `enough to watch Lord of the Rings (${Math.floor(m / 227)} films in) \uD83D\uDC8D`,
      (m) => `${Math.floor(m / 97)} Premier League matches back-to-back \u26BD`,
      (m) => `${Math.floor(m / 194)} full Titanic screenings \uD83D\uDEA2`,
      (m) => `${(m / 60).toFixed(1)} hours \u2014 a full work half-day \uD83D\uDCBC`,
      (m) => `${Math.floor(m / 30)} episodes of Black Mirror \uD83D\uDCF1`,
      (m) => `${Math.floor(m / 8)} showers worth of steam \uD83D\uDEBF`,
    ],
  },
  {
    // 480–959 min (8–16h)
    max: 960,
    facts: [
      (m) => `a full work day spent at 35,000 ft \uD83D\uDCBC`,
      (m) => `${Math.floor(m / 97)} football matches \u26BD`,
      (m) => `the Lord of the Rings extended trilogy \u2014 all of it \uD83D\uDC8D`,
      (m) => `${Math.floor(m / 194)} Titanic re-watches \uD83D\uDEA2`,
      (m) => `${Math.floor(m / 45)} episodes of The Bear \uD83C\uDF7D\uFE0F`,
      (m) => `${Math.floor(m / 52)} episodes of Breaking Bad \uD83D\uDC40`,
    ],
  },
  {
    // 960–2964 min (16–49h)
    max: 2965,
    facts: [
      (m) => `${Math.floor(m / 97)} Premier League matches \u26BD \u26BD`,
      (m) => `${(m / 60).toFixed(0)} hours \u2014 almost a full Breaking Bad binge \uD83D\uDC40`,
      (m) => `${Math.floor(m / 130)} full NBA games \uD83C\uDFC0`,
      (m) => `${Math.floor(m / 45)} episodes of Succession \uD83D\uDCBC`,
      (m) => `${(m / 480).toFixed(1)} full work days at 35,000 ft \u2708\uFE0F`,
      (m) => `${Math.floor(m / 9)} episodes of Game of Thrones \uD83D\uDD25`,
    ],
  },
  {
    // 2965–4228 min (49–70h) — you could almost do Breaking Bad AND The Office
    max: 4229,
    facts: [
      (m) => `the entire Breaking Bad series \u2014 start to finish \uD83D\uDC40`,
      (m) => `${Math.floor(m / 9)} Game of Thrones episodes \uD83D\uDD25`,
      (m) => `${Math.floor(m / 97)} football matches (grab some popcorn) \u26BD`,
      (m) => `${Math.floor(m / 130)} NBA games \uD83C\uDFC0`,
      (m) => `${(m / 60).toFixed(0)} hours \u2014 nearly the full GoT series \uD83D\uDEE1\uFE0F`,
      (m) => `${Math.floor(m / 240)} marathons worth of time \uD83C\uDFC3`,
    ],
  },
  {
    // 4228+ min (70h+) — full GoT territory
    max: Infinity,
    facts: [
      (m) => `the entire Game of Thrones series \u2014 all 8 seasons \uD83D\uDC09`,
      (m) => `${(m / 4228).toFixed(1)}x the entire Game of Thrones series \uD83D\uDC09`,
      (m) => `${Math.floor(m / 3900).toFixed(0)} full Friends series (seasons 1\u201310) \u2615`,
      (m) => `${Math.floor(m / 97)} football matches \u26BD \u26BD \u26BD`,
      (m) => `${(m / 4320).toFixed(2)}x the Apollo 11 Moon trip \uD83C\uDF15`,
      (m) => `${Math.floor(m / 240)} marathons in the sky \uD83C\uDFC3\u2708\uFE0F`,
    ],
  },
];

export function getTimeFunFact(totalMinutes: number): string {
  if (totalMinutes <= 0) return "";
  const tier = TIERS.find((t) => totalMinutes < t.max) ?? TIERS[TIERS.length - 1];
  // Deterministic rotation so the same duration always shows the same fact
  const idx = Math.floor(totalMinutes / 60) % tier.facts.length;
  return tier.facts[idx](totalMinutes);
}
