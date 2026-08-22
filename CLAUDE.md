# EFA Allowance Calculators — repo guide

Two React single-page apps live here. Each is a hand-written `.jsx` source that
is bundled (esbuild, React 19 inlined) into a single self-contained `.html`.

| App | Source | Build output | Purpose |
|-----|--------|--------------|---------|
| Duty / Allowance Calculator | `efa-duty-calculator-v5.jsx` | `index.html` | Per-pilot detailed calculator |
| Bulk Roster Summary | `efa-bulk-roster-summary-v5.jsx` | `index2.html` | Management tool: allowances + salary across many pilots |

`index.old` is an archived earlier build. Keep it.

## RULE: both apps MUST output the same allowances

The two apps share an allowance **engine**. Any change to allowance logic in one
MUST be mirrored in the other so a pilot and management see identical figures.
When you touch any of the shared surface below, change BOTH sources and rebuild
BOTH html files.

Shared engine surface (must stay logically identical in both sources):

- Constants: `RATES`, `INDEX_YEARS`, `AIRPORT_ZONE`, `HOTEL_TRANSIT_MIN`,
  `TRANSIT_REMOVAL_DATE`, `MEAL_RATE_YEARS`, `MEAL_WINDOWS` timing (`wS/wE/key`),
  and every `AIRPORTS` entry's `code`/`tz`/`utcOffset`.
- Helpers: `applyTransitShift`, `getUtcOffsetHours`, `utcMins`, `calcDutyHours`,
  `splitDhaByMidnight`, `totalSlipMins`, `mealsCoveredPerDay`, `resolveSectorDate`,
  `getHotels`, `getDestinations`.
- Core: `calcAllowancesByDate` and `parseQantasRoster` (incl. AS48→DVA,
  OL48/OL06→DDO, OL13/OL11→reserve-activation detection).

Known intentional differences (NOT allowance drift — leave as-is):

- The main calculator has roster-publish-variance DVA logic (`rosterPublish*`
  fields, "Duty Variation — vs Roster Publish Sign-On"). It only fires on
  actual-vs-published sign-on differences, which never exist in a BP-file
  upload, so it does not affect bulk output.
- Salary / years-of-service logic differs (the bulk app computes salary across
  pilots: `SALARIES`, `CPT_BRACKETS`/`FO_BRACKETS`, `paidBracketIdx`,
  `findPilotInList`, `normaliseFleet`, credit-hour thresholds). This is salary,
  not allowances — parity is only required for allowances.
- DHA date-attribution differs by design: the main splits duty at SYD midnight
  per date; the bulk attributes whole-duty to the sector date and lets
  `processRoster`'s header Carried-In/Out adjustment settle BP boundaries. DHA is
  a flat per-hour rate, so both net to the same per-BP total.
- UI/branding (fonts, headings, layout) is app-specific and need not match.

After ANY allowance-logic change, re-verify parity, e.g. diff the shared
constants/functions between the two sources.

## `derivePeriod` (main calculator only)

All the Month/Roster maths — range resolution, `trips`, `dhaItems`, meal
`stays`, `creditItems`, overtime — lives in the module-level `derivePeriod()`
in `efa-duty-calculator-v5.jsx`, not inline in the render. Both the
MONTH / ROSTER and PAY CHECK tabs call it, so they cannot disagree. Add a
field to its return object rather than recomputing anything in a tab.

It returns meal stays twice, and the difference matters:

- `stays` — clipped to the viewed range. What MONTH / ROSTER shows.
- `payStays` — the same grouping over the BP window extended 7 days
  (`isInBaseRange`) and filtered by `ownedByThisBp`. A trip that checks out
  after the BP ends keeps its whole meal total, which is what payroll pays on
  one `CR MEALS ATO` line. Used by PAY CHECK only — it must never feed DHA or
  credit hours, which settle via the roster header's carried in/out values.

This function is main-calculator-only and is NOT part of the parity surface
above; the bulk app has its own aggregation. `derivePayCheck()` sits alongside
it and matches typed payslip lines to what it produced — meal lines to
`payStays` by date span, call-in/DVA lines to `monthDateMap` items by date.

**Pay state must die with a reset.** `paySlip` / `payPdf` hold the user's actual
pay figures, so any new pay-related state has to be cleared in `clearPaySlip()`,
which `clearRoster()` calls — 🗑 CLEAR must never leave pay data on screen for
whoever opens the app next. The empty shape lives in `emptyPaySlip()`; use it
for the initial state too, so adding a field can't fix one and miss the other.
Nothing here is persisted (the app uses no `localStorage`) and a saved payslip
would outlive the roster it was compared against — keep it that way.

## Payslip PDF reader (`pc*` functions, main calculator only)

PAY CHECK can read the earnings table straight out of a payslip PDF. A Qantas
payslip is generated text, not a scan, so this is hand-rolled in ~200 lines
with **no library and no network call** — keeping the app dependency-free.
`pcInflate` → `pcTokens` → `pcPlaceText` → `pcPdfRows` → `pcParsePayslip`.

PDF places text by coordinate, not by row, so `pcPlaceText` replays the text
operators (`Tm`/`Td`/`TD`/`T*`/`Tj`/`TJ`) to recover each string's position and
`pcPdfRows` buckets those into visual rows. Three things will bite you:

- **`endstream` contains `stream`.** The stream-finding regex must exclude a
  preceding letter, or every match lands inside the previous terminator and the
  real content stream is skipped entirely (the failure looks like "no readable
  text", not a crash).
- **Trailing EOL breaks inflate.** The span up to `endstream` usually has a
  trailing newline that `DecompressionStream` rejects as trailing junk — unlike
  Node's `zlib`, which tolerates it. Use the declared `/Length` where it is a
  plain integer, and trim trailing whitespace otherwise.
- **A payslip is two columns.** One visual row can hold an earnings line *and*
  unrelated text from the other column at the same height. `pcParsePayslip`
  therefore locates codes by position within the row and reads only the cells
  to the right of each — never assume the code is `cells[0]`.

`PC_CODES` maps payslip codes to what the calculator compares. Anything else is
collected in `ignored` and shown to the user as skipped rather than dropped
silently. Add a code there rather than loosening the parser.

The reader depends on `DecompressionStream` (guarded, with a manual-entry
fallback message) and is browser-only — it is not exercised by any build step,
so test it by loading a real payslip through the UI.

## Build

Both html files are produced the same way (React pinned to the version already
inlined — 19.2.5):

```
esbuild <src>/main.jsx --bundle --minify --format=iife --jsx=automatic \
  --define:process.env.NODE_ENV='"production"' --legal-comments=eof --outfile=bundle.js
```

where `main.jsx` is `import App from "./App.jsx"; createRoot(#root).render(<App/>)`.

The bundle is then wrapped in the existing HTML shell — **lines 1–38** of the
current html: `<head>`, the loading-spinner script, and the opening `<script>`
on line 38 that the bundle goes inside. Close with `</script></body></html>`.
Keep that shell byte-for-byte (it is CRLF; only the bundle is LF); only the
`<script>` bundle changes between builds. Assert on line 38 being exactly
`<script>` before writing, so a shell edit fails the build instead of silently
emitting a bundle that sits outside any script tag.
