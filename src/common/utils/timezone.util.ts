import { DateTime, IANAZone } from 'luxon';

// Rejects unrecognised IANA timezone strings before any conversion attempt so the
// caller receives a message that names the bad input rather than a Luxon invalidReason.
function assertValidZone(ianaTimezone: string, caller: string): void {
  if (!IANAZone.isValidZone(ianaTimezone)) {
    throw new Error(
      `${caller}: unrecognised IANA timezone "${ianaTimezone}"`,
    );
  }
}

/**
 * Interprets a local ISO 8601 datetime string in the given IANA timezone and
 * returns a UTC Date for database storage.
 *
 * The string must not carry its own offset — the timezone parameter is the
 * authoritative source (read from the authenticated user's profile).
 */
export function toUTC(localIso: string, ianaTimezone: string): Date {
  assertValidZone(ianaTimezone, 'toUTC');

  const dt = DateTime.fromISO(localIso, { zone: ianaTimezone });
  if (!dt.isValid) {
    throw new Error(
      `toUTC: invalid datetime — ${dt.invalidReason ?? 'unknown reason'} ` +
        `(localIso="${localIso}", timezone="${ianaTimezone}")`,
    );
  }

  return dt.toUTC().toJSDate();
}

/**
 * Converts a UTC Date retrieved from the database to an ISO 8601 string in the
 * given IANA timezone, with the UTC offset included.
 *
 * The offset is always present so API clients have an unambiguous point in time.
 */
export function toLocalISO(utcDate: Date, ianaTimezone: string): string {
  assertValidZone(ianaTimezone, 'toLocalISO');

  // fromJSDate with zone:'utc' treats the Date value as UTC-backed (which it always is).
  // setZone then shifts the wall-clock representation without changing the instant.
  const dt = DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(ianaTimezone);
  if (!dt.isValid) {
    throw new Error(
      `toLocalISO: conversion failed — ${dt.invalidReason ?? 'unknown reason'} ` +
        `(timezone="${ianaTimezone}")`,
    );
  }

  const iso = dt.toISO();
  // toISO() returns null only when the DateTime is invalid, which the guard above prevents.
  if (iso === null) {
    throw new Error(
      `toLocalISO: Luxon produced a null ISO string for timezone="${ianaTimezone}"`,
    );
  }

  return iso;
}
