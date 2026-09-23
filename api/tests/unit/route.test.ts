import { describe, expect, it } from 'vitest';
import { planTrip, type RouteStop } from '../../src/domain/route.js';
import { AppError } from '../../src/lib/errors.js';

// Same line as the seed data.
const line: RouteStop[] = [
  { id: 1, name: 'Banani', sequence: 0, distanceFromStartM: 0 },
  { id: 2, name: 'Mohakhali', sequence: 1, distanceFromStartM: 3000 },
  { id: 3, name: 'Gulshan 1', sequence: 2, distanceFromStartM: 5000 },
  { id: 4, name: 'Gulshan 2', sequence: 3, distanceFromStartM: 7000 },
  { id: 5, name: 'Bashundhara', sequence: 4, distanceFromStartM: 10000 },
];

describe('planTrip', () => {
  it.each([
    ['Nusrat to Mohakhali, the next stop', 2, 3000],
    ['Rafiq to Gulshan 1', 3, 5000],
    ['someone to Bashundhara, the last stop', 5, 10000],
  ])('%s', (_who, dropId, distanceM) => {
    expect(planTrip(line, 1, dropId).distanceM).toBe(distanceM);
  });

  it('rejects boarding anywhere but the start of the line', () => {
    expect(() => planTrip(line, 2, 4)).toThrow(/start of the line/);
  });

  it('rejects a drop-off at the pickup stop', () => {
    expect(() => planTrip(line, 1, 1)).toThrow(/later stop/);
  });

  it('rejects stops that are not on the line, as a 400', () => {
    try {
      planTrip(line, 1, 99);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(400);
    }
  });
});
