/** Reconnaît le service de visio d'après le lien, pour afficher le bon libellé. */
export function visioProvider(url: string | null | undefined) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('meet.google')) return 'Google Meet';
  if (u.includes('zoom.')) return 'Zoom';
  if (u.includes('whatsapp') || u.includes('wa.me')) return 'WhatsApp';
  if (u.includes('teams.')) return 'Teams';
  if (u.includes('whereby')) return 'Whereby';
  return 'Visio';
}

export function normalizeVisio(input: string) {
  const v = input.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
