import { calculateBmi } from '../src/utils/bmi';

describe('calculateBmi', () => {
  it('calculates BMI rounded to 1 decimal', () => {
    expect(calculateBmi(170, 65)).toBe(22.5);
  });

  it('handles a different height/weight combo', () => {
    expect(calculateBmi(160, 50)).toBe(19.5);
  });
});
