import { BillingPeriod } from '../billing-period';

describe('BillingPeriod', () => {
  describe('create', () => {
    it('should create valid period', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      expect(period.startDate).toEqual(start);
      expect(period.endDate).toEqual(end);
    });

    it('should throw when start >= end', () => {
      const date = new Date('2024-01-15');
      expect(() => BillingPeriod.create(date, date)).toThrow();
    });

    it('should throw when start > end', () => {
      const start = new Date('2024-01-31');
      const end = new Date('2024-01-01');
      expect(() => BillingPeriod.create(start, end)).toThrow();
    });
  });

  describe('fromISO', () => {
    it('should create period from ISO strings', () => {
      const period = BillingPeriod.fromISO(
        '2024-01-01T00:00:00Z',
        '2024-01-31T00:00:00Z',
      );

      expect(period.startDate).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(period.endDate).toEqual(new Date('2024-01-31T00:00:00Z'));
    });
  });

  describe('getTotalDays', () => {
    it('should return correct days count', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      expect(period.getTotalDays()).toBe(30);
    });

    it('should return 0 for same day', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T23:59:59Z');
      const period = BillingPeriod.create(start, end);

      expect(period.getTotalDays()).toBe(0);
    });
  });

  describe('getDaysRemaining', () => {
    it('should return correct remaining days', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const midPoint = new Date('2024-01-16');
      expect(period.getDaysRemaining(midPoint)).toBe(15);
    });

    it('should return 0 when date is after end', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const afterEnd = new Date('2024-02-01');
      expect(period.getDaysRemaining(afterEnd)).toBe(0);
    });
  });

  describe('getDaysUsed', () => {
    it('should return correct used days', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const midPoint = new Date('2024-01-16');
      expect(period.getDaysUsed(midPoint)).toBe(15);
    });

    it('should return 0 when date is before start', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const beforeStart = new Date('2023-12-31');
      expect(period.getDaysUsed(beforeStart)).toBe(0);
    });

    it('should not exceed total days', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const afterEnd = new Date('2024-02-15');
      expect(period.getDaysUsed(afterEnd)).toBe(30);
    });
  });

  describe('getProrationRate', () => {
    it('should calculate 50% for half period', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31'); // 30 days
      const period = BillingPeriod.create(start, end);

      const midPoint = new Date('2024-01-16'); // 15 days remaining
      const rate = period.getProrationRate(midPoint);

      expect(rate.toNumber()).toBeCloseTo(0.5, 1);
    });

    it('should return 0 when period has ended', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const afterEnd = new Date('2024-02-01');
      const rate = period.getProrationRate(afterEnd);

      expect(rate.toNumber()).toBe(0);
    });

    it('should return 1 when at start', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const rate = period.getProrationRate(start);

      expect(rate.toNumber()).toBeCloseTo(1, 1);
    });
  });

  describe('getUsageRate', () => {
    it('should calculate 50% for half period used', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31'); // 30 days
      const period = BillingPeriod.create(start, end);

      const midPoint = new Date('2024-01-16'); // 15 days used
      const rate = period.getUsageRate(midPoint);

      expect(rate.toNumber()).toBeCloseTo(0.5, 1);
    });

    it('should return 0 when date is before start', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const beforeStart = new Date('2023-12-31');
      const rate = period.getUsageRate(beforeStart);

      expect(rate.toNumber()).toBe(0);
    });

    it('should return 1 when period is fully used', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const atEnd = new Date('2024-01-31');
      const rate = period.getUsageRate(atEnd);

      expect(rate.toNumber()).toBeCloseTo(1, 1);
    });
  });

  describe('contains', () => {
    it('should return true when date is within period', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const midPoint = new Date('2024-01-15');
      expect(period.contains(midPoint)).toBe(true);
    });

    it('should return true when date is at start', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      expect(period.contains(start)).toBe(true);
    });

    it('should return true when date is at end', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      expect(period.contains(end)).toBe(true);
    });

    it('should return false when date is before start', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const beforeStart = new Date('2023-12-31');
      expect(period.contains(beforeStart)).toBe(false);
    });

    it('should return false when date is after end', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      const afterEnd = new Date('2024-02-01');
      expect(period.contains(afterEnd)).toBe(false);
    });
  });

  describe('hasEnded', () => {
    it('should return true when period has ended', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2020-01-31');
      const period = BillingPeriod.create(start, end);

      expect(period.hasEnded()).toBe(true);
    });

    it('should return false when period has not ended', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2099-12-31');
      const period = BillingPeriod.create(start, end);

      expect(period.hasEnded()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal periods', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period1 = BillingPeriod.create(start, end);
      const period2 = BillingPeriod.create(start, end);

      expect(period1.equals(period2)).toBe(true);
    });

    it('should return false for different periods', () => {
      const start1 = new Date('2024-01-01');
      const end1 = new Date('2024-01-31');
      const period1 = BillingPeriod.create(start1, end1);

      const start2 = new Date('2024-02-01');
      const end2 = new Date('2024-02-28');
      const period2 = BillingPeriod.create(start2, end2);

      expect(period1.equals(period2)).toBe(false);
    });

    it('should return false when other is null', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);

      expect(period.equals(null as unknown as BillingPeriod)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return ISO string representation', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T00:00:00Z');
      const period = BillingPeriod.create(start, end);

      const result = period.toString();
      expect(result).toContain('2024-01-01');
      expect(result).toContain('2024-01-31');
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T00:00:00Z');
      const period = BillingPeriod.create(start, end);

      const json = period.toJSON();
      expect(json).toHaveProperty('start');
      expect(json).toHaveProperty('end');
      expect(json.start).toBe(start.toISOString());
      expect(json.end).toBe(end.toISOString());
    });
  });
});
