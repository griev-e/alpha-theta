/**
 * Merchant → category inference for theta — the local, zero-cost auto-tagger.
 *
 * Three layers, best-first, all pure and client-safe:
 *   1. **Learned history** — what *you* have already tagged. `learnRules` builds a
 *      merchant→category memory from the ledger's confirmed (non-"Other") rows, so
 *      once you tag a merchant every future charge from it follows suit. This is
 *      what makes the auto-tagger get smarter the more you use it.
 *   2. **Keyword rules** — the substring table below, scanned top-to-bottom so the
 *      first (more specific) match wins. Free and instant; the shared baseline for
 *      bank-sync and CSV imports that don't carry theta's own categories.
 *   3. **Amount shape** — a last-ditch hint (an unmatched deposit is probably
 *      income), always low-confidence.
 *
 * `categorize()` is the plain keyword pass (kept stable for csv.ts / simplefin.ts);
 * `suggestCategory()` is the full engine and returns a confidence + source so the
 * UI can show how sure a suggestion is and let you review before applying.
 */
import type { Category, Transaction } from "./data";

type Rule = { match: string[]; category: Category; conf?: number };

/** Substring rules, scanned top-to-bottom. Keep specific before generic. */
export const CATEGORIZE_RULES: Rule[] = [
  { match: ["payroll", "paycheck", "direct dep", "deposit from", "interest earned", "dividend", "irs treas", "tax refund", "refund", "reimburs", "cashback reward"], category: "Income", conf: 0.9 },
  { match: ["transfer", "withdrawal", "venmo", "zelle", "cash app", "wire", "autopay", "online pmt", "bill pay", "card payment", "pymt", "atm withdrawal"], category: "Transfer", conf: 0.85 },
  { match: ["rent", "mortgage", "landlord", "property mgmt", "hoa", "leasing", "apartments", "realty"], category: "Housing", conf: 0.9 },
  { match: ["uber", "lyft", "shell", "chevron", "exxon", "mobil", "sunoco", "citgo", "bp ", "gas", "fuel", "parking", "transit", "mta", "metro", "toll", "amtrak", "delta", "united air", "american air", "southwest", "hertz", "avis", "enterprise rent"], category: "Transport", conf: 0.82 },
  { match: ["netflix", "spotify", "hulu", "disney+", "youtube premium", "icloud", "patreon", "prime video", "hbo", "max.com", "audible", "peacock", "paramount+", "apple music", "apple.com/bill", "adobe", "dropbox", "notion", "chatgpt", "openai", "substack", "nyt", "new york times", "wsj"], category: "Subscriptions", conf: 0.88 },
  { match: ["whole foods", "trader joe", "safeway", "kroger", "wegmans", "publix", "aldi", "costco whse", "grocery", "chipotle", "starbucks", "dunkin", "coffee", "mcdonald", "burger", "taco bell", "wendy", "chick-fil", "panera", "restaurant", "sweetgreen", "doordash", "grubhub", "ubereats", "uber eats", "cafe", "pizza", "deli", "bar & grill", "sushi", "thai", "ramen", "bakery"], category: "Food & Dining", conf: 0.8 },
  { match: ["con ed", "coned", "electric", "pg&e", "duke energy", "national grid", "verizon", "at&t", "att ", "t-mobile", "comcast", "xfinity", "spectrum", "water", "sewer", "utility", "internet", "sprint", "cricket wireless"], category: "Utilities", conf: 0.85 },
  { match: ["cvs", "walgreens", "rite aid", "pharmacy", "doctor", "dental", "dentist", "clinic", "hospital", "medical", "urgent care", "quest diag", "labcorp", "equinox", "gym", "fitness", "planet fit", "peloton", "physical therapy", "optometr"], category: "Health", conf: 0.82 },
  { match: ["amc", "cinema", "cinemark", "regal", "theatre", "theater", "ticketmaster", "stubhub", "steam", "playstation", "xbox", "nintendo", "twitch", "concert", "museum", "bowling", "golf", "arcade"], category: "Entertainment", conf: 0.82 },
  { match: ["airbnb", "hotel", "motel", "marriott", "hilton", "hyatt", "expedia", "booking.com", "airlines", "vrbo", "resort", "cruise", "travelocity", "kayak", "priceline"], category: "Travel", conf: 0.85 },
  { match: ["amazon", "amzn", "target", "walmart", "best buy", "apple store", "etsy", "ebay", "ikea", "nike", "adidas", "lululemon", "sephora", "ulta", "home depot", "lowe's", "macy", "nordstrom", "wayfair", "shein", "temu", "store", "shop"], category: "Shopping", conf: 0.72 },
];

