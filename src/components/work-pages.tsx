"use client";
import Link from "next/link";
import { useState } from "react";
import { RefreshCw, Check, ArrowUpRight } from "lucide-react";
import { useData, api } from "./api";
import { PageHeader, Alert, Empty, Loading, Badge } from "./ui";
import { date, money } from "@/lib/format";
type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  sku: string;
  product_id: string;
  kind: string;
  created_at: string;
};
type JobRow = {
  id: string;
  sku: string;
  kind: string;
  status: string;
  attempts: number;
  error: string | null;
  latency_ms: number | null;
  cost_minor: number | null;
  created_at: string;
  product_id: string;
};
type Order = {
  id: string;
  name: string;
  channel: string;
  financial_status: string;
  fulfillment_status: string;
  total_minor: number | null;
  currency: string;
  test: boolean;
  cancelled: boolean;
  created_at: string;
};
export function Tasks() {
  const { data, error, refresh } = useData<Task[]>("tasks", true);
  const [notice, setNotice] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="LES BONNES ACTIONS, AU BON MOMENT"
        title="Tâches"
        description="Confirmez les retraits pour garder une disponibilité fiable."
      />
      {(error || notice) && <Alert error>{error || notice}</Alert>}
      {!data ? (
        <Loading />
      ) : !data.length ? (
        <Empty
          title="Aucune tâche en attente."
          text="Les ventes créeront automatiquement les retraits nécessaires sur les autres canaux."
        />
      ) : (
        <div className="work-list">
          {data.map((t) => (
            <div className="task-row" key={t.id}>
              <span
                className={`task-dot ${t.status === "open" ? "urgent" : ""}`}
              />
              <div>
                <strong>{t.title}</strong>
                <p>
                  {t.sku || "Association requise"} · {date(t.created_at)}
                </p>
              </div>
              <Badge value={t.status} />
              {t.product_id && (
                <Link
                  href={`/erp/inventaire/${t.product_id}`}
                  aria-label="Voir la pièce"
                >
                  <ArrowUpRight size={18} />
                </Link>
              )}
              {t.status === "open" && (
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api(`tasks/${t.id}`, "POST", {});
                      await refresh();
                      setNotice("");
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                >
                  <Check size={16} />
                  Confirmer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
export function Jobs() {
  const { data, error, refresh } = useData<JobRow[]>("jobs", true);
  const [notice, setNotice] = useState("");
  async function action(id: string, action: "retry" | "cancel") {
    if (
      action === "retry" &&
      !window.confirm(
        "Une requête interrompue peut avoir été facturée. Avez-vous vérifié le fournisseur et souhaitez-vous relancer ?",
      )
    )
      return;
    try {
      await api(`jobs/${id}`, "POST", {
        action,
        acknowledgePossibleCharge: true,
      });
      await refresh();
      setNotice("");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="EXÉCUTION EN ARRIÈRE-PLAN"
        title="Traitements"
        description="Vos traitements persistent pendant que vous naviguez."
        action={
          <button
            className="secondary"
            onClick={async () => {
              try {
                await api("dispatch", "POST", {});
                await refresh();
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            <RefreshCw size={16} />
            Réexpédier les attentes
          </button>
        }
      />
      {(error || notice) && <Alert error>{error || notice}</Alert>}
      {!data ? (
        <Loading />
      ) : !data.length ? (
        <Empty
          title="L’atelier est au calme."
          text="Les analyses de marché, traitements d’images et publications apparaîtront ici."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Traitement</th>
                <th>État</th>
                <th>Tentatives</th>
                <th>Durée / coût</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Badge value={j.kind} />
                    <small>
                      {j.sku || "Global"} · {date(j.created_at)}
                    </small>
                    {j.error && <p className="job-error">{j.error}</p>}
                  </td>
                  <td>
                    <Badge value={j.status} />
                  </td>
                  <td>{j.attempts} / 3</td>
                  <td>
                    {j.latency_ms === null
                      ? "—"
                      : `${(j.latency_ms / 1000).toFixed(1)} s`}
                    <small>
                      {j.cost_minor === null
                        ? "Coût inconnu"
                        : money(j.cost_minor)}
                    </small>
                  </td>
                  <td>
                    {j.status === "failed" && j.attempts < 3 && (
                      <button
                        className="secondary"
                        onClick={() => action(j.id, "retry")}
                      >
                        Relancer
                      </button>
                    )}
                    {j.status === "pending" && (
                      <button
                        className="text-button"
                        onClick={() => action(j.id, "cancel")}
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export function Orders() {
  const { data, error, refresh } = useData<Order[]>("orders", true);
  const [notice, setNotice] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="LA PROCHAINE ÉTAPE"
        title="Commandes"
        description="Le stock est engagé dès la création de la commande, avant son paiement."
        action={
          <button
            className="secondary"
            onClick={async () => {
              try {
                await api("reconcile", "POST", {});
                setNotice(
                  "Rapprochement enregistré. Consultez les traitements.",
                );
                await refresh();
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            <RefreshCw size={16} />
            Rapprocher Shopify
          </button>
        }
      />
      {(error || notice) && <Alert error={!!error}>{error || notice}</Alert>}
      {!data ? (
        <Loading />
      ) : !data.length ? (
        <Empty
          title="Les prochaines histoires commencent ici."
          text="Les commandes Shopify et les ventes externes déclarées apparaîtront dans cette liste."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Canal</th>
                <th>Paiement</th>
                <th>Préparation</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <small>
                      {date(o.created_at)}
                      {o.test ? " · TEST" : ""}
                      {o.cancelled ? " · ANNULÉE" : ""}
                    </small>
                  </td>
                  <td>{o.channel}</td>
                  <td>
                    <Badge value={o.financial_status} />
                  </td>
                  <td>
                    <Badge value={o.fulfillment_status} />
                  </td>
                  <td>{money(o.total_minor, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        Les expéditions Shopify se traitent dans Shopify Admin. Les
        remboursements et annulations ne remettent jamais automatiquement une
        pièce en vente.
      </p>
    </>
  );
}
type Settings = {
  services: { name: string; ready: boolean; keys: string[] }[];
  storage: string;
  databaseEnvironment: string;
  apiVersion: string;
};
export function SettingsPage() {
  const { data, error } = useData<Settings>("settings");
  return (
    <>
      <PageHeader
        eyebrow="UNE CONFIGURATION EXPLICITE"
        title="Réglages & connexions"
        description="Présence des variables applicatives. Leur présence seule ne prouve pas une connexion réussie."
      />
      {error ? (
        <Alert error>{error}</Alert>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Alert>
            Les connexions des outils Codex ne sont pas des identifiants
            utilisables par l’application. Les secrets se configurent côté
            serveur.
          </Alert>
          <div className="settings-list">
            {data.services.map((s) => (
              <div className="setting-row" key={s.name}>
                <div>
                  <h3>{s.name}</h3>
                  <p className="mono small">{s.keys.join(" · ")}</p>
                </div>
                <span className={`connection ${s.ready ? "configured" : ""}`}>
                  {s.ready ? "Variable présente" : "À configurer"}
                </span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Environnement</h2>
            <p>
              Base : {data.databaseEnvironment} · Stockage : {data.storage} ·
              API Shopify : {data.apiVersion}
            </p>
            {data.storage === "local" && (
              <p className="danger">
                Stockage disque de vérification uniquement, interdit sur Vercel.
                Les images ne sont pas déployées.
              </p>
            )}
            <p>
              Les presets avancés sont disponibles uniquement si le fournisseur
              déclare les capacités correspondantes. Les tarifs non mesurés
              restent inconnus.
            </p>
          </div>
        </>
      )}
    </>
  );
}
