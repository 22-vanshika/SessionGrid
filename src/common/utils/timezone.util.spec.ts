import { toLocalISO, toUTC } from './timezone.util';

// ---------------------------------------------------------------------------
// toUTC
// ---------------------------------------------------------------------------

describe('toUTC', () => {
  describe('basic timezone conversions', () => {
    it('converts Asia/Kolkata (UTC+5:30) local time to UTC', () => {
      // 09:00 IST  −  5h 30m  =  03:30 UTC
      const result = toUTC('2024-09-01T09:00:00', 'Asia/Kolkata');
      expect(result.toISOString()).toBe('2024-09-01T03:30:00.000Z');
    });

    it('converts America/New_York (EST = UTC−5) local time to UTC in winter', () => {
      // 12:00 EST  +  5h  =  17:00 UTC
      const result = toUTC('2024-01-15T12:00:00', 'America/New_York');
      expect(result.toISOString()).toBe('2024-01-15T17:00:00.000Z');
    });

    it('converts Europe/London (BST = UTC+1) local time to UTC in summer', () => {
      // 15:00 BST  −  1h  =  14:00 UTC
      const result = toUTC('2024-07-15T15:00:00', 'Europe/London');
      expect(result.toISOString()).toBe('2024-07-15T14:00:00.000Z');
    });
  });

  describe('cross-date-boundary cases', () => {
    it('late evening in America/New_York (EDT = UTC−4) becomes the following UTC day', () => {
      // 22:00 EDT  +  4h  =  26:00  →  02:00 UTC next day
      const result = toUTC('2024-09-01T22:00:00', 'America/New_York');
      expect(result.toISOString()).toBe('2024-09-02T02:00:00.000Z');
    });

    it('early morning in Asia/Kolkata becomes the previous UTC day', () => {
      // 04:00 IST  −  5h 30m  =  −1h 30m  →  22:30 UTC previous day
      const result = toUTC('2024-09-01T04:00:00', 'Asia/Kolkata');
      expect(result.toISOString()).toBe('2024-08-31T22:30:00.000Z');
    });
  });

  describe('input validation', () => {
    it('throws for an unparseable datetime string', () => {
      expect(() => toUTC('not-a-date', 'Asia/Kolkata')).toThrow(
        /invalid datetime/i,
      );
    });

    it('throws for an unrecognised IANA timezone', () => {
      expect(() => toUTC('2024-09-01T09:00:00', 'Fake/Zone')).toThrow(
        /unrecognised IANA timezone/i,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// toLocalISO
// ---------------------------------------------------------------------------

describe('toLocalISO', () => {
  describe('basic timezone conversions', () => {
    it('converts a UTC Date to Asia/Kolkata local ISO with +05:30 offset', () => {
      // 03:30 UTC  +  5h 30m  =  09:00 IST
      const utcDate = new Date('2024-09-01T03:30:00.000Z');
      const result = toLocalISO(utcDate, 'Asia/Kolkata');
      expect(result).toContain('2024-09-01T09:00:00');
      expect(result).toContain('+05:30');
    });

    it('converts a UTC Date to America/New_York local ISO with −05:00 offset in winter', () => {
      // 17:00 UTC  −  5h  =  12:00 EST
      const utcDate = new Date('2024-01-15T17:00:00.000Z');
      const result = toLocalISO(utcDate, 'America/New_York');
      expect(result).toContain('2024-01-15T12:00:00');
      expect(result).toContain('-05:00');
    });

    it('converts a UTC Date to Europe/London local ISO with +01:00 offset in summer', () => {
      // 14:00 UTC  +  1h  =  15:00 BST
      const utcDate = new Date('2024-07-15T14:00:00.000Z');
      const result = toLocalISO(utcDate, 'Europe/London');
      expect(result).toContain('2024-07-15T15:00:00');
      expect(result).toContain('+01:00');
    });
  });

  describe('input validation', () => {
    it('throws for an unrecognised IANA timezone', () => {
      expect(() => toLocalISO(new Date(), 'Fake/Zone')).toThrow(
        /unrecognised IANA timezone/i,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Round-trip consistency
// ---------------------------------------------------------------------------

describe('round-trip consistency', () => {
  it.each([
    ['Asia/Kolkata', '2024-09-01T09:00:00'],
    ['America/New_York', '2024-01-15T12:00:00'],
    ['Europe/London', '2024-07-15T15:00:00'],
    ['Pacific/Auckland', '2024-06-01T07:00:00'],
  ])(
    'toLocalISO(toUTC(t, tz), tz) recovers the original instant for %s',
    (timezone: string, localIso: string) => {
      const utcDate = toUTC(localIso, timezone);
      const isoString = toLocalISO(utcDate, timezone);

      // new Date() correctly parses ISO 8601 strings that carry a UTC offset,
      // so the round-tripped value must equal the original UTC millisecond count.
      expect(new Date(isoString).getTime()).toBe(utcDate.getTime());
    },
  );
});

// ---------------------------------------------------------------------------
// Back-to-back session boundary
// ---------------------------------------------------------------------------

describe('back-to-back session boundary', () => {
  it('two calls to toUTC with identical input produce exactly equal millisecond values', () => {
    // Any drift between the two results would cause the overlap predicate to
    // misclassify adjacent sessions as overlapping.
    const timezone = 'Asia/Kolkata';
    const session1End = toUTC('2024-09-01T10:00:00', timezone);
    const session2Start = toUTC('2024-09-01T10:00:00', timezone);

    expect(session1End.getTime()).toBe(session2Start.getTime());
  });

  it('sessions sharing only an endpoint are NOT considered overlapping', () => {
    // Overlap predicate: A overlaps B  iff  A.start < B.end  AND  A.end > B.start.
    // When A.end === B.start the second condition is false, so there is no overlap.
    const timezone = 'Asia/Kolkata';
    const session1Start = toUTC('2024-09-01T09:00:00', timezone);
    const session1End = toUTC('2024-09-01T10:00:00', timezone);
    const session2Start = toUTC('2024-09-01T10:00:00', timezone);
    const session2End = toUTC('2024-09-01T11:00:00', timezone);

    const overlaps =
      session1Start.getTime() < session2End.getTime() &&
      session1End.getTime() > session2Start.getTime();

    expect(overlaps).toBe(false);
  });

  it('sessions with an actual time overlap ARE detected as overlapping', () => {
    // Sanity-check that the predicate correctly fires for genuine overlaps,
    // confirming the boundary test above is not a vacuous false negative.
    const timezone = 'America/New_York';
    const session1Start = toUTC('2024-09-01T09:00:00', timezone);
    const session1End = toUTC('2024-09-01T10:30:00', timezone);
    const session2Start = toUTC('2024-09-01T10:00:00', timezone);
    const session2End = toUTC('2024-09-01T11:00:00', timezone);

    const overlaps =
      session1Start.getTime() < session2End.getTime() &&
      session1End.getTime() > session2Start.getTime();

    expect(overlaps).toBe(true);
  });

  it('a session contained entirely within another is detected as overlapping', () => {
    const timezone = 'Europe/London';
    const outerStart = toUTC('2024-07-15T09:00:00', timezone);
    const outerEnd = toUTC('2024-07-15T12:00:00', timezone);
    const innerStart = toUTC('2024-07-15T10:00:00', timezone);
    const innerEnd = toUTC('2024-07-15T11:00:00', timezone);

    const overlaps =
      outerStart.getTime() < innerEnd.getTime() &&
      outerEnd.getTime() > innerStart.getTime();

    expect(overlaps).toBe(true);
  });
});
