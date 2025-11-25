import { calculateDiscount } from '../../services/paymentService';

describe('PaymentService', () => {
  describe('calculateDiscount', () => {
    it('should return no discount when discountTiersJson is null', () => {
      const result = calculateDiscount(1000, null);
      expect(result.discountAmount).toBe(0);
      expect(result.discountPercent).toBe(0);
    });

    it('should return no discount when discountTiersJson is empty', () => {
      const result = calculateDiscount(1000, '');
      expect(result.discountAmount).toBe(0);
      expect(result.discountPercent).toBe(0);
    });

    it('should calculate discount correctly for first tier', () => {
      const tiers = JSON.stringify([
        { minAmount: 0, maxAmount: 5000, percentage: 5 },
        { minAmount: 5001, maxAmount: 10000, percentage: 10 },
        { minAmount: 10001, maxAmount: 999999, percentage: 15 },
      ]);
      
      const result = calculateDiscount(3000, tiers);
      expect(result.discountPercent).toBe(5);
      expect(result.discountAmount).toBe(150); // 3000 * 0.05
    });

    it('should calculate discount correctly for second tier', () => {
      const tiers = JSON.stringify([
        { minAmount: 0, maxAmount: 5000, percentage: 5 },
        { minAmount: 5001, maxAmount: 10000, percentage: 10 },
        { minAmount: 10001, maxAmount: 999999, percentage: 15 },
      ]);
      
      const result = calculateDiscount(7500, tiers);
      expect(result.discountPercent).toBe(10);
      expect(result.discountAmount).toBe(750); // 7500 * 0.10
    });

    it('should calculate discount correctly for third tier', () => {
      const tiers = JSON.stringify([
        { minAmount: 0, maxAmount: 5000, percentage: 5 },
        { minAmount: 5001, maxAmount: 10000, percentage: 10 },
        { minAmount: 10001, maxAmount: 999999, percentage: 15 },
      ]);
      
      const result = calculateDiscount(15000, tiers);
      expect(result.discountPercent).toBe(15);
      expect(result.discountAmount).toBe(2250); // 15000 * 0.15
    });

    it('should handle boundary values correctly', () => {
      const tiers = JSON.stringify([
        { minAmount: 0, maxAmount: 5000, percentage: 5 },
        { minAmount: 5001, maxAmount: 10000, percentage: 10 },
      ]);
      
      const result1 = calculateDiscount(5000, tiers);
      expect(result1.discountPercent).toBe(5);
      
      const result2 = calculateDiscount(5001, tiers);
      expect(result2.discountPercent).toBe(10);
    });

    it('should return no discount when amount is below all tiers', () => {
      const tiers = JSON.stringify([
        { minAmount: 1000, maxAmount: 5000, percentage: 5 },
      ]);
      
      const result = calculateDiscount(500, tiers);
      expect(result.discountAmount).toBe(0);
      expect(result.discountPercent).toBe(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = calculateDiscount(1000, 'invalid json');
      expect(result.discountAmount).toBe(0);
      expect(result.discountPercent).toBe(0);
    });

    it('should handle non-array JSON gracefully', () => {
      const result = calculateDiscount(1000, '{"not": "an array"}');
      expect(result.discountAmount).toBe(0);
      expect(result.discountPercent).toBe(0);
    });
  });
});

