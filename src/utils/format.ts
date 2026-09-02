/**
 * Utility functions for formatting numbers, currency, and dates
 */

/**
 * Format number with Indian locale (lakhs/crores with commas)
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "1,23,456.78"
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format currency with Indian Rupee symbol
 * @param value - Amount to format
 * @param decimals - Number of decimal places (default: 2 for paise)
 * @returns Formatted string like "₹1,23,456.00"
 */
export const formatCurrency = (value: number, decimals: number = 2): string => {
  // Use Intl.NumberFormat for reliable Indian locale formatting
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `₹${formatter.format(value)}`;
};

/**
 * Format an original (foreign) currency amount for display alongside the INR value.
 * Uses a plain number with grouping (no Indian lakh grouping) plus the ISO code,
 * e.g. formatOriginalCurrency(30, 'MYR') => "MYR 30.00".
 * Returns null when there is nothing foreign to show.
 */
export const formatOriginalCurrency = (
  value: number | string | null | undefined,
  code: string | null | undefined,
  decimals: number = 2,
): string | null => {
  if (value === null || value === undefined || !code) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(num)) return null;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${code.toUpperCase()} ${formatted}`;
};

/**
 * Format compact currency (show K, L, Cr for thousands, lakhs, crores)
 * @param value - Amount to format
 * @returns Formatted string like "₹1.2L" or "₹5.3Cr"
 */
export const formatCompactCurrency = (value: number): string => {
  if (value >= 10000000) {
    // 1 crore or more
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  } else if (value >= 100000) {
    // 1 lakh or more
    return `₹${(value / 100000).toFixed(1)}L`;
  } else if (value >= 1000) {
    // 1 thousand or more
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
};

/**
 * Format percentage
 * @param value - Percentage value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "12.34%"
 */
export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Local calendar-day string (YYYY-MM-DD) for a Date, safe for building API
 * date-range params. Do not use toISOString() for this: it converts to UTC
 * first, so in any timezone ahead of UTC (e.g. IST, UTC+5:30) a local
 * midnight boundary like "1st of this month" shifts back to the previous
 * day, leaking the prior month's last day into "this month" queries.
 */
export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date in Indian locale
 * @param date - Date to format
 * @returns Formatted string like "20/01/2026"
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN');
};

/**
 * Format date with month name
 * @param date - Date to format
 * @returns Formatted string like "20 Jan 2026"
 */
export const formatDateLong = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
