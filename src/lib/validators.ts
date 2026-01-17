/**
 * Validates an email address
 * @param email - The email string to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  // Standard email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a Brazilian phone number
 * Accepts formats: 11999999999, 5511999999999, (11) 99999-9999, etc.
 * @param phone - The phone string to validate
 * @returns true if valid, false otherwise
 */
export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  // Clean the phone number - remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Valid lengths:
  // 10 digits: DDD + 8 digit landline
  // 11 digits: DDD + 9 digit mobile
  // 12 digits: 55 + DDD + 8 digit landline
  // 13 digits: 55 + DDD + 9 digit mobile
  if (cleaned.length < 10 || cleaned.length > 13) {
    return false;
  }
  
  // Helper function to validate DDD
  const isValidDDD = (ddd: string): boolean => {
    const dddNum = parseInt(ddd, 10);
    return dddNum >= 11 && dddNum <= 99;
  };
  
  // For 12-13 digit numbers starting with 55, treat as country code + phone
  if ((cleaned.length === 12 || cleaned.length === 13) && cleaned.startsWith('55')) {
    const withoutCountry = cleaned.slice(2);
    const ddd = withoutCountry.slice(0, 2);
    return isValidDDD(ddd) && (withoutCountry.length === 10 || withoutCountry.length === 11);
  }
  
  // For 10-11 digit numbers, validate as DDD + phone (even if starts with 55)
  // DDD 55 is a valid Brazilian area code (Rio Grande do Sul)
  const ddd = cleaned.slice(0, 2);
  if (!isValidDDD(ddd)) {
    return false;
  }
  
  return true;
}

/**
 * Validates that a value is not empty or whitespace-only
 * @param value - The string to validate
 * @returns true if non-empty, false otherwise
 */
export function validateRequired(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return value.trim().length > 0;
}

/**
 * Validates a Brazilian CPF number
 * @param cpf - The CPF string to validate (with or without formatting)
 * @returns true if valid, false otherwise
 */
export function validateCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  
  // Remove non-digits
  const cleaned = cpf.replace(/\D/g, '');
  
  // CPF must have 11 digits
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid CPFs (all same digits)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9], 10)) return false;
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10], 10)) return false;
  
  return true;
}

/**
 * Validates a Brazilian CNPJ number
 * @param cnpj - The CNPJ string to validate (with or without formatting)
 * @returns true if valid, false otherwise
 */
export function validateCNPJ(cnpj: string | null | undefined): boolean {
  if (!cnpj) return false;
  
  // Remove non-digits
  const cleaned = cnpj.replace(/\D/g, '');
  
  // CNPJ must have 14 digits
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid CNPJs (all same digits)
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12], 10)) return false;
  
  // Validate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13], 10)) return false;
  
  return true;
}

/**
 * Validates a URL
 * @param url - The URL string to validate
 * @returns true if valid, false otherwise
 */
export function validateUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a number is within a range
 * @param value - The number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns true if within range, false otherwise
 */
export function validateRange(
  value: number | null | undefined,
  min: number,
  max: number
): boolean {
  if (value === null || value === undefined || isNaN(value)) return false;
  return value >= min && value <= max;
}

/**
 * Validates a string has minimum length
 * @param value - The string to validate
 * @param minLength - Minimum length required
 * @returns true if meets minimum length, false otherwise
 */
export function validateMinLength(
  value: string | null | undefined,
  minLength: number
): boolean {
  if (!value) return false;
  return value.length >= minLength;
}

/**
 * Validates a string has maximum length
 * @param value - The string to validate
 * @param maxLength - Maximum length allowed
 * @returns true if within maximum length, false otherwise
 */
export function validateMaxLength(
  value: string | null | undefined,
  maxLength: number
): boolean {
  if (!value) return true; // Empty is valid for max length
  return value.length <= maxLength;
}
