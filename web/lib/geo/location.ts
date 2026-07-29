import { FLAG_ASSETS, type FlagAsset } from "../flags.data";
import type { FlagCode } from "../flags";

/**
 * Country resolution. SERVER-ONLY — never import this from a client component:
 * it pulls in the full flag asset table (~200 kB) plus the location map below,
 * none of which belongs in a browser bundle. lib/view.ts resolves the flag once
 * on the server and puts the chosen asset on the card face.
 *
 * The location map is a curated lookup we own — no dependency, no geocoding
 * service, no network call. It is deliberately CONSERVATIVE: a profile that says
 * "the internet", "remote", "/dev/null" or nothing at all gets NO flag. Guessing
 * a nationality wrong on someone's card is worse than showing none, so every
 * rule here has to be one a person would agree with on sight.
 */

/**
 * Per-user flag overrides, keyed by lowercased GitHub login and checked BEFORE
 * the location mapper. This is where a human decision goes, so the mapper below
 * can stay strictly fact-only — it should never have to encode "this particular
 * person is probably from here".
 *
 * Deliberately tiny, and only for the landing-page showcase faces:
 *   sindresorhus — has NO location set on GitHub at all, so nothing is there to
 *                  resolve. Norwegian; recorded here rather than guessed.
 *   karpathy     — his location reads "Stanford", which is a university/town
 *                  rather than a city the mapper should be inferring a country
 *                  from. Moved here so "stanford" is not a needle in the map.
 */
const MANUAL_OVERRIDES: Record<string, FlagCode> = {
  sindresorhus: "NO",
  karpathy: "US",
};

/** Cricketer nation (from our own data) → flag. Exact, not fuzzy. */
const NATION_TO_CODE: Record<string, FlagCode> = {
  India: "IN", Australia: "AU", England: "EN", Pakistan: "PK", "South Africa": "ZA",
  "West Indies": "WI", "New Zealand": "NZ", "Sri Lanka": "LK", Bangladesh: "BD",
  Zimbabwe: "ZW", Ireland: "IE", Afghanistan: "AF", Scotland: "SC", Netherlands: "NL",
  Namibia: "NA", Nepal: "NP", "United Arab Emirates": "AE", Oman: "OM",
  "United States of America": "US", Canada: "CA", "Papua New Guinea": "PG", Kenya: "KE",
};

export function flagForNation(nation: string | null): FlagCode | null {
  return nation ? NATION_TO_CODE[nation] ?? null : null;
}

/**
 * Needles per country, matched against a padded lowercase location string.
 * Order matters only where one country's needle could sit inside another's, so
 * the few genuinely ambiguous tokens are spelled out with their separators
 * (" ca ", " uk ") rather than left as bare substrings.
 */
