import { useEffect, useState } from 'react';
import { getAsset } from '../../db/db';

/** Affiche une image du moodboard depuis IndexedDB (URL d'objet révoquée au démontage). */
export function AssetImage({ assetId, alt }: { assetId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    getAsset(assetId)
      .then((a) => {
        if (cancelled) return;
        if (!a) return setMissing(true);
        revoked = URL.createObjectURL(a.blob);
        setUrl(revoked);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [assetId]);

  if (missing) return <div className="asset asset--missing">Image introuvable</div>;
  if (!url) return <div className="asset asset--loading" aria-busy />;
  return <img className="asset" src={url} alt={alt} loading="lazy" />;
}
