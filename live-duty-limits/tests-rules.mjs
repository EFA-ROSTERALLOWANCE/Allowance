/* Tests for the live-limits engine. Run:
     node tests-extract.mjs && node tests-rules.mjs

   Three things are being defended here.

   1. THE TABLES. Every cell of every FDP table, straight off the FAM, because
      a wrong cell is invisible — the app still produces a confident time, it
      is just the wrong one. These are the same figures the Fatigue Assessor
      asserts, so a change in one repo that is not mirrored in the other shows
      up as a failure here.
   2. THE CHAIN. The 7345 pairing is the worked example: the app's computed
      off blocks, on blocks and sign-off have to reproduce Route-map's printed
      schedule to the minute, INCLUDING the MEL->PER sector that crosses two
      hours of time zone. If the chain drifts, every answer drifts with it.
   3. THE ANSWER. Latest push, walked back from each limit, must land exactly
      on the limit when the chain is run forward from it again. That
      round-trip is the whole product.
*/
import * as M from './model.gen.mjs';

let pass = 0, fail = 0;
const eq = (got, want, what) => {
  const ok = got === want || (typeof got === 'number' && typeof want === 'number' && Math.abs(got-want) < 1e-9);
  if(ok) pass++; else { fail++; console.log('FAIL ' + what + '\n  got  ' + got + '\n  want ' + want); }
};
const ok = (cond, what) => { if(cond) pass++; else { fail++; console.log('FAIL ' + what); } };

/* ── 1. Limit tables ────────────────────────────────────────────────────── */
const lim = (o) => M.fdpLimit(Object.assign({ crew:2, outside:false, prevOdpH:null, basis:'live' }, o)).h;
const t = s => M.parseTime(s);

/* s 6.8.1 planning, every cell. Sector keys are upper bounds: 3 covers 1-3. */
for(const [start, row] of [['05:30',{3:12,4:11,5:10,6:10}], ['09:00',{3:13,4:11,5:11,6:10}],
                           ['14:00',{3:12,4:11,5:10,6:10}], ['22:00',{3:11,4:10,5:9,6:9}],
                           ['02:00',{3:11,4:10,5:9,6:9}]])
  for(const [sec, h] of Object.entries(row))
    eq(lim({ startMin:t(start), sectors:Number(sec), basis:'planning' }), h,
       's 6.8.1 ' + start + ' ' + sec + ' sectors');

/* s 6.8.2 live, every cell, including the 2-sector column the planning table
   does not have and the "7 or more" row. */
for(const [start, row] of [['05:30',{2:13,3:12,4:12,5:11,6:11,7:10}], ['09:00',{2:14,3:13,4:12,5:12,6:11,7:10}],
                           ['14:00',{2:13,3:12,4:12,5:11,6:11,7:10}], ['22:00',{2:12,3:11,4:11,5:10,6:10,7:9}]])
  for(const [sec, h] of Object.entries(row))
    eq(lim({ startMin:t(start), sectors:Number(sec) }), h, 's 6.8.2 ' + start + ' ' + sec + ' sectors');
eq(lim({ startMin:t('09:00'), sectors:12 }), 10, 's 6.8.2 twelve sectors falls in the 7-or-more row');

/* The band that wraps midnight is one band, not two. */
eq(lim({ startMin:t('15:00'), sectors:2 }), 12, 's 6.8.2 band starts at 15:00');
eq(lim({ startMin:t('04:59'), sectors:2 }), 12, 's 6.8.2 band runs to 04:59');
eq(lim({ startMin:t('05:00'), sectors:2 }), 13, 's 6.8.2 next band starts at 05:00');
eq(lim({ startMin:t('00:00'), sectors:2 }), 12, 's 6.8.2 midnight is inside the wrapping band');

/* s 6.9 augmented, and the reversion at four sectors. */
eq(lim({ crew:3, sectors:2, startMin:t('09:00') }), 16, 's 6.9 three crew, two sectors');
eq(lim({ crew:3, sectors:3, startMin:t('09:00') }), 15, 's 6.9 three crew, three sectors');
eq(lim({ crew:3, sectors:4, startMin:t('09:00') }), 12, 's 6.9 four sectors reverts to the 2-pilot live table');
eq(M.fdpLimit({ crew:3, sectors:2, startMin:t('09:00'), basis:'live' }).clause, 's 6.9', 's 6.9 clause named');
eq(M.fdpLimit({ crew:3, sectors:4, startMin:t('09:00'), basis:'live' }).clause, 's 6.8.2',
   'reverted duty is judged on s 6.8.2, not s 6.9');

