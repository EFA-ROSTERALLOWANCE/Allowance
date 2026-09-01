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

### Meals are attributed by pattern sign-on, not by date

Payroll pays a hotel stay as ONE `CR MEALS ATO` line, in full, in the bid
period whose range contains the pattern's **sign-on date** — whatever dates the
meals themselves fall on. `mealStayOwned()` is that rule, and it has to hold in
BOTH directions:

- **Outgoing** — a stay checking out after the BP ends (SIN 11–13 Jul in a BP
  ending 12 Jul) keeps its whole total here.
- **Incoming** — a stay a BP file carries IN (its pattern signed on in the
  PREVIOUS BP) belongs to that previous BP and must NOT be counted here, even
  though its meal dates land inside this range. Miss this half and the stay is
  paid twice across two BPs.

Verified against real payslips (BP 3741/3745/3751/3755): 15 of 16 `CR MEALS
ATO` lines match to the cent, including the boundary cases in both directions.
When changing meal logic, re-verify the same way rather than reasoning from the
EA — and note payslip PDF columns are offset, so check the earnings rows sum to
`Total Gross` before trusting a figure read off one.

Duty hours are the opposite and are untouched by this: they split at midnight
and settle through the roster header's Carried In/Out. `mealStayOwned` must
never feed DHA or credit hours.

### Carried In is not always additive

The header's two carry figures are not symmetrical, and only one of them can be
applied unconditionally.

- **Carried Out** always applies. That duty is printed on this roster — on the
  BP's last day or a day or two past it — and `isInBaseRange` runs to
  `rangeTo + 7`, so it is always inside a by-date sum and always subtracted.
- **Carried In** applies only to the extent the roster does NOT already print
  it. Usually it prints nothing: the duty lives on the previous BP's roster,
  flagged there as carried out, so the whole figure is added (BP3745 carries in
  11:27, and the 19 Apr QF7526 it belongs to appears only on the BP3741 file).
  But some rosters print it as **leading orphan continuation rows** — duty rows
  with no Duty(Role) code, sitting before the first coded row, because the
  pattern started in the previous BP and no pattern head appears here. BP3755
  (Nichols) opens with `16 Tue <blank> 7526 2245 1040 9:55 9:20` and its header
  reads Carried In 9:55 (9:20) — the same duty. That roster's stated Total Duty
  114:49 / Total Credit 56:38 are the plain in-window sums, so Qantas counts it
  ONCE; adding the header figure on top would count it twice.

It is a quantity, not a flag: BP3721 prints two of the three duties making up
its 18:03 carry-in and leaves the 1:51 post-midnight tail of 30 Nov unprinted.
`carriedInPrinted()` measures the printed part at parse time (stored on
`headerCarry` as `carriedInPrintedDuty`/`carriedInPrintedCredit`) and
`carriedInAddHrs()` returns the remainder. Both are on the parity surface — they
are byte-identical in the two sources and both apps must keep using them.

Verified against every roster in the user's `Rosters` folder that carries hours
in — fully printed: BP3685, BP3741 (Tsunoda), BP3755 (Nichols), BP3761; partly
printed: BP3721; not printed: BP3745, BP3751, BP3755 (Clough), BP3765, BP3771 —
by checking each header's stated totals against the by-date sums. Re-verify that
way after any change here, rather than reasoning from the EA.

Only a selected BP has a sign-on rule to apply; a plain calendar month view has
no patterns of its own, so it stays date-based.

The bulk app implements the same rule in `processRoster` (also `mealStayOwned`).
It is not in `calcAllowancesByDate`, so it is not on the parity surface listed
above — but the two MUST stay in step, or a pilot and management see different
meal totals for a boundary trip. Re-verify both after any change.

It returns meal stays twice:

- `stays` — what MONTH / ROSTER shows. Under a BP chip this is the owned,
  extended grouping (identical to `payStays`), so the tab reads what payroll
  pays; for a plain calendar month it stays clipped to the viewed range.
- `payStays` — the owned grouping over the BP window extended 7 days
  (`isInBaseRange`). Used by PAY CHECK.

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

## Day / night theme (main calculator only)

Colours are CSS custom properties, not hex literals. The palette is defined
three times in the app's `<style>` block, mirroring the EFA bid optimiser
(several tokens carry its exact values):

- `:root` — the light palette, and the base.
- `@media (prefers-color-scheme:dark) :root:not([data-theme="light"])` — dark
  applied automatically from the OS.
- `:root[data-theme="dark"]` — dark applied explicitly by the toggle.

So the OS preference wins until the reader picks a side, and then the toggle
wins in both directions. Theme is a display preference only: `toggleTheme` sets
`data-theme` on `<html>` and nothing is persisted, so a reload returns to the
OS preference. The old `.dark{filter:invert(1)}` hack is gone — it turned the
brand blue orange and inverted the flag emojis.

Rules when touching UI colour:

- **Never write a hex literal in a style.** Use `var(--token)`. Add a token to
  all three blocks if you genuinely need a new colour.
- **Never concatenate alpha onto a colour** (`` `${c}40` `` cannot work on a
  `var()`). Use the module-level `mix(colour, percent)` helper, which emits
  `color-mix(in srgb, … , transparent)`.
- The HTML shell paints a fixed light background, so the style block re-declares
  `html,body{background:var(--bg)}` — keep that when editing the shell.
- `color-scheme` is set on `:root` per theme; inputs use `colorScheme:"inherit"`
  so native date pickers follow the theme.

`index2.html` (bulk summary) has no theme toggle, and theme is not part of the
allowance parity surface above.

## Lint: run it before every build

```
npm install     # once — devDependencies only, nothing ships in the apps
npm run lint    # eslint, one rule: no-undef, over the two .jsx sources
```

`package.json` and `node_modules/` are dev tooling only. The apps are still
self-contained HTML with no runtime dependencies, and `node_modules/` and
`package-lock.json` are gitignored. `package.json` also pins the exact esbuild
and React versions the html files were built with, so a rebuild reproduces them.

The single rule earns its place. Both apps are one large component whose render
code reads dozens of values computed in `derivePeriod` / `processRoster`, and a
value computed there but never **returned** is invisible until a user opens the
exact panel that reads it — the app then dies with a ReferenceError. Nothing
else catches that: esbuild turns an unresolved identifier into a global
reference without complaint, and the resulting bundle builds and parses fine.
That is a shipped crash (commit 3bca400: the DHA carry-in row referenced
`dhaCarryInHrs`, a `derivePeriod` local that was never in its return object, so
expanding DHA allowances took the app down).

So: **add a field to `derivePeriod`'s return object, destructure it in the tab,
and let `npm run lint` confirm it.** Never recompute in a tab to dodge the
plumbing — that is what let the credit row hide the same mistake.

Keep the config narrow. No style rules, no plugins; add a rule only if it
catches a class of bug that actually ships. The globals list is an allowlist of
browser APIs the apps use — every name added there is a name `no-undef` stops
checking, so extend it only when the app genuinely depends on that API.

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
