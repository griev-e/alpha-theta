import { describe, expect, it } from "vitest";
import { splitCsvLine } from "./csvCore";

/**
 * The quoted-field row splitter shared by both importers (alpha `lib/csv.ts`
 * and theta `lib/theta/csv.ts`). A regression here breaks CSV import in *both*
 * apps at once, and it's only covered transitively today — so the RFC-4180-ish
 * edge cases get direct assertions here.
 */
describe("splitCsvLine", () => {
  it("splits a plain comma-separated row", () => {
    expect(splitCsvLine("AAPL,10,150.5")).toEqual(["AAPL", "10", "150.5"]);
  });

  it("keeps commas that live inside a quoted field", () => {
    expect(splitCsvLine('"Alphabet, Inc.",GOOGL,100')).toEqual([
      "Alphabet, Inc.",
      "GOOGL",
      "100",
    ]);
  });

  it("unwraps a doubled quote inside a quoted field", () => {
    expect(splitCsvLine('"3"" pipe","ok"')).toEqual(['3" pipe', "ok"]);
  });

  it("does not trim cells — callers trim as they need", () => {
    expect(splitCsvLine(" AAPL , 10 ")).toEqual([" AAPL ", " 10 "]);
  });

  it("preserves leading and trailing empty cells", () => {
    expect(splitCsvLine(",a,")).toEqual(["", "a", ""]);
  });

  it("returns a single empty cell for an empty line", () => {
    expect(splitCsvLine("")).toEqual([""]);
  });

  it("handles a fully quoted field with only special characters", () => {
    expect(splitCsvLine('"a,b","c""d"')).toEqual(["a,b", 'c"d']);
  });

  it("treats a quote that opens mid-cell as entering quoted mode", () => {
    // Real exports are messy; the splitter shouldn't throw on odd placement.
    expect(splitCsvLine('AAPL,"note with, comma",5')).toEqual([
      "AAPL",
      "note with, comma",
      "5",
    ]);
  });
});