/* s 6.10.1 outside the usual area — keyed on prior rest, not start time. */
eq(lim({ outside:true, sectors:3, startMin:t('09:00') }), 11, 's 6.10.1 under 30 h prior rest');
eq(lim({ outside:true, sectors:3, startMin:t('09:00'), prevOdpH:31 }), 13, 's 6.10.1 30 h+ prior rest');
eq(lim({ outside:true, sectors:5, startMin:t('22:00'), prevOdpH:31 }), 12, 's 6.10.1 five sectors');
eq(lim({ outside:true, sectors:3, startMin:t('22:00') }), 11,
   's 6.10.1 ignores start time — a 22:00 sign-on gets the same figure as 09:00');
eq(lim({ crew:3, outside:true, sectors:3, startMin:t('09:00') }), 15,
   's 6.10.2 augmented limits apply outside the usual area too');

/* Which ports are outside it. */
ok(M.isUOA('SYD') && M.isUOA('SIN') && M.isUOA('HKG'), 'SYD, SIN, HKG inside the usual operational area');
ok(!M.isUOA('BKK') && !M.isUOA('CCK') && !M.isUOA('LHR'), 'BKK, CCK, LHR outside it');
ok(M.isUOA('XCH'), 'XCH at 105.7E is inside');

/* s 6.13 flight deck duty. */
eq(M.fddLimit(2, 1).h, 10.5, 's 6.13 basic crew, single sector');
eq(M.fddLimit(2, 3).h, 10,   's 6.13 basic crew, multi sector');
eq(M.fddLimit(3, 2).h, 14,   's 6.13 augmented total');
ok(M.fddLimit(3, 2).contUnassessable, 's 6.13 continuous limit reported as unassessable');

/* Near-limit band. */
eq(M.against(11*60, 12*60).sev, 'ok',   '1 h of margin is ok');
eq(M.against(11*60+31, 12*60).sev, 'near', '29 min of margin has no margin');
eq(M.against(11*60+18, 12*60).sev, 'near', '93% of the limit has no margin');
eq(M.against(12*60+1, 12*60).sev, 'over', 'one minute past is over');

/* ── 2. Time helpers ────────────────────────────────────────────────────── */
eq(M.absMin('2026-06-01','12:00','PER') - M.absMin('2026-06-01','12:00','SYD'), 120,
   'PER noon is two hours after SYD noon in winter');
eq(M.absMin('2026-01-15','12:00','PER') - M.absMin('2026-01-15','12:00','SYD'), 180,
   'and three hours in Sydney daylight saving');
eq(M.localAt(M.absMin('2026-06-01','23:30','SYD') + 90, 'SYD').date, '2026-06-02',
   'crossing midnight rolls the date');
eq(M.fmtDur(750), '12:30', 'durations print H:MM');
eq(M.fmtDur(-45), '-0:45', 'and negative ones keep the sign');
eq(M.fmtTime(1470), '00:30', 'clock times wrap at midnight');

/* resolveNear: a wall clock typed with no date lands on the nearest
   occurrence, which is the whole point — a push at 00:40 against an expected
   23:50 is 50 minutes late, not 23 hours early. */
const expect = M.absMin('2026-06-01','23:50','SYD');
eq(M.resolveNear('00:40','SYD',expect) - expect, 50, 'a post-midnight push resolves forward');
eq(M.resolveNear('23:20','SYD',expect) - expect, -30, 'an early push resolves backward');

/* ── 3. The 7345 chain, against Route-map's printed schedule ────────────── */
const p = M.PATTERNS.find(x => x.id === 'P7345MON-D1');
ok(!!p, 'the 7345 Monday day-1 duty is in the pattern list');
eq(p.legs.length, 2, '7345 day 1 has two sectors');
eq(p.legs[0].blk, 95,  '7345 WSI-MEL block is 1:35, as Route-map prints it');
eq(p.legs[1].blk, 250, '7359 MEL-PER block is 4:10 across two hours of time zone');
eq(p.legs[0].grnd, 90, 'and 1:30 on the bay in MEL');

const secs = p.legs.map(l => ({
  dep:l.dep, arr:l.arr, pax:l.pax, taxiOut:15, taxiIn:10, flight:l.blk-25, ground:l.grnd, offT:'',
}));
const base = { date:'2026-06-01', signOn:'21:50', origin:'WSI', crew:2, basis:'live',
               extension:'none', leadIn:60, prevOdpH:null, sectors:secs };
