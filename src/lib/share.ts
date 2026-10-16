import { APP_NAME } from "@/config";
import { renderShareCard } from "./shareCard";
import type { Remaining } from "./time";

export const appUrl = () => (typeof window === "undefined" ? "" : window.location.origin + "/");

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareLink(text: string): Promise<ShareResult> {
  const url = appUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: APP_NAME, text, url });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  return copyLink();
}

export async function copyLink(): Promise<ShareResult> {
  try {
    await navigator.clipboard.writeText(appUrl());
    return "copied";
  } catch {
    return "failed";
  }
}

/** Partage la fiche image (ou la télécharge si le partage de fichiers est indisponible). */
export async function shareCard(r: Remaining, photo: string, mode: "countdown" | "final"): Promise<ShareResult> {
  try {
    const blob = await renderShareCard({ r, photo, url: appUrl(), mode });
    const file = new File([blob], mode === "final" ? "sparrow-verdict.png" : "dossier-sp-2031.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: APP_NAME, text: appUrl() });
        return "shared";
      } catch (e) {
        if ((e as Error).name === "AbortError") return "cancelled";
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return "shared";
  } catch {
    return "failed";
  }
}
