export const PLACEHOLDER_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400' fill='none'><rect width='400' height='400' fill='%23F1F5F9'/><rect x='1' y='1' width='398' height='398' rx='12' stroke='%23E2E8F0' stroke-width='2'/><path d='M150 220L180 180L210 220L230 195L260 235H140L150 220Z' fill='%23CBD5E1'/><circle cx='230' cy='165' r='14' fill='%23CBD5E1'/></svg>";

export function cleanMediaUrl(url?: string): string {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.includes('/uploads/') || trimmed.includes('/api/images/')) {
    trimmed = trimmed.replace(/^https?:\/\/[^/]+(\/(?:uploads|api\/images)\/.+)$/, '$1');
  }
  if (trimmed.startsWith('uploads/') || trimmed.startsWith('api/images/')) {
    trimmed = '/' + trimmed;
  }
  return trimmed;
}

export function cleanBase64String(raw: string): string {
  if (!raw) return '';
  if (raw.includes(';base64,')) {
    return raw.split(';base64,').pop() || raw;
  }
  return raw.replace(/^data:[^;]+;base64,/, '').trim();
}