const d = M.computeDuty(base);

const at = (abs, code) => M.fmtTime(M.localAt(abs, code).min);
eq(at(d.secs[0].offAbs,'WSI'), '22:50', 'pushes WSI 22:50');
eq(at(d.secs[0].onBlocksAbs,'MEL'), '00:25', 'on blocks MEL 00:25');
eq(at(d.secs[1].offAbs,'MEL'), '01:55', 'pushes MEL 01:55');
eq(at(d.secs[1].onBlocksAbs,'PER'), '04:05', 'on blocks PER 04:05 — the whole point of doing this in UTC');
eq(at(d.signOffAbs,'PER'), '04:20', 'signs off PER 04:20, which is the Rls Route-map prints');
eq(M.fmtDur(d.fdpUsed), '8:30', 'FDP of 8:30');
eq(M.fmtDur(d.dpUsed), '8:30', 'duty period the same — nothing dead-heads home on day 1');
eq(d.limitSectors, 2, 'two sectors count toward the limit');
eq(M.fmtDur(d.fdpLimMin), '12:00', 'a 21:50 sign-on with two sectors is 12 h on the live table');
eq(d.fdpBase.clause, 's 6.8.2', 'judged on the live roster table');
eq(M.fmtDur(d.blockMin), '5:45', 'block time is the two sectors added up');

/* The planning table is tighter, and the extra hour is on top of whichever
   basis is selected. */
eq(M.fmtDur(M.computeDuty({...base, basis:'planning'}).fdpLimMin), '11:00', 'planning limit is 11 h');
eq(M.fmtDur(M.computeDuty({...base, extension:'fcm'}).fdpLimMin), '13:00', "s 6.14 adds the FCM's hour");
eq(M.fmtDur(M.computeDuty({...base, crew:3}).fdpLimMin), '16:00', 'three crew, two sectors, is s 6.9');

/* ── 4. Latest push — the answer ────────────────────────────────────────── */
const lp = M.latestPush(d, 0);
eq(at(lp.at,'WSI'), '02:20', 'latest push out of WSI is 02:20 local');
eq(lp.binding.key, 'fdp', 'held by the flight duty period, not the 16 h duty period');
eq(M.fmtDur(lp.slack), '3:30', 'which is 3:30 of delay from the scheduled 22:50');
eq(at(lp.signOffAt,'PER'), '07:50', 'signing off PER 07:50');

/* The round trip: run the chain forward from the latest push and the FDP has
   to land exactly on the limit, to the minute. This is the property that
   makes the answer trustworthy, so it is checked on every limit basis. */
for(const variant of [{}, {basis:'planning'}, {extension:'fcm'}, {crew:3}, {crew:3, extension:'fcm'}]){
  const v = M.computeDuty({...base, ...variant});
  const l = M.latestPush(v, 0);
  const pushed = M.computeDuty({...base, ...variant,
    sectors: secs.map((s,i) => i === 0 ? {...s, offT: M.fmtTime(M.localAt(l.at,'WSI').min)} : s)});
  const usedAtWire = l.binding.key === 'fdp' ? pushed.fdpUsed : pushed.dpUsed;
  const limAtWire  = l.binding.key === 'fdp' ? pushed.fdpLimMin : pushed.dpLimMin;
  eq(M.fmtDur(usedAtWire), M.fmtDur(limAtWire),
     'round trip: pushing at the latest time lands exactly on the ' + l.binding.key
     + ' limit (' + JSON.stringify(variant) + ')');
}

/* Delaying the SECOND sector is a different question with a different answer:
   the ground time in MEL is behind you, so there is more room. */
const lp2 = M.latestPush(d, 1);
eq(at(lp2.at,'MEL'), '05:25', 'latest push out of MEL is 05:25 local');
eq(M.fmtDur(lp2.slack), '3:30', 'the same 3:30 of slack, because the delay simply moved down the chain');

/* An actual off-blocks pins the chain and everything after it slides. */
const late = M.computeDuty({...base, sectors: secs.map((s,i) => i===0 ? {...s, offT:'00:20'} : s)});
eq(at(late.secs[0].offAbs,'WSI'), '00:20', 'a pinned off blocks after midnight resolves to the right day');
eq(M.fmtDur(late.fdpUsed), '10:00', 'and pushes the FDP out by the 1:30 delay');
eq(late.fdpAssess.sev, 'ok', 'still inside the 12 h live limit');
const later = M.computeDuty({...base, sectors: secs.map((s,i) => i===0 ? {...s, offT:'02:00'} : s)});
eq(M.fmtDur(later.fdpUsed), '11:40', 'a 3:10 delay puts the FDP at 11:40');
eq(later.fdpAssess.sev, 'near', 'which is inside the 93% band — legal, and no margin left');
const latest = M.computeDuty({...base, sectors: secs.map((s,i) => i===0 ? {...s, offT:'04:00'} : s)});
eq(latest.fdpAssess.sev, 'over', 'and 5:10 is over');

