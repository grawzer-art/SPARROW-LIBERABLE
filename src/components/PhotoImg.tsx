import type { Photo } from "@/data/photos";

/** Image d'archive : webp si dispo, chargement paresseux sauf priorité. */
export function PhotoImg({ photo, priority = false, className = "" }: { photo: Photo; priority?: boolean; className?: string }) {
  if (!photo.src || photo.placeholder) {
    return (
      <div className={`ph ${className}`} role="img" aria-label={`Emplacement réservé ${photo.id}`}>
        <svg className="ph__silhouette" viewBox="0 0 100 120" aria-hidden="true">
          <circle cx="50" cy="42" r="22" />
          <path d="M8 120c4-30 22-44 42-44s38 14 42 44z" />
        </svg>
        <span className="ph__q">?</span>
        <span className="ph__label">
          CLICHÉ EN ATTENTE
          <small>Emplacement réservé · pièce {photo.id}</small>
        </span>
      </div>
    );
  }
  return (
    <picture>
      {photo.webp && <source srcSet={photo.webp} type="image/webp" />}
      <img
        className={className}
        src={photo.src}
        alt={photo.alt}
        style={{ objectPosition: photo.focus ?? "50% 40%" }}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
