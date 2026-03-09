import { angleBetweenPoints, angleToEmojiDirection } from './utils/geojsonUtils.js';

describe('angleBetweenPoints', () => {
  it('returns angle in degrees between two points', () => {
    const p1 = [0, 0];
    const p2 = [1, 0];
    expect(angleBetweenPoints(p1, p2)).toBe(0);
  });
});

describe('angleToEmojiDirection', () => {
  it('returns right arrow for small positive angle', () => {
    expect(angleToEmojiDirection(10)).toBe('➡️');
  });
  it('returns up arrow for ~90 degrees', () => {
    expect(angleToEmojiDirection(90)).toBe('⬆️');
  });
});
