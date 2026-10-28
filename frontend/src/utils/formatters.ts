/**
 * Formatting utilities for timestamps, energy metrics, and percentages
 */

export function formatMW(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) {
    return 'N/A';
  }
  return `${val.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} MW`;
}

export function formatMWRaw(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '—';
  }
  return val.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatMWh(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || isNaN(val)) {
    return 'N/A';
  }
  return `${val.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} MWh`;
}

export function formatPercent(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) {
    return 'N/A';
  }
  return `${val.toFixed(decimals)}%`;
}

export function formatUTCDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    return `${day} ${month}`;
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function formatSettlementPeriod(sp: number | null | undefined): string {
  if (!sp) return 'SP —';
  const startMins = (sp - 1) * 30;
  const endMins = sp * 30;
  const startH = String(Math.floor(startMins / 60)).padStart(2, '0');
  const startM = String(startMins % 60).padStart(2, '0');
  const endH = String(Math.floor(endMins / 60) % 24).padStart(2, '0');
  const endM = String(endMins % 60).padStart(2, '0');
  return `SP ${sp} (${startH}:${startM}-${endH}:${endM})`;
}