/* ── 4b. s 6.14 extensions of duty ──────────────────────────────────────── */
/* The clause raises "flight deck duty and FDP limits" together, by one hour
   for basic crew and two for augmented, and says nothing about the Rostering
   Protocol's duty period — so the 16 h does NOT move, and an extension can
   hand the binding limit over to it. */
eq(M.resolveExtension('none', 2, 0).h, 0, 'no extension is worth nothing');
eq(M.resolveExtension('fcm', 2, 0).h, 1, 's 6.14 basic crew, one hour');
eq(M.resolveExtension('fcm', 3, 0).h, 2, 's 6.14 augmented crew, two hours');
eq(M.resolveExtension('fcm', 2, 0).clause, 's 6.14', 'and it cites s 6.14');

const ext2 = M.computeDuty({...base, extension:'fcm'});
eq(M.fmtDur(ext2.fdpLimMin), '13:00', 'basic crew FDP limit 12:00 becomes 13:00');
eq(M.fmtDur(ext2.fddLimMin), '11:00', 'and flight deck duty 10:00 becomes 11:00 — s 6.14 lifts both');
eq(M.fmtDur(ext2.dpLimMin), '16:00', 'but the Protocol duty period does not move');
const ext3 = M.computeDuty({...base, crew:3, extension:'fcm'});
eq(M.fmtDur(ext3.fdpLimMin), '18:00', 'augmented 16:00 becomes 18:00');
eq(M.fmtDur(ext3.fddLimMin), '16:00', 'and augmented flight deck duty 14:00 becomes 16:00');

/* With two crew the 7345 gains an hour of push. With three, s 6.9 plus the
   two-hour extension puts the FDP past 16 h, so the duty period takes over as
   the binding limit — which is the whole reason the DP is checked at all. */
eq(M.fmtDur(M.latestPush(ext2, 0).slack), '4:30', 'the hour buys an hour of delay');
eq(M.latestPush(ext2, 0).binding.key, 'fdp', 'still held by the FDP on two crew');
eq(M.latestPush(ext3, 0).binding.key, 'dp',
   'on three crew with the two-hour extension the 16 h duty period binds instead');

/* The four-hour split duty extension: basic crew only, and only where a rest
   period of at least four hours actually exists in the duty. Both conditions
   return zero hours with a reason rather than the entitlement. */
eq(M.resolveExtension('split', 2, 4*60).h, 4, 'split duty extension is four hours');
eq(M.resolveExtension('split', 2, 3*60+59).h, 0, 'a 3:59 break does not buy it');
ok(/split duty rest period/.test(M.resolveExtension('split', 2, 90).blocked || ''),
   'and it says the rest period is why');
eq(M.resolveExtension('split', 3, 6*60).h, 0, 'three crew cannot use it at all');
ok(/basic crew/.test(M.resolveExtension('split', 3, 6*60).blocked || ''),
   'and it says basic crew is why');

/* The 7345 has 1:30 in MEL, so the split extension is not available as
   scheduled — but a delay that grows that turnaround past four hours creates
   the rest period, and then it is. That is the live case. */
eq(M.computeDuty({...base, extension:'split'}).ext.h, 0,
   'as scheduled the 7345 has no four-hour break, so nothing is applied');
const splitSecs = secs.map((x,i) => i === 0 ? {...x, ground:4*60} : x);
const splitOk = M.computeDuty({...base, extension:'split', sectors:splitSecs});
eq(splitOk.ext.h, 4, 'grow MEL to four hours and the extension is available');
eq(M.fmtDur(splitOk.fdpLimMin), '16:00', 'lifting the FDP limit to 16:00');
/* Which is exactly where the Rostering Protocol's duty period already was. On
   a duty with nothing dead-heading home the two ceilings then fall on the same
   instant, so the four hours buy the last of them and not a minute more. */
const splitCaps = M.latestPush(splitOk, 0).caps;
eq(splitCaps.length, 2, 'both ceilings are in play');
eq(splitCaps[0].at, splitCaps[1].at,
   'and s 6.14 has lifted the FDP to exactly where cl 2.4 already sat');
