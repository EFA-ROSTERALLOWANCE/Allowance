import { useState, useMemo, useEffect, Fragment } from "react";

// ─── EA 2025 ──────────────────────────────────────────────────────────────────
const INDEX_YEARS = [
  { label: "EBA Commencement", mult: 1.0000 },
  { label: "EBA 1 Jan 2027",   mult: 1.0300 },
  { label: "EBA 1 Jan 2028",   mult: 1.0609 },
  { label: "EBA 1 Jan 2029",   mult: 1.0927 },
];
const RATES = {
  DVA_CPT:400, DVA_FO:250, DDO_CPT:1231, DDO_FO:837,
  DHA_CPT:17.51, DHA_FO:11.39, MISSED_MEAL:83.40, ACCOM_OPTOUT:75,
};
// Pick the EBA indexation year (INDEX_YEARS index) that applies to a date.
// Rates step up on each EBA anniversary (1 Jan 2027 / 2028 / 2029), derived
// from the year in each INDEX_YEARS label — the last entry whose effective
// 1-Jan date is on/before `dateStr` wins.
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
  { code:"SYD", tz:"Australia/Sydney",    utcOffset:10 },
  { code:"WSI", tz:"Australia/Sydney",    utcOffset:10 },
  { code:"MEL", tz:"Australia/Melbourne", utcOffset:10 },
  { code:"PER", tz:"Australia/Perth",     utcOffset:8  },
  { code:"BNE", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"ADL", tz:"Australia/Adelaide",  utcOffset:9.5},
  { code:"HBA", tz:"Australia/Hobart",    utcOffset:10 },
  { code:"LST", tz:"Australia/Hobart",    utcOffset:10 },
  { code:"CNS", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"DRW", tz:"Australia/Darwin",    utcOffset:9.5},
  { code:"TSV", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"OOL", tz:"Australia/Brisbane",  utcOffset:10 },
  { code:"XCH", tz:"Indian/Christmas",    utcOffset:7 },
  { code:"CCK", tz:"Indian/Cocos",        utcOffset:6.5},
  { code:"SIN", tz:"Asia/Singapore",      utcOffset:8  },
  { code:"BKK", tz:"Asia/Bangkok",        utcOffset:7  },
  { code:"XSP", tz:"Asia/Singapore",      utcOffset:8  },
  { code:"HKG", tz:"Asia/Hong_Kong",      utcOffset:8  },
  { code:"MFM", tz:"Asia/Macau",          utcOffset:8  },
  { code:"PVG", tz:"Asia/Shanghai",       utcOffset:8  },
  { code:"NGB", tz:"Asia/Shanghai",       utcOffset:8  },
  { code:"HND", tz:"Asia/Tokyo",          utcOffset:9  },
  { code:"CTS", tz:"Asia/Tokyo",          utcOffset:9  },
  { code:"AKL", tz:"Pacific/Auckland",    utcOffset:12 },
  { code:"CHC", tz:"Pacific/Auckland",    utcOffset:12 },
  { code:"LHR", tz:"Europe/London",       utcOffset:0  },
  { code:"DRS", tz:"Europe/Berlin",       utcOffset:1  },
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
// hotel check-in/out match airport sign-off/sign-on exactly. Trips with a
// check-in dated 2026-06-30 or later therefore use the airport times directly.
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
  // From 1 July 2026: new domestic AU meal + incidental schedule (announced
  // company-side; international brackets carry forward unchanged as the
  // upper-tier ATO TD2025/4 amounts).
  { label: "From 1 Jul 2026", from: "2026-07-01", rates: {
    domestic: {breakfast:43.65, lunch:61.70, dinner:86.35, incidental:36.30},
    group_4:  {breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_5:  {breakfast:121.66,lunch:121.66,dinner:121.68,incidental:60.00},
    group_6:  {breakfast:138.33,lunch:138.33,dinner:138.34,incidental:60.00},
  }},
  // From 22 Feb 2026: EFA EA 2025 cl. 6.23 references ATO Taxation
  // Determination TD2025/4 Table 3 (FY 2025-26, salary $263,851+ rates,
  // per company schedule effective 20 March 2026). Per-meal rounding rule:
  // breakfast = lunch = nominal/3 rounded DOWN to the cent; dinner =
  // nominal − (breakfast + lunch). Three meals therefore sum exactly to
  // the daily nominal; one or two meals alone use the rounded-down rate.
  { label: "2026-2027", from: "2026-02-22", rates: {
    domestic: {breakfast:42.15, lunch:59.60, dinner:83.40, incidental:35.05},
    group_4:  {breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_5:  {breakfast:121.66,lunch:121.66,dinner:121.68,incidental:60.00},
    group_6:  {breakfast:138.33,lunch:138.33,dinner:138.34,incidental:60.00},
  }},
  // 19 May 2025 – 21 Feb 2026: prior schedule (lower-tier amounts of
  // $215/$290/$360 for groups 4/5/6). Same B=L rounded-down / D
  // catch-up rule applied so daily sums are exact.
  { label: "19 May 2025 – 21 Feb 2026", from: "2025-05-19", rates: {
    domestic: {breakfast:37.85, lunch:53.45, dinner:75.00, incidental:35.05},
    group_4:  {breakfast:71.66, lunch:71.66, dinner:71.68, incidental:45.00},
    group_5:  {breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_6:  {breakfast:120.00,lunch:120.00,dinner:120.00,incidental:50.00},
  }},
  // Pre-19 May 2025: oldest schedule (fallback for any earlier date).
  { label: "Pre-19 May 2025", from: "2000-01-01", rates: {
    domestic: {breakfast:36.90, lunch:52.10, dinner:73.10, incidental:34.25},
    group_4:  {breakfast:71.66, lunch:71.66, dinner:71.68, incidental:45.00},
    group_5:  {breakfast:96.66, lunch:96.66, dinner:96.68, incidental:50.00},
    group_6:  {breakfast:120.00,lunch:120.00,dinner:120.00,incidental:50.00},
  }},
];
const DESTINATIONS = MEAL_RATE_YEARS[0].rates;
function getDestinations(dateStr) {
  if (!dateStr) return DESTINATIONS;
  for (const yr of MEAL_RATE_YEARS) {
    if (dateStr >= yr.from) return yr.rates;
  }
  return MEAL_RATE_YEARS[MEAL_RATE_YEARS.length - 1].rates;
}
const MEAL_WINDOWS = [
  {id:"b",wS:7*60+30, wE:9*60+30, key:"breakfast"},
  {id:"l",wS:11*60+30,wE:13*60+30,key:"lunch"},
  {id:"d",wS:17*60+30,wE:19*60+30,key:"dinner"},
];
const DAY_NAMES=["MON","TUE","WED","THU","FRI","SAT","SUN"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── EFA Pilot List (valid as at 1 Jan 2026) ─────────────────────────────────
// Source: EFA Pilot List published 6 January 2026 under EFA EA 2025 cl. 4.8.
// surname can include "(AltName)" for maiden/married names.
// firstName can include "(Nickname)" — only the primary first name's initial is used for matching.
const PILOT_LIST = [
  { surname:"Clough",        firstName:"Paul",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2006-10-16" },
  { surname:"Hopkins",       firstName:"Mark",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2006-11-20" },
  { surname:"Devine",        firstName:"Gregory",         fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2007-01-08" },
  { surname:"Miller",        firstName:"Andrew",          fleet:"A330", rank:"Capt", base:"MEL", joinDate:"2007-01-08" },
  { surname:"Kamvissis",     firstName:"Alexandros",      fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2007-01-22" },
  { surname:"Peters",        firstName:"Timothy",         fleet:"A330", rank:"Capt", base:"MEL", joinDate:"2007-03-12" },
  { surname:"Durden",        firstName:"Mark",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2007-09-24" },
  { surname:"Kirsh",         firstName:"Aaron",           fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2008-11-11" },
  { surname:"Davey",         firstName:"Heath",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2011-01-06" },
  { surname:"English",       firstName:"Kate",            fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2011-07-20" },
  { surname:"Bennet",        firstName:"Richard",         fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2012-08-15" },
  { surname:"McMahon",       firstName:"Dean",            fleet:"A330", rank:"Capt", base:"MEL", joinDate:"2013-01-14" },
  { surname:"Pugh",          firstName:"Brenton",         fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2013-01-14" },
  { surname:"Osborne",       firstName:"Andrew",          fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2013-06-17" },
  { surname:"Morris",        firstName:"Hugh",            fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2015-06-19" },
  { surname:"Larnach",       firstName:"Nicholas",        fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2017-11-28" },
  { surname:"Squirrell",     firstName:"Tessa",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2018-04-10" },
  { surname:"Trentin (Orr)", firstName:"Rachel",          fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2018-06-12" },
  { surname:"Sharpe",        firstName:"Matthew",         fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2019-02-12" },
  { surname:"McDarmont",     firstName:"Alex",            fleet:"A330", rank:"Capt", base:"BNE", joinDate:"2019-03-04" },
  { surname:"Hardonin",      firstName:"Richard",         fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2019-05-24" },
  { surname:"Ben-David",     firstName:"Eidan",           fleet:"A330", rank:"F/O",  base:"MEL", joinDate:"2019-08-05" },
  { surname:"Schrodter",     firstName:"Mark",            fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2019-09-25" },
  { surname:"Clay",          firstName:"David",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2019-09-25" },
  { surname:"O'Dea",         firstName:"Paul",            fleet:"A330", rank:"F/O",  base:"MEL", joinDate:"2019-11-03" },
  { surname:"Lloyd",         firstName:"Taryn",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2019-11-03" },
  { surname:"Perras",        firstName:"Peter",           fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2020-02-08" },
  { surname:"Citerne",       firstName:"Patrick",         fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2020-02-25" },
  { surname:"Kemp",          firstName:"Scott",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2020-02-25" },
  { surname:"Semenikow",     firstName:"Susha",           fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2020-03-02" },
  { surname:"Davis",         firstName:"Brett",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2020-03-30" },
  { surname:"Clack",         firstName:"Phil",            fleet:"A330", rank:"Capt", base:"MEL", joinDate:"2020-04-01" },
  { surname:"Lopes",         firstName:"Christopher",     fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2020-04-01" },
  { surname:"Godfrey",       firstName:"Christopher",     fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2020-04-01" },
  { surname:"Strauss",       firstName:"Andy",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2021-06-07" },
  { surname:"Turner",        firstName:"David",           fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2021-07-19" },
  { surname:"McStay",        firstName:"Blair",           fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2021-07-19" },
  { surname:"Quach",         firstName:"John",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2021-07-19" },
  { surname:"Ewing",         firstName:"Joshua",          fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2021-07-19" },
  { surname:"Murray",        firstName:"John",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2022-01-24" },
  { surname:"Rattle",        firstName:"Bruce",           fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2022-02-01" },
  { surname:"Prothero",      firstName:"Christopher",     fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-02-01" },
  { surname:"Doe",           firstName:"Christopher",     fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-02-10" },
  { surname:"Redwin",        firstName:"Teneille",        fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-04-01" },
  { surname:"Harper",        firstName:"Andrew",          fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2022-05-02" },
  { surname:"Ryder",         firstName:"James",           fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2022-05-02" },
  { surname:"Tsunoda",       firstName:"Jeremy",          fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2022-05-02" },
  { surname:"Fuller",        firstName:"Darren",          fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2022-05-09" },
  { surname:"Roberts",       firstName:"Alexander (Alec)",fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-06-06" },
  { surname:"Brown",         firstName:"Nicholas",        fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2022-07-04" },
  { surname:"Barry",         firstName:"Christopher",     fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2022-07-18" },
  { surname:"Swanson",       firstName:"Nicholas",        fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-07-18" },
  { surname:"Batchelor",     firstName:"Brody",           fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2022-07-18" },
  { surname:"Ahearn",        firstName:"James",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-07-25" },
  { surname:"Thompson",      firstName:"Geoffrey",        fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2022-08-15" },
  { surname:"Smith",         firstName:"Andrew",          fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2022-08-15" },
  { surname:"Epstein",       firstName:"Ryan",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2022-08-15" },
  { surname:"Luo",           firstName:"Jason",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2022-12-30" },
  { surname:"McKendry",      firstName:"Samuel",          fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-01-09" },
  { surname:"O'Brien",       firstName:"Gerard",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2023-01-09" },
  { surname:"Grasso",        firstName:"Peter",           fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-03-02" },
  { surname:"Aweida",        firstName:"Belal (Billy)",   fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-03-23" },
  { surname:"Merchant",      firstName:"Trent",           fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-03-23" },
  { surname:"Durna",         firstName:"Petr",            fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-04-21" },
  { surname:"Sherring",      firstName:"Jack",            fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-04-21" },
  { surname:"Deecke",        firstName:"John",            fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-04-21" },
  { surname:"Darby",         firstName:"Kevin",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2023-05-08" },
  { surname:"Young",         firstName:"Paul",            fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2023-05-08" },
  { surname:"Hook",          firstName:"Lochlan",         fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-05-19" },
  { surname:"Job",           firstName:"Fabian",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2023-05-19" },
  { surname:"Whatham",       firstName:"Mitchell",        fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-06-27" },
  { surname:"Cohoe",         firstName:"Sean",            fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-06-30" },
  { surname:"De Vecchi",     firstName:"Mark",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2023-06-30" },
  { surname:"Hobbs",         firstName:"Sam",             fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-07-18" },
  { surname:"Jarratt",       firstName:"Tommas",          fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-07-18" },
  { surname:"Wenke",         firstName:"Matthew",         fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-07-21" },
  { surname:"Bryce",         firstName:"John",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-07-21" },
  { surname:"Dunston",       firstName:"Paul",            fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-07-21" },
  { surname:"Cox",           firstName:"Heath",           fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-08-11" },
  { surname:"Pappin",        firstName:"Thomas",          fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-08-11" },
  { surname:"Westerhuis",    firstName:"Brett",           fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-09-04" },
  { surname:"Coad",          firstName:"Ian",             fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2023-09-06" },
  { surname:"Thondan",       firstName:"Jamie",           fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2023-09-06" },
  { surname:"Mclachlan",     firstName:"Chad",            fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-09-06" },
  { surname:"Geary",         firstName:"David",           fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-09-06" },
  { surname:"Hudson",        firstName:"Jamie",           fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-09-27" },
  { surname:"Davis",         firstName:"David",           fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2023-09-27" },
  { surname:"Nielsen",       firstName:"Nick",            fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-10-09" },
  { surname:"Speight",       firstName:"Benjamin",        fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2023-10-09" },
  { surname:"Foo",           firstName:"Mick",            fleet:"A330", rank:"Capt", base:"SYD", joinDate:"2023-10-13" },
  { surname:"Nichols",       firstName:"Hugh",            fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2023-11-01" },
  { surname:"Brady",         firstName:"Mitchell",        fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2023-12-01" },
  { surname:"Corney",        firstName:"Jason",           fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2024-02-21" },
  { surname:"O'Loughlin",    firstName:"Samuel",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-02-21" },
  { surname:"Bridger",       firstName:"Craig",           fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2024-03-06" },
  { surname:"Turton",        firstName:"Lachlan",         fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2024-03-20" },
  { surname:"McCutcheon",    firstName:"David",           fleet:"A330", rank:"Capt", base:"BNE", joinDate:"2024-05-13" },
  { surname:"Britton",       firstName:"Matt",            fleet:"A321", rank:"Capt", base:"MEL", joinDate:"2024-05-20" },
  { surname:"Hackwood",      firstName:"Michael",         fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2024-07-29" },
  { surname:"Ferguson",      firstName:"Gregory",         fleet:"A321", rank:"Capt", base:"BNE", joinDate:"2024-07-29" },
  { surname:"Sim",           firstName:"Nicholas",        fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-08-12" },
  { surname:"Cockle",        firstName:"Dean",            fleet:"A330", rank:"F/O",  base:"SYD", joinDate:"2024-09-05" },
  { surname:"Coles",         firstName:"Mitchell",        fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-09-05" },
  { surname:"Shortell",      firstName:"Nick",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-11-04" },
  { surname:"Reilly",        firstName:"James",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-12-02" },
  { surname:"Tran",          firstName:"Vu",              fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-12-02" },
  { surname:"Beattie",       firstName:"Jordan",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-12-02" },
  { surname:"McAuley",       firstName:"Beau-Jacob",      fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2024-12-02" },
  { surname:"Bailey",        firstName:"Scott",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-04-03" },
  { surname:"Carr",          firstName:"Clancie",         fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-04-03" },
  { surname:"Chan",          firstName:"Chi Kit",         fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-05-22" },
  { surname:"Pather",        firstName:"Keertan",         fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-05-22" },
  { surname:"Do",            firstName:"Phillip",         fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-06-26" },
  { surname:"Clarey",        firstName:"Alex",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-06-26" },
  { surname:"Pigg",          firstName:"Darren",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-07-24" },
  { surname:"McDonald",      firstName:"Nathan",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-07-24" },
  { surname:"Duvoisin",      firstName:"Luke",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-08-22" },
  { surname:"Singh",         firstName:"Anshuman (Archie)",fleet:"A321",rank:"F/O",  base:"MEL", joinDate:"2025-08-22" },
  { surname:"Michael",       firstName:"James",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-09-25" },
  { surname:"Sinac",         firstName:"Joseph",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-09-25" },
  { surname:"Bayliss",       firstName:"Jamie",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-10-03" },
  { surname:"Kirkham",       firstName:"Mitchell",        fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-10-24" },
  { surname:"Carstairs",     firstName:"Benjamin",        fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-10-24" },
  { surname:"Boyd",          firstName:"Dylan",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-11-21" },
  { surname:"Coleman",       firstName:"Lewis",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2025-11-21" },
  // Joined after 1 Jan 2026 → no YOS bracket bump (paidBracketIdxFromAnchor
  // handles this via joinISO <= PAID_BRACKET_FREEZE_DATE). Added from EFA
  // Pilot List valid 1 Jul 2026 (EA cl. 4.8).
  { surname:"Bylhouwer",     firstName:"Julian",          fleet:"A321", rank:"F/O",  base:"SYD", joinDate:"2026-01-16" },
  { surname:"Wilsher",       firstName:"Paul",            fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2026-01-16" },
  { surname:"Wells",         firstName:"Andrew",          fleet:"A321", rank:"F/O",  base:"BNE", joinDate:"2026-02-13" },
  { surname:"Bullard",       firstName:"Charles",         fleet:"A321", rank:"F/O",  base:"SYD", joinDate:"2026-02-13" },
  { surname:"Wilson",        firstName:"Jason",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-02-13" },
  { surname:"Joseph",        firstName:"Mark",            fleet:"A321", rank:"F/O",  base:"SYD", joinDate:"2026-02-13" },
  { surname:"Jones",         firstName:"Thomas",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-03-13" },
  { surname:"Tian",          firstName:"David",           fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-03-13" },
  { surname:"Jones",         firstName:"Joel",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-04-10" },
  { surname:"Tucker",        firstName:"Sean",            fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-04-10" },
  { surname:"Crosbie",       firstName:"Lachlan",         fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-05-08" },
  { surname:"Vincent",       firstName:"Nathan",          fleet:"A321", rank:"F/O",  base:"MEL", joinDate:"2026-05-08" },
  { surname:"Neah",          firstName:"Oponokali",       fleet:"A321", rank:"F/O",  base:"SYD", joinDate:"2026-06-05" },
  { surname:"Othman",        firstName:"Bilal",           fleet:"A321", rank:"F/O",  base:"SYD", joinDate:"2026-06-05" },
];

// Pre-built lookup index — strips parens, captures surname variants and first initial
const PILOT_INDEX = PILOT_LIST.map(p => {
  const surnameClean = p.surname.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const altMatch = p.surname.match(/\(([^)]+)\)/);
  const surnameAlt = altMatch ? altMatch[1].trim() : null;
  const firstNameClean = p.firstName.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return {
    ...p,
    surnameClean,
    surnameAlt,
    firstNameClean,
    firstInitial: firstNameClean.charAt(0).toUpperCase(),
    displayName: `${surnameClean}, ${firstNameClean}`,
  };
});

// Match a roster name (e.g. "PAPPIN TW", "DE VECCHI M", "BEN-DAVID E") to a pilot.
// Strategy: normalize input, then for each pilot (longest surname first to avoid
// "Davis" colliding with "David"), check if the input starts with that surname
// AND the next letter equals the pilot's first initial.
function findPilotInList(rosterName) {
  if (!rosterName) return null;
  const norm = rosterName
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!norm) return null;

  // Build (surname variant, pilot) pairs, sorted by surname length desc
  const pairs = [];
  PILOT_INDEX.forEach(p => {
    pairs.push({ sn: p.surnameClean.toUpperCase(), pilot: p });
    if (p.surnameAlt) pairs.push({ sn: p.surnameAlt.toUpperCase(), pilot: p });
  });
  pairs.sort((a, b) => b.sn.length - a.sn.length);

  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Pass 1: surname + first initial match
  for (const { sn, pilot } of pairs) {
    const re = new RegExp(`^${escape(sn)}\\s+([A-Z])`);
    const m = norm.match(re);
    if (m && m[1] === pilot.firstInitial) return pilot;
  }

  // Pass 2: surname-only match if uniquely identifying
  for (const { sn, pilot } of pairs) {
    const re = new RegExp(`^${escape(sn)}(?:\\s|$)`);
    if (re.test(norm)) {
      const sameSurname = PILOT_INDEX.filter(p =>
        p.surnameClean.toUpperCase() === sn ||
        (p.surnameAlt && p.surnameAlt.toUpperCase() === sn)
      );
      if (sameSurname.length === 1) return pilot;
    }
  }

  return null;
}

// ─── Years-of-service brackets ────────────────────────────────────────────────
// Per user spec, every pilot is paid at the NEXT bracket above their actual
// years of service. Pilots already in the top bracket stay there.
// CPT has 4 brackets, F/O has 3.
const CPT_BRACKETS = [
  { id: "B0", label: "< 3 years",   short: "<3y",  min: 0, max: 3 },
  { id: "B1", label: "3 – 5 years", short: "3–5y", min: 3, max: 5 },
  { id: "B2", label: "5 – 7 years", short: "5–7y", min: 5, max: 7 },
  { id: "B3", label: "7+ years",    short: "7+ y", min: 7, max: Infinity },
];
const FO_BRACKETS = [
  { id: "B0", label: "< 3 years",   short: "<3y",  min: 0, max: 3 },
  { id: "B1", label: "3 – 5 years", short: "3–5y", min: 3, max: 5 },
  { id: "B2", label: "5+ years",    short: "5+ y", min: 5, max: Infinity },
];
function bracketsForRole(role) { return role === "cpt" ? CPT_BRACKETS : FO_BRACKETS; }
// Kept for legacy CSS chip lookups elsewhere — uses the longer CPT list as a superset
const YOS_BRACKETS = CPT_BRACKETS;

// Years-of-service in fractional years anchored on anniversaries. Someone who
// joined 1 May 2023 has done exactly 3.00 years on 1 May 2026, 3.50 years on
// approximately 1 November 2026 (half-way through the 4th year), and 4.00
// years on 1 May 2027. Whole years count complete anniversaries; the fraction
// is the portion of the way to the next anniversary.
function yearsOfServiceBetween(joinISO, asOfISO) {
  if (!joinISO || !asOfISO) return null;
  const j = new Date(joinISO + "T00:00:00Z");
  const a = new Date(asOfISO + "T00:00:00Z");
  if (isNaN(j) || isNaN(a)) return null;
  if (a < j) return null;
  // Whole anniversaries since join
  let whole = a.getUTCFullYear() - j.getUTCFullYear();
  const annivThisYear = new Date(Date.UTC(a.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()));
  if (a < annivThisYear) whole -= 1;
  // Fraction of way from last completed anniversary to next
  const lastAnniv = new Date(Date.UTC(j.getUTCFullYear() + whole, j.getUTCMonth(), j.getUTCDate()));
  const nextAnniv = new Date(Date.UTC(j.getUTCFullYear() + whole + 1, j.getUTCMonth(), j.getUTCDate()));
  const cycleMs = nextAnniv.getTime() - lastAnniv.getTime();
  const intoCycleMs = a.getTime() - lastAnniv.getTime();
  const fraction = cycleMs > 0 ? intoCycleMs / cycleMs : 0;
  return whole + fraction;
}

function actualBracketIdx(years, role) {
  if (years == null || years < 0) return -1;
  const list = bracketsForRole(role);
  for (let i = 0; i < list.length; i++) {
    if (years >= list[i].min && years < list[i].max) return i;
  }
  return list.length - 1;
}

// One-time bracket bump for pilots employed on/before 1 Jan 2026: their paid
// bracket was upgraded by one tier on that date. The bump is applied to ALL
// allowances — for pre-2026 BPs too — so a pilot's bracket-as-of-EBA-start
// is used consistently regardless of which BP is being viewed.
//
// For post-freeze progression, the paid bracket never drops below where the
// one-time bump placed it: paid = max(actual_now, actual_at_freeze + 1).
// Pilots employed AFTER 1 Jan 2026 didn't get the one-time bump, so for them
// paid = actual at current date.
const PAID_BRACKET_FREEZE_DATE = "2026-01-01";

function paidBracketIdxFromAnchor(joinISO, role, currentDate) {
  if (!joinISO || !currentDate) return -1;
  const yearsNow = yearsOfServiceBetween(joinISO, currentDate);
  const actNowIdx = actualBracketIdx(yearsNow, role);
  if (actNowIdx === -1) return -1;
  // Pilots employed on/before 1 Jan 2026 got the one-time bump. Apply it for
  // all BPs (including pre-2026 BPs): the user wants every view to show the
  // pilot's bracket-as-of-EBA-start. For post-freeze progression, the bracket
  // can only go up (paid = max(actual_now, actual_at_freeze + 1)).
  if (joinISO <= PAID_BRACKET_FREEZE_DATE) {
    const yearsAtFreeze = yearsOfServiceBetween(joinISO, PAID_BRACKET_FREEZE_DATE);
    const actFreezeIdx = actualBracketIdx(yearsAtFreeze, role);
    const list = bracketsForRole(role);
    const bumpedFreezeIdx = Math.min(actFreezeIdx + 1, list.length - 1);
    return Math.max(actNowIdx, bumpedFreezeIdx);
  }
  // Joined after freeze: no one-time bump.
  return actNowIdx;
}
// Legacy wrapper — preserved so callers using paidBracketIdx(years, role)
// still work. Without joinDate context we can't apply the one-time freeze
// rule, so this falls back to the pre-existing "actual + 1" behaviour. New
// call sites should call paidBracketIdxFromAnchor instead.
function paidBracketIdx(years, role) {
  const a = actualBracketIdx(years, role);
  if (a === -1) return -1;
  const list = bracketsForRole(role);
  return Math.min(a + 1, list.length - 1);
}

// ─── EA 2025 Salary Table — clauses 6.1 & 6.2 ────────────────────────────────
// Indexed by [fleet][role][bracketIdx][yearIdx]. yearIdx aligns with INDEX_YEARS:
//   0 = FFPP after 1/1/2026, 1 = 2027, 2 = 2028, 3 = 2029.
// Narrow-body (A321 — shown as A320 on rosters), Wide-body (A330).
const SALARIES = {
  narrow: {
    cpt: [
      [221130.15, 227764.06, 234596.98, 241634.89], // <3
      [227764.06, 234596.98, 241634.89, 248883.94], // 3–5
      [234596.98, 241634.89, 248883.94, 256350.45], // 5–7
      [241634.89, 248883.94, 256350.45, 264040.97], // 7+
    ],
    fo: [
      [143778.85, 148092.21, 152534.98, 157111.03], // <3
      [148092.21, 152534.98, 157111.03, 161824.36], // 3–5
      [152534.98, 157111.03, 161824.36, 166679.09], // 5+
    ],
  },
  wide: {
    cpt: [
      [252088.38, 259651.03, 267440.56, 275463.77], // <3
      [259651.03, 267440.56, 275463.77, 283727.69], // 3–5
      [267440.56, 275463.77, 283727.69, 292239.52], // 5–7
      [275463.77, 283727.69, 292239.52, 301006.70], // 7+
    ],
    fo: [
      [163907.89, 168825.12, 173889.88, 179106.57], // <3
      [168825.12, 173889.88, 179106.57, 184479.77], // 3–5
      [173889.88, 179106.57, 184479.77, 190014.16], // 5+
    ],
  },
};

const CREDIT_HOUR_THRESHOLD = 70;
const CREDIT_HOUR_DIVISOR = 750;

function lookupAnnualSalary(fleet, role, bracketIdx, yearIdx) {
  if (!fleet || bracketIdx < 0) return null;
  const fleetTable = SALARIES[fleet]?.[role];
  if (!fleetTable || !fleetTable[bracketIdx]) return null;
  return fleetTable[bracketIdx][yearIdx] ?? null;
}

// Map pilot-list fleet code or roster Category text to "narrow" / "wide".
function normaliseFleet(code) {
  if (!code) return null;
  const c = code.toUpperCase();
  if (/A33\d/.test(c)) return "wide";
  if (/A32\d/.test(c)) return "narrow"; // A320/A321
  return null;
}

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
    const localAsUtc=Date.UTC(lY,lMo-1,lD,lH,lM);
    return (localAsUtc - d.getTime())/3600000;
  } catch { return ap.utcOffset; }
}
function utcMins(timeStr, code, dateStr) {
  const m=parseTime(timeStr); if(m==null) return null;
  return m - getUtcOffsetHours(code,dateStr)*60;
}
// Convert a (date, local-airport time) pair to an absolute UTC millisecond
// timestamp. Used by TAFB / hotel-hours calcs to bookend periods correctly
// regardless of which airport's clock the times were quoted in. Returns null
// for missing or unparseable input.
function localToUtcMs(dateStr, timeStr, code) {
  if (!dateStr || !timeStr) return null;
  const [h, m] = String(timeStr).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const baseUtc = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(baseUtc)) return null;
  const offsetHours = getUtcOffsetHours(code || "SYD", dateStr);
  return baseUtc + (h - offsetHours) * 3600000 + m * 60000;
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
function fmtAUD(n) {
  const v = (n == null || Number.isNaN(n)) ? 0 : Number(n);
  return v.toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtShort(s) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00Z");
  if (isNaN(d)) return s;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
function zoneFrom(c) { return AIRPORT_ZONE[c]||"domestic"; }
function parseDate(s) { if(!s) return null; const d=new Date(s+"T00:00:00Z"); return isNaN(d)?null:d; }
function isoDate(d) { return d.toISOString().slice(0,10); }
function addDays(s,n) { const d=parseDate(s); if(!d) return ""; d.setUTCDate(d.getUTCDate()+n); return isoDate(d); }
function daysBetween(f,t) { const a=parseDate(f),b=parseDate(t); if(!a||!b) return 0; return Math.max(0,Math.round((b-a)/86400000)); }
function fmtFull(s)  { const d=parseDate(s); if(!d) return "-"; return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
function getMon(s) {
  const d=parseDate(s); if(!d) return s;
  const dow=d.getUTCDay();
  const diff=dow===0?-6:1-dow;
  d.setUTCDate(d.getUTCDate()+diff);
  return isoDate(d);
}

function resolveSectorDate(sec, idx, day, tripDate) {
  if (sec.sectorDate) return sec.sectorDate;
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

function splitDhaByMidnight(signOnLocal, signOffLocal, signOnDate, depCode, arrCode) {
  const on = parseTime(signOnLocal), off = parseTime(signOffLocal);
  if (on == null || off == null) return [];
  // v5 logic: split DHA at SYDNEY midnight, not local-airport midnight.
  // This correctly attributes hours to calendar dates regardless of the
  // departure/arrival airport's local time zone.
  const depOffset = getUtcOffsetHours(depCode || "SYD", signOnDate) * 60;
  const arrOffset = getUtcOffsetHours(arrCode || "SYD", signOnDate) * 60;
  const sydOffset = getUtcOffsetHours("SYD", signOnDate) * 60;
  // sign-on/off in Sydney minutes (relative to signOnDate Sydney midnight)
  const onSyd = on - depOffset + sydOffset;
  // duty length in UTC minutes
  const onUtc = on - depOffset;
  const offUtc = off - arrOffset;
  let totalMins = offUtc - onUtc;
  if (totalMins <= 0) totalMins += 1440;
  // Normalise sign-on into [0, 1440); track if sign-on date shifts in Sydney tz
  let sydDateShift = 0;
  let onSydNorm = onSyd;
  while (onSydNorm < 0)    { onSydNorm += 1440; sydDateShift -= 1; }
  while (onSydNorm >= 1440){ onSydNorm -= 1440; sydDateShift += 1; }
  const sydOnDate = sydDateShift !== 0 ? addDays(signOnDate, sydDateShift) : signOnDate;
  const offSydNorm = onSydNorm + totalMins;
  if (offSydNorm <= 1440) {
    return [{ date: sydOnDate, hours: totalMins / 60 }];
  }
  const preM = (1440 - onSydNorm) / 60;
  const postM = (offSydNorm - 1440) / 60;
  const nextDate = addDays(sydOnDate, 1);
  const parts = [];
  if (preM > 0) parts.push({ date: sydOnDate, hours: preM });
  if (postM > 0) parts.push({ date: nextDate, hours: postM });
  return parts;
}

function totalSlipMins(ci,co,nights) { if(ci==null||co==null) return 0; if(nights<=0) return Math.max(0,co-ci); return nights*1440-ci+co; }

function mealsCoveredPerDay(ci, co, nights, hotelFromStr) {
  if(ci==null||co==null) return [];
  if(nights<0) return [];
  const calDays = Math.max(1, nights + 1);
  return Array.from({length:calDays},(_,i)=>{
    let presStart, presEnd, isFullDay=false;
    if(i===0 && i===calDays-1) { presStart=ci; presEnd=co; }
    else if(i===0) { presStart=ci; presEnd=1440; }
    else if(i===calDays-1) { presStart=0; presEnd=co; }
    else { presStart=0; presEnd=1440; isFullDay=true; }
    const meals={};
    MEAL_WINDOWS.forEach(w=>{
      if(isFullDay) { meals[w.id]=true; }
      else {
        const overlapMins=Math.max(0, Math.min(presEnd,w.wE) - Math.max(presStart,w.wS));
        // Strictly more than 30 min: a duty/slip covering exactly 30 min of a
        // meal window does NOT pay (e.g. sim signing on at 09:00 covers exactly
        // 30 min of breakfast 07:30-09:30 and pays no breakfast).
        meals[w.id]=overlapMins>30;
      }
    });
    const date=hotelFromStr ? addDays(hotelFromStr,i) : "";
    return {dayNum:i+1, date, isFullDay, presStart, presEnd, ...meals};
  });
}

let _sectorId = 0;
function newSector(dep="", arr="") {
  return {
    id: ++_sectorId,
    flightNo:"", depAirport:dep, arrAirport:arr,
    sectorDate:"",
    aSignOn:"", aSignOff:"",
    missedMeal:false, continueDuty:false, reservePeriod:false,
  };
}

function emptyDay() {
  return {
    sectors: [newSector(), newSector()],
    hasSlip:false, destination:"domestic",
    hotelFrom:"", hotelTo:"",
    hotelCheckIn:"", hotelCheckOut:"",
    hotelAfterSectorIdx:null,
    hotels: [],
    ddoInfringed:false, accomOptOut:0,
    extraDva:0, extraDdo:0,
  };
}

function getHotels(day) {
  if (Array.isArray(day.hotels) && day.hotels.length > 0) return day.hotels;
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

// ─── Per-date allowance splitter (DHA + meals) ────────────────────────────────
function calcAllowancesByDate(day, role, yearIdx, tripDate) {
  const mult = INDEX_YEARS[yearIdx].mult;
  const byDate = {};
  const addTo = (date, item) => { if (!byDate[date]) byDate[date] = []; byDate[date].push(item); };
  const mkItem = (id, baseRate, qty) => {
    const rate = baseRate * mult;
    return { id, rate, qty, amount: rate * qty };
  };

  if (day.sectors[0]?.reservePeriod || day.sectors[0]?.isAnnualLeave) return byDate;

  // DHA: per-sector or continuous duty periods
  const dutyPeriods = [];
  let currentPeriod = [day.sectors[0]];
  for (let i = 1; i < day.sectors.length; i++) {
    const sec = day.sectors[i];
    const prevSec = day.sectors[i - 1];
    const hotelBetween = getHotels(day).some(h => h.afterSectorIdx === (i - 1));
    if (!hotelBetween && prevSec.continueDuty) currentPeriod.push(sec);
    else { dutyPeriods.push(currentPeriod); currentPeriod = [sec]; }
  }
  dutyPeriods.push(currentPeriod);

  dutyPeriods.forEach(period => {
    if (period.length === 1) {
      const sec = period[0];
      const idx = day.sectors.indexOf(sec);
      const sDate = resolveSectorDate(sec, idx, day, tripDate);
      const dh = calcDutyHours(sec.aSignOn, sec.depAirport, sDate, sec.aSignOff, sec.arrAirport, sDate);
      if (dh != null && dh > 0) {
        const r = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
        // Attribute the whole duty to sectorDate. Cross-BP boundary shifts are
        // handled downstream by processRoster applying the header's Carried
        // In/Out values, which are Qantas's authoritative statement of what
        // moves between BPs. See processRoster's header adjustment block.
        addTo(sDate, mkItem(`dha_${sec.id}`, r * dh, 1));
      }
    } else {
      const firstSec = period[0], lastSec = period[period.length - 1];
      const firstIdx = day.sectors.indexOf(firstSec);
      const lastIdx = day.sectors.indexOf(lastSec);
      const onDate = resolveSectorDate(firstSec, firstIdx, day, tripDate);
      const offDate = resolveSectorDate(lastSec, lastIdx, day, tripDate);
      const dh = calcDutyHours(firstSec.aSignOn, firstSec.depAirport, onDate, lastSec.aSignOff, lastSec.arrAirport, offDate);
      if (dh != null && dh > 0) {
        const r = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
        // Attribute the whole continuous duty to the first sector's date; see
        // note above the single-sector emission.
        addTo(onDate, mkItem(`dha_cont_${firstIdx}`, r * dh, 1));
      }
    }
  });

  // Meals
  const allHotels = getHotels(day);
  // Track which (date, mealId) slots are already paid by hotels so ground
  // duties later in this function don't double-pay the same meal.
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
    pd.forEach(pdDay => {
      const mealDate = pdDay.date;
      if (!mealDate) return;
      if (pdDay.b) { addTo(mealDate, mkItem(`meal_b_${hi}_${mealDate}`, dest.breakfast, 1)); hotelMealKeys.add(`b@${mealDate}`); }
      if (pdDay.l) { addTo(mealDate, mkItem(`meal_l_${hi}_${mealDate}`, dest.lunch, 1));     hotelMealKeys.add(`l@${mealDate}`); }
      if (pdDay.d) { addTo(mealDate, mkItem(`meal_d_${hi}_${mealDate}`, dest.dinner, 1));    hotelMealKeys.add(`d@${mealDate}`); }
    });
    // (Per-hotel incidentals removed — see trip-level calc after ground meals.)
  });

  // Ground-duty meals: pay breakfast/lunch/dinner if the duty's sign-on→sign-off
  // window covers the meal window by MORE THAN 30 min (strict >30, same as
  // hotel slip meals — a sim signing on at 09:00 covers exactly 30 min of the
  // breakfast window and does NOT earn breakfast).
  // Excludes admin/leave/standby duty codes; included codes cover ATP, CC/CCR,
  // EF*, IE*, PD/PDD, SIM, SLFB, NTS, GS, plus ground variants tagged by parser
  // (G-prefixed pattern-block sectors with dep=arr).
  // Also skips ground duties conducted at home base: a pilot doing a sim or
  // ground school at their own base doesn't earn meal allowances. Base is
  // inferred from the day's first sector with a depAirport — top-section
  // ground duties get dep=arr=detectedBase from the parser, while pattern-
  // block ground duties at an away port carry that away port in depAirport.
  // Dedups against hotel-paid meals on the same (date, window).
  const GROUND_MEAL_EXCLUDE = /^(MD|V\d|AX|LJ|LA|CLRD|LZR|LZ|LW)\b/i;
  const baseSec = day.sectors.find(s => s.depAirport);
  const tripBase = baseSec?.depAirport;
  day.sectors.forEach((sec, idx) => {
    if (!sec.isGroundDuty) return;
    if (sec.aSignOn == null || sec.aSignOff == null) return;
    const code = (sec.flightNo || "").trim();
    if (GROUND_MEAL_EXCLUDE.test(code)) return;
    // Skip ground duties at home base.
    if (tripBase && sec.depAirport === tripBase) return;
    const sDate = resolveSectorDate(sec, idx, day, tripDate);
    if (!sDate) return;
    // Convert "HH:MM" strings to minutes-from-midnight before arithmetic — without
    // this, JS string→number coercion produces NaN, and `NaN <= 30` is false, so
    // every meal window would mistakenly fire. Use parseTime helper.
    const onMin = parseTime(sec.aSignOn);
    let offMin = parseTime(sec.aSignOff);
    if (onMin == null || offMin == null) return;
    // Cap at midnight; if duty crosses midnight, only meals on the start date
    // are paid here (rare for ground duty; could split like splitDhaByMidnight).
    if (offMin <= onMin) offMin = 1440;
    const port = sec.depAirport || sec.arrAirport;
    const zone = port ? zoneFrom(port) : "domestic";
    const dest = (getDestinations(sDate)[zone]) || getDestinations(sDate).domestic;
    MEAL_WINDOWS.forEach(w => {
      const overlap = Math.max(0, Math.min(offMin, w.wE) - Math.max(onMin, w.wS));
      if (overlap <= 30) return;
      if (hotelMealKeys.has(`${w.id}@${sDate}`)) return;
      const rate = dest[w.key];
      if (rate == null) return;
      addTo(sDate, mkItem(`meal_${w.id}_g${idx}_${sDate}`, rate, 1));
      // Mark slot so later ground sectors on the same day don't re-pay it.
      hotelMealKeys.add(`${w.id}@${sDate}`);
    });
  });

  // ── Per-port incidentals ──
  // Sum total time spent at each non-base port across all hotels at that port.
  // Pay 1 incidental per 24h at that port's zone rate — so a 4-day MEL course
  // (3 overnight hotels of 16h each = 48h at MEL) earns 2 domestic incidentals,
  // while a 2-port trip PER (33h) + HKG (47h) earns 1 PER incidental at the
  // domestic rate AND 1 HKG incidental at the international rate, instead of
  // collapsing both into one rate.
  //
  // This replaces the older per-hotel-slip approach (which only paid when a
  // single hotel exceeded 24h, missing multi-night chains) and the trip-level
  // span approach (which used one rate for the whole trip even when the pilot
  // visited multiple zones).
  {
    const portTotals = {};   // portCode → { totalMin, firstDate, zone }
    allHotels.forEach((hotel) => {
      if (!hotel.hotelCheckIn || !hotel.hotelCheckOut) return;
      const ci = parseTime(hotel.hotelCheckIn), co = parseTime(hotel.hotelCheckOut);
      if (ci == null || co == null) return;
      const nights = daysBetween(hotel.hotelFrom, hotel.hotelTo);
      // Incidentals accumulate on the RAW slip (sign-off → sign-on), not the
      // transit-shrunk hotel window. Add back 2× the transit that was applied
      // (one for check-in shift, one for check-out) so the 24h threshold is
      // measured from airport to airport. One incidental per 24h.
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
      // Track the earliest date so incidentals can be dated relative to it
      if (hotel.hotelFrom && hotel.hotelFrom < portTotals[port].firstDate) {
        portTotals[port].firstDate = hotel.hotelFrom;
      }
    });
    // Issue incidentals per port — floor(totalMin / 24h) at that port's rate.
    let incIdx = 0;
    Object.entries(portTotals).forEach(([port, info]) => {
      if (info.totalMin < 24 * 60) return;
      const incQty = Math.floor(info.totalMin / (24 * 60));
      const dest = (getDestinations(info.firstDate)[info.zone]) || getDestinations(info.firstDate).domestic;
      for (let n = 0; n < incQty; n++) {
        // Pay each incidental 1 day after the start of its 24h period (so it
        // falls into the correct BP if the trip crosses a BP boundary).
        const incDate = addDays(info.firstDate, n + 1);
        addTo(incDate, mkItem(`meal_i_${port}_${n}_${incIdx++}`, dest.incidental, 1));
      }
    });
  }

  // ── Day-off payments (from OL48 in the roster, or manually-set extraDdo) ──
  // Each unit = one DDO payment at the role's flat rate (RATES.DDO_*).
  if (day.extraDdo > 0) {
    const r = role === "cpt" ? RATES.DDO_CPT : RATES.DDO_FO;
    addTo(tripDate, mkItem(`ddo_extra`, r, day.extraDdo));
  }
  // ── Extra Duty Variation Allowance (Cl 5.28) ──
  // `extraDva` is currently a manual-toggle field (no parser detection yet),
  // so this branch typically doesn't fire from bulk-parsed rosters. Kept here
  // for consistency with `extraDdo` and so future parser support populates the
  // breakdown automatically. Each unit = one DVA payment at RATES.DVA_*.
  if (day.extraDva) {
    const r = role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
    // extraDva is stored as boolean (legacy) — treat truthy as 1
    const qty = typeof day.extraDva === "number" ? day.extraDva : 1;
    addTo(tripDate, mkItem(`dva_extra`, r, qty));
  }

  return byDate;
}

function bldSec(flightNo, dep, arr, signOn, signOff, sectorDate, extra={}) {
  return { ...newSector(dep, arr), flightNo, aSignOn:signOn, aSignOff:signOff, sectorDate:sectorDate||"", ...extra };
}

// ─── Roster parser (full v5 logic) ────────────────────────────────────────────
function parseQantasRoster(text) {
  const errors = [];
  const weeks = {};
  const ensureWeek = (ws) => {
    if (!weeks[ws]) weeks[ws] = Object.fromEntries(DAY_NAMES.map(k => [k, emptyDay()]));
    return weeks[ws];
  };

  // BP (Bid Period) numbering follows an alternating 4–6 step pattern: each
  // 28-day BP increments the BP number by either +4 or +6, with the steps
  // alternating. Starting from BP3651 = 4 Nov 2024 (the anchor), the sequence
  // is 3651, 3655 (+4), 3661 (+6), 3665 (+4), 3671 (+6), ... — every BP cycle
  // is exactly 28 calendar days, but the BP number doesn't advance uniformly.
  //
  // To convert a BP number to its sequence index:
  //   delta = bpNum - 3651
  //   The pattern step-pair is +4, +6 (sum 10 over 2 indices), so:
  //     index = 2 * floor(delta/10) + (delta%10 === 4 ? 1 : 0)
  //   delta%10 must be 0 or 4 — anything else is not a valid BP number.
  //
  // The earlier implementation used a hard-coded table for known BPs and
  // extrapolated by `(bpNum - nearest) * 5.6` for unknown numbers. That ratio
  // was an average of the 4-6 alternation and produced wrong start dates one
  // BP forward of the table's end (e.g. BP3751 came out as 24 May 2026 instead
  // of 18 May 2026). The formula below is exact for all valid BP numbers.
  const BP_ANCHOR_NUM = 3651;
  const BP_ANCHOR_DATE = "2024-11-04";
  function bpIndexFromNumber(bpNum) {
    const delta = bpNum - BP_ANCHOR_NUM;
    if (delta < 0) {
      // Before the anchor — invert the formula.
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

  const bpMatch = text.match(/Bid\s+Period\s+(\d{4})/);
  let bpStart = null, bpYear = new Date().getFullYear();
  if (bpMatch) {
    const bpNum = parseInt(bpMatch[1], 10);
    bpStart = bpStartDate(bpNum);
    if (bpStart) bpYear = parseInt(bpStart.slice(0, 4), 10);
  }
  if (!bpStart) {
    const yrMatch = text.match(/(\d{2})([A-Za-z]{3})(\d{2})\s+\d{4}/);
    if (yrMatch) bpYear = 2000 + parseInt(yrMatch[3], 10);
  }

  let detectedRole = null;
  let detectedFleet = null;
  const catMatch = text.match(/Category\s*:\s*([A-Z0-9/\-]+)/i);
  if (catMatch) {
    const cat = catMatch[1].toUpperCase();
    if (cat.startsWith("F/O") || cat.startsWith("FO")) detectedRole = "fo";
    else if (cat.startsWith("CPT") || cat.startsWith("CAPT")) detectedRole = "cpt";
    detectedFleet = normaliseFleet(cat);
  }

  let detectedBase = "SYD";
  const baseMatch = text.match(/Base\s*:\s*([A-Z]{3})/);
  if (baseMatch) detectedBase = baseMatch[1];

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

  const patternBlocks = [];
  const blockStarts = [];
  let m;
  const headerRegex = /Date\s+Flight\s+Depart\s+Arrive\s+Eq/g;
  while ((m = headerRegex.exec(text)) !== null) blockStarts.push(m.index);
  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i+1] : text.length;
    patternBlocks.push(text.substring(start, end));
  }

  if (patternBlocks.length === 0) {
    errors.push("No pattern blocks found in roster.");
    return { weeks, firstWeekStart: null, errors };
  }

  // For pattern-block flight-date parsing: anchor on the BP's start month/year
  // so the first flight in a January pattern block of a BP that began in
  // December correctly gets year+1. Without this, a BP3725 (29 Dec 2025 →
  // 25 Jan 2026) whose first pattern block contains only January flights
  // would date them 2025 instead of 2026.
  let curYear = bpYear;
  let prevMonth = bpStart ? parseInt(bpStart.slice(5, 7), 10) - 1 : -1;

  const patternSectionIdx = text.search(/rosterPatns|Pattern Details/);
  const topSection = patternSectionIdx > 0 ? text.substring(0, patternSectionIdx) : text;

  // Collect pattern IDs from the "<ID> DATED <DDMmmYY>" line at the bottom of
  // each pattern block. These IDs ALSO appear as the "duty code" column in the
  // top-schedule section (e.g. "13 Mon  TPAPP1B2  A001  1455 2140 ..."), where
  // TPAPP1B2 is a trip identifier and A001 is the actual flight. Without this
  // filter, top-section parsing creates a phantom ground-duty sector for the
  // pattern label, which then incorrectly earns ground-duty meal allowances.
  const patternIds = new Set();
  const datedRegex = /^\s+(\S+)\s+DATED\s+\d{2}[A-Za-z]{3}\d{2}/gm;
  let dm;
  while ((dm = datedRegex.exec(text)) !== null) patternIds.add(dm[1]);

  let topMonth, topYear;
  if (bpStart) {
    topYear = parseInt(bpStart.slice(0, 4), 10);
    topMonth = parseInt(bpStart.slice(5, 7), 10) - 1;
  } else {
    const firstFlightInText = text.match(/\n(\d{2})([A-Za-z]{3})\s+(?:[A-Z]\s+)?\S+\s+[A-Z]{3}\s+\d{4}/);
    if (firstFlightInText) {
      topMonth = monthIdx[firstFlightInText[2]];
      topYear = bpYear;
    }
  }

  // Queue of dates where an "OL48" appears in the Code column of a top-schedule
  // row. OL48 signals that the pattern infringed on a designated day off and
  // a day-off payment is owed (Cl. 5.20). We queue here and apply after
  // pattern blocks have populated days, so the increment lands on the
  // populated record instead of being overwritten by emptyDay().
  const ol48Days = [];
  // Queue of dates where an "AS48" appears in the Code column — signals a DVA
  // payment for the associated pattern (Cl. 5.28). Same numeric-prefix
  // convention as OL48.
  const as48Days = [];
  // Queue of dates where an "OL13" or "OL11" appears — pilot was activated
  // from reserve. EA: "the credit will be the greater of flight hour credit
  // or four hours." Both codes are treated identically — they flag the day
  // and apply a 4h floor in calcCreditHoursForWeeks.
  const ol13Days = [];

  if (topMonth != null) {
    const monthAbbrs = Object.keys(monthIdx);
    const scheduleLineRegex = /^(\d{1,2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(.*)$/gm;
    let lastDay = -1;
    let sm;
    while ((sm = scheduleLineRegex.exec(topSection)) !== null) {
      const dayNum = parseInt(sm[1], 10);
      const rest = sm[3];
      if (lastDay !== -1 && dayNum < lastDay - 5) {
        topMonth++;
        if (topMonth > 11) { topMonth = 0; topYear++; }
      }
      lastDay = dayNum;
      // Check for OL48/OL06/OL13 BEFORE any skip logic — these markers can
      // appear on pattern-label rows (which the parser otherwise ignores).
      // Both OL48 and OL06 trigger a day-off payment for that day; either
      // may be prefixed with a count (e.g. "2OL48" → 2 day-off payments).
      // Bare codes count as 1. Multiple matches per line accumulate.
      const ddoRegex = /\b(\d*)OL(?:48|06)\b/g;
      let ddoMatch;
      while ((ddoMatch = ddoRegex.exec(rest)) !== null) {
        const count = parseInt(ddoMatch[1] || "1", 10) || 1;
        const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
        if (sectorDate) ol48Days.push({ date: sectorDate, count });
      }
      // AS48 → DVA payment for the associated pattern. `2AS48` → 2 DVAs.
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
      const leadingSpaces = (rest.match(/^(\s*)/)||["",""])[1].length;
      if (leadingSpaces > 6) continue;
      const codeMatch = rest.match(/^\s*(\S+(?:\([^)]*\))?)/);
      if (!codeMatch) continue;
      const dutyCode = codeMatch[1];
      if (/^\d/.test(dutyCode)) continue;
      // Skip pattern-label rows in the top schedule — the pattern block is the
      // authoritative source for these days. (Without this, a phantom ground
      // duty would be created at base for the entire trip's sign-on→sign-off
      // window and would now incorrectly earn ground-duty meal allowances.)
      if (patternIds.has(dutyCode)) continue;

      // Annual Leave — each LA day = 2.5h credit, no sign-on/off times.
      // LA always covers a full calendar day, and Qantas rosters write a
      // separate "DD Day LA" line for every day in the leave block, so we
      // record one entry per occurrence.
      if (dutyCode === "LA") {
        const sectorDate = mkDate(dayNum, monthAbbrs[topMonth], topYear);
        const d = parseDate(sectorDate);
        if (!d) continue;
        const ws = getMon(sectorDate);
        const dow = d.getUTCDay();
        const dayKey = DAY_NAMES[(dow + 6) % 7];
        const week = ensureWeek(ws);
        const leaveSec = { ...newSector(), flightNo: "LA", sectorDate, isAnnualLeave: true };
        week[dayKey] = { ...emptyDay(), sectors: [leaveSec] };
        continue;
      }

      const timeMatch = rest.match(/(\d{4})\s+(\d{4})/);
      if (!timeMatch) continue;
      // Skip continuation rows: when a duty session crosses midnight, Qantas
      // rosters add a second line on the next day's row with the same sign-on
      // and sign-off times but no Duty/Credit columns (e.g. SIM251D(S) showing
      // up on 23 Sat after the 22 Fri row already counted its 9:00 duty).
      // These rows must be skipped so meals/DHA aren't double-paid.
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
        const reserveSec = { ...newSector(), flightNo: dutyCode, aSignOn: signOn, aSignOff: signOff, sectorDate, reservePeriod: true };
        week[dayKey] = { ...emptyDay(), sectors: [reserveSec, newSector()] };
      } else {
        const groundSec = bldSec(dutyCode, detectedBase, detectedBase, signOn, signOff, sectorDate, { isGroundDuty: true });
        week[dayKey] = { ...emptyDay(), sectors: [groundSec] };
      }
    }
  }

  patternBlocks.forEach(block => {
    const flightLineRegex = /^(\d{2})([A-Za-z]{3})\s+([A-Z&]\s+)?(\S+)\s+([A-Z]{3})\s+(\d{4})\s+([A-Z]{3})\s+(\d{4})/gm;
    const rptRegex = /Rpt\s+(\d{4})\s+Rls\s+(\d{4})/g;
    const flights = [];
    let fm;
    while ((fm = flightLineRegex.exec(block)) !== null) {
      const day = parseInt(fm[1], 10);
      const monAbbr = fm[2];
      const marker = fm[3] ? fm[3].trim() : "";
      const isPositioning = marker === "P" || marker === "A";
      const flightNo = fm[4];
      const dep = fm[5];
      const depTime = fm[6];
      const arr = fm[7];
      const arrTime = fm[8];
      const mIdx = monthIdx[monAbbr];
      if (mIdx == null) continue;
      if (prevMonth >= 0 && mIdx < prevMonth && (prevMonth - mIdx) > 6) curYear++;
      prevMonth = mIdx;
      const sectorDate = mkDate(day, monAbbr, curYear);
      const flt = /^\d+$/.test(flightNo) ? `QF${flightNo}` : flightNo;
      // Ground duty detection — same airport (CC, base check, sim) or a
      // recognised non-flight code prefix. Ground duties must NOT be treated
      // as operating sectors: they get the 4-hour ground-duty cap on credit
      // hours, and they shouldn't earn block hours.
      const isGroundDuty = (dep === arr) || /^(CC|SIM|EF|GS|GD|TC)\b/i.test(flt);
      flights.push({ sectorDate, flightNo: flt, dep, arr, depTime, arrTime, isPositioning, isGroundDuty });
    }

    if (flights.length === 0) return;

    const rptPairs = [];
    let rm;
    while ((rm = rptRegex.exec(block)) !== null) {
      rptPairs.push({ signOn: mkTime(rm[1]), signOff: mkTime(rm[2]) });
    }

    const blockLines = block.split(/\r?\n/);
    const flightLines = [];
    const rlsLines = [];
    blockLines.forEach((line, i) => {
      if (/^\d{2}[A-Za-z]{3}\s+([A-Z&]\s+)?\S+\s+[A-Z]{3}\s+\d{4}\s+[A-Z]{3}\s+\d{4}/.test(line)) flightLines.push(i);
      if (/Rpt\s+\d{4}\s+Rls\s+\d{4}/.test(line)) rlsLines.push(i);
    });

    const dutyPeriods = [];
    let fIdx = 0;
    rlsLines.forEach((rlsLine, rIdx) => {
      const period = { flightIndices: [], rpt: rptPairs[rIdx] };
      while (fIdx < flightLines.length && flightLines[fIdx] < rlsLine) {
        period.flightIndices.push(fIdx);
        fIdx++;
      }
      if (period.flightIndices.length > 0) dutyPeriods.push(period);
    });

    if (dutyPeriods.length === 0) return;

    const allSectors = [];
    const hotels = [];
    let hasSlip = false;

    dutyPeriods.forEach((period, pi) => {
      const periodStartSecIdx = allSectors.length;
      period.flightIndices.forEach((globalFlightIdx, localIdx) => {
        const f = flights[globalFlightIdx];
        const isFirstOfPeriod = localIdx === 0;
        const isLastOfPeriod = localIdx === period.flightIndices.length - 1;
        const signOn = isFirstOfPeriod ? period.rpt.signOn : mkTime(f.depTime);
        const signOff = isLastOfPeriod ? period.rpt.signOff : mkTime(f.arrTime);
        let sectorDate = f.sectorDate;
        if (isFirstOfPeriod) {
          const rptMin = parseTime(period.rpt.signOn);
          const depMin = parseTime(mkTime(f.depTime));
          if (rptMin != null && depMin != null && rptMin > depMin) {
            sectorDate = addDays(f.sectorDate, -1);
          }
        }
        const sec = bldSec(f.flightNo, f.dep, f.arr, signOn, signOff, sectorDate, {
          flightDepTime: mkTime(f.depTime), flightArrTime: mkTime(f.arrTime),
          flightDepDate: f.sectorDate,
          isPositioning: f.isGroundDuty ? false : f.isPositioning,
          isGroundDuty: f.isGroundDuty,
        });
        allSectors.push(sec);
      });
      for (let i = periodStartSecIdx; i < allSectors.length - 1; i++) {
        allSectors[i].continueDuty = true;
      }
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
          let checkOutDate = nextFirstFlight.sectorDate;
          const nextRptMin = parseTime(nextPeriod.rpt.signOn);
          const nextDepMin = parseTime(mkTime(nextFirstFlight.depTime));
          if (nextRptMin != null && nextDepMin != null && nextRptMin > nextDepMin) {
            checkOutDate = addDays(nextFirstFlight.sectorDate, -1);
          }
          // Apply transit-time shift so the recorded hotelCheckIn/hotelCheckOut
          // represent the time AT the hotel, not the time AT the airport. From
          // TRANSIT_REMOVAL_DATE onwards the shift is suppressed and the
          // window matches airport sign-off/sign-on directly.
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
            // Transit minutes applied to shift hotel bounds inward from the
            // raw airport sign-off/sign-on. Used later by the incidental
            // accumulator so the *raw* slip time (sign-off to sign-on) drives
            // the >24h incidental count, even when transit shrinks the
            // recorded hotel window.
            transitApplied: transit,
          });
        }
      }
    });

    if (allSectors.length === 0) return;

    const firstDate = allSectors[0].sectorDate;
    const ws = getMon(firstDate);
    const d = parseDate(firstDate);
    if (!d) return;
    const dow = d.getUTCDay();
    const dayKey = DAY_NAMES[(dow + 6) % 7];

    const week = ensureWeek(ws);
    week[dayKey] = { ...emptyDay(), sectors: allSectors, hasSlip, hotels };
  });

  // ── OL48 → Day Off Payment ──
  // An "OL48" in the Code column of a top-schedule row signals that the
  // pattern infringed on a designated day off and a day-off payment is owed
  // (Cl. 5.20). The OL48 lines were queued during the top-section scan above
  // (where topMonth/topYear were correctly tracked). Apply them here, AFTER
  // pattern blocks have populated each day, so the increment lands on the
  // populated record instead of being overwritten by an emptyDay().
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
  // "AS48" in the Code column marks the pattern for a DVA (Cl. 5.28). Same
  // application pattern as OL48 but tags extraDva instead of extraDdo. Numeric
  // prefix (e.g. `2AS48`) increases the count.
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
  // or four hours." Tag the day so calcCreditHoursForWeeks can apply the floor
  // when the natural credit for the day's duties falls short of 4h.
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
  // Pattern-block entries take precedence over top-schedule entries. The same
  // duty code can legitimately repeat on different days (e.g. four CC days in
  // a row, or a four-day SIM course), so dedup is keyed by CODE+DATE — not
  // code alone. Earlier versions keyed only by code, which caused consecutive
  // ground duties (CC, EF, GS, IE, SIM, NTS, PDD…) in the top schedule to be
  // wiped if any same-coded sector existed in a pattern block.
  {
    const normCode = c => (c || "").toUpperCase().replace(/\(T\)$/,"").trim();
    const isFromPattern = day =>
      day.sectors.length > 1 ||
      (day.hotels && day.hotels.length > 0) ||
      day.sectors.some(s => s.flightDepTime);
    const seen = new Set();
    const weekKeys = Object.keys(weeks).sort();
    // Pass 1: collect code@date for sectors that came from pattern blocks
    weekKeys.forEach(wk => {
      const wDays = weeks[wk];
      DAY_NAMES.forEach(dn => {
        const day = wDays[dn];
        if (!day || !day.sectors || day.sectors.length === 0) return;
        if (isFromPattern(day)) {
          day.sectors.forEach(s => {
            const c = normCode(s.flightNo);
            if (c) seen.add(s.sectorDate ? `${c}@${s.sectorDate}` : c);
          });
        }
      });
    });
    // Pass 2: drop top-schedule single-sector entries whose code+date already exists
    weekKeys.forEach(wk => {
      const wDays = weeks[wk];
      DAY_NAMES.forEach(dn => {
        const day = wDays[dn];
        if (!day || !day.sectors || day.sectors.length === 0) return;
        if (day.sectors.length === 1 && (!day.hotels || day.hotels.length === 0) && !day.sectors[0].flightDepTime) {
          const sec0 = day.sectors[0];
          // LA and reserve legitimately repeat with the same code — skip dedup
          if (sec0.isAnnualLeave || sec0.reservePeriod) return;
          const c = normCode(sec0.flightNo);
          const dateKey = sec0.sectorDate ? `${c}@${sec0.sectorDate}` : c;
          if (c && seen.has(dateKey)) wDays[dn] = emptyDay();
          else if (c) seen.add(dateKey);
        }
      });
    });
  }

  const firstWeekStart = Object.keys(weeks).sort()[0] || null;
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
          if (h.hotelTo) { if (!rangeTo || h.hotelTo > rangeTo) rangeTo = h.hotelTo; }
        });
      });
    });
  }
  // Parse Qantas's own boundary-attribution values from the roster header.
  // These are the authoritative statement of hours moving between BPs.
  const hdrDutyMatch = text.match(/Total Duty Hours Carried In \(Out\)\s*:\s*(\d+:\d+)\s*\(\s*(\d+:\d+)\s*\)/);
  const hdrCredMatch = text.match(/Total Credit Hours Carried In \(Out\)\s*:\s*(\d+:\d+)\s*\(\s*(\d+:\d+)\s*\)/);
  const hdrTotDuty = (text.match(/Total Duty Hours \(Total TAFB\)\s*:\s*(\d+:\d+)/) || [])[1] || null;
  const hdrTotCred = (text.match(/Total Credit Hours\s*:\s*(\d+:\d+)/) || [])[1] || null;
  const headerCarry = {
    carriedInDuty:   hdrDutyMatch ? hdrDutyMatch[1] : null,
    carriedOutDuty:  hdrDutyMatch ? hdrDutyMatch[2] : null,
    carriedInCredit: hdrCredMatch ? hdrCredMatch[1] : null,
    carriedOutCredit:hdrCredMatch ? hdrCredMatch[2] : null,
    totalDuty:       hdrTotDuty,
    totalCredit:     hdrTotCred,
  };
  return { weeks, firstWeekStart, rangeFrom, rangeTo, detectedRole, detectedFleet, detectedBase, detectedBP: bpMatch ? parseInt(bpMatch[1],10) : null, headerCarry, errors };
}

// ─── Pilot name extraction ────────────────────────────────────────────────────
// Header line: "     Name    :  PAPPIN TW                Category:  F/O-A330"
function extractPilotName(text) {
  const m = text.match(/Name\s*:\s*([A-Z][A-Z\s\-']+?)\s{2,}/);
  if (!m) return null;
  return m[1].trim();
}

function extractStaffNo(text) {
  const m = text.match(/Staff\s*No\s*:\s*(\d+)/);
  return m ? m[1] : null;
}

// ─── Credit hours per roster ──────────────────────────────────────────────────
function calcCreditHoursForWeeks(weeks, rangeFrom, rangeTo) {
  // Same boundary-flight extension as processRoster — outgoing boundary trips
  // dated 1–3 days past rangeTo get included in base credit; header COut then
  // subtracts them back so they don't double-count.
  const addDaysCr = (s, n) => { if (!s) return s; const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };
  const extRangeTo = rangeTo ? addDaysCr(rangeTo, 7) : rangeTo;
  const isInRange = (d) => {
    if (!rangeFrom || !extRangeTo) return true;
    return d >= rangeFrom && d <= extRangeTo;
  };
  let total = 0;
  const cat = { block: 0, positioning: 0, ground: 0, reserve: 0, leave: 0 };
  const counts = { reserveDays: 0, leaveDays: 0, groundDuties: 0, opSectors: 0, posSectors: 0 };
  Object.keys(weeks).forEach(ws => {
    const wDays = weeks[ws];
    DAY_NAMES.forEach((dn, di) => {
      const day = wDays[dn];
      if (!day) return;
      const firstSec = day.sectors?.[0];
      if (!firstSec) return;
      // Skip days with no recognised duty: no sign-on, no leave, no reserve
      if (!firstSec.aSignOn && !firstSec.isAnnualLeave && !firstSec.reservePeriod) return;
      const wsDate = parseDate(ws);
      if (!wsDate) return;
      const tripDate = isoDate(new Date(wsDate.getTime() + di * 86400000));

      // Track the day's natural credit so an OL13 reserve-activation floor of
      // 4h can be applied if the duty totals less than that.
      let dayCredit = 0;
      const dayCat = { block: 0, positioning: 0, ground: 0, reserve: 0, leave: 0 };
      let dayInRange = false;

      day.sectors.forEach(sec => {
        const secDate = sec.sectorDate || tripDate;
        // Attribute credit by sectorDate. Cross-BP boundary shifts are handled
        // downstream by processRoster applying the header's Carried In/Out
        // credit values (Qantas's authoritative boundary numbers).
        if (!isInRange(secDate)) return;
        dayInRange = true;

        // CC, CCR and MD days attract DHA only — no credit hours (so they do
        // not count toward the 70h overtime threshold or flight pay). DHA is
        // paid separately in calcAllowancesByDate.
        if (/^(CCR|CC|MD)\d*\b/i.test(sec.flightNo || "")) return;

        if (sec.isAnnualLeave) {
          dayCredit += 2.5; dayCat.leave += 2.5; counts.leaveDays += 1;
        } else if (sec.reservePeriod) {
          dayCredit += 4; dayCat.reserve += 4; counts.reserveDays += 1;
        } else if (sec.isGroundDuty) {
          const on = parseTime(sec.aSignOn), off = parseTime(sec.aSignOff);
          if (on == null || off == null) return;
          let mins = off - on; if (mins < 0) mins += 1440;
          const h = Math.min(mins / 60, 4);
          dayCredit += h; dayCat.ground += h; counts.groundDuties += 1;
        } else {
          const depTime = sec.flightDepTime || sec.aSignOn;
          const arrTime = sec.flightArrTime || sec.aSignOff;
          const depCode = sec.depAirport, arrCode = sec.arrAirport;
          if (!depTime || !arrTime || !depCode || !arrCode) return;
          const depAp = AIRPORTS.find(a => a.code === depCode);
          const arrAp = AIRPORTS.find(a => a.code === arrCode);
          if (!depAp || !arrAp) return;
          const depMin = parseTime(depTime), arrMin = parseTime(arrTime);
          if (depMin == null || arrMin == null) return;
          const depOffsetH = getUtcOffsetHours(depCode, sec.flightDepDate || secDate);
          const arrOffsetH = getUtcOffsetHours(arrCode, sec.flightDepDate || secDate);
          const depUtc = depMin - depOffsetH * 60;
          const arrUtc = arrMin - arrOffsetH * 60;
          let blockMins = arrUtc - depUtc;
          if (blockMins < 0) blockMins += 1440;
          const blockHrs = blockMins / 60;
          if (sec.isPositioning) {
            const h = blockHrs * 0.5;
            dayCredit += h; dayCat.positioning += h; counts.posSectors += 1;
          } else {
            dayCredit += blockHrs; dayCat.block += blockHrs; counts.opSectors += 1;
          }
        }
      });

      // OL13 reserve activation: credit is max(natural, 4h). The shortfall is
      // booked to cat.reserve so the breakdown reflects where the bump came
      // from. Only applied when at least one sector fell inside the date range.
      if (day.ol13Reserve && dayInRange && dayCredit < 4) {
        const bump = 4 - dayCredit;
        dayCat.reserve += bump;
        dayCredit = 4;
      }

      total += dayCredit;
      cat.block += dayCat.block;
      cat.positioning += dayCat.positioning;
      cat.ground += dayCat.ground;
      cat.reserve += dayCat.reserve;
      cat.leave += dayCat.leave;
    });
  });
  return { total, cat, counts };
}

// ─── Process a single roster file ─────────────────────────────────────────────
function processRoster(text, yearIdx, fallbackName) {
  const pilotName = extractPilotName(text) || fallbackName || "Unknown";
  const staffNo = extractStaffNo(text);
  const parsed = parseQantasRoster(text);
  const { weeks, rangeFrom, rangeTo, detectedRole, detectedFleet, detectedBase, detectedBP, errors } = parsed;
  const role = detectedRole || "fo";

  // The header's Carried Out value represents a duty in this BP's file that
  // Qantas will pay in the NEXT BP. If the boundary sector's sectorDate is
  // past rangeTo (as with BP3755's QF7536 on 13-Jul, one day after rangeTo
  // 12-Jul), our strict-range base excludes it, but COut still subtracts —
  // creating an undercount. Extend the base's upper bound by 7 days so the
  // outgoing boundary trip lands inside base; COut then cancels it cleanly.
  // Incoming boundary trips (dated before rangeFrom) stay excluded and CIn
  // adds them back — same logic, opposite direction.
  const addDaysBulk = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };
  const baseRangeTo = rangeTo ? addDaysBulk(rangeTo, 7) : rangeTo;
  const isInRange = (d) => {
    if (!rangeFrom || !baseRangeTo) return true;
    return d >= rangeFrom && d <= baseRangeTo;
  };

  let mealTotal = 0;
  let dhaTotal = 0;
  let dayOffPayTotal = 0;  // ddo_* items (from OL48 / extraDdo)
  let dayOffPayCount = 0;
  let dvaTotal = 0;        // dva_* items (from extraDva — currently UI-only)
  let dvaCount = 0;
  let dhaCount = 0;       // number of DHA items (= duty periods, possibly midnight-split)
  let dhaHours = 0;       // total DHA-eligible duty hours
  // TAFB (Time Away From Base): cumulative hours from first sign-on to last
  // sign-off for every trip that leaves the pilot's home base. Includes
  // hotel slip time (overnight hours count as time away). At-base ground
  // duties (sims/courses at home base) contribute 0 hours.
  let tafbHours = 0;
  // Total time spent in hotels — sum of (checkOut - checkIn) across every
  // hotel stay falling in the BP range. Subset of TAFB. Used in the trend
  // chart's bubble: when a meal-allowance point is tapped, hotel hours are
  // shown alongside the $ amount because meals are largely a function of
  // time in the hotel.
  let hotelHours = 0;
  const mealCounts = { b: 0, l: 0, d: 0, i: 0 };  // counts of each meal type
  const mealAmounts = { b: 0, l: 0, d: 0, i: 0 }; // $ totals per meal type
  const dhaPerHourRate = (role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO) * INDEX_YEARS[yearIdx].mult;

  Object.keys(weeks).forEach(ws => {
    const wDays = weeks[ws];
    DAY_NAMES.forEach((dn, di) => {
      const day = wDays[dn];
      if (!day || !day.sectors?.[0]?.aSignOn) return;
      const wsDate = parseDate(ws);
      if (!wsDate) return;
      const tripDate = isoDate(new Date(wsDate.getTime() + di * 86400000));

      // ── TAFB: time away from base for this trip ──
      // A trip "leaves base" if any of its sectors arrives at or departs from
      // an airport other than detectedBase. If all sectors stay at base
      // (e.g. a sim at home), TAFB contribution is 0.
      // The TAFB span runs from the FIRST sector's sign-on to the LAST
      // sector's sign-off, with multi-day spans including hotel slip time.
      const dutySecs = day.sectors.filter(s => s.aSignOn && s.aSignOff);
      if (dutySecs.length > 0 && detectedBase) {
        // SYD-based pilots are also based at WSI (Western Sydney) so for
        // TAFB purposes the home base "set" is {SYD, WSI} when either is the
        // detected base. Any other base is its own single-element set.
        const baseSet = (detectedBase === "SYD" || detectedBase === "WSI")
          ? new Set(["SYD", "WSI"])
          : new Set([detectedBase]);
        const isHome = (ap) => !ap || baseSet.has(ap);
        const leavesBase = dutySecs.some(s =>
          (s.depAirport && !isHome(s.depAirport)) ||
          (s.arrAirport && !isHome(s.arrAirport))
        );
        if (leavesBase) {
          const first = dutySecs[0];
          const last  = dutySecs[dutySecs.length - 1];
          // Convert each sector's sign-on / sign-off to absolute UTC ms.
          // KEY DETAIL: when the return flight departs across midnight (e.g.
          // HKG→SYD departing 00:13 HKG on 23 May, the duty stays anchored on
          // 22 May in the roster), the sign-off time "11:22" at SYD is on the
          // calendar day AFTER `sectorDate`. We detect this by comparing UTC
          // timestamps — if sign-off UTC < sign-on UTC for the same sector,
          // the sign-off rolled past midnight, so we add 24h. This is exactly
          // why the roster's TAFB total for pattern 7405ZA1 reads 72h while
          // a naive sign-on-to-sign-off-same-day calc gives 48h.
          const sectorBounds = (sec) => {
            if (!sec?.aSignOn || !sec?.aSignOff || !sec?.sectorDate) return null;
            const onMs  = localToUtcMs(sec.sectorDate, sec.aSignOn,  sec.depAirport || detectedBase);
            let   offMs = localToUtcMs(sec.sectorDate, sec.aSignOff, sec.arrAirport || detectedBase);
            if (onMs == null || offMs == null) return null;
            if (offMs <= onMs) offMs += 86400000;
            return { onMs, offMs };
          };
          const firstB = sectorBounds(first);
          const lastB  = sectorBounds(last);
          if (firstB && lastB) {
            const startMs = firstB.onMs;
            let endMs = lastB.offMs;
            // If the last sector's sectorDate is the same as the first's and
            // its signed-off-end is still before sign-on (edge case where the
            // whole duty crosses midnight at base), ensure endMs > startMs.
            if (endMs <= startMs) endMs += 86400000;
            // BP window — midnight Sydney time on the first day of the BP
            // through midnight Sydney time on the day after rangeTo.
            const rangeStartMs = rangeFrom
              ? localToUtcMs(rangeFrom, "00:00", "SYD")
              : -Infinity;
            const rangeEndMs = rangeTo
              ? localToUtcMs(rangeTo, "00:00", "SYD") + 86400000
              : Infinity;
            const clippedStart = Math.max(startMs, rangeStartMs);
            const clippedEnd   = Math.min(endMs,   rangeEndMs);
            if (clippedEnd > clippedStart) {
              tafbHours += (clippedEnd - clippedStart) / 3600000;
            }
          }
        }
      }

      // ── Hotel hours: sum (checkOut - checkIn) for each hotel stay ──
      // Range-clipped same way as TAFB, also timezone-aware (hotel times are
      // local at the slip city, which is the arrival airport of the linked
      // sector).
      if (day.hotels && day.hotels.length > 0) {
        const rangeStartMs = rangeFrom ? localToUtcMs(rangeFrom, "00:00", "SYD") : -Infinity;
        const rangeEndMs   = rangeTo   ? localToUtcMs(rangeTo,   "00:00", "SYD") + 86400000 : Infinity;
        day.hotels.forEach(h => {
          if (!h.hotelFrom || !h.hotelTo || !h.hotelCheckIn || !h.hotelCheckOut) return;
          const hotelCity = (h.afterSectorIdx != null && day.sectors[h.afterSectorIdx]?.arrAirport)
                             || detectedBase;
          const startMs = localToUtcMs(h.hotelFrom, h.hotelCheckIn, hotelCity);
          const endMs   = localToUtcMs(h.hotelTo,   h.hotelCheckOut, hotelCity);
          if (startMs == null || endMs == null || endMs <= startMs) return;
          const cs = Math.max(startMs, rangeStartMs);
          const ce = Math.min(endMs,   rangeEndMs);
          if (ce > cs) hotelHours += (ce - cs) / 3600000;
        });
      }

      const byDate = calcAllowancesByDate(day, role, yearIdx, tripDate);
      Object.entries(byDate).forEach(([dateStr, items]) => {
        if (!isInRange(dateStr)) return;
        items.forEach(item => {
          if (item.id.startsWith("dha_")) {
            dhaTotal += item.amount;
            dhaCount += 1;
            if (dhaPerHourRate > 0) dhaHours += item.amount / dhaPerHourRate;
          } else if (item.id.startsWith("meal_")) {
            mealTotal += item.amount;
            const t = item.id.split("_")[1]; // b | l | d | i
            if (mealCounts[t] != null) {
              mealCounts[t] += item.qty;
              mealAmounts[t] += item.amount;
            }
          } else if (item.id.startsWith("ddo_")) {
            dayOffPayTotal += item.amount;
            dayOffPayCount += item.qty;
          } else if (item.id.startsWith("dva_")) {
            dvaTotal += item.amount;
            dvaCount += item.qty;
          }
        });
      });
    });
  });

  const credit = calcCreditHoursForWeeks(weeks, rangeFrom, rangeTo);

  // ── Apply Qantas's authoritative boundary-attribution values ───────────────
  // The roster header prints "Total Duty Hours Carried In (Out)" and "Total
  // Credit Hours Carried In (Out)" — these are the exact hours Qantas moves
  // between BPs at midnight (11:27 QF7526 for BP3745, 7:11 D2 tail out, etc.).
  // Our per-sector totals above attribute everything by raw sectorDate; here
  // we add what belongs in this BP (CIn) and subtract what leaves (COut).
  const hm2h = (s) => {
    if (!s || typeof s !== "string") return 0;
    const parts = s.trim().split(":").map(n => parseInt(n, 10));
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
    return parts[0] + parts[1] / 60;
  };
  const hdr = parsed && parsed.headerCarry;
  const hdrCInDutyH  = hm2h(hdr?.carriedInDuty);
  const hdrCOutDutyH = hm2h(hdr?.carriedOutDuty);
  const hdrCInCredH  = hm2h(hdr?.carriedInCredit);
  const hdrCOutCredH = hm2h(hdr?.carriedOutCredit);
  const dhaRateApplied = role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO;
  const headerDutyDelta   = hdrCInDutyH - hdrCOutDutyH;
  const headerCreditDelta = hdrCInCredH - hdrCOutCredH;
  dhaTotal += headerDutyDelta * dhaRateApplied;
  dhaHours += headerDutyDelta;
  const creditHoursTotal = credit.total + headerCreditDelta;

  // ── Pilot list lookup + YOS bracket ────────────────────────────────────────
  const matchedPilot = findPilotInList(pilotName);
  // Reference date for years-of-service display & paid-bracket lookup:
  //   • If the BP's date range is in the past, use the BP's END date so the
  //     displayed YOS reflects service at the end of that BP.
  //   • If today falls within or before the BP range, use today's date so
  //     current/future BPs reflect the pilot's actual current service.
  // The paid bracket itself still anchors against the EA freeze date
  // (1 Jan 2026) internally — see paidBracketIdxFromAnchor.
  const today = new Date().toISOString().slice(0, 10);
  const yosAsOfDate = (rangeTo && rangeTo < today) ? rangeTo : today;
  // If the pilot couldn't be matched to the EFA list, assume they joined
  // AFTER PAID_BRACKET_FREEZE_DATE (i.e. after 1 Jan 2026) and so sit in
  // bracket 0 ("less than 3 years") with no bracket-bump applied. This is
  // a conservative default that still produces sensible pay output; the
  // result includes `assumedBracket:true` so the UI can flag it.
  const yos = matchedPilot ? yearsOfServiceBetween(matchedPilot.joinDate, yosAsOfDate) : 0;
  const actBIdx = matchedPilot ? actualBracketIdx(yos, role) : 0;
  const paidBIdx = matchedPilot
    ? paidBracketIdxFromAnchor(matchedPilot.joinDate, role, yosAsOfDate)
    : 0;
  const assumedBracket = !matchedPilot;
  const bracketList = bracketsForRole(role);

  // ── Fleet detection — roster wins, fall back to pilot list ─────────────────
  const fleet = detectedFleet || (matchedPilot ? normaliseFleet(matchedPilot.fleet) : null);

  // ── Annual salary + over-70 credit-hour pay ────────────────────────────────
  // Round the hourly rate and extra credit hours to 2 dp before multiplying so
  // the displayed values reconcile (e.g. "3.87h × $231.85/h = $897.26" rather
  // than $896.50 from full-precision multiplication that hides trailing decimals).
  const annualSalary = lookupAnnualSalary(fleet, role, paidBIdx, yearIdx);
  const creditHourRate = annualSalary != null
    ? Math.round((annualSalary / CREDIT_HOUR_DIVISOR) * 100) / 100
    : null;
  const extraCreditHours = Math.max(0, Math.round((creditHoursTotal - CREDIT_HOUR_THRESHOLD) * 100) / 100);
  const creditHourPay = creditHourRate != null ? extraCreditHours * creditHourRate : 0;

  return {
    pilotName,
    staffNo,
    role,
    fleet,
    bidPeriod: detectedBP,
    rangeFrom,
    rangeTo,
    mealTotal,
    dhaTotal,
    dayOffPayTotal,
    dvaTotal,
    creditHours: creditHoursTotal,
    tafbHours,
    hotelHours,
    matchedPilot,
    assumedBracket,
    yosAsOfDate,
    yearsOfService: yos,
    actualBracket: bracketList[actBIdx] || null,
    paidBracket: bracketList[paidBIdx] || null,
    annualSalary,
    creditHourRate,
    extraCreditHours,
    creditHourPay,
    grandTotal: mealTotal + dhaTotal + dayOffPayTotal + dvaTotal + creditHourPay,
    // Qantas header's own boundary values so the UI can show what the carry
    // adjustment contributed (or subtracted from) the DHA and credit totals.
    headerCarry: hdr || null,
    headerDutyDeltaHrs: headerDutyDelta,
    headerCreditDeltaHrs: headerCreditDelta,
    hotelHours,
    matchedPilot,
    assumedBracket,
    yosAsOfDate,
    yearsOfService: yos,
    actualBracket: bracketList[actBIdx] || null,
    paidBracket: bracketList[paidBIdx] || null,
    annualSalary,
    creditHourRate,
    extraCreditHours,
    creditHourPay,
    grandTotal: mealTotal + dhaTotal + dayOffPayTotal + dvaTotal + creditHourPay,
    breakdown: {
      dhaCount,
      dhaHours,
      mealCounts,
      mealAmounts,
      dayOffPayCount,
      dvaCount,
      creditCat: credit.cat,
      creditCounts: credit.counts,
    },
    errors,
  };
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const COL = {
  bg: "#FAF7F2",
  card: "#FFFFFF",
  text: "#1A1A2E",
  muted: "#4A4F57",
  border: "#D4CCC0",
  borderSoft: "#E8E2D9",
  accent: "#1E8AC0",
  accentSoft: "#D6E4F0",
  accentDark: "#1672A4",
  green: "#3DA866",
  amber: "#D4A80A",
  red: "#CC2E2E",
};

// Bracket chip colours — graduated from amber (low) to deep teal (top)
function bracketBg(id) {
  return { B0: "#FFF3E0", B1: "#FFE4B8", B2: "#D6E4F0", B3: "#C8E6D0" }[id] || "#E5DDD0";
}
function bracketFg(id) {
  return { B0: "#A85D04", B1: "#8A4A06", B2: "#1672A4", B3: "#1F7A4A" }[id] || "#4A4F57";
}

// ─── How-to-use guide ─────────────────────────────────────────────────────────
// Step-by-step guide, shown when the header "?" button is tapped.
function HelpModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const steps = [
    ["Set the pay year", "Choose the EBA INDEXATION year. It applies the matching indexation to every allowance, salary and overtime rate for all pilots at once."],
    ["Upload the rosters", "Tap SELECT .TXT FILES and pick up to 200 EFA webCIS bid-period .txt files — typically one bid period's rosters for many pilots. Each pilot's name, rank, fleet and base are read from the file header."],
    ["Let it process", "A progress bar shows files being parsed. Each pilot is matched against the EFA pilot list to set their years-of-service bracket (pilots who joined after 1 Jan 2026 don't receive the one-time tier bump)."],
    ["Read the summary table", "The SUMMARY view lists one row per pilot: allowances (DHA, meals, day-off, DVA), credit hours, overtime / credit-hour pay and the grand total. Click any column heading to sort."],
    ["Open a pilot's detail", "Click a pilot's row to expand a full breakdown — every allowance type, credit-hour category and their salary bracket for the selected year."],
    ["Compare with STATS", "Switch to the STATS view for a chart across all bid periods — toggle the series on and off, flip the x-axis between BP and pilot name, and click a bar segment for its detail."],
    ["Export & housekeeping", "EXPORT CSV saves the whole table, ⤓ DOWNLOAD APP saves a standalone offline copy of this tool, and CLEAR removes all loaded rosters."],
  ];

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(20,24,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: COL.bg, border: `1px solid ${COL.accent}`, borderRadius: 16, maxWidth: 640, width: "100%", maxHeight: "calc(100dvh - 32px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: `1px solid ${COL.borderSoft}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COL.text, letterSpacing: -0.5 }}>How to use this tool</div>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: COL.muted, fontFamily: mono, marginTop: 2 }}>EFA BULK ROSTER SUMMARY</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 8, color: COL.muted, fontSize: 16, cursor: "pointer", padding: "4px 11px", fontFamily: mono, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ padding: "14px 22px 22px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
          {steps.map(([title, body], i) => (
            <div key={i} style={{ display: "flex", gap: 13, padding: "11px 0", borderBottom: i < steps.length - 1 ? `1px solid ${COL.borderSoft}` : "none" }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: COL.accentSoft, border: `1px solid ${COL.accent}`, color: COL.accent, fontFamily: mono, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COL.text, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 13, color: COL.muted, lineHeight: 1.55 }}>{body}</div>
              </div>
            </div>
          ))}
          <button onClick={onClose}
            style={{ marginTop: 16, width: "100%", background: COL.accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "10px", fontFamily: mono, letterSpacing: 0.5 }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-pilot breakdown panel ────────────────────────────────────────────────
function BreakdownPanel({ r }) {
  const b = r.breakdown || {};
  const mc = b.mealCounts || { b: 0, l: 0, d: 0, i: 0 };
  const ma = b.mealAmounts || { b: 0, l: 0, d: 0, i: 0 };
  const cat = b.creditCat || { block: 0, positioning: 0, ground: 0, reserve: 0, leave: 0 };
  const cnt = b.creditCounts || { reserveDays: 0, leaveDays: 0, groundDuties: 0, opSectors: 0, posSectors: 0 };

  const mealRow = (label, n, amt) => n > 0 ? (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
      <span>{label} <span style={{ color: COL.muted }}>× {n}</span></span>
      <span style={{ fontWeight: 700 }}>${fmtAUD(amt)}</span>
    </div>
  ) : null;

  const creditRow = (label, hours, count, suffix = "") => hours > 0 ? (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
      <span>{label} {count != null && <span style={{ color: COL.muted }}>({count}{suffix})</span>}</span>
      <span style={{ fontWeight: 700 }}>{hours.toFixed(2)}h</span>
    </div>
  ) : null;

  const noMeals = mc.b + mc.l + mc.d + mc.i === 0;

  const cardStyle = {
    background: COL.card,
    border: `1px solid ${COL.borderSoft}`,
    borderRadius: 8,
    padding: "12px 14px",
    minWidth: 0,
  };
  const headerStyle = {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: 700,
    color: COL.muted,
    marginBottom: 8,
    textTransform: "uppercase",
  };

  // Date-range label: "23 Feb – 22 Mar 2026". When the range crosses a year
  // boundary (e.g. a December → January BP), both years are shown so it reads
  // unambiguously as "29 Dec 2025 – 25 Jan 2026".
  const period = (() => {
    if (!r.rangeFrom || !r.rangeTo) return "";
    const yFrom = r.rangeFrom.slice(0, 4);
    const yTo = r.rangeTo.slice(0, 4);
    if (yFrom !== yTo) {
      return `${fmtShort(r.rangeFrom)} ${yFrom} – ${fmtShort(r.rangeTo)} ${yTo}`;
    }
    return `${fmtShort(r.rangeFrom)} – ${fmtShort(r.rangeTo)} ${yTo}`;
  })();

  return (
    <div>
      <div style={{ fontSize: 11, color: COL.muted, fontFamily: mono, marginBottom: 10, letterSpacing: 0.5 }}>
        {period && <span>{period}</span>}
        {r.bidPeriod && <span> · BP {r.bidPeriod}</span>}
        {b.dhaCount > 0 && <span> · {b.dhaCount} duty period{b.dhaCount !== 1 ? "s" : ""}</span>}
      </div>

      {/* Grand total banner */}
      <div style={{
        background: COL.text, color: "#FFF",
        borderRadius: 8, padding: "12px 16px", marginBottom: 12,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, opacity: 0.7 }}>
          TOTAL EARNED THIS PERIOD
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: mono, letterSpacing: -0.3 }}>
          ${fmtAUD(r.grandTotal || 0)}
        </div>
        <div style={{ fontSize: 10, fontFamily: mono, opacity: 0.7, fontWeight: 400 }}>
          ${fmtAUD(r.mealTotal)} meals + ${fmtAUD(r.dhaTotal)} DHA{r.dayOffPayTotal > 0 ? ` + ${fmtAUD(r.dayOffPayTotal)} day-off` : ""} + ${fmtAUD(r.creditHourPay)} OT
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>

        {/* Service / Pay Bracket */}
        <div style={cardStyle}>
          <div style={{ ...headerStyle, color: COL.text }}>Service</div>
          {r.matchedPilot ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Matched</span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>{r.matchedPilot.displayName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Joined</span>
                <span style={{ fontWeight: 700 }}>{fmtFull(r.matchedPilot.joinDate)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Service at end of BP</span>
                <span style={{ fontWeight: 700 }}>{r.yearsOfService != null ? `${r.yearsOfService.toFixed(2)} yrs` : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono, color: COL.muted }}>
                <span>Actual band</span>
                <span>{r.actualBracket ? r.actualBracket.label : "—"}</span>
              </div>
              <div style={{ borderTop: `1px solid ${COL.borderSoft}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: mono, fontWeight: 800 }}>
                <span>Paid as</span>
                <span style={{
                  background: bracketBg(r.paidBracket?.id),
                  color: bracketFg(r.paidBracket?.id),
                  padding: "2px 8px", borderRadius: 4,
                }}>{r.paidBracket ? r.paidBracket.label : "—"}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: COL.muted, fontStyle: "italic" }}>
              Pilot name “{r.pilotName}” did not match any pilot on the EFA list (1 Jan 2026).
            </div>
          )}
        </div>

        {/* Salary & OT pay */}
        <div style={cardStyle}>
          <div style={{ ...headerStyle, color: "#A85D04" }}>Salary &amp; OT</div>
          {r.annualSalary != null ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Fleet</span>
                <span style={{ fontWeight: 700 }}>{r.fleet === "wide" ? "A330" : "A321"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Annual salary</span>
                <span style={{ fontWeight: 700 }}>${fmtAUD(r.annualSalary)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono, color: COL.muted }}>
                <span>Per credit hour</span>
                <span>${r.creditHourRate.toFixed(2)} (÷750)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Credit hours</span>
                <span style={{ fontWeight: 700 }}>{r.creditHours.toFixed(2)}h</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono, color: COL.muted }}>
                <span>Hours over 70</span>
                <span>{r.extraCreditHours.toFixed(2)}h</span>
              </div>
              <div style={{ borderTop: `1px solid ${COL.borderSoft}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: mono, fontWeight: 800, color: "#A85D04" }}>
                <span>OT pay</span><span>${fmtAUD(r.creditHourPay)}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: COL.muted, fontStyle: "italic" }}>
              {!r.matchedPilot
                ? "Pilot not in EFA list — assumed post-2026 hire (<3 yrs bracket); no salary lookup possible without fleet."
                : !r.fleet
                ? "Fleet (A321/A330) could not be detected from roster or list."
                : "Salary not available for this combination."}
            </div>
          )}
        </div>

        {/* Meals */}
        <div style={cardStyle}>
          <div style={{ ...headerStyle, color: COL.amber }}>Meal Allowances</div>
          {noMeals ? (
            <div style={{ fontSize: 11, color: COL.muted, fontStyle: "italic" }}>No slip meals this period.</div>
          ) : (
            <>
              {mealRow("Breakfast", mc.b, ma.b)}
              {mealRow("Lunch", mc.l, ma.l)}
              {mealRow("Dinner", mc.d, ma.d)}
              {mealRow("Incidental", mc.i, ma.i)}
              <div style={{ borderTop: `1px solid ${COL.borderSoft}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: mono, fontWeight: 800, color: COL.amber }}>
                <span>Total</span><span>${fmtAUD(r.mealTotal)}</span>
              </div>
            </>
          )}
        </div>

        {/* DHA */}
        <div style={cardStyle}>
          <div style={{ ...headerStyle, color: COL.accent }}>DHA</div>
          {r.dhaTotal > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Duty hours</span>
                <span style={{ fontWeight: 700 }}>{b.dhaHours ? b.dhaHours.toFixed(2) : "0.00"}h</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                <span>Periods</span>
                <span style={{ fontWeight: 700 }}>{b.dhaCount || 0}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono, color: COL.muted }}>
                <span>Rate ({r.role === "cpt" ? "CPT" : "F/O"})</span>
                <span>${(((r.role === "cpt" ? RATES.DHA_CPT : RATES.DHA_FO))).toFixed(2)}/h × index</span>
              </div>
              {r.headerCarry && (r.headerCarry.carriedInDuty || r.headerCarry.carriedOutDuty) && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, fontFamily: mono, color: "#7C5CD6" }}>
                  <span>Carry (Qantas hdr)</span>
                  <span style={{ fontWeight: 700 }}>
                    {r.headerCarry.carriedInDuty !== "0:00" ? `+${r.headerCarry.carriedInDuty}` : "—"}
                    {" / "}
                    {r.headerCarry.carriedOutDuty !== "0:00" ? `−${r.headerCarry.carriedOutDuty}` : "—"}
                  </span>
                </div>
              )}
              <div style={{ borderTop: `1px solid ${COL.borderSoft}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: mono, fontWeight: 800, color: COL.accent }}>
                <span>Total</span><span>${fmtAUD(r.dhaTotal)}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: COL.muted, fontStyle: "italic" }}>No DHA-eligible duty.</div>
          )}
        </div>

        {/* Credit hours */}
        <div style={cardStyle}>
          <div style={{ ...headerStyle, color: COL.green }}>Credit Hours</div>
          {r.creditHours > 0 ? (
            <>
              {creditRow("Operating block", cat.block, cnt.opSectors, " sec")}
              {creditRow("Positioning", cat.positioning, cnt.posSectors, " sec")}
              {creditRow("Ground duties", cat.ground, cnt.groundDuties)}
              {creditRow("Reserve", cat.reserve, cnt.reserveDays, " day" + (cnt.reserveDays !== 1 ? "s" : ""))}
              {creditRow("Annual leave", cat.leave, cnt.leaveDays, " day" + (cnt.leaveDays !== 1 ? "s" : ""))}
              {r.headerCarry && (r.headerCarry.carriedInCredit || r.headerCarry.carriedOutCredit) && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, fontFamily: mono, color: "#7C5CD6" }}>
                  <span>Carry (Qantas hdr)</span>
                  <span style={{ fontWeight: 700 }}>
                    {r.headerCarry.carriedInCredit !== "0:00" ? `+${r.headerCarry.carriedInCredit}` : "—"}
                    {" / "}
                    {r.headerCarry.carriedOutCredit !== "0:00" ? `−${r.headerCarry.carriedOutCredit}` : "—"}
                  </span>
                </div>
              )}
              <div style={{ borderTop: `1px solid ${COL.borderSoft}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: mono, fontWeight: 800, color: COL.green }}>
                <span>Total</span><span>{r.creditHours.toFixed(2)}h</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: COL.muted, fontStyle: "italic" }}>No credit-bearing activity.</div>
          )}
        </div>

        {/* Other — DO + DVA payments (Cl 5.20, 5.28) */}
        {(() => {
          const doCount = b.dayOffPayCount || 0;
          const doRate = r.role === "cpt" ? RATES.DDO_CPT : RATES.DDO_FO;
          const dvaCount = b.dvaCount || 0;
          const dvaRate = r.role === "cpt" ? RATES.DVA_CPT : RATES.DVA_FO;
          const otherTotal = (r.dayOffPayTotal || 0) + (r.dvaTotal || 0);
          const hasAny = doCount > 0 || dvaCount > 0;
          return (
            <div style={cardStyle}>
              <div style={{ ...headerStyle, color: "#CC2E2E" }}>Other</div>
              {hasAny ? (
                <>
                  {doCount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                      <span>Day Off Payment</span>
                      <span style={{ fontWeight: 700 }}>{doCount} × ${fmtAUD(doRate)}</span>
                    </div>
                  )}
                  {dvaCount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, fontFamily: mono }}>
                      <span>Duty Variation Allowance</span>
                      <span style={{ fontWeight: 700 }}>{dvaCount} × ${fmtAUD(dvaRate)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${COL.borderSoft}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: mono, fontWeight: 800, color: "#CC2E2E" }}>
                    <span>Total</span><span>${fmtAUD(otherTotal)}</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: COL.muted, fontStyle: "italic" }}>No DO or DVA payments this period.</div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [results, setResults] = useState([]);
  const [yearIdx, setYearIdx] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [sortKey, setSortKey] = useState("pilotName");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);
  // Active view: "summary" (per-pilot allowance table) or "stats" (chart of
  // allowances $ on the right vs hours on the left for every BP).
  const [view, setView] = useState("summary");
  const [showHelp, setShowHelp] = useState(false);
  // Stats page interactivity: the currently selected bar segment renders a
  // tooltip bubble. Cleared by clicking outside any segment.
  const [activeSegment, setActiveSegment] = useState(null);
  // Trend-chart line toggles: one per plotted series. The five "atomic"
  // series default ON so the user sees everything immediately; the derived
  // "Total allowances" line is OFF by default because enabling it would
  // dominate the dollar axis and visually shrink the other lines.
  const [visibleSeries, setVisibleSeries] = useState({
    meal: true, ot: true, tafb: true, credit: true, dhaH: true,
    total: false,
  });
  // Trend-chart X-axis label mode: BP number (default) or pilot name.
  const [xAxisLabel, setXAxisLabel] = useState("bp"); // "bp" | "name"

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (files.length > 200) {
      setError(`Too many files (${files.length}). Maximum is 200.`);
      return;
    }
    setError("");
    setProcessing(true);
    setProgress({ done: 0, total: files.length });

    // Read every file up front and auto-select the EBA indexation year from
    // the earliest bid-period start date in the batch, so the rates applied
    // match when the rosters actually run (rates step up on 1 Jan 2027/28/29).
    const loaded = [];
    let earliestFrom = null;
    for (const f of files) {
      let text = null;
      try { text = await f.text(); } catch { /* keep null; handled below */ }
      let rf = null;
      if (text != null) { try { rf = parseQantasRoster(text).rangeFrom; } catch { /* ignore */ } }
      if (rf && (!earliestFrom || rf < earliestFrom)) earliestFrom = rf;
      loaded.push({ f, text });
    }
    const targetYear = earliestFrom != null ? ebaYearIdxForDate(earliestFrom) : yearIdx;
    if (targetYear !== yearIdx) setYearIdx(targetYear);

    const out = [];
    for (let i = 0; i < loaded.length; i++) {
      const { f, text } = loaded[i];
      try {
        if (text == null) throw new Error("could not read file");
        const res = processRoster(text, targetYear, f.name.replace(/\.txt$/i, ""));
        res._fileName = f.name;
        out.push(res);
      } catch (e) {
        out.push({
          pilotName: `[Error] ${f.name}`,
          role: "—",
          bidPeriod: null,
          rangeFrom: null,
          rangeTo: null,
          mealTotal: 0,
          dhaTotal: 0,
          dayOffPayTotal: 0,
          dvaTotal: 0,
          creditHours: 0,
          tafbHours: 0,
          hotelHours: 0,
          annualSalary: null,
          creditHourRate: null,
          extraCreditHours: 0,
          creditHourPay: 0,
          grandTotal: 0,
          breakdown: {
            dhaCount: 0, dhaHours: 0,
            mealCounts: { b:0, l:0, d:0, i:0 }, mealAmounts: { b:0, l:0, d:0, i:0 },
            dayOffPayCount: 0, dvaCount: 0,
            creditCat: { block:0, positioning:0, ground:0, reserve:0, leave:0 },
            creditCounts: { reserveDays:0, leaveDays:0, groundDuties:0, opSectors:0, posSectors:0 },
          },
          matchedPilot: null,
          errors: [e.message || String(e)],
          _fileName: f.name,
        });
      }
      setProgress({ done: i + 1, total: files.length });
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 0));
    }
    setResults(out);
    setProcessing(false);
  };

  const sorted = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => {
      // Synthetic sort key: paid bracket → numeric idx; unmatched sorts last
      const get = (r, k) => {
        if (k === "paidBracketSort") {
          return r.paidBracket ? YOS_BRACKETS.findIndex(b => b.id === r.paidBracket.id) : 99;
        }
        return r[k];
      };
      let av = get(a, sortKey), bv = get(b, sortKey);
      if (av == null) av = "";
      if (bv == null) bv = "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  const setSort = (k) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "pilotName" ? "asc" : "desc"); }
  };

  const totals = useMemo(() => {
    return results.reduce((acc, r) => ({
      meal: acc.meal + r.mealTotal,
      dha: acc.dha + r.dhaTotal,
      credit: acc.credit + r.creditHours,
      creditHourPay: acc.creditHourPay + (r.creditHourPay || 0),
      grandTotal: acc.grandTotal + (r.grandTotal || 0),
    }), { meal: 0, dha: 0, credit: 0, creditHourPay: 0, grandTotal: 0 });
  }, [results]);

  const periodLabel = useMemo(() => {
    if (results.length === 0) return "—";
    const bps = [...new Set(results.map(r => r.bidPeriod).filter(Boolean))];
    const froms = [...new Set(results.map(r => r.rangeFrom).filter(Boolean))].sort();
    const tos = [...new Set(results.map(r => r.rangeTo).filter(Boolean))].sort();
    if (bps.length === 1 && froms.length === 1 && tos.length === 1) {
      return `BP ${bps[0]} · ${fmtFull(froms[0])} → ${fmtFull(tos[0])}`;
    }
    if (bps.length > 1) return `${bps.length} different BPs (${bps.join(", ")})`;
    if (froms.length > 0 && tos.length > 0) return `${fmtFull(froms[0])} → ${fmtFull(tos[tos.length-1])}`;
    return "—";
  }, [results]);

  const downloadCsv = () => {
    if (results.length === 0) return;
    const esc = v => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [];
    rows.push(["Pilot", "Staff No", "Role", "Fleet", "Bid Period", "Period From", "Period To", "Matched Pilot", "Join Date", "Years of Service", "Actual Bracket", "Paid Bracket", "Annual Salary (AUD)", "Per-Hour Rate (AUD)", "Meal Allowances (AUD)", "DHA (AUD)", "Credit Hours", "Hours Over 70", "OT Pay (AUD)", "Total Earned (AUD)"].map(esc).join(","));
    sorted.forEach(r => {
      rows.push([
        r.pilotName,
        r.staffNo || "",
        r.role === "cpt" ? "Captain" : r.role === "fo" ? "First Officer" : r.role,
        r.fleet === "wide" ? "A330 (wide)" : r.fleet === "narrow" ? "A321/A320 (narrow)" : "",
        r.bidPeriod || "",
        r.rangeFrom ? fmtFull(r.rangeFrom) : "",
        r.rangeTo ? fmtFull(r.rangeTo) : "",
        r.matchedPilot ? r.matchedPilot.displayName : "",
        r.matchedPilot ? fmtFull(r.matchedPilot.joinDate) : "",
        r.yearsOfService != null ? r.yearsOfService.toFixed(2) : "",
        r.actualBracket ? r.actualBracket.label : "",
        r.paidBracket ? r.paidBracket.label : "",
        r.annualSalary != null ? r.annualSalary.toFixed(2) : "",
        r.creditHourRate != null ? r.creditHourRate.toFixed(2) : "",
        r.mealTotal.toFixed(2),
        r.dhaTotal.toFixed(2),
        r.creditHours.toFixed(2),
        r.extraCreditHours.toFixed(2),
        r.creditHourPay.toFixed(2),
        (r.grandTotal || 0).toFixed(2),
      ].map(esc).join(","));
    });
    rows.push("");
    rows.push(["", "", "", "", "", "", "", "", "", "", "", "TOTAL", "", "", totals.meal.toFixed(2), totals.dha.toFixed(2), totals.credit.toFixed(2), "", totals.creditHourPay.toFixed(2), totals.grandTotal.toFixed(2)].map(esc).join(","));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `efa-bulk-roster-summary-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => { setResults([]); setError(""); };

  const SortHeader = ({ k, children, align = "left" }) => (
    <th onClick={() => setSort(k)}
      style={{
        padding: "12px 14px", textAlign: align, fontSize: 10, letterSpacing: 1.5,
        color: COL.muted, fontFamily: mono, fontWeight: 700, cursor: "pointer",
        userSelect: "none", borderBottom: `2px solid ${COL.border}`, background: COL.bg,
        whiteSpace: "nowrap",
      }}>
      {children}
      <span style={{ marginLeft: 6, opacity: sortKey === k ? 1 : 0.25, color: COL.accent }}>
        {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );

  return (
    <div style={{
      minHeight: "100vh", background: COL.bg, color: COL.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "28px 20px",
    }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: 3, color: COL.muted, fontFamily: mono, marginBottom: 6,
            }}>EFA · BULK ROSTER PROCESSOR</div>
            <h1 style={{
              fontSize: 32, fontWeight: 800, margin: 0, color: COL.text, letterSpacing: -0.5,
            }}>Pilot Roster Summary</h1>
            <div style={{ fontSize: 13, color: COL.muted, marginTop: 6 }}>
              Upload up to 200 EFA webCIS BP roster .txt files. Pilot names pulled from each roster header.
            </div>
          </div>
          <button onClick={() => setShowHelp(true)} title="How to use this tool"
            style={{
              flexShrink: 0, background: COL.card, border: `1px solid ${COL.accent}`, borderRadius: 8,
              color: COL.accent, fontFamily: mono, fontSize: 16, fontWeight: 700, cursor: "pointer",
              width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
            }}>?</button>
        </div>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

        {/* Controls */}
        <div style={{
          background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 10,
          padding: 20, marginBottom: 18,
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: COL.muted, fontFamily: mono, marginBottom: 6 }}>
                EBA INDEXATION
              </div>
              <select value={yearIdx} onChange={e => setYearIdx(parseInt(e.target.value, 10))}
                disabled={processing}
                style={{
                  width: "100%", background: COL.bg, border: `1px solid ${COL.border}`,
                  borderRadius: 6, padding: "8px 10px", fontFamily: mono, fontSize: 13,
                  color: COL.text, cursor: processing ? "not-allowed" : "pointer",
                }}>
                {INDEX_YEARS.map((y, i) => (
                  <option key={i} value={i}>{y.label}</option>
                ))}
              </select>
            </div>

            <label style={{
              flex: "1 1 240px", display: "block", cursor: processing ? "not-allowed" : "pointer",
            }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: COL.muted, fontFamily: mono, marginBottom: 6 }}>
                UPLOAD ROSTERS
              </div>
              <div style={{
                background: COL.accent, color: "#fff", borderRadius: 6,
                padding: "10px 14px", fontFamily: mono, fontSize: 13, fontWeight: 700,
                textAlign: "center", letterSpacing: 0.5,
                opacity: processing ? 0.6 : 1,
              }}>
                ⤴ SELECT .TXT FILES (UP TO 200)
              </div>
              <input type="file" accept=".txt,text/plain" multiple
                disabled={processing}
                onChange={e => handleFiles(e.target.files)}
                style={{ display: "none" }} />
            </label>

            {/* Download App — saves the running .html so the user can keep an
                offline copy. We clone the document, clear the React root in
                the clone, and serialize so the saved file boots fresh from
                the embedded bundle when reopened. */}
            <button
              onClick={() => {
                try {
                  const docClone = document.documentElement.cloneNode(true);
                  const rootEl = docClone.querySelector("#root");
                  if (rootEl) rootEl.innerHTML = "";
                  const html = "<!doctype html>\n" + docClone.outerHTML;
                  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                  const url  = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "efa-bulk-roster-summary.html";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 1500);
                } catch (err) {
                  setError("Couldn't generate offline copy: " + err.message);
                }
              }}
              title="Save this app as a standalone .html for offline use"
              style={{
                background: COL.card, color: COL.accent, border: `1px solid ${COL.accent}`,
                borderRadius: 6, padding: "10px 16px", fontFamily: mono, fontSize: 13,
                fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
              }}>
              ⤓ DOWNLOAD APP
            </button>

            {results.length > 0 && (
              <>
                <button onClick={downloadCsv}
                  style={{
                    background: COL.green, color: "#fff", border: "none", borderRadius: 6,
                    padding: "10px 16px", fontFamily: mono, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", letterSpacing: 0.5,
                  }}>
                  ↓ EXPORT CSV
                </button>
                <button onClick={clearAll}
                  style={{
                    background: "transparent", color: COL.muted, border: `1px solid ${COL.border}`,
                    borderRadius: 6, padding: "10px 16px", fontFamily: mono, fontSize: 13,
                    cursor: "pointer", letterSpacing: 0.5,
                  }}>
                  CLEAR
                </button>
              </>
            )}
          </div>

          {error && (
            <div style={{
              marginTop: 14, padding: "10px 14px", background: "#FFEBEB",
              border: `1px solid ${COL.red}`, borderRadius: 6, color: COL.red,
              fontSize: 13,
            }}>{error}</div>
          )}

          {processing && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: COL.muted, fontFamily: mono, marginBottom: 6 }}>
                Processing {progress.done} of {progress.total}…
              </div>
              <div style={{ height: 6, background: COL.borderSoft, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: COL.accent,
                  width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "0%",
                  transition: "width 0.2s ease",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Page tabs — only when there are results to view */}
        {results.length > 0 && !processing && (
          <div style={{
            display: "flex", gap: 4, marginBottom: 18,
            borderBottom: `1px solid ${COL.border}`,
          }}>
            {[
              { id: "summary", label: "SUMMARY" },
              { id: "stats", label: "STATS" },
            ].map(t => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setView(t.id); setActiveSegment(null); }}
                  style={{
                    background: active ? COL.card : "transparent",
                    border: active ? `1px solid ${COL.border}` : "1px solid transparent",
                    borderBottom: active ? `1px solid ${COL.card}` : "1px solid transparent",
                    borderRadius: "6px 6px 0 0",
                    padding: "10px 22px",
                    fontFamily: mono, fontSize: 12, fontWeight: 700,
                    letterSpacing: 1.5,
                    color: active ? COL.accent : COL.muted,
                    cursor: "pointer",
                    marginBottom: -1,
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && view === "summary" && (
          <>
            {/* Summary cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12, marginBottom: 18,
            }}>
              <StatCard label="PILOTS" value={results.length.toString()} />
              <StatCard label="PERIOD" value={periodLabel} small />
              <StatCard label="MEAL TOTAL" value={`$${fmtAUD(totals.meal)}`} accent={COL.amber} />
              <StatCard label="DHA TOTAL" value={`$${fmtAUD(totals.dha)}`} accent={COL.accent} />
              <StatCard label="CREDIT HRS" value={`${totals.credit.toFixed(2)}h`} accent={COL.green} />
              <StatCard label="OT PAY" value={`$${fmtAUD(totals.creditHourPay)}`} accent={"#A85D04"} />
            </div>

            {/* Table */}
            <div style={{
              background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 10,
              overflow: "hidden",
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <SortHeader k="pilotName">PILOT</SortHeader>
                      <SortHeader k="role">ROLE</SortHeader>
                      <SortHeader k="paidBracketSort">PAY BRACKET</SortHeader>
                      <SortHeader k="bidPeriod">BP</SortHeader>
                      <SortHeader k="mealTotal" align="right">MEAL ALLOWANCES</SortHeader>
                      <SortHeader k="dhaTotal" align="right">DHA</SortHeader>
                      <SortHeader k="creditHours" align="right">CREDIT HRS</SortHeader>
                      <SortHeader k="creditHourPay" align="right">OT PAY</SortHeader>
                      <SortHeader k="grandTotal" align="right">TOTAL</SortHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => {
                      const rowKey = `${r.pilotName}__${r.staffNo || ""}__${i}`;
                      const isExpanded = expandedKey === rowKey;
                      return (
                      <Fragment key={rowKey}>
                      <tr
                        onClick={() => setExpandedKey(isExpanded ? null : rowKey)}
                        style={{
                          borderBottom: i < sorted.length - 1 || isExpanded ? `1px solid ${COL.borderSoft}` : "none",
                          background: isExpanded ? COL.accentSoft : (i % 2 === 0 ? COL.card : "#FBF9F5"),
                          cursor: "pointer",
                        }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 14 }}>
                          <span style={{ display: "inline-block", width: 14, color: COL.muted, fontFamily: mono }}>{isExpanded ? "▾" : "▸"}</span>
                          {r.pilotName}
                          {r.staffNo && (
                            <span style={{ marginLeft: 8, fontSize: 10, color: COL.muted, fontFamily: mono, fontWeight: 400 }}>
                              #{r.staffNo}
                            </span>
                          )}
                          {r.errors && r.errors.length > 0 && (
                            <div style={{ fontSize: 10, color: COL.red, marginTop: 2 }}>
                              ⚠ {r.errors.join("; ")}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", fontFamily: mono, fontSize: 12 }}>
                          <span style={{
                            display: "inline-block", padding: "3px 8px", borderRadius: 4,
                            background: r.role === "cpt" ? "#FFF3E0" : COL.accentSoft,
                            color: r.role === "cpt" ? "#A85D04" : COL.accentDark,
                            fontWeight: 700, letterSpacing: 0.5,
                          }}>
                            {r.role === "cpt" ? "CPT" : r.role === "fo" ? "F/O" : r.role}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontFamily: mono, fontSize: 12 }}>
                          {r.paidBracket ? (
                            <span style={{
                              display: "inline-block", padding: "3px 8px", borderRadius: 4,
                              background: bracketBg(r.paidBracket.id),
                              color: bracketFg(r.paidBracket.id),
                              fontWeight: 700, letterSpacing: 0.3,
                              whiteSpace: "nowrap",
                            }}>
                              {r.paidBracket.short}
                            </span>
                          ) : (
                            <span style={{ color: COL.muted, fontStyle: "italic" }}>unmatched</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", fontFamily: mono, fontSize: 12, color: COL.muted }}>
                          {r.bidPeriod || "—"}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: mono, fontSize: 14, fontWeight: 700, color: COL.amber }}>
                          ${fmtAUD(r.mealTotal)}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: mono, fontSize: 14, fontWeight: 700, color: COL.accent }}>
                          ${fmtAUD(r.dhaTotal)}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: mono, fontSize: 14, fontWeight: 700, color: COL.green }}>
                          {r.creditHours.toFixed(2)}h
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: mono, fontSize: 14, fontWeight: 700 }}>
                          {r.creditHourPay > 0 ? (
                            <span style={{ color: "#A85D04" }}>${fmtAUD(r.creditHourPay)}</span>
                          ) : r.annualSalary != null ? (
                            <span style={{ color: COL.muted, fontWeight: 400, fontSize: 11 }}>— under 70h</span>
                          ) : (
                            <span style={{ color: COL.muted, fontWeight: 400, fontSize: 11, fontStyle: "italic" }}>n/a</span>
                          )}
                        </td>
                        <td style={{
                          padding: "12px 14px", textAlign: "right",
                          fontFamily: mono, fontSize: 15, fontWeight: 800,
                          color: COL.text, background: isExpanded ? "transparent" : "rgba(30,138,192,0.06)",
                          borderLeft: `2px solid ${COL.accent}40`,
                        }}>
                          ${fmtAUD(r.grandTotal)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: "#FBF9F5", borderBottom: i < sorted.length - 1 ? `1px solid ${COL.borderSoft}` : "none" }}>
                          <td colSpan={9} style={{ padding: "16px 22px" }}>
                            <BreakdownPanel r={r} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: COL.accentSoft, borderTop: `2px solid ${COL.accent}` }}>
                      <td colSpan={4} style={{ padding: "14px", fontFamily: mono, fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: COL.text }}>
                        TOTAL · {results.length} pilot{results.length !== 1 ? "s" : ""}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right", fontFamily: mono, fontSize: 15, fontWeight: 800, color: COL.amber }}>
                        ${fmtAUD(totals.meal)}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right", fontFamily: mono, fontSize: 15, fontWeight: 800, color: COL.accent }}>
                        ${fmtAUD(totals.dha)}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right", fontFamily: mono, fontSize: 15, fontWeight: 800, color: COL.green }}>
                        {totals.credit.toFixed(2)}h
                      </td>
                      <td style={{ padding: "14px", textAlign: "right", fontFamily: mono, fontSize: 15, fontWeight: 800, color: "#A85D04" }}>
                        ${fmtAUD(totals.creditHourPay || 0)}
                      </td>
                      <td style={{
                        padding: "14px", textAlign: "right",
                        fontFamily: mono, fontSize: 16, fontWeight: 900,
                        color: COL.text, borderLeft: `2px solid ${COL.accent}`,
                      }}>
                        ${fmtAUD(totals.grandTotal || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div style={{ fontSize: 11, color: COL.muted, fontFamily: mono, marginTop: 12, lineHeight: 1.6 }}>
              Click a pilot row for an allowance breakdown. Click column headers to sort. Pilot names are pulled from the “Name :” line of each roster.
              Role auto-detected from the “Category :” line. Calculations use {INDEX_YEARS[yearIdx].label} rates.
            </div>
          </>
        )}

        {/* ── Stats page ─────────────────────────────────────────────────── */}
        {results.length > 0 && view === "stats" && (() => {
          // Sort by BP date (or BP number) so the chart reads chronologically
          // from top to bottom. Falls back to file name where the BP can't be
          // parsed.
          const bars = [...results].sort((a, b) => {
            if (a.rangeFrom && b.rangeFrom) return a.rangeFrom.localeCompare(b.rangeFrom);
            if (a.bidPeriod && b.bidPeriod) return a.bidPeriod - b.bidPeriod;
            return (a._fileName || "").localeCompare(b._fileName || "");
          });

          // Segment palette (left = hours; right = dollars).
          const SEG = {
            tafb:    { color: "#3DA866", label: "TAFB",              side: "L", unit: "h", desc: "Total hours away from base (sign-on to sign-off including hotel slip)." },
            credit:  { color: "#E8852E", label: "Credit hours",      side: "L", unit: "h", desc: "Roster credit hours (block + positioning + ground + reserve + leave)." },
            dhaH:    { color: "#7C5CD6", label: "DHA hours",         side: "L", unit: "h", desc: "Duty hours eligible for the Duty Hour Allowance (DHA)." },
            meal:    { color: "#D4A80A", label: "Meal allow.",       side: "R", unit: "$", desc: "Per-meal allowances (breakfast / lunch / dinner / incidentals)." },
            dhaD:    { color: "#1E8AC0", label: "DHA $",             side: "R", unit: "$", desc: "Duty hour allowance pay." },
            ot:      { color: "#A85D04", label: "Overtime",          side: "R", unit: "$", desc: "Credit-hour pay over the 70-hour BP threshold." },
            total:   { color: "#1A1A2E", label: "Total allowances",  side: "R", unit: "$", desc: "Sum of meal allowances, DHA payments, and overtime (when applicable) for the BP." },
          };

          // Build the per-row segment lists, filtering out zero values.
          const rows = bars.map(r => {
            const left = [
              { key: "tafb",   value: r.tafbHours || 0,            ...SEG.tafb,   row: r },
              { key: "credit", value: r.creditHours || 0,          ...SEG.credit, row: r },
              { key: "dhaH",   value: r.breakdown?.dhaHours || 0,  ...SEG.dhaH,   row: r },
            ].filter(s => s.value > 0.01);
            const right = [
              { key: "meal",   value: r.mealTotal || 0,            ...SEG.meal,   row: r },
              { key: "dhaD",   value: r.dhaTotal || 0,             ...SEG.dhaD,   row: r },
              { key: "ot",     value: r.creditHourPay || 0,        ...SEG.ot,     row: r },
            ].filter(s => s.value > 0.01);
            // Left-side axis scale uses the LONGER of (a) TAFB or (b) the
            // combined length of credit + DHA hours, since the credit/DHA pair
            // renders end-to-end starting at the centre axis and may extend
            // past TAFB when at-base duty (e.g. sims) dominates. The right
            // side still sums all $ segments because allowances are additive.
            const tafbVal = left.find(s => s.key === "tafb")?.value || 0;
            const creditVal = left.find(s => s.key === "credit")?.value || 0;
            const dhaHVal = left.find(s => s.key === "dhaH")?.value || 0;
            const leftTotalForScale = Math.max(tafbVal, creditVal + dhaHVal);
            return { r, left, right, leftTotal: leftTotalForScale, rightTotal: right.reduce((s,x)=>s+x.value,0) };
          });

          const maxLeft = Math.max(1, ...rows.map(r => r.leftTotal));
          const maxRight = Math.max(1, ...rows.map(r => r.rightTotal));

          // Bar geometry (CSS percentages for responsiveness)
          const BAR_HEIGHT = 22;
          const ROW_GAP = 14;
          const LABEL_W = 132; // px on the left for the row label
          const AXIS_W = 56;   // px for the centre y-axis label gutter

          // Compute nice round tick marks on each side
          function niceTicks(max, n = 4) {
            const step = Math.pow(10, Math.floor(Math.log10(max / n)));
            const candidates = [step, step * 2, step * 2.5, step * 5, step * 10];
            const chosen = candidates.find(s => max / s <= n) || step * 10;
            const ticks = [];
            for (let v = 0; v <= max; v += chosen) ticks.push(v);
            if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + chosen);
            return ticks;
          }
          const leftTicks = niceTicks(maxLeft);
          const rightTicks = niceTicks(maxRight);
          const leftAxisMax = leftTicks[leftTicks.length - 1];
          const rightAxisMax = rightTicks[rightTicks.length - 1];

          return (
            <div style={{
              background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 10,
              padding: "20px 16px 24px",
            }} onClick={(e) => {
              // Clear selection when clicking outside any segment
              if (e.target === e.currentTarget) setActiveSegment(null);
            }}>
              {/* Header / legend */}
              <div style={{ marginBottom: 18, paddingLeft: 4 }}>
                <div style={{ fontSize: 12, fontFamily: mono, letterSpacing: 1.5, color: COL.muted, marginBottom: 4 }}>
                  PER-BP COMPARISON
                </div>
                <div style={{ fontSize: 13, color: COL.muted }}>
                  Hours worked ⟵ | ⟶ Allowances earned. Tap any coloured segment for details.
                </div>
              </div>

              {/* Legend chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 22, paddingLeft: 4 }}>
                <div style={{ fontSize: 10, color: COL.muted, fontFamily: mono, letterSpacing: 1.2, alignSelf: "center" }}>
                  HOURS:
                </div>
                {[SEG.tafb, SEG.credit, SEG.dhaH].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ width: 14, height: 14, background: s.color, borderRadius: 3, display: "inline-block" }} />
                    <span>{s.label}</span>
                  </div>
                ))}
                <div style={{ width: 1, alignSelf: "stretch", background: COL.borderSoft }} />
                <div style={{ fontSize: 10, color: COL.muted, fontFamily: mono, letterSpacing: 1.2, alignSelf: "center" }}>
                  $$$:
                </div>
                {[SEG.meal, SEG.dhaD, SEG.ot].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ width: 14, height: 14, background: s.color, borderRadius: 3, display: "inline-block" }} />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ position: "relative", overflowX: "auto", paddingTop: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP, minWidth: 700 }}>
                  {rows.map((row, idx) => {
                    const r = row.r;
                    const rowLabel = r.bidPeriod ? `BP ${r.bidPeriod}` : (r._fileName || "—").replace(/\.txt$/i, "");
                    // Inline mini-bubble: when a segment in THIS row's bar is
                    // selected, show a compact line underneath the row that
                    // mirrors the value (the full bubble still renders at the
                    // bottom of the chart as primary detail).
                    const activeForThisRow = activeSegment?.seg?.row === r ? activeSegment.seg : null;
                    return (
                      <Fragment key={idx}>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: `${LABEL_W}px 1fr ${AXIS_W}px 1fr`,
                        alignItems: "center",
                        position: "relative",
                      }}>
                        {/* Row label */}
                        <div style={{
                          fontFamily: mono, fontSize: 11, color: COL.text, fontWeight: 700,
                          paddingRight: 12, textAlign: "right",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {rowLabel}
                          {r.matchedPilot && (
                            <div style={{ fontSize: 9, color: COL.muted, fontWeight: 400, letterSpacing: 0.3 }}>
                              {r.matchedPilot.displayName?.split(",")[0]}
                            </div>
                          )}
                        </div>

                        {/* LEFT bar (hours) — right-aligned, grows leftward.
                            TAFB is drawn full-height at its actual length.
                            Credit hours + DHA hours are drawn as half-height
                            bars in the TOP half, both anchored to the right
                            edge (centre axis). They have their own widths and
                            may EXTEND PAST the TAFB bar when at-base duty
                            (e.g. sims) dominates and credit > TAFB. */}
                        <div style={{
                          position: "relative", height: BAR_HEIGHT,
                          background: COL.borderSoft, borderRadius: 4,
                          overflow: "hidden",
                        }}>
                          {(() => {
                            const tafbSeg = row.left.find(s => s.key === "tafb");
                            const creditSeg = row.left.find(s => s.key === "credit");
                            const dhaHSeg = row.left.find(s => s.key === "dhaH");
                            // Each segment's width is a % of leftAxisMax, anchored
                            // to the right edge of the outer bar via right: 0.
                            const tafbWidthPct = tafbSeg ? (tafbSeg.value / leftAxisMax) * 100 : 0;
                            const creditWidthPct = creditSeg ? (creditSeg.value / leftAxisMax) * 100 : 0;
                            const dhaHWidthPct = dhaHSeg ? (dhaHSeg.value / leftAxisMax) * 100 : 0;
                            const tafbKey = `${idx}-L-tafb`;
                            const creditKey = `${idx}-L-credit`;
                            const dhaHKey = `${idx}-L-dhaH`;
                            const innerH = Math.round(BAR_HEIGHT / 2);
                            return (
                              <>
                                {tafbSeg && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setActiveSegment({ key: tafbKey, seg: tafbSeg }); }}
                                    style={{
                                      position: "absolute",
                                      top: 0, bottom: 0, right: 0,
                                      width: `${tafbWidthPct}%`,
                                      background: tafbSeg.color,
                                      cursor: "pointer",
                                      outline: activeSegment?.key === tafbKey ? `2px solid ${COL.text}` : "none",
                                      outlineOffset: -1,
                                    }}
                                    title={`${tafbSeg.label}: ${tafbSeg.value.toFixed(2)} h`}
                                  />
                                )}
                                {/* Credit hours — half-height, anchored right (centre axis) */}
                                {creditSeg && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setActiveSegment({ key: creditKey, seg: creditSeg }); }}
                                    style={{
                                      position: "absolute",
                                      top: 0, height: innerH, right: 0,
                                      width: `${creditWidthPct}%`,
                                      background: creditSeg.color,
                                      cursor: "pointer",
                                      outline: activeSegment?.key === creditKey ? `2px solid ${COL.text}` : "none",
                                      outlineOffset: -1,
                                    }}
                                    title={`${creditSeg.label}: ${creditSeg.value.toFixed(2)} h`}
                                  />
                                )}
                                {/* DHA hours — half-height, anchored to the left of Credit
                                    so the two render end-to-end starting from the centre axis. */}
                                {dhaHSeg && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setActiveSegment({ key: dhaHKey, seg: dhaHSeg }); }}
                                    style={{
                                      position: "absolute",
                                      top: 0, height: innerH,
                                      right: `${creditWidthPct}%`,
                                      width: `${dhaHWidthPct}%`,
                                      background: dhaHSeg.color,
                                      borderRight: `1px solid rgba(255,255,255,0.5)`,
                                      cursor: "pointer",
                                      outline: activeSegment?.key === dhaHKey ? `2px solid ${COL.text}` : "none",
                                      outlineOffset: -1,
                                    }}
                                    title={`${dhaHSeg.label}: ${dhaHSeg.value.toFixed(2)} h`}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Centre axis */}
                        <div style={{
                          height: BAR_HEIGHT + 8, alignSelf: "stretch",
                          borderLeft: `2px solid ${COL.text}`,
                          marginLeft: AXIS_W / 2 - 1,
                        }} />

                        {/* RIGHT bar (dollars) — left-aligned, grows rightward */}
                        <div style={{
                          position: "relative", height: BAR_HEIGHT,
                          display: "flex", flexDirection: "row",
                          background: COL.borderSoft, borderRadius: 4,
                        }}>
                          {row.right.map(seg => {
                            const widthPct = (seg.value / rightAxisMax) * 100;
                            const segKey = `${idx}-R-${seg.key}`;
                            const isActive = activeSegment?.key === segKey;
                            return (
                              <div
                                key={seg.key}
                                onClick={(e) => { e.stopPropagation(); setActiveSegment({ key: segKey, seg }); }}
                                style={{
                                  width: `${widthPct}%`,
                                  background: seg.color,
                                  borderRight: `1px solid rgba(0,0,0,0.06)`,
                                  cursor: "pointer",
                                  outline: isActive ? `2px solid ${COL.text}` : "none",
                                  outlineOffset: -1,
                                }}
                                title={`${seg.label}: $${fmtAUD(seg.value)}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      {activeForThisRow && (() => {
                        const s = activeForThisRow;
                        const valStr = s.unit === "$" ? `$${fmtAUD(s.value)}` : `${s.value.toFixed(2)} hours`;
                        // 10% alpha background derived from segment colour
                        // (works because all SEG colours are #RRGGBB).
                        const bgTint = `${s.color}1A`;
                        return (
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: `${LABEL_W}px 1fr`,
                            alignItems: "center",
                            marginTop: -4,
                          }}>
                            <div />
                            <div style={{
                              background: bgTint,
                              borderLeft: `4px solid ${s.color}`,
                              padding: "6px 10px",
                              borderRadius: 4,
                              fontSize: 11, fontFamily: mono,
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              gap: 8,
                            }}>
                              <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span>
                              <span style={{ color: COL.text, fontWeight: 800 }}>{valStr}</span>
                            </div>
                          </div>
                        );
                      })()}
                      </Fragment>
                    );
                  })}
                </div>

                {/* Axis tick labels */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `${LABEL_W}px 1fr ${AXIS_W}px 1fr`,
                  marginTop: 12, minWidth: 700,
                }}>
                  <div />
                  <div style={{ position: "relative", height: 22 }}>
                    {leftTicks.map((t, i) => (
                      <div key={i} style={{
                        position: "absolute",
                        right: `${(t / leftAxisMax) * 100}%`,
                        transform: "translateX(50%)",
                        fontFamily: mono, fontSize: 10, color: COL.muted,
                      }}>{t.toFixed(0)}h</div>
                    ))}
                  </div>
                  <div style={{
                    fontFamily: mono, fontSize: 10, color: COL.muted,
                    textAlign: "center",
                  }}>0</div>
                  <div style={{ position: "relative", height: 22 }}>
                    {rightTicks.map((t, i) => (
                      <div key={i} style={{
                        position: "absolute",
                        left: `${(t / rightAxisMax) * 100}%`,
                        transform: "translateX(-50%)",
                        fontFamily: mono, fontSize: 10, color: COL.muted,
                      }}>${t >= 1000 ? `${(t/1000).toFixed(t%1000?1:0)}k` : t.toFixed(0)}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Trend chart — dual Y-axis ──────────────────────────────
                  X-axis: BP number (chronologically ordered).
                  LEFT Y-axis: allowances in $ (meal / DHA $ / overtime).
                  RIGHT Y-axis: hours (TAFB / credit / DHA hours).
                  Solid lines = dollars, dashed lines = hours, so the two
                  scales are distinguishable even though they share colour
                  with the bar chart above. */}
              {bars.length >= 1 && (() => {
                const points = bars.map((rr, i) => {
                  const meal = rr.mealTotal || 0;
                  const dhaD = rr.dhaTotal || 0;
                  const ot   = rr.creditHourPay || 0;
                  return {
                    bp: rr.bidPeriod || (i + 1),
                    i,
                    meal,
                    dhaD,
                    ot,
                    total: meal + dhaD + ot,
                    tafb: rr.tafbHours || 0,
                    credit: rr.creditHours || 0,
                    dhaH: rr.breakdown?.dhaHours || 0,
                    row: rr,
                  };
                });
                const allDollarSeries = [
                  { key: "meal",   seg: SEG.meal },
                  { key: "ot",     seg: SEG.ot },
                  { key: "total",  seg: SEG.total },
                ];
                const allHourSeries = [
                  { key: "tafb",   seg: SEG.tafb },
                  { key: "credit", seg: SEG.credit },
                  { key: "dhaH",   seg: SEG.dhaH },
                ];
                const dollarSeries = allDollarSeries.filter(s => visibleSeries[s.key]);
                const hourSeries   = allHourSeries.filter(s => visibleSeries[s.key]);
                // DHA $ is intentionally NOT plotted as a separate series — it's
                // a direct linear function of DHA hours (rate × hours), so its
                // line would mirror the DHA-hours line exactly. The right-axis
                // DHA hours line stands in for both.
                // Scale each Y-axis to the currently-visible series only so the
                // chart re-fits when the user toggles lines off.
                const visibleDollarVals = points.flatMap(p => dollarSeries.map(s => p[s.key]));
                const visibleHourVals   = points.flatMap(p => hourSeries.map(s => p[s.key]));
                const maxDollars = Math.max(1, ...visibleDollarVals, 0);
                const maxHours   = Math.max(1, ...visibleHourVals, 0);
                const dollarTicks = niceTicks(maxDollars);
                const hourTicks   = niceTicks(maxHours);
                const dollarMax = dollarTicks[dollarTicks.length - 1];
                const hourMax   = hourTicks[hourTicks.length - 1];

                const VB_W = 760, VB_H = 340;
                const padL = 72, padR = 64, padT = 12, padB = 72;
                const innerW = VB_W - padL - padR;
                const innerH = VB_H - padT - padB;
                const xFor = i => points.length <= 1
                  ? padL + innerW / 2
                  : padL + (i * innerW) / (points.length - 1);
                const yL = v => padT + innerH - (v / dollarMax) * innerH;
                const yR = v => padT + innerH - (v / hourMax) * innerH;

                function pathFor(key, yAcc) {
                  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)},${yAcc(p[key])}`).join(" ");
                }

                return (
                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${COL.borderSoft}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
                      <div style={{ fontSize: 12, fontFamily: mono, letterSpacing: 1.5, color: COL.muted }}>
                        TRENDS ACROSS BPS
                      </div>
                      {/* Per-series visibility toggles */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                        {[...allDollarSeries, ...allHourSeries].map(({ key, seg }) => (
                          <label key={key}
                                 style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer", userSelect: "none", color: COL.text }}>
                            <input
                              type="checkbox"
                              checked={!!visibleSeries[key]}
                              onChange={e => setVisibleSeries(v => ({ ...v, [key]: e.target.checked }))}
                              style={{ accentColor: seg.color, cursor: "pointer", margin: 0 }}
                            />
                            <span style={{ width: 10, height: 10, background: seg.color, borderRadius: 2, display: "inline-block" }} />
                            <span>{seg.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ minWidth: 480, overflow: "visible" }}>
                        {/* Horizontal gridlines based on dollar ticks */}
                        {dollarTicks.map(t => (
                          <line key={`g-${t}`} x1={padL} y1={yL(t)} x2={VB_W - padR} y2={yL(t)}
                                stroke={COL.borderSoft} strokeWidth={1}
                                strokeDasharray={t === 0 ? "0" : "2,4"} />
                        ))}

                        {/* LEFT Y-axis ($) */}
                        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH}
                              stroke={COL.text} strokeWidth={1.5} />
                        {dollarTicks.map(t => (
                          <g key={`lt-${t}`}>
                            <line x1={padL - 4} y1={yL(t)} x2={padL} y2={yL(t)} stroke={COL.text} />
                            <text x={padL - 8} y={yL(t) + 3} fontSize={9} textAnchor="end"
                                  fontFamily={mono} fill={COL.muted}>
                              ${t >= 1000 ? `${(t/1000).toFixed(t%1000 ? 1 : 0)}k` : t.toFixed(0)}
                            </text>
                          </g>
                        ))}
                        {/* Left axis title (rotated) */}
                        <text x={20} y={padT + innerH / 2} fontSize={10}
                              textAnchor="middle" fontFamily={mono} fill={COL.muted}
                              transform={`rotate(-90, 20, ${padT + innerH / 2})`}>
                          Allowances ($)
                        </text>

                        {/* RIGHT Y-axis (h) */}
                        <line x1={VB_W - padR} y1={padT} x2={VB_W - padR} y2={padT + innerH}
                              stroke={COL.text} strokeWidth={1.5} />
                        {hourTicks.map(t => (
                          <g key={`rt-${t}`}>
                            <line x1={VB_W - padR} y1={yR(t)} x2={VB_W - padR + 4} y2={yR(t)} stroke={COL.text} />
                            <text x={VB_W - padR + 8} y={yR(t) + 3} fontSize={9} textAnchor="start"
                                  fontFamily={mono} fill={COL.muted}>
                              {t.toFixed(0)}h
                            </text>
                          </g>
                        ))}
                        {/* Right axis title (rotated) */}
                        <text x={VB_W - 16} y={padT + innerH / 2} fontSize={10}
                              textAnchor="middle" fontFamily={mono} fill={COL.muted}
                              transform={`rotate(90, ${VB_W - 16}, ${padT + innerH / 2})`}>
                          Hours
                        </text>

                        {/* X-axis */}
                        <line x1={padL} y1={padT + innerH} x2={VB_W - padR} y2={padT + innerH}
                              stroke={COL.text} strokeWidth={1.5} />
                        {points.map((p, i) => {
                          // Derive the tick label: BP number by default; pilot
                          // name (Surname, F-initial) when toggled. If the
                          // pilot wasn't matched, fall back to BP number so
                          // the X axis isn't blank.
                          let labelStr;
                          if (xAxisLabel === "name" && p.row?.matchedPilot?.displayName) {
                            const dn = p.row.matchedPilot.displayName;
                            const parts = dn.split(/,\s*/);
                            const surname = parts[0] || dn;
                            const firstInitial = (parts[1] || "").trim().charAt(0).toUpperCase();
                            labelStr = firstInitial ? `${surname}, ${firstInitial}` : surname;
                          } else {
                            labelStr = String(p.bp);
                          }
                          return (
                            <g key={`x-${i}`}>
                              <line x1={xFor(i)} y1={padT + innerH} x2={xFor(i)} y2={padT + innerH + 4}
                                    stroke={COL.text} />
                              <text x={xFor(i)} y={padT + innerH + 12}
                                    fontSize={9} fontFamily={mono} fill={COL.muted}
                                    textAnchor="end"
                                    transform={`rotate(-45, ${xFor(i)}, ${padT + innerH + 12})`}>
                                {labelStr}
                              </text>
                            </g>
                          );
                        })}
                        <text x={padL + innerW / 2} y={VB_H - 4}
                              fontSize={10} textAnchor="middle" fontFamily={mono} fill={COL.muted}>
                          {xAxisLabel === "name" ? "Pilot" : "Bid Period"}
                        </text>

                        {/* Lines — DOLLARS (solid) on left axis */}
                        {dollarSeries.map(({ key, seg }) => (
                          <g key={`ld-${key}`}>
                            <path d={pathFor(key, yL)} stroke={seg.color} strokeWidth={2}
                                  fill="none" strokeLinejoin="round" strokeLinecap="round" />
                            {points.map((p, i) => {
                              const pointKey = `trend-${key}-${i}`;
                              // Highlight when this very point is clicked OR
                              // when a bar segment is selected whose row +
                              // metric maps to this trend point. DHA $ on the
                              // bar maps to the DHA-hours trend line (the $
                              // line was removed as redundant) — and vice
                              // versa, the meal $ matches meal trend, etc.
                              const isFromBar = activeSegment?.seg?.row === p.row && (
                                activeSegment.seg.key === key
                              );
                              const isActive = activeSegment?.key === pointKey || isFromBar;
                              return (
                                <circle key={i} cx={xFor(i)} cy={yL(p[key])} r={isActive ? 6 : 4}
                                        fill={seg.color}
                                        stroke={isActive ? COL.text : "none"} strokeWidth={2}
                                        style={{ cursor: "pointer" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveSegment({
                                            key: pointKey,
                                            seg: { ...seg, key, value: p[key], row: p.row },
                                          });
                                        }}>
                                  <title>{`BP ${p.bp} · ${seg.label}: $${fmtAUD(p[key])}`}</title>
                                </circle>
                              );
                            })}
                          </g>
                        ))}

                        {/* Lines — HOURS (dashed) on right axis */}
                        {hourSeries.map(({ key, seg }) => (
                          <g key={`lh-${key}`}>
                            <path d={pathFor(key, yR)} stroke={seg.color} strokeWidth={2}
                                  fill="none" strokeDasharray="6,3" strokeLinejoin="round" strokeLinecap="round" />
                            {points.map((p, i) => {
                              const pointKey = `trend-${key}-${i}`;
                              // Cross-highlight from bar selection. The trend
                              // chart has no separate DHA $ line (it's
                              // redundant with DHA hours), so a DHA $ bar
                              // selection also highlights the DHA hours point.
                              const isFromBar = activeSegment?.seg?.row === p.row && (
                                activeSegment.seg.key === key ||
                                (activeSegment.seg.key === "dhaD" && key === "dhaH")
                              );
                              const isActive = activeSegment?.key === pointKey || isFromBar;
                              return (
                                <circle key={i} cx={xFor(i)} cy={yR(p[key])} r={isActive ? 6 : 4}
                                        fill={seg.color}
                                        stroke={isActive ? COL.text : "none"} strokeWidth={2}
                                        style={{ cursor: "pointer" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveSegment({
                                            key: pointKey,
                                            seg: { ...seg, key, value: p[key], row: p.row },
                                          });
                                        }}>
                                  <title>{`BP ${p.bp} · ${seg.label}: ${p[key].toFixed(2)} h`}</title>
                                </circle>
                              );
                            })}
                          </g>
                        ))}
                      </svg>
                    </div>
                    {/* X-axis label mode toggle */}
                    <div style={{
                      marginTop: 14, display: "flex", justifyContent: "center",
                      alignItems: "center", gap: 8, flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 11, fontFamily: mono, color: COL.muted, letterSpacing: 0.5 }}>
                        X-AXIS:
                      </span>
                      <div style={{
                        display: "inline-flex", background: COL.borderSoft,
                        borderRadius: 6, padding: 2,
                      }}>
                        {[
                          { id: "bp",   label: "BP Number" },
                          { id: "name", label: "Pilot Name" },
                        ].map(opt => {
                          const active = xAxisLabel === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setXAxisLabel(opt.id)}
                              style={{
                                background: active ? COL.card : "transparent",
                                border: active ? `1px solid ${COL.border}` : "1px solid transparent",
                                borderRadius: 4,
                                padding: "4px 14px",
                                fontFamily: mono, fontSize: 11, fontWeight: active ? 700 : 400,
                                color: active ? COL.text : COL.muted,
                                cursor: "pointer",
                              }}>
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 10, color: COL.muted, fontFamily: mono, textAlign: "center" }}>
                      Solid lines = dollars (left axis) · Dashed lines = hours (right axis) · DHA hours stands in for DHA $ (proportional)
                    </div>
                  </div>
                );
              })()}

              {/* Active-segment bubble */}
              {activeSegment && (() => {
                const s = activeSegment.seg;
                const r = s.row;
                const valStr = s.unit === "$" ? `$${fmtAUD(s.value)}` : `${s.value.toFixed(2)} hours`;
                // Build the list of secondary context lines that hang underneath
                // the main value. Some segments have a meaningful "partner"
                // metric — DHA hours ⇄ DHA $, meal allowance ⇄ hours in hotels —
                // that we surface for quick comparison without making the user
                // hunt across the chart.
                const extras = [];
                if (s.key === "dhaH" && r?.dhaTotal != null) {
                  extras.push({ label: "Equivalent DHA $", value: `$${fmtAUD(r.dhaTotal)}` });
                }
                if (s.key === "dhaD" && r?.breakdown?.dhaHours != null) {
                  extras.push({ label: "DHA hours",        value: `${r.breakdown.dhaHours.toFixed(2)} h` });
                }
                if (s.key === "meal" && r?.hotelHours != null && r.hotelHours > 0) {
                  extras.push({ label: "Time spent in hotels", value: `${r.hotelHours.toFixed(2)} h` });
                }
                if (s.key === "total" && r) {
                  // Show the constituent breakdown so the user can see what
                  // makes up the total they're inspecting.
                  extras.push({ label: "Meal allowances", value: `$${fmtAUD(r.mealTotal || 0)}` });
                  extras.push({ label: "DHA payments",   value: `$${fmtAUD(r.dhaTotal  || 0)}` });
                  if ((r.creditHourPay || 0) > 0) {
                    extras.push({ label: "Overtime", value: `$${fmtAUD(r.creditHourPay)}` });
                  }
                }
                return (
                  <div style={{
                    marginTop: 18, padding: "14px 18px",
                    background: COL.card, border: `2px solid ${s.color}`, borderRadius: 10,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ width: 14, height: 14, background: s.color, borderRadius: 3 }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: COL.text }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontFamily: mono, color: COL.muted }}>
                        — {r.bidPeriod ? `BP ${r.bidPeriod}` : (r._fileName || "")}
                      </span>
                      <span style={{ marginLeft: "auto", cursor: "pointer", fontSize: 18, color: COL.muted, lineHeight: 1 }}
                        onClick={() => setActiveSegment(null)}>×</span>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "baseline", justifyContent: "space-between",
                      gap: 12, marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: mono }}>
                        {valStr}
                      </div>
                      {/* Total-allowances bubble shows an effective $/h-of-TAFB
                          rate on the right, in line with the big total value.
                          Gives a quick "what was I earning per hour away from
                          base" benchmark for that BP. */}
                      {s.key === "total" && r?.tafbHours > 0 && (
                        <div style={{
                          fontSize: 13, fontFamily: mono, color: COL.muted,
                          textAlign: "right",
                        }}>
                          <span style={{ color: COL.text, fontWeight: 800 }}>
                            ${(s.value / r.tafbHours).toFixed(2)}/h
                          </span>
                          <div style={{ fontSize: 10, color: COL.muted, marginTop: 1 }}>per TAFB hour</div>
                        </div>
                      )}
                    </div>
                    {extras.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        {extras.map((x, idx) => (
                          <div key={idx} style={{
                            display: "flex", justifyContent: "space-between",
                            fontSize: 12, fontFamily: mono, color: COL.text,
                            padding: "3px 0",
                            borderTop: idx === 0 ? `1px dashed ${COL.borderSoft}` : "none",
                          }}>
                            <span style={{ color: COL.muted }}>{x.label}</span>
                            <span style={{ fontWeight: 700 }}>{x.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: COL.muted, lineHeight: 1.5 }}>
                      {s.desc}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {results.length === 0 && !processing && (
          <div style={{
            background: COL.card, border: `1px dashed ${COL.border}`, borderRadius: 10,
            padding: "48px 24px", textAlign: "center", color: COL.muted,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No rosters loaded</div>
            <div style={{ fontSize: 12 }}>Upload one or more Qantas SH Flight Crew Roster .txt files to begin.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, small }) {
  return (
    <div style={{
      background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 8,
      padding: "12px 14px",
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: COL.muted, fontFamily: mono, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: small ? 13 : 20, fontWeight: 800,
        color: accent || COL.text, fontFamily: small ? mono : "inherit",
        lineHeight: 1.2, wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}
