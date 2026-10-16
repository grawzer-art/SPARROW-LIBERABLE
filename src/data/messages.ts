import type { Remaining } from "@/lib/time";

/**
 * FIL DE SURVEILLANCE — bulletins officiels du Ministère du Calendrier.
 * Une chaîne simple, ou une fonction qui reçoit le temps restant.
 * Ajouter des lignes ici suffit : elles entrent dans la rotation aléatoire.
 */
type Msg = string | ((r: Remaining) => string);

const fr = (n: number) => n.toLocaleString("fr-FR");

export const BULLETINS: Msg[] = [
  "Le sujet est toujours en attente. Le calendrier reste inflexible.",
  "Mise à jour : Sparrow n'est toujours pas libérable.",
  (r) => `Encore ${fr(r.days)} réveils avant la délivrance. Force au soldat.`,
  "Le temps passe. Pas assez vite selon l'intéressé.",
  "Les autorités confirment que regarder le compteur ne l'accélère pas.",
  "Tentative d'accélération du calendrier : refusée.",
  "Niveau de patience estimé : critique.",
  "Une minute de moins. Une éternité de plus.",
  "Demande de remise de peine pour « bonne humeur » : classée sans suite.",
  "Le sablier a été inspecté. Il fonctionne parfaitement. Hélas.",
  "Le sujet a proposé de payer en tickets-restaurant. Le calendrier n'accepte pas.",
  "Requête « sauter directement à 2031 » : fonctionnalité non disponible dans votre pays.",
  "Rappel : octobre 2031 ne viendra pas plus vite si vous rafraîchissez la page.",
  "Le Conseil des Horloges s'est réuni. Il a décidé de continuer à faire tic-tac.",
  "Analyse en cours… Résultat : il reste encore beaucoup de temps.",
  "Le sujet a été aperçu en train de négocier avec un calendrier de La Poste. Échec.",
  "Alerte météo : averses de secondes sur toute la France. Aucune éclaircie avant 2031.",
  (r) => `Il reste ${fr(r.days * 24 + r.hours)} heures. Le sujet en a déjà compté trois.`,
  "Les experts recommandent de prendre un loisir. Par exemple, l'attente.",
  "Proposition d'échange d'un lundi contre deux vendredis : rejetée par le Ministère.",
  "Le compteur ne prend pas de pause café. Le sujet, si. Beaucoup.",
  "Évasion temporelle détectée en rêve. Le sujet s'est réveillé. Toujours ici.",
  "Note interne : le sujet a demandé si « libérable » voulait dire « maintenant ». Non.",
  "La DeLorean a été réquisitionnée. Le convecteur temporel reste introuvable.",
  "Le temps est une construction sociale. Le compteur, lui, est une construction très solide.",
  (r) => `Progression du dossier : ${(r.progress * 100).toFixed(4).replace(".", ",")} %. On avance. Lentement. Très.`,
  "Votre appel est important pour le calendrier. Merci de patienter jusqu'en 2031.",
  "Le sujet a tenté de soudoyer une horloge avec un kebab. Elle a refusé la sauce.",
  "Dernier contrôle : le sujet est calme, hydraté et toujours non libérable.",
  "Avis de l'administration : la patience est une vertu. Le sujet en manque d'environ 1 826 jours.",
  "Le service des réclamations est ouvert du lundi au vendredi. Il ne sert à rien.",
  (r) => `Plus que ${fr(Math.floor(r.days / 7))} semaines. Ou, dit autrement : beaucoup trop.`,
  "Le sujet a demandé un résumé de la situation : « Attends. »",
  "Opération « Avance rapide » : bouton introuvable sur la télécommande de la vie.",
  "Les pigeons voyageurs chargés de porter la bonne nouvelle sont en formation.",
  "Le juge des délais confirme : « Un jour, c'est 24 heures. Même pour Sparrow. »",
  "Un témoin affirme avoir vu le temps passer. Enquête en cours.",
  "Tentative de corruption du fuseau horaire Europe/Paris : signalée.",
  "Remarque : la date cible n'a pas bougé depuis votre dernière visite. Elle est très fiable.",
  "Statistique fictive n° 47 : le sujet aurait consulté cette appli 47 fois. Chiffre inventé, désespoir réel.",
];

export function pickBulletin(r: Remaining, exclude: number[]): { index: number; text: string } {
  const pool = BULLETINS.map((_, i) => i).filter((i) => !exclude.includes(i));
  const index = pool[Math.floor(Math.random() * pool.length)] ?? 0;
  const m = BULLETINS[index];
  return { index, text: typeof m === "function" ? m(r) : m };
}

/** Réponses quand on tapote le compteur, de plus en plus agacées. */
export const COUNTER_TAPS = [
  "Non. Ça ne va pas plus vite en cliquant.",
  "Toujours non.",
  "Le compteur a été informé de votre impatience. Il s'en moque.",
  "Chaque clic ajoute 0 seconde. Nous avons vérifié.",
  "Vous êtes Sparrow, n'est-ce pas ?",
  "Signalement transmis au Ministère du Calendrier.",
  "Ok. On a appuyé plus fort à votre place. Rien.",
  "Ce comportement figurera dans votre dossier.",
];

/** Messages d'alerte quand on harcèle la photo. */
export const PHOTO_ALERTS = [
  "TENTATIVE DE LIBÉRATION ANTICIPÉE DÉTECTÉE. ACCÈS REFUSÉ.",
  "SECONDE TENTATIVE ENREGISTRÉE. LE SUJET N'EST PAS UN BOUTON.",
  "PROTOCOLE ANTI-ÉVASION ACTIVÉ. VEUILLEZ RESTER CALME.",
];

/** Bulletins selon le moment de la journée (heure de Paris). */
export function greeting(hour: number): string {
  if (hour < 5) return "Consultation nocturne détectée. Le sujet ne dort toujours pas.";
  if (hour < 11) return "Bonjour. Un nouveau réveil vient d'être décompté.";
  if (hour < 14) return "Pause déjeuner. Le calendrier, lui, continue de travailler.";
  if (hour < 18) return "Après-midi en cours. Situation stable, désespérément stable.";
  if (hour < 22) return "Fin de journée. Encore une de rayée sur le mur.";
  return "Couvre-feu du calendrier. Les secondes font des heures sup.";
}
