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

## Build

Both html files are produced the same way (React pinned to the version already
inlined — 19.2.5):

```
esbuild <src>/main.jsx --bundle --minify --format=iife --jsx=automatic \
  --define:process.env.NODE_ENV='"production"' --legal-comments=eof --outfile=bundle.js
```

where `main.jsx` is `import App from "./App.jsx"; createRoot(#root).render(<App/>)`.
The bundle is then wrapped in the existing HTML shell (lines 1–37 of the current
html: `<head>` + loading-spinner script), closed with `</script></body></html>`.
Keep that shell byte-for-byte; only the `<script>` bundle changes between builds.
