# EFA Live Duty Limits — repo guide

One self-contained `index.html`. No build step, no dependencies, no network call. Vanilla JS,
same arrangement as the Fatigue Assessor and Route-map repos — not the bundled-`.jsx` shape the
Allowance repo uses. Keep it that way: this thing gets opened on a phone, on a bay, on airport
wifi.

```
node tests-extract.mjs && node tests-rules.mjs     # 282 assertions — run before every commit
```

## The file has four sections and only one of them may decide a limit

`SECTION 1` reference data · `SECTION 2` time helpers · `SECTION 3` the engine ·
`/* ── END OF ENGINE` · `SECTION 4` UI.

`tests-extract.mjs` slices SECTION 1–3 out of `index.html` on that end marker and writes
`model.gen.mjs` for the tests to import, so the tests read the real source rather than a copy
that drifts. Two consequences:

- **Move the marker and the tests silently test less.** It throws on a marker miss, so don't
  delete it, and don't let a rule creep below it.
- **A helper the tests reach for must be in `EXPORTS`** in `tests-extract.mjs`, or the test
  file cannot see it.

`model.gen.mjs` is generated. Never commit it, never edit it.

## RULE: the limit tables belong to the Fatigue Assessor

`FDP_PLANNING`, `FDP_LIVE`, `FDP_AUGMENTED`, `FDP_OUTSIDE`, the `FDD_*` constants, `DP_MAX_HOURS`,
the `AIRPORTS` list, `UOA_LON_MIN/MAX`, `NEAR_ABS_MINUTES`/`NEAR_PCT`, and the `fdpLimit` /
`fddLimit` / `against` / `bandFor` / `pickBySectors` functions are lifted verbatim from
[Fatigue-Assessor](https://github.com/EFA-ROSTERALLOWANCE/Fatigue-Assessor)'s `index.html`.

A pilot on the bay and the assessor reading the same roster must never disagree about what the
limit is. **A change to any of them belongs in both repos**, and `tests-rules.mjs` asserts every
cell of every table so a one-sided change fails here.

The time helpers (`utcOffset`, `absMin`, `localAt`, `parseTime`, `fmtDur`) come from the same
place for the same reason. `resolveNear` and `fmtCount` are this repo's own.

## What the engine actually is

Everything downstream of sign-on is durations, so the whole duty is one chain:

```
off blocks + taxi out + airborne + taxi in = on blocks
on blocks + ground = next off blocks
```

Delay any link and the rest slides with it. Each limit is a ceiling on an *instant* — the FDP
on the last operating on blocks plus 15 minutes, the duty period on sign-off — so `latestPush`
is that ceiling walked backwards through the fixed part of the chain. `computeDuty` builds the
chain and measures it; `latestPush` inverts it. Nothing else in the file does arithmetic on time.

The round-trip test is the one that matters: run the chain forward from the computed latest push
and the binding limit must land **exactly** on its ceiling, on every basis (live, planning, extra
hour, three crew). If you change either function, that test is what proves you didn't break it.

## Three rules that change the answer by hours

- **Positioning before an operating sector counts toward the FDP and the sector count;
  positioning after the last operating sector does not** (s 6.2). So `fdpEndAbs` uses `lastOp`
  and `signOffAbs` uses the last sector, and on a trip that dead-heads home the two diverge and
  the Protocol's 16 h binds instead of the FDP. `limitSectors` counts up to and including
  `lastOp` — a dead-head home is not a sector for the table.
- **Four or more sectors reverts an augmented duty to the two-pilot table** (s 6.9), so three
  crew can be buying nothing. `fdpLimit` handles it; the UI says so.
- **Outside the usual operational area the limit keys off the rest BEFORE the duty, not the
  sign-on time** (s 6.10.1). The prior-rest field only appears when the origin is outside, and
  blank means unknown, which takes the shorter row.

## The extra hour is not yet nailed down

`EXTRA_HOUR` adds a flat hour to whichever FDP limit applies. It is off by default and every
panel that uses it says so. **The clause is unconfirmed** — see the TODO on the constant — and
so is whether it stacks on the s 6.8.2 live figure or only on the s 6.8.1 planning one. Settle
that against the FAM before anyone relies on it, and mirror whatever it turns out to be into
the Fatigue Assessor if that repo grows the same switch.

## Patterns are generated, not written

`PATTERNS` sits between the `── PATTERNS` and `── END PATTERNS` markers and is produced by

```
node tools/patterns-from-routemap.mjs ../route-map/index.html
```

from the Route-map repo, which is the source of truth for what EFA flies. It is committed so the
app stays one file. **Regenerate rather than hand-edit** — a hand-edited leg is a leg that
disagrees with the map.

Block time is computed across zones with **standard** offsets, not the IANA zone: a pairing
recurs weekly and carries no date, so there is no date to resolve DST against. The check that
this is right is MEL–PER coming out at 4:10, which is what Route-map prints against it. Live
times entered by the user *do* go through the IANA zone, via `absMin`/`localAt`.

`tests-rules.mjs` computes every pattern in the file and, for every duty that prints an Rls,
asserts the computed sign-off matches it. That is the schedule checking our arithmetic, and it
catches a bad generator run immediately. Note the lead-in — report to first off blocks — is
**not always 60 minutes** (P127 day 2 reports nearly two hours before push), so it comes from
the pairing sheet, not a constant.

## UI

State is one plain object. Inputs write into it and call `render()`, which rebuilds the
read-only panels only — an input must never lose focus mid-type. The sector list is rebuilt
(`renderSectors`) only when its *shape* changes: adding, removing, or toggling a sector. The
delegated `input` listener therefore patches the sector card's header text by hand rather than
re-rendering the card. If you add a field to a sector card, add it to that patch or the header
goes stale.

## Day / night

Colours are CSS custom properties, never hex literals in a style. The palette is defined **three
times**, with the same token names and the same values as the Fatigue Assessor:

- `:root` — the light palette, and the base.
- `@media (prefers-color-scheme:dark) :root:not([data-theme="light"])` — dark applied
  automatically from the device.
- `:root[data-theme="dark"]` — dark applied explicitly by the header toggle.

So the phone's own setting wins until the reader picks a side, and then the toggle wins in both
directions. `<html>` carries **no** `data-theme` in the source — hardcoding one there would pin
every reader to that theme whatever their phone says.

Rules when touching colour:

- **A token needs a value in all three blocks.** Miss one and it goes undefined in that theme,
  which fails silently and reads as a rendering bug.
- **Never concatenate alpha onto a colour** — `` `${c}40` `` cannot work on a `var()`. Use
  `color-mix(in srgb, var(--x), transparent N%)`.
- `color-scheme` is set per theme and inputs take `color-scheme:inherit`, so the native date and
  time pickers — which this app leans on heavily — follow the theme too.

Theme is display only: `themeIsDark`/`syncThemeBtn` flip the attribute and nothing is persisted,
so a reload returns to the device setting. The button shows what tapping it will *do*, not what
is currently on, and a `matchMedia` listener keeps it honest if the phone flips underneath.

## iPhone

The app is read on a phone in Edge or Safari, which share the WebKit quirks. The `── Phone`
block in the stylesheet is not decoration:

- **`-webkit-text-size-adjust:100%`.** Without it iOS inflates text in narrow columns and the
  page renders visibly larger than anywhere else — the layout boxes stay put while the type
  grows, which is what it looks like when someone reports "it's huge on my phone".
- **Every input and select is 16px.** Focusing a control under 16px zooms the viewport and iOS
  does not zoom back out.
- **Tap targets are 44px minimum**, and `env(safe-area-inset-*)` padding keeps content out of
  the notch and the home indicator.
- `@media (hover:none)` drops hover affordances, which otherwise stick after a tap.

`.grp label` is a **descendant** selector on purpose. It was `.grp > label`, and the two-up date
and sign-on row puts its labels one div deeper — so those two rendered unstyled, at body size in
sentence case, beside small uppercase ones. If you add a nested layout, check the labels.