const LOCATION_RULES: [FlagCode, string[]][] = [
  // ── subcontinent ──────────────────────────────────────────────────────────
  ["IN", ["india", "bengaluru", "bangalore", "mumbai", "bombay", "delhi", "gurgaon", "gurugram",
    "noida", "hyderabad", "chennai", "madras", "pune", "kolkata", "calcutta", "ahmedabad",
    "jaipur", "kerala", "kochi", "chandigarh", "indore", "lucknow", "bhubaneswar", "coimbatore"]],
  ["PK", ["pakistan", "karachi", "lahore", "islamabad", "rawalpindi", "peshawar"]],
  ["BD", ["bangladesh", "dhaka", "chittagong"]],
  ["LK", ["sri lanka", "colombo"]],
  ["NP", ["nepal", "kathmandu"]],
  // ── oceania / africa ──────────────────────────────────────────────────────
  ["AU", ["australia", "sydney", "melbourne", "brisbane", "perth", "canberra", "adelaide"]],
  ["NZ", ["new zealand", "auckland", "wellington", "christchurch"]],
  ["ZA", ["south africa", "johannesburg", "cape town", "pretoria", "durban"]],
  ["NG", ["nigeria", "lagos", "abuja"]],
  ["KE", ["kenya", "nairobi"]],
  ["EG", ["egypt", "cairo"]],
  ["ZW", ["zimbabwe", "harare"]],
  // ── europe ────────────────────────────────────────────────────────────────
  ["DE", ["germany", "deutschland", "berlin", "munich", "münchen", "hamburg", "cologne",
    "köln", "frankfurt", "stuttgart", "leipzig", "dresden"]],
  ["FR", ["france", "paris", "lyon", "marseille", "toulouse", "bordeaux", "nantes"]],
  ["ES", ["spain", "españa", "madrid", "barcelona", "valencia", "seville", "sevilla", "bilbao"]],
  ["IT", ["italy", "italia", "rome", "roma", "milan", "milano", "turin", "torino", "naples", "bologna"]],
  ["NL", ["netherlands", "amsterdam", "holland", "rotterdam", "utrecht", "eindhoven", "the hague"]],
  ["BE", ["belgium", "brussels", "bruxelles", "antwerp", "ghent"]],
  ["PT", ["portugal", "lisbon", "lisboa", "porto"]],
  ["CH", ["switzerland", "zurich", "zürich", "geneva", "genève", "lausanne", "basel", "bern"]],
  ["AT", ["austria", "vienna", "wien", "graz", "salzburg"]],
  ["SE", ["sweden", "sverige", "stockholm", "gothenburg", "göteborg", "malmö", "malmo"]],
  ["NO", ["norway", "norge", "oslo", "bergen", "trondheim"]],
  ["DK", ["denmark", "danmark", "copenhagen", "københavn", "aarhus"]],
  ["FI", ["finland", "suomi", "helsinki", "espoo", "tampere"]],
  ["PL", ["poland", "polska", "warsaw", "warszawa", "krakow", "kraków", "wroclaw", "wrocław", "poznan", "gdansk"]],
  ["CZ", ["czech", "czechia", "prague", "praha", "brno"]],
  ["RO", ["romania", "bucharest", "bucuresti", "bucurești", "cluj", "timisoara"]],
  ["HU", ["hungary", "budapest"]],
  ["GR", ["greece", "athens", "thessaloniki"]],
  ["UA", ["ukraine", "kyiv", "kiev", "lviv", "kharkiv", "odesa", "odessa"]],
  ["RU", ["russia", "moscow", "saint petersburg", "st. petersburg", "novosibirsk", "yekaterinburg"]],
  ["IE", ["ireland", "dublin", "cork", "galway"]],
  ["SC", ["scotland", "edinburgh", "glasgow", "aberdeen"]],
  // England before the generic UK bucket: our card set has a distinct England flag.
  ["EN", ["england", "london", "manchester", "birmingham", "leeds", "bristol", "liverpool",
    "cambridge", "oxford", "brighton", "sheffield", "newcastle", "nottingham"]],
  ["GB", ["united kingdom", " uk ", " u.k.", "britain", "wales", "cardiff", "belfast",
    "northern ireland"]],
  // ── middle east ───────────────────────────────────────────────────────────
  ["AE", ["united arab emirates", " uae ", "dubai", "abu dhabi"]],
  ["OM", ["oman", "muscat"]],
  ["IL", ["israel", "tel aviv", "jerusalem", "haifa"]],
  ["TR", ["turkey", "türkiye", "turkiye", "istanbul", "ankara", "izmir"]],
  // ── asia-pacific ──────────────────────────────────────────────────────────
  ["JP", ["japan", "tokyo", "osaka", "kyoto", "yokohama", "fukuoka"]],
  ["KR", ["south korea", "korea", "seoul", "busan", "incheon"]],
  ["CN", ["china", "beijing", "shanghai", "shenzhen", "guangzhou", "hangzhou", "chengdu", "nanjing"]],
  ["TW", ["taiwan", "taipei", "hsinchu"]],
  ["HK", ["hong kong", "hongkong"]],
  ["SG", ["singapore"]],
  ["MY", ["malaysia", "kuala lumpur", "penang"]],
  ["ID", ["indonesia", "jakarta", "bandung", "surabaya", "bali"]],
  ["TH", ["thailand", "bangkok", "chiang mai"]],
  ["VN", ["vietnam", "viet nam", "hanoi", "ho chi minh", "saigon", "da nang"]],
  ["PH", ["philippines", "manila", "cebu", "quezon city"]],
  // ── americas ──────────────────────────────────────────────────────────────
  ["CA", ["canada", "toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary",
    "edmonton", "waterloo", "quebec", "québec"]],
  ["MX", ["mexico", "méxico", "mexico city", "guadalajara", "monterrey"]],
  ["BR", ["brazil", "brasil", "são paulo", "sao paulo", "rio de janeiro", "belo horizonte",
    "curitiba", "porto alegre", "brasilia", "brasília", "recife", "florianópolis", "florianopolis"]],
  ["AR", ["argentina", "buenos aires", "córdoba, argentina", "rosario"]],
  ["CO", ["colombia", "bogota", "bogotá", "medellin", "medellín"]],
  ["CL", ["chile", "santiago, chile", "valparaiso"]],
  ["US", ["united states", " usa ", " u.s.", " u.s.a", "america", "new york", " nyc ",
    "san francisco", " sf bay", "bay area", "silicon valley", "seattle", "boston", "austin",
    "california", " ca ", " ny ", " tx ", " wa ", " ma ", "washington", "portland", "oregon",
    "chicago", "los angeles", " la, ", "denver", "atlanta", "san diego", "san jose",
    "mountain view", "palo alto", "sunnyvale", "cupertino", "redmond", "pittsburgh",
    "philadelphia", "houston", "dallas", "miami", "phoenix", "minneapolis", "detroit",
    "salt lake city", "ann arbor", "boulder", "raleigh", "durham, nc", "brooklyn",
    "manhattan", "berkeley", "cambridge, ma", "new jersey", "virginia",
    "colorado", "utah", "michigan", "wisconsin", "arizona", "nevada", "georgia, us"]],
];

