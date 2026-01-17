import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formats a number as Brazilian Real currency
 * @param value - The numeric value to format
 * @param fallback - Value to return if input is null/undefined (default: '')
 * @returns Formatted currency string (e.g., "R$ 1.234,56")
 */
export function formatCurrency(
  value: number | null | undefined,
  fallback = ''
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats a phone number in Brazilian format
 * @param phone - The phone number string
 * @param fallback - Value to return if input is null/undefined (default: '')
 * @returns Formatted phone string (e.g., "(11) 99999-9999" or "(11) 9999-9999")
 */
export function formatPhone(
  phone: string | null | undefined,
  fallback = ''
): string {
  if (!phone) return fallback;

  // Handle group phone identifiers
  if (phone.startsWith('group:')) {
    return 'Grupo do WhatsApp';
  }

  // Clean the phone number - remove all non-digits
  const cleaned = phone.replace(/\D/g, '');

  // Brazilian phone with country code (13 digits: 55 + DDD + 9 digits)
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }

  // Brazilian phone with country code (12 digits: 55 + DDD + 8 digits)
  if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }

  // Brazilian mobile (11 digits: DDD + 9 digits)
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }

  // Brazilian landline (10 digits: DDD + 8 digits)
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }

  // Return original if format not recognized
  return phone;
}

/**
 * Formats a date using pt-BR locale
 * @param date - Date string, Date object, or timestamp
 * @param formatPattern - Format pattern (default: 'dd/MM/yyyy')
 * @param fallback - Value to return if input is null/undefined (default: '')
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  formatPattern = 'dd/MM/yyyy',
  fallback = ''
): string {
  if (date === null || date === undefined) return fallback;

  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return fallback;
    
    return format(dateObj, formatPattern, { locale: ptBR });
  } catch {
    return fallback;
  }
}

/**
 * Formats a date-time value
 * @param date - Date string, Date object, or timestamp
 * @param fallback - Value to return if input is null/undefined (default: '')
 * @returns Formatted date-time string (e.g., "01/01/2024 14:30")
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  fallback = ''
): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm', fallback);
}

/**
 * Formats a relative time (e.g., "há 2 horas")
 * @param date - Date string, Date object, or timestamp
 * @returns Relative time string in Portuguese
 */
export function formatRelativeTime(
  date: string | Date | number | null | undefined
): string {
  if (date === null || date === undefined) return '';

  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Formats a date header for chat messages (Hoje, Ontem, or full date)
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date header string
 */
export function formatDateHeader(
  date: string | Date | number | null | undefined
): string {
  if (date === null || date === undefined) return '';

  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return '';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = format(dateObj, 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterdayStr) return 'Ontem';
    
    return format(dateObj, "d 'de' MMMM", { locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Formats time only from a date
 * @param date - Date string, Date object, or timestamp
 * @param fallback - Value to return if input is null/undefined (default: '')
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTime(
  date: string | Date | number | null | undefined,
  fallback = ''
): string {
  return formatDate(date, 'HH:mm', fallback);
}