eq(M.latestPush(ext3, 0).binding.clause, 'Protocol cl 2.4',
   'past 16 h it is the duty period that answers, whatever s 6.14 did to the FDP');

/* ── 5. Dead-heading home ───────────────────────────────────────────────── */
/* s 6.2: positioning after the last operating sector does not extend the FDP,
   but it does extend the duty period — so the two diverge, and on a long
   enough dead-head the Protocol's 16 h is what bites. P7345THU day 2 is the
   real case: PER-SYD then the car to WSI, both as a passenger. */
const dh = M.computeDuty({ date:'2026-06-01', signOn:'06:00', origin:'SYD', crew:2, basis:'live',
  extension:'none', leadIn:60, prevOdpH:null, sectors:[
    { dep:'SYD', arr:'PER', pax:false, taxiOut:15, flight:275, taxiIn:10, ground:120, offT:'' },
    { dep:'PER', arr:'SYD', pax:true,  taxiOut:15, flight:215, taxiIn:10, ground:0,   offT:'' },
  ]});
eq(dh.lastOp, 0, 'the last operating sector is the first one');
eq(dh.limitSectors, 1, 'the dead-head home does not count toward the sector count');
eq(M.fmtDur(dh.fdpUsed), '6:15', 'FDP ends 15 min after the operating sector lands');
eq(M.fmtDur(dh.dpUsed), '12:15', 'the duty period runs on to the end of the dead-head');
ok(dh.fdpEndAbs < dh.signOffAbs, 'so the two are not the same instant');
eq(M.fmtDur(dh.blockMin), '5:00', 'and only the operating sector is flight deck duty');
const dhp = M.latestPush(dh, 0);
eq(dhp.binding.key, 'dp', 'on this duty the 16 h duty period binds, not the FDP');

/* Positioning BEFORE an operating sector is the opposite: it counts. */
const posOut = M.computeDuty({ date:'2026-06-01', signOn:'06:00', origin:'MEL', crew:2, basis:'live',
  extension:'none', leadIn:60, prevOdpH:null, sectors:[
    { dep:'MEL', arr:'SYD', pax:true,  taxiOut:15, flight:65, taxiIn:10, ground:120, offT:'' },
    { dep:'SYD', arr:'HKG', pax:false, taxiOut:15, flight:425, taxiIn:10, ground:0,  offT:'' },
  ]});
eq(posOut.limitSectors, 2, 'a dead-head out counts toward the sector count');
eq(M.fmtDur(posOut.fdpLimMin), '14:00', 'so the two-sector live figure applies');

/* ── 6. Every pattern in the file computes ──────────────────────────────── */
for(const pat of M.PATTERNS){
  const ss = pat.legs.map(l => ({ dep:l.dep, arr:l.arr, pax:l.pax, taxiOut:15, taxiIn:10,
    flight:Math.max(0,l.blk-25), ground:l.grnd, offT:'' }));
  /* Lead-in is report to the first scheduled off blocks, which the pairing
     sheet states and which is NOT always 60 minutes — P127 day 2 reports
     nearly two hours before push. Assuming 60 here would make the sign-off
     check below fail against Route-map's own Rls. */
  let leadIn = 60;
  if(pat.rpt){
    const a = M.parseTime(pat.rpt), b = M.parseTime(pat.legs[0].depT);
    if(a != null && b != null){ leadIn = b - a; if(leadIn < 0) leadIn += 1440; }
  }
  const r = M.computeDuty({ date:'2026-06-01', signOn:pat.rpt || '08:00', origin:pat.origin,
    crew:pat.crew || 2, basis:'live', extension:'none', leadIn, prevOdpH:null, sectors:ss });
  ok(r != null, pat.id + ' computes');
  ok(r.signOffAbs > r.onAbs, pat.id + ' signs off after it signs on');
  ok(r.dpUsed >= (r.fdpUsed ?? 0), pat.id + ' duty period is never shorter than the FDP');
  const l = M.latestPush(r, 0);
  ok(l && l.at != null, pat.id + ' has a latest push');
  /* Route-map prints the Rls for most duties. Where it does, the computed
     sign-off has to match it — that is the schedule checking our arithmetic. */
  if(pat.rpt && pat.rls && !pat.legs.some(x => x.pax)){
    const dest = pat.legs[pat.legs.length-1].arr;
    eq(M.fmtTime(M.localAt(r.signOffAbs, dest).min), pat.rls, pat.id + ' sign-off matches the printed Rls');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
