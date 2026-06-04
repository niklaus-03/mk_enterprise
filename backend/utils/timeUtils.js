/**
 * Indian Standard Time (IST) Utilities
 * IST = UTC + 5 hours 30 minutes (offset: +05:30)
 * All MongoDB dates are stored in UTC. Display is always converted to IST.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000 ms

/** Returns a Date object representing the current IST moment */
function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Converts any UTC date to IST Date */
function toIST(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS);
}

/**
 * Formats a date in IST as: DD/MM/YYYY HH:MM AM/PM
 * Example: 09/04/2026 02:35 PM
 */
function formatIST(date) {
  const ist = toIST(date);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const year = ist.getUTCFullYear();
  let hours = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Returns UTC range for "today" in IST.
 * Use this for MongoDB range queries to get today's records.
 */
function todayUTCRange() {
  // IST is UTC+5:30. Today in IST starts at UTC 18:30 of the previous day.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  // Midnight IST in UTC terms
  const istMidnightStr = nowIST.toISOString().slice(0, 10) + 'T00:00:00.000+05:30';
  const startUTC = new Date(istMidnightStr);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { startUTC, endUTC };
}
module.exports = { formatIST, todayUTCRange };
/** Returns IST date string YYYY-MM-DD for display */
function todayISTString() {
  const ist = nowIST();
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { nowIST, toIST, formatIST, todayUTCRange, todayISTString };
