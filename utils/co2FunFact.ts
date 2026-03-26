/**
 * getCO2FunFact
 * Returns a fun, rotating comparison for a given CO2 amount in kg.
 * Rotation is deterministic (based on co2Kg value) so the same flight
 * always shows the same fact, but different flights / months show variety.
 *
 * Taylor Swift's Eras Tour private jet averaged ~8,293 kg CO2 per flight (2023 data).
 * A single Eras Tour show private-jet leg is used as the "ultra high" reference.
 */

const TAYLOR_PER_FLIGHT_KG = 8293; // kg CO2 per TS private jet flight (approx)

function pct(co2Kg: number, ref: number): string {
  const p = (co2Kg / ref) * 100;
  if (p < 0.1) return `${(p * 1000).toFixed(0)} thousandths of a %`;
  if (p < 1) return `${p.toFixed(2)}%`;
  return `${p.toFixed(1)}%`;
}

const TIERS: Array<{ max: number; facts: Array<(co2Kg: number) => string> }> = [
  {
    // < 5 kg  — micro tier
    max: 5,
    facts: [
      (k) => `${Math.round(k / 0.0001).toLocaleString()} burps worth of CO₂`,
      (k) => `${Math.round(k / 0.00021).toLocaleString()} text messages sent`,
      (k) => `charging your phone ${Math.round(k / 0.008).toLocaleString()} times`,
      (k) => `${Math.round(k / 0.003).toLocaleString()} Google searches`,
      (k) => `${pct(k, TAYLOR_PER_FLIGHT_KG)} of a Taylor Swift private jet hop \u2728`,
      (k) => `${Math.round(k / 0.002).toLocaleString()} minutes of scrolling Instagram`,
    ],
  },
  {
    // 5–19 kg  — low tier
    max: 20,
    facts: [
      (k) => `${Math.round(k / 0.06).toLocaleString()} donuts from the bakery`,
      (k) => `${Math.round(k / 0.021).toLocaleString()} cups of coffee`,
      (k) => `${Math.round(k / 0.1).toLocaleString()} glasses of wine`,
      (k) => `${Math.round(k / 0.05).toLocaleString()} avocado toasts`,
      (k) => `${pct(k, TAYLOR_PER_FLIGHT_KG)} of a Taylor Swift Eras Tour jet leg \u2728`,
      (k) => `${Math.round(k / 0.067).toLocaleString()} bananas (yes, bananas have a footprint)`,
    ],
  },
  {
    // 20–49 kg  — medium-low tier
    max: 50,
    facts: [
      (k) => `${Math.round(k / 0.021).toLocaleString()} cups of coffee`,
      (k) => `${Math.round(k / 0.055).toLocaleString()} hrs of Netflix binging`,
      (k) => `${Math.round(k / 0.5).toLocaleString()} pizza deliveries`,
      (k) => `${Math.round(k / 0.07).toLocaleString()} chocolate bars`,
      (k) => `${pct(k, TAYLOR_PER_FLIGHT_KG)} of a Taylor Swift private jet flight \u2728`,
      (k) => `${Math.round(k / 0.04).toLocaleString()} cans of beer produced`,
    ],
  },
  {
    // 50–99 kg  — medium tier
    max: 100,
    facts: [
      (k) => `${Math.round(k / 0.055).toLocaleString()} hrs of Netflix binging`,
      (k) => `${Math.round(k / 0.3).toLocaleString()} beers at the pub`,
      (k) => `${Math.round(k / 0.5).toLocaleString()} pizza deliveries`,
      (k) => `driving ${Math.round((k / 0.21) * 1.6).toLocaleString()} km in an average car`,
      (k) => `${pct(k, TAYLOR_PER_FLIGHT_KG)} of a Taylor Swift Eras Tour private flight \u2728`,
      (k) => `${Math.round(k / 1.7).toLocaleString()} kg of beef produced`,
    ],
  },
  {
    // 100–499 kg  — high tier
    max: 500,
    facts: [
      (k) => `${Math.round(k / 0.3).toLocaleString()} beers at the pub`,
      (k) => `${Math.round(k / 0.5).toLocaleString()} pizza deliveries`,
      (k) => `driving ${Math.round((k / 0.21) * 1.6).toLocaleString()} km in an average car`,
      (k) => `${Math.round(k / 1.7).toLocaleString()} kg of beef (that's a lot of burgers)`,
      (k) => `${pct(k, TAYLOR_PER_FLIGHT_KG)} of a Taylor Swift Eras Tour private jet leg \u2728`,
      (k) => `${Math.round(k / 50).toLocaleString()} trees needed to offset this for a year`,
    ],
  },
  {
    // 500+ kg  — ultra tier
    max: Infinity,
    facts: [
      (k) => `${Math.round(k / 0.5).toLocaleString()} pizza deliveries`,
      (k) => `driving ${Math.round((k / 0.21) * 1.6).toLocaleString()} km in an average car`,
      (k) => `${Math.round(k / 50).toLocaleString()} trees needed to offset for a year`,
      (k) => `${(k / 1000).toFixed(1)} tonnes of CO₂ — that's wild`,
      (k) => `${pct(k, TAYLOR_PER_FLIGHT_KG)} of a Taylor Swift private jet flight \u2728`,
      (k) => `${Math.round(k / 1.7).toLocaleString()} kg of beef — moo`,
    ],
  },
];

export function getCO2FunFact(co2Kg: number): string {
  if (co2Kg <= 0) return "";
  const tier = TIERS.find((t) => co2Kg < t.max) ?? TIERS[TIERS.length - 1];
  const idx = Math.floor(co2Kg) % tier.facts.length;
  return tier.facts[idx](co2Kg);
}
