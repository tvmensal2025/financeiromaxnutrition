import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  formatCurrency,
  formatPhone,
  formatDate,
  formatDateTime,
} from './formatters';

/**
 * Feature: project-refactoring, Property 1: Formatter Output Format Validity
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 * 
 * - For any valid numeric input to `formatCurrency`, the output string SHALL match 
 *   the Brazilian Real currency format pattern (starting with "R$" followed by 
 *   properly formatted number with thousands separators and decimal comma).
 * 
 * - For any valid phone string input to `formatPhone`, the output string SHALL match 
 *   the Brazilian phone format pattern `(XX) XXXXX-XXXX` or `(XX) XXXX-XXXX`.
 * 
 * - For any valid Date input to `formatDate` or `formatDateTime`, the output string 
 *   SHALL be a valid date representation in pt-BR locale.
 */
describe('formatters - Property 1: Formatter Output Format Validity', () => {
  describe('formatCurrency', () => {
    // Property test: formatCurrency output matches BRL format for any valid number
    it('should match Brazilian Real currency format for any valid number', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
          (num) => {
            const result = formatCurrency(num);
            
            // Brazilian Real format: R$ followed by number with dot as thousands separator
            // and comma as decimal separator
            // Examples: "R$ 1.234,56", "-R$ 1.234,56", "R$ 0,00"
            // Note: Negative numbers may have the minus sign before R$ (e.g., "-R$ 1,00")
            
            // Must contain "R$" somewhere in the string
            expect(result).toContain('R$');
            
            // Must match the full BRL format pattern:
            // Optional minus, R$, space, digits with optional dots, comma, and 2 decimal digits
            expect(result).toMatch(/^-?R\$\s[\d.]+,\d{2}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property test: formatCurrency preserves sign for negative numbers
    it('should preserve negative sign for negative numbers', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e12, max: -0.01, noNaN: true, noDefaultInfinity: true }),
          (num) => {
            const result = formatCurrency(num);
            // Negative numbers should contain a minus sign
            expect(result).toContain('-');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property test: formatCurrency returns fallback for null/undefined
    it('should return fallback for null or undefined', () => {
      expect(formatCurrency(null)).toBe('');
      expect(formatCurrency(undefined)).toBe('');
      expect(formatCurrency(null, 'N/A')).toBe('N/A');
      expect(formatCurrency(undefined, 'N/A')).toBe('N/A');
    });

    // Property test: formatCurrency returns fallback for NaN
    it('should return fallback for NaN', () => {
      expect(formatCurrency(NaN)).toBe('');
      expect(formatCurrency(NaN, 'Invalid')).toBe('Invalid');
    });
  });

  describe('formatPhone', () => {
    // Generator for valid Brazilian mobile phone numbers (11 digits: DDD + 9 digits starting with 9)
    const brazilianMobilePhoneArb = fc.tuple(
      fc.integer({ min: 11, max: 99 }), // DDD (area code)
      fc.integer({ min: 90000000, max: 99999999 }) // 8 digits starting with 9 (mobile)
    ).map(([ddd, number]) => `${ddd}9${number}`);

    // Generator for valid Brazilian landline phone numbers (10 digits: DDD + 8 digits)
    const brazilianLandlinePhoneArb = fc.tuple(
      fc.integer({ min: 11, max: 99 }), // DDD (area code)
      fc.integer({ min: 20000000, max: 59999999 }) // 8 digits (landline typically starts with 2-5)
    ).map(([ddd, number]) => `${ddd}${number}`);

    // Property test: formatPhone output matches Brazilian mobile format (XX) XXXXX-XXXX
    it('should match Brazilian mobile phone format (XX) XXXXX-XXXX for 11-digit numbers', () => {
      fc.assert(
        fc.property(brazilianMobilePhoneArb, (phone) => {
          const result = formatPhone(phone);
          
          // Brazilian mobile format: (XX) XXXXX-XXXX
          // Pattern: opening paren, 2 digits, closing paren, space, 5 digits, hyphen, 4 digits
          expect(result).toMatch(/^\(\d{2}\) \d{5}-\d{4}$/);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatPhone output matches Brazilian landline format (XX) XXXX-XXXX
    it('should match Brazilian landline phone format (XX) XXXX-XXXX for 10-digit numbers', () => {
      fc.assert(
        fc.property(brazilianLandlinePhoneArb, (phone) => {
          const result = formatPhone(phone);
          
          // Brazilian landline format: (XX) XXXX-XXXX
          // Pattern: opening paren, 2 digits, closing paren, space, 4 digits, hyphen, 4 digits
          expect(result).toMatch(/^\(\d{2}\) \d{4}-\d{4}$/);
        }),
        { numRuns: 100 }
      );
    });

    // Generator for Brazilian phone with country code (13 digits: 55 + DDD + 9 digits)
    const brazilianMobileWithCountryCodeArb = fc.tuple(
      fc.integer({ min: 11, max: 99 }), // DDD
      fc.integer({ min: 90000000, max: 99999999 }) // 8 digits starting with 9
    ).map(([ddd, number]) => `55${ddd}9${number}`);

    // Property test: formatPhone handles phone with country code (13 digits)
    it('should match format +XX (XX) XXXXX-XXXX for 13-digit numbers with country code', () => {
      fc.assert(
        fc.property(brazilianMobileWithCountryCodeArb, (phone) => {
          const result = formatPhone(phone);
          
          // Format with country code: +55 (XX) XXXXX-XXXX
          expect(result).toMatch(/^\+\d{2} \(\d{2}\) \d{5}-\d{4}$/);
        }),
        { numRuns: 100 }
      );
    });

    // Generator for Brazilian landline with country code (12 digits: 55 + DDD + 8 digits)
    const brazilianLandlineWithCountryCodeArb = fc.tuple(
      fc.integer({ min: 11, max: 99 }), // DDD
      fc.integer({ min: 20000000, max: 59999999 }) // 8 digits
    ).map(([ddd, number]) => `55${ddd}${number}`);

    // Property test: formatPhone handles landline with country code (12 digits)
    it('should match format +XX (XX) XXXX-XXXX for 12-digit numbers with country code', () => {
      fc.assert(
        fc.property(brazilianLandlineWithCountryCodeArb, (phone) => {
          const result = formatPhone(phone);
          
          // Format with country code: +55 (XX) XXXX-XXXX
          expect(result).toMatch(/^\+\d{2} \(\d{2}\) \d{4}-\d{4}$/);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatPhone returns fallback for null/undefined/empty
    it('should return fallback for null, undefined, or empty string', () => {
      expect(formatPhone(null)).toBe('');
      expect(formatPhone(undefined)).toBe('');
      expect(formatPhone('')).toBe('');
      expect(formatPhone(null, 'N/A')).toBe('N/A');
      expect(formatPhone(undefined, 'N/A')).toBe('N/A');
    });

    // Property test: formatPhone handles group identifiers
    it('should return "Grupo do WhatsApp" for group phone identifiers', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (groupId) => {
          const result = formatPhone(`group:${groupId}`);
          expect(result).toBe('Grupo do WhatsApp');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('formatDate', () => {
    // Generator for valid dates within a reasonable range
    // Using a range that avoids timezone boundary issues
    // Filter out invalid dates (NaN)
    const validDateArb = fc.date({
      min: new Date('1900-01-02'),
      max: new Date('2100-12-30'),
    }).filter(d => !isNaN(d.getTime()));

    // Property test: formatDate output matches pt-BR date format dd/MM/yyyy
    it('should match pt-BR date format dd/MM/yyyy for any valid Date', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const result = formatDate(date);
          
          // pt-BR date format: dd/MM/yyyy
          // Pattern: 2 digits, slash, 2 digits, slash, 4 digits
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
          
          // Verify the date parts are valid ranges
          const [day, month, year] = result.split('/').map(Number);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(31);
          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(12);
          // Year should be within a reasonable range (accounting for timezone shifts)
          expect(year).toBeGreaterThanOrEqual(1899);
          expect(year).toBeLessThanOrEqual(2101);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDate correctly extracts day, month, year from Date object
    it('should correctly extract day, month, year from Date object', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const result = formatDate(date);
          const [day, month, year] = result.split('/').map(Number);
          
          expect(day).toBe(date.getDate());
          expect(month).toBe(date.getMonth() + 1); // getMonth() is 0-indexed
          expect(year).toBe(date.getFullYear());
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDate handles timestamp numbers
    it('should handle timestamp numbers correctly', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const timestamp = date.getTime();
          const result = formatDate(timestamp);
          
          // Should produce valid date format
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
          
          // Should match the original date
          const expectedResult = formatDate(date);
          expect(result).toBe(expectedResult);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDate handles ISO date strings
    it('should handle ISO date strings correctly', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const isoString = date.toISOString();
          const result = formatDate(isoString);
          
          // Should produce valid date format
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDate returns fallback for null/undefined
    it('should return fallback for null or undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate(null, 'dd/MM/yyyy', 'N/A')).toBe('N/A');
      expect(formatDate(undefined, 'dd/MM/yyyy', 'N/A')).toBe('N/A');
    });

    // Property test: formatDate returns fallback for invalid date strings
    it('should return fallback for invalid date strings', () => {
      expect(formatDate('invalid-date')).toBe('');
      expect(formatDate('not a date', 'dd/MM/yyyy', 'Invalid')).toBe('Invalid');
    });
  });

  describe('formatDateTime', () => {
    // Generator for valid dates within a reasonable range
    // Using a range that avoids timezone boundary issues
    // Filter out invalid dates (NaN)
    const validDateArb = fc.date({
      min: new Date('1900-01-02'),
      max: new Date('2100-12-30'),
    }).filter(d => !isNaN(d.getTime()));

    // Property test: formatDateTime output matches pt-BR datetime format dd/MM/yyyy HH:mm
    it('should match pt-BR datetime format dd/MM/yyyy HH:mm for any valid Date', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const result = formatDateTime(date);
          
          // pt-BR datetime format: dd/MM/yyyy HH:mm
          // Pattern: 2 digits, slash, 2 digits, slash, 4 digits, space, 2 digits, colon, 2 digits
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
          
          // Verify the parts are valid ranges
          const [datePart, timePart] = result.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(31);
          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(12);
          // Year should be within a reasonable range (accounting for timezone shifts)
          expect(year).toBeGreaterThanOrEqual(1899);
          expect(year).toBeLessThanOrEqual(2101);
          expect(hours).toBeGreaterThanOrEqual(0);
          expect(hours).toBeLessThanOrEqual(23);
          expect(minutes).toBeGreaterThanOrEqual(0);
          expect(minutes).toBeLessThanOrEqual(59);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDateTime correctly extracts all components from Date object
    it('should correctly extract date and time components from Date object', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const result = formatDateTime(date);
          const [datePart, timePart] = result.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          
          expect(day).toBe(date.getDate());
          expect(month).toBe(date.getMonth() + 1);
          expect(year).toBe(date.getFullYear());
          expect(hours).toBe(date.getHours());
          expect(minutes).toBe(date.getMinutes());
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDateTime handles timestamp numbers
    it('should handle timestamp numbers correctly', () => {
      fc.assert(
        fc.property(validDateArb, (date) => {
          const timestamp = date.getTime();
          const result = formatDateTime(timestamp);
          
          // Should produce valid datetime format
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
          
          // Should match the original date
          const expectedResult = formatDateTime(date);
          expect(result).toBe(expectedResult);
        }),
        { numRuns: 100 }
      );
    });

    // Property test: formatDateTime returns fallback for null/undefined
    it('should return fallback for null or undefined', () => {
      expect(formatDateTime(null)).toBe('');
      expect(formatDateTime(undefined)).toBe('');
      expect(formatDateTime(null, 'N/A')).toBe('N/A');
      expect(formatDateTime(undefined, 'N/A')).toBe('N/A');
    });
  });
});
