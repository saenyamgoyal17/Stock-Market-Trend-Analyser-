import crypto from 'crypto';

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function generateEventHash(url: string, title: string): string {
  const normalizedUrl = url.split('?')[0].trim().toLowerCase();
  const normalizedTitle = normalizeTitle(title);
  
  const content = `${normalizedUrl}|${normalizedTitle}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}
