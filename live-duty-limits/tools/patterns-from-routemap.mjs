/* Regenerate the PATTERNS literal in index.html from the Route-map repo.

   Route-map is the source of truth for what EFA actually flies: its
   `PATTERNS` object holds every pairing leg with its scheduled dep/arr
   wall-clock times, and `PATTERN_OF` maps "<flight>|<day>" onto one. This
   app needs the same legs expressed as DURATIONS — block minutes, ground
   minutes — because a live-limits calculation is arithmetic on durations
   from sign-on, not on a printed timetable.

   Run:
     node tools/patterns-from-routemap.mjs /path/to/route-map/index.html

   It prints the PATTERNS literal to stdout. Paste it into index.html between
   the PATTERNS markers. It is generated ONCE and committed, so the app stays
   a single self-contained file with no build step and no network call.

   Block time is computed across time zones with STANDARD offsets, not the
   IANA zone: a pairing recurs every week and carries no date, so there is no
   date to resolve DST against. Both ports of a domestic sector share a zone
   and the offsets cancel; the one case that matters, MEL->PER, comes out at
   4:10 and matches the block Route-map prints against it.
*/
import fs from 'fs';

const OFF = { SYD:10, WSI:10, MEL:10, PER:8, BNE:10, ADL:9.5, HBA:10, LST:10, CNS:10,
  DRW:9.5, TSV:10, OOL:10, XCH:7, CCK:6.5, SIN:8, XSP:8, BKK:7, HKG:8, MFM:8,
  PVG:8, NGB:8, HND:9, CTS:9, AKL:12, CHC:12, LHR:0, DRS:1 };

const src = fs.readFileSync(process.argv[2], 'utf8');

/* Route-map is plain script, so the two literals can be sliced out and
   evaluated directly. Anchored on `const NAME = {` ... `\n};` at column 0. */
function literal(name){
  const start = src.indexOf('const ' + name + ' = {');
  if(start < 0) throw new Error('marker miss: ' + name);
  const end = src.indexOf('\n};', start);
  if(end < 0) throw new Error('unterminated: ' + name);
  return eval('(' + src.slice(src.indexOf('{', start), end + 2) + ')');
}
const PATTERNS = literal('PATTERNS');
const PATTERN_OF = literal('PATTERN_OF');
const PATTERN_Z_OF = literal('PATTERN_Z_OF');

const mins = t => { const [h,m] = t.split(':').map(Number); return h*60 + m; };

/* Block minutes from wall clock to wall clock across zones. The arrival is
   the next occurrence of that clock time after departure, so a sector that
   lands after midnight, or gains hours flying west, still comes out positive
   and under 24 h. */
function blockMin(l){
  const dOff = OFF[l.dep], aOff = OFF[l.arr];
  if(dOff == null || aOff == null) throw new Error('unknown port ' + l.dep + '/' + l.arr);
  let b = (mins(l.arrT) - aOff*60) - (mins(l.depT) - dOff*60);
  while(b <= 0) b += 1440;
  return b;
}

/* Ground time is on-blocks to the next off-blocks, within one duty. Route-map
   prints `grnd` on the leg; where it is absent (the last leg of a duty, or a
   leg followed by a rest) it is derived from the clocks so the two never
   disagree. */
function groundMin(l, next){
  if(!next) return 0;
  if(l.grnd) return mins(l.grnd);
  const aOff = OFF[l.arr], dOff = OFF[next.dep];
  let g = (mins(next.depT) - dOff*60) - (mins(l.arrT) - aOff*60);
  while(g < 0) g += 1440;
  return g;
}

/* One entry per DUTY, not per pairing: a live-limits calculation is about the
   duty period you are sitting in. The pairing name and day come along so the
   picker can group them. */
const flightsFor = key => Object.entries(PATTERN_OF).filter(([,v]) => v === key).map(([k]) => k.split('|')[0]);
const out = [];
for(const [key, pat] of Object.entries(PATTERNS)){
  const zOf = Object.entries(PATTERN_Z_OF).some(([,v]) => v === key);
  const flights = flightsFor(key);
  pat.days.forEach((day, i) => {
    const legs = day.legs.map((l, j) => ({
      code: l.code, dep: l.dep, arr: l.arr, depT: l.depT, arrT: l.arrT,
      pax: !!l.pax, blk: blockMin(l), grnd: groundMin(l, day.legs[j+1]),
    }));
    out.push({
      id: key + '-D' + (i+1),
      pattern: key,
      flights,
      crew: zOf ? 3 : null,
      title: pat.title,
      day: day.wd,
      dayNo: i + 1,
      dayCount: pat.days.length,
      rpt: day.rpt || null,
      rls: day.rls || null,
      origin: legs[0].dep,
      legs,
    });
  });
}

const j = o => JSON.stringify(o);
const lines = out.map(d =>
  '  { id:' + j(d.id) + ', pattern:' + j(d.pattern) + ', flights:' + j(d.flights)
  + ', crew:' + (d.crew ?? 'null') + ', title:' + j(d.title) + ', day:' + j(d.day)
  + ', dayNo:' + d.dayNo + ', dayCount:' + d.dayCount + ', rpt:' + j(d.rpt)
  + ', rls:' + j(d.rls) + ', origin:' + j(d.origin) + ', legs:[\n'
  + d.legs.map(l => '      { code:' + j(l.code) + ', dep:' + j(l.dep) + ', arr:' + j(l.arr)
      + ', depT:' + j(l.depT) + ', arrT:' + j(l.arrT) + ', pax:' + l.pax
      + ', blk:' + l.blk + ', grnd:' + l.grnd + ' }').join(',\n')
  + '\n  ]}');

process.stdout.write('const PATTERNS = [\n' + lines.join(',\n') + '\n];\n');
console.error('generated ' + out.length + ' duties from ' + Object.keys(PATTERNS).length + ' pairings');
