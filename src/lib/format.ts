import { minorUnits } from "./currency";
export function money(minor: number | null | undefined, currency = "EUR") {
  return minor == null
    ? "Non renseigné"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(
        minor / minorUnits(currency),
      );
}
export function date(value: string | Date | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeZone: "Europe/Paris",
      }).format(new Date(value))
    : "—";
}
export const labels: Record<string, string> = {
  available: "Disponible",
  committed: "Engagé",
  sold: "Vendu",
  quarantine: "À contrôler",
  draft: "Brouillon",
  identified: "Identifié",
  priced: "Prix étudié",
  photographed: "Photos prêtes",
  ready: "À valider",
  approved: "Validé",
  pending: "En attente",
  processing: "En cours",
  completed: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
  new: "Neuf",
  excellent: "Excellent",
  good: "Bon état",
  fair: "État correct",
  unknown: "Non renseigné",
  published: "Publié",
  withdrawal_pending: "À retirer",
  withdrawn: "Retiré",
  original: "Original",
  variant: "Variante",
  marketing: "Marketing",
  rejected: "Rejeté",
  pricing: "Analyse marché",
  studio: "Studio",
  identify: "Identification IA",
  publish: "Publication Shopify",
  withdraw: "Retrait Shopify",
  reconcile: "Rapprochement",
  paid: "Payé",
  unfulfilled: "À préparer",
  fulfilled: "Expédié",
  open: "À faire",
  done: "Terminé",
};
