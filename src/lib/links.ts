/** Outils pour les liens utiles. */

/** « methode.mabeautyplus.fr » → « https://methode.mabeautyplus.fr ». Renvoie null si ce n'est pas une adresse. */
export function normalizeUrl(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v.replace(/^\/+/, '')}`;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString().replace(/\/$/, u.pathname === '/' && !input.trim().endsWith('/') ? '' : '/');
  } catch {
    return null;
  }
}

export const domainOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

/** Titre proposé à partir de l'adresse : « crmnews.netlify.app » → « Crmnews ». */
export function suggestTitle(url: string) {
  const host = domainOf(url).split('.');
  const main = host.length > 2 && !['www', 'app'].includes(host[0]) ? host[0] : host[host.length > 2 ? 1 : 0];
  return main ? main.charAt(0).toUpperCase() + main.slice(1) : url;
}

const URL_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;

/**
 * Ajout en lot, une ligne par lien, dans l'ordre qu'on veut :
 * « https://app.mabeautyplus.fr/ : Appli thérapeute »
 * « Bio-Portrait - bioportraitdecouverte.mabeautyplus.fr »
 * « methode.mabeautyplus.fr »
 */
export type BulkLine = { line: string; url: string | null; title: string; folder: string | null; header?: boolean };

export function parseBulk(text: string): BulkLine[] {
  let folder: string | null = null;
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const m = URL_RE.exec(line);
    // « Dossier LP : » (sans adresse) ouvre un dossier pour les lignes suivantes.
    const head = !m && /^(?:dossier|📁)\s*(.+?)\s*:?\s*$/i.exec(line);
    if (head) { folder = head[1].replace(/^[«"']|[»"']$/g, '').trim(); return { line, url: null, title: folder, folder, header: true }; }
    const url = m ? normalizeUrl(m[1]) : null;
    const rest = m ? (line.slice(0, m.index) + ' ' + line.slice(m.index + m[1].length)) : line;
    const title = rest.replace(/^[\s:|–—→>-]+|[\s:|–—→>-]+$/g, '').replace(/\s+[:|–—→]\s+/g, ' · ').trim();
    return { line, url, title: title || (url ? suggestTitle(url) : ''), folder };
  });
}

/** Icône du site, demandée au site lui-même (aucun service tiers). */
export const faviconOf = (url: string) => {
  try { return `${new URL(url).origin}/favicon.ico`; } catch { return ''; }
};
