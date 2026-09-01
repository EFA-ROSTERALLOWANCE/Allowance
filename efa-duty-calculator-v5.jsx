import { useState, useEffect } from "react";

// BUILD 2026-07-11: SYD-time DHA attribution + credit-split at boundary applied.
// If your HTML build predates this line, the boundary sector's DHA/OT won't show.

// ─── EA 2025 ──────────────────────────────────────────────────────────────────
const INDEX_YEARS = [
  { label: "EBA Commencement", mult: 1.0000 },
  { label: "EBA 1 Jan 2027",   mult: 1.0300 },
  { label: "EBA 1 Jan 2028",   mult: 1.0609 },
  { label: "EBA 1 Jan 2029",   mult: 1.0927 },
];
const RATES = {
  DVA_CPT:400, DVA_FO:250, DDO_CPT:1231, DDO_FO:837,
  DHA_CPT:17.51, DHA_FO:11.41, MISSED_MEAL:83.40, ACCOM_OPTOUT:75,
};
// Salary table per FFPP column index (matches INDEX_YEARS order)
// YOS tiers: 0=<3y, 1=3-5y, 2=5-7y, 3=7+y
// F/O only has 3 tiers (<3, 3-5, 5+), so tiers 2 & 3 use the "5+" row.
const SALARY = {
  a330: {
    cpt: [
      [252088.38, 259651.03, 267440.56, 275463.77],
      [259651.03, 267440.56, 275463.77, 283727.69],
      [267440.56, 275463.77, 283727.69, 292239.52],
      [275463.77, 283727.69, 292239.52, 301006.70],
    ],
    fo: [
      [163907.89, 168825.12, 173889.88, 179106.57],
      [168825.12, 173889.88, 179106.57, 184479.77],
      [173889.88, 179106.57, 184479.77, 190014.16],
      [173889.88, 179106.57, 184479.77, 190014.16],
    ],
  },
  a320: {
    cpt: [
      [221130.15, 227764.06, 234596.98, 241634.89],
      [227764.06, 234596.98, 241634.89, 248883.94],
      [234596.98, 241634.89, 248883.94, 256350.45],
      [241634.89, 248883.94, 256350.45, 264040.97],
    ],
    fo: [
      [143778.85, 148092.21, 152534.98, 157111.03],
      [148092.21, 152534.98, 157111.03, 161824.36],
      [152534.98, 157111.03, 161824.36, 166679.09],
      [152534.98, 157111.03, 161824.36, 166679.09],
    ],
  },
};
const YOS_OPTIONS = [
  { label: "Less than 3 years", idx: 0 },
  { label: "3–5 years", idx: 1 },
  { label: "5–7 years", idx: 2 },
  { label: "7+ years", idx: 3 },
];

// ─── EFA Pilot List (valid 1 Jan 2026) ───────────────────────────────────────
// Format: [SURNAME, FIRST_INITIAL, DATE_OF_JOINING (YYYY-MM-DD)]
const PILOT_LIST = [
["CLOUGH","P","2006-10-16"],["HOPKINS","M","2006-11-20"],["DEVINE","G","2007-01-08"],
["MILLER","A","2007-01-08"],["KAMVISSIS","A","2007-01-22"],["PETERS","T","2007-03-12"],
["DURDEN","M","2007-09-24"],["KIRSH","A","2008-11-11"],["DAVEY","H","2011-01-06"],
["ENGLISH","K","2011-07-20"],["BENNET","R","2012-08-15"],["MCMAHON","D","2013-01-14"],
["PUGH","B","2013-01-14"],["OSBORNE","A","2013-06-17"],["MORRIS","H","2015-06-19"],
["LARNACH","N","2017-11-28"],["SQUIRRELL","T","2018-04-10"],["TRENTIN","R","2018-06-12"],
["ORR","R","2018-06-12"],["SHARPE","M","2019-02-12"],["MCDARMONT","A","2019-03-04"],
["HARDONIN","R","2019-05-24"],["BEN-DAVID","E","2019-08-05"],["SCHRODTER","M","2019-09-25"],
["CLAY","D","2019-09-25"],["O'DEA","P","2019-11-03"],["LLOYD","T","2019-11-03"],
["PERRAS","P","2020-02-08"],["CITERNE","P","2020-02-25"],["KEMP","S","2020-02-25"],
["SEMENIKOW","S","2020-03-02"],["DAVIS","B","2020-03-30"],["CLACK","P","2020-04-01"],
["LOPES","C","2020-04-01"],["GODFREY","C","2020-04-01"],["STRAUSS","A","2021-06-07"],
["TURNER","D","2021-07-19"],["MCSTAY","B","2021-07-19"],["QUACH","J","2021-07-19"],
["EWING","J","2021-07-19"],["MURRAY","J","2022-01-24"],["RATTLE","B","2022-02-01"],
["PROTHERO","C","2022-02-01"],["DOE","C","2022-02-10"],["REDWIN","T","2022-04-01"],
["HARPER","A","2022-05-02"],["RYDER","J","2022-05-02"],["TSUNODA","J","2022-05-02"],
["FULLER","D","2022-05-09"],["ROBERTS","A","2022-06-06"],["BROWN","N","2022-07-04"],
["BARRY","C","2022-07-18"],["SWANSON","N","2022-07-18"],["BATCHELOR","B","2022-07-18"],
["AHEARN","J","2022-07-25"],["THOMPSON","G","2022-08-15"],["SMITH","A","2022-08-15"],
["EPSTEIN","R","2022-08-15"],["LUO","J","2022-12-30"],["MCKENDRY","S","2023-01-09"],
["O'BRIEN","G","2023-01-09"],["GRASSO","P","2023-03-02"],["AWEIDA","B","2023-03-23"],
["MERCHANT","T","2023-03-23"],["DURNA","P","2023-04-21"],["SHERRING","J","2023-04-21"],
["DEECKE","J","2023-04-21"],["DARBY","K","2023-05-08"],["YOUNG","P","2023-05-08"],
["HOOK","L","2023-05-19"],["JOB","F","2023-05-19"],["WHATHAM","M","2023-06-27"],
["COHOE","S","2023-06-30"],["DE VECCHI","M","2023-06-30"],["HOBBS","S","2023-07-18"],
["JARRATT","T","2023-07-18"],["WENKE","M","2023-07-21"],["BRYCE","J","2023-07-21"],
["DUNSTON","P","2023-07-21"],["COX","H","2023-08-11"],["PAPPIN","T","2023-08-11"],
["WESTERHUIS","B","2023-09-04"],["COAD","I","2023-09-06"],["THONDAN","J","2023-09-06"],
["MCLACHLAN","C","2023-09-06"],["GEARY","D","2023-09-06"],["HUDSON","J","2023-09-27"],
["DAVIS","D","2023-09-27"],["NIELSEN","N","2023-10-09"],["SPEIGHT","B","2023-10-09"],
["FOO","M","2023-10-13"],["NICHOLS","H","2023-11-01"],["BRADY","M","2023-12-01"],
["CORNEY","J","2024-02-21"],["O'LOUGHLIN","S","2024-02-21"],["BRIDGER","C","2024-03-06"],
["TURTON","L","2024-03-20"],["MCCUTCHEON","D","2024-05-13"],["BRITTON","M","2024-05-20"],
["HACKWOOD","M","2024-07-29"],["FERGUSON","G","2024-07-29"],["SIM","N","2024-08-12"],
["COCKLE","D","2024-09-05"],["COLES","M","2024-09-05"],["SHORTELL","N","2024-11-04"],
["REILLY","J","2024-12-02"],["TRAN","V","2024-12-02"],["BEATTIE","J","2024-12-02"],
["MCAULEY","B","2024-12-02"],["BAILEY","S","2025-04-03"],["CARR","C","2025-04-03"],
["CHAN","C","2025-05-22"],["PATHER","K","2025-05-22"],["DO","P","2025-06-26"],
["CLAREY","A","2025-06-26"],["PIGG","D","2025-07-24"],["MCDONALD","N","2025-07-24"],
["DUVOISIN","L","2025-08-22"],["SINGH","A","2025-08-22"],["MICHAEL","J","2025-09-25"],
["SINAC","J","2025-09-25"],["BAYLISS","J","2025-10-03"],["KIRKHAM","M","2025-10-24"],
["CARSTAIRS","B","2025-10-24"],["BOYD","D","2025-11-21"],["COLEMAN","L","2025-11-21"],
// Joined after 1 Jan 2026 → no YOS bracket bump (computeYosTier handles this
// via joiningDate <= PAID_BRACKET_FREEZE_DATE). Added from EFA Pilot List
// valid 1 Jul 2026 (EA cl. 4.8).
["BYLHOUWER","J","2026-01-16"],["WILSHER","P","2026-01-16"],["WELLS","A","2026-02-13"],
["BULLARD","C","2026-02-13"],["WILSON","J","2026-02-13"],["JOSEPH","M","2026-02-13"],
["JONES","T","2026-03-13"],["TIAN","D","2026-03-13"],["JONES","J","2026-04-10"],
["TUCKER","S","2026-04-10"],["CROSBIE","L","2026-05-08"],["VINCENT","N","2026-05-08"],
["NEAH","O","2026-06-05"],["OTHMAN","B","2026-06-05"],
];

// Look up a pilot by surname + first initial. Returns {joiningDate} or null.
function lookupPilot(surname, firstInitial) {
  if (!surname || !firstInitial) return null;
  const sn = surname.toUpperCase().trim();
  const fi = firstInitial.toUpperCase().trim();
  return PILOT_LIST.find(([s, f]) => s === sn && f === fi) || null;
}

// Years-of-service in fractional years anchored on anniversaries. Someone
// who joined 1 May 2023 has done exactly 3.00 years on 1 May 2026, 3.50 on
// approximately 1 Nov 2026 (halfway through the 4th year), and 4.00 on
// 1 May 2027. Whole anniversaries count fully; the fraction is the portion
// of the way to the next anniversary.
function yearsOfServiceAnniversary(joiningDate, asOfDate) {
  if (!joiningDate || !asOfDate) return null;
  const j = parseDate(joiningDate), a = parseDate(asOfDate);
  if (!j || !a) return null;
  if (a < j) return null;
  let whole = a.getUTCFullYear() - j.getUTCFullYear();
  const annivThisYear = new Date(Date.UTC(a.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()));
  if (a < annivThisYear) whole -= 1;
  const lastAnniv = new Date(Date.UTC(j.getUTCFullYear() + whole, j.getUTCMonth(), j.getUTCDate()));
  const nextAnniv = new Date(Date.UTC(j.getUTCFullYear() + whole + 1, j.getUTCMonth(), j.getUTCDate()));
  const cycleMs = nextAnniv.getTime() - lastAnniv.getTime();
  const intoCycleMs = a.getTime() - lastAnniv.getTime();
  const fraction = cycleMs > 0 ? intoCycleMs / cycleMs : 0;
  return whole + fraction;
}

// One-time bracket bump for pilots employed on/before 1 Jan 2026: their paid
// bracket was upgraded by one tier on that date. As they continue gaining
// service, their actual bracket advances naturally — but their paid bracket
// never drops below where the one-time bump originally placed them.
// Effectively: paid = max(actual_now, actual_at_freeze + 1). Pilots employed
// after 1 Jan 2026 didn't get the bump, so paid = actual.
const PAID_BRACKET_FREEZE_DATE = "2026-01-01";

// Bracket tier indices: 0 = <3y, 1 = 3-5y, 2 = 5-7y (CPT) or 5+y (FO),
// 3 = 7+y (CPT only).
function bracketTierFromYears(years, pilotRole) {
  if (years == null || years < 0) return -1;
  if (years >= 7) return 3;
  if (years >= 5) return 2;
  if (years >= 3) return 1;
  return 0;
}

// Compute the paid bracket index for credit-hour pay (and salary lookup).
// Returns the bracket tier (0-3 for CPT, 0-2 for FO since the FO 5+y bracket
// is the top).
//
// Pilots employed on/before 1 Jan 2026 got the one-time bracket bump. The
// bump is applied to ALL views — even when looking at a pre-2026 BP — so the
// displayed bracket always reflects the pilot's bracket-as-of-EBA-start.
// Post-2026 progression: bracket can rise as actual catches up but never
// drops below the bumped freeze bracket.
function computeYosTier(joiningDate, refDate, pilotRole) {
  if (!joiningDate || !refDate) return -1;
  const maxTier = pilotRole === "fo" ? 2 : 3;
  const yearsNow = yearsOfServiceAnniversary(joiningDate, refDate);
  const actNow = bracketTierFromYears(yearsNow, pilotRole);
  if (actNow === -1) return -1;
  const capped = Math.min(actNow, maxTier);
  // Employed on/before 1 Jan 2026 → bump applies for all BPs.
  if (joiningDate <= PAID_BRACKET_FREEZE_DATE) {
    const yearsAtFreeze = yearsOfServiceAnniversary(joiningDate, PAID_BRACKET_FREEZE_DATE);
    const actFreeze = bracketTierFromYears(yearsAtFreeze, pilotRole);
    const bumped = Math.min(actFreeze + 1, maxTier);
    return Math.max(capped, bumped);
  }
  // Joined after freeze: no one-time bump.
  return capped;
}

// Pick the EBA indexation year (INDEX_YEARS index) that applies to a given
// date. Rates step up on each EBA anniversary (1 Jan 2027 / 2028 / 2029),
// derived from the year in each INDEX_YEARS label — the last entry whose
// effective 1-Jan date is on/before `dateStr` wins. "EBA Commencement" (no
// year in its label) is the idx-0 base for anything before the first step.
function ebaYearIdxForDate(dateStr) {
  if (!dateStr) return 0;
  let idx = 0;
  INDEX_YEARS.forEach((y, i) => {
    const m = /(\d{4})/.exec(y.label);
    if (m && dateStr >= `${m[1]}-01-01`) idx = i;
  });
  return idx;
}

// ─── Airports ─────────────────────────────────────────────────────────────────
const AIRPORTS = [
  { code:"SYD", name:"Sydney",      flag:"🇦🇺", tz:"Australia/Sydney",    utcOffset:10 },
  { code:"WSI", name:"Western Sydney",flag:"🇦🇺", tz:"Australia/Sydney",  utcOffset:10 },
  { code:"MEL", name:"Melbourne",   flag:"🇦🇺", tz:"Australia/Melbourne", utcOffset:10 },
  { code:"PER", name:"Perth",       flag:"🇦🇺", tz:"Australia/Perth",     utcOffset:8  },
  { code:"BNE", name:"Brisbane",    flag:"🇦🇺", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"ADL", name:"Adelaide",    flag:"🇦🇺", tz:"Australia/Adelaide",  utcOffset:9.5},
  { code:"HBA", name:"Hobart",      flag:"🇦🇺", tz:"Australia/Hobart",    utcOffset:10 },
  { code:"LST", name:"Launceston",  flag:"🇦🇺", tz:"Australia/Hobart",    utcOffset:10 },
  { code:"CNS", name:"Cairns",      flag:"🇦🇺", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"DRW", name:"Darwin",      flag:"🇦🇺", tz:"Australia/Darwin",    utcOffset:9.5},
  { code:"TSV", name:"Townsville",  flag:"🇦🇺", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"OOL", name:"Gold Coast",  flag:"🇦🇺", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"XCH", name:"Christmas Island",flag:"🇨🇽", tz:"Indian/Christmas", utcOffset:7 },
  { code:"CCK", name:"Cocos (Keeling) Islands",flag:"🇨🇨", tz:"Indian/Cocos", utcOffset:6.5},
  { code:"SIN", name:"Singapore",   flag:"🇸🇬", tz:"Asia/Singapore",      utcOffset:8  },
  { code:"BKK", name:"Bangkok",     flag:"🇹🇭", tz:"Asia/Bangkok",        utcOffset:7  },
  { code:"XSP", name:"Seletar",     flag:"🇸🇬", tz:"Asia/Singapore",      utcOffset:8  },
  { code:"HKG", name:"Hong Kong",   flag:"🇭🇰", tz:"Asia/Hong_Kong",      utcOffset:8  },
  { code:"MFM", name:"Macau",       flag:"🇲🇴", tz:"Asia/Macau",          utcOffset:8  },
  { code:"PVG", name:"Shanghai",    flag:"🇨🇳", tz:"Asia/Shanghai",       utcOffset:8  },
  { code:"NGB", name:"Ningbo",      flag:"🇨🇳", tz:"Asia/Shanghai",       utcOffset:8  },
  { code:"HND", name:"Tokyo Haneda",flag:"🇯🇵", tz:"Asia/Tokyo",          utcOffset:9  },
  { code:"CTS", name:"Sapporo",     flag:"🇯🇵", tz:"Asia/Tokyo",          utcOffset:9  },
  { code:"AKL", name:"Auckland",    flag:"🇳🇿", tz:"Pacific/Auckland",    utcOffset:12 },
  { code:"CHC", name:"Christchurch",flag:"🇳🇿", tz:"Pacific/Auckland",    utcOffset:12 },
  { code:"LHR", name:"London Heathrow",flag:"🇬🇧", tz:"Europe/London",     utcOffset:0  },
  { code:"DRS", name:"Dresden",     flag:"🇩🇪", tz:"Europe/Berlin",       utcOffset:1  },
];
const AIRPORT_ZONE = {
  SYD:"domestic",WSI:"domestic",MEL:"domestic",PER:"domestic",BNE:"domestic",ADL:"domestic",HBA:"domestic",LST:"domestic",
  CNS:"domestic",DRW:"domestic",TSV:"domestic",OOL:"domestic",XCH:"domestic",CCK:"domestic",
  // International — ATO TD2025/4 cost-group membership (per the FY2025-26
  // table; each group has its own per-day meal + incidental total). Per-meal
  // rate is the group's daily meal total divided into 3 equal parts.
  HKG:"group_6", SIN:"group_6", XSP:"group_6",                                    // HK, Singapore
  PVG:"group_5", NGB:"group_5", HND:"group_5", CTS:"group_5",                     // China, Japan
  MFM:"group_5", LHR:"group_5", DRS:"group_5",                                    // Macau, UK, Germany
  AKL:"group_4", CHC:"group_4",                                                   // New Zealand
  BKK:"group_4",                                                                  // Thailand
};
// Transit time (in minutes) between each airport and the crew hotel. Applied to
// shrink the slip-at-hotel window: hotelCheckIn = signOff + transit, and
// hotelCheckOut = signOn - transit. Bases (HKG/MEL/PVG/SYD) get 0 because the
// pilot doesn't slip there; their values are listed for completeness.
const HOTEL_TRANSIT_MIN = {
  ADL: 30, AKL: 45, BNE: 30, CHC: 45, CNS: 14, CTS: 30, DRW: 30, HBA: 30,
  HKG: 0, MEL: 0, MFM: 30, NGB: 30, PER: 30, PVG: 0, SIN: 30, SYD: 0,
  TSV: 30, XSP: 30, DRS: 30, LHR: 30, LST: 30, OOL: 30, WSI: 0, BKK: 30,
};
// From this date onwards (inclusive), the transit-time shift is NOT applied —
// hotel check-in/out match airport sign-off/sign-on exactly.
const TRANSIT_REMOVAL_DATE = "2026-06-30";
// Apply a +/- minute transit shift to a (date, "HH:MM") pair. Handles day
// rollover when the shift crosses midnight (e.g. sign-off 23:55 + 30 min = 00:25
// next day; sign-on 00:15 - 30 min = 23:45 previous day).
function applyTransitShift(dateStr, timeStr, deltaMin) {
  if (!dateStr || !timeStr || !deltaMin) return { date: dateStr, time: timeStr };
  const [h, m] = String(timeStr).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { date: dateStr, time: timeStr };
  let totalMin = h * 60 + m + deltaMin;
  let dayShift = 0;
  while (totalMin < 0)    { totalMin += 1440; dayShift -= 1; }
  while (totalMin >= 1440){ totalMin -= 1440; dayShift += 1; }
  let newDate = dateStr;
  if (dayShift !== 0) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dayShift);
    newDate = d.toISOString().slice(0, 10);
  }
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return { date: newDate, time: `${hh}:${mm}` };
}
const MEAL_RATE_YEARS = [
  // From 1 July 2026: new domestic AU meal + incidental schedule (company-
  // announced). International brackets carry forward as the upper-tier
  // ATO TD2025/4 amounts.
  { label: "From 1 July 2026 - Paid from 15 June", from: "2026-06-15", rates: {
    domestic: {label:"Domestic (AUS)",                       flag:"🇦🇺",color:"var(--green2)",breakfast:43.65, lunch:61.70, dinner:86.35, incidental:36.30},
    group_4:  {label:"Group 4 — NZ etc. ($340/day)",         flag:"🇳🇿",color:"var(--blue)",breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_5:  {label:"Group 5 — CN/JP/MFM/UK/DE etc. ($425/day)",flag:"🌏",color:"var(--pink)",breakfast:121.66,lunch:121.66,dinner:121.68,incidental:60.00},
    group_6:  {label:"Group 6 — HK/SG etc. ($475/day)",      flag:"🇸🇬",color:"var(--purple)",breakfast:138.33,lunch:138.33,dinner:138.34,incidental:60.00},
  }},
  // From 22 Feb 2026: EFA EA 2025 cl. 6.23 references ATO Taxation
  // Determination TD2025/4 Table 3 (FY 2025-26, salary $263,851+ rates,
  // per company schedule effective 20 March 2026). Per-meal rounding rule:
  // breakfast = lunch = nominal/3 rounded DOWN to the cent; dinner =
  // nominal − (breakfast + lunch).
  { label: "2026-2027", from: "2026-02-22", rates: {
    domestic: {label:"Domestic (AUS)",                       flag:"🇦🇺",color:"var(--green2)",breakfast:42.15, lunch:59.60, dinner:83.40, incidental:35.05},
    group_4:  {label:"Group 4 — NZ etc. ($340/day)",         flag:"🇳🇿",color:"var(--blue)",breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_5:  {label:"Group 5 — CN/JP/MFM/UK/DE etc. ($425/day)",flag:"🌏",color:"var(--pink)",breakfast:121.66,lunch:121.66,dinner:121.68,incidental:60.00},
    group_6:  {label:"Group 6 — HK/SG etc. ($475/day)",      flag:"🇸🇬",color:"var(--purple)",breakfast:138.33,lunch:138.33,dinner:138.34,incidental:60.00},
  }},
  // 19 May 2025 – 21 Feb 2026: prior schedule (lower-tier amounts; same
  // B=L rounded-down / D catch-up rule so daily sums are exact).
  { label: "19 May 2025 – 21 Feb 2026", from: "2025-05-19", rates: {
    domestic: {label:"Domestic (AUS)",                       flag:"🇦🇺",color:"var(--green2)",breakfast:37.85, lunch:53.45, dinner:75.00, incidental:35.05},
    group_4:  {label:"Group 4 — NZ etc.",                    flag:"🇳🇿",color:"var(--blue)",breakfast:71.66, lunch:71.66, dinner:71.68, incidental:45.00},
    group_5:  {label:"Group 5 — China/Japan/Macau/UK/Germany",flag:"🌏",color:"var(--pink)",breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_6:  {label:"Group 6 — HK/Singapore etc.",          flag:"🇸🇬",color:"var(--purple)",breakfast:120.00,lunch:120.00,dinner:120.00,incidental:50.00},
  }},
  // Pre-19 May 2025: oldest schedule (fallback for any earlier date).
  { label: "Pre-19 May 2025", from: "2000-01-01", rates: {
    domestic: {label:"Domestic (AUS)",                       flag:"🇦🇺",color:"var(--green2)",breakfast:36.90, lunch:52.10, dinner:73.10, incidental:34.25},
    group_4:  {label:"Group 4 — NZ etc.",                    flag:"🇳🇿",color:"var(--blue)",breakfast:71.66, lunch:71.66, dinner:71.68, incidental:45.00},
    group_5:  {label:"Group 5 — China/Japan/Macau/UK/Germany",flag:"🌏",color:"var(--pink)",breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_6:  {label:"Group 6 — HK/Singapore etc.",          flag:"🇸🇬",color:"var(--purple)",breakfast:120.00,lunch:120.00,dinner:120.00,incidental:50.00},
  }},
];
// Default DESTINATIONS (latest rates) — used for display on Meal Rates page
const DESTINATIONS = MEAL_RATE_YEARS[0].rates;
// Get meal rates for a specific date — entries are walked newest→oldest and the
// first whose `from` date the input is >= wins. Pre-19 May 2025 acts as fallback.
function getDestinations(dateStr) {
  if (!dateStr) return DESTINATIONS;
  for (const yr of MEAL_RATE_YEARS) {
    if (dateStr >= yr.from) return yr.rates;
  }
  return MEAL_RATE_YEARS[MEAL_RATE_YEARS.length - 1].rates;
}
const MEAL_WINDOWS = [
  {id:"b",label:"Breakfast",icon:"🍳",color:"var(--yellow)",wS:7*60+30, wE:9*60+30, key:"breakfast"},
  {id:"l",label:"Lunch",    icon:"🥗",color:"var(--green)",wS:11*60+30,wE:13*60+30,key:"lunch"},
  {id:"d",label:"Dinner",   icon:"🍽️",color:"var(--orange)",wS:17*60+30,wE:19*60+30,key:"dinner"},
];
const DAY_NAMES=["MON","TUE","WED","THU","FRI","SAT","SUN"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Sector colour palette (cycles)
const SECTOR_COLORS=["var(--accent)","var(--green)","var(--pink)","var(--yellow2)","var(--purple)","var(--orange2)","var(--green2)","var(--red2)"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUtcOffsetHours(code, dateStr) {
  const ap=AIRPORTS.find(a=>a.code===code); if(!ap) return 0;
  if(!dateStr) return ap.utcOffset;
  try {
    const d=new Date(dateStr+"T12:00:00Z");
    const fmt=new Intl.DateTimeFormat("en",{timeZone:ap.tz,year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",hour12:false});
    const parts=fmt.formatToParts(d);
    const lY=parseInt(parts.find(p=>p.type==="year")?.value||"0");
    const lMo=parseInt(parts.find(p=>p.type==="month")?.value||"0");
    const lD=parseInt(parts.find(p=>p.type==="day")?.value||"0");
    let lH=parseInt(parts.find(p=>p.type==="hour")?.value||"12");
    const lM=parseInt(parts.find(p=>p.type==="minute")?.value||"0");
    // Chrome's Intl returns hour "24" for midnight instead of "0" of the next day.
    // Build the Date directly from the parts — JS Date.UTC handles hour=24 by rolling over,
    // so we don't need to manually adjust the day.
    // Build a Date for the local wall-clock interpreted as UTC, then diff against the reference 12:00Z
    const localAsUtc=Date.UTC(lY,lMo-1,lD,lH,lM);
    return (localAsUtc - d.getTime())/3600000;
  } catch { return ap.utcOffset; }
}
function utcMins(timeStr, code, dateStr) {
  const m=parseTime(timeStr); if(m==null) return null;
  return m - getUtcOffsetHours(code,dateStr)*60;
}
function calcDutyHours(onLocal,onCode,onDate,offLocal,offCode,offDate) {
  const on=utcMins(onLocal,onCode,onDate), off=utcMins(offLocal,offCode,offDate);
  if(on==null||off==null) return null;
  let d=off-on; if(d<0) d+=1440; return d/60;
}
function parseTime(s) {
  if(!s||!s.includes(":")) return null;
  const [h,m]=s.split(":").map(Number);
  if(isNaN(h)||isNaN(m)) return null;
  return h*60+m;
}
function fmtTime(m) {
  if(m==null) return "—";
  const n=((m%1440)+1440)%1440;
  return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
}
function fmtAUD(n) {
  const v = (n == null || Number.isNaN(n)) ? 0 : Number(n);
  return v.toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function zoneFrom(c) { return AIRPORT_ZONE[c]||"domestic"; }
function apInfo(c) { return AIRPORTS.find(a=>a.code===c)||null; }
// All date helpers use UTC to avoid DST day-slip in +10/+11 timezones like AEST/AEDT
function parseDate(s) { if(!s) return null; const d=new Date(s+"T00:00:00Z"); return isNaN(d)?null:d; }
function isoDate(d) { return d.toISOString().slice(0,10); }
function addDays(s,n) { const d=parseDate(s); if(!d) return ""; d.setUTCDate(d.getUTCDate()+n); return isoDate(d); }
function daysBetween(f,t) { const a=parseDate(f),b=parseDate(t); if(!a||!b) return 0; return Math.max(0,Math.round((b-a)/86400000)); }
function fmtShort(s) { const d=parseDate(s); if(!d) return "—"; return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }
function fmtFull(s)  { const d=parseDate(s); if(!d) return "—"; return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
function getMon(s) {
  const d=parseDate(s); if(!d) return s;
  const dow=d.getUTCDay();            // 0=Sun,1=Mon,…,6=Sat
  const diff=dow===0?-6:1-dow;       // offset to reach Monday
  d.setUTCDate(d.getUTCDate()+diff);
  return isoDate(d);
}
function weekDate(mon,i) { return addDays(mon,i); }
function tzLabel(code,dateStr) {
  if(!code) return "";
  const off=getUtcOffsetHours(code,dateStr);
  return `UTC${off>=0?"+":""}${off}`;
}

// Resolve the calendar date a sector's duty falls on.
// Priority: explicit sectorDate > most recent hotel checkout before this sector > tripDate
function resolveSectorDate(sec, idx, day, tripDate) {
  if (sec.sectorDate) return sec.sectorDate;
  // Find the most recent hotel that comes before this sector
  const hotels = getHotels(day);
  let recentHotel = null;
  for (const h of hotels) {
    if (h.afterSectorIdx < idx && h.hotelTo) {
      if (!recentHotel || h.afterSectorIdx > recentHotel.afterSectorIdx) recentHotel = h;
    }
  }
  if (recentHotel && recentHotel.hotelTo) return recentHotel.hotelTo;
  return tripDate;
}

// Split DHA hours across calendar days when duty crosses midnight in dep airport local time.
// signOnLocal/signOffLocal are HH:MM strings in departure airport local time.
// Returns array of { date, hours } entries.
// Split DHA hours at SYDNEY midnight (not local midnight).
// signOn/signOff are in local port time. depCode/arrCode identify the airports.
// signOnDate is the calendar date of sign-on.
// Returns [{date, hours}, ...] where date is the Sydney-time calendar date.
function splitDhaByMidnight(signOnLocal, signOffLocal, signOnDate, depCode, arrCode) {
  const on = parseTime(signOnLocal), off = parseTime(signOffLocal);
  if (on == null || off == null) return [];
  // Get UTC offsets for dep/arr airports (DST-aware)
  const depOffset = getUtcOffsetHours(depCode || "SYD", signOnDate) * 60;
  const arrOffset = getUtcOffsetHours(arrCode || "SYD", signOnDate) * 60;
  const sydOffset = getUtcOffsetHours("SYD", signOnDate) * 60;
  // Convert sign-on and sign-off to minutes-since-midnight in Sydney time
  // signOn is local dep time → UTC → Sydney
  const onSyd = on - depOffset + sydOffset;
  // signOff is local arr time → UTC → Sydney
  let offSyd = off - arrOffset + sydOffset;
  // Handle sign-off crossing midnight relative to sign-on
  // Total duty in UTC minutes:
  const onUtc = on - depOffset;
  const offUtc = off - arrOffset;
  let totalMins = offUtc - onUtc;
  if (totalMins <= 0) totalMins += 1440;
  // offSyd relative to onSyd
  let offSydAdj = onSyd + totalMins;
  // Normalise onSyd to [0, 1440)
  let onSydNorm = ((onSyd % 1440) + 1440) % 1440;
  let offSydNorm = onSydNorm + totalMins;
  // Sydney date for sign-on: if onSyd < 0 it's the previous day, if >= 1440 it's the next day
  let sydDateShift = 0;
  if (onSyd < 0) sydDateShift = -1;
  else if (onSyd >= 1440) sydDateShift = 1;
  const sydOnDate = sydDateShift !== 0 ? addDays(signOnDate, sydDateShift) : signOnDate;
  // Check if duty crosses Sydney midnight
  if (offSydNorm <= 1440) {
    // All within same Sydney day
    return [{ date: sydOnDate, hours: totalMins / 60 }];
  }
  // Crosses Sydney midnight — split
  const preM = (1440 - onSydNorm) / 60;
  const postM = (offSydNorm - 1440) / 60;
  const nextDate = addDays(sydOnDate, 1);
  const parts = [];
  if (preM > 0) parts.push({ date: sydOnDate, hours: preM });
  if (postM > 0) parts.push({ date: nextDate, hours: postM });
  // Handle multi-day duties (> 24h shouldn't happen for a single sector but safety check)
  return parts;
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function csvEscape(val) {
  const s = String(val ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function cleanForCsv(str) {
  return String(str ?? "")
    .replace(/→/g, " - ")
    .replace(/—/g, " - ")
    .replace(/⬌/g, " - ")
    .replace(/×/g, "x")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E]/g, "")  // strip remaining non-ASCII
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildExportData(dayEntries, role, yearIdx) {
  const trips = [];
  dayEntries.forEach(({ dayName, tripDate, day }) => {
    const byDate = calcAllowancesByDate(day, role, yearIdx, tripDate);
    const allItems = Object.values(byDate).flat();
    if (allItems.length === 0) return;
    const secs = day.sectors;
    const first = secs[0], last = secs[secs.length - 1];
    const route = first?.depAirport && last?.arrAirport ? `${first.depAirport} - ${last.arrAirport}` : "";
    const dates = Object.keys(byDate).sort();
    const dateFrom = dates[0] || tripDate;
    const dateTo = dates[dates.length - 1] || tripDate;
    const tripTotal = allItems.reduce((s, i) => s + i.amount, 0);

    const sectorSummary = secs.map((sec, i) => {
      const sDate = resolveSectorDate(sec, i, day, tripDate);
      const dep = sec.depAirport || "-";
      const arr = sec.arrAirport || "-";
      const flt = sec.flightNo || "";
      const on = sec.aSignOn ? fmtTime(parseTime(sec.aSignOn)) : "-";
      const off = sec.aSignOff ? fmtTime(parseTime(sec.aSignOff)) : "-";
      const dh = calcDutyHours(sec.aSignOn, sec.depAirport, sDate, sec.aSignOff, sec.arrAirport, sDate);
      return { num: i + 1, flt, dep, arr, date: fmtFull(sDate), signOn: on, signOff: off, dutyHrs: dh != null && dh > 0 ? dh.toFixed(2) : "-" };
    }).filter(s => s.signOn !== "-" || s.signOff !== "-");

    const dateItems = [];
    dates.forEach(dt => {
      byDate[dt].forEach(item => {
        dateItems.push({ date: fmtFull(dt), id: item.id, label: cleanForCsv(item.label), clause: item.clause, rate: item.rate, qty: item.qty, amount: item.amount, reason: cleanForCsv(item.reason) });
      });
    });

    trips.push({ dayName, dateFrom: fmtFull(dateFrom), dateTo: fmtFull(dateTo), route, sectorSummary, dateItems, tripTotal });
  });
  return trips;
}

function downloadCsv(filename, dayEntries, role, yearIdx, periodLabel) {
  const trips = buildExportData(dayEntries, role, yearIdx);
  if (trips.length === 0) return;
  const lines = [];
  const row = (...cols) => lines.push(cols.map(c => csvEscape(cleanForCsv(String(c ?? "")))).join(","));

  // Header
  row("EFA DUTY ALLOWANCE REPORT");
  row("Period", periodLabel);
  row("Role", role === "cpt" ? "Captain" : "First Officer");
  row("EBA Year", INDEX_YEARS[yearIdx].label);
  row("Indexation", INDEX_YEARS[yearIdx].mult.toFixed(4));
  row("Generated", new Date().toLocaleString("en-AU"));
  row("");

  let grandTotal = 0;

  trips.forEach((trip, ti) => {
    row("TRIP " + (ti + 1));
    row("Entry Day", trip.dayName);
    row("Date Range", trip.dateFrom === trip.dateTo ? trip.dateFrom : `${trip.dateFrom} - ${trip.dateTo}`);
    row("Route", trip.route);
    row("");

    if (trip.sectorSummary.length > 0) {
      row("Sector", "Flight", "Dep", "Arr", "Date", "Sign-On", "Sign-Off", "Duty (UTC)");
      trip.sectorSummary.forEach(s => {
        row(s.num, s.flt, s.dep, `${s.arr}`, s.date, s.signOn, s.signOff, s.dutyHrs + "h");
      });
      row("");
    }

    // Allowances
    row("Date", "Allowance", "Clause", "Rate (AUD)", "Qty", "Amount (AUD)", "Details");
    trip.dateItems.forEach(item => {
      row(item.date, item.label, item.clause, Number(item.rate).toFixed(2), item.qty, Number(item.amount).toFixed(2), item.reason);
    });
    row("", "", "", "", "Trip Total", Number(trip.tripTotal).toFixed(2), "");
    row("");

    grandTotal += trip.tripTotal;
  });

  // Grand total
  row("");
  row("", "", "", "", "GRAND TOTAL", Number(grandTotal).toFixed(2), "");

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// If sign-off time is earlier than sign-on time (crossed midnight),
// the pilot arrived at the hotel on the NEXT calendar day.
function hotelCheckInDate(tripDate, signOnTime, signOffTime) {
  const on  = parseTime(signOnTime);
  const off = parseTime(signOffTime);
  if (on != null && off != null && off < on) {
    return addDays(tripDate, 1); // overnight — hotel date is next day
  }
  return tripDate; // same day
}

// Meal calc
// Total slip in minutes: from check-in time on hotelFrom to check-out time on hotelTo
function totalSlipMins(ci,co,nights) { if(ci==null||co==null) return 0; if(nights<=0) return Math.max(0,co-ci); return nights*1440-ci+co; }

// Build per-calendar-day meal coverage for the hotel stay.
//
// The stay spans (nights + 1) calendar days:
//   Day 0        = check-in day:     pilot present from ci → 24:00
//   Day 1…nights-1 = intermediate full days: 00:00 → 24:00  (all meals)
//   Day nights   = check-out day:    pilot present from 00:00 → co
//
// A meal window is covered when the pilot's presence on that calendar day
// overlaps the window by MORE than 30 minutes (Cl. 6.24).
//
// Returns array of { dayNum, date, b, l, d, isFullDay }.
function mealsCoveredPerDay(ci, co, nights, hotelFromStr) {
  if(ci==null||co==null) return [];
  if(nights<0) return [];
  const calDays = Math.max(1, nights + 1);   // at least 1 calendar day
  return Array.from({length:calDays},(_,i)=>{
    let presStart, presEnd, isFullDay=false;
    if(i===0 && i===calDays-1) {
      // Single calendar day (same-day check-in and check-out, rare edge case)
      presStart=ci; presEnd=co;
    } else if(i===0) {
      // Check-in day: pilot arrives at ci, stays to midnight
      presStart=ci; presEnd=1440;
    } else if(i===calDays-1) {
      // Check-out day: pilot present from midnight to co
      presStart=0; presEnd=co;
    } else {
      // Full intermediate day: all meals always payable
      presStart=0; presEnd=1440; isFullDay=true;
    }

    const meals={};
    MEAL_WINDOWS.forEach(w=>{
      if(isFullDay) {
        meals[w.id]=true;  // full day → all windows covered by definition
      } else {
        const overlapMins=Math.max(0, Math.min(presEnd,w.wE) - Math.max(presStart,w.wS));
        meals[w.id]=overlapMins>30;  // strictly >30 — exactly-30-min coverage does not pay
      }
    });

    const date=hotelFromStr ? addDays(hotelFromStr,i) : "";
    return {dayNum:i+1, date, isFullDay, presStart, presEnd, ...meals};
  });
}

// ─── Sector factory ───────────────────────────────────────────────────────────
let _sectorId = 0;
function newSector(dep="", arr="") {
  return {
    id: ++_sectorId,
    flightNo:"", depAirport:dep, arrAirport:arr,
    sectorDate:"",          // if different from trip day (multi-day)
    aSignOn:"", aSignOff:"",
    isPositioning:false,    // PAX / positioning flight — 0.5× credit
    missedMeal:false, continueDuty:false, reservePeriod:false,
    hasRosterPublishDiff:false, rosterPublishSignOff:"", rosterPublishSignOffDate:"",
    hasRosterPublishSignOnDiff:false, rosterPublishSignOn:"", rosterPublishSignOnDate:"",
  };
}

// ─── Day factory ─────────────────────────────────────────────────────────────
function emptyDay() {
  return {
    sectors: [newSector(), newSector()],
    hasSlip:false, destination:"domestic",
    // Legacy single-hotel fields kept for backward compatibility
    hotelFrom:"", hotelTo:"",
    hotelCheckIn:"", hotelCheckOut:"",
    hotelAfterSectorIdx:null,
    // New multi-hotel array — preferred when populated
    hotels: [],  // [{ afterSectorIdx, hotelFrom, hotelTo, hotelCheckIn, hotelCheckOut }]
    ddoInfringed:false, accomOptOut:0,
    extraDva:0, extraDdo:0,
  };
}

// Merge two parsed `day` records (same week-key, same day) so multi-BP uploads
// don't lose data when their date ranges overlap on a boundary week. The
// parser keys weeks by Monday's ISO date; BPs that straddle a Mon-Sun boundary
// (e.g. BP3741 ending Sun Apr 19, BP3745 starting Mon Apr 20) both print the
// week-block starting Mon Apr 13. A shallow merge would let the later upload
// silently overwrite OL48/OL13 markers that only appear in one of the BPs.
//
// Strategy:
//   • Prefer whichever side has actual sector data; if both have sectors,
//     prefer the version with more (it's the same trip in both, but parsing
//     might pick up extra context from one printout).
//   • Combine flag fields: OR booleans, MAX numeric counters (extraDdo,
//     accomOptOut). This way a OL48 detected in either BP survives.
function mergeDays(a, b) {
  // Treat null/undefined as empty
  if (!a) return b;
  if (!b) return a;
  const aHasSec = Array.isArray(a.sectors) && a.sectors.some(s => s.flightNo || s.aSignOn || s.isAnnualLeave || s.reservePeriod);
  const bHasSec = Array.isArray(b.sectors) && b.sectors.some(s => s.flightNo || s.aSignOn || s.isAnnualLeave || s.reservePeriod);
  // Pick the "primary" side: whichever actually has duty data
  let base, other;
  if (aHasSec && !bHasSec) { base = a; other = b; }
  else if (bHasSec && !aHasSec) { base = b; other = a; }
  else if (aHasSec && bHasSec) {
    // Both have sectors. Take whichever has the longer/richer sector list,
    // with a tiebreak toward `b` (later upload's view of the same trip).
    base = (b.sectors.length >= a.sectors.length) ? b : a;
    other = (base === a) ? b : a;
  } else {
    base = a; other = b;
  }
  // Combine flags so neither side's OL48/OL13 is lost.
  return {
    ...base,
    hasSlip: !!(a.hasSlip || b.hasSlip),
    extraDva: Math.max(a.extraDva || 0, b.extraDva || 0),
    extraDdo: Math.max(a.extraDdo || 0, b.extraDdo || 0),
    accomOptOut: Math.max(a.accomOptOut || 0, b.accomOptOut || 0),
    ddoInfringed: !!(a.ddoInfringed || b.ddoInfringed),
    ol13Reserve: !!(a.ol13Reserve || b.ol13Reserve),
  };
}

// Merge two weeks objects, day-by-day, using mergeDays for any overlapping
// (week, day) cell.
function mergeWeeks(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([ws, days]) => {
    if (!out[ws]) {
      out[ws] = days;
      return;
    }
    const merged = { ...out[ws] };
    Object.entries(days).forEach(([dn, dayB]) => {
      merged[dn] = mergeDays(out[ws][dn], dayB);
    });
    out[ws] = merged;
  });
  return out;
}

// Migrate legacy single-hotel format into the hotels array.
// Returns a normalised list of hotels for the day.
function getHotels(day) {
  if (Array.isArray(day.hotels) && day.hotels.length > 0) return day.hotels;
  // Fall back to legacy fields
  if (day.hasSlip && day.hotelAfterSectorIdx != null) {
    return [{
      afterSectorIdx: day.hotelAfterSectorIdx,
      hotelFrom: day.hotelFrom || "",
      hotelTo: day.hotelTo || "",
      hotelCheckIn: day.hotelCheckIn || "",
      hotelCheckOut: day.hotelCheckOut || "",
    }];
  }
  return [];
}

// ─── Allowance engine ─────────────────────────────────────────────────────────
function calcAllowances(day, role, yearIdx, tripDate) {
  const mult=INDEX_YEARS[yearIdx].mult;
  const items=[];
  const add=(id,label,clause,color,icon,baseRate,qty,reason)=>{
    const rate=baseRate*mult;
    items.push({id,label,clause,color,icon,rate,qty,amount:rate*qty,reason});
  };

  // ── Reserve Period shortcut ─────────────────────────────────────────────
  // Reserve periods only generate credit hours (4h flat), not DHA. Skip all allowances.
  if (day.sectors[0]?.reservePeriod) {
    return items;
  }

  // ── Per-sector DHA ──────────────────────────────────────────────────────
  // If sectors are linked (continueDuty), calculate DHA as one continuous period.
  // Otherwise calculate per-sector individually.

  // Build duty periods: group consecutive sectors where continueDuty links them
  const dutyPeriods = [];
  let currentPeriod = [day.sectors[0]];
  for (let i = 1; i < day.sectors.length; i++) {
    const sec = day.sectors[i];
    const prevSec = day.sectors[i - 1];
    // Check if hotel sits between prev and current sector
    const hotelBetween = getHotels(day).some(h => h.afterSectorIdx === (i - 1));
    if (!hotelBetween && prevSec.continueDuty) {
      currentPeriod.push(sec);
    } else {
      dutyPeriods.push(currentPeriod);
      currentPeriod = [sec];
    }
  }
  dutyPeriods.push(currentPeriod);

  dutyPeriods.forEach((period, pi) => {
    if (period.length === 1) {
      // Single sector — standard per-sector DHA
      const sec = period[0];
      const idx = day.sectors.indexOf(sec);
      const sDate = resolveSectorDate(sec, idx, day, tripDate);
      const col = SECTOR_COLORS[idx % SECTOR_COLORS.length];
      const label = `Sector ${idx + 1}${sec.flightNo ? ` (${sec.flightNo})` : ""}`;
      const dh = calcDutyHours(sec.aSignOn, sec.depAirport, sDate, sec.aSignOff, sec.arrAirport, sDate);
      if (dh != null && dh > 0) {
        const r = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
        add(`dha_${sec.id}`, `Duty Hour Allowance — ${label}`, "Cl. 6.9", col, "🕐",
          r * dh, 1, `${dh.toFixed(2)}h UTC | ${sec.depAirport} ${tzLabel(sec.depAirport, sDate)} → ${sec.arrAirport} ${tzLabel(sec.arrAirport, sDate)}`);
      }
    } else {
      // Linked sectors — continuous duty from first sign-on to last sign-off
      const firstSec = period[0], lastSec = period[period.length - 1];
      const firstIdx = day.sectors.indexOf(firstSec);
      const lastIdx = day.sectors.indexOf(lastSec);
      const onDate = resolveSectorDate(firstSec, firstIdx, day, tripDate);
      const offDate = resolveSectorDate(lastSec, lastIdx, day, tripDate);
      const col = SECTOR_COLORS[firstIdx % SECTOR_COLORS.length];
      const dh = calcDutyHours(firstSec.aSignOn, firstSec.depAirport, onDate, lastSec.aSignOff, lastSec.arrAirport, offDate);
      if (dh != null && dh > 0) {
        const r = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
        const secNums = period.map(s => { const i = day.sectors.indexOf(s); return `${i + 1}${s.flightNo ? ` (${s.flightNo})` : ""}`; }).join(", ");
        add(`dha_cont_${firstIdx}`, `Duty Hour Allowance — Sectors ${secNums} (continuous)`, "Cl. 6.9", col, "🕐",
          r * dh, 1, `${dh.toFixed(2)}h UTC | ${firstSec.depAirport} ${tzLabel(firstSec.depAirport, onDate)} → ${lastSec.arrAirport} ${tzLabel(lastSec.arrAirport, offDate)} | Sign-on ${fmtTime(parseTime(firstSec.aSignOn))} to sign-off ${fmtTime(parseTime(lastSec.aSignOff))}`);
      }
    }
  });

  // ── Per-sector: missed meal ──────────────────────────────────────────
  day.sectors.forEach((sec, idx) => {
    const label = `Sector ${idx + 1}${sec.flightNo ? ` (${sec.flightNo})` : ""}`;
    if (sec.missedMeal)
      add(`missed_${sec.id}`, `Missed Crew Meal — ${label}`, "Cl. 23.1", "var(--orange2)", "🚫",
        RATES.MISSED_MEAL, 1, `${label} — meal not provided`);
  });

  // ── Roster-publish sign-off comparison (last sector only) ─────────────
  // DVA triggers if actual sign-off is >2h LATER than roster publish.
  // Day Off Payment triggers if actual sign-off is >4h LATER than roster publish.
  const lastSec = day.sectors[day.sectors.length - 1];
  if(lastSec?.hasRosterPublishDiff && lastSec.rosterPublishSignOff) {
    const lastSDate = resolveSectorDate(lastSec, day.sectors.indexOf(lastSec), day, tripDate);
    const rpOff = parseTime(lastSec.rosterPublishSignOff);
    const actOff = parseTime(lastSec.aSignOff);
    if(rpOff != null && actOff != null) {
      const rpDate = lastSec.rosterPublishSignOffDate || lastSDate;
      const actDate = lastSDate;
      const dayDiffMins = daysBetween(rpDate, actDate) * 1440;
      const totalDiff = dayDiffMins + (actOff - rpOff); // positive = later
      if(totalDiff > 120) {
        const r = role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
        const h = Math.floor(totalDiff / 60), m = totalDiff % 60;
        const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        add(`dva_rp_${lastSec.id}`, "Duty Variation — vs Roster Publish", "Cl. 5.28", "var(--amber)", "📝",
          r, 1, `Sign-off ${durStr} later than roster publish (${fmtShort(rpDate)} ${fmtTime(rpOff)} → ${fmtShort(actDate)} ${fmtTime(actOff)}) — >2h buffer`);
      }
      if(totalDiff > 240) {
        const r = role === "cpt" ? RATES.DDO_CPT : RATES.DDO_FO;
        const h = Math.floor(totalDiff / 60), m = totalDiff % 60;
        const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        add(`ddo_rp_${lastSec.id}`, "Day Off Payment — vs Roster Publish", "Cl. 5.20", "var(--red)", "📅",
          r, 1, `Sign-off ${durStr} later than roster publish (${fmtShort(rpDate)} ${fmtTime(rpOff)} → ${fmtShort(actDate)} ${fmtTime(actOff)}) — >4h buffer`);
      }
    }
  }

  // ── Roster-publish sign-on comparison (first sector only) ──────────────
  // DVA triggers if actual sign-on is >2h EARLIER than roster publish.
  const firstSec = day.sectors[0];
  if(firstSec?.hasRosterPublishSignOnDiff && firstSec.rosterPublishSignOn) {
    const firstSDate = tripDate;
    const rpOn = parseTime(firstSec.rosterPublishSignOn);
    const actOn = parseTime(firstSec.aSignOn);
    if(rpOn != null && actOn != null) {
      const rpDate = firstSec.rosterPublishSignOnDate || firstSDate;
      const actDate = firstSDate;
      const dayDiffMins = daysBetween(actDate, rpDate) * 1440; // reversed: how much earlier is actual
      const totalDiff = dayDiffMins + (rpOn - actOn); // positive = actual is earlier
      if(totalDiff > 120) {
        const r = role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
        const h = Math.floor(totalDiff / 60), m = totalDiff % 60;
        const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        add(`dva_rp_on_${firstSec.id}`, "Duty Variation — vs Roster Publish Sign-On", "Cl. 5.28", "var(--amber)", "📝",
          r, 1, `Sign-on ${durStr} earlier than roster publish (${fmtShort(rpDate)} ${fmtTime(rpOn)} → ${fmtShort(actDate)} ${fmtTime(actOn)}) — >2h buffer`);
      }
    }
  }

  // ── DDO ──────────────────────────────────────────────────────────────────
  if(day.ddoInfringed) {
    const r=role==="cpt"?RATES.DDO_CPT:RATES.DDO_FO;
    add("ddo","Designated Day Off – Worked","Cl. 5.20/5.33","var(--red)","📅",r,1,"Duty infringed a rostered DDO");
  }

  // ── DVA (from AS48 in the roster, or manually-set extraDva) ──────────────
  if(day.extraDva > 0) {
    const r=role==="cpt"?RATES.DVA_CPT:RATES.DVA_FO;
    const qty = typeof day.extraDva === "number" ? day.extraDva : 1;
    add("extra_dva",`Duty Variation Allowance${qty>1?` ×${qty}`:""}`,"Cl. 5.28","var(--orange)","⚡",r,qty,`AS48 detected in schedule — ${qty}× DVA`);
  }

  // ── Extra DDO payment (manual) ───────────────────────────────────────────
  if(day.extraDdo > 0) {
    const r=role==="cpt"?RATES.DDO_CPT:RATES.DDO_FO;
    add("extra_ddo",`Day Off Payment (Additional) ×${day.extraDdo}`,"Cl. 5.20","var(--red)","📅",r,day.extraDdo,`${day.extraDdo}× manually added day off payment`);
  }

  // ── Meal allowances — per hotel stay ────────────────────────────────────
  const allHotels = getHotels(day);
  // Track (date, mealId) slots paid by hotels so ground duties later don't
  // double-pay the same meal on the same day.
  const hotelMealKeys = new Set();
  allHotels.forEach((hotel, hi) => {
    if (!hotel.hotelCheckIn || !hotel.hotelCheckOut) return;
    const nightsForMeals = daysBetween(hotel.hotelFrom, hotel.hotelTo);
    const ci = parseTime(hotel.hotelCheckIn), co = parseTime(hotel.hotelCheckOut);
    const hotelSec = day.sectors[hotel.afterSectorIdx ?? 0];
    const zone = hotelSec?.arrAirport ? zoneFrom(hotelSec.arrAirport) : (day.destination || "domestic");
    const dest = (getDestinations(hotel.hotelFrom)[zone]) || getDestinations(hotel.hotelFrom).domestic;
    if (ci == null || co == null) return;
    const tot = totalSlipMins(ci, co, nightsForMeals);
    if (tot <= 4 * 60) return;
    const pd = mealsCoveredPerDay(ci, co, nightsForMeals, hotel.hotelFrom || hotel.hotelTo);
    const mc = {b:0, l:0, d:0};
    pd.forEach(d => {
      if(d.b){ mc.b++; if (d.date) hotelMealKeys.add(`b@${d.date}`); }
      if(d.l){ mc.l++; if (d.date) hotelMealKeys.add(`l@${d.date}`); }
      if(d.d){ mc.d++; if (d.date) hotelMealKeys.add(`d@${d.date}`); }
    });
    const stayDesc = nightsForMeals > 0 ? `${nightsForMeals}-night stay` : `same-day slip (${(tot/60).toFixed(1)}h)`;
    const tag = allHotels.length > 1 ? ` (Hotel ${hi+1})` : "";
    if (mc.b > 0) add(`meal_b_${hi}`, `Breakfast ×${mc.b} — ${dest.label}${tag}`, "Cl. 6.24(a)", "var(--yellow)", "🍳", dest.breakfast, mc.b, `${dest.flag} ${mc.b}× — ${stayDesc} (0730–0930)`);
    if (mc.l > 0) add(`meal_l_${hi}`, `Lunch ×${mc.l} — ${dest.label}${tag}`, "Cl. 6.24(b)", "var(--green)", "🥗", dest.lunch, mc.l, `${dest.flag} ${mc.l}× — ${stayDesc} (1130–1330)`);
    if (mc.d > 0) add(`meal_d_${hi}`, `Dinner ×${mc.d} — ${dest.label}${tag}`, "Cl. 6.24(c)", "var(--orange)", "🍽️", dest.dinner, mc.d, `${dest.flag} ${mc.d}× — ${stayDesc} (1730–1930)`);
    // (Per-hotel incidentals removed — see trip-level calc after ground meals.)
  });

  // ── Ground-duty meals ──
  // Pay B/L/D for ground duties (CC, CCR, EF*, IE*, PD/PDD, SIM, SLFB, NTS,
  // GS, ATP and pattern-block ground sectors) when the duty's sign-on→sign-off
  // covers the meal window by more than 30 min. Excluded codes: MD, V*,
  // AX, LJ, LA, CLRD, LZR, LZ, LW. Dedups against any hotel meal already paid
  // on the same (date, window) — e.g. a hotel breakfast won't be re-paid by an
  // overlapping morning ground school.
  const GROUND_MEAL_EXCLUDE = /^(MD|V\d|AX|LJ|LA|CLRD|LZR|LZ|LW)\b/i;
  const MEAL_WINDOW_LABELS = {
    b: { label: "Breakfast", clause: "Cl. 6.24(a)", color: "var(--yellow)", icon: "🍳", win: "(0730–0930)" },
    l: { label: "Lunch",     clause: "Cl. 6.24(b)", color: "var(--green)", icon: "🥗", win: "(1130–1330)" },
    d: { label: "Dinner",    clause: "Cl. 6.24(c)", color: "var(--orange)", icon: "🍽️", win: "(1730–1930)" },
  };
  // Determine the trip's base port from the first sector with a depAirport.
  // Ground duties at base don't earn meal allowances.
  const baseSecA = day.sectors.find(s => s.depAirport);
  const tripBaseA = baseSecA?.depAirport;
  day.sectors.forEach((sec, idx) => {
    if (!sec.isGroundDuty) return;
    if (sec.aSignOn == null || sec.aSignOff == null) return;
    const code = (sec.flightNo || "").trim();
    if (GROUND_MEAL_EXCLUDE.test(code)) return;
    // Skip ground duties conducted at home base — sims/ground schools at
    // the pilot's own base don't earn meal allowances.
    if (tripBaseA && sec.depAirport === tripBaseA) return;
    const sDate = sec.sectorDate;
    // Convert "HH:MM" strings to minutes-from-midnight (parseTime handles this).
    const onMin = parseTime(sec.aSignOn);
    let offMin = parseTime(sec.aSignOff);
    if (onMin == null || offMin == null) return;
    if (offMin <= onMin) offMin = 1440;
    const port = sec.depAirport || sec.arrAirport;
    const zone = port ? zoneFrom(port) : "domestic";
    const dest = (getDestinations(sDate)[zone]) || getDestinations(sDate).domestic;
    MEAL_WINDOWS.forEach(w => {
      const overlap = Math.max(0, Math.min(offMin, w.wE) - Math.max(onMin, w.wS));
      // Strictly >30 min: a sim signing on at 09:00 covers exactly 30 min of
      // breakfast (07:30-09:30) and does NOT earn breakfast.
      if (overlap <= 30) return;
      // Dedup against hotel meals (need a date to compare); if no sectorDate
      // we can't dedup precisely so skip the check (rare for parsed rosters).
      if (sDate && hotelMealKeys.has(`${w.id}@${sDate}`)) return;
      const rate = dest[w.key];
      if (rate == null) return;
      const lbl = MEAL_WINDOW_LABELS[w.id];
      const dateLabel = sDate ? fmtShort(sDate) : "";
      add(
        `meal_${w.id}_g${idx}`,
        `${lbl.label} — ${dest.label} (${code} ground duty)`,
        lbl.clause, lbl.color, lbl.icon,
        rate, 1,
        `${dest.flag} ${dateLabel} ${lbl.win} — ${code}`.trim()
      );
      if (sDate) hotelMealKeys.add(`${w.id}@${sDate}`);
    });
  });

  // ── Per-port incidentals ──
  // Sum total time spent at each non-base port across all hotels at that port.
  // Pay 1 incidental per 24h at that port's zone rate (so a 4-day MEL course
  // earns domestic incidentals, while a multi-port trip pays each port at
  // its own zone rate). See bulk app and calcAllowancesByDate for rationale.
  {
    const portTotals = {};
    allHotels.forEach((hotel) => {
      if (!hotel.hotelCheckIn || !hotel.hotelCheckOut) return;
      const ci = parseTime(hotel.hotelCheckIn), co = parseTime(hotel.hotelCheckOut);
      if (ci == null || co == null) return;
      const nights = daysBetween(hotel.hotelFrom, hotel.hotelTo);
      // Incidentals accumulate on the RAW slip (sign-off → sign-on), not the
      // transit-shrunk hotel window. Add back 2× transit so the 24h threshold
      // is measured airport-to-airport. One incidental per 24h.
      const tot = totalSlipMins(ci, co, nights) + 2 * (hotel.transitApplied || 0);
      if (tot <= 0) return;
      const hotelSec = day.sectors[hotel.afterSectorIdx ?? 0];
      const port = hotelSec?.arrAirport || day.destination || "";
      if (!port) return;
      const zone = zoneFrom(port) || "domestic";
      if (!portTotals[port]) {
        portTotals[port] = { totalMin: 0, firstDate: hotel.hotelFrom || hotel.hotelTo, zone };
      }
      portTotals[port].totalMin += tot;
      if (hotel.hotelFrom && hotel.hotelFrom < portTotals[port].firstDate) {
        portTotals[port].firstDate = hotel.hotelFrom;
      }
    });
    let pIdx = 0;
    Object.entries(portTotals).forEach(([port, info]) => {
      if (info.totalMin < 24 * 60) return;
      const incQty = Math.floor(info.totalMin / (24 * 60));
      const dest = (getDestinations(info.firstDate)[info.zone]) || getDestinations(info.firstDate).domestic;
      const totalH = (info.totalMin / 60).toFixed(1);
      add(
        `meal_i_${port}_${pIdx++}`,
        `Incidental ×${incQty} — ${dest.label} (${port})`,
        "Cl. 6.24", "var(--amber)", "☕",
        dest.incidental, incQty,
        `${dest.flag} ${incQty}× incidental — ${totalH}h raw slip at ${port} (1 per 24h)`
      );
    });
  }

  // ── Accom opt-out ─────────────────────────────────────────────────────────
  if(day.accomOptOut > 0) {
    const n = day.accomOptOut;
    add("accom","Accommodation Opt-Out","Cl. 6.32","var(--indigo)","🏨",RATES.ACCOM_OPTOUT,n,`${n} night(s) — 48h notice given`);
  }

  return items;
}

// ─── Per-date allowance splitter ──────────────────────────────────────────────
// Takes a day's data and returns { [dateStr]: [items] } where each allowance
// is assigned to the calendar date it actually falls on.
// Non-meal items stay on their sector date; meal items are split per-calendar-day.
function calcAllowancesByDate(day, role, yearIdx, tripDate) {
  const mult = INDEX_YEARS[yearIdx].mult;
  const byDate = {};
  const addTo = (date, item) => {
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  };
  const mkItem = (id,label,clause,color,icon,baseRate,qty,reason) => {
    const rate = baseRate * mult;
    return { id, label, clause, color, icon, rate, qty, amount: rate * qty, reason };
  };

  // ── Reserve Period shortcut ──
  // Reserve periods only generate credit hours (4h flat), not DHA. Skip all allowances.
  if (day.sectors[0]?.reservePeriod) {
    return byDate;
  }

  // ── DHA: per-sector or continuous duty periods ──
  const dutyPeriodsB = [];
  let currentPeriodB = [day.sectors[0]];
  for (let i = 1; i < day.sectors.length; i++) {
    const sec = day.sectors[i];
    const prevSec = day.sectors[i - 1];
    const hotelBetween = getHotels(day).some(h => h.afterSectorIdx === (i - 1));
    if (!hotelBetween && prevSec.continueDuty) {
      currentPeriodB.push(sec);
    } else {
      dutyPeriodsB.push(currentPeriodB);
      currentPeriodB = [sec];
    }
  }
  dutyPeriodsB.push(currentPeriodB);

  dutyPeriodsB.forEach((period, pi) => {
    if (period.length === 1) {
      const sec = period[0];
      const idx = day.sectors.indexOf(sec);
      const sDate = resolveSectorDate(sec, idx, day, tripDate);
      const col = SECTOR_COLORS[idx % SECTOR_COLORS.length];
      const label = `Sector ${idx + 1}${sec.flightNo ? ` (${sec.flightNo})` : ""}`;
      const dh = calcDutyHours(sec.aSignOn, sec.depAirport, sDate, sec.aSignOff, sec.arrAirport, sDate);
      if (dh != null && dh > 0) {
        const r = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
        // Attribute the whole duty to sectorDate. Cross-BP boundary shifts
        // are handled downstream by the Month/Roster totalizer applying the
        // roster header's Carried In/Out values.
        addTo(sDate, mkItem(`dha_${sec.id}`, `Duty Hour Allowance — ${label}`, "Cl. 6.9", col, "🕐",
          r * dh, 1, `${dh.toFixed(2)}h UTC | ${sec.depAirport} ${tzLabel(sec.depAirport, sDate)} → ${sec.arrAirport} ${tzLabel(sec.arrAirport, sDate)}`));
      }
    } else {
      const firstSec = period[0], lastSec = period[period.length - 1];
      const firstIdx = day.sectors.indexOf(firstSec);
      const lastIdx = day.sectors.indexOf(lastSec);
      const onDate = resolveSectorDate(firstSec, firstIdx, day, tripDate);
      const offDate = resolveSectorDate(lastSec, lastIdx, day, tripDate);
      const col = SECTOR_COLORS[firstIdx % SECTOR_COLORS.length];
      const dh = calcDutyHours(firstSec.aSignOn, firstSec.depAirport, onDate, lastSec.aSignOff, lastSec.arrAirport, offDate);
      if (dh != null && dh > 0) {
        const r = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
        const secNums = period.map(s => { const i = day.sectors.indexOf(s); return `${i + 1}${s.flightNo ? ` (${s.flightNo})` : ""}`; }).join(", ");
        // Attribute the whole continuous duty to the first sector's date; see
        // note above.
        addTo(onDate, mkItem(`dha_cont_${firstIdx}`, `Duty Hour Allowance — Sectors ${secNums} (continuous)`, "Cl. 6.9", col, "🕐",
          r * dh, 1, `${dh.toFixed(2)}h UTC | ${firstSec.depAirport} ${tzLabel(firstSec.depAirport, onDate)} → ${lastSec.arrAirport} ${tzLabel(lastSec.arrAirport, offDate)} | Sign-on ${fmtTime(parseTime(firstSec.aSignOn))} to sign-off ${fmtTime(parseTime(lastSec.aSignOff))}`));
      }
    }
  });

  // ── Per-sector: missed meal ──
  day.sectors.forEach((sec, idx) => {
    const sDate = resolveSectorDate(sec, idx, day, tripDate);
    const label = `Sector ${idx+1}${sec.flightNo ? ` (${sec.flightNo})` : ""}`;
    if (sec.missedMeal)
      addTo(sDate, mkItem(`missed_${sec.id}`, `Missed Crew Meal — ${label}`, "Cl. 23.1", "var(--orange2)", "🚫",
        RATES.MISSED_MEAL, 1, `${label} — meal not provided`));
  });

  // ── Roster-publish sign-off comparison (last sector only) ──
  // DVA if >2h LATER, Day Off Payment if >4h LATER
  const lastSec = day.sectors[day.sectors.length - 1];
  if (lastSec?.hasRosterPublishDiff && lastSec.rosterPublishSignOff) {
    const lastSDate = resolveSectorDate(lastSec, day.sectors.indexOf(lastSec), day, tripDate);
    const rpOff = parseTime(lastSec.rosterPublishSignOff);
    const actOff = parseTime(lastSec.aSignOff);
    if (rpOff != null && actOff != null) {
      const rpDate = lastSec.rosterPublishSignOffDate || lastSDate;
      const actDate = lastSDate;
      const dayDiffMins = daysBetween(rpDate, actDate) * 1440;
      const totalDiff = dayDiffMins + (actOff - rpOff); // positive = later
      if (totalDiff > 120) {
        const r = role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
        const h = Math.floor(totalDiff / 60), m = totalDiff % 60;
        const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        addTo(lastSDate, mkItem(`dva_rp_${lastSec.id}`, "Duty Variation — vs Roster Publish", "Cl. 5.28", "var(--amber)", "📝",
          r, 1, `Sign-off ${durStr} later than roster publish (${fmtShort(rpDate)} ${fmtTime(rpOff)} → ${fmtShort(actDate)} ${fmtTime(actOff)}) — >2h buffer`));
      }
      if (totalDiff > 240) {
        const r = role === "cpt" ? RATES.DDO_CPT : RATES.DDO_FO;
        const h = Math.floor(totalDiff / 60), m = totalDiff % 60;
        const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        addTo(lastSDate, mkItem(`ddo_rp_${lastSec.id}`, "Day Off Payment — vs Roster Publish", "Cl. 5.20", "var(--red)", "📅",
          r, 1, `Sign-off ${durStr} later than roster publish (${fmtShort(rpDate)} ${fmtTime(rpOff)} → ${fmtShort(actDate)} ${fmtTime(actOff)}) — >4h buffer`));
      }
    }
  }

  // ── Roster-publish sign-on comparison (first sector only) ──
  // DVA if >2h EARLIER
  const firstSec = day.sectors[0];
  if (firstSec?.hasRosterPublishSignOnDiff && firstSec.rosterPublishSignOn) {
    const rpOn = parseTime(firstSec.rosterPublishSignOn);
    const actOn = parseTime(firstSec.aSignOn);
    if (rpOn != null && actOn != null) {
      const rpDate = firstSec.rosterPublishSignOnDate || tripDate;
      const actDate = tripDate;
      const dayDiffMins = daysBetween(actDate, rpDate) * 1440;
      const totalDiff = dayDiffMins + (rpOn - actOn); // positive = actual is earlier
      if (totalDiff > 120) {
        const r = role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
        const h = Math.floor(totalDiff / 60), m = totalDiff % 60;
        const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        addTo(tripDate, mkItem(`dva_rp_on_${firstSec.id}`, "Duty Variation — vs Roster Publish Sign-On", "Cl. 5.28", "var(--amber)", "📝",
          r, 1, `Sign-on ${durStr} earlier than roster publish (${fmtShort(rpDate)} ${fmtTime(rpOn)} → ${fmtShort(actDate)} ${fmtTime(actOn)}) — >2h buffer`));
      }
    }
  }

  // ── DDO — on tripDate ──
  if (day.ddoInfringed) {
    const r = role === "cpt" ? RATES.DDO_CPT : RATES.DDO_FO;
    addTo(tripDate, mkItem("ddo", "Designated Day Off – Worked", "Cl. 5.20/5.33", "var(--red)", "📅", r, 1, "Duty infringed a rostered DDO"));
  }
  if (day.extraDva > 0) {
    const r = role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
    const qty = typeof day.extraDva === "number" ? day.extraDva : 1;
    addTo(tripDate, mkItem("extra_dva", `Duty Variation Allowance${qty>1?` ×${qty}`:""}`, "Cl. 5.28", "var(--orange)", "⚡", r, qty, `AS48 detected in schedule — ${qty}× DVA`));
  }
  if (day.extraDdo > 0) {
    const r = role === "cpt" ? RATES.DDO_CPT : RATES.DDO_FO;
    addTo(tripDate, mkItem("extra_ddo", `Day Off Payment (Additional) x${day.extraDdo}`, "Cl. 5.20", "var(--red)", "📅", r, day.extraDdo, `${day.extraDdo}x manually added day off payment`));
  }

  // ── Meals — per hotel stay, split per calendar day ──
  const allHotelsB = getHotels(day);
  // Track (date, mealId) slots paid by hotels so ground duties below don't
  // double-pay the same meal (mirrors bulk app).
  const hotelMealKeys = new Set();
  allHotelsB.forEach((hotel, hi) => {
    if (!hotel.hotelCheckIn || !hotel.hotelCheckOut) return;
    const nightsForMeals = daysBetween(hotel.hotelFrom, hotel.hotelTo);
    const ci = parseTime(hotel.hotelCheckIn), co = parseTime(hotel.hotelCheckOut);
    const hotelSec = day.sectors[hotel.afterSectorIdx ?? 0];
    const zone = hotelSec?.arrAirport ? zoneFrom(hotelSec.arrAirport) : (day.destination || "domestic");
    const dest = (getDestinations(hotel.hotelFrom)[zone]) || getDestinations(hotel.hotelFrom).domestic;
    if (ci == null || co == null) return;
    const tot = totalSlipMins(ci, co, nightsForMeals);
    if (tot <= 4 * 60) return;
    const pd = mealsCoveredPerDay(ci, co, nightsForMeals, hotel.hotelFrom || hotel.hotelTo);
    const tag = allHotelsB.length > 1 ? ` (Hotel ${hi+1})` : "";
    if (pd.length) {
      pd.forEach(pdDay => {
        const mealDate = pdDay.date;
        if (!mealDate) return;
        if (pdDay.b) { addTo(mealDate, mkItem(`meal_b_${hi}_${mealDate}`, `Breakfast — ${dest.label}${tag}`, "Cl. 6.24(a)", "var(--yellow)", "🍳", dest.breakfast, 1, `${dest.flag} ${fmtShort(mealDate)} (0730–0930)`)); hotelMealKeys.add(`b@${mealDate}`); }
        if (pdDay.l) { addTo(mealDate, mkItem(`meal_l_${hi}_${mealDate}`, `Lunch — ${dest.label}${tag}`,     "Cl. 6.24(b)", "var(--green)", "🥗", dest.lunch,     1, `${dest.flag} ${fmtShort(mealDate)} (1130–1330)`)); hotelMealKeys.add(`l@${mealDate}`); }
        if (pdDay.d) { addTo(mealDate, mkItem(`meal_d_${hi}_${mealDate}`, `Dinner — ${dest.label}${tag}`,    "Cl. 6.24(c)", "var(--orange)", "🍽️", dest.dinner,    1, `${dest.flag} ${fmtShort(mealDate)} (1730–1930)`)); hotelMealKeys.add(`d@${mealDate}`); }
      });
    }
    // (Per-hotel incidentals removed — trip-level calc below pays them based
    //  on total away-from-base time rather than individual hotel slip lengths.)
  });

  // ── Ground-duty meals ──
  // Pay B/L/D when the duty's sign-on→sign-off window overlaps the meal window
  // by more than 30 min. Excludes admin/leave/standby codes (see regex).
  // Included codes (CC/CCR, EF*, IE*, PD/PDD, SIM, SLFB, NTS, GS, ATP) are
  // tagged isGroundDuty by the parser. Dedups against hotel meals on the same
  // (date, window) so a hotel breakfast isn't re-paid by a morning ground school.
  const GROUND_MEAL_EXCLUDE = /^(MD|V\d|AX|LJ|LA|CLRD|LZR|LZ|LW)\b/i;
  const MEAL_WINDOW_LABELS = {
    b: { label: "Breakfast", clause: "Cl. 6.24(a)", color: "var(--yellow)", icon: "🍳", win: "(0730–0930)" },
    l: { label: "Lunch",     clause: "Cl. 6.24(b)", color: "var(--green)", icon: "🥗", win: "(1130–1330)" },
    d: { label: "Dinner",    clause: "Cl. 6.24(c)", color: "var(--orange)", icon: "🍽️", win: "(1730–1930)" },
  };
  // Determine the trip's base port from the first sector with a depAirport.
  // Ground duties at base don't earn meal allowances.
  const baseSecC = day.sectors.find(s => s.depAirport);
  const tripBaseC = baseSecC?.depAirport;
  day.sectors.forEach((sec, idx) => {
    if (!sec.isGroundDuty) return;
    if (sec.aSignOn == null || sec.aSignOff == null) return;
    const code = (sec.flightNo || "").trim();
    if (GROUND_MEAL_EXCLUDE.test(code)) return;
    // Skip ground duties conducted at home base — sims/ground schools at the
    // pilot's own base don't earn meal allowances.
    if (tripBaseC && sec.depAirport === tripBaseC) return;
    const sDate = resolveSectorDate(sec, idx, day, tripDate);
    if (!sDate) return;
    // Convert "HH:MM" strings to minutes-from-midnight (parseTime handles this).
    const onMin = parseTime(sec.aSignOn);
    let offMin = parseTime(sec.aSignOff);
    if (onMin == null || offMin == null) return;
    if (offMin <= onMin) offMin = 1440;
    const port = sec.depAirport || sec.arrAirport;
    const zone = port ? zoneFrom(port) : "domestic";
    const dest = (getDestinations(sDate)[zone]) || getDestinations(sDate).domestic;
    MEAL_WINDOWS.forEach(w => {
      const overlap = Math.max(0, Math.min(offMin, w.wE) - Math.max(onMin, w.wS));
      // Strictly >30 min: a sim signing on at 09:00 covers exactly 30 min of
      // breakfast (07:30-09:30) and does NOT earn breakfast.
      if (overlap <= 30) return;
      if (hotelMealKeys.has(`${w.id}@${sDate}`)) return;
      const rate = dest[w.key];
      if (rate == null) return;
      const lbl = MEAL_WINDOW_LABELS[w.id];
      addTo(sDate, mkItem(
        `meal_${w.id}_g${idx}_${sDate}`,
        `${lbl.label} — ${dest.label} (${code} ground duty)`,
        lbl.clause, lbl.color, lbl.icon,
        rate, 1,
        `${dest.flag} ${fmtShort(sDate)} ${lbl.win} — ${code}`
      ));
      hotelMealKeys.add(`${w.id}@${sDate}`);
    });
  });

  // ── Per-port incidentals ──
  // Sum total time spent at each non-base port across all hotels at that port.
  // Pay 1 incidental per 24h at that port's zone rate. Examples:
  //  • 4-day MEL course (3×16h hotels = 48h): 2 domestic incidentals.
  //  • Multi-leg trip PER (33h) + HKG (47h): 1 PER domestic incidental + 1
  //    HKG incidental, NOT 2 incidentals at the first port's rate.
  // This replaces (a) the older per-hotel-slip approach (only paid when a
  // single hotel exceeded 24h, missing multi-night chains) and (b) the
  // trip-level span approach (used one rate for the whole trip even when the
  // pilot visited multiple zones).
  {
    const portTotals = {};
    allHotelsB.forEach((hotel) => {
      if (!hotel.hotelCheckIn || !hotel.hotelCheckOut) return;
      const ci = parseTime(hotel.hotelCheckIn), co = parseTime(hotel.hotelCheckOut);
      if (ci == null || co == null) return;
      const nights = daysBetween(hotel.hotelFrom, hotel.hotelTo);
      // Incidentals accumulate on the RAW slip (sign-off → sign-on), not the
      // transit-shrunk hotel window. Add back 2× transit so the 24h threshold
      // is measured airport-to-airport. One incidental per 24h.
      const tot = totalSlipMins(ci, co, nights) + 2 * (hotel.transitApplied || 0);
      if (tot <= 0) return;
      const hotelSec = day.sectors[hotel.afterSectorIdx ?? 0];
      const port = hotelSec?.arrAirport || day.destination || "";
      if (!port) return;
      const zone = zoneFrom(port) || "domestic";
      if (!portTotals[port]) {
        portTotals[port] = { totalMin: 0, firstDate: hotel.hotelFrom || hotel.hotelTo, zone };
      }
      portTotals[port].totalMin += tot;
      if (hotel.hotelFrom && hotel.hotelFrom < portTotals[port].firstDate) {
        portTotals[port].firstDate = hotel.hotelFrom;
      }
    });
    let incIdx = 0;
    Object.entries(portTotals).forEach(([port, info]) => {
      if (info.totalMin < 24 * 60) return;
      const incQty = Math.floor(info.totalMin / (24 * 60));
      const dest = (getDestinations(info.firstDate)[info.zone]) || getDestinations(info.firstDate).domestic;
      const totalH = (info.totalMin / 60).toFixed(1);
      for (let n = 0; n < incQty; n++) {
        const incDate = addDays(info.firstDate, n + 1);
        addTo(incDate, mkItem(
          `meal_i_${port}_${n}_${incIdx++}`,
          `Incidental — ${dest.label} (${port})`,
          "Cl. 6.24", "var(--amber)", "☕",
          dest.incidental, 1,
          `${dest.flag} ${fmtShort(incDate)} — ${totalH}h raw slip at ${port} (1 per 24h)`
        ));
      }
    });
  }

  // ── Accom opt-out — on tripDate ──
  if (day.accomOptOut > 0) {
    const n = day.accomOptOut;
    addTo(tripDate, mkItem("accom", "Accommodation Opt-Out", "Cl. 6.32", "var(--indigo)", "🏨", RATES.ACCOM_OPTOUT, n, `${n} night(s) — 48h notice given`));
  }

  return byDate;
}

// ─── UI components ────────────────────────────────────────────────────────────
const mono="'IBM Plex Mono',monospace";
// Tint a theme colour to a transparent wash. Replaces the old "${c}40" hex-alpha
// concatenation, which cannot work now that colours are CSS custom properties.
const mix=(c,pct)=>`color-mix(in srgb, ${c} ${pct}%, transparent)`;
// Narrower face for the big page headings (day-of-week, "Meal Allowance
// Schedule", "Week Summary", BP number) — the default Syne face renders wide.
const heading="'Archivo Narrow',sans-serif";

function Lbl({t,hi,color,extra}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
      <span style={{fontSize:10,letterSpacing:1,color:hi?"var(--accent)":color||"var(--ink2)",fontFamily:mono}}>{t}</span>
      {extra&&<span style={{fontSize:9,color:"var(--muted)",fontFamily:mono,background:"var(--line)",borderRadius:3,padding:"1px 4px"}}>{extra}</span>}
    </div>
  );
}

function TInput({label,value,onChange,hi,color,tzLbl}) {
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <Lbl t={label} hi={hi} color={color} extra={tzLbl}/>
      <input type="time" value={value} onChange={e=>onChange(e.target.value)} style={{
        background:"var(--bg)", border:`1px solid ${hi?"var(--accentLine)":color?"var(--sage)":"var(--line)"}`,
        borderRadius:6, color:value?"var(--ink)":"var(--muted)", padding:"5px 8px",
        fontFamily:mono, fontSize:15, width:"100%", maxWidth:120, minWidth:90,
      }}/>
    </div>
  );
}

function DInput({label,value,onChange,hi}) {
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <Lbl t={label} hi={hi}/>
      <input type="date" value={value} onChange={e=>onChange(e.target.value)} style={{
        background:"var(--bg)", border:`1px solid ${hi?"var(--accentLine)":"var(--line)"}`,
        borderRadius:6, color:value?"var(--ink)":"var(--muted)", padding:"5px 8px",
        fontFamily:mono, fontSize:14, width:"100%", maxWidth:160, minWidth:120, colorScheme:"inherit",
      }}/>
    </div>
  );
}

function ASelect({label,value,onChange,hi,color,dateStr}) {
  const ap=apInfo(value);
  const tz=ap?tzLabel(value,dateStr):"";
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <Lbl t={label} hi={hi} color={color} extra={tz||undefined}/>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        background:"var(--bg)", border:`1px solid ${hi||color?"var(--accentLine)":"var(--line)"}`,
        borderRadius:6, color:value?"var(--ink)":"var(--muted)", padding:"5px 8px",
        fontFamily:mono, fontSize:14, cursor:"pointer", width:"100%", maxWidth:180, minWidth:120, appearance:"none",
      }}>
        <option value="">Select airport</option>
        {AIRPORTS.map(a=><option key={a.code} value={a.code}>{a.flag} {a.code} — {a.name}</option>)}
      </select>
    </div>
  );
}

function Toggle({label,checked,onChange,color="var(--accent)"}) {
  return (
    <div onClick={()=>onChange(!checked)} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",userSelect:"none"}}>
      <div style={{width:32,height:18,borderRadius:9,background:checked?color:"var(--line)",border:`1px solid ${checked?color:"var(--muted)"}`,position:"relative",transition:"all 0.2s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:checked?14:2,width:12,height:12,borderRadius:"50%",background:checked?"#fff":"var(--ink2)",transition:"left 0.2s"}}/>
      </div>
      <span style={{fontSize:12,color:checked?"var(--muted)":"var(--ink2)"}}>{label}</span>
    </div>
  );
}

function Card({children,border,style={}}) {
  return <div className="ui-card" style={{background:"var(--panel)",border:`1px solid ${border||"var(--line)"}`,borderRadius:14,padding:"14px 18px",...style}}>{children}</div>;
}
function ICard({children,border,style={}}) {
  return <div className="ui-icard" style={{background:"var(--bg)",border:`1px solid ${border||"var(--line)"}`,borderRadius:10,padding:12,...style}}>{children}</div>;
}
function SHead({children}) {
  return <div style={{fontSize:11,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:12}}>{children}</div>;
}

// ─── Pay Check widgets ────────────────────────────────────────────────────────
function MInput({label,value,onChange,width=120}) {
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <Lbl t={label}/>
      <input type="text" inputMode="decimal" value={value} placeholder="0.00"
        onChange={e=>onChange(e.target.value)} style={{
        background:"var(--bg)", border:"1px solid var(--line)", borderRadius:6,
        color:value?"var(--ink)":"var(--muted)", padding:"5px 8px",
        fontFamily:mono, fontSize:14, width:"100%", maxWidth:width, minWidth:90,
      }}/>
    </div>
  );
}

// Reads out one payslip line against the calculator's own figure.
function Delta({paid,calc,off}) {
  if (paid == null) return <span style={{fontSize:11,color:"var(--faint)",fontFamily:mono}}>enter an amount</span>;
  const d = paid - calc;
  return (
    <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:"var(--muted)",fontFamily:mono}}>calc ${fmtAUD(calc)}</span>
      <span style={{fontSize:12,fontWeight:700,fontFamily:mono,color:off?"var(--red)":"var(--green2)"}}>
        {off ? `${d>0?"+":"−"}$${fmtAUD(Math.abs(d))}` : "✓ match"}
      </span>
    </div>
  );
}

function PayRowShell({children,onRemove}) {
  return (
    <ICard style={{marginBottom:8}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
        {children}
        <button onClick={onRemove} title="Remove line" style={{
          background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--red)",
          fontSize:11,cursor:"pointer",padding:"4px 9px",fontFamily:mono,marginLeft:"auto"}}>Remove</button>
      </div>
    </ICard>
  );
}

// ─── SectorCard component ─────────────────────────────────────────────────────
function SectorCard({ sec, idx, sectorDate, tripDate, onUpdate, onRemove, onAddHotelAfter, hasHotelAfter, showHotelBtn, totalSectors, isLastSector, isFirstSector }) {
  const col = SECTOR_COLORS[idx % SECTOR_COLORS.length];
  const dh = calcDutyHours(
    sec.aSignOn, sec.depAirport, sectorDate,
    sec.aSignOff, sec.arrAirport, sectorDate
  );

  return (
    <div style={{
      border:`1px solid ${mix(col,21)}`,
      borderRadius:12,
      overflow:"hidden",
      marginBottom:6,
    }}>
      {/* Sector header */}
      <div style={{
        background:`${mix(col,6)}`,
        borderBottom:`1px solid ${mix(col,15)}`,
        padding:"10px 14px",
        display:"flex", alignItems:"center", gap:10,
      }}>
        {/* Number badge */}
        <div style={{
          width:28, height:28, borderRadius:7,
          background:col, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:15, fontWeight:800, color:"var(--ink)", flexShrink:0,
          fontFamily:"Arial,sans-serif", letterSpacing:0,
        }}>{idx+1}</div>

        <div style={{display:"flex",gap:8,alignItems:"center",flex:1,flexWrap:"wrap"}}>
          <input
            value={sec.flightNo}
            onChange={e=>onUpdate("flightNo",e.target.value)}
            placeholder="Flight No."
            style={{background:"transparent",border:"none",borderBottom:`1px solid ${mix(col,25)}`,color:"var(--ink)",fontFamily:mono,fontSize:14,width:90,padding:"1px 0"}}
          />
          {sec.depAirport&&sec.arrAirport&&(
            <span style={{fontSize:13,fontFamily:mono,color:col,fontWeight:700}}>
              {apInfo(sec.depAirport)?.flag}{sec.depAirport} → {apInfo(sec.arrAirport)?.flag}{sec.arrAirport}
            </span>
          )}
          {dh!=null&&dh>0&&(
            <span style={{fontSize:12,fontFamily:mono,color:"var(--ink2)"}}>
              ⏱ <span style={{color:col,fontWeight:700}}>{dh.toFixed(2)}h</span> UTC
            </span>
          )}
        </div>

        {/* Sector date (only for sector 2+, as sector 1 always uses the trip day) */}
        {idx > 0 && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
            <span style={{fontSize:9,color:"var(--ink2)",fontFamily:mono}}>SECTOR DATE</span>
            <input type="date" value={sec.sectorDate||sectorDate} onChange={e=>onUpdate("sectorDate",e.target.value)}
              style={{background:"transparent",border:"none",borderBottom:`1px solid ${mix(col,19)}`,color:sec.sectorDate?"var(--muted)":"var(--ink2)",fontFamily:mono,fontSize:12,colorScheme:"inherit",cursor:"pointer",width:100}}/>
          </div>
        )}

        {/* Remove button (always allow removal if >1 sector) */}
        {totalSectors > 1 && (
          <button onClick={onRemove} style={{
            background:"transparent",border:`1px solid color-mix(in srgb, var(--red) 25%, transparent)`,borderRadius:5,
            color:"var(--red)",fontSize:14,cursor:"pointer",padding:"2px 7px",flexShrink:0,
            fontFamily:mono,
          }}>✕</button>
        )}
      </div>

      {/* Sector body */}
      <div style={{padding:"12px 14px"}}>
        {/* Reserve Period toggle (sector 1 only) */}
        {isFirstSector && (
          <div style={{marginBottom:sec.reservePeriod?0:12}}>
            <Toggle label="Reserve Period (flat 4h credit)" checked={!!sec.reservePeriod} onChange={v=>onUpdate("reservePeriod",v)} color="var(--purple)"/>
          </div>
        )}

        {/* Positioning (PAX) toggle — marks a sector as a positioning /
            passenger flight. Credit hours calc applies 0.5× multiplier,
            and (for MANUAL entries only) the block time is estimated as
            30 min after sign-on to 15 min before sign-off (vs 60/15 for
            operating). Rosters imported from BP files carry their own
            block times so this only affects manually-entered sectors. */}
        {!sec.reservePeriod && (
          <div style={{marginBottom:12}}>
            <Toggle label="PAX / Positioning flight (0.5× credit)" checked={!!sec.isPositioning} onChange={v=>onUpdate("isPositioning",v)} color="var(--yellow)"/>
          </div>
        )}

        {/* When reserve period is on, only show sign-on/off */}
        {!sec.reservePeriod && (
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14,alignItems:"flex-end"}}>
            <ASelect label="DEPARTURE" value={sec.depAirport} onChange={v=>onUpdate("depAirport",v)} dateStr={sec.sectorDate||sectorDate} color={col}/>
            <div style={{color:"var(--muted)",fontSize:16,paddingBottom:6,alignSelf:"flex-end"}}>→</div>
            <ASelect label="ARRIVAL"   value={sec.arrAirport} onChange={v=>onUpdate("arrAirport",v)} dateStr={sec.sectorDate||sectorDate} color={col}/>
          </div>
        )}

        {/* Times */}
        <ICard border={`${mix(col,25)}`} style={sec.reservePeriod?{marginTop:12}:{}}>
          <div style={{fontSize:10,letterSpacing:1.5,color:col,fontFamily:mono,marginBottom:9}}>✈ SIGN-ON / SIGN-OFF</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <TInput label="SIGN-ON"  value={sec.aSignOn}  onChange={v=>onUpdate("aSignOn",v)}  color={col} tzLbl={sec.reservePeriod?"—":(tzLabel(sec.depAirport,sec.sectorDate||sectorDate)||"—")}/>
            <TInput label="SIGN-OFF" value={sec.aSignOff} onChange={v=>onUpdate("aSignOff",v)} color={col} tzLbl={sec.reservePeriod?"—":(tzLabel(sec.arrAirport,sec.sectorDate||sectorDate)||"—")}/>
          </div>
        </ICard>

        {/* DHA + missed meal summary */}
        {!sec.reservePeriod && sec.aSignOn&&(
          <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",padding:"7px 10px",background:"var(--bg)",border:`1px solid ${col}20`,borderRadius:8,marginTop:8}}>
            {dh!=null&&dh>0&&<span style={{fontSize:12,fontFamily:mono}}><span style={{color:"var(--ink2)"}}>UTC duty: </span><span style={{color:col,fontWeight:700}}>{dh.toFixed(2)}h</span></span>}
            <div style={{marginLeft:"auto"}}>
              <Toggle label="Missed meal" checked={sec.missedMeal} onChange={v=>onUpdate("missedMeal",v)} color="var(--orange2)"/>
            </div>
          </div>
        )}

        {/* Roster-publish sign-on comparison (first sector only) */}
        {!sec.reservePeriod && isFirstSector && totalSectors > 1 && (
          <div style={{marginTop:8}}>
            <Toggle label="Different from roster publish sign-on?" checked={sec.hasRosterPublishSignOnDiff} onChange={v=>{onUpdate("hasRosterPublishSignOnDiff",v);if(!v){onUpdate("rosterPublishSignOn","");onUpdate("rosterPublishSignOnDate","");}}} color="var(--amber)"/>
            {sec.hasRosterPublishSignOnDiff && (
              <div style={{marginTop:8,background:"var(--bg)",border:"1px solid color-mix(in srgb, var(--amber) 25%, transparent)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"flex-end",gap:14,flexWrap:"wrap"}}>
                  <DInput label="ROSTER PUBLISH DATE" value={sec.rosterPublishSignOnDate||sectorDate} onChange={v=>onUpdate("rosterPublishSignOnDate",v)} hi/>
                  <TInput label="ROSTER PUBLISH SIGN-ON" value={sec.rosterPublishSignOn} onChange={v=>onUpdate("rosterPublishSignOn",v)} color="var(--amber)" tzLbl={tzLabel(sec.depAirport,sectorDate)||"—"}/>
                  <div style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:2}}>
                    <span style={{fontSize:10,letterSpacing:1,color:"var(--ink2)",fontFamily:mono}}>ACTUAL SIGN-ON</span>
                    <span style={{fontSize:13,fontFamily:mono,color:"var(--ink)",fontWeight:600}}>{fmtShort(sectorDate)} {fmtTime(parseTime(sec.aSignOn))}</span>
                  </div>
                  {(()=>{
                    const rp=parseTime(sec.rosterPublishSignOn);
                    const act=parseTime(sec.aSignOn);
                    if(rp==null||act==null) return null;
                    const rpDate=sec.rosterPublishSignOnDate||sectorDate;
                    const actDate=sectorDate;
                    const dayDiffMins=daysBetween(actDate,rpDate)*1440;
                    const earlierBy=dayDiffMins+(rp-act); // positive = actual is earlier
                    const h=Math.floor(Math.abs(earlierBy)/60), m=Math.abs(earlierBy)%60;
                    const durStr=h>0?`${h}h ${m}m`:`${m}m`;
                    const dir=earlierBy>0?"earlier":"later";
                    const varCol=earlierBy<=0?"var(--green2)":earlierBy>120?"var(--orange)":"var(--green2)";
                    const triggers=earlierBy>120;
                    return (
                      <div style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:2}}>
                        <span style={{fontSize:10,letterSpacing:1,color:"var(--ink2)",fontFamily:mono}}>VARIANCE</span>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:13,fontFamily:mono,fontWeight:700,color:varCol}}>{earlierBy===0?"On time":`${durStr} ${dir}`}</span>
                          {triggers&&<span style={{fontSize:9,fontWeight:700,letterSpacing:0.8,color:"var(--amber)",border:"1px solid color-mix(in srgb, var(--amber) 25%, transparent)",borderRadius:3,padding:"1px 5px",background:"color-mix(in srgb, var(--amber) 6%, transparent)",fontFamily:mono}}>DVA TRIGGERED</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{fontSize:10,color:"var(--ink2)",fontFamily:mono,marginTop:6,lineHeight:1.6}}>
                  📝 DVA (Cl. 5.28) triggers if actual sign-on is more than 2 hours earlier than roster publish.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Roster-publish sign-off comparison (last sector only) */}
        {!sec.reservePeriod && isLastSector && totalSectors > 1 && (
          <div style={{marginTop:8}}>
            <Toggle label="Different from roster publish sign-off?" checked={sec.hasRosterPublishDiff} onChange={v=>{onUpdate("hasRosterPublishDiff",v);if(!v){onUpdate("rosterPublishSignOff","");onUpdate("rosterPublishSignOffDate","");}}} color="var(--amber)"/>
            {sec.hasRosterPublishDiff && (
              <div style={{marginTop:8,background:"var(--bg)",border:"1px solid color-mix(in srgb, var(--amber) 25%, transparent)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"flex-end",gap:14,flexWrap:"wrap"}}>
                  <DInput label="ROSTER PUBLISH DATE" value={sec.rosterPublishSignOffDate||sectorDate} onChange={v=>onUpdate("rosterPublishSignOffDate",v)} hi/>
                  <TInput label="ROSTER PUBLISH SIGN-OFF" value={sec.rosterPublishSignOff} onChange={v=>onUpdate("rosterPublishSignOff",v)} color="var(--amber)" tzLbl={tzLabel(sec.arrAirport,sectorDate)||"—"}/>
                  <div style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:2}}>
                    <span style={{fontSize:10,letterSpacing:1,color:"var(--ink2)",fontFamily:mono}}>ACTUAL SIGN-OFF</span>
                    <span style={{fontSize:13,fontFamily:mono,color:"var(--ink)",fontWeight:600}}>{fmtShort(sectorDate)} {fmtTime(parseTime(sec.aSignOff))}</span>
                  </div>
                  {(()=>{
                    const rp=parseTime(sec.rosterPublishSignOff);
                    const act=parseTime(sec.aSignOff);
                    if(rp==null||act==null) return null;
                    const rpDate=sec.rosterPublishSignOffDate||sectorDate;
                    const actDate=sectorDate;
                    const dayDiffMins=daysBetween(rpDate,actDate)*1440;
                    const laterBy=dayDiffMins+(act-rp); // positive = actual is later
                    const h=Math.floor(Math.abs(laterBy)/60), m=Math.abs(laterBy)%60;
                    const durStr=h>0?`${h}h ${m}m`:`${m}m`;
                    const dir=laterBy>0?"later":"earlier";
                    const dvaTrigger=laterBy>120;
                    const ddoTrigger=laterBy>240;
                    const varCol=laterBy<=0?"var(--green2)":ddoTrigger?"var(--red)":dvaTrigger?"var(--orange)":"var(--green2)";
                    return (
                      <div style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:2}}>
                        <span style={{fontSize:10,letterSpacing:1,color:"var(--ink2)",fontFamily:mono}}>VARIANCE</span>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,fontFamily:mono,fontWeight:700,color:varCol}}>{laterBy===0?"On time":`${durStr} ${dir}`}</span>
                          {dvaTrigger&&<span style={{fontSize:9,fontWeight:700,letterSpacing:0.8,color:"var(--amber)",border:"1px solid color-mix(in srgb, var(--amber) 25%, transparent)",borderRadius:3,padding:"1px 5px",background:"color-mix(in srgb, var(--amber) 6%, transparent)",fontFamily:mono}}>DVA TRIGGERED</span>}
                          {ddoTrigger&&<span style={{fontSize:9,fontWeight:700,letterSpacing:0.8,color:"var(--red)",border:"1px solid color-mix(in srgb, var(--red) 25%, transparent)",borderRadius:3,padding:"1px 5px",background:"color-mix(in srgb, var(--red) 6%, transparent)",fontFamily:mono}}>DAY OFF PAYMENT</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{fontSize:10,color:"var(--ink2)",fontFamily:mono,marginTop:6,lineHeight:1.6}}>
                  📝 DVA (Cl. 5.28) triggers if actual sign-off is more than 2 hours later. Day Off Payment (Cl. 5.20) triggers if more than 4 hours later.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* "Insert hotel" connector */}
      {!sec.reservePeriod && showHotelBtn&&!hasHotelAfter&&(
        <div style={{padding:"0 14px 12px",display:"flex",justifyContent:"center"}}>
          <button onClick={onAddHotelAfter} style={{
            background:"var(--accentBg2)",border:"1px dashed var(--accentLine)",borderRadius:8,
            color:"var(--accent)",fontSize:12,cursor:"pointer",padding:"5px 14px",
            fontFamily:mono,letterSpacing:0.5,
          }}>🏨 Hotel stay after this sector</button>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

// Step-by-step "how to use" guide, shown when the header "?" button is tapped.
function HelpModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const steps = [
    ["Set who you are", "Pick your rank (Captain / F/Officer) and aircraft (A330 / A320) in the top bar. When you upload a roster these are detected automatically, so you usually don't need to touch them."],
    ["Choose the pay year", "The EBA year selector applies the right indexation to every rate. When you upload a roster it's set automatically from the bid period's start date — and updates as you click between BP chips — so you usually don't need to touch it. You can still pick a year to project."],
    ["Upload your roster", "Tap 📄 ROSTER and choose your Qantas SH bid-period .txt file. You can upload several BP files one after another to view multiple bid periods together — boundary trips that span two BPs are handled for you."],
    ["Work through the tabs", "DAY SUMMARY — every sector and allowance for one day. MEAL RATES — the reference meal-rate table. WEEK SUMMARY — totals for a week. MONTH / ROSTER — totals across a whole bid period. PAY CHECK — compare what you were actually paid against those totals."],
    ["See a bid period's total", "On MONTH / ROSTER, click a BP chip (e.g. “BP 3761”) to show that bid period's total allowances and overtime. A BP shows the same total whether it's loaded on its own or alongside its neighbour."],
    ["Or use a custom range", "Set the Custom range dates for any window you like. Custom ranges show just the allowances captured in those dates — overtime and the Qantas header duty/credit carry are deliberately excluded."],
    ["Set Years of Service", "Overtime pay needs your years of service. It's filled in automatically when your name is found in the pilot list; otherwise pick it from the selector."],
    ["Dig into the detail", "Expand the DHA, meal, credit-hour and pattern breakdowns to see every line item and how each figure is built. Use Export CSV to save a copy."],
    ["Check your payslip", "PAY CHECK compares what you were actually paid against the figures above. Tap 📄 Upload payslip PDF and the earnings lines are read straight off it — CR MEALS ATO, DUTY HOUR AL, call-ins, DVA and overtime — and the matching bid period is selected for you. The PDF is read inside your browser and is never uploaded anywhere."],
    ["Or enter it by hand", "No PDF, or a payslip it can't read? Select a BP chip and type the lines in yourself. “Pre-fill from this roster” adds a meal line per hotel stay with the dates already filled, so you only type the amounts. Anything read from a PDF stays editable."],
    ["Reading the result", "Every line shows the calculator's own figure beside yours, with a ✓ or the dollar difference. The headline is the total variance. It also flags a stay with no matching payslip line — an unpaid trip — and a payment the calculator says you weren't owed. A difference is a prompt to check, not proof of an error: these are estimates."],
    ["Housekeeping", "⤓ APP saves a standalone offline copy of the calculator, ☾ toggles dark mode, and 🗑 CLEAR removes all loaded roster and payslip data and resets everything. On PAY CHECK, 🗑 CLEAR PAYSLIP drops just the payslip figures and keeps your roster. Nothing is saved between sessions — it all clears when you reload."],
  ];

  return (
    <div onClick={onClose}
      style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(20,24,32,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:"var(--bg)",border:"1px solid var(--accentLine)",borderRadius:16,maxWidth:640,width:"100%",maxHeight:"calc(100dvh - 32px)",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"18px 22px",borderBottom:"1px solid var(--line2)",flexShrink:0}}>
          <div>
            <div style={{fontFamily:heading,fontSize:22,fontWeight:700,color:"var(--ink)"}}>How to use this calculator</div>
            <div style={{fontSize:11,letterSpacing:1.5,color:"var(--muted)",fontFamily:mono,marginTop:2}}>EFA DUTY / ALLOWANCE CALCULATOR</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,color:"var(--muted)",fontSize:16,cursor:"pointer",padding:"4px 11px",fontFamily:mono,lineHeight:1,flexShrink:0}}>✕</button>
        </div>
        <div style={{padding:"14px 22px 22px",overflowY:"auto",minHeight:0,WebkitOverflowScrolling:"touch"}}>
          {steps.map(([title,body],i)=>(
            <div key={i} style={{display:"flex",gap:13,padding:"11px 0",borderBottom:i<steps.length-1?"1px solid var(--line3)":"none"}}>
              <div style={{flexShrink:0,width:26,height:26,borderRadius:"50%",background:"var(--accentBg)",border:"1px solid var(--accent)",color:"var(--accent)",fontFamily:mono,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--ink)",marginBottom:2}}>{title}</div>
                <div style={{fontSize:13,color:"var(--ink2)",lineHeight:1.55}}>{body}</div>
              </div>
            </div>
          ))}
          <button onClick={onClose}
            style={{marginTop:16,width:"100%",background:"var(--accent)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",padding:"10px",fontFamily:mono,letterSpacing:0.5}}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// Helper to build a sector with pre-filled fields for roster import
function bldSec(flightNo, dep, arr, signOn, signOff, sectorDate, extra={}) {
  return { ...newSector(dep, arr), flightNo, aSignOn:signOn, aSignOff:signOff, sectorDate:sectorDate||"", ...extra };
}

// Parse a Qantas SH Flight Crew Roster .txt file and return an allWeeks object.
// Returns { weeks, firstWeekStart, errors } — weeks maps weekStart → day-of-week map.
// How much of the header's "Carried In" does this roster already PRINT?
//
// Carried In/Out are Qantas's boundary-attribution figures, and the two sides
// are NOT symmetrical in the file. The carried-OUT duty is always printed here
// — either on the BP's last day or a day or two past it — and our base range
// runs to rangeTo + 7, so it is always inside a by-date sum and always has to
// be subtracted. The carried-IN duty usually is NOT printed here: it lives on
// the PREVIOUS BP's roster, flagged there as carried out, so it has to be
// added. BP3745 is that shape — header Carried In 11:27 (9:40), and the
// 19 Apr QF7526 those hours belong to appears only on the BP3741 file.
//
// But some rosters print it, as LEADING ORPHAN CONTINUATION rows: duty rows
// with no Duty(Role) code that sit before the first coded row, because the
// pattern they belong to started in the previous BP and no pattern head
// appears in this file. BP3755 (Nichols) opens with
//
//     16 Tue              7526            2245 1040  9:55  9:20
//
// and its header reads Carried In 9:55 (9:20) — the same duty. That roster's
// stated Total Duty 114:49 / Total Credit 56:38 are the plain sums of the rows
// dated inside the BP window, so Qantas counts it ONCE; adding the header
// value on top of our own by-date sum would count it twice.
//
// It is not either/or, so this returns a QUANTITY rather than a flag. BP3721
// prints two of the three duties making up its 18:03 carry-in (3:55 + 12:17)
// and leaves the 1:51 post-midnight tail of 30 Nov unprinted — its stated
// total is the by-date sum plus exactly that 1:51.
//
// Verified against every roster in the user's folder that carries hours in:
// fully printed — BP3685, BP3741 (Tsunoda), BP3755 (Nichols), BP3761;
// partly printed — BP3721; not printed — BP3745, BP3751, BP3755 (Clough),
// BP3765, BP3771.
function carriedInPrinted(topSection, bpStart) {
  const none = { duty: "0:00", credit: "0:00" };
  if (!topSection || !bpStart) return none;
  const lines = topSection.split(/\r?\n/);
  // Read the Duty and Credit columns by header offset, not by counting time
  // fields — some duty rows (e.g. "LSN") print hours with no sign-on/sign-off.
  const hdrLine = lines.find(l => l.startsWith("Date") && l.includes("S-On S-Of Duty"));
  if (!hdrLine) return none;
  const dutyCol = hdrLine.indexOf("Duty", hdrLine.indexOf("Service"));
  const credCol = hdrLine.indexOf("Credit");
  const portCol = hdrLine.indexOf("Port");
  if (dutyCol < 0 || credCol < 0 || portCol < 0) return none;
  const bpEnd = addDays(bpStart, 27);
  let mon = parseInt(bpStart.slice(5, 7), 10) - 1;
  let yr  = parseInt(bpStart.slice(0, 4), 10);
  let lastDay = -1, dutyMins = 0, credMins = 0;
  const mins = (s) => { const p = s.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); };
  for (const ln of lines) {
    const m = ln.match(/^(\d{1,2})\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(.*)$/);
    if (!m) continue;
    const dayNum = parseInt(m[1], 10);
    // Same month-rollover rule the schedule walk uses: a day number that drops
    // by more than 5 is the next month, not a re-listing.
    if (lastDay !== -1 && dayNum < lastDay - 5) { mon++; if (mon > 11) { mon = 0; yr++; } }
    lastDay = dayNum;
    // 6 or fewer leading spaces = a Duty(Role) code is present. The first such
    // row is this BP's own first pattern, so the orphan run ends there.
    if (/^\s{0,6}\S/.test(m[2])) break;
    const duty = (ln.slice(dutyCol - 2, credCol).match(/\d{1,3}:\d{2}/) || [])[0];
    if (!duty) continue;
    const date = `${yr}-${String(mon + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    if (date < bpStart || date > bpEnd) continue;
    const cred = (ln.slice(credCol - 2, portCol).match(/\d{1,3}:\d{2}/) || [])[0];
    dutyMins += mins(duty);
    if (cred) credMins += mins(cred);
  }
  const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  return { duty: fmt(dutyMins), credit: fmt(credMins) };
}

// Hours of the header's Carried In that still have to be ADDED to a by-date
// sum — the whole of it when this roster does not print the duty, nothing when
// it prints all of it, the remainder when it prints part. `kind` is "duty" or
// "credit". Carried Out is not routed through here: it always applies in full.
// Decimal hours → "H:MM", so an adjusted carry figure reads the same way as
// the header's own HH:MM values beside it.
function fmtHM(h) {
  const t = Math.round((h || 0) * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function carriedInAddHrs(hdr, kind) {
  if (!hdr) return 0;
  const hm = (s) => {
    if (!s || typeof s !== "string") return 0;
    const p = s.trim().split(":").map(n => parseInt(n, 10));
    if (p.length !== 2 || Number.isNaN(p[0]) || Number.isNaN(p[1])) return 0;
    return p[0] + p[1] / 60;
  };
  const isCredit = kind === "credit";
  const total   = hm(isCredit ? hdr.carriedInCredit        : hdr.carriedInDuty);
  const printed = hm(isCredit ? hdr.carriedInPrintedCredit : hdr.carriedInPrintedDuty);
  return Math.max(0, total - printed);
}

function parseQantasRoster(text) {
  const errors = [];
  const weeks = {};
  const ensureWeek = (ws) => {
    if (!weeks[ws]) weeks[ws] = Object.fromEntries(DAY_NAMES.map(k => [k, emptyDay()]));
    return weeks[ws];
  };

  // ── Bid Period start-date lookup ──
  // Each Qantas bid period is exactly 28 days. The BP numbers follow a non-uniform sequence
  // (skipping numbers ending in 3, 7, etc.) so we hardcode known anchors and extrapolate
  // ±28 days for any BP not in the table.
  // BP (Bid Period) numbering follows an alternating 4–6 step pattern: each
  // 28-day BP increments the BP number by either +4 or +6, alternating. From
  // BP3651 = 4 Nov 2024 (anchor), the sequence is 3651, 3655 (+4), 3661 (+6),
  // 3665 (+4), 3671 (+6), ... — every BP cycle is 28 days, but the BP number
  // doesn't advance uniformly. The earlier hard-coded table extrapolated by
  // (bpNum-nearest)*5.6 which was just the average of the 4-6 alternation,
  // giving wrong start dates one step past the table (e.g. BP3751 came out
  // as 24 May 2026 instead of 18 May 2026). The formula below is exact.
  const BP_ANCHOR_NUM = 3651;
  const BP_ANCHOR_DATE = "2024-11-04";
  function bpIndexFromNumber(bpNum) {
    const delta = bpNum - BP_ANCHOR_NUM;
    if (delta < 0) {
      const absDelta = -delta;
      const r = absDelta % 10;
      if (r !== 0 && r !== 6) return null;
      return -(2 * Math.floor(absDelta / 10) + (r === 6 ? 1 : 0));
    }
    const r = delta % 10;
    if (r !== 0 && r !== 4) return null;
    return 2 * Math.floor(delta / 10) + (r === 4 ? 1 : 0);
  }
  function bpStartDate(bpNum) {
    const idx = bpIndexFromNumber(bpNum);
    if (idx == null) return null;
    return addDays(BP_ANCHOR_DATE, idx * 28);
  }

  // Detect bid period number from header — "Bid Period 3741"
  const bpMatch = text.match(/Bid\s+Period\s+(\d{4})/);
  let bpStart = null, bpYear = new Date().getFullYear();
  if (bpMatch) {
    const bpNum = parseInt(bpMatch[1], 10);
    bpStart = bpStartDate(bpNum);
    if (bpStart) {
      bpYear = parseInt(bpStart.slice(0, 4), 10);
    }
  }
  // Fallback: if no BP detected, extract year from header timestamp (legacy behaviour)
  if (!bpStart) {
    const yrMatch = text.match(/(\d{2})([A-Za-z]{3})(\d{2})\s+\d{4}/);
    if (yrMatch) bpYear = 2000 + parseInt(yrMatch[3], 10);
  }

  // Detect role from "Category:" line — e.g. "Category:  F/O-A330" or "Category:  CPT-A330"
  let detectedRole = null;
  let detectedAircraft = null;
  let detectedJoiningDate = null;
  let detectedYos = -1;
  const catMatch = text.match(/Category\s*:\s*(\S+)/);
  if (catMatch) {
    const cat = catMatch[1].toUpperCase();
    if (cat.startsWith("F/O") || cat.startsWith("FO")) detectedRole = "fo";
    else if (cat.startsWith("CPT") || cat.startsWith("CAPT")) detectedRole = "cpt";
    if (cat.includes("A330") || cat.includes("330")) detectedAircraft = "a330";
    else if (cat.includes("A320") || cat.includes("320") || cat.includes("A321") || cat.includes("321")) detectedAircraft = "a320";
  }

  // Detect pilot name from "Name : PAPPIN TW" line
  const nameMatch = text.match(/Name\s*:\s*(\S+)\s+(\S+)/);
  if (nameMatch) {
    const surname = nameMatch[1].toUpperCase();
    const initials = nameMatch[2].toUpperCase();
    const firstInitial = initials.charAt(0);
    const pilot = lookupPilot(surname, firstInitial);
    if (pilot) {
      detectedJoiningDate = pilot[2];
      // Reference date for YOS auto-detect:
      //   • Past BP (its 28-day window ends before today) → use the BP's start
      //     date so the suggested bracket matches historical YOS.
      //   • Current/future BP                            → use today's date so
      //     the suggested bracket reflects the pilot's actual current service.
      // computeYosTier internally anchors the EA freeze (1 Jan 2026) for the
      // one-time bracket bump regardless of this refDate.
      const today = new Date().toISOString().slice(0, 10);
      // A BP runs 28 days from its start; compute its end to decide past vs current.
      const bpEnd = bpStart ? addDays(bpStart, 27) : null;
      const refDate = (bpEnd && bpEnd < today) ? bpStart : today;
      detectedYos = computeYosTier(detectedJoiningDate, refDate, detectedRole);
    } else {
      // Pilot not in the EFA list. Assume they joined AFTER the EA's
      // 1 Jan 2026 freeze, which means they sit in bracket 0 ("< 3 years")
      // with NO bracket bump applied. We use 2 Jan 2026 as the sentinel
      // join date so `computeYosTier` will safely return the post-freeze
      // bracket regardless of which BP is being viewed.
      detectedJoiningDate = "2026-01-02";
      detectedYos = 0;
    }
  }

  // Detect base airport from "Base :" line — e.g. "Base    :  SYD"
  let detectedBase = "SYD";
  const baseMatch = text.match(/Base\s*:\s*([A-Z]{3})/);
  if (baseMatch) detectedBase = baseMatch[1];

  // Parse the pattern blocks in the second half of the roster — they contain full flight details
  // Each pattern block starts with " Date    Flight    Depart    Arrive ..." and ends with a DATED line
  // Pattern lines have format: DDMmm[ P]  FLIGHT  DEP  HHMM  ARR  HHMM  EQ  BLK  GRND  BLK  Duty  Cred
  // Sign-on/off line: "                 Rpt  HHMM Rls  HHMM      ..."

  const monthIdx = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const pad = n => String(n).padStart(2, "0");
  const mkDate = (day, monAbbr, yr) => {
    const m = monthIdx[monAbbr];
    if (m == null) return "";
    return `${yr}-${pad(m+1)}-${pad(day)}`;
  };
  const mkTime = hhmm => {
    if (!hhmm || hhmm.length !== 4) return "";
    return `${hhmm.slice(0,2)}:${hhmm.slice(2)}`;
  };

  // Split the pattern section — look for "DATED" markers
  const patternBlocks = [];
  const patternRegex = /(DATED\s+(\d{2})([A-Za-z]{3})(\d{2}))/g;
  const blockStarts = [];
  let m;
  // Find pattern block headers — look for the pattern table header
  const headerRegex = /Date\s+Flight\s+Depart\s+Arrive\s+Eq/g;
  while ((m = headerRegex.exec(text)) !== null) {
    blockStarts.push(m.index);
  }
  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i+1] : text.length;
    patternBlocks.push(text.substring(start, end));
  }

  if (patternBlocks.length === 0) {
    errors.push("No pattern blocks found in roster. Ensure this is a Qantas SH Flight Crew Roster.");
    return { weeks, firstWeekStart: null, errors };
  }

  // Rolling year tracker — handles bid periods that span December → January
  // For pattern-block flight-date parsing: anchor on the BP's start month/year
  // so the first flight in a January pattern block of a BP that began in
  // December correctly gets year+1. Without this, a BP3725 (29 Dec 2025 →
  // 25 Jan 2026) whose first pattern block contains only January flights
  // would date them 2025 instead of 2026.
  let curYear = bpYear;
  let prevMonth = bpStart ? parseInt(bpStart.slice(5, 7), 10) - 1 : -1;

  // ── Parse V-duty (reserve) entries from the top schedule section ──
  // Format: "DD Day  V##  ...  HHMM HHMM  H:MM ..."
  // Example: "23 Mon  V61                                     1700 2200  5:00             AW99"
  // V duties are reserve/standby periods, mapped to a reserve period sector in the calculator.
  //
  // We need month context because the schedule section only shows day numbers, not months.
  // Walk through pattern blocks to determine months, and use the first pattern's month to
  // anchor the V-duty dates. If a V-duty's day number is greater than the first pattern's
  // start day, it's in the same month; if smaller, it's in the PREVIOUS month (wrapped).
  //
  // Simplified: use the earliest date found in patterns as the reference. V-duty days
  // come from the top schedule which is in the same bid period, so we find the first
  // pattern date's month/year as a base.

  // Scan the top schedule section for V duties. The top section appears BEFORE "rosterPatns" or "Pattern Details".
  const patternSectionIdx = text.search(/rosterPatns|Pattern Details/);
  const topSection = patternSectionIdx > 0 ? text.substring(0, patternSectionIdx) : text;

  // Collect pattern IDs from "<ID> DATED <DDMmmYY>" lines at the bottom of
  // each pattern block. These IDs ALSO appear as the "duty code" column in
  // the top-schedule section (e.g. "13 Mon TPAPP1B2 A001 1455 2140 ..."),
  // where TPAPP1B2 is the trip identifier and A001 is the actual flight.
  // Without this filter, top-section parsing creates a phantom ground-duty
  // sector for the pattern label, which then incorrectly earns ground-duty
  // meal allowances.
  const patternIds = new Set();
  const datedRegex = /^\s+(\S+)\s+DATED\s+\d{2}[A-Za-z]{3}\d{2}/gm;
  let dm;
  while ((dm = datedRegex.exec(text)) !== null) patternIds.add(dm[1]);

  // Walk EVERY schedule line in order (matching "DD Day  ..."), tracking month rollover
  // by detecting day-number decreases. Anchor at BP start month/year if known, otherwise
  // use the first pattern flight's month/year.
  let topMonth, topYear;
  if (bpStart) {
    topYear = parseInt(bpStart.slice(0, 4), 10);
    topMonth = parseInt(bpStart.slice(5, 7), 10) - 1; // 0-indexed
  } else {
    // Fallback: use the first flight's month from the pattern section
    const firstFlightInText = text.match(/\n(\d{2})([A-Za-z]{3})\s+(?:[A-Z]\s+)?\S+\s+[A-Z]{3}\s+\d{4}/);
    if (firstFlightInText) {
      topMonth = monthIdx[firstFlightInText[2]];
      topYear = bpYear;
    }
  }

  // Queue of dates where an "OL48" appears in the Code column of a top-schedule
  // row. OL48 signals that the pattern infringed on a designated day off and a
  // day-off payment is owed (Cl. 5.20). Applied after pattern blocks populate
  // each day, so the increment lands on the populated record.
  const ol48Days = [];
  // Queue of dates where an "AS48" appears in the Code column. AS48 signals
  // the associated pattern triggers a Duty Variation Allowance payment
  // (Cl. 5.28). Same numeric-prefix convention as OL48 (e.g. `2AS48` → 2 DVAs).
  const as48Days = [];
  // Queue of dates where an "OL13" or "OL11" appears — pilot was activated
  // from reserve. EA: "the credit will be the greater of flight hour credit
  // or four hours." Both codes are treated identically; we flag the day so
  // the credit-item builder can apply the 4h floor.
  const ol13Days = [];

  if (topMonth != null) {
    const monthAbbrs = Object.keys(monthIdx);
    const scheduleLineRegex = /^(\d{1,2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(.*)$/gm;
    let lastDay = -1;
    let sm;
    while ((sm = scheduleLineRegex.exec(topSection)) !== null) {
      const dayNum = parseInt(sm[1], 10);
      const rest = sm[3];
      // Detect month rollover: day number decreased significantly
      if (lastDay !== -1 && dayNum < lastDay - 5) {
        topMonth++;
        if (topMonth > 11) { topMonth = 0; topYear++; }
      }
      lastDay = dayNum;

      // Check for OL48/OL13/AS48 BEFORE any skip logic — these markers can
      // appear on pattern-label rows. OL48 triggers a day-off payment for that
      // day (OL06 does NOT); AS48 triggers a Duty Variation Allowance. Any may
      // be prefixed with a count.
      const ddoRegex = /\b(\d*)OL48\b/g;
      let ddoMatch;
      while ((ddoMatch = ddoRegex.exec(rest)) !== null) {
        const count = parseInt(ddoMatch[1] || "1", 10) || 1;
        const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
        if (sectorDate) ol48Days.push({ date: sectorDate, count });
      }
      const dvaRegex = /\b(\d*)AS48\b/g;
      let dvaMatch;
      while ((dvaMatch = dvaRegex.exec(rest)) !== null) {
        const count = parseInt(dvaMatch[1] || "1", 10) || 1;
        const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
        if (sectorDate) as48Days.push({ date: sectorDate, count });
      }
      if (/\bOL(?:11|13)\b/.test(rest)) {
        const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
        if (sectorDate) ol13Days.push(sectorDate);
      }

      // Check if this line has a duty code (appears within first ~6 chars of rest).
      // Continuation lines (no duty code) have 8+ leading spaces before the service code.
      const leadingSpaces = (rest.match(/^(\s*)/)||["",""])[1].length;
      if (leadingSpaces > 6) continue; // Continuation line, skip

      // Extract duty code (first non-whitespace token, may include parentheses like SIM251C(T))
      const codeMatch = rest.match(/^\s*(\S+(?:\([^)]*\))?)/);
      if (!codeMatch) continue;
      const dutyCode = codeMatch[1];

      // Skip duties starting with a digit — these are flight patterns handled by pattern blocks
      if (/^\d/.test(dutyCode)) continue;
      // Skip pattern-label rows in the top schedule — the pattern block is
      // the authoritative source for these days. (Without this, a phantom
      // ground duty would be created for the entire trip's sign-on→sign-off
      // window and would now incorrectly earn ground-duty meal allowances.)
      if (patternIds.has(dutyCode)) continue;

      // Annual Leave (LA) — 2.5 credit hours per full day, no DHA or meals
      if (dutyCode === "LA") {
        const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
        const d = parseDate(sectorDate);
        if (!d) continue;
        const ws = getMon(sectorDate);
        const dow = d.getUTCDay();
        const dayKey = DAY_NAMES[(dow + 6) % 7];
        const week = ensureWeek(ws);
        const laSec = { ...newSector(), flightNo: "LA", sectorDate, isAnnualLeave: true };
        week[dayKey] = { ...emptyDay(), sectors: [laSec] };
        continue;
      }

      // Skip non-duty codes (D/O, AX, LZR, etc. — no sign-on/off times)
      // Look for sign-on/sign-off times (two 4-digit HHMM values) anywhere in the line
      const timeMatch = rest.match(/(\d{4})\s+(\d{4})/);
      if (!timeMatch) continue;
      // Skip continuation rows: when a duty session crosses midnight, Qantas
      // rosters add a second line on the next day's row with the same sign-on
      // and sign-off times but no Duty/Credit columns (e.g. SIM251D(S) on
      // 23 Sat after the 22 Fri row already counted its 9:00 duty). These
      // rows must be skipped so meals/DHA aren't double-paid.
      const afterTimes = rest.substring((timeMatch.index || 0) + timeMatch[0].length);
      if (!/\d{1,2}:\d{2}/.test(afterTimes)) continue;

      const signOn = mkTime(timeMatch[1]);
      const signOff = mkTime(timeMatch[2]);
      const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
      const d = parseDate(sectorDate);
      if (!d) continue;
      const ws = getMon(sectorDate);
      const dow = d.getUTCDay();
      const dayKey = DAY_NAMES[(dow + 6) % 7];
      const week = ensureWeek(ws);

      if (/^V\d/.test(dutyCode)) {
        // V-duty → reserve period (flat 4h DHA)
        const reserveSec = { ...newSector(), flightNo: dutyCode, aSignOn: signOn, aSignOff: signOff, sectorDate, reservePeriod: true };
        week[dayKey] = {
          ...emptyDay(),
          sectors: [reserveSec, newSector()],
        };
      } else {
        // Ground duty (EF, SIM, etc.) → regular sector with full DHA for all hours
        // Use pilot's base airport for dep/arr so timezone resolution works
        const groundSec = bldSec(dutyCode, detectedBase, detectedBase, signOn, signOff, sectorDate, { isGroundDuty: true });
        week[dayKey] = {
          ...emptyDay(),
          sectors: [groundSec],
        };
      }
    }
  }

  patternBlocks.forEach(block => {
    // Flight lines: "DDMmm  FLIGHT  DEP  HHMM ARR  HHMM  ..."
    // Optional marker before flight number:
    //   P = positioning (pilot is pax), A = positioning, & = simulator/ground duty
    //   No marker = operating sector (pilot is flying)
    // P and A flights are positioning — they should NOT become sectors in the calculator.
    // & flights (SIMs) and unmarked flights SHOULD become sectors.
    const flightLineRegex = /^(\d{2})([A-Za-z]{3})\s+([A-Z&]\s+)?(\S+)\s+([A-Z]{3})\s+(\d{4})\s+([A-Z]{3})\s+(\d{4})/gm;
    // Sign on/off line: "                 Rpt  HHMM Rls  HHMM"
    const rptRegex = /Rpt\s+(\d{4})\s+Rls\s+(\d{4})/g;

    const flights = [];
    let fm;
    while ((fm = flightLineRegex.exec(block)) !== null) {
      const day = parseInt(fm[1], 10);
      const monAbbr = fm[2];
      // Marker: P or A = positioning (pilot is pax). & = sim. No marker = operating.
      const marker = fm[3] ? fm[3].trim() : "";
      const isPositioning = marker === "P" || marker === "A";
      const flightNo = fm[4];
      const dep = fm[5];
      const depTime = fm[6];
      const arr = fm[7];
      const arrTime = fm[8];
      const mIdx = monthIdx[monAbbr];
      if (mIdx == null) continue;
      // Year rollover detection: if month jumped backwards, increment year
      if (prevMonth >= 0 && mIdx < prevMonth && (prevMonth - mIdx) > 6) curYear++;
      prevMonth = mIdx;
      const sectorDate = mkDate(day, monAbbr, curYear);
      // Prefix QF for Qantas flight numbers that don't already have a prefix (numeric-only)
      const flt = /^\d+$/.test(flightNo) ? `QF${flightNo}` : flightNo;
      flights.push({ sectorDate, flightNo: flt, dep, arr, depTime, arrTime, isPositioning });
    }

    if (flights.length === 0) return;

    // Collect Rpt/Rls pairs in order — each pair bookends a duty period
    const rptPairs = [];
    let rm;
    while ((rm = rptRegex.exec(block)) !== null) {
      rptPairs.push({ signOn: mkTime(rm[1]), signOff: mkTime(rm[2]) });
    }

    // A Qantas pattern works like this: the first flight(s) up to (and including)
    // the flight before a "Rpt/Rls" line form one duty period. We match duty periods
    // to sign-on/off lines by order.
    //
    // Simpler model for our calculator: create ONE day entry per pattern where:
    // - first sector gets the first Rpt as sign-on
    // - last sector of each duty period gets that duty's Rls as sign-off
    // - intermediate sectors use continueDuty = true so the calculator merges them
    // - hotels are inserted between duty periods (after the last sector of each period
    //   except the last one)

    // Assign flights to duty periods based on rptPairs order.
    // Heuristic: distribute flights evenly — flight count across dutyPeriods should match.
    // Since we don't know exact grouping, use a simpler approach: pair each Rls line with
    // the most recent flight before it in the block text.
    const blockLines = block.split(/\r?\n/);
    // Find line index of each flight and each Rls
    const flightLines = [];
    const rlsLines = [];
    blockLines.forEach((line, i) => {
      if (/^\d{2}[A-Za-z]{3}\s+([A-Z&]\s+)?\S+\s+[A-Z]{3}\s+\d{4}\s+[A-Z]{3}\s+\d{4}/.test(line)) {
        flightLines.push(i);
      }
      if (/Rpt\s+\d{4}\s+Rls\s+\d{4}/.test(line)) {
        rlsLines.push(i);
      }
    });

    // Each Rls line is the end of a duty period. The flights between the previous Rls (or start)
    // and this Rls belong to this duty period.
    const dutyPeriods = [];
    let fIdx = 0;
    let prevRlsLine = -1;
    rlsLines.forEach((rlsLine, rIdx) => {
      const period = { flightIndices: [], rpt: rptPairs[rIdx] };
      while (fIdx < flightLines.length && flightLines[fIdx] < rlsLine) {
        period.flightIndices.push(fIdx);
        fIdx++;
      }
      prevRlsLine = rlsLine;
      if (period.flightIndices.length > 0) dutyPeriods.push(period);
    });

    if (dutyPeriods.length === 0) return;

    // Build sectors for the entry day
    const allSectors = [];
    const hotels = [];
    let hasSlip = false;

    dutyPeriods.forEach((period, pi) => {
      const periodStartSecIdx = allSectors.length;
      period.flightIndices.forEach((globalFlightIdx, localIdx) => {
        const f = flights[globalFlightIdx];
        const isFirstOfPeriod = localIdx === 0;
        const isLastOfPeriod = localIdx === period.flightIndices.length - 1;
        // Sign-on: use duty's Rpt for the first sector; otherwise use flight's departure time
        const signOn = isFirstOfPeriod ? period.rpt.signOn : mkTime(f.depTime);
        // Sign-off: use duty's Rls for the last sector; otherwise use flight's arrival time
        const signOff = isLastOfPeriod ? period.rpt.signOff : mkTime(f.arrTime);
        // If first sector and Rpt time > scheduled departure time, the sign-on occurred
        // the day BEFORE the flight's departure date. Shift sector date back one day so
        // the calculator treats sign-on as previous-day and DHA midnight-split works correctly.
        let sectorDate = f.sectorDate;
        if (isFirstOfPeriod) {
          const rptMin = parseTime(period.rpt.signOn);
          const depMin = parseTime(mkTime(f.depTime));
          if (rptMin != null && depMin != null && rptMin > depMin) {
            sectorDate = addDays(f.sectorDate, -1);
          }
        }
        // Ground duty detection: when dep === arr (e.g. MEL→MEL for CC, GS, SIM,
        // EFRMS, IE19/29/39, NTS, PDD, ATP). Tagging these here keeps the
        // calculator's parser output structurally identical to the bulk app's,
        // so the two stay in sync. The flag is inert for DHA computation
        // (which uses continueDuty chains regardless), but ensures any future
        // ground-duty-aware logic added to either app behaves consistently.
        const isGroundDuty = (f.dep === f.arr);
        const sec = bldSec(f.flightNo, f.dep, f.arr, signOn, signOff, sectorDate, {
          flightDepTime: mkTime(f.depTime), flightArrTime: mkTime(f.arrTime),
          flightDepDate: f.sectorDate,
          isPositioning: isGroundDuty ? false : f.isPositioning,
          isGroundDuty,
        });
        allSectors.push(sec);
      });
      // Set continueDuty on all sectors in this period except the last
      for (let i = periodStartSecIdx; i < allSectors.length - 1; i++) {
        allSectors[i].continueDuty = true;
      }

      // If this is not the final duty period, insert a hotel after the last sector of this period
      // (unless the arrival airport is the pilot's home base — no hotel there)
      if (pi < dutyPeriods.length - 1 && allSectors.length > periodStartSecIdx) {
        const lastSecInPeriod = allSectors[allSectors.length - 1];
        const nextPeriod = dutyPeriods[pi + 1];
        const nextFirstFlight = flights[nextPeriod.flightIndices[0]];
        if (lastSecInPeriod.arrAirport !== detectedBase) {
          hasSlip = true;
          const secDate = lastSecInPeriod.sectorDate;
          const onMin = parseTime(lastSecInPeriod.aSignOn);
          const offMin = parseTime(lastSecInPeriod.aSignOff);
          const checkInDate = (onMin != null && offMin != null && offMin < onMin) ? addDays(secDate, 1) : secDate;
          // Checkout date: if next period's Rpt is later than its first flight's departure,
          // the checkout (sign-on) is the day before the flight's date.
          let checkOutDate = nextFirstFlight.sectorDate;
          const nextRptMin = parseTime(nextPeriod.rpt.signOn);
          const nextDepMin = parseTime(mkTime(nextFirstFlight.depTime));
          if (nextRptMin != null && nextDepMin != null && nextRptMin > nextDepMin) {
            checkOutDate = addDays(nextFirstFlight.sectorDate, -1);
          }
          // Apply transit-time shift so the recorded hotelCheckIn/hotelCheckOut
          // represent the time AT the hotel, not the time AT the airport. From
          // TRANSIT_REMOVAL_DATE onwards the shift is suppressed.
          const slipAirport = lastSecInPeriod.arrAirport || "";
          const rawTransit = HOTEL_TRANSIT_MIN[slipAirport] ?? 30;
          const transit = (checkInDate >= TRANSIT_REMOVAL_DATE) ? 0 : rawTransit;
          const ciAdj = applyTransitShift(checkInDate,  lastSecInPeriod.aSignOff, +transit);
          const coAdj = applyTransitShift(checkOutDate, nextPeriod.rpt.signOn,    -transit);
          hotels.push({
            afterSectorIdx: allSectors.length - 1,
            hotelFrom: ciAdj.date,
            hotelTo: coAdj.date,
            hotelCheckIn: ciAdj.time,
            hotelCheckOut: coAdj.time,
            transitApplied: transit,
          });
        }
      }
    });

    if (allSectors.length === 0) return;

    // Determine entry day: the first sector's date → week start and day-of-week
    const firstDate = allSectors[0].sectorDate;
    const ws = getMon(firstDate);
    const d = parseDate(firstDate);
    if (!d) return;
    const dow = d.getUTCDay(); // 0=Sun..6=Sat
    const dayKey = DAY_NAMES[(dow + 6) % 7]; // Convert to MON=0..SUN=6

    const week = ensureWeek(ws);
    week[dayKey] = {
      ...emptyDay(),
      sectors: allSectors,
      hasSlip,
      hotels,
    };
  });

  // ── OL48 → Day Off Payment ──
  // An "OL48" in the Code column of a top-schedule row signals that the
  // pattern infringed on a designated day off and a day-off payment is owed
  // (Cl. 5.20). Applied AFTER pattern blocks have populated days, so the
  // increment lands on the populated record instead of being overwritten by
  // emptyDay(). Each OL48 occurrence = +1 day-off payment on that day.
  ol48Days.forEach(({ date: sectorDate, count }) => {
    const d = parseDate(sectorDate);
    if (!d) return;
    const ws = getMon(sectorDate);
    const dow = d.getUTCDay();
    const dayKey = DAY_NAMES[(dow + 6) % 7];
    const week = ensureWeek(ws);
    if (!week[dayKey]) week[dayKey] = emptyDay();
    week[dayKey].extraDdo = (week[dayKey].extraDdo || 0) + count;
  });

  // ── AS48 → Duty Variation Allowance ──
  // "AS48" in the Code column marks the pattern for a DVA payment (Cl. 5.28).
  // Same accumulator pattern as OL48 but for extraDva; numeric prefix (e.g.
  // 2AS48) multiplies the count.
  as48Days.forEach(({ date: sectorDate, count }) => {
    const d = parseDate(sectorDate);
    if (!d) return;
    const ws = getMon(sectorDate);
    const dow = d.getUTCDay();
    const dayKey = DAY_NAMES[(dow + 6) % 7];
    const week = ensureWeek(ws);
    if (!week[dayKey]) week[dayKey] = emptyDay();
    week[dayKey].extraDva = (week[dayKey].extraDva || 0) + count;
  });

  // ── OL13 → Reserve activation, 4h credit floor ──
  // An "OL13" in the Code column marks that the pilot was activated from a
  // reserve period. EA: "the credit will be the greater of flight hour credit
  // or four hours." Tag the day so the credit-item builder can apply the floor.
  ol13Days.forEach(sectorDate => {
    const d = parseDate(sectorDate);
    if (!d) return;
    const ws = getMon(sectorDate);
    const dow = d.getUTCDay();
    const dayKey = DAY_NAMES[(dow + 6) % 7];
    const week = ensureWeek(ws);
    if (!week[dayKey]) week[dayKey] = emptyDay();
    week[dayKey].ol13Reserve = true;
  });

  // ── Dedup pass ──
  // A pilot will never do the same flight/sim code twice in a bid period.
  // If the same normalized code appears in multiple places (e.g. pattern block + top schedule),
  // keep only the first occurrence and remove duplicate standalone days.
  {
    const normCode = c => (c || "").toUpperCase().replace(/\(T\)$/,"").trim();
    const seen = new Set();
    // First pass: collect codes from pattern-block trips (multi-sector days)
    // Key includes the sector date so the same code on different days doesn't collide.
    const weekKeys = Object.keys(weeks).sort();
    weekKeys.forEach(wk => {
      const wDays = weeks[wk];
      DAY_NAMES.forEach(dn => {
        const day = wDays[dn];
        if (!day || !day.sectors || day.sectors.length === 0) return;
        if (day.sectors.length > 1 || (day.hotels && day.hotels.length > 0)) {
          day.sectors.forEach(s => {
            const c = normCode(s.flightNo);
            if (c) seen.add(s.sectorDate ? `${c}@${s.sectorDate}` : c);
          });
        }
      });
    });
    // Second pass: remove standalone single-sector days whose code+date is already seen
    weekKeys.forEach(wk => {
      const wDays = weeks[wk];
      DAY_NAMES.forEach(dn => {
        const day = wDays[dn];
        if (!day || !day.sectors || day.sectors.length === 0) return;
        if (day.sectors.length === 1 && (!day.hotels || day.hotels.length === 0)) {
          const sec0 = day.sectors[0];
          if (sec0.isAnnualLeave || sec0.reservePeriod) return;
          const c = normCode(sec0.flightNo);
          const dateKey = sec0.sectorDate ? `${c}@${sec0.sectorDate}` : c;
          if (c && seen.has(dateKey)) {
            wDays[dn] = emptyDay();
          } else if (c) {
            seen.add(dateKey);
          }
        }
      });
    });
  }

  const firstWeekStart = Object.keys(weeks).sort()[0] || null;
  // Compute date range. If we know the bid period start, use BP start → BP start + 27 days
  // (each Qantas BP is exactly 28 days). Otherwise fall back to scanning sectors/hotels.
  let rangeFrom = null, rangeTo = null;
  if (bpStart) {
    rangeFrom = bpStart;
    rangeTo = addDays(bpStart, 27);
  } else {
    Object.values(weeks).forEach(wDays => {
      DAY_NAMES.forEach(dn => {
        const day = wDays[dn];
        if (!day) return;
        day.sectors?.forEach(s => {
          if (s.sectorDate) {
            if (!rangeFrom || s.sectorDate < rangeFrom) rangeFrom = s.sectorDate;
            if (!rangeTo || s.sectorDate > rangeTo) rangeTo = s.sectorDate;
          }
        });
        (day.hotels || []).forEach(h => {
          if (h.hotelTo) {
            if (!rangeTo || h.hotelTo > rangeTo) rangeTo = h.hotelTo;
          }
        });
      });
    });
  }
  // Parse Qantas's own boundary-attribution values from the roster header.
  // These are the authoritative statement of hours moving between BPs:
  //   "Total Duty Hours Carried In (Out) : 11:27 ( 7:11)"
  //   "Total Credit Hours Carried In (Out) : 9:40 ( 3:40)"
  // Stored as HH:MM strings; downstream code converts to decimal hours as needed.
  const hdrDutyMatch = text.match(/Total Duty Hours Carried In \(Out\)\s*:\s*(\d+:\d+)\s*\(\s*(\d+:\d+)\s*\)/);
  const hdrCredMatch = text.match(/Total Credit Hours Carried In \(Out\)\s*:\s*(\d+:\d+)\s*\(\s*(\d+:\d+)\s*\)/);
  const hdrTotDuty = (text.match(/Total Duty Hours \(Total TAFB\)\s*:\s*(\d+:\d+)/) || [])[1] || null;
  const hdrTotCred = (text.match(/Total Credit Hours\s*:\s*(\d+:\d+)/) || [])[1] || null;
  const hdrCarryPrinted = carriedInPrinted(topSection, bpStart);
  const headerCarry = {
    carriedInDuty:   hdrDutyMatch ? hdrDutyMatch[1] : null,
    carriedOutDuty:  hdrDutyMatch ? hdrDutyMatch[2] : null,
    carriedInCredit: hdrCredMatch ? hdrCredMatch[1] : null,
    carriedOutCredit:hdrCredMatch ? hdrCredMatch[2] : null,
    // How much of the Carried In this roster already prints inside the BP
    // window, so a by-date sum holds it and only the remainder is added.
    // See carriedInPrinted() / carriedInAddHrs().
    carriedInPrintedDuty:   hdrCarryPrinted.duty,
    carriedInPrintedCredit: hdrCarryPrinted.credit,
    totalDuty:       hdrTotDuty,
    totalCredit:     hdrTotCred,
  };
  return { weeks, firstWeekStart, rangeFrom, rangeTo, detectedRole, detectedAircraft, detectedYos, detectedJoiningDate, detectedBP: bpMatch ? parseInt(bpMatch[1],10) : null, headerCarry, errors };
}

// Derive every figure the Month/Roster and Pay Check views need for one date
// range. Pure - depends only on state values, never on JSX - so both tabs read
// the same numbers instead of each maintaining its own copy of this maths.
function derivePeriod({ allWeeks, rosterBPs, role, aircraft, yos, yearIdx,
                        pilotJoiningDate, customFrom, customTo, monthView }) {
          // Parse monthView "YYYY-MM" to get year and month
          const [mvYear,mvMonth]=monthView.split("-").map(Number);
          const monthName=new Date(mvYear,mvMonth-1,1).toLocaleString("en-AU",{month:"long"});

          // Determine effective date range: custom or month
          const useCustom = customFrom && customTo;
          const rangeFrom = useCustom ? customFrom : `${mvYear}-${String(mvMonth).padStart(2,"0")}-01`;
          const rangeTo = useCustom ? customTo : (() => { const d = new Date(mvYear, mvMonth, 0); return `${mvYear}-${String(mvMonth).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
          const rangeLabel = useCustom ? `${fmtFull(customFrom)} — ${fmtFull(customTo)}` : `${monthName} ${mvYear}`;

          const isInRange = (dateStr) => {
            return dateStr >= rangeFrom && dateStr <= rangeTo;
          };
          // For DHA/credit base calc when a BP chip is selected: extend the
          // upper bound so THIS BP's own outgoing boundary pattern (whose
          // duty/meals sit 1–3 days past rangeTo) is captured in base; the
          // header Carried-Out adjustment then nets the duty portion.
          //
          // The extension MUST be the same whether or not the next BP is also
          // loaded — otherwise a BP viewed on its own and the same BP viewed
          // with its neighbour loaded would total differently (the bug this
          // fixes). We therefore no longer cap the extension by the next BP's
          // start date. Instead, `ownedByThisBp` excludes the *next* BP's OWN
          // patterns (those whose pattern-start lands on/after nextBp.from) so
          // they aren't pulled into this BP's base just because they fall
          // inside the 7-day window. A boundary pattern that STARTS in this BP
          // (pattern-start < nextBp.from) keeps its full spill-over.
          const matchedBpForRange = rosterBPs.find(b => b.from === customFrom && b.to === customTo);
          const nextBp = rosterBPs.find(b => b.from > rangeTo);
          const extRangeToRaw = addDays(rangeTo, 7);
          const extRangeTo = extRangeToRaw;
          // A day-entry (= one pattern, keyed at its sign-on day `patternStart`)
          // belongs to the selected BP unless it starts in the next BP.
          const ownedByThisBp = (patternStart) =>
            !(matchedBpForRange && nextBp && patternStart >= nextBp.from);
          const isInBaseRange = (dateStr) => {
            return dateStr >= rangeFrom && dateStr <= (matchedBpForRange ? extRangeTo : rangeTo);
          };
          // Meals do not follow the item's date at a BP boundary. Payroll pays
          // a hotel stay as ONE line, in full, in the bid period its pattern
          // SIGNS ON in. Verified against payslips: BP3755's SIN stay
          // 11–13 Jul was paid whole on the BP3755 payslip even though 13 Jul
          // is past rangeTo, and the 16–19 Apr stays that the BP3745 file
          // carries IN were paid on the BP3741 payslip, not BP3745.
          // isInBaseRange fixes only the outgoing side — ownership has to hold
          // in both directions, or a carried-in stay is counted twice (once in
          // the BP that flew it, once in the BP that inherits its dates).
          //
          // Duty hours are unaffected: they split at midnight and settle
          // through the header's Carried In/Out.
          //
          // Only a selected BP has a sign-on rule to apply; a plain calendar
          // month has no patterns of its own, so it stays date-based.
          const mealStayOwned = (patternStart) =>
            matchedBpForRange
              ? (patternStart >= rangeFrom && patternStart <= rangeTo)
              : ownedByThisBp(patternStart);

          // Find all weeks that overlap the range
          const weeksInRange=Object.keys(allWeeks).filter(ws=>{
            for(let i=0;i<7;i++){
              const dt=addDays(ws,i);
              if(isInRange(dt)) return true;
            }
            return false;
          }).sort();

          // Also include previous weeks for spill-over (trips starting before range whose
          // allowances land inside the range). Check up to 3 weeks back to cover long trips.
          const allWeeksToProcess = [...weeksInRange];
          if (weeksInRange.length > 0) {
            const earliest = weeksInRange[0];
            for (let w = 1; w <= 3; w++) {
              const prevWs = addDays(earliest, -7 * w);
              if (allWeeks[prevWs] && !allWeeksToProcess.includes(prevWs)) allWeeksToProcess.unshift(prevWs);
            }
          }

          const monthDateMap = {};
          allWeeksToProcess.forEach(ws => {
            const wDays = allWeeks[ws];
            if (!wDays) return;
            DAY_NAMES.forEach((dn, di) => {
              const tripDate = weekDate(ws, di);
              // Skip patterns owned by the next BP (see ownedByThisBp above).
              if (!ownedByThisBp(tripDate)) return;
              const byDate = calcAllowancesByDate(wDays[dn], role, yearIdx, tripDate);
              Object.entries(byDate).forEach(([dateStr, items]) => {
                // Use extended range so outgoing boundary DHA (dated just past
                // rangeTo) is included in base; header COut then subtracts it.
                // Meals ignore the date under a BP — see mealStayOwned.
                const keep = items.filter(item => item.id.startsWith("meal_")
                  ? mealStayOwned(tripDate)
                  : isInBaseRange(dateStr));
                if (keep.length === 0) return;
                if (!monthDateMap[dateStr]) monthDateMap[dateStr] = [];
                monthDateMap[dateStr].push(...keep);
              });
            });
          });

          // Compute per-week totals (only for dates in range)
          const weekData=weeksInRange.map(ws=>{
            let wTotal = 0;
            const wItems = [];
            for (let i = 0; i < 7; i++) {
              const dt = addDays(ws, i);
              if (isInRange(dt) && monthDateMap[dt]) {
                monthDateMap[dt].forEach(item => { wTotal += item.amount; wItems.push(item); });
              }
            }
            const byType={};
            wItems.forEach(item=>{
              const key = item.label;
              if(!byType[key]) byType[key]={...item,count:0,total:0};
              byType[key].count++;byType[key].total+=item.amount;
            });
            return {ws,wTotal,byType,wDays:allWeeks[ws]};
          });

          const monthTotalRaw = Object.values(monthDateMap).flat().reduce((s, i) => s + i.amount, 0);
          // Apply the DHA portion of the header-carry adjustment. Header carry
          // values are per-BP, so only apply when a BP is selected. Meals,
          // day-off pay, and DVA are unaffected — only duty hours shift at
          // boundaries.
          const dhaRateForAdj = (role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO) * INDEX_YEARS[yearIdx].mult;
          const hm2hLocal = (s) => {
            if (!s || typeof s !== "string") return 0;
            const parts = s.trim().split(":").map(n => parseInt(n, 10));
            if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
            return parts[0] + parts[1] / 60;
          };
          const selectedBpForDha = rosterBPs.find(b => b.from === customFrom && b.to === customTo);
          const bpHdrDha = selectedBpForDha?.headerCarry;
          // Carried-out always applies; carried-in only to the extent this
          // roster does not already print it inside the BP window, which the
          // by-date sum would then already hold. See carriedInAddHrs().
          const headerDutyDeltaHrs = bpHdrDha
            ? carriedInAddHrs(bpHdrDha, "duty") - hm2hLocal(bpHdrDha.carriedOutDuty)
            : 0;
          const monthTotal = monthTotalRaw + headerDutyDeltaHrs * dhaRateForAdj;

          const monthByType={};
          Object.values(monthDateMap).flat().forEach(item=>{
            const isDHA = /Duty Hour Allowance/.test(item.label);
            const key = isDHA ? "Duty Hour Allowance" : item.label.replace(/\s*\((pre|post)-midnight\)\s*$/,"");
            if(!monthByType[key]) monthByType[key]={...item,label:key,count:0,total:0};
            monthByType[key].count++;
            monthByType[key].total+=item.amount;
          });
          const monthTypes=Object.values(monthByType).sort((a,b)=>b.total-a.total);

          // Build per-PATTERN data. Each entry day with sectors is one BP
          // pattern. A pattern is attributed to the bid period in which it
          // STARTS (its sign-on day), and its total is the FULL allowance for
          // the whole pattern across every date — not just the dollars that
          // happen to fall inside the viewed month. This is what "totals for
          // all patterns on the BP file" means, and it makes a boundary
          // pattern (one that spans two BPs) appear under exactly ONE bid
          // period, so loading two adjacent BP files never counts it twice.
          const trips = [];
          const seenPatternKeys = new Set();
          allWeeksToProcess.forEach(ws => {
            const wDays = allWeeks[ws];
            if (!wDays) return;
            DAY_NAMES.forEach((dn, di) => {
              const day = wDays[dn];
              if (!day || !day.sectors?.[0]?.aSignOn) return;
              const tripDate = weekDate(ws, di);
              // tripDate is the pattern's sign-on day (its entry-day key). Own
              // the pattern to the BP/month that contains that day. A pattern
              // that starts in the previous period but spills allowances into
              // this one is NOT this period's pattern, so it is skipped here.
              if (!isInRange(tripDate)) return;
              const byDate = calcAllowancesByDate(day, role, yearIdx, tripDate);
              // Full pattern total — every rated date, not clipped to range.
              const allItems = Object.values(byDate).reduce((acc, items) => acc.concat(items), []);
              if (allItems.length === 0) return;
              const tripTotal = allItems.reduce((s, i) => s + i.amount, 0);
              const secs = day.sectors;
              const first = secs[0], last = secs[secs.length - 1];
              const depPort = first?.depAirport || "";
              const arrPort = last?.arrAirport || "";
              const route = depPort && arrPort ? `${depPort} → ${arrPort}` : "";
              const secDates = secs.map(s => s.sectorDate).filter(Boolean).sort();
              const tripFrom = tripDate;
              const tripTo = secDates[secDates.length - 1] || tripDate;
              // De-dup guard: if the same boundary pattern is present in two
              // overlapping BP uploads, skip the repeat. (The parser already
              // merges same-day entries; this keys on start-date + route +
              // sector count as a belt-and-braces safety net.)
              const pKey = `${tripFrom}|${depPort}|${arrPort}|${secs.length}`;
              if (seenPatternKeys.has(pKey)) return;
              seenPatternKeys.add(pKey);
              trips.push({
                ws, dn, tripFrom, tripTo, route,
                depPort, arrPort,
                sectorCount: secs.length, tripTotal,
                isReserve: !!secs[0]?.reservePeriod,
                items: allItems,
              });
            });
          });
          trips.sort((a,b) => a.tripFrom.localeCompare(b.tripFrom));

          // Merge consecutive-day continuations. If day-B starts the day
          // after day-A ends AND day-B's departure airport is where day-A
          // ended AND that port is NOT day-A's original start (i.e. the
          // pilot has NOT returned to their base yet), day-B is really the
          // same trip — typically a mid-pattern ground school day at an
          // outstation. This keeps a BKK trip with CC/MS ground school days
          // showing as ONE trip line rather than four.
          {
            const merged = [];
            for (const trip of trips) {
              const prev = merged[merged.length - 1];
              const continues = prev && !prev.isReserve && !trip.isReserve
                && prev.arrPort && prev.arrPort === trip.depPort
                && addDays(prev.tripTo, 1) === trip.tripFrom
                && prev.arrPort !== prev.depPortRoot; // haven't returned to trip's origin
              if (continues) {
                prev.tripTo = trip.tripTo;
                prev.arrPort = trip.arrPort;
                prev.route = `${prev.depPort} → ${trip.arrPort}`;
                prev.sectorCount += trip.sectorCount;
                prev.tripTotal += trip.tripTotal;
                prev.items = prev.items.concat(trip.items);
              } else {
                merged.push({ ...trip, depPortRoot: trip.depPort });
              }
            }
            trips.length = 0;
            merged.forEach(m => trips.push(m));
          }

          // Aggregate items per trip into a display byType map (post-merge).
          trips.forEach(trip => {
            const tripByType = {};
            trip.items.forEach(item => {
              // For DHA items: collapse ALL variants (per-sector, continuous, pre/post-midnight)
              // into a single "Duty Hour Allowance" entry per trip.
              const isDHA = /Duty Hour Allowance/.test(item.label);
              const cleanLabel = isDHA
                ? "Duty Hour Allowance"
                : item.label.replace(/\s*\((pre|post)-midnight\)\s*$/,"");
              const key = cleanLabel;
              if (!tripByType[key]) tripByType[key] = {...item, label: cleanLabel, count: 0, total: 0};
              tripByType[key].count++;
              tripByType[key].total += item.amount;
            });
            trip.byType = Object.values(tripByType).sort((a,b)=>b.total-a.total);
            delete trip.items;
            delete trip.depPort;
            delete trip.arrPort;
            delete trip.depPortRoot;
          });

          // Build a flat list of DHA items across every duty in range (sectors, reserve, ground duties)
          const dhaItems = [];
          allWeeksToProcess.forEach(ws => {
            const wDays = allWeeks[ws];
            if (!wDays) return;
            DAY_NAMES.forEach((dn, di) => {
              const day = wDays[dn];
              if (!day || !day.sectors?.[0]?.aSignOn) return;
              const tripDate = weekDate(ws, di);
              if (!ownedByThisBp(tripDate)) return;
              const byDate = calcAllowancesByDate(day, role, yearIdx, tripDate);
              Object.entries(byDate).forEach(([dateStr, items]) => {
                if (!isInBaseRange(dateStr)) return;
                items.forEach(item => {
                  if (/Duty Hour Allowance/.test(item.label)) {
                    dhaItems.push({...item, date: dateStr});
                  }
                });
              });
            });
          });
          dhaItems.sort((a,b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
          const dhaTotalRaw = dhaItems.reduce((s,i) => s + i.amount, 0);
          // Apply the DHA portion of the header-carry adjustment for the
          // currently-selected BP (matches what monthTotal already includes).
          const dhaRateForItems = (role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO) * INDEX_YEARS[yearIdx].mult;
          const hm2hDha = (s) => {
            if (!s || typeof s !== "string") return 0;
            const parts = s.trim().split(":").map(n => parseInt(n, 10));
            if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
            return parts[0] + parts[1] / 60;
          };
          const selectedBpForItems = rosterBPs.find(b => b.from === customFrom && b.to === customTo);
          const bpHdrItems = selectedBpForItems?.headerCarry;
          const dhaCarryInHrs  = carriedInAddHrs(bpHdrItems, "duty");
          const dhaCarryOutHrs = bpHdrItems ? hm2hDha(bpHdrItems.carriedOutDuty) : 0;
          const dhaCarryDeltaHrs = dhaCarryInHrs - dhaCarryOutHrs;
          const dhaTotal = dhaTotalRaw + dhaCarryDeltaHrs * dhaRateForItems;

          // Build flat list of meal/incidental items in range AND group them
          // by hotel stay. One "stay" = one hotel record. Items are assigned:
          //   • Hotel meals (meal_b_<hi>/l_<hi>/d_<hi>)  → by hotel index
          //   • Ground-duty meals (meal_<x>_g<idx>)     → by sectorDate falling
          //         inside a hotel's [hotelFrom..hotelTo] window
          //   • Per-port incidentals (meal_i_<PORT>_<n>) → by incidental date
          //         falling inside a same-port hotel's window
          // Items that don't match any hotel (ground duty before/after the
          // hotel chain, or trips with no hotels) go in a fallback bucket so
          // they remain visible in the breakdown.
          const buildStays = (dateFilter, requireOwned) => {
          const mealItems = [];
          const stays = [];  // [{ key, label, ports, startDate, endDate, items, total }]
          allWeeksToProcess.forEach(ws => {
            const wDays = allWeeks[ws];
            if (!wDays) return;
            DAY_NAMES.forEach((dn, di) => {
              const day = wDays[dn];
              if (!day || !day.sectors?.[0]?.aSignOn) return;
              const tripDate = weekDate(ws, di);
              if (requireOwned && !mealStayOwned(tripDate)) return;
              const byDate = calcAllowancesByDate(day, role, yearIdx, tripDate);

              // Build buckets for each hotel + one "unassigned" bucket
              const hotelList = getHotels(day);
              const buckets = hotelList.map((h, hi) => ({
                key: `${tripDate}_h${hi}`,
                hi,
                hotel: h,
                port: (() => {
                  const sec = day.sectors[h.afterSectorIdx ?? 0];
                  return sec?.arrAirport || h.hotelFrom;
                })(),
                from: h.hotelFrom,
                to: h.hotelTo,
                items: [],
              }));
              const unassigned = { key: `${tripDate}_unassigned`, hi: -1, port: null, items: [] };

              // Helper: assign item to a hotel bucket by date+port
              const assignByDate = (item, date, port) => {
                // Prefer port-matching hotel
                if (port) {
                  const sameAirport = buckets.filter(b => b.port === port);
                  for (const b of sameAirport) {
                    if (date >= b.from && date <= b.to) return b.items.push(item);
                  }
                  if (sameAirport.length) return sameAirport[0].items.push(item);
                }
                // Otherwise any hotel whose window contains the date
                for (const b of buckets) {
                  if (date >= b.from && date <= b.to) return b.items.push(item);
                }
                unassigned.items.push(item);
              };

              Object.entries(byDate).forEach(([dateStr, items]) => {
                if (!dateFilter(dateStr)) return;
                items.forEach(item => {
                  if (!/meal_|Breakfast|Lunch|Dinner|Incidental/.test(item.id + item.label)) return;
                  const enriched = { ...item, date: dateStr };
                  mealItems.push(enriched);

                  // Hotel meal: id like meal_b_<hi>_<date>
                  const hotelMealMatch = item.id.match(/^meal_[bld]_(\d+)_/);
                  if (hotelMealMatch) {
                    const hi = parseInt(hotelMealMatch[1], 10);
                    if (buckets[hi]) {
                      buckets[hi].items.push(enriched);
                    } else {
                      unassigned.items.push(enriched);
                    }
                    return;
                  }

                  // Ground-duty meal: id like meal_<bld>_g<sectorIdx>_<date>
                  const groundMealMatch = item.id.match(/^meal_[bld]_g\d+_/);
                  if (groundMealMatch) {
                    assignByDate(enriched, dateStr, null);
                    return;
                  }

                  // Per-port incidental: id like meal_i_<PORT>_<n>_<idx>
                  const incMatch = item.id.match(/^meal_i_([A-Z]{3,4})_/);
                  if (incMatch) {
                    assignByDate(enriched, dateStr, incMatch[1]);
                    return;
                  }

                  // Fallback
                  assignByDate(enriched, dateStr, null);
                });
              });

              // Emit non-empty buckets as stays
              buckets.forEach(b => {
                if (b.items.length === 0) return;
                const dates = b.items.map(i => i.date).sort();
                stays.push({
                  key: b.key,
                  port: b.port,
                  label: b.port || "Hotel",
                  startDate: b.from || dates[0],
                  endDate: b.to || dates[dates.length - 1],
                  items: b.items,
                  total: b.items.reduce((s, i) => s + i.amount, 0),
                });
              });
              if (unassigned.items.length > 0) {
                const dates = unassigned.items.map(i => i.date).sort();
                stays.push({
                  key: unassigned.key,
                  port: null,
                  label: "Ground duties (no hotel)",
                  startDate: dates[0],
                  endDate: dates[dates.length - 1],
                  items: unassigned.items,
                  total: unassigned.items.reduce((s, i) => s + i.amount, 0),
                });
              }
            });
          });
          // Merge consecutive-day stays at the SAME port so multi-hotel slips
          // (e.g. BKK ground school split across CC and MS days each producing
          // a separate hotel bucket) present as one line "9 May – 12 May BKK".
          // Rule: if the next stay's startDate is within 1 day of prev's
          // endDate AND both are at the same port, combine. "Ground duties
          // (no hotel)" buckets (port === null) never merge.
          stays.sort((a,b) => a.startDate.localeCompare(b.startDate));
          {
            const mergedStays = [];
            for (const stay of stays) {
              const prev = mergedStays[mergedStays.length - 1];
              const canMerge = prev
                && prev.port && stay.port
                && prev.port === stay.port
                && daysBetween(prev.endDate, stay.startDate) <= 1;
              if (canMerge) {
                prev.endDate = stay.endDate > prev.endDate ? stay.endDate : prev.endDate;
                prev.items = prev.items.concat(stay.items);
                prev.total += stay.total;
              } else {
                mergedStays.push({ ...stay });
              }
            }
            stays.length = 0;
            mergedStays.forEach(s => stays.push(s));
          }
          mealItems.sort((a,b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
          return { mealItems, stays, mealTotal: mealItems.reduce((s,i) => s + i.amount, 0) };
          };
          // Under a BP chip the month list and Pay Check are the same grouping:
          // a stay belongs to the BP its pattern signs on in and keeps every one
          // of its meal dates, so TRIP TOTALS reads what payroll pays. A plain
          // calendar month has no sign-on rule, so it stays date-clipped.
          const { mealItems, stays, mealTotal } = buildStays(
            matchedBpForRange ? isInBaseRange : isInRange, !!matchedBpForRange);
          // Pay Check: the same stay grouping over the EXTENDED BP window, so a
          // stay checking out after the BP ends (hotel 11-13 Jul in a BP ending
          // 12 Jul) keeps its whole meal total - which is what payroll pays as a
          // single line. ownedByThisBp keeps the next BP's own trips out. Feeds
          // the Pay Check tab only; DHA and credit hours are untouched.
          const payStays = buildStays(isInBaseRange, true).stays;

          // Build flat list of credit hour items
          const creditItems = [];
          allWeeksToProcess.forEach(ws => {
            const wDays = allWeeks[ws];
            if (!wDays) return;
            DAY_NAMES.forEach((dn, di) => {
              const day = wDays[dn];
              if (!day || (!day.sectors?.[0]?.aSignOn && !day.sectors?.[0]?.isAnnualLeave)) return;
              const tripDate = weekDate(ws, di);
              if (!ownedByThisBp(tripDate)) return;
              // Track this day's credit so an OL13 reserve-activation floor of
              // 4h can be applied at the end if the natural credit falls short.
              const dayStartIdx = creditItems.length;
              let dayInRange = false;
              day.sectors.forEach((sec, si) => {
                const secDate = sec.sectorDate || tripDate;
                // Attribute credit by sectorDate. Cross-BP boundary shifts are
                // handled downstream by the Month/Roster totalizer applying
                // the roster header's Carried In/Out credit values.
                if (!isInBaseRange(secDate)) return;
                dayInRange = true;

                // CC, CCR and MD days attract DHA only (DHA is paid in
                // calcAllowancesByDate) — they earn NO credit hours, so they do
                // not count toward the 70h overtime threshold or flight pay.
                if (/^(CCR|CC|MD)\d*\b/i.test(sec.flightNo || "")) return;

                if (sec.isAnnualLeave) {
                  // Annual leave = flat 2.5h credit per day
                  creditItems.push({ date: secDate, label: "Annual Leave", credit: 2.5, type: "Leave" });
                } else if (sec.reservePeriod) {
                  // Reserve = flat 4h credit
                  creditItems.push({ date: secDate, label: sec.flightNo || "Reserve", credit: 4, type: "Reserve" });
                } else if (sec.isGroundDuty || /^(SIM|EF)\d*/i.test(sec.flightNo)) {
                  // SIM/EF and other ground duties = min(duty hours, 4)
                  const on = parseTime(sec.aSignOn), off = parseTime(sec.aSignOff);
                  if (on == null || off == null) return;
                  let mins = off - on; if (mins < 0) mins += 1440;
                  creditItems.push({ date: secDate, label: sec.flightNo, credit: Math.min(mins / 60, 4), type: "Ground" });
                } else {
                  // Flight sector — compute block time from flight dep/arr times.
                  // For sectors imported from a BP roster (`flightDepTime` set),
                  // we use those times directly. For MANUAL sectors we derive a
                  // notional block window from sign-on / sign-off:
                  //   • Operating: signOn + 60 min  →  signOff − 15 min
                  //   • Positioning/pax: signOn + 30 min → signOff − 15 min
                  const isManual = !sec.flightDepTime;
                  const preOffset = isManual ? (sec.isPositioning ? 30 : 60) : 0;
                  const postOffset = isManual ? 15 : 0;
                  const shiftHHMM = (hhmm, deltaMin) => {
                    const m = parseTime(hhmm);
                    if (m == null) return hhmm;
                    let t = m + deltaMin;
                    while (t < 0)    t += 1440;
                    while (t >= 1440) t -= 1440;
                    return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
                  };
                  const depTime = isManual
                    ? shiftHHMM(sec.aSignOn, +preOffset)
                    : sec.flightDepTime;
                  const arrTime = isManual
                    ? shiftHHMM(sec.aSignOff, -postOffset)
                    : sec.flightArrTime;
                  const depCode = sec.depAirport, arrCode = sec.arrAirport;
                  if (!depTime || !arrTime || !depCode || !arrCode) return;
                  const depAp = AIRPORTS.find(a => a.code === depCode);
                  const arrAp = AIRPORTS.find(a => a.code === arrCode);
                  if (!depAp || !arrAp) return;
                  const depMin = parseTime(depTime), arrMin = parseTime(arrTime);
                  if (depMin == null || arrMin == null) return;
                  // Convert to UTC using DST-aware offsets
                  const depOffsetH = getUtcOffsetHours(depCode, sec.flightDepDate || secDate);
                  const arrOffsetH = getUtcOffsetHours(arrCode, sec.flightDepDate || secDate);
                  const depUtc = depMin - depOffsetH * 60;
                  const arrUtc = arrMin - arrOffsetH * 60;
                  let blockMins = arrUtc - depUtc;
                  if (blockMins < 0) blockMins += 1440;
                  const blockHrs = blockMins / 60;
                  const mult = sec.isPositioning ? 0.5 : 1.0;
                  const credit = blockHrs * mult;
                  const tag = sec.isPositioning ? " (pax 0.5×)" : "";
                  creditItems.push({
                    date: secDate,
                    label: `${sec.flightNo} ${depCode}→${arrCode}${tag}`,
                    credit,
                    type: sec.isPositioning ? "Positioning" : "Operating",
                    blockHrs,
                  });
                }
              });
              // OL13 reserve activation: bump this day's credit to 4h if the
              // natural sum is below the floor. Booked as a synthetic reserve
              // item so the user can see why the bump appears in the breakdown.
              if (day.ol13Reserve && dayInRange) {
                const daySum = creditItems.slice(dayStartIdx)
                  .reduce((s, it) => s + it.credit, 0);
                if (daySum < 4) {
                  creditItems.push({
                    date: tripDate,
                    label: "OL13 Reserve activation (4h floor)",
                    credit: 4 - daySum,
                    type: "Reserve",
                  });
                }
              }
            });
          });
          creditItems.sort((a,b) => a.date.localeCompare(b.date));
          const creditTotalRaw = creditItems.reduce((s,i) => s + i.credit, 0);
          // Apply Qantas's authoritative boundary-attribution values from the
          // roster header of the currently-selected BP (if any). CIn − COut
          // shifts hours into/out of this BP for pay purposes; sectors we
          // attribute by raw sectorDate get corrected here.
          const hm2h = (s) => {
            if (!s || typeof s !== "string") return 0;
            const parts = s.trim().split(":").map(n => parseInt(n, 10));
            if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
            return parts[0] + parts[1] / 60;
          };
          const selectedBpEntry = rosterBPs.find(b => b.from === customFrom && b.to === customTo);
          const bpHdr = selectedBpEntry?.headerCarry;
          const creditCarryInHrs  = carriedInAddHrs(bpHdr, "credit");
          const headerDutyDelta   = bpHdr ? carriedInAddHrs(bpHdr, "duty") - hm2h(bpHdr.carriedOutDuty)   : 0;
          const headerCreditDelta = bpHdr ? creditCarryInHrs              - hm2h(bpHdr.carriedOutCredit) : 0;
          const creditTotal = creditTotalRaw + headerCreditDelta;
          // Overtime hours and hourly rate are rounded to 2 dp before multiplying
          // so the displayed values (e.g. "3.87h × $231.85/h = $897.26") reconcile.
          // See the detail panel further down — same rounding applied there.
          const overtimeHrs = creditTotal > 70 ? Math.round((creditTotal - 70) * 100) / 100 : 0;
          // Derive the effective YOS for THIS view's date range. The static
          // `yos` state is set at upload time and reflects whichever roster
          // file was processed last — which is wrong when multiple BPs span
          // the 1 Jan 2026 freeze date: clicking a pre-freeze BP shouldn't
          // pay OT at the post-freeze bumped salary. We re-derive based on
          // the matched pilot's join date and the current range here.
          //   • Past BP (range ends before today) → use range start
          //   • Current/future BP                → use today
          //   • Custom range (no matching BP)    → use range start, same rule
          const todayISO = new Date().toISOString().slice(0, 10);
          const effRefDate = (customTo && customTo < todayISO)
            ? (customFrom || todayISO)
            : todayISO;
          const effectiveYos = pilotJoiningDate
            ? computeYosTier(pilotJoiningDate, effRefDate, role)
            : yos;
          const useYos = effectiveYos >= 0 ? effectiveYos : yos;
          const overtimePay = (overtimeHrs > 0 && useYos >= 0)
            ? overtimeHrs * (Math.round((SALARY[aircraft][role][useYos][yearIdx] / 750) * 100) / 100)
            : 0;
          // Overtime is only meaningful over a whole BP (the 70h threshold is a
          // per-BP figure). Include it in the headline total only when a BP is
          // selected (custom range exactly matches one of the uploaded BPs).
          // Hide it for arbitrary custom ranges or month views — otherwise the
          // total would be misleading.
          const isBpSelected = useCustom && rosterBPs.some(b => b.from === customFrom && b.to === customTo);
          const includeOvertime = isBpSelected;
          const monthGrandTotal = monthTotal + (includeOvertime ? overtimePay : 0);
          return { mvYear, mvMonth, monthName, useCustom, rangeFrom, rangeTo, rangeLabel,
                   weeksInRange, monthTotal, monthTypes, trips, monthDateMap,
                   dhaItems, dhaTotal, dhaCarryDeltaHrs, dhaCarryInHrs, dhaRateForItems,
                   mealItems, mealTotal, stays, payStays,
                   creditItems, creditTotal, headerCreditDelta, creditCarryInHrs, bpHdr,
                   overtimeHrs, overtimePay, effectiveYos, useYos,
                   selectedBpForItems, bpHdrItems,
                   isBpSelected, includeOvertime, monthGrandTotal };
}

// ─── Pay Check ────────────────────────────────────────────────────────────────
// Compare the figures typed off a payslip against what derivePeriod computed
// for the same bid period.
//
// A "CR MEALS ATO" line is one hotel stay, identified by the date span payroll
// prints on it (check-in date / check-out date; a same-day slip prints one
// date). We match on that span, so this reads `payStays` — the stay grouping
// taken over the extended BP window — rather than the month view's `stays`,
// which clips at the BP end and would under-report a trip that checks out
// after the period closes.
const PC_DAY_OFF = /^(ddo|extra_ddo|ddo_rp)/;
const PC_DVA     = /^(dva|extra_dva|dva_rp)/;
let _payRowId = 0;

const emptyPaySlip = () => ({ dha:"", overtime:"", meals:[], callIns:[], dvas:[] });

function pcMoney(s) {
  if (s == null || String(s).trim() === "") return null;
  const n = parseFloat(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ─── Payslip PDF reader ───────────────────────────────────────────────────────
// Reads the earnings table straight out of a payslip PDF, entirely in the
// browser — the file is never uploaded anywhere. A Qantas payslip is generated
// text (not a scan), so the words are in the file and no OCR is involved.
//
// PDF lays text out by position, not by row: each string carries its own
// coordinates. So we replay the text operators to get (x, y, text), bucket by
// y into visual rows, sort each row by x, and read the columns off that.

// PDF "FlateDecode" is zlib, which DecompressionStream("deflate") handles.
// Some writers emit raw deflate instead, so fall back to that.
async function pcInflate(bytes) {
  for (const fmt of ["deflate", "deflate-raw"]) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch { /* try the next format */ }
  }
  return null;
}

// Minimal content-stream tokenizer. Only what text extraction needs: numbers,
// (strings) with escapes and balanced parens, [arrays], /names and operators.
function pcTokens(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "(") {                                   // string
      let depth = 1, j = i + 1, buf = "";
      while (j < s.length && depth > 0) {
        const ch = s[j];
        if (ch === "\\") {
          const n = s[j + 1];
          const esc = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
          if (n in esc) { buf += esc[n]; j += 2; }
          else if (n >= "0" && n <= "7") {             // \ddd octal
            const m = s.slice(j + 1).match(/^[0-7]{1,3}/)[0];
            buf += String.fromCharCode(parseInt(m, 8)); j += 1 + m.length;
          } else { buf += n; j += 2; }
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")") { depth--; if (depth === 0) { j++; break; } }
        buf += ch; j++;
      }
      out.push({ k: "str", v: buf }); i = j; continue;
    }
    if (c === "<" && s[i + 1] === "<") { out.push({ k: "op", v: "<<" }); i += 2; continue; }
    if (c === ">" && s[i + 1] === ">") { out.push({ k: "op", v: ">>" }); i += 2; continue; }
    if (c === "<") {                                   // <hex> string
      const j = s.indexOf(">", i);
      const hex = s.slice(i + 1, j < 0 ? s.length : j).replace(/\s/g, "");
      let buf = "";
      for (let h = 0; h + 1 < hex.length; h += 2) buf += String.fromCharCode(parseInt(hex.substr(h, 2), 16));
      out.push({ k: "str", v: buf }); i = (j < 0 ? s.length : j + 1); continue;
    }
    if (c === "[" || c === "]") { out.push({ k: c }); i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < s.length && s[i] !== "\n") i++; continue; }
    const rest = s.slice(i);
    let m = rest.match(/^[-+]?[\d.]+/);
    if (m && /\d/.test(m[0])) { out.push({ k: "num", v: parseFloat(m[0]) }); i += m[0].length; continue; }
    m = rest.match(/^\/[^\s/[\]()<>]*/);
    if (m) { out.push({ k: "name", v: m[0] }); i += m[0].length; continue; }
    m = rest.match(/^[A-Za-z'"*][A-Za-z0-9*'"]*/);
    if (m) { out.push({ k: "op", v: m[0] }); i += m[0].length; continue; }
    i++;                                               // unknown byte, skip
  }
  return out;
}

// Replay the text operators, emitting one entry per drawn string.
function pcPlaceText(content) {
  const toks = pcTokens(content);
  const items = [];
  let x = 0, y = 0, lx = 0, ly = 0, leading = 0;
  const stack = [];
  const emit = (t) => { if (t.trim()) items.push({ x, y, t }); };
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.k === "[") { stack.length = 0; continue; }
    if (tk.k === "num" || tk.k === "str") { stack.push(tk); continue; }
    if (tk.k !== "op") continue;
    const nums = stack.filter(s => s.k === "num").map(s => s.v);
    const strs = stack.filter(s => s.k === "str").map(s => s.v);
    switch (tk.v) {
      case "BT": x = y = lx = ly = 0; break;
      case "Tm": if (nums.length >= 6) { lx = x = nums[nums.length-2]; ly = y = nums[nums.length-1]; } break;
      case "TD": if (nums.length >= 2) leading = -nums[nums.length-1];  // falls through
      case "Td": if (nums.length >= 2) { lx += nums[nums.length-2]; ly += nums[nums.length-1]; x = lx; y = ly; } break;
      case "TL": if (nums.length) leading = nums[nums.length-1]; break;
      case "T*": ly -= leading; x = lx; y = ly; break;
      case "Tj": case "'": case "\"":
        if (tk.v !== "Tj") { ly -= leading; x = lx; y = ly; }
        if (strs.length) emit(strs[strs.length-1]);
        break;
      case "TJ": emit(strs.join("")); break;   // kerning offsets don't matter here
      default: break;
    }
    stack.length = 0;
  }
  return items;
}

// Pull every inflatable stream out of the PDF and turn it into visual rows.
async function pcPdfRows(buffer) {
  const bytes = new Uint8Array(buffer);
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  if (!raw.startsWith("%PDF")) throw new Error("that doesn't look like a PDF");
  if (/\/Encrypt\b/.test(raw)) throw new Error("this PDF is password-protected");

  const items = [];
  // The keyword must not be the tail of "endstream", or each match would land
  // inside the previous stream's terminator and the real content be skipped.
  const re = /(?:^|[^A-Za-z])stream\r?\n?/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const dict = raw.slice(Math.max(0, m.index - 400), m.index);
    // The span up to "endstream" usually carries a trailing EOL, which
    // DecompressionStream rejects as trailing junk. Prefer the declared
    // /Length (ignoring indirect "N 0 R" forms) and fall back to trimming.
    let stop = end;
    const lm = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    if (lm) {
      const declared = start + parseInt(lm[1], 10);
      if (declared > start && declared <= end) stop = declared;
    }
    while (stop > start && /[\s\0]/.test(raw[stop - 1])) stop--;
    let text = null;
    if (/\/FlateDecode/.test(dict)) {
      const out = await pcInflate(bytes.subarray(start, stop));
      if (out) text = new TextDecoder("latin1").decode(out);
    } else {
      text = raw.slice(start, stop);                   // uncompressed content stream
    }
    if (text && /\bT[jJ]\b/.test(text)) items.push(...pcPlaceText(text));
    re.lastIndex = end + "endstream".length;
  }
  if (!items.length) throw new Error("no readable text — this PDF may be a scan or an image");

  // Bucket into rows: same visual line if the baselines are within 2 units.
  const rows = [];
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of items) {
    const row = rows.find(r => Math.abs(r.y - it.y) <= 2);
    if (row) row.cells.push(it); else rows.push({ y: it.y, cells: [it] });
  }
  rows.forEach(r => r.cells.sort((a, b) => a.x - b.x));
  return rows;
}

// Earnings codes we can reconcile. Anything else on the payslip is ignored.
const PC_CODES = [
  { re: /^DUTY\s*HOUR/i,               kind: "dha" },
  { re: /^CR\s*MEALS/i,                kind: "meal" },
  { re: /^CALL\s*IN\b/i,               kind: "callIn" },
  { re: /^(DAY\s*OFF|DDO)\b/i,         kind: "callIn" },
  { re: /^(DUTY\s*VAR|DVA)\b/i,        kind: "dva" },
  { re: /^(OVERTIME|O\/?TIME|OT)\b/i,  kind: "overtime" },
];
const PC_DATE = /^(\d{2})-(\d{2})-(\d{2})$/;

// DD-MM-YY as printed on the payslip → the ISO dates the calculator uses.
function pcDate(s) {
  const m = String(s).trim().replace(/^\/\s*/, "").match(PC_DATE);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : null;
}

function pcParsePayslip(rows) {
  const out = { meals: [], callIns: [], dvas: [], dha: null, overtime: null, periodEnd: null, ignored: [] };
  for (const row of rows) {
    const cells = row.cells.map(c => c.t.trim()).filter(Boolean);
    if (!cells.length) continue;

    const pe = cells.join(" ").match(/PERIOD ENDING\s+(\d{2}-\d{2}-\d{2})/i);
    if (pe) out.periodEnd = pcDate(pe[1]);

    // A payslip prints two columns side by side, so a single visual row can
    // hold an earnings line AND unrelated text from the other column at the
    // same height. Locate the code cells by position and read only the cells
    // to the right of each, up to wherever the next code starts.
    const marks = [];
    cells.forEach((t, i) => {
      const hit = PC_CODES.find(c => c.re.test(t));
      if (hit) marks.push({ i, kind: hit.kind });
    });
    if (!marks.length) {
      const code = cells[0];
      if (/^[A-Z][A-Z &/.-]{2,}$/.test(code) && cells.some(c => pcMoney(c) != null))
        out.ignored.push(code);
      continue;
    }
    marks.forEach((mk, mi) => {
      const seg = cells.slice(mk.i + 1, mi + 1 < marks.length ? marks[mi + 1].i : cells.length);
      const dates = seg.map(pcDate).filter(Boolean);
      // The amount is the rightmost money value that isn't a date.
      let amount = null;
      for (let i = seg.length - 1; i >= 0; i--) {
        if (PC_DATE.test(seg[i].replace(/^\/\s*/, ""))) continue;
        const v = pcMoney(seg[i]);
        if (v != null) { amount = v; break; }
      }
      if (amount == null) return;
      const amt = amount.toFixed(2);
      if (mk.kind === "meal")          out.meals.push({ from: dates[0] || "", to: dates[1] || "", amount: amt });
      else if (mk.kind === "callIn")   out.callIns.push({ date: dates[0] || "", amount: amt });
      else if (mk.kind === "dva")      out.dvas.push({ date: dates[0] || "", amount: amt });
      else if (mk.kind === "dha")      out.dha = { amount: amt, from: dates[0] || "", to: dates[1] || "" };
      else if (mk.kind === "overtime") out.overtime = { amount: amt };
    });
  }
  return out;
}

function derivePayCheck(paySlip, d) {
  // Sub-cent differences are float noise, not a payroll error.
  const differs = (a, b) => Math.abs(a - b) >= 0.005;
  const cmp = (paid, calc) => ({ paid, calc, delta: paid - calc, off: differs(paid, calc) });

  // ── Meals: payslip line ↔ hotel stay ──
  const stays = (d.payStays || []).map((s, i) => ({ ...s, _i: i }));
  const taken = new Set();
  const mealRows = (paySlip.meals || []).map(line => {
    const paid = pcMoney(line.amount);
    const from = line.from, to = line.to || line.from;
    // Exact span first — the normal case, and unambiguous.
    let stay = stays.find(s => !taken.has(s._i) && s.startDate === from && s.endDate === to);
    if (!stay && from) {
      // Otherwise the unclaimed stay overlapping this line by the most days.
      let best = null, bestOverlap = 0;
      for (const s of stays) {
        if (taken.has(s._i)) continue;
        const lo = s.startDate > from ? s.startDate : from;
        const hi = s.endDate < to ? s.endDate : to;
        if (lo > hi) continue;
        const overlap = daysBetween(lo, hi) + 1;
        if (overlap > bestOverlap) { bestOverlap = overlap; best = s; }
      }
      stay = best;
    }
    if (stay) taken.add(stay._i);
    return {
      id: line.id, from, to, paid, stay,
      ...(stay && paid != null ? cmp(paid, stay.total) : { calc: stay ? stay.total : null, delta: null, off: false }),
    };
  });
  const unmatchedStays = stays.filter(s => !taken.has(s._i));

  // ── Dated one-off items (day off / call-in, DVA) ──
  const itemsById = (re) => {
    const out = [];
    Object.entries(d.monthDateMap || {}).forEach(([date, items]) => {
      items.forEach(it => { if (re.test(it.id)) out.push({ ...it, date }); });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };
  const matchDated = (lines, calcItems) => {
    const used = new Set();
    const rows = (lines || []).map(line => {
      const paid = pcMoney(line.amount);
      let idx = calcItems.findIndex((it, i) => !used.has(i) && it.date === line.date);
      // Payroll sometimes dates one of these a day either side of the pattern
      // it belongs to, so allow a near miss — but never pair across the period.
      if (idx < 0 && line.date) {
        let best = -1, bestGap = 3;
        calcItems.forEach((it, i) => {
          if (used.has(i)) return;
          const gap = Math.abs(daysBetween(it.date < line.date ? it.date : line.date,
                                           it.date < line.date ? line.date : it.date));
          if (gap <= bestGap) { bestGap = gap; best = i; }
        });
        idx = best;
      }
      const item = idx >= 0 ? calcItems[idx] : null;
      if (idx >= 0) used.add(idx);
      return {
        id: line.id, date: line.date, paid, item,
        ...(item && paid != null ? cmp(paid, item.amount)
          : paid != null ? cmp(paid, 0) : { calc: item ? item.amount : 0, delta: null, off: false }),
      };
    });
    return { rows, unmatched: calcItems.filter((_, i) => !used.has(i)) };
  };

  const dayOffCalc = itemsById(PC_DAY_OFF);
  const dvaCalc    = itemsById(PC_DVA);
  const callIns = matchDated(paySlip.callIns, dayOffCalc);
  const dvas    = matchDated(paySlip.dvas,    dvaCalc);

  const dhaPaid = pcMoney(paySlip.dha);
  const otPaid  = pcMoney(paySlip.overtime);
  const dha = dhaPaid != null ? cmp(dhaPaid, d.dhaTotal)   : null;
  const ot  = otPaid  != null ? cmp(otPaid,  d.overtimePay) : null;

  const sum = (ns) => ns.reduce((a, b) => a + b, 0);
  const paidTotal = sum([
    ...mealRows.map(r => r.paid || 0), ...callIns.rows.map(r => r.paid || 0),
    ...dvas.rows.map(r => r.paid || 0), dhaPaid || 0, otPaid || 0,
  ]);
  // Only count the app's side of lines the payslip actually declared, so the
  // grand total compares like with like.
  const calcTotal = sum([
    ...mealRows.map(r => (r.stay ? r.stay.total : 0)),
    ...unmatchedStays.map(s => s.total),
    ...callIns.rows.map(r => (r.item ? r.item.amount : 0)),
    ...callIns.unmatched.map(i => i.amount),
    ...dvas.rows.map(r => (r.item ? r.item.amount : 0)),
    ...dvas.unmatched.map(i => i.amount),
    dhaPaid != null ? d.dhaTotal : 0,
    otPaid  != null ? d.overtimePay : 0,
  ]);

  const anyInput = mealRows.length || callIns.rows.length || dvas.rows.length
    || dhaPaid != null || otPaid != null;
  return {
    mealRows, unmatchedStays, callIns, dvas, dha, ot, anyInput,
    paidTotal, calcTotal, delta: paidTotal - calcTotal,
    off: differs(paidTotal, calcTotal),
    // Expected one-off lines for this BP (day-off / call-in and DVA), exposed
    // so the PAY CHECK tab can render the "expected payslip" preview without
    // recomputing them.
    dayOffCalc, dvaCalc,
  };
}

export default function App() {
  const today=new Date().toISOString().slice(0,10);
  const [weekStart,setWeekStart]=useState(()=>getMon(today));
  const [role,setRole]=useState("cpt");
  const [aircraft,setAircraft]=useState("a330");
  const [yos,setYos]=useState(-1); // -1 = not selected
  // Joining date captured at upload time. Used to re-derive `yos` dynamically
  // when the user switches between BPs that span the EA 1 Jan 2026 freeze
  // date — so a pre-2026 BP shows the actual (un-bumped) bracket and a
  // post-2026 BP shows the bumped bracket, both based on the matched pilot's
  // join date rather than whatever YOS was last set at upload.
  const [pilotJoiningDate,setPilotJoiningDate]=useState(null);
  const [yearIdx,setYearIdx]=useState(0);
  // allWeeks: { [weekStartStr]: { MON:..., TUE:..., ... } }
  const [allWeeks,setAllWeeks]=useState(()=>({[getMon(today)]:{...Object.fromEntries(DAY_NAMES.map(k=>[k,emptyDay()]))}}));
  const [active,setActive]=useState("MON");
  const [tab,setTab]=useState("entry");
  // Day/night theme — a display preference only, mirroring the bid optimiser:
  // the toggle flips data-theme on <html>, which the CSS reads. Until the
  // reader picks a side the OS preference wins, and nothing is persisted, so a
  // reload returns to whatever the OS prefers.
  const [themeDark,setThemeDark]=useState(()=>
    typeof window!=="undefined" && !!window.matchMedia
      && window.matchMedia("(prefers-color-scheme:dark)").matches);
  useEffect(()=>{
    if(typeof window==="undefined" || !window.matchMedia) return;
    const mq=window.matchMedia("(prefers-color-scheme:dark)");
    const onChange=()=>{ if(!document.documentElement.getAttribute("data-theme")) setThemeDark(mq.matches); };
    mq.addEventListener("change",onChange);
    return ()=>mq.removeEventListener("change",onChange);
  },[]);
  const toggleTheme=()=>{
    const next=!themeDark;
    document.documentElement.setAttribute("data-theme",next?"dark":"light");
    setThemeDark(next);
  };
  const [showHelp,setShowHelp]=useState(false);
  const [clock,setClock]=useState(new Date());
  const [confirmReset,setConfirmReset]=useState(false);
  const [confirmClearRoster,setConfirmClearRoster]=useState(false);
  // monthView: "YYYY-MM" string for the monthly summary
  const [monthView,setMonthView]=useState(()=>today.slice(0,7));
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  // Stored bid periods from roster uploads: [{bp, from, to}, ...]
  const [rosterBPs,setRosterBPs]=useState([]);
  const [showTypeBreakdown,setShowTypeBreakdown]=useState(false);
  const [showDhaList,setShowDhaList]=useState(false);
  const [showStayList,setShowStayList]=useState(false);
  const [showMealList,setShowMealList]=useState(false);
  const [showCreditHours,setShowCreditHours]=useState(false);
  const [showRosterView,setShowRosterView]=useState(false);
  const [mealRateYear,setMealRateYear]=useState(0);
  // What the payslip actually paid, for the Pay Check tab. Not persisted —
  // nothing in this app is, and a saved payslip would outlive its roster.
  const [paySlip,setPaySlip]=useState(emptyPaySlip);
  const [payPdf,setPayPdf]=useState(null);   // {busy|ok|err, …} — PDF read result
  const [confirmClearPay,setConfirmClearPay]=useState(false);

  // Drop everything read from or typed into a payslip. Called on its own from
  // PAY CHECK, and by clearRoster so 🗑 CLEAR leaves no pay data behind.
  function clearPaySlip() {
    setPaySlip(emptyPaySlip());
    setPayPdf(null);
    setConfirmClearPay(false);
  }

  // Read the earnings table straight out of a payslip PDF. Everything happens
  // in the browser: the file is read with FileReader/arrayBuffer and parsed
  // here — it is never sent anywhere.
  async function handlePayslipUpload(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    setPayPdf({ busy:true, name:file.name });
    try {
      if (typeof DecompressionStream === "undefined")
        throw new Error("this browser can't decompress PDFs — enter the lines by hand");
      const parsed = pcParsePayslip(await pcPdfRows(await file.arrayBuffer()));
      const found = parsed.meals.length + parsed.callIns.length + parsed.dvas.length
                  + (parsed.dha?1:0) + (parsed.overtime?1:0);
      if (!found) throw new Error("no earnings lines recognised — is this a Qantas payslip?");
      setPaySlip({
        dha:      parsed.dha ? parsed.dha.amount : "",
        overtime: parsed.overtime ? parsed.overtime.amount : "",
        meals:    parsed.meals.map(m=>({id:`p${++_payRowId}`,from:m.from,to:m.to,amount:m.amount})),
        callIns:  parsed.callIns.map(c=>({id:`p${++_payRowId}`,date:c.date,amount:c.amount})),
        dvas:     parsed.dvas.map(c=>({id:`p${++_payRowId}`,date:c.date,amount:c.amount})),
      });
      // The DUTY HOUR AL line states the bid period it paid for, so the right
      // BP can be selected automatically instead of hunting for the chip.
      let picked = null;
      if (parsed.dha && parsed.dha.from && parsed.dha.to) {
        const bp = rosterBPs.find(b=>b.from===parsed.dha.from && b.to===parsed.dha.to);
        if (bp) {
          setCustomFrom(bp.from); setCustomTo(bp.to);
          setMonthView(bp.from.slice(0,7)); setYearIdx(ebaYearIdxForDate(bp.from));
          picked = bp.bp;
        }
      }
      setPayPdf({ ok:true, name:file.name, periodEnd:parsed.periodEnd, picked,
                  dhaPeriod: parsed.dha && parsed.dha.from ? [parsed.dha.from, parsed.dha.to] : null,
                  counts:{ meals:parsed.meals.length, callIns:parsed.callIns.length,
                           dvas:parsed.dvas.length, dha:!!parsed.dha, overtime:!!parsed.overtime },
                  ignored:[...new Set(parsed.ignored)] });
    } catch (err) {
      setPayPdf({ err: (err && err.message) || "could not read that PDF", name:file.name });
    }
  }

  const setPayField = (field,val) => setPaySlip(p=>({...p,[field]:val}));
  const addPayRow = (listKey,row) => setPaySlip(p=>({...p,[listKey]:[...p[listKey],{id:`p${++_payRowId}`,...row}]}));
  const updPayRow = (listKey,id,field,val) =>
    setPaySlip(p=>({...p,[listKey]:p[listKey].map(r=>r.id===id?{...r,[field]:val}:r)}));
  const removePayRow = (listKey,id) =>
    setPaySlip(p=>({...p,[listKey]:p[listKey].filter(r=>r.id!==id)}));

  // Current week's days
  const days = allWeeks[weekStart] ?? Object.fromEntries(DAY_NAMES.map(k=>[k,emptyDay()]));
  function setDays(updater) {
    setAllWeeks(prev=>{
      const cur = prev[weekStart] ?? Object.fromEntries(DAY_NAMES.map(k=>[k,emptyDay()]));
      const next = typeof updater==="function" ? updater(cur) : updater;
      return {...prev,[weekStart]:next};
    });
  }

  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t);},[]);

  function dateFor(idx) { return weekDate(weekStart,idx); }
  function dateForName(name) { return dateFor(DAY_NAMES.indexOf(name)); }

  // Day updaters
  function updDay(key,field,val) { setDays(p=>({...p,[key]:{...p[key],[field]:val}})); }

  function updSector(dayKey,secId,field,val) {
    setDays(p=>{
      const day={...p[dayKey]};
      const sectors=day.sectors.map(s=>s.id===secId?{...s,[field]:val}:s);
      const updatedSecIdx = sectors.findIndex(s => s.id === secId);

      // Auto-advance NEXT sector's date when this sector's sign-off crosses midnight.
      // Applies to any sector, not just sector 1. Only runs when sign-off is being updated.
      if (field === "aSignOff" && updatedSecIdx >= 0 && updatedSecIdx < sectors.length - 1) {
        const thisSec = sectors[updatedSecIdx];
        const nextSec = sectors[updatedSecIdx + 1];
        const onMin = parseTime(thisSec.aSignOn);
        const offMin = parseTime(val);
        if (onMin != null && offMin != null && offMin < onMin) {
          // Crossed midnight — compute the day after this sector's date
          const thisDate = thisSec.sectorDate || dateForName(dayKey);
          const nextDate = addDays(thisDate, 1);
          // Only overwrite if next sector doesn't have an explicit date OR it matches the current default
          sectors[updatedSecIdx + 1] = { ...nextSec, sectorDate: nextDate };
        }
      }

      // Auto-fill hotel check-in/check-out across all hotels
      const existingHotels = getHotels(day);
      if (existingHotels.length > 0) {
        const updatedHotels = existingHotels.map(h => {
          const beforeSec = sectors[h.afterSectorIdx];
          const afterSec = sectors[h.afterSectorIdx + 1];
          let updated = {...h};
          // Sector immediately BEFORE this hotel updated its sign-off
          if (beforeSec && beforeSec.id === secId && field === "aSignOff") {
            const signOff = val || "";
            const signOn = beforeSec.aSignOn || "";
            updated.hotelCheckIn = signOff;
            const secDate = beforeSec.sectorDate || dateForName(dayKey);
            updated.hotelFrom = hotelCheckInDate(secDate, signOn, signOff);
          }
          // Sector immediately AFTER this hotel updated its sign-on
          if (afterSec && afterSec.id === secId && field === "aSignOn") {
            updated.hotelCheckOut = val || "";
          }
          return updated;
        });
        day.hotels = updatedHotels;
        day.hotelFrom = ""; day.hotelTo = "";
        day.hotelCheckIn = ""; day.hotelCheckOut = "";
        day.hotelAfterSectorIdx = null;
      }
      return {...p,[dayKey]:{...day,sectors}};
    });
  }

  function addSector(dayKey) {
    setDays(p=>{
      const day=p[dayKey];
      const last=day.sectors[day.sectors.length-1];
      // New sector: dep = last arr (chain the route)
      const ns=newSector(last?.arrAirport||"");
      return {...p,[dayKey]:{...day,sectors:[...day.sectors,ns]}};
    });
  }

  function insertSectorAt(dayKey, afterIdx) {
    setDays(p=>{
      const day=p[dayKey];
      const before=day.sectors[afterIdx];
      const after=day.sectors[afterIdx+1];
      // New connecting sector between before and after
      const ns=newSector(before?.arrAirport||"",after?.depAirport||"");
      const sectors=[...day.sectors.slice(0,afterIdx+1),ns,...day.sectors.slice(afterIdx+1)];
      return {...p,[dayKey]:{...day,sectors}};
    });
  }

  function removeSector(dayKey,secId) {
    setDays(p=>{
      const day=p[dayKey];
      if(day.sectors.length<=1) return p;
      const sectors=day.sectors.filter(s=>s.id!==secId);
      return {...p,[dayKey]:{...day,sectors}};
    });
  }

  // Upload one or more BP roster files. Files can be uploaded in any order:
  // they're parsed concurrently, merged, then the view is anchored on the
  // EARLIEST roster's start date so that uploading BP3745 + BP3741 always
  // displays BP3741 first regardless of selection order.
  function handleRosterUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    function readFile(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ file, text: e.target.result });
        reader.onerror = () => resolve({ file, text: null, error: reader.error });
        reader.readAsText(file);
      });
    }

    Promise.all(files.map(readFile)).then(results => {
      let mergedWeeks = {};
      let earliestFrom = null;
      let latestTo = null;
      let earliestWeekStart = null;
      let lastDetectedRole = null;
      let lastDetectedAircraft = null;
      let lastDetectedYos = -1;
      let lastDetectedJoiningDate = null;
      const newBpEntries = [];
      const allErrors = [];
      let totalWeeks = 0;
      let parsedFileCount = 0;
      const failedFiles = [];

      for (const { file, text, error } of results) {
        if (!text) {
          failedFiles.push(`${file.name}: ${error?.message || "could not read file"}`);
          continue;
        }
        try {
          const { weeks, firstWeekStart, rangeFrom, rangeTo, detectedRole, detectedAircraft, detectedYos, detectedJoiningDate, detectedBP, headerCarry, errors } = parseQantasRoster(text);
          if (errors && errors.length) allErrors.push(...errors.map(e => `[${file.name}] ${e}`));
          const wkCount = Object.keys(weeks).length;
          if (wkCount === 0) {
            failedFiles.push(`${file.name}: no trips parsed`);
            continue;
          }
          parsedFileCount++;
          totalWeeks += wkCount;
          // Strip "preview" weeks that fall entirely outside this roster's
          // own range. Qantas roster printouts include preview rows for trips
          // beyond the BP boundary; these are PLACEHOLDER versions that the
          // NEXT bid period's roster will provide authoritatively. When two
          // BPs are uploaded together, preview rows from BP-N would otherwise
          // leak into BP-(N+1)'s allowance totals.
          //
          // Rule: a day is preview-only if EVERY one of its sectors has a date
          // strictly past rangeTo. This drops standalone after-range trip
          // placeholders (e.g. 1-7 Oct CCs at BNE in BP3571's parse) while
          // preserving:
          //   • Trips starting inside the range that spill past it (e.g. a
          //     Sat 9 Sep trip with sectors continuing into 11-12 Sep — kept
          //     in BP3571's view as a continuation)
          //   • Trips starting before the range that spill into it (e.g. the
          //     same trip viewed from BP3575's printout — kept in BP3575's
          //     view so its in-range portion isn't lost when only BP3575 is
          //     uploaded)
          const stripped = {};
          if (rangeFrom && rangeTo) {
            Object.entries(weeks).forEach(([ws, days]) => {
              const filteredDays = {};
              let kept = false;
              DAY_NAMES.forEach(dn => {
                const day = days[dn];
                if (!day) { filteredDays[dn] = day; return; }
                // Header-rule pay math handles cross-BP attribution via the
                // roster header's Carried In/Out values, so we no longer strip
                // days by sectorDate. Every parsed day is kept; sectors dated
                // outside the range simply don't contribute to in-range totals.
                filteredDays[dn] = day;
                if (day.sectors?.length) kept = true;
              });
              if (kept) stripped[ws] = filteredDays;
            });
          } else {
            // Range unknown — fall back to keeping everything as parsed
            Object.assign(stripped, weeks);
          }
          // Deep-merge instead of shallow ...spread.  Two BPs whose date ranges
          // straddle a Mon-Sun week (e.g. BP3741 ends Sun Apr 19, BP3745 starts
          // Mon Apr 20 — both print the week starting Mon Apr 13) share the
          // same week key.  A shallow merge would overwrite earlier weeks with
          // the next file's version, dropping OL48/OL13 markers that appear in
          // only one of the BPs.  See merge logic below.
          mergedWeeks = mergeWeeks(mergedWeeks, stripped);
          if (rangeFrom && (!earliestFrom || rangeFrom < earliestFrom)) earliestFrom = rangeFrom;
          if (rangeTo && (!latestTo || rangeTo > latestTo)) latestTo = rangeTo;
          if (firstWeekStart && (!earliestWeekStart || firstWeekStart < earliestWeekStart)) earliestWeekStart = firstWeekStart;
          if (detectedRole) lastDetectedRole = detectedRole;
          if (detectedAircraft) lastDetectedAircraft = detectedAircraft;
          if (detectedYos >= 0) lastDetectedYos = detectedYos;
          if (detectedJoiningDate) lastDetectedJoiningDate = detectedJoiningDate;
          if (detectedBP && rangeFrom && rangeTo) {
            newBpEntries.push({ bp: detectedBP, from: rangeFrom, to: rangeTo, headerCarry: headerCarry || null, rawText: text, fileName: file.name });
          }
        } catch (err) {
          failedFiles.push(`${file.name}: ${err.message}`);
        }
      }

      if (parsedFileCount === 0) {
        const msg = ["No trips could be parsed from any of the uploaded file(s)."];
        if (failedFiles.length) msg.push("", ...failedFiles);
        alert(msg.join("\n"));
        return;
      }

      // Same deep-merge against any pre-existing weeks already in state, for
      // the same reason — a previously uploaded BP may share a boundary week
      // with one of the rosters we just parsed.
      setAllWeeks(prev => mergeWeeks(prev, mergedWeeks));
      if (earliestWeekStart) setWeekStart(earliestWeekStart);
      if (lastDetectedRole) setRole(lastDetectedRole);
      if (lastDetectedAircraft) setAircraft(lastDetectedAircraft);
      if (lastDetectedYos >= 0) setYos(lastDetectedYos);
      if (lastDetectedJoiningDate) setPilotJoiningDate(lastDetectedJoiningDate);

      // Merge BP entries: dedupe by bp number, keep sorted ascending so the
      // BP selector buttons always render in chronological order regardless
      // of upload order.
      if (newBpEntries.length > 0) {
        setRosterBPs(prev => {
          const map = new Map();
          [...prev, ...newBpEntries].forEach(e => map.set(e.bp, e));
          return [...map.values()].sort((a, b) => a.bp - b.bp);
        });
      }

      // Anchor the Month/Roster view on the EARLIEST uploaded range so the
      // display starts chronologically (BP3741 before BP3745, etc.) no matter
      // what order the user selected the files in.
      if (earliestFrom && latestTo) {
        setCustomFrom(earliestFrom);
        setCustomTo(latestTo);
        setMonthView(earliestFrom.slice(0, 7));
        // Auto-select the EBA indexation year matching the anchored BP's
        // start date (BP chip clicks re-apply this per selected BP).
        setYearIdx(ebaYearIdxForDate(earliestFrom));
      }

      const summary = parsedFileCount === 1
        ? `Roster loaded: ${totalWeeks} week(s) imported.`
        : `${parsedFileCount} rosters loaded: ${totalWeeks} week(s) imported.`;
      const extras = [];
      if (failedFiles.length) extras.push("", "Files with issues:", ...failedFiles);
      if (allErrors.length) extras.push("", "Parser warnings:", ...allErrors);
      alert([summary, ...extras].join("\n"));
    });
  }

  function clearRoster() {
    const today = new Date().toISOString().slice(0,10);
    const curWs = getMon(today);
    // Build a completely fresh weeks object
    const freshWeeks = {[curWs]: Object.fromEntries(DAY_NAMES.map(k => [k, emptyDay()]))};
    setAllWeeks(freshWeeks);
    setWeekStart(curWs);
    setActive("MON");
    setCustomFrom("");
    setCustomTo("");
    setMonthView(today.slice(0, 7));
    setTab("entry");
    setConfirmClearRoster(false);
    setRosterBPs([]);
    setPilotJoiningDate(null);
    // Payslip figures are personal pay data — they must not survive a CLEAR.
    clearPaySlip();
  }

  function toggleSlip(dayKey,val) {
    setDays(p=>{
      if(!val) {
        // Turning slip OFF — clear all hotel data
        return {...p,[dayKey]:{
          ...p[dayKey],
          hasSlip:false,
          hotels:[],
          hotelFrom:"", hotelTo:"",
          hotelCheckIn:"", hotelCheckOut:"",
          hotelAfterSectorIdx:null,
        }};
      }
      // Turning ON — add a default hotel after the first sector if none exist
      const day={...p[dayKey],hasSlip:true};
      const existing = getHotels(day);
      if (existing.length === 0) {
        const idx = 0;
        const before = day.sectors[idx];
        const after = day.sectors[idx+1];
        const signOff = before?.aSignOff || "";
        const signOn = before?.aSignOn || "";
        const tripDate = dateForName(dayKey);
        day.hotels = [{
          afterSectorIdx: idx,
          hotelFrom: hotelCheckInDate(tripDate, signOn, signOff),
          hotelTo: "",
          hotelCheckIn: signOff,
          hotelCheckOut: after?.aSignOn || "",
        }];
      } else {
        day.hotels = [...existing];
      }
      // Clear legacy fields to avoid duplication
      day.hotelFrom = ""; day.hotelTo = "";
      day.hotelCheckIn = ""; day.hotelCheckOut = "";
      day.hotelAfterSectorIdx = null;
      return {...p,[dayKey]:day};
    });
  }

  function setHotelAfter(dayKey,idx) {
    setDays(p=>{
      const day={...p[dayKey],hasSlip:true};
      const existing = getHotels(day);
      // Don't add a duplicate hotel after the same sector
      if (existing.some(h => h.afterSectorIdx === idx)) return p;
      const before = day.sectors[idx];
      const after = day.sectors[idx+1];
      const signOff = before?.aSignOff || "";
      const signOn = before?.aSignOn || "";
      const tripDate = dateForName(dayKey);
      const secDate = before?.sectorDate || tripDate;
      const newHotel = {
        afterSectorIdx: idx,
        hotelFrom: hotelCheckInDate(secDate, signOn, signOff),
        hotelTo: "",
        hotelCheckIn: signOff,
        hotelCheckOut: after?.aSignOn || "",
      };
      day.hotels = [...existing, newHotel].sort((a,b) => a.afterSectorIdx - b.afterSectorIdx);
      // Clear legacy fields
      day.hotelFrom = ""; day.hotelTo = "";
      day.hotelCheckIn = ""; day.hotelCheckOut = "";
      day.hotelAfterSectorIdx = null;
      return {...p,[dayKey]:day};
    });
  }

  function updHotel(dayKey, hotelIdx, field, val) {
    setDays(p => {
      const day = {...p[dayKey]};
      const hotels = getHotels(day).map((h, i) => i === hotelIdx ? {...h, [field]: val} : h);
      day.hotels = hotels;
      day.hotelFrom = ""; day.hotelTo = "";
      day.hotelCheckIn = ""; day.hotelCheckOut = "";
      day.hotelAfterSectorIdx = null;
      return {...p, [dayKey]: day};
    });
  }

  function removeHotel(dayKey, hotelIdx) {
    setDays(p => {
      const day = {...p[dayKey]};
      const hotels = getHotels(day).filter((_, i) => i !== hotelIdx);
      day.hotels = hotels;
      day.hasSlip = hotels.length > 0;
      day.hotelFrom = ""; day.hotelTo = "";
      day.hotelCheckIn = ""; day.hotelCheckOut = "";
      day.hotelAfterSectorIdx = null;
      return {...p, [dayKey]: day};
    });
  }

  const dayResults={};
  DAY_NAMES.forEach(d=>{dayResults[d]=calcAllowances(days[d],role,yearIdx,dateForName(d));});
  const dayTotals={};
  DAY_NAMES.forEach(d=>{dayTotals[d]=dayResults[d].reduce((s,i)=>s+i.amount,0);});
  const weekTotal=Object.values(dayTotals).reduce((s,v)=>s+v,0);

  // ── Per-calendar-date allowance map ──
  // Aggregates allowances from the current week AND adjacent weeks,
  // keyed by the actual calendar date each item falls on.
  // This ensures multi-day trips that cross week boundaries show up correctly.
  const dateAllowanceMap = {};  // { [dateStr]: { items:[], total:number, sourceDays:Set } }

  // Helper to process a week's data into the map
  const processWeekIntoMap = (ws, wDays, sourceLabel) => {
    if (!wDays) return;
    DAY_NAMES.forEach((dayName, di) => {
      const dayData = wDays[dayName];
      if (!dayData) return;
      const tripDate = weekDate(ws, di);
      const byDate = calcAllowancesByDate(dayData, role, yearIdx, tripDate);
      Object.entries(byDate).forEach(([dateStr, items]) => {
        if (!dateAllowanceMap[dateStr]) dateAllowanceMap[dateStr] = { items: [], total: 0, sourceDays: new Set() };
        dateAllowanceMap[dateStr].items.push(...items);
        dateAllowanceMap[dateStr].total += items.reduce((s, i) => s + i.amount, 0);
        dateAllowanceMap[dateStr].sourceDays.add(`${sourceLabel}:${dayName}`);
      });
    });
  };

  // Process current week
  processWeekIntoMap(weekStart, days, "current");

  // Process previous week (may spill into current week)
  const prevWeekStart = addDays(weekStart, -7);
  if (allWeeks[prevWeekStart]) {
    processWeekIntoMap(prevWeekStart, allWeeks[prevWeekStart], "prev");
  }

  // Process next week (current week may spill into it — not needed for day pills,
  // but ensures the current week's Friday→Tuesday trip shows on Sat/Sun pills)
  // Actually the current week's data is already processed above and its spill-over
  // dates are already in the map. We just need to make sure the day pills pick them up.

  // For each day-of-week pill: look up the calendar date and get the combined total
  // from dateAllowanceMap (aggregates across all days and previous-week spillover)
  const dayPillTotals = {};
  DAY_NAMES.forEach((dayName, idx) => {
    const dt = dateFor(idx);
    dayPillTotals[dayName] = dateAllowanceMap[dt]?.total || 0;
  });
  const weekTotalByDate = Object.values(dayPillTotals).reduce((s, v) => s + v, 0);

  const d=days[active];
  const dayDate=dateForName(active);
  const utc=clock.toISOString().slice(11,19)+"Z";

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--muted)",fontFamily:"'Syne',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&family=Archivo+Narrow:wght@500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-track{background:var(--bg);} ::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:2px;}
        input[type=time]::-webkit-calendar-picker-indicator,input[type=date]::-webkit-calendar-picker-indicator{filter:var(--pickerFilter);cursor:pointer;}
        input:focus,select:focus{outline:none!important;}
        select option{background:var(--panel);color:var(--muted);}
        @keyframes fadein{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .fadein{animation:fadein 0.25s ease both;}
        .dpill{cursor:pointer;transition:all 0.15s;} .dpill:hover{border-color:var(--accentLine)!important;}
        .hrow:hover{background:rgba(56,189,248,0.08)!important;}
        .addBtn{transition:all 0.15s;} .addBtn:hover{background:var(--accentBg2)!important;border-color:var(--accent)!important;}

        /* Responsive */
        .topbar{background:var(--bg);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 20px;min-height:52px;flex-wrap:wrap;}
        .stickyhead{position:sticky;top:0;z-index:50;}
        .topbar-brand{display:flex;align-items:center;gap:8px;flex-shrink:0;}
        .topbar-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;}
        .day-tabs{background:var(--bg);border-bottom:1px solid var(--line);padding:8px 12px;display:flex;gap:5px;overflow-x:auto;align-items:stretch;-webkit-overflow-scrolling:touch;}
        .hotel-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;margin-bottom:12px;align-items:end;}
        .summary-row{display:grid;grid-template-columns:125px 1fr auto;}
        .monthly-row{display:grid;grid-template-columns:160px 1fr auto;}
        .rates-grid{display:grid;grid-template-columns:155px repeat(4,1fr);}
        .type-breakdown{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:8px;}
        .main-content{max-width:980px;margin:0 auto;padding:16px 20px;}

        @media(max-width:768px){
          .topbar{padding:8px 12px;gap:8px;min-height:auto;flex-wrap:wrap;}
          .topbar-brand{width:100%;}
          .topbar-controls{width:100%;justify-content:flex-start;}
          .day-tabs{padding:8px 8px;gap:4px;}
          .day-tabs .dpill{min-width:62px!important;padding:6px 8px!important;}
          .hotel-grid{grid-template-columns:1fr!important;gap:8px!important;}
          .hotel-grid>div:nth-child(2){flex-direction:row!important;justify-content:center!important;}
          .summary-row{grid-template-columns:1fr!important;}
          .monthly-row{grid-template-columns:1fr!important;}
          .rates-grid{grid-template-columns:1fr!important;}
          .type-breakdown{grid-template-columns:1fr!important;}
          .main-content{padding:12px 10px;}
        }
        @media(min-width:769px) and (max-width:1024px){
          .topbar{flex-wrap:wrap;padding:8px 16px;gap:8px;}
          .day-tabs .dpill{min-width:72px!important;}
          .main-content{padding:16px 16px;}
        }

        /* ─── Day / night theme ───────────────────────────────────────────
           Light is the base palette on bare :root. The dark palette lives in
           one block applied two ways: automatically when the OS asks for dark
           (unless the reader has forced light), and explicitly when the
           day/night toggle sets data-theme="dark". The toggle wins in both
           directions. Theme is a display preference only and is not persisted,
           so a reload returns to whatever the OS prefers. Mirrors the EFA bid
           optimiser, and several tokens carry its exact values. */
        :root{
          color-scheme:light; --pickerFilter:invert(0.7);
          --bg:#FAF7F2; --panel:#F0EBE3; --ink:#1A1A2E; --ink2:#2D3239;
          --muted:#4A4F57; --faint:#8A8577; --line:#D4CCC0; --line2:#E8E2D9;
          --line3:#EFE9E1; --scroll:#C4B8A8; --accent:#1E8AC0; --accentLine:#8BAFCF;
          --accentBg:#E0EAF5; --accentBg2:#D6E4F0; --accentInk:#4A7A9B;
          --slipHead:#1A2A3A; --slipInk:#EAF1F8; --slipMuted:#9DB4CC; --red:#CC2E2E;
          --red2:#D44545; --redBg:#F5E0E0; --green:#3DA866; --green2:#1FA06E;
          --greenBg:#E5F0E5; --greenLine:#B8D4B8; --purple:#7C5CD6;
          --purpleBg:#F5F0F9; --amber:#A85D04; --amberBg:#FFF8E6; --yellow:#D4A80A;
          --yellow2:#D49B0A; --orange:#C47E08; --orange2:#D4701A; --indigo:#5B66D6;
          --pink:#D4458E; --blue:#3B82D6; --slate:#94A3B8; --sage:#C4CEBC;
        }
        @media (prefers-color-scheme:dark){
          :root:not([data-theme="light"]){
          color-scheme:dark; --pickerFilter:none;
          --bg:#15181C; --panel:#1D2126; --ink:#E8EAED; --ink2:#C2C9D1;
          --muted:#98A1AA; --faint:#7D858E; --line:#2E343B; --line2:#272C33;
          --line3:#23282E; --scroll:#3A4149; --accent:#79AEF5; --accentLine:#3D5A7D;
          --accentBg:#16304F; --accentBg2:#1A3A5F; --accentInk:#9DC4EE;
          --slipHead:#11161B; --slipInk:#DCE6F2; --slipMuted:#8FA3B8; --red:#F2777A;
          --red2:#EF8A8A; --redBg:#3A1A1C; --green:#5FCE92; --green2:#4FC48D;
          --greenBg:#123324; --greenLine:#2C5A3F; --purple:#BB9BEC;
          --purpleBg:#2C2140; --amber:#E0A94A; --amberBg:#3B2B0D; --yellow:#E8C85A;
          --yellow2:#DFBB45; --orange:#E0A04A; --orange2:#EA9A55; --indigo:#9AA4EE;
          --pink:#EF8FC0; --blue:#79AEF5; --slate:#8B949E; --sage:#55604F;
          }
        }
        :root[data-theme="dark"]{
          color-scheme:dark; --pickerFilter:none;
          --bg:#15181C; --panel:#1D2126; --ink:#E8EAED; --ink2:#C2C9D1;
          --muted:#98A1AA; --faint:#7D858E; --line:#2E343B; --line2:#272C33;
          --line3:#23282E; --scroll:#3A4149; --accent:#79AEF5; --accentLine:#3D5A7D;
          --accentBg:#16304F; --accentBg2:#1A3A5F; --accentInk:#9DC4EE;
          --slipHead:#11161B; --slipInk:#DCE6F2; --slipMuted:#8FA3B8; --red:#F2777A;
          --red2:#EF8A8A; --redBg:#3A1A1C; --green:#5FCE92; --green2:#4FC48D;
          --greenBg:#123324; --greenLine:#2C5A3F; --purple:#BB9BEC;
          --purpleBg:#2C2140; --amber:#E0A94A; --amberBg:#3B2B0D; --yellow:#E8C85A;
          --yellow2:#DFBB45; --orange:#E0A04A; --orange2:#EA9A55; --indigo:#9AA4EE;
          --pink:#EF8FC0; --blue:#79AEF5; --slate:#8B949E; --sage:#55604F;
        }
        /* The HTML shell paints a fixed light background; follow the theme. */
        html,body{background:var(--bg);}
      `}</style>

      {/* ── Sticky header (topbar + tab bar) ── */}
      <div className="stickyhead">
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div style={{fontFamily:mono,fontSize:13,fontWeight:700,color:"var(--ink)",letterSpacing:2}}>EFA PAY</div>
            <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5}}>EA 2025 · TRIP ALLOWANCE CALCULATOR</div>
          </div>
        </div>
        <div className="topbar-controls">
          {[["cpt","Captain"],["fo","F/Officer"]].map(([r,lbl])=>(
            <button key={r} onClick={()=>setRole(r)} style={{padding:"4px 12px",borderRadius:6,cursor:"pointer",background:role===r?"var(--accentBg)":"transparent",border:`1px solid ${role===r?"var(--accent)":"var(--line)"}`,color:role===r?"var(--accent)":"var(--ink2)",fontSize:12,fontWeight:700,fontFamily:mono}}>{lbl}</button>
          ))}
          {[["a330","A330"],["a320","A320"]].map(([ac,lbl])=>(
            <button key={ac} onClick={()=>setAircraft(ac)} style={{padding:"4px 12px",borderRadius:6,cursor:"pointer",background:aircraft===ac?"var(--accentBg)":"transparent",border:`1px solid ${aircraft===ac?"var(--accent)":"var(--line)"}`,color:aircraft===ac?"var(--accent)":"var(--ink2)",fontSize:12,fontWeight:700,fontFamily:mono}}>{lbl}</button>
          ))}
          <select value={yearIdx} onChange={e=>setYearIdx(+e.target.value)} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:6,color:"var(--accent)",padding:"4px 8px",fontFamily:mono,fontSize:12,cursor:"pointer"}}>
            {INDEX_YEARS.map((y,i)=><option key={i} value={i}>{y.label}</option>)}
          </select>
        </div>
        <div style={{fontFamily:mono,fontSize:13,color:"var(--accent)",letterSpacing:1,flexShrink:0}}>{utc}</div>
        <label style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,color:"var(--accent)",padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:mono,flexShrink:0,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}} title="Upload Qantas SH roster .txt file">
          📄 ROSTER
          <input type="file" accept=".txt,text/plain" onChange={e=>{handleRosterUpload(e.target.files);e.target.value="";}} style={{display:"none"}}/>
        </label>
        {/* Download App — saves the running .html so the user can keep an
            offline copy. Clones the document, clears the React root in the
            clone, and serialises so the saved file boots fresh from the
            embedded bundle when reopened. */}
        <button
          onClick={()=>{
            try{
              const docClone=document.documentElement.cloneNode(true);
              const rootEl=docClone.querySelector("#root");
              if(rootEl)rootEl.innerHTML="";
              const html="<!doctype html>\n"+docClone.outerHTML;
              const blob=new Blob([html],{type:"text/html;charset=utf-8"});
              const url=URL.createObjectURL(blob);
              const a=document.createElement("a");
              a.href=url;a.download="efa-duty-calculator.html";
              document.body.appendChild(a);a.click();document.body.removeChild(a);
              setTimeout(()=>URL.revokeObjectURL(url),1500);
            }catch(err){alert("Couldn't generate offline copy: "+err.message);}
          }}
          title="Save this app as a standalone .html for offline use"
          style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,color:"var(--accent)",padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:mono,flexShrink:0,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}>
          ⤓ APP
        </button>
        {confirmClearRoster ? (
          <div style={{display:"flex",alignItems:"center",gap:6,background:"var(--redBg)",border:"1px solid color-mix(in srgb, var(--red) 38%, transparent)",borderRadius:8,padding:"4px 8px",flexShrink:0}}>
            <span style={{fontSize:11,color:"var(--red)",fontFamily:mono}}>Clear all?</span>
            <button onClick={clearRoster}
              style={{background:"var(--red)",border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:"pointer",padding:"3px 8px",fontFamily:mono,fontWeight:700}}>
              Yes, clear
            </button>
            <button onClick={()=>setConfirmClearRoster(false)}
              style={{background:"transparent",border:"1px solid var(--muted)",borderRadius:5,color:"var(--ink2)",fontSize:11,cursor:"pointer",padding:"3px 8px",fontFamily:mono}}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={()=>setConfirmClearRoster(true)} title="Clear all roster data and reset the calculator"
            style={{background:"var(--panel)",border:"1px solid color-mix(in srgb, var(--red) 19%, transparent)",borderRadius:8,color:"var(--red)",padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:mono,flexShrink:0,letterSpacing:0.5}}>
            🗑 CLEAR
          </button>
        )}
        <button onClick={toggleTheme} title={themeDark?"Switch to day (light) mode":"Switch to night (dark) mode"}
          style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,color:"var(--accent)",padding:"6px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:mono,flexShrink:0,letterSpacing:0.5,display:"flex",alignItems:"center",justifyContent:"center",whiteSpace:"nowrap"}}>
          {themeDark?"☀ Day":"🌙 Night"}
        </button>
        <button onClick={()=>setShowHelp(true)} title="How to use this calculator"
          style={{background:"var(--panel)",border:"1px solid var(--accent)",borderRadius:8,color:"var(--accent)",padding:"6px 10px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:mono,flexShrink:0,minWidth:36,display:"flex",alignItems:"center",justifyContent:"center"}}>
          ?
        </button>
      </div>
      {showHelp && <HelpModal onClose={()=>setShowHelp(false)} />}

      {/* ── Tab bar ── */}
      <div style={{background:"var(--bg)",borderBottom:"1px solid var(--line)",display:"flex",padding:"0 20px",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["entry","DAY SUMMARY"],["rates","MEAL RATES"],["summary","WEEK SUMMARY"],["monthly","MONTH / ROSTER"],["paycheck","PAY CHECK"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:"transparent",border:"none",color:tab===id?"var(--accent)":"var(--muted)",borderBottom:tab===id?"2px solid var(--accent)":"2px solid transparent",padding:"0 16px",height:44,fontSize:12,fontWeight:700,letterSpacing:1.5,fontFamily:mono,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{lbl}</button>
        ))}
      </div>
      </div>

      {/* ── Day tabs ── */}
      {tab==="entry"&&(
        <div className="day-tabs">
          {DAY_NAMES.map((day,idx)=>{
            const dt=dateFor(idx),t=dayPillTotals[day],isAct=active===day;
            const hasSpillOver = dateAllowanceMap[dt]?.sourceDays?.size > 1 || (dateAllowanceMap[dt]?.sourceDays?.size === 1 && !dateAllowanceMap[dt]?.sourceDays?.has("current:"+day));
            const isWknd=day==="SAT"||day==="SUN";

            // Compute the route for this specific calendar date:
            // - If the day has its own entry with sectors: use the first sector dep → last sector before first hotel arr
            //   (or last sector arr if no hotel)
            // - Also check other days in current + previous week for sectors/hotels landing on this date
            let route = "";
            // Walk all days in current + previous week to find sectors on this date
            const prevWs = addDays(weekStart, -7);
            const sourceDays = [
              ...DAY_NAMES.map(dn => ({ws:weekStart, dn, day:days[dn]})),
              ...(allWeeks[prevWs] ? DAY_NAMES.map(dn => ({ws:prevWs, dn, day:allWeeks[prevWs][dn]})) : []),
            ];
            for (const {day:srcDay} of sourceDays) {
              if (!srcDay || !srcDay.sectors?.[0]?.aSignOn) continue;
              const srcHotels = getHotels(srcDay);
              // Check each sector — does its resolved date match this pill's date?
              // Build a map of sector idx → calendar date
              const srcTripDate = srcDay.sectors[0].sectorDate || (()=>{
                // Fallback: find the week/day combo for this srcDay to get its tripDate
                return null;
              })();
              // Use sector's own sectorDate since roster import sets it
              const sectorsOnDt = srcDay.sectors.filter(s => s.sectorDate === dt);
              // Find hotels whose checkout is on this date (return sector date)
              const hotelsEndingOnDt = srcHotels.filter(h => h.hotelTo === dt);
              // Find hotels whose checkin is on this date (outbound sector date)
              const hotelsStartingOnDt = srcHotels.filter(h => h.hotelFrom === dt);

              if (sectorsOnDt.length > 0) {
                // There's a sector on this date. Find which hotels surround it.
                // Determine the duty-period-on-this-date: sectors between hotels or from start/hotel to end/hotel
                // For simplicity: use first sector on this date's dep, last sector on this date's arr,
                // BUT if a hotel ends on this date, use the hotel's preceding sector arr as the dep (PVG→SYD style)
                // For outbound (hotel starts today), use first sector dep and the sector before hotel's arr
                const firstSecOnDt = sectorsOnDt[0];
                const lastSecOnDt = sectorsOnDt[sectorsOnDt.length - 1];
                // If a hotel starts on this date, the trip here is "dep of first sector → arr of sector immediately before hotel"
                const hotelStartingHere = hotelsStartingOnDt[0];
                if (hotelStartingHere) {
                  const firstIdxOnDt = srcDay.sectors.indexOf(firstSecOnDt);
                  // Find the sector right before (or at) hotel.afterSectorIdx
                  const beforeHotelSec = srcDay.sectors[hotelStartingHere.afterSectorIdx];
                  if (beforeHotelSec && firstSecOnDt.depAirport && beforeHotelSec.arrAirport) {
                    route = `${firstSecOnDt.depAirport}→${beforeHotelSec.arrAirport}`;
                  }
                } else {
                  // No hotel starts today — just show first dep → last arr on this date
                  if (firstSecOnDt.depAirport && lastSecOnDt.arrAirport) {
                    route = `${firstSecOnDt.depAirport}→${lastSecOnDt.arrAirport}`;
                  }
                }
                if (route) break;
              } else if (hotelsEndingOnDt.length > 0) {
                // No sector dep on this date but a hotel ends here — show the next sector's route
                const hotel = hotelsEndingOnDt[0];
                const afterHotelSec = srcDay.sectors[hotel.afterSectorIdx + 1];
                if (afterHotelSec && afterHotelSec.depAirport && afterHotelSec.arrAirport) {
                  // Find the last sector in this duty period (next hotel or end)
                  const nextHotel = srcHotels.find(h => h.afterSectorIdx > hotel.afterSectorIdx);
                  const lastIdx = nextHotel ? nextHotel.afterSectorIdx : srcDay.sectors.length - 1;
                  const lastSec = srcDay.sectors[lastIdx];
                  if (lastSec?.arrAirport) {
                    route = `${afterHotelSec.depAirport}→${lastSec.arrAirport}`;
                    break;
                  }
                }
              }
            }

            return (
              <div key={day} className="dpill" onClick={()=>{ setActive(day); setConfirmReset(false); }} style={{padding:"7px 11px",borderRadius:9,flexShrink:0,cursor:"pointer",minWidth:82,background:isAct?"var(--accentBg)":"transparent",border:`1px solid ${isAct?"var(--accentLine)":"var(--line)"}`}}>
                <div style={{fontSize:12,fontWeight:800,fontFamily:mono,letterSpacing:1,color:isWknd?(isAct?"var(--red2)":"var(--ink2)"):(isAct?"var(--ink)":"var(--ink2)")}}>{day}</div>
                <div style={{fontSize:13,fontWeight:600,color:isAct?"var(--accent)":"var(--muted)",marginTop:1}}>{fmtShort(dt)}</div>
                {route&&<div style={{fontSize:9,color:isAct?"var(--accentInk)":"var(--muted)",marginTop:2,fontFamily:mono}}>{route}</div>}
                {days[day].sectors[0]?.reservePeriod
                  ? <div style={{fontSize:9,color:"var(--purple)",fontFamily:mono,marginTop:1,fontWeight:700}}>Reserve</div>
                  : days[day].sectors.length>2&&<div style={{fontSize:9,color:"var(--ink2)",fontFamily:mono,marginTop:1}}>{days[day].sectors.length} sectors</div>}
                {hasSpillOver&&<div style={{fontSize:9,color:"var(--purple)",fontFamily:mono,marginTop:1,letterSpacing:0.5}}>+ MULTI-DAY</div>}
                <div style={{fontSize:11,fontFamily:mono,marginTop:3,color:t>0?"var(--green)":"var(--muted)",fontWeight:t>0?700:400}}>{t>0?`$${fmtAUD(t)}`:"—"}</div>
              </div>
            );
          })}
          <div style={{marginLeft:"auto",padding:"7px 13px",borderRadius:9,flexShrink:0,background:weekTotalByDate>0?"var(--accentBg2)":"transparent",border:`1px solid ${weekTotalByDate>0?"var(--accentLine)":"var(--line)"}`,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontSize:11,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,fontWeight:700}}>WEEK</div>
            <div style={{fontSize:11,color:"var(--muted)",fontFamily:mono,marginTop:1}}>{fmtShort(weekStart)}–{fmtShort(weekDate(weekStart,6))}</div>
            <div style={{fontSize:16,fontWeight:700,fontFamily:mono,color:weekTotalByDate>0?"var(--accent)":"var(--muted)",marginTop:3,textShadow:weekTotalByDate>0?"0 0 14px rgba(56,189,248,0.4)":"none"}}>{weekTotalByDate>0?`$${fmtAUD(weekTotalByDate)}`:"—"}</div>
          </div>
        </div>
      )}

      <div className="main-content">

        {/* ══ DAY SUMMARY ══ */}
        {tab==="entry"&&(
          <div className="fadein">
            {/* Day header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>DUTY DAY</div>
                <div style={{fontFamily:heading,fontSize:27,fontWeight:700,color:"var(--ink)",letterSpacing:0,lineHeight:1}}>
                  {active} <span style={{color:"var(--accent)"}}>{fmtShort(dayDate)}</span>
                </div>
                <div style={{fontSize:12,color:"var(--ink2)",marginTop:2}}>{fmtFull(dayDate)}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:3,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,padding:"3px 6px"}}>
                  <span style={{fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,marginRight:3}}>WEEK OF</span>
                  <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{background:"transparent",border:"none",color:"var(--ink2)",fontSize:16,cursor:"pointer",padding:"0 3px",lineHeight:1,fontFamily:mono}}>‹</button>
                  <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                    <span style={{fontFamily:mono,fontSize:13,color:"var(--accent)",userSelect:"none",minWidth:84,textAlign:"center"}}>
                      {fmtShort(weekStart)} {parseDate(weekStart)?.getUTCFullYear()}
                    </span>
                    <input type="date" value={weekStart} onChange={e=>setWeekStart(getMon(e.target.value))}
                      style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",colorScheme:"inherit"}}/>
                  </div>
                  <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{background:"transparent",border:"none",color:"var(--ink2)",fontSize:16,cursor:"pointer",padding:"0 3px",lineHeight:1,fontFamily:mono}}>›</button>
                </div>
                <span style={{fontSize:11,color:"var(--ink2)",fontFamily:mono}}>{d.sectors.length} sector{d.sectors.length!==1?"s":""}</span>
                {confirmReset ? (
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"var(--redBg)",border:"1px solid color-mix(in srgb, var(--red) 38%, transparent)",borderRadius:8,padding:"4px 8px"}}>
                    <span style={{fontSize:11,color:"var(--red)",fontFamily:mono}}>Clear {active}?</span>
                    <button onClick={()=>{ setDays(p=>({...p,[active]:emptyDay()})); setConfirmReset(false); }}
                      style={{background:"var(--red)",border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:"pointer",padding:"3px 8px",fontFamily:mono,fontWeight:700}}>
                      Yes, clear
                    </button>
                    <button onClick={()=>setConfirmReset(false)}
                      style={{background:"transparent",border:"1px solid var(--muted)",borderRadius:5,color:"var(--ink2)",fontSize:11,cursor:"pointer",padding:"3px 8px",fontFamily:mono}}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={()=>setConfirmReset(true)}
                    style={{background:"transparent",border:"1px solid color-mix(in srgb, var(--red) 21%, transparent)",borderRadius:7,color:"var(--red)",fontSize:12,cursor:"pointer",padding:"4px 10px",fontFamily:mono,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}
                    onMouseEnter={e=>{e.currentTarget.style.background="color-mix(in srgb, var(--red) 8%, transparent)";e.currentTarget.style.borderColor="color-mix(in srgb, var(--red) 44%, transparent)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="color-mix(in srgb, var(--red) 21%, transparent)";}}
                  >↺ Reset day</button>
                )}
              </div>
            </div>

            {/* ── Sectors ── */}
            {d.sectors.map((sec,idx)=>{
              // If sector 0 is a reserve period, only render sector 0
              if (d.sectors[0]?.reservePeriod && idx > 0) return null;
              const allHotelsUI = getHotels(d);
              const hotelsAfterThisSector = allHotelsUI.map((h, hi) => ({h, hi})).filter(({h}) => h.afterSectorIdx === idx);
              const hasHotelAfterThis = hotelsAfterThisSector.length > 0;
              const sDate = resolveSectorDate(sec, idx, d, dayDate);
              const isReserve = d.sectors[0]?.reservePeriod;

              return (
                <div key={sec.id}>
                  <SectorCard
                    sec={sec}
                    idx={idx}
                    sectorDate={sDate}
                    tripDate={dayDate}
                    onUpdate={(field,val)=>updSector(active,sec.id,field,val)}
                    onRemove={()=>removeSector(active,sec.id)}
                    onAddHotelAfter={()=>setHotelAfter(active,idx)}
                    hasHotelAfter={hasHotelAfterThis}
                    showHotelBtn={idx<d.sectors.length-1}
                    totalSectors={d.sectors.length}
                    isLastSector={idx===d.sectors.length-1}
                    isFirstSector={idx===0}
                  />

                  {/* "Add sector between" button + continue duty toggle */}
                  {!isReserve && idx<d.sectors.length-1&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{flex:1,height:1,background:"var(--line)"}}/>
                      {!hasHotelAfterThis&&(
                        <Toggle label="Continue duty to next sector" checked={sec.continueDuty} onChange={v=>updSector(active,sec.id,"continueDuty",v)} color="var(--accent)"/>
                      )}
                      <button className="addBtn" onClick={()=>insertSectorAt(active,idx)} style={{
                        background:"var(--panel)",border:"1px dashed var(--muted)",borderRadius:7,
                        color:"var(--ink2)",fontSize:11,cursor:"pointer",padding:"3px 10px",
                        fontFamily:mono,letterSpacing:0.5,flexShrink:0,
                      }}>+ Insert sector here</button>
                      <div style={{flex:1,height:1,background:"var(--line)"}}/>
                    </div>
                  )}

                  {/* Hotel blocks for any hotels placed after this sector */}
                  {!isReserve && hotelsAfterThisSector.map(({h: hotel, hi: hotelIdx}) => {
                    const hNights = daysBetween(hotel.hotelFrom, hotel.hotelTo);
                    const hCi = parseTime(hotel.hotelCheckIn);
                    const hCo = parseTime(hotel.hotelCheckOut);
                    const hTotSlip = hNights >= 0 && hCi != null && hCo != null ? totalSlipMins(hCi, hCo, hNights) : 0;
                    const hPerDayM = hNights >= 0 && hCi != null && hCo != null ? mealsCoveredPerDay(hCi, hCo, hNights, hotel.hotelFrom || hotel.hotelTo) : [];
                    const hZone = sec.arrAirport ? zoneFrom(sec.arrAirport) : (d.destination || "domestic");
                    const hDest = (getDestinations(hotel.hotelFrom)[hZone]) || getDestinations(hotel.hotelFrom).domestic;
                    const hRetDepTz = d.sectors[idx + 1]?.depAirport;

                    return (
                      <Card key={`hotel-${hotelIdx}`} border="var(--accentLine)" style={{marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                          <SHead style={{marginBottom:0}}>🏨 HOTEL STAY {allHotelsUI.length > 1 ? `#${hotelIdx + 1}` : ""} — between sector {idx+1} and {idx+2}</SHead>
                          <button onClick={()=>removeHotel(active, hotelIdx)} style={{background:"transparent",border:"1px solid color-mix(in srgb, var(--red) 19%, transparent)",borderRadius:5,color:"var(--red)",fontSize:12,cursor:"pointer",padding:"2px 7px",fontFamily:mono}}>Remove hotel</button>
                        </div>
                        <div className="hotel-grid">
                          <ICard border="var(--accentLine)" style={{display:"flex",flexDirection:"column",gap:9}}>
                            <div style={{fontSize:10,letterSpacing:1.5,color:"var(--accent)",fontFamily:mono}}>CHECK-IN</div>
                            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                              <DInput label="DATE" value={hotel.hotelFrom} onChange={v=>updHotel(active, hotelIdx, "hotelFrom", v)} hi/>
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                                  <span style={{fontSize:10,letterSpacing:1,color:"var(--accent)",fontFamily:mono}}>TIME</span>
                                  {sec.arrAirport&&<span style={{fontSize:9,color:"var(--muted)",fontFamily:mono,background:"var(--line)",borderRadius:3,padding:"1px 4px"}}>{tzLabel(sec.arrAirport,sDate)}</span>}
                                  <span style={{fontSize:9,color:"var(--green2)",fontFamily:mono}}>auto</span>
                                </div>
                                <input type="time" value={hotel.hotelCheckIn} onChange={e=>updHotel(active, hotelIdx, "hotelCheckIn", e.target.value)}
                                  style={{background:"var(--bg)",border:"1px solid var(--accentLine)",borderRadius:6,color:hotel.hotelCheckIn?"var(--ink)":"var(--muted)",padding:"5px 8px",fontFamily:mono,fontSize:15,width:"100%",maxWidth:120,minWidth:90}}/>
                              </div>
                            </div>
                          </ICard>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,paddingBottom:4}}>
                            <div style={{fontSize:22,color:"var(--muted)"}}>⬌</div>
                            {hNights>=0&&<div style={{background:"var(--accentBg2)",border:"1px solid var(--accentLine)",borderRadius:8,padding:"4px 10px",textAlign:"center"}}>
                              <div style={{fontFamily:mono,fontSize:16,fontWeight:700,color:"var(--accent)"}}>{hNights}</div>
                              <div style={{fontSize:9,color:"var(--ink2)",fontFamily:mono}}>{hNights===0?"same day":`night${hNights!==1?"s":""}`}</div>
                            </div>}
                            {hTotSlip>0&&<div style={{fontSize:10,color:hTotSlip>4*60?"var(--green2)":"var(--red)",fontFamily:mono,textAlign:"center"}}>{(hTotSlip/60).toFixed(1)}h{hTotSlip>4*60?" ✓":" ✗"}</div>}
                          </div>
                          <ICard border="var(--sage)" style={{display:"flex",flexDirection:"column",gap:9}}>
                            <div style={{fontSize:10,letterSpacing:1.5,color:"var(--green)",fontFamily:mono}}>CHECK-OUT</div>
                            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                              <DInput label="DATE" value={hotel.hotelTo} onChange={v=>updHotel(active, hotelIdx, "hotelTo", v)} hi/>
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                                  <span style={{fontSize:10,letterSpacing:1,color:"var(--green)",fontFamily:mono}}>TIME</span>
                                  {hRetDepTz&&<span style={{fontSize:9,color:"var(--muted)",fontFamily:mono,background:"var(--line)",borderRadius:3,padding:"1px 4px"}}>{tzLabel(hRetDepTz,hotel.hotelTo||dayDate)}</span>}
                                  <span style={{fontSize:9,color:"var(--green2)",fontFamily:mono}}>auto</span>
                                </div>
                                <input type="time" value={hotel.hotelCheckOut} onChange={e=>updHotel(active, hotelIdx, "hotelCheckOut", e.target.value)}
                                  style={{background:"var(--bg)",border:"1px solid var(--sage)",borderRadius:6,color:hotel.hotelCheckOut?"var(--ink)":"var(--muted)",padding:"5px 8px",fontFamily:mono,fontSize:15,width:"100%",maxWidth:120,minWidth:90}}/>
                              </div>
                            </div>
                          </ICard>
                        </div>

                        {sec.arrAirport&&(
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:hPerDayM.length>0?12:0,marginTop:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,background:`${mix(hDest.color,6)}`,border:`1px solid ${mix(hDest.color,19)}`,borderRadius:8,padding:"5px 10px"}}>
                              <span style={{fontSize:15}}>{hDest.flag}</span>
                              <div>
                                <div style={{fontSize:11,fontWeight:700,color:hDest.color}}>{hDest.label}</div>
                                <div style={{fontSize:9,color:"var(--ink2)",fontFamily:mono}}>B ${fmtAUD(hDest.breakfast)} · L ${fmtAUD(hDest.lunch)} · D ${fmtAUD(hDest.dinner)}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {hPerDayM.length>0&&hTotSlip>4*60&&(
                          <div>
                            <div style={{fontSize:10,color:"var(--muted)",fontFamily:mono,letterSpacing:1.5,marginBottom:7}}>MEAL COVERAGE PER CALENDAR DAY</div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {hPerDayM.map((pd)=>{
                                const calDays = hNights+1;
                                const isCI = pd.dayNum===1;
                                const isCO = pd.dayNum===calDays;
                                const tag  = isCI ? "CI" : isCO ? "CO" : `D${pd.dayNum}`;
                                const presStartStr = fmtTime(pd.presStart===1440 ? 0 : pd.presStart);
                                const presEndStr   = pd.presEnd===1440 ? "24:00" : fmtTime(pd.presEnd);
                                return (
                                  <div key={pd.dayNum} style={{display:"flex",alignItems:"center",gap:8,background:pd.isFullDay?"var(--greenBg)":"var(--bg)",border:`1px solid ${pd.isFullDay?"var(--greenLine)":"var(--line)"}`,borderRadius:8,padding:"7px 11px"}}>
                                    <div style={{fontFamily:mono,fontSize:11,fontWeight:700,color:pd.isFullDay?"var(--green)":"var(--ink2)",width:24,flexShrink:0}}>{tag}</div>
                                    <div style={{flexShrink:0,minWidth:100}}>
                                      <div style={{fontSize:10,color:"var(--muted)",fontFamily:mono,fontWeight:600}}>{fmtShort(pd.date)}</div>
                                      <div style={{fontSize:9,color:"var(--muted)",fontFamily:mono,marginTop:1}}>
                                        {pd.isFullDay ? "full day" : `${presStartStr}–${presEndStr}`}
                                      </div>
                                    </div>
                                    <div style={{display:"flex",gap:5,flex:1,flexWrap:"wrap"}}>
                                      {MEAL_WINDOWS.map(w=>{
                                        const ok=pd[w.id];
                                        return <div key={w.id} style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:5,background:ok?`${mix(w.color,8)}`:"transparent",border:`1px solid ${ok?w.color+"40":"var(--line)"}`,opacity:ok?1:0.3}}>
                                          <span style={{fontSize:11}}>{w.icon}</span>
                                          <span style={{fontSize:10,color:ok?w.color:"var(--muted)",fontFamily:mono}}>{ok?`$${fmtAUD(hDest[w.key])}`:"—"}</span>
                                        </div>;
                                      })}
                                    </div>
                                    <div style={{fontFamily:mono,fontSize:11,fontWeight:700,color:"var(--green)",minWidth:50,textAlign:"right"}}>
                                      ${fmtAUD((pd.b?hDest.breakfast:0)+(pd.l?hDest.lunch:0)+(pd.d?hDest.dinner:0))}
                                    </div>
                                  </div>
                                );
                              })}
                              {hTotSlip>24*60&&(()=>{
                                const incQty=Math.floor(hTotSlip/(24*60));
                                return <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--bg)",border:`1px solid color-mix(in srgb, var(--amber) 25%, transparent)`,borderRadius:8,padding:"6px 11px"}}>
                                  <span style={{fontSize:14}}>☕</span>
                                  <div style={{flex:1,fontSize:11,color:"var(--amber)"}}>Incidental ×{incQty} — {hDest.label} ({(hTotSlip/60).toFixed(1)}h slip — 1 per 24h)</div>
                                  <div style={{fontFamily:mono,fontSize:11,fontWeight:700,color:"var(--green)"}}>${fmtAUD(hDest.incidental*incQty)}</div>
                                </div>;
                              })()}
                            </div>
                            {/* Per-stay total — sums the meal rows and incidentals shown above so
                                a user can see at-a-glance what this hotel stay is worth. */}
                            {(() => {
                              const mealsTotal = hPerDayM.reduce((s, pd) =>
                                s + (pd.b ? hDest.breakfast : 0) + (pd.l ? hDest.lunch : 0) + (pd.d ? hDest.dinner : 0), 0);
                              const incTotal = hTotSlip > 24*60 ? Math.floor(hTotSlip/(24*60)) * hDest.incidental : 0;
                              const stayTotal = mealsTotal + incTotal;
                              if (stayTotal <= 0) return null;
                              return (
                                <div style={{
                                  display:"flex",alignItems:"center",justifyContent:"space-between",
                                  marginTop:9,padding:"8px 11px",
                                  background:"var(--greenBg)",border:"1px solid color-mix(in srgb, var(--green) 25%, transparent)",borderRadius:8,
                                }}>
                                  <div style={{fontSize:11,fontFamily:mono,color:"var(--ink2)",letterSpacing:1,fontWeight:600}}>
                                    HOTEL STAY TOTAL
                                  </div>
                                  <div style={{fontFamily:mono,fontSize:14,fontWeight:700,color:"var(--green)"}}>
                                    ${fmtAUD(stayTotal)}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              );
            })}

            {/* Add sector to end */}
            {!d.sectors[0]?.reservePeriod && (
              <button className="addBtn" onClick={()=>addSector(active)} style={{
                width:"100%",background:"var(--panel)",border:"1px dashed var(--muted)",borderRadius:10,
                color:"var(--ink2)",fontSize:12,cursor:"pointer",padding:"10px",
                fontFamily:mono,letterSpacing:0.5,marginBottom:12,
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>
                <span style={{fontSize:16}}>+</span> Add sector
              </button>
            )}

            {/* ── Hotel toggle (if none added yet) ── */}
            {!d.sectors[0]?.reservePeriod && !d.hasSlip&&(
              <Card style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <SHead style={{marginBottom:0}}>🏨 HOTEL STAY</SHead>
                  <Toggle label="Add hotel stay" checked={false} onChange={v=>toggleSlip(active,v)}/>
                </div>
              </Card>
            )}

            {/* ── Other ── */}
            {!d.sectors[0]?.reservePeriod && (
            <Card style={{marginBottom:14}}>
              <SHead>OTHER</SHead>
              <div style={{display:"flex",flexWrap:"wrap",gap:18,alignItems:"center"}}>
                <Toggle label="DDO infringed (Cl. 5.20/5.33)"            checked={d.ddoInfringed} onChange={v=>updDay(active,"ddoInfringed",v)} color="var(--red)"/>
                <Toggle label="Extra Duty Variation Allowance (Cl. 5.28)" checked={d.extraDva}   onChange={v=>updDay(active,"extraDva",v)}      color="var(--orange)"/>
                {/* Extra Day Off Payment — numeric stepper */}
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                    <span style={{fontSize:12,color:d.extraDdo>0?"var(--red)":"var(--ink2)"}}>Extra Day Off Payment (Cl. 5.20)</span>
                    <span style={{fontSize:10,color:"var(--muted)",fontFamily:mono}}>${fmtAUD(role==="cpt"?RATES.DDO_CPT:RATES.DDO_FO)} each</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"var(--bg)",border:`1px solid ${d.extraDdo>0?"var(--red)":"var(--line)"}`,borderRadius:8,padding:"4px 8px"}}>
                    <button onClick={()=>updDay(active,"extraDdo",Math.max(0,d.extraDdo-1))}
                      style={{background:"transparent",border:`1px solid ${d.extraDdo>0?"color-mix(in srgb, var(--red) 25%, transparent)":"var(--line)"}`,borderRadius:4,color:d.extraDdo>0?"var(--red)":"var(--ink2)",fontSize:15,cursor:"pointer",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,padding:0}}>−</button>
                    <span style={{fontFamily:mono,fontSize:16,fontWeight:700,color:d.extraDdo>0?"var(--red)":"var(--muted)",minWidth:18,textAlign:"center"}}>{d.extraDdo}</span>
                    <button onClick={()=>updDay(active,"extraDdo",d.extraDdo+1)}
                      style={{background:"transparent",border:"1px solid color-mix(in srgb, var(--red) 25%, transparent)",borderRadius:4,color:"var(--red)",fontSize:15,cursor:"pointer",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,padding:0}}>+</button>
                  </div>
                  {d.extraDdo>0&&<span style={{fontSize:11,fontFamily:mono,color:"var(--green)"}}>${fmtAUD((role==="cpt"?RATES.DDO_CPT:RATES.DDO_FO)*d.extraDdo)}</span>}
                </div>

                {/* Accommodation opt-out — numeric nights stepper */}
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                    <span style={{fontSize:12,color:d.accomOptOut>0?"var(--indigo)":"var(--ink2)"}}>Accommodation opt-out (Cl. 6.32)</span>
                    <span style={{fontSize:10,color:"var(--muted)",fontFamily:mono}}>${fmtAUD(RATES.ACCOM_OPTOUT)} × nights</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"var(--bg)",border:`1px solid ${d.accomOptOut>0?"var(--indigo)":"var(--line)"}`,borderRadius:8,padding:"4px 8px"}}>
                    <button onClick={()=>updDay(active,"accomOptOut",Math.max(0,d.accomOptOut-1))}
                      style={{background:"transparent",border:`1px solid ${d.accomOptOut>0?"color-mix(in srgb, var(--indigo) 25%, transparent)":"var(--line)"}`,borderRadius:4,color:d.accomOptOut>0?"var(--indigo)":"var(--ink2)",fontSize:15,cursor:"pointer",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,padding:0}}>−</button>
                    <span style={{fontFamily:mono,fontSize:16,fontWeight:700,color:d.accomOptOut>0?"var(--indigo)":"var(--muted)",minWidth:18,textAlign:"center"}}>{d.accomOptOut}</span>
                    <button onClick={()=>updDay(active,"accomOptOut",d.accomOptOut+1)}
                      style={{background:"transparent",border:"1px solid color-mix(in srgb, var(--indigo) 25%, transparent)",borderRadius:4,color:"var(--indigo)",fontSize:15,cursor:"pointer",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,padding:0}}>+</button>
                  </div>
                  {d.accomOptOut>0&&<span style={{fontSize:11,fontFamily:mono,color:"var(--green)"}}>${fmtAUD(RATES.ACCOM_OPTOUT*d.accomOptOut)}</span>}
                </div>
              </div>
            </Card>
            )}

            {/* ── Results ── */}
            {(()=>{
              const dateItems = dateAllowanceMap[dayDate]?.items || [];
              const dateTotal = dateAllowanceMap[dayDate]?.total || 0;
              const sourceDays = dateAllowanceMap[dayDate]?.sourceDays || new Set();
              const hasSpillOver = sourceDays.size > 1 || (sourceDays.size === 1 && !sourceDays.has("current:"+active));

              // Full trip allowances for this entry day (all items across all dates from this day's data)
              const fullTripItems = dayResults[active];
              const fullTripTotal = dayTotals[active];
              // Check if this entry day has multi-day allowances (items on dates beyond the entry date)
              const entryByDate = calcAllowancesByDate(days[active], role, yearIdx, dayDate);
              const entryDates = Object.keys(entryByDate).sort();
              const isMultiDay = entryDates.length > 1 || (entryDates.length === 1 && entryDates[0] !== dayDate);

              return <>
                {/* Full trip summary — shown on the entry day when trip spans multiple dates */}
                {isMultiDay && fullTripItems.length > 0 && (
                  <>
                    <div style={{fontSize:11,letterSpacing:2,color:"var(--accent)",fontFamily:mono,marginBottom:10}}>
                      FULL TRIP ALLOWANCES — {active} {fmtShort(dayDate)}
                      <span style={{color:"var(--purple)",marginLeft:8,fontSize:10,letterSpacing:1}}>ENTIRE TRIP</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                      {(()=>{const g={};fullTripItems.forEach(it=>{const cl=it.label.replace(/\s*\((pre|post)-midnight\)\s*$/,"");const k=cl;if(!g[k])g[k]={...it,label:cl,count:0,amount:0};g[k].count++;g[k].amount+=it.amount;});return Object.values(g);})().map((item,i)=>(
                        <div key={`trip-${i}`} style={{background:`${mix(item.color,6)}`,border:`1px solid ${mix(item.color,19)}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
                          <span style={{fontSize:17,flexShrink:0}}>{item.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                                <span style={{fontSize:14,fontWeight:700,color:item.color}}>{item.count>1?`${item.count}× `:""}{item.label}</span>
                                <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,color:item.color,border:`1px solid ${mix(item.color,25)}`,borderRadius:3,padding:"1px 4px",background:`${mix(item.color,6)}`,fontFamily:mono}}>{item.clause}</span>
                              </div>
                              {item.amount>0&&<span style={{fontFamily:mono,fontSize:16,fontWeight:700,color:"var(--green)",whiteSpace:"nowrap"}}>${fmtAUD(item.amount)}</span>}
                            </div>
                            <div style={{fontSize:11,color:"var(--ink2)",marginTop:3,lineHeight:1.5}}>{item.reason}</div>
                          </div>
                        </div>
                      ))}
                      <div style={{background:"linear-gradient(135deg,var(--accentBg),var(--bg))",border:"1px solid var(--accentLine)",borderRadius:10,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                        <span style={{fontSize:11,letterSpacing:1.5,color:"var(--accent)",fontFamily:mono}}>TRIP TOTAL — {active} {fmtShort(dayDate)}</span>
                        <span style={{fontFamily:mono,fontSize:18,fontWeight:700,color:"var(--accent)",textShadow:"0 0 20px rgba(56,189,248,0.35)"}}>AUD ${fmtAUD(fullTripTotal)}</span>
                      </div>
                    </div>

                    {/* Per-date breakdown — uses dateAllowanceMap so totals match day pills */}
                    <div style={{fontSize:11,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:10}}>
                      PER-DATE BREAKDOWN
                    </div>
                    {entryDates.map(dt => {
                      // Use dateAllowanceMap (aggregates across all days) rather than entryByDate
                      const items = dateAllowanceMap[dt]?.items || entryByDate[dt] || [];
                      const dtTotal = items.reduce((s,i) => s + i.amount, 0);
                      const isEntryDate = dt === dayDate;
                      return (
                        <div key={dt} style={{marginBottom:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                            <span style={{fontSize:12,fontWeight:700,color:isEntryDate?"var(--ink)":"var(--purple)",fontFamily:mono}}>{fmtFull(dt)}</span>
                            {!isEntryDate && <span style={{fontSize:9,fontWeight:700,letterSpacing:0.8,color:"var(--purple)",border:"1px solid color-mix(in srgb, var(--purple) 25%, transparent)",borderRadius:3,padding:"1px 4px",background:"color-mix(in srgb, var(--purple) 6%, transparent)",fontFamily:mono}}>SPILL-OVER</span>}
                            <span style={{fontSize:12,fontFamily:mono,fontWeight:700,color:"var(--green)",marginLeft:"auto"}}>${fmtAUD(dtTotal)}</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginLeft:8}}>
                            {items.map((item,i) => (
                              <span key={i} style={{fontSize:10,padding:"3px 6px",borderRadius:5,background:`${mix(item.color,8)}`,color:item.color,border:`1px solid ${mix(item.color,19)}`,fontWeight:600,fontFamily:mono,
                                ...(!isEntryDate ? {borderStyle:"dashed"} : {})}}>
                                {item.icon} {item.label}{item.amount>0?` $${fmtAUD(item.amount)}`:""}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Standard per-date view (non-multi-day entries, or spill-over from other days) */}
                {!isMultiDay && (
                  <>
                    <div style={{fontSize:11,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:10}}>
                      AUTO-CALCULATED ALLOWANCES — {active} {fmtShort(dayDate)}
                      {hasSpillOver && <span style={{color:"var(--purple)",marginLeft:8,fontSize:10,letterSpacing:1}}>INCLUDES MULTI-DAY</span>}
                    </div>
                    {dateItems.length===0
                      ?<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:24,textAlign:"center",color:"var(--muted)",fontSize:14}}>
                        No allowances triggered — enter sector times above
                      </div>
                      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {dateItems.map((item,i)=>{
                          const isFromOtherDay = !dayResults[active]?.some(orig =>
                            orig.id === item.id && Math.abs(orig.amount - item.amount) < 0.01
                          );
                          return (
                            <div key={i} style={{background:`${mix(item.color,6)}`,border:`1px solid ${mix(item.color,19)}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10,
                              ...(isFromOtherDay ? {borderStyle:"dashed"} : {})}}>
                              <span style={{fontSize:17,flexShrink:0}}>{item.icon}</span>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                                    <span style={{fontSize:14,fontWeight:700,color:item.color}}>{item.label}</span>
                                    <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,color:item.color,border:`1px solid ${mix(item.color,25)}`,borderRadius:3,padding:"1px 4px",background:`${mix(item.color,6)}`,fontFamily:mono}}>{item.clause}</span>
                                    {isFromOtherDay && <span style={{fontSize:9,fontWeight:700,letterSpacing:0.8,color:"var(--purple)",border:"1px solid color-mix(in srgb, var(--purple) 25%, transparent)",borderRadius:3,padding:"1px 4px",background:"color-mix(in srgb, var(--purple) 6%, transparent)",fontFamily:mono}}>FROM OTHER DAY</span>}
                                  </div>
                                  {item.amount>0&&<span style={{fontFamily:mono,fontSize:16,fontWeight:700,color:"var(--green)",whiteSpace:"nowrap"}}>${fmtAUD(item.amount)}</span>}
                                </div>
                                <div style={{fontSize:11,color:"var(--ink2)",marginTop:3,lineHeight:1.5}}>{item.reason}</div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{background:"var(--accentBg2)",border:"1px solid var(--accentLine)",borderRadius:10,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                          <span style={{fontSize:11,letterSpacing:1.5,color:"var(--ink2)",fontFamily:mono}}>TOTAL — {active} {fmtShort(dayDate)}</span>
                          <span style={{fontFamily:mono,fontSize:18,fontWeight:700,color:"var(--accent)",textShadow:"0 0 20px rgba(56,189,248,0.35)"}}>AUD ${fmtAUD(dateTotal)}</span>
                        </div>
                      </div>
                    }
                  </>
                )}
              </>;
            })()}
          </div>
        )}

        {/* ══ MEAL RATES ══ */}
        {tab==="rates"&&(()=>{
          const mealRates = MEAL_RATE_YEARS[mealRateYear].rates;
          return (
          <div className="fadein">
            <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:4}}>EFA EA 2025 — CL. 6.22–6.24</div>
                <div style={{fontFamily:heading,fontSize:25,fontWeight:700,color:"var(--ink)"}}>Meal Allowance Schedule</div>
              </div>
              <select value={mealRateYear} onChange={e=>setMealRateYear(+e.target.value)} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,color:"var(--accent)",padding:"6px 12px",fontFamily:mono,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                {MEAL_RATE_YEARS.map((yr,i)=><option key={i} value={i}>{yr.label}</option>)}
              </select>
            </div>
            <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
              <div style={{padding:"9px 14px",fontSize:11,letterSpacing:2,color:"var(--muted)",fontFamily:mono,borderBottom:"1px solid var(--line)"}}>AIRPORT → MEAL ZONE</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))"}}>
                {AIRPORTS.map(ap=>{
                  const dest=mealRates[zoneFrom(ap.code)];
                  return <div key={ap.code} style={{padding:"11px 14px",borderRight:"1px solid var(--line2)",borderBottom:"1px solid var(--line2)",display:"flex",alignItems:"center",gap:9}}>
                    <div style={{fontSize:20}}>{ap.flag}</div>
                    <div>
                      <div style={{fontFamily:mono,fontSize:14,fontWeight:700,color:"var(--ink)"}}>{ap.code}</div>
                      <div style={{fontSize:12,color:"var(--ink2)"}}>{ap.name}</div>
                      <div style={{fontSize:10,fontWeight:700,color:dest.color,marginTop:1}}>{dest.flag} {dest.label}</div>
                    </div>
                  </div>;
                })}
              </div>
            </Card>
            <Card style={{padding:0,overflow:"hidden"}}>
              <div className="rates-grid" style={{borderBottom:"1px solid var(--line)"}}>
                <div style={{padding:"9px 14px",fontSize:10,letterSpacing:1.5,color:"var(--ink2)",fontFamily:mono,borderRight:"1px solid var(--line)"}}>ALLOWANCE</div>
                {Object.values(mealRates).map((dest,i)=>(
                  <div key={i} style={{padding:"9px 12px",borderRight:i<3?"1px solid var(--line)":"none"}}>
                    <div style={{fontSize:16}}>{dest.flag}</div>
                    <div style={{fontSize:11,fontWeight:700,color:dest.color,marginTop:2,lineHeight:1.3}}>{dest.label}</div>
                  </div>
                ))}
              </div>
              {[
                {label:"Breakfast",icon:"🍳",clause:"Cl. 6.24(a)",win:"0730–0930",key:"breakfast",color:"var(--yellow)"},
                {label:"Lunch",icon:"🥗",clause:"Cl. 6.24(b)",win:"1130–1330",key:"lunch",color:"var(--green)"},
                {label:"Dinner",icon:"🍽️",clause:"Cl. 6.24(c)",win:"1730–1930",key:"dinner",color:"var(--orange)"},
                {label:"Total (meals only)",icon:"∑",clause:"",win:"",key:"_t",color:"var(--slate)",sub:true},
                {label:"Incidental",icon:"☕",clause:"Cl. 6.24",win:">24h",key:"incidental",color:"var(--amber)"},
                {label:"Total (inc. incidental)",icon:"★",clause:"",win:"",key:"_ti",color:"var(--accent)",bold:true},
              ].map((row,ri,arr)=>(
                <div key={row.key} className="rates-grid" style={{borderBottom:ri<arr.length-1?"1px solid var(--line2)":"none",background:row.bold?"var(--accentBg2)":row.sub?"var(--bg)":"transparent"}}>
                  <div style={{padding:"10px 14px",borderRight:"1px solid var(--line)",display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:16}}>{row.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:row.bold?800:600,color:row.bold?"var(--ink)":row.sub?"var(--ink2)":"var(--muted)"}}>{row.label}</div>
                      {row.clause&&<div style={{fontSize:9,color:"var(--muted)",fontFamily:mono,marginTop:1}}>{row.clause}{row.win?` · ${row.win}`:""}</div>}
                    </div>
                  </div>
                  {Object.values(mealRates).map((dest,i)=>{
                    const val=row.key==="_t"?dest.breakfast+dest.lunch+dest.dinner:row.key==="_ti"?dest.breakfast+dest.lunch+dest.dinner+dest.incidental:dest[row.key];
                    return <div key={i} style={{padding:"10px 12px",borderRight:i<3?"1px solid var(--line)":"none",textAlign:"right"}}>
                      <span style={{fontFamily:mono,fontSize:row.bold?14:12,fontWeight:row.bold?700:500,color:row.bold?"var(--accent)":row.sub?"var(--ink2)":"var(--ink)"}}>${fmtAUD(val)}</span>
                    </div>;
                  })}
                </div>
              ))}
            </Card>
          </div>
          );
        })()}

        {/* ══ WEEK SUMMARY ══ */}
        {tab==="summary"&&(
          <div className="fadein">
            <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:4}}>WEEK OF {fmtFull(weekStart)}</div>
                <div style={{fontFamily:heading,fontSize:27,fontWeight:700,color:"var(--ink)"}}>Week Summary</div>
                <div style={{fontSize:12,color:"var(--ink2)",marginTop:3,fontFamily:mono}}>{role==="cpt"?"Captain":"First Officer"} · {INDEX_YEARS[yearIdx].label}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:3,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,padding:"3px 6px"}}>
                  <span style={{fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,marginRight:3}}>WEEK OF</span>
                  <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{background:"transparent",border:"none",color:"var(--ink2)",fontSize:16,cursor:"pointer",padding:"0 3px",lineHeight:1,fontFamily:mono}}>‹</button>
                  <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                    <span style={{fontFamily:mono,fontSize:13,color:"var(--accent)",userSelect:"none",minWidth:84,textAlign:"center"}}>
                      {fmtShort(weekStart)} {parseDate(weekStart)?.getUTCFullYear()}
                    </span>
                    <input type="date" value={weekStart} onChange={e=>setWeekStart(getMon(e.target.value))}
                      style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",colorScheme:"inherit"}}/>
                  </div>
                  <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{background:"transparent",border:"none",color:"var(--ink2)",fontSize:16,cursor:"pointer",padding:"0 3px",lineHeight:1,fontFamily:mono}}>›</button>
                </div>
                <button onClick={()=>{
                  const entries=DAY_NAMES.map((dn,i)=>({dayName:dn,tripDate:dateFor(i),day:days[dn]}));
                  downloadCsv(`EFA-Week-${weekStart}.csv`,entries,role,yearIdx,`Week of ${fmtFull(weekStart)}`);
                }} style={{background:"var(--accentBg)",border:"1px solid var(--accentLine)",borderRadius:8,color:"var(--accent)",fontSize:12,fontWeight:700,cursor:"pointer",padding:"8px 16px",fontFamily:mono,letterSpacing:0.5,display:"flex",alignItems:"center",gap:6}}>
                  📥 Export CSV
                </button>
              </div>
            </div>
            <div style={{background:"linear-gradient(135deg,var(--accentBg),var(--bg))",border:"1px solid var(--accentLine)",borderRadius:14,padding:"16px 20px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:4}}>TOTAL ALLOWANCES — WEEK</div>
                <div style={{fontFamily:mono,fontSize:38,fontWeight:700,color:"var(--accent)",letterSpacing:-1.5,textShadow:"0 0 30px rgba(56,189,248,0.25)"}}>AUD ${fmtAUD(weekTotalByDate)}</div>
              </div>
              <div style={{fontSize:44,opacity:0.06}}>✈</div>
            </div>
            <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
              {DAY_NAMES.map((day,di)=>{
                const dt=dateFor(di);
                const dateData=dateAllowanceMap[dt];
                const items=dateData?.items||[];
                const t=dateData?.total||0;
                const hasSpillOver=dateData?.sourceDays?.size>1||(dateData?.sourceDays?.size===1&&!dateData?.sourceDays?.has("current:"+day));
                const secs=days[day].sectors;
                const first=secs[0],last=secs[secs.length-1];
                const nt=daysBetween(days[day].hotelFrom,days[day].hotelTo);
                return (
                  <div key={day} className="hrow summary-row" onClick={()=>{setActive(day);setTab("entry");}} style={{borderBottom:di<6?"1px solid var(--line2)":"none",cursor:"pointer",transition:"background 0.15s"}}>
                    <div style={{padding:"10px 12px",borderRight:"1px solid var(--line)"}}>
                      <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                        <span style={{fontFamily:mono,fontSize:12,fontWeight:700,color:(day==="SAT"||day==="SUN")?"var(--red2)":t>0?"var(--muted)":"var(--muted)"}}>{day}</span>
                        <span style={{fontSize:12,fontWeight:600,color:t>0?"var(--accent)":"var(--muted)"}}>{fmtShort(dt)}</span>
                      </div>
                      {secs[0]?.reservePeriod
                        ? <div style={{fontSize:9,color:"var(--purple)",fontFamily:mono,marginTop:1,fontWeight:700}}>Reserve</div>
                        : (first?.depAirport&&last?.arrAirport&&<div style={{fontSize:9,color:"var(--ink2)",fontFamily:mono,marginTop:1}}>{first.depAirport}→{last.arrAirport}{secs.length>2?` (${secs.length}sec)`:""}</div>)}
                      {nt>0&&<div style={{fontSize:9,color:"var(--blue)",fontFamily:mono,marginTop:1}}>🏨 {nt}n</div>}
                      {hasSpillOver&&<div style={{fontSize:9,color:"var(--purple)",fontFamily:mono,marginTop:1}}>+ multi-day</div>}
                    </div>
                    <div style={{padding:"10px 12px",borderRight:"1px solid var(--line)"}}>
                      {items.length>0
                        ?<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{items.map((item,i)=>{
                          const isFromOtherDay=!dayResults[day]?.some(orig=>orig.id===item.id&&Math.abs(orig.amount-item.amount)<0.01);
                          return <span key={i} style={{fontSize:10,padding:"2px 5px",borderRadius:4,background:`${mix(item.color,8)}`,color:item.color,border:`1px solid ${mix(item.color,19)}`,fontWeight:600,fontFamily:mono,
                            ...(isFromOtherDay?{borderStyle:"dashed"}:{})}}>
                            {item.icon} {item.label}{item.amount>0?` $${fmtAUD(item.amount)}`:""}</span>;
                        })}</div>
                        :<span style={{fontSize:12,color:"var(--line)"}}>{days[day].sectors[0]?.aSignOn?"No allowances triggered":"No data entered"}</span>
                      }
                    </div>
                    <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:15,fontWeight:700,color:t>0?"var(--green)":"var(--line)"}}>{t>0?`$${fmtAUD(t)}`:"—"}</div>
                  </div>
                );
              })}
              <div className="summary-row" style={{background:"var(--accentBg2)",borderTop:"1px solid var(--accentLine)"}}>
                <div style={{padding:"10px 12px"}}/>
                <div style={{padding:"10px 12px",fontSize:10,color:"var(--ink2)",fontFamily:mono}}>{DAY_NAMES.reduce((s,day)=>{const dt=dateFor(DAY_NAMES.indexOf(day));return s+(dateAllowanceMap[dt]?.items?.filter(i=>i.amount>0)?.length||0);},0)} allowance items</div>
                <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:17,fontWeight:700,color:weekTotalByDate>0?"var(--accent)":"var(--muted)",textShadow:weekTotalByDate>0?"0 0 20px rgba(56,189,248,0.3)":"none"}}>{weekTotalByDate>0?`$${fmtAUD(weekTotalByDate)}`:"—"}</div>
              </div>
            </Card>
            {(()=>{
              const by={};
              DAY_NAMES.forEach((day,di)=>{
                const dt=dateFor(di);
                (dateAllowanceMap[dt]?.items||[]).forEach(item=>{
                  const isDHA = /Duty Hour Allowance/.test(item.label);
                  const key = isDHA ? "Duty Hour Allowance" : item.label.replace(/\s*\((pre|post)-midnight\)\s*$/,"");
                  if(!by[key])by[key]={...item,label:key,count:0,total:0};
                  by[key].count++;by[key].total+=item.amount;
                });
              });
              const sorted=Object.values(by).sort((a,b)=>b.total-a.total);
              if(!sorted.length) return null;
              return <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,gap:10,flexWrap:"wrap"}}>
                  <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>ALLOWANCE TYPE BREAKDOWN</div>
                  <button onClick={()=>setShowTypeBreakdown(!showTypeBreakdown)}
                    style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                    {showTypeBreakdown ? "Hide" : "Show"}
                  </button>
                </div>
                {showTypeBreakdown && (
                  <div className="type-breakdown">
                    {sorted.map((item,si)=>(
                      <div key={`wt-${si}`} style={{background:"var(--panel)",border:`1px solid ${mix(item.color,15)}`,borderRadius:10,padding:"11px 13px",display:"flex",alignItems:"center",gap:9}}>
                        <span style={{fontSize:18}}>{item.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:item.color}}>{item.label}{item.count>1?` × ${item.count}`:""}</div>
                          <div style={{fontSize:10,color:"var(--ink2)",marginTop:1}}>{item.count>1&&item.rate>0?`$${fmtAUD(item.rate)} each · `:""}{item.clause}</div>
                        </div>
                        <div style={{fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--green)"}}>{item.total>0?`$${fmtAUD(item.total)}`:"—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>;
            })()}
          </div>
        )}

        {/* ══ MONTHLY SUMMARY ══ */}
        {tab==="monthly"&&(()=>{
          const { mvYear, mvMonth, monthName, useCustom, rangeLabel, weeksInRange,
                  monthTypes, trips, dhaItems, dhaTotal, dhaCarryDeltaHrs, dhaCarryInHrs, dhaRateForItems,
                  mealItems, mealTotal, stays, creditItems, creditTotal, headerCreditDelta, creditCarryInHrs,
                  bpHdr, overtimeHrs, overtimePay, effectiveYos, useYos,
                  selectedBpForItems, bpHdrItems,
                  isBpSelected, includeOvertime, monthGrandTotal }
            = derivePeriod({ allWeeks, rosterBPs, role, aircraft, yos, yearIdx,
                             pilotJoiningDate, customFrom, customTo, monthView });

          return (
            <div className="fadein">
              {/* Month navigator */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:4}}>ALLOWANCE SUMMARY</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>{const d=new Date(mvYear,mvMonth-2,1);setMonthView(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);setCustomFrom("");setCustomTo("");}}
                      style={{background:"transparent",border:"none",color:"var(--ink2)",fontSize:18,cursor:"pointer",fontFamily:mono,padding:"0 4px",opacity:useCustom?0.2:1}}>‹</button>
                    <div style={{fontFamily:heading,fontSize:27,fontWeight:700,color:"var(--ink)"}}>{useCustom ? (rosterBPs.find(b=>b.from===customFrom&&b.to===customTo) ? `BP ${rosterBPs.find(b=>b.from===customFrom&&b.to===customTo).bp}` : "Custom Range") : `${monthName} ${mvYear}`}</div>
                    <button onClick={()=>{const d=new Date(mvYear,mvMonth,1);setMonthView(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);setCustomFrom("");setCustomTo("");}}
                      style={{background:"transparent",border:"none",color:"var(--ink2)",fontSize:18,cursor:"pointer",fontFamily:mono,padding:"0 4px",opacity:useCustom?0.2:1}}>›</button>
                  </div>
                  {useCustom && (() => {
                    const matchedBp = rosterBPs.find(b => b.from === customFrom && b.to === customTo);
                    const dateLine = matchedBp
                      ? <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 3, fontFamily: mono }}>({fmtFull(customFrom)} — {fmtFull(customTo)})</div>
                      : <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 3, fontFamily: mono }}>{fmtFull(customFrom)} — {fmtFull(customTo)}</div>;
                    const carry = matchedBp?.headerCarry;
                    const carryLine = (carry && (carry.carriedInDuty || carry.carriedOutDuty || carry.carriedInCredit || carry.carriedOutCredit))
                      ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontFamily: mono, letterSpacing: 0.2 }}>
                          <span style={{color:"var(--purple)"}}>Qantas header</span> · duty in/out {carry.carriedInDuty || "0:00"}/{carry.carriedOutDuty || "0:00"} · credit in/out {carry.carriedInCredit || "0:00"}/{carry.carriedOutCredit || "0:00"}{carry.carriedInPrintedDuty !== "0:00" ? ` · ${carry.carriedInPrintedDuty} of the carry-in already on this roster` : ""}
                        </div>
                      : null;
                    return <>{dateLine}{carryLine}</>;
                  })()}
                  <div style={{fontSize:12,color:"var(--ink2)",marginTop:3,fontFamily:mono}}>{role==="cpt"?"Captain":"First Officer"} · {INDEX_YEARS[yearIdx].label}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <input type="month" value={monthView} onChange={e=>{setMonthView(e.target.value);setCustomFrom("");setCustomTo("");}}
                      style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,color:"var(--accent)",padding:"6px 10px",fontFamily:mono,fontSize:13,colorScheme:"inherit",cursor:"pointer",opacity:useCustom?0.2:1}}/>
                    <button onClick={()=>{
                      const allEntries=[];
                      weeksInRange.forEach(ws=>{
                        const wDays=allWeeks[ws];
                        DAY_NAMES.forEach((dn,i)=>{
                          allEntries.push({dayName:dn,tripDate:weekDate(ws,i),day:wDays[dn]});
                        });
                      });
                      downloadCsv(`EFA-${useCustom?"Custom":monthName}-${mvYear}.csv`,allEntries,role,yearIdx,rangeLabel);
                    }} style={{background:"var(--accentBg)",border:"1px solid var(--accentLine)",borderRadius:8,color:"var(--accent)",fontSize:12,fontWeight:700,cursor:"pointer",padding:"8px 16px",fontFamily:mono,letterSpacing:0.5,display:"flex",alignItems:"center",gap:6}}>
                      📥 Export CSV
                    </button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:"var(--muted)",fontFamily:mono}}>Custom range:</span>
                    <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                      style={{background:"var(--panel)",border:`1px solid ${useCustom?"var(--accent)":"var(--line)"}`,borderRadius:6,color:customFrom?"var(--ink)":"var(--muted)",padding:"4px 8px",fontFamily:mono,fontSize:12,colorScheme:"inherit",cursor:"pointer"}}/>
                    <span style={{fontSize:12,color:"var(--muted)"}}>—</span>
                    <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
                      style={{background:"var(--panel)",border:`1px solid ${useCustom?"var(--accent)":"var(--line)"}`,borderRadius:6,color:customTo?"var(--ink)":"var(--muted)",padding:"4px 8px",fontFamily:mono,fontSize:12,colorScheme:"inherit",cursor:"pointer"}}/>
                    {rosterBPs.map(b=>{
                      const isActive = customFrom===b.from && customTo===b.to;
                      return <button key={b.bp} onClick={()=>{setCustomFrom(b.from);setCustomTo(b.to);setMonthView(b.from.slice(0,7));setYearIdx(ebaYearIdxForDate(b.from));}}
                        style={{background:isActive?"var(--accentBg)":"var(--panel)",border:`1px solid ${isActive?"var(--accent)":"var(--line)"}`,borderRadius:6,color:isActive?"var(--accent)":"var(--ink2)",fontSize:11,fontWeight:700,cursor:"pointer",padding:"4px 10px",fontFamily:mono,letterSpacing:0.5}}>
                        BP {b.bp}
                      </button>;
                    })}
                  </div>
                </div>
              </div>

              {/* Monthly total card */}
              <div style={{background:"linear-gradient(135deg,var(--accentBg),var(--bg))",border:"1px solid var(--accentLine)",borderRadius:14,padding:"16px 20px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:4}}>TOTAL ALLOWANCES — {useCustom ? "CUSTOM RANGE" : `${monthName.toUpperCase()} ${mvYear}`}</div>
                  <div style={{fontFamily:mono,fontSize:38,fontWeight:700,color:monthGrandTotal>0?"var(--accent)":"var(--muted)",letterSpacing:-1.5,textShadow:monthGrandTotal>0?"0 0 30px rgba(56,189,248,0.25)":"none"}}>
                    AUD ${fmtAUD(monthGrandTotal)}
                  </div>
                  <div style={{fontSize:11,color:"var(--ink2)",marginTop:3,fontFamily:mono}}>
                    {weeksInRange.length} week{weeksInRange.length!==1?"s":""} with data
                    {includeOvertime && overtimePay>0&&<span style={{color:"var(--yellow)",fontWeight:700}}> · incl. overtime ${fmtAUD(overtimePay)} ({overtimeHrs.toFixed(2)}h over 70h)</span>}
                    {includeOvertime && overtimeHrs>0&&yos<0&&<span style={{color:"var(--red)",fontWeight:700}}> · overtime pending (select YOS!)</span>}
                    {!isBpSelected && overtimeHrs>0&&<span style={{color:"var(--muted)",fontStyle:"italic"}}> · overtime excluded (select a BP to include)</span>}
                  </div>
                </div>
                <div style={{fontSize:44,opacity:0.06}}>📅</div>
              </div>

              {/* Per-week breakdown */}
              {weeksInRange.length===0 ? (
                <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:32,textAlign:"center",color:"var(--muted)",fontSize:14}}>
                  No weeks entered for {useCustom ? "this date range" : `${monthName} ${mvYear}`}.<br/>
                  <span style={{fontSize:12,marginTop:6,display:"block"}}>Enter duty data in the week view then return here to see the summary.</span>
                </div>
              ) : (
                <>
                  {/* Trips breakdown */}
                  {trips.length>0&&(
                    <>
                      <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:9}}>PATTERNS — {trips.length}</div>
                      <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
                        {trips.map((trip,ti)=>(
                          <div key={`${trip.ws}-${trip.dn}`} className="hrow" onClick={()=>{setWeekStart(trip.ws);setActive(trip.dn);setTab("entry");}}
                            style={{display:"grid",gridTemplateColumns:"minmax(140px,auto) 1fr minmax(100px,auto)",borderBottom:"1px solid var(--line2)",cursor:"pointer",transition:"background 0.15s"}}>
                            <div style={{padding:"11px 14px",borderRight:"1px solid var(--line)"}}>
                              <div style={{fontSize:12,fontWeight:700,color:"var(--ink)",fontFamily:mono}}>{fmtShort(trip.tripFrom)}{trip.tripFrom!==trip.tripTo?` - ${fmtShort(trip.tripTo)}`:""}</div>
                              {trip.route&&<div style={{fontSize:10,color:"var(--ink2)",fontFamily:mono,marginTop:2}}>{trip.route}</div>}
                              <div style={{fontSize:9,color:"var(--muted)",fontFamily:mono,marginTop:1}}>{trip.isReserve?"Reserve":`${trip.sectorCount} sector${trip.sectorCount!==1?"s":""}`} · {trip.dn}</div>
                            </div>
                            <div style={{padding:"11px 14px",borderRight:"1px solid var(--line)"}}>
                              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                {trip.byType.map((item,bi)=>{
                                  const isDHA = /Duty Hour Allowance/.test(item.label);
                                  return <span key={`${item.id}-${bi}`} style={{fontSize:10,padding:"2px 5px",borderRadius:4,background:`${mix(item.color,8)}`,color:item.color,border:`1px solid ${mix(item.color,19)}`,fontWeight:600,fontFamily:mono}}>
                                    {item.icon} {item.count>1&&!isDHA?`${item.count}× ${item.label} $${fmtAUD(item.rate)}`:`${item.label} $${fmtAUD(item.total)}`}
                                  </span>;
                                })}
                              </div>
                            </div>
                            <div style={{padding:"11px 16px",textAlign:"right",fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--green)"}}>
                              ${fmtAUD(trip.tripTotal)}
                            </div>
                          </div>
                        ))}
                        {(() => {
                          const tripsSum = trips.reduce((s, t) => s + (t.tripTotal || 0), 0);
                          return (
                            <div style={{display:"grid",gridTemplateColumns:"minmax(140px,auto) 1fr minmax(100px,auto)",background:"var(--accentBg2)",borderTop:"1px solid var(--accentLine)"}}>
                              <div style={{padding:"10px 14px",fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1}}>PATTERNS TOTAL</div>
                              <div style={{padding:"10px 14px",fontSize:10,color:"var(--ink2)",fontFamily:mono}}>{trips.length} pattern{trips.length!==1?"s":""} · full pattern totals (excludes BP carry adjustment)</div>
                              <div style={{padding:"10px 16px",textAlign:"right",fontFamily:mono,fontSize:16,fontWeight:700,color:"var(--accent)"}}>${fmtAUD(tripsSum)}</div>
                            </div>
                          );
                        })()}
                      </Card>
                    </>
                  )}

                  {/* Monthly allowance type breakdown */}
                  {monthTypes.length>0&&(
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,gap:10,flexWrap:"wrap"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>ALLOWANCE TYPE BREAKDOWN{useCustom ? "" : ` — ${monthName.toUpperCase()}`}</div>
                        <button onClick={()=>setShowTypeBreakdown(!showTypeBreakdown)}
                          style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                          {showTypeBreakdown ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showTypeBreakdown && (
                        <div className="type-breakdown">
                          {monthTypes.map((item,mi)=>(
                            <div key={`mt-${mi}`} style={{background:"var(--panel)",border:`1px solid ${mix(item.color,15)}`,borderRadius:10,padding:"11px 13px",display:"flex",alignItems:"center",gap:9}}>
                              <span style={{fontSize:18}}>{item.icon}</span>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:600,color:item.color}}>{item.label}{item.count>1?` × ${item.count}`:""}</div>
                                <div style={{fontSize:10,color:"var(--ink2)",marginTop:1}}>{item.count>1&&item.rate>0?`$${fmtAUD(item.rate)} each · `:""}{item.clause}</div>
                              </div>
                              <div style={{fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--green)"}}>${fmtAUD(item.total)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* DHA Allowances — flat list of every DHA payment in range */}
                  {dhaItems.length>0&&(
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,marginTop:18,gap:10,flexWrap:"wrap"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>DHA ALLOWANCES — {dhaItems.length} ITEM{dhaItems.length!==1?"S":""}</div>
                        <button onClick={()=>setShowDhaList(!showDhaList)}
                          style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                          {showDhaList ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showDhaList && (
                        <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
                          {dhaItems.map((item,ix)=>{
                            const shortLabel = item.label.replace(/^Duty Hour Allowance\s*—\s*/, "");
                            return (
                              <div key={`dha-${ix}`} style={{display:"grid",gridTemplateColumns:"minmax(90px,auto) 1fr minmax(80px,auto)",borderBottom:"1px solid var(--line2)",alignItems:"center"}}>
                                <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                  <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",fontFamily:mono}}>{fmtShort(item.date)}</div>
                                </div>
                                <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                  <div style={{fontSize:12,fontWeight:600,color:item.color,lineHeight:1.35}}>🕐 {shortLabel}</div>
                                  {item.reason&&<div style={{fontSize:10,color:"var(--ink2)",marginTop:2,fontFamily:mono,lineHeight:1.4}}>{item.reason}</div>}
                                </div>
                                <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:"var(--green)"}}>${fmtAUD(item.amount)}</div>
                              </div>
                            );
                          })}
                          {bpHdrItems && (bpHdrItems.carriedInDuty !== "0:00" || bpHdrItems.carriedOutDuty !== "0:00") && (
                            <div style={{display:"grid",gridTemplateColumns:"minmax(90px,auto) 1fr minmax(80px,auto)",borderBottom:"1px solid var(--line2)",alignItems:"center",background:"var(--purpleBg)"}}>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:11,fontWeight:700,color:"var(--purple)",fontFamily:mono}}>BP hdr</div>
                              </div>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:12,fontWeight:600,color:"var(--purple)",lineHeight:1.35}}>🕐 Carry-in / Carry-out (Qantas)</div>
                                <div style={{fontSize:10,color:"var(--ink2)",marginTop:2,fontFamily:mono,lineHeight:1.4}}>
                                  {bpHdrItems.carriedInDuty !== "0:00" ? `+${fmtHM(dhaCarryInHrs)} carried in from prev BP${bpHdrItems.carriedInPrintedDuty !== "0:00" ? ` (${bpHdrItems.carriedInDuty} less ${bpHdrItems.carriedInPrintedDuty} already on this roster)` : ""}` : ""}
                                  {bpHdrItems.carriedInDuty !== "0:00" && bpHdrItems.carriedOutDuty !== "0:00" ? " · " : ""}
                                  {bpHdrItems.carriedOutDuty !== "0:00" ? `−${bpHdrItems.carriedOutDuty} carried out to next BP` : ""}
                                </div>
                              </div>
                              <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:dhaCarryDeltaHrs>=0?"var(--green)":"var(--red)"}}>
                                {dhaCarryDeltaHrs>=0?"+":""}${fmtAUD(dhaCarryDeltaHrs * dhaRateForItems)}
                              </div>
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"minmax(90px,auto) 1fr minmax(80px,auto)",background:"var(--accentBg2)",borderTop:"1px solid var(--accentLine)"}}>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,fontWeight:700}}>DHA TOTAL</div>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono}}>{dhaItems.length} payment{dhaItems.length!==1?"s":""} · {(dhaTotal / ((role==="cpt"?RATES.DHA_CPT:RATES.DHA_FO) * INDEX_YEARS[yearIdx].mult)).toFixed(2)}h</div>
                            <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--accent)"}}>${fmtAUD(dhaTotal)}</div>
                          </div>
                        </Card>
                      )}
                    </>
                  )}

                  {/* Stay Totals — one row per hotel stay, easier to see total $$ per stay */}
                  {stays.length>0&&(
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,marginTop:18,gap:10,flexWrap:"wrap"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>TRIP TOTALS — {stays.length}</div>
                        <button onClick={()=>setShowStayList(!showStayList)}
                          style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                          {showStayList ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showStayList && (
                        <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
                          {stays.map((s,ix)=>{
                            const rangeLbl = s.startDate === s.endDate
                              ? fmtShort(s.startDate)
                              : `${fmtShort(s.startDate)} – ${fmtShort(s.endDate)}`;
                            // Item-type counts for compact summary
                            const counts = { b:0, l:0, d:0, i:0 };
                            s.items.forEach(it => {
                              const k = it.id.split("_")[1];
                              if (counts[k] != null) counts[k] += (it.qty || 1);
                            });
                            const summary = [
                              counts.b > 0 ? `${counts.b}×B` : null,
                              counts.l > 0 ? `${counts.l}×L` : null,
                              counts.d > 0 ? `${counts.d}×D` : null,
                              counts.i > 0 ? `${counts.i}×Inc` : null,
                            ].filter(Boolean).join("  ");
                            return (
                              <div key={`stay-${s.key}`} style={{display:"grid",gridTemplateColumns:"minmax(130px,auto) 1fr minmax(80px,auto)",borderBottom:ix<stays.length-1?"1px solid var(--line2)":"none",alignItems:"center"}}>
                                <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                  <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",fontFamily:mono}}>{rangeLbl}</div>
                                </div>
                                <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                  <div style={{fontSize:12,fontWeight:600,color:"var(--ink2)",lineHeight:1.35}}>{s.label}</div>
                                  <div style={{fontSize:10,color:"var(--muted)",marginTop:2,fontFamily:mono,lineHeight:1.4}}>{summary}</div>
                                </div>
                                <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:"var(--green)"}}>${fmtAUD(s.total)}</div>
                              </div>
                            );
                          })}
                          <div style={{display:"grid",gridTemplateColumns:"minmax(130px,auto) 1fr minmax(80px,auto)",background:"var(--accentBg2)",borderTop:"1px solid var(--accentLine)"}}>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,fontWeight:700}}>STAY TOTAL</div>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono}}>{stays.length} stay{stays.length!==1?"s":""}</div>
                            <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--accent)"}}>${fmtAUD(mealTotal)}</div>
                          </div>
                        </Card>
                      )}
                    </>
                  )}

                  {/* Meal Allowances — flat list of every meal/incidental payment in range */}
                  {mealItems.length>0&&(
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,marginTop:18,gap:10,flexWrap:"wrap"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>MEAL ALLOWANCES — {mealItems.length} ITEM{mealItems.length!==1?"S":""}</div>
                        <button onClick={()=>setShowMealList(!showMealList)}
                          style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                          {showMealList ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showMealList && (
                        <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
                          {mealItems.map((item,ix)=>(
                            <div key={`meal-${ix}`} style={{display:"grid",gridTemplateColumns:"minmax(90px,auto) 1fr minmax(80px,auto)",borderBottom:ix<mealItems.length-1?"1px solid var(--line2)":"none",alignItems:"center"}}>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",fontFamily:mono}}>{fmtShort(item.date)}</div>
                              </div>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:12,fontWeight:600,color:item.color,lineHeight:1.35}}>{item.icon} {item.label}</div>
                                {item.reason&&<div style={{fontSize:10,color:"var(--ink2)",marginTop:2,fontFamily:mono,lineHeight:1.4}}>{item.reason}</div>}
                              </div>
                              <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:"var(--green)"}}>${fmtAUD(item.amount)}</div>
                            </div>
                          ))}
                          <div style={{display:"grid",gridTemplateColumns:"minmax(90px,auto) 1fr minmax(80px,auto)",background:"var(--accentBg2)",borderTop:"1px solid var(--accentLine)"}}>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,fontWeight:700}}>MEAL TOTAL</div>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono}}>{mealItems.length} item{mealItems.length!==1?"s":""}</div>
                            <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--accent)"}}>${fmtAUD(mealTotal)}</div>
                          </div>
                        </Card>
                      )}
                    </>
                  )}

                  {/* Credit Hours — flat list of credit hours per sector/duty */}
                  {creditItems.length>0&&(
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,marginTop:18,gap:10,flexWrap:"wrap"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>CREDIT HOURS — {creditTotal.toFixed(2)}h{creditTotal>70&&yos<0?"":" "}</div>
                        {creditTotal>70&&yos<0&&<span style={{fontSize:11,fontWeight:700,color:"var(--red)",fontFamily:mono}}>Select Years of Service!</span>}
                        <button onClick={()=>setShowCreditHours(!showCreditHours)}
                          style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                          {showCreditHours ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showCreditHours && (
                        <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
                          {creditItems.map((item,ix)=>(
                            <div key={`cr-${ix}`} style={{display:"grid",gridTemplateColumns:"minmax(80px,auto) 1fr minmax(80px,auto)",borderBottom:"1px solid var(--line2)",alignItems:"center"}}>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",fontFamily:mono}}>{fmtShort(item.date)}</div>
                              </div>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:12,fontWeight:600,color:item.type==="Operating"?"var(--accent)":item.type==="Positioning"?"var(--purple)":item.type==="Reserve"?"var(--pink)":item.type==="Leave"?"var(--yellow)":"var(--green)",lineHeight:1.35}}>
                                  {item.label}
                                </div>
                                <div style={{fontSize:10,color:"var(--ink2)",marginTop:2,fontFamily:mono}}>
                                  {item.type==="Leave"?"2.5h per day":item.type==="Reserve"?"Flat 4h credit":item.type==="Ground"?`${item.credit.toFixed(2)}h (max 4h)`:item.blockHrs!=null?`${item.blockHrs.toFixed(2)}h block${item.type==="Positioning"?" × 0.5":""}`:``}
                                </div>
                              </div>
                              <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:"var(--accent)"}}>{item.credit.toFixed(2)}h</div>
                            </div>
                          ))}
                          {bpHdr && (bpHdr.carriedInCredit !== "0:00" || bpHdr.carriedOutCredit !== "0:00") && (
                            <div style={{display:"grid",gridTemplateColumns:"minmax(80px,auto) 1fr minmax(80px,auto)",borderBottom:"1px solid var(--line2)",alignItems:"center",background:"var(--purpleBg)"}}>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:11,fontWeight:700,color:"var(--purple)",fontFamily:mono}}>BP hdr</div>
                              </div>
                              <div style={{padding:"10px 13px",borderRight:"1px solid var(--line)"}}>
                                <div style={{fontSize:12,fontWeight:600,color:"var(--purple)",lineHeight:1.35}}>Carry-in / Carry-out (Qantas)</div>
                                <div style={{fontSize:10,color:"var(--ink2)",marginTop:2,fontFamily:mono,lineHeight:1.4}}>
                                  {bpHdr.carriedInCredit !== "0:00" ? `+${fmtHM(creditCarryInHrs)} carried in${bpHdr.carriedInPrintedCredit !== "0:00" ? ` (${bpHdr.carriedInCredit} less ${bpHdr.carriedInPrintedCredit} already on this roster)` : ""}` : ""}
                                  {bpHdr.carriedInCredit !== "0:00" && bpHdr.carriedOutCredit !== "0:00" ? " · " : ""}
                                  {bpHdr.carriedOutCredit !== "0:00" ? `−${bpHdr.carriedOutCredit} carried out` : ""}
                                </div>
                              </div>
                              <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:14,fontWeight:700,color:headerCreditDelta>=0?"var(--green)":"var(--red)"}}>
                                {headerCreditDelta>=0?"+":""}{headerCreditDelta.toFixed(2)}h
                              </div>
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"minmax(80px,auto) 1fr minmax(80px,auto)",background:"var(--accentBg2)",borderTop:"1px solid var(--accentLine)"}}>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono,letterSpacing:1,fontWeight:700}}>CREDIT TOTAL</div>
                            <div style={{padding:"10px 13px",fontSize:10,color:"var(--ink2)",fontFamily:mono}}>{creditItems.length} item{creditItems.length!==1?"s":""}</div>
                            <div style={{padding:"10px 14px",textAlign:"right",fontFamily:mono,fontSize:15,fontWeight:700,color:"var(--accent)"}}>{creditTotal.toFixed(2)}h</div>
                          </div>
                          {/* Overtime section */}
                          {creditTotal > 70 && (
                            <div style={{padding:"12px 14px",background:"var(--amberBg)",borderTop:"1px solid color-mix(in srgb, var(--yellow) 31%, transparent)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:8}}>
                                <span style={{fontSize:11,fontWeight:700,color:"var(--yellow)",fontFamily:mono}}>⚠ OVERTIME: {(creditTotal - 70).toFixed(2)}h above 70h threshold</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                                <span style={{fontSize:11,color:"var(--ink2)",fontFamily:mono}}>Years of Service:</span>
                                <select value={useYos} onChange={e=>setYos(+e.target.value)} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:6,color:"var(--accent)",padding:"4px 8px",fontFamily:mono,fontSize:11,cursor:"pointer"}}>
                                  <option value={-1}>— Select —</option>
                                  {YOS_OPTIONS.filter(o=> role==="fo" ? o.idx<=2 : true).map(o=><option key={o.idx} value={o.idx}>{o.label}</option>)}
                                </select>
                                {useYos < 0 && <span style={{fontSize:12,fontWeight:700,color:"var(--red)",fontFamily:mono}}>Select Years of Service!</span>}
                                {pilotJoiningDate && effectiveYos >= 0 && effectiveYos !== yos && (
                                  <span style={{fontSize:10,color:"var(--muted)",fontFamily:mono,fontStyle:"italic"}}>(auto-set for this BP)</span>
                                )}
                              </div>
                              {useYos >= 0 && (()=>{
                                const sal = SALARY[aircraft][role][useYos][yearIdx];
                                // Round hourly rate and overtime hours to 2 dp BEFORE multiplying.
                                // Otherwise the user sees e.g. "$231.85/h × 3.87h = $896.50" because
                                // full-precision values (231.8531… × 3.867…) are used internally,
                                // and the displayed product looks wrong against the displayed inputs.
                                const hourlyRate = Math.round((sal / 750) * 100) / 100;
                                const overtimeHrs = Math.round((creditTotal - 70) * 100) / 100;
                                const overtimePay = overtimeHrs * hourlyRate;
                                return (
                                  <div style={{marginTop:10,padding:"10px 12px",background:"var(--panel)",borderRadius:8,border:"1px solid var(--line)"}}>
                                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:4,fontSize:11,fontFamily:mono,color:"var(--ink2)"}}>
                                      <span>Annual salary ({aircraft.toUpperCase()} {role==="cpt"?"CPT":"F/O"}, {YOS_OPTIONS[useYos].label})</span>
                                      <span style={{textAlign:"right",fontWeight:700}}>${fmtAUD(sal)}</span>
                                      <span>Hourly rate (salary ÷ 750)</span>
                                      <span style={{textAlign:"right",fontWeight:700}}>${fmtAUD(hourlyRate)}/h</span>
                                      <span>Overtime hours ({creditTotal.toFixed(2)} − 70)</span>
                                      <span style={{textAlign:"right",fontWeight:700}}>{overtimeHrs.toFixed(2)}h</span>
                                      <div style={{gridColumn:"1 / -1",borderTop:"1px solid var(--line)",marginTop:4,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                                        <span style={{fontWeight:700,color:"var(--yellow)"}}>Overtime payment</span>
                                        <span style={{fontWeight:700,fontSize:14,color:"var(--green)"}}>${fmtAUD(overtimePay)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </Card>
                      )}
                    </>
                  )}

                  {/* Roster View — raw .txt of the selected BP */}
                  {selectedBpForItems?.rawText && (
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,marginTop:18,gap:10,flexWrap:"wrap"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>ROSTER VIEW{selectedBpForItems.fileName ? ` — ${selectedBpForItems.fileName}` : ""}</div>
                        <button onClick={()=>setShowRosterView(!showRosterView)}
                          style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--muted)",fontSize:10,cursor:"pointer",padding:"3px 8px",fontFamily:mono,letterSpacing:0.5}}>
                          {showRosterView ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showRosterView && (
                        <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
                          <pre style={{margin:0,padding:"14px 16px",fontFamily:mono,fontSize:11,lineHeight:1.5,color:"var(--ink2)",background:"var(--panel)",whiteSpace:"pre",overflowX:"auto",maxHeight:"70vh",overflowY:"auto"}}>{selectedBpForItems.rawText}</pre>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* ══ PAY CHECK ══ */}
        {tab==="paycheck"&&(()=>{
          const d = derivePeriod({ allWeeks, rosterBPs, role, aircraft, yos, yearIdx,
                                   pilotJoiningDate, customFrom, customTo, monthView });
          const bp = rosterBPs.find(b => b.from === customFrom && b.to === customTo);
          const pc = derivePayCheck(paySlip, d);

          const Header = (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:4}}>PAYSLIP RECONCILIATION</div>
              <div style={{fontFamily:heading,fontSize:25,fontWeight:700,color:"var(--ink)"}}>
                Pay Check{bp ? ` — BP ${bp.bp}` : ""}
              </div>
            </div>
          );

          // Upload a payslip PDF and have every line read off it. Offered in
          // both states: with no BP chosen yet, the PDF's DUTY HOUR AL period
          // says which bid period it belongs to and selects it.
          const hasPayData = !!payPdf || !!paySlip.dha || !!paySlip.overtime
            || paySlip.meals.length > 0 || paySlip.callIns.length > 0 || paySlip.dvas.length > 0;
          const UploadPanel = (
            <Card style={{marginBottom:18}}>
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <label style={{background:"var(--accentBg)",border:"1px solid var(--accent)",borderRadius:8,color:"var(--accent)",padding:"8px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:mono,letterSpacing:0.5,flexShrink:0}}
                  title="Read a payslip PDF">
                  📄 Upload payslip PDF
                  <input type="file" accept=".pdf,application/pdf"
                    onChange={e=>{handlePayslipUpload(e.target.files);e.target.value="";}}
                    style={{display:"none"}}/>
                </label>
                <div style={{fontSize:11,color:"var(--muted)",fontFamily:mono,lineHeight:1.6,flex:1,minWidth:200}}>
                  Reads the earnings lines straight off the PDF and fills everything in.
                  <br/>The file is read in your browser — it is never uploaded anywhere.
                </div>
                {hasPayData && (confirmClearPay ? (
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"var(--redBg)",border:"1px solid color-mix(in srgb, var(--red) 38%, transparent)",borderRadius:8,padding:"4px 8px",flexShrink:0}}>
                    <span style={{fontSize:11,color:"var(--red)",fontFamily:mono}}>Clear payslip?</span>
                    <button onClick={clearPaySlip}
                      style={{background:"var(--red)",border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:"pointer",padding:"3px 8px",fontFamily:mono,fontWeight:700}}>
                      Yes, clear
                    </button>
                    <button onClick={()=>setConfirmClearPay(false)}
                      style={{background:"transparent",border:"1px solid var(--muted)",borderRadius:5,color:"var(--ink2)",fontSize:11,cursor:"pointer",padding:"3px 8px",fontFamily:mono}}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={()=>setConfirmClearPay(true)} title="Remove every payslip figure on this page"
                    style={{background:"var(--panel)",border:"1px solid color-mix(in srgb, var(--red) 19%, transparent)",borderRadius:8,color:"var(--red)",padding:"7px 11px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:mono,flexShrink:0,letterSpacing:0.5}}>
                    🗑 CLEAR PAYSLIP
                  </button>
                ))}
              </div>
              {payPdf && (
                <div style={{marginTop:12,paddingTop:11,borderTop:"1px solid var(--line)",fontSize:11,fontFamily:mono,lineHeight:1.7}}>
                  {payPdf.busy && <span style={{color:"var(--muted)"}}>Reading {payPdf.name}…</span>}
                  {payPdf.err && (
                    <span style={{color:"var(--red)"}}>
                      ✕ {payPdf.name}: {payPdf.err}
                      <br/><span style={{color:"var(--muted)"}}>You can still enter the lines by hand below.</span>
                    </span>
                  )}
                  {payPdf.ok && (
                    <span style={{color:"var(--ink2)"}}>
                      <span style={{color:"var(--green2)",fontWeight:700}}>✓ Read {payPdf.name}</span>
                      {payPdf.periodEnd && ` · period ending ${fmtFull(payPdf.periodEnd)}`}
                      <br/>
                      {[payPdf.counts.dha && "duty hour allowance",
                        payPdf.counts.meals && `${payPdf.counts.meals} meal line${payPdf.counts.meals!==1?"s":""}`,
                        payPdf.counts.callIns && `${payPdf.counts.callIns} call-in`,
                        payPdf.counts.dvas && `${payPdf.counts.dvas} DVA`,
                        payPdf.counts.overtime && "overtime"].filter(Boolean).join(" · ")}
                      {payPdf.picked
                        ? <><br/><span style={{color:"var(--accent)"}}>Selected BP {payPdf.picked} from the duty hour allowance period.</span></>
                        : payPdf.dhaPeriod
                          ? <><br/><span style={{color:"var(--red)"}}>Paid for {fmtShort(payPdf.dhaPeriod[0])}–{fmtShort(payPdf.dhaPeriod[1])} — that bid period isn't loaded. Upload its roster to compare.</span></>
                          : null}
                      {payPdf.ignored.length>0 && (
                        <><br/><span style={{color:"var(--faint)"}}>Not compared: {payPdf.ignored.join(", ")}.</span></>
                      )}
                    </span>
                  )}
                </div>
              )}
            </Card>
          );

          // ── "Expected payslip" preview ──
          // The allowance earnings lines payroll should show for this BP,
          // derived from the roster (independent of any payslip entered).
          // Rendered under the title once a BP is loaded.
          const expLines = [];
          if (d.dhaTotal > 0.005)
            expLines.push({ code: "DUTY HOUR AL", detail: bp ? `${fmtShort(bp.from)} – ${fmtShort(bp.to)}` : "", amount: d.dhaTotal });
          (d.payStays || []).forEach(s => expLines.push({
            code: "CR MEALS ATO",
            detail: `${s.port ? s.port + " · " : ""}${s.startDate === s.endDate ? fmtShort(s.startDate) : `${fmtShort(s.startDate)} – ${fmtShort(s.endDate)}`}`,
            amount: s.total,
          }));
          (pc.dayOffCalc || []).forEach(it => expLines.push({ code: "CALL IN", detail: fmtShort(it.date), amount: it.amount }));
          (pc.dvaCalc || []).forEach(it => expLines.push({ code: "DUTY VAR AL", detail: fmtShort(it.date), amount: it.amount }));
          if (d.includeOvertime && d.overtimePay > 0.005)
            expLines.push({ code: "OVERTIME", detail: `${d.overtimeHrs.toFixed(2)} h`, amount: d.overtimePay });
          const expTotal = expLines.reduce((s, l) => s + l.amount, 0);
          const expCols = "minmax(112px,1.3fr) 1fr minmax(88px,auto)";

          const ExpectedPayslip = (
            <Card style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
              <div style={{ background: "var(--slipHead)", color: "var(--slipInk)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontFamily: heading, fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>Expected Payslip</div>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: "var(--slipMuted)" }}>ESTIMATE · ALLOWANCE EARNINGS</div>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", letterSpacing: 0.5, marginBottom: 10 }}>
                  BP {bp ? bp.bp : ""} · {bp ? `${fmtFull(bp.from)} – ${fmtFull(bp.to)}` : ""}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: expCols, gap: 8, padding: "6px 0", borderBottom: "2px solid var(--slipHead)", fontFamily: mono, fontSize: 9, letterSpacing: 1, color: "var(--muted)" }}>
                  <div>DESCRIPTION</div><div>PERIOD / DATE</div><div style={{ textAlign: "right" }}>AMOUNT</div>
                </div>
                {expLines.length === 0 ? (
                  <div style={{ padding: "14px 0", fontFamily: mono, fontSize: 12, color: "var(--faint)" }}>No allowance earnings expected for this bid period.</div>
                ) : expLines.map((l, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: expCols, gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line3)", alignItems: "baseline" }}>
                    <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{l.code}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{l.detail}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>${fmtAUD(l.amount)}</div>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: expCols, gap: 8, padding: "10px 0 2px", borderTop: "2px solid var(--slipHead)", alignItems: "baseline" }}>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--slipHead)" }}>TOTAL ALLOWANCES</div>
                  <div/>
                  <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: "var(--accent)", textAlign: "right" }}>${fmtAUD(expTotal)}</div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: "var(--faint)", marginTop: 10, lineHeight: 1.6 }}>
                  Estimate of the allowance lines your payslip should show for this bid period — excludes base salary. Compare against your actual payslip below.
                </div>
              </div>
            </Card>
          );

          if (!bp) {
            return (
              <div className="fadein">
                {Header}
                {UploadPanel}
                <Card>
                  <div style={{fontSize:13,color:"var(--ink2)",lineHeight:1.7}}>
                    Select a bid period — open <strong>MONTH / ROSTER</strong> and click a BP chip, or
                    upload a payslip above and the right one is chosen for you.
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:8,fontFamily:mono,lineHeight:1.6}}>
                      A payslip is only comparable against a whole bid period: the 70-hour overtime
                      threshold and the roster header's carried in/out hours both settle per BP, so an
                      arbitrary date range cannot be reconciled.
                    </div>
                  </div>
                </Card>
              </div>
            );
          }

          return (
            <div className="fadein">
              {Header}
              {ExpectedPayslip}
              {UploadPanel}

              {/* Headline */}
              <Card style={{marginBottom:18,textAlign:"center",padding:"18px"}}>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:6}}>
                  {fmtFull(bp.from)} — {fmtFull(bp.to)}
                </div>
                {pc.anyInput ? (
                  <>
                    <div style={{fontFamily:mono,fontSize:34,fontWeight:700,letterSpacing:-1.2,
                      color:pc.off?"var(--red)":"var(--green2)"}}>
                      {pc.off ? `${pc.delta>0?"+":"−"}$${fmtAUD(Math.abs(pc.delta))}` : "✓ All matched"}
                    </div>
                    <div style={{fontSize:11,color:"var(--muted)",fontFamily:mono,marginTop:6}}>
                      payslip ${fmtAUD(pc.paidTotal)} · calculated ${fmtAUD(pc.calcTotal)}
                      {pc.off && <span style={{color:"var(--red)"}}> · {pc.delta>0?"paid more than calculated":"paid less than calculated"}</span>}
                    </div>
                  </>
                ) : (
                  <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.7}}>
                    Enter what your payslip actually paid, below. Each line is matched to this bid
                    period's own figures and any difference is shown.
                  </div>
                )}
              </Card>

              {/* ── CR MEALS ATO ── */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,gap:10,flexWrap:"wrap"}}>
                <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>CR MEALS ATO — {d.payStays.length} STAY{d.payStays.length!==1?"S":""} THIS BP</div>
                <button className="addBtn" onClick={()=>addPayRow("meals",{from:"",to:"",amount:""})}
                  style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--accent)",fontSize:11,cursor:"pointer",padding:"4px 10px",fontFamily:mono}}>+ Add meal line</button>
              </div>
              <Card style={{marginBottom:18}}>
                {paySlip.meals.length===0 && (
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
                    Add one line per <span style={{fontFamily:mono}}>CR MEALS ATO</span> row on the payslip —
                    its date range and amount. Leave the "to" date blank for a same-day slip.
                    <button onClick={()=>d.payStays.forEach(s=>addPayRow("meals",{from:s.startDate,to:s.endDate===s.startDate?"":s.endDate,amount:""}))}
                      style={{display:"block",marginTop:10,background:"transparent",border:"1px solid var(--accentLine)",borderRadius:6,color:"var(--accent)",fontSize:11,cursor:"pointer",padding:"5px 10px",fontFamily:mono}}>
                      Pre-fill {d.payStays.length} line{d.payStays.length!==1?"s":""} from this roster
                    </button>
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid var(--line)"}}>
                      <div style={{fontSize:10,letterSpacing:1,color:"var(--faint)",fontFamily:mono,marginBottom:5}}>THIS BID PERIOD'S STAYS</div>
                      {d.payStays.map(s=>(
                        <div key={s.key} style={{fontSize:11,color:"var(--muted)",fontFamily:mono,lineHeight:1.8}}>
                          {s.port||"—"} · {fmtShort(s.startDate)}–{fmtShort(s.endDate)} · ${fmtAUD(s.total)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {paySlip.meals.map(line=>{
                  const row = pc.mealRows.find(r=>r.id===line.id);
                  return (
                    <PayRowShell key={line.id} onRemove={()=>removePayRow("meals",line.id)}>
                      <DInput label="FROM" value={line.from} onChange={v=>updPayRow("meals",line.id,"from",v)}/>
                      <DInput label="TO" value={line.to} onChange={v=>updPayRow("meals",line.id,"to",v)}/>
                      <MInput label="PAID $" value={line.amount} onChange={v=>updPayRow("meals",line.id,"amount",v)}/>
                      <div style={{minWidth:190,paddingBottom:4}}>
                        {row?.stay ? (
                          <>
                            <div style={{fontSize:11,color:"var(--ink2)",fontFamily:mono,marginBottom:3}}>
                              {row.stay.port||"—"} · {fmtShort(row.stay.startDate)}–{fmtShort(row.stay.endDate)}
                            </div>
                            <Delta paid={row.paid} calc={row.stay.total} off={row.off}/>
                          </>
                        ) : (
                          <span style={{fontSize:11,color:"var(--red)",fontFamily:mono}}>no matching stay in this BP</span>
                        )}
                      </div>
                    </PayRowShell>
                  );
                })}
                {paySlip.meals.length>0 && pc.unmatchedStays.length>0 && (
                  <div style={{marginTop:10,padding:"10px 12px",background:"color-mix(in srgb, var(--red) 6%, transparent)",border:"1px solid color-mix(in srgb, var(--red) 25%, transparent)",borderRadius:8}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--red)",fontFamily:mono,marginBottom:5}}>
                      {pc.unmatchedStays.length} STAY{pc.unmatchedStays.length!==1?"S":""} WITH NO PAYSLIP LINE
                    </div>
                    {pc.unmatchedStays.map(s=>(
                      <div key={s.key} style={{fontSize:11,color:"var(--ink2)",fontFamily:mono,lineHeight:1.8}}>
                        {s.port||"—"} · {fmtShort(s.startDate)}–{fmtShort(s.endDate)} · ${fmtAUD(s.total)}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ── DUTY HOUR AL + OVERTIME ── */}
              <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono,marginBottom:9}}>DUTY HOURS &amp; OVERTIME</div>
              <Card style={{marginBottom:18}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap",marginBottom:12}}>
                  <MInput label="DUTY HOUR AL — PAID $" value={paySlip.dha} onChange={v=>setPayField("dha",v)} width={140}/>
                  <div style={{paddingBottom:4}}>
                    <Delta paid={pc.dha?.paid ?? null} calc={d.dhaTotal} off={pc.dha?.off}/>
                    <div style={{fontSize:10,color:"var(--faint)",fontFamily:mono,marginTop:3}}>
                      {(d.dhaTotal/((role==="cpt"?RATES.DHA_CPT:RATES.DHA_FO)*INDEX_YEARS[yearIdx].mult)).toFixed(2)}h
                      {d.dhaCarryDeltaHrs!==0 && ` (incl. ${d.dhaCarryDeltaHrs>0?"+":""}${d.dhaCarryDeltaHrs.toFixed(2)}h header carry)`}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <MInput label="OVERTIME — PAID $" value={paySlip.overtime} onChange={v=>setPayField("overtime",v)} width={140}/>
                  <div style={{paddingBottom:4}}>
                    <Delta paid={pc.ot?.paid ?? null} calc={d.overtimePay} off={pc.ot?.off}/>
                    <div style={{fontSize:10,color:d.useYos<0&&d.overtimeHrs>0?"var(--red)":"var(--faint)",fontFamily:mono,marginTop:3}}>
                      {d.useYos<0&&d.overtimeHrs>0
                        ? "select Years of Service to resolve overtime"
                        : `${d.creditTotal.toFixed(2)}h credit · ${d.overtimeHrs.toFixed(2)}h over 70h`}
                    </div>
                  </div>
                </div>
              </Card>

              {/* ── CALL IN / DAY OFF ── */}
              {[["callIns","CALL IN / DAY OFF WORKED","+ Add call-in",pc.callIns],
                ["dvas","DUTY VARIATION ALLOWANCE","+ Add DVA",pc.dvas]].map(([key,title,addLbl,res])=>(
                <div key={key}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,gap:10,flexWrap:"wrap"}}>
                    <div style={{fontSize:10,letterSpacing:2,color:"var(--muted)",fontFamily:mono}}>{title}</div>
                    <button className="addBtn" onClick={()=>addPayRow(key,{date:"",amount:""})}
                      style={{background:"transparent",border:"1px solid var(--line)",borderRadius:6,color:"var(--accent)",fontSize:11,cursor:"pointer",padding:"4px 10px",fontFamily:mono}}>{addLbl}</button>
                  </div>
                  <Card style={{marginBottom:18}}>
                    {paySlip[key].length===0 && res.unmatched.length===0 && (
                      <div style={{fontSize:12,color:"var(--muted)"}}>Nothing on the payslip and nothing calculated for this BP.</div>
                    )}
                    {paySlip[key].map(line=>{
                      const row = res.rows.find(r=>r.id===line.id);
                      return (
                        <PayRowShell key={line.id} onRemove={()=>removePayRow(key,line.id)}>
                          <DInput label="DATE" value={line.date} onChange={v=>updPayRow(key,line.id,"date",v)}/>
                          <MInput label="PAID $" value={line.amount} onChange={v=>updPayRow(key,line.id,"amount",v)}/>
                          <div style={{minWidth:190,paddingBottom:4}}>
                            {row?.item ? (
                              <>
                                <div style={{fontSize:11,color:"var(--ink2)",fontFamily:mono,marginBottom:3}}>
                                  {row.item.icon} {fmtShort(row.item.date)} · {row.item.label}
                                </div>
                                <Delta paid={row.paid} calc={row.item.amount} off={row.off}/>
                              </>
                            ) : (
                              <>
                                <div style={{fontSize:11,color:"var(--red)",fontFamily:mono,marginBottom:3}}>the calculator pays nothing here</div>
                                <Delta paid={row?.paid ?? null} calc={0} off={row?.off}/>
                              </>
                            )}
                          </div>
                        </PayRowShell>
                      );
                    })}
                    {res.unmatched.length>0 && (
                      <div style={{marginTop:paySlip[key].length?10:0,padding:"10px 12px",background:"color-mix(in srgb, var(--red) 6%, transparent)",border:"1px solid color-mix(in srgb, var(--red) 25%, transparent)",borderRadius:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--red)",fontFamily:mono,marginBottom:5}}>
                          CALCULATED BUT NOT ON THE PAYSLIP
                        </div>
                        {res.unmatched.map((i,n)=>(
                          <div key={n} style={{fontSize:11,color:"var(--ink2)",fontFamily:mono,lineHeight:1.8}}>
                            {i.icon} {fmtShort(i.date)} · {i.label} · ${fmtAUD(i.amount)}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              ))}

              <div style={{fontSize:10,color:"var(--faint)",fontFamily:mono,lineHeight:1.7,marginBottom:20}}>
                Meal lines are matched to hotel stays by date span, over a window that extends past the
                bid period so a stay checking out after the BP ends keeps its whole total. Duty hours and
                credit hours are unaffected by that window.
              </div>
            </div>
          );
        })()}
      </div>
      <footer style={{maxWidth:980,margin:"6px auto 30px",padding:"0 20px",textAlign:"center",fontSize:10,lineHeight:1.7,color:"var(--faint)",fontFamily:mono,letterSpacing:0.3}}>
        For personal use only · Estimates only — use at your own risk.<br/>
        © 2026 Thomas Pappin · All rights reserved.
      </footer>
    </div>
  );
}
