// Backend stores amounts in minor units (e.g. cents). The app shows them in
// the major unit with one decimal symbol.
export function formatMoney(minor: number, currency = 'EUR'): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}
