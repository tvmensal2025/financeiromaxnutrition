import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateCPF,
  validateCNPJ,
} from "./validators";

/**
 * Feature: project-refactoring, Property 2: Validator Correctness
 * Validates: Requirements 1.5, 1.6, 1.7
 */
describe("validators - Property 2: Validator Correctness", () => {
  describe("validateEmail", () => {
    it("should return true for any valid email address", () => {
      fc.assert(
        fc.property(fc.emailAddress(), (email) => {
          expect(validateEmail(email)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return false for strings without @ symbol", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => !s.includes("@")),
          (invalidEmail) => {
            expect(validateEmail(invalidEmail)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return false for empty strings", () => {
      expect(validateEmail("")).toBe(false);
    });
  });

  describe("validatePhone", () => {
    const brazilianMobilePhoneArb = fc
      .tuple(fc.integer({ min: 11, max: 99 }), fc.integer({ min: 90000000, max: 99999999 }))
      .map(([ddd, number]) => ddd.toString() + "9" + number.toString());

    const brazilianLandlinePhoneArb = fc
      .tuple(fc.integer({ min: 11, max: 99 }).filter((ddd) => ddd !== 55), fc.integer({ min: 20000000, max: 59999999 }))
      .map(([ddd, number]) => ddd.toString() + number.toString());

    it("should return true for valid 11-digit Brazilian mobile phone numbers", () => {
      fc.assert(
        fc.property(brazilianMobilePhoneArb, (phone) => {
          expect(validatePhone(phone)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return true for valid 10-digit Brazilian landline phone numbers", () => {
      fc.assert(
        fc.property(brazilianLandlinePhoneArb, (phone) => {
          expect(validatePhone(phone)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    const brazilianMobileWithCountryCodeArb = fc
      .tuple(fc.integer({ min: 11, max: 99 }), fc.integer({ min: 90000000, max: 99999999 }))
      .map(([ddd, number]) => "55" + ddd.toString() + "9" + number.toString());

    const brazilianLandlineWithCountryCodeArb = fc
      .tuple(fc.integer({ min: 11, max: 99 }).filter((ddd) => ddd !== 55), fc.integer({ min: 20000000, max: 59999999 }))
      .map(([ddd, number]) => "55" + ddd.toString() + number.toString());

    it("should return true for valid 13-digit Brazilian mobile numbers with country code", () => {
      fc.assert(
        fc.property(brazilianMobileWithCountryCodeArb, (phone) => {
          expect(validatePhone(phone)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return true for valid 12-digit Brazilian landline numbers with country code", () => {
      fc.assert(
        fc.property(brazilianLandlineWithCountryCodeArb, (phone) => {
          expect(validatePhone(phone)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return true for formatted Brazilian phone numbers", () => {
      fc.assert(
        fc.property(brazilianMobilePhoneArb, (phone) => {
          const formatted = "(" + phone.slice(0, 2) + ") " + phone.slice(2, 7) + "-" + phone.slice(7);
          expect(validatePhone(formatted)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return false for phone numbers with invalid length (less than 10 digits)", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999999999 }), (shortNumber) => {
          const phone = shortNumber.toString();
          if (phone.length < 10) {
            expect(validatePhone(phone)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should return false for phone numbers with invalid DDD (less than 11)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 90000000, max: 99999999 }),
          (ddd, number) => {
            const phone = ddd.toString().padStart(2, "0") + "9" + number.toString();
            expect(validatePhone(phone)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("validateRequired", () => {
    const nonEmptyStringArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

    it("should return true for any string containing at least one non-whitespace character", () => {
      fc.assert(
        fc.property(nonEmptyStringArb, (value) => {
          expect(validateRequired(value)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return false for whitespace-only strings", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 0, maxLength: 100 }).map((arr) => arr.join("")),
          (whitespace) => {
            expect(validateRequired(whitespace)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return true for strings with non-whitespace regardless of surrounding whitespace", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(" ", "\t"), { minLength: 0, maxLength: 10 }).map((arr) => arr.join("")),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.array(fc.constantFrom(" ", "\t"), { minLength: 0, maxLength: 10 }).map((arr) => arr.join("")),
          (leadingWs, content, trailingWs) => {
            const value = leadingWs + content + trailingWs;
            expect(validateRequired(value)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Feature: project-refactoring, Property 3: Null/Undefined Handling Consistency
 * Validates: Requirements 1.8, 1.9
 */
describe("validators - Property 3: Null/Undefined Handling Consistency", () => {
  describe("validateEmail", () => {
    it("should return false for null", () => {
      expect(validateEmail(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateEmail(undefined)).toBe(false);
    });
  });

  describe("validatePhone", () => {
    it("should return false for null", () => {
      expect(validatePhone(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validatePhone(undefined)).toBe(false);
    });
  });

  describe("validateRequired", () => {
    it("should return false for null", () => {
      expect(validateRequired(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateRequired(undefined)).toBe(false);
    });
  });

  describe("validateCPF", () => {
    it("should return false for null", () => {
      expect(validateCPF(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateCPF(undefined)).toBe(false);
    });
  });

  describe("validateCNPJ", () => {
    it("should return false for null", () => {
      expect(validateCNPJ(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateCNPJ(undefined)).toBe(false);
    });
  });

  it("all validators should consistently return false for null and undefined", () => {
    const validators = [validateEmail, validatePhone, validateRequired, validateCPF, validateCNPJ];

    validators.forEach((validator) => {
      expect(validator(null)).toBe(false);
      expect(validator(undefined)).toBe(false);
    });
  });
});
