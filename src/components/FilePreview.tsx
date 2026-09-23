import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import type { Attachment } from '../lib/types';
import { useStore } from '../state/store';

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
export const isImage = (a: Attachment) => a.kind === 'fichier' && (a.mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext(a.name)));
export const isPdf = (a: Attachment) => a.kind === 'fichier' && (a.mime === 'application/pdf' || ext(a.name) === 'pdf');
export const canPreview = (a: Attachment) => isImage(a) || isPdf(a);

/** Affiche une image ou un PDF directement dans la page (lien temporaire sécurisé). */
export function FilePreview({ a }: { a: Attachment }) {
  const { openAttachment } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    openAttachment(a).then((u) => alive && setUrl(u)).catch((e) => alive && setError((e as Error).message));
    return () => { alive = false; };
  }, [a, openAttachment]);

  return (
    <figure className="overflow-hidden rounded-mab-carte border border-mab-filet bg-white">
      <figcaption className="flex items-center gap-2 border-b border-mab-filet px-4 py-2.5 text-sm">
        <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
        {url && (
          <>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-mab-aqua-texte hover:underline"><ExternalLink size={14} /> Ouvrir</a>
            <a href={url} download={a.name} className="inline-flex items-center gap-1 text-mab-aqua-texte hover:underline"><Download size={14} /> Télécharger</a>
          </>
        )}
      </figcaption>
      {error ? <p className="p-4 text-sm text-mab-erreur">{error}</p>
        : !url ? <div className="h-40 animate-pulse bg-mab-wash" />
        : isImage(a) ? <img src={url} alt={a.name} className="mx-auto max-h-[70vh] w-auto object-contain" />
        : <iframe title={a.name} src={url} className="h-[75vh] w-full bg-mab-wash" />}
    </figure>
  );
}