/**
 * Normalize a merchant string into a stable matching key: lower-case, strip the
 * store numbers / processor prefixes (`SQ *`, `TST*`, `POS`) and trailing digits
 * that make otherwise-identical merchants look distinct, so "SQ *BLUE BOTTLE 041"
 * and "Blue Bottle Coffee #12" collapse toward the same learned rule.
 */
export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[#*]/g, " ")
    .replace(/\b(sq|tst|pos|sp|ach|pmt|purchase|debit|credit|card|payment|recur|dda)\b/g, " ")
    .replace(/\bx{2,}\d*\b/g, " ")
    .replace(/\d{2,}/g, " ")
    .replace(/[^a-z& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The plain keyword pass: first matching rule wins, or `null` when none match. */
function keywordMatch(merchant: string): { category: Category; conf: number } | null {
  const s = merchant.toLowerCase();
  for (const rule of CATEGORIZE_RULES) {
    if (rule.match.some((k) => s.includes(k))) {
      return { category: rule.category, conf: rule.conf ?? 0.8 };
    }
  }
  return null;
}

/**
 * Infer a category from a merchant/description (keyword layer only). Income /
 * transfer signals win regardless of amount sign, since a refund can arrive as a
 * positive shopping line. Returns "Other" when nothing matches. Kept
 * signature-stable for the CSV importer and the SimpleFIN mapper.
 */
export function categorize(merchant: string): Category {
  return keywordMatch(merchant)?.category ?? "Other";
}

/** A learned merchant→category rule with the share of history that agrees. */
export type LearnedRule = { category: Category; confidence: number; count: number };
export type LearnedRules = Map<string, LearnedRule>;

/**
 * Build a merchant→category memory from already-tagged transactions. A merchant
 * the user has confidently placed (anything but "Other") teaches every future
 * charge from it. When a merchant has been tagged inconsistently, the majority
 * category wins and `confidence` reflects how dominant it was.
 */
export function learnRules(transactions: Transaction[]): LearnedRules {
  const counts = new Map<string, Map<Category, number>>();
  for (const t of transactions) {
    if (t.category === "Other") continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const inner = counts.get(key) ?? new Map<Category, number>();
    inner.set(t.category, (inner.get(t.category) ?? 0) + 1);
    counts.set(key, inner);
  }
  const rules: LearnedRules = new Map();
  for (const [key, inner] of counts) {
    let best: Category = "Other";
    let bestN = 0;
    let total = 0;
    for (const [cat, n] of inner) {
      total += n;
      if (n > bestN) {
        bestN = n;
        best = cat;
      }
    }
    rules.set(key, { category: best, confidence: total ? bestN / total : 0, count: total });
  }
  return rules;
}

export type SuggestSource = "history" | "keyword" | "amount" | "none";
export type Suggestion = { category: Category; confidence: number; source: SuggestSource };

/**
 * The full auto-tagger: learned history first, then keyword rules, then a weak
 * amount hint. `confidence` is 0–1; `source` explains which layer fired so the
 * review UI can label a suggestion ("from your history" vs "matched a keyword").
 */
export function suggestCategory(
  merchant: string,
  amount: number,
  learned?: LearnedRules
): Suggestion {
  const hist = learned?.get(merchantKey(merchant));
  if (hist && hist.category !== "Other") {
    // A merchant tagged the same way many times is near-certain; a single,
    // possibly-accidental tag is trusted less. Blend agreement with volume.
    const volume = Math.min(1, hist.count / 4);
    const confidence = 0.7 + hist.confidence * 0.2 + volume * 0.09;
    return { category: hist.category, confidence: Math.min(0.99, confidence), source: "history" };
  }
  const kw = keywordMatch(merchant);
  if (kw) return { category: kw.category, confidence: kw.conf, source: "keyword" };
  // Nothing recognized: an unexplained deposit is most likely income; an
  // unexplained charge stays "Other" for the user to place.
  if (amount > 0) return { category: "Income", confidence: 0.4, source: "amount" };
  return { category: "Other", confidence: 0, source: "none" };
}