/**
 * Best-effort GitHub location → country. Conservative by design: anything that
 * does not hit a curated needle returns null and the card simply shows no flag.
 *
 * The needle list is scanned in order and the FIRST country to match wins, so
 * the more specific buckets (England) sit above the broader ones (United
 * Kingdom). Matching is done on a space-padded lowercase string, which is what
 * lets two-letter needles like " ca " match "San Francisco, CA" without also
 * firing inside words such as "Canberra".
 */
export function flagForLocation(location: string | null): FlagCode | null {
  if (!location) return null;
  const s = ` ${location.toLowerCase().replace(/[/|]/g, " ")} `;
  for (const [code, needles] of LOCATION_RULES) {
    if (needles.some((n) => s.includes(n))) return code;
  }
  return null;
}

/** Code → the inline SVG the card renders. Server-side; the asset table stops here. */
export function flagAsset(code: FlagCode | null): FlagAsset | null {
  return code ? FLAG_ASSETS[code] ?? null : null;
}

/**
 * A GitHub user's flag: explicit override first, then the location mapper.
 * `login` is optional so the plain location path stays usable on its own.
 */
export function flagForUser(login: string | null, location: string | null): FlagCode | null {
  const override = login ? MANUAL_OVERRIDES[login.toLowerCase()] : undefined;
  return override ?? flagForLocation(location);
}

/** Convenience for the callers in lib/view.ts and the showcase patch script. */
export const assetForNation = (nation: string | null) => flagAsset(flagForNation(nation));
export const assetForLocation = (location: string | null) => flagAsset(flagForLocation(location));
export const assetForUser = (login: string | null, location: string | null) =>
  flagAsset(flagForUser(login, location));
