# EFA Live Duty Limits

One question, asked from the flight deck with the clock running:

> We're delayed in WSI. What is the latest we can push and still sign off in PER inside limits?

Open `index.html` on a phone. Pick the pattern, check the times, and the answer is the
number at the top of the screen — the latest off blocks, which limit is holding it, and how
much delay you have left.

Nothing is uploaded, stored or transmitted. It is one HTML file with no build step, no
dependencies and no network call.

## What it asks for

- **Sign-on** date and local time.
- **Sectors** — from and to, taxi out, airborne time, taxi in, and the ground time on the bay
  before the next one. Block time is the three added up. Sign-off is taken as **15 minutes
  after the last on blocks** (s 6.6.4).
- **Actual off blocks** on any sector, when the delay has already happened. Everything after
  it slides. A time typed with no date resolves to the nearest occurrence, so pushing at 00:40
  against an expected 23:50 reads as 50 minutes late, not 23 hours early.
- **2 or 3 crew**, and whether you are willing to use the extra hour.
- **Live or planning limits.** Live (s 6.8.2) is the default and is the right basis on the day:
  it is what Flight Crew Operations may amend a roster to once it has moved. Planning (s 6.8.1)
  is the tighter figure the roster was built to, and is there for comparison.

## What it measures against

| | Clause | Notes |
|---|---|---|
| Flight duty period | s 6.8.1 / s 6.8.2 / s 6.9 / s 6.10.1 | Four tables can apply; the app names the one it used and the row it read |
| Duty period | Rostering Protocol cl 2.4 | 16 h, and it includes the dead-head home that the FDP does not |
| Flight deck duty | s 6.13 | Block time — a delay on the bay does not move it, an extra sector does |

The limit tables are byte-identical to the [Fatigue Assessor](https://github.com/EFA-ROSTERALLOWANCE/Fatigue-Assessor)'s.
That repo answers the same rules backwards, over a whole bid period, after the fact; this
answers them forwards, for the duty you are sitting in. A pilot and the assessor must never
disagree about what the limit is, so a change to a table in either repo belongs in both.

Two things the app is careful about, because they change the answer by hours:

- **Positioning before an operating sector counts; positioning after it does not** (s 6.2). So
  on a trip that dead-heads home the FDP stops 15 minutes after the last operating sector
  lands, while the duty period runs on to the end of the dead-head — and the Protocol's 16 h
  is then what bites first, not the FDP.
- **Four or more sectors reverts an augmented duty to the two-pilot table** (s 6.9), so the
  third pilot can be buying nothing.

The **extra hour** is modelled as a flat hour on top of whichever FDP limit applies, off by
default, and never folded silently into a figure. See the TODO in `index.html` — the clause
and whether it stacks on the live figure or only the planning one still need confirming
against the FAM.

## Day or night

The page follows your phone's own light/dark setting, and the ☾/☀ button in the header overrides
it either way. Nothing is persisted, so a reload goes back to following the device.

## Patterns

The pairing list comes from the [Route-map](https://github.com/EFA-ROSTERALLOWANCE/Route-map)
repo — 35 duties across 14 pairings — and is committed into `index.html` so the app stays one
self-contained file. Route-map is the source of truth for what we actually fly, so regenerate
rather than hand-edit:

```
node tools/patterns-from-routemap.mjs ../route-map/index.html
```

and paste the output between the `PATTERNS` markers.

## Tests

```
node tests-extract.mjs && node tests-rules.mjs
```

282 assertions. `tests-extract.mjs` slices the engine out of `index.html` itself, so the tests
read the real source rather than a copy that can drift.

Three things are being defended. **The tables** — every cell of every FDP table, straight off
the FAM, because a wrong cell is invisible: the app still produces a confident time, it is just
the wrong one. **The chain** — the 7345 pairing is the worked example, and the computed off
blocks, on blocks and sign-off have to reproduce Route-map's printed schedule to the minute,
including the MEL–PER sector that crosses two hours of time zone. Every pairing in the file
with a printed Rls is checked the same way. **The answer** — run the chain forward from the
latest push and the FDP has to land exactly on the limit, on every limit basis. That round
trip is the whole product.

## Limits of the tool

It reads what you type, not what the aircraft did, and it is an aid built from the published
documents rather than a statement of compliance. It does not know about your cumulative hours,
the rest you had, or whether Crewing will actually amend the roster. The 8-hour continuous
flight deck duty limit for an augmented crew depends on how in-flight rest is split, which it
cannot know, so only the 14-hour total is checked. The Captain and Crewing own the decision.

Unofficial. © 2026 Thomas Pappin.
