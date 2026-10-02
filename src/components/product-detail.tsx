"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Upload,
  Download,
  Check,
  X,
  Sparkles,
  ArrowUpRight,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useData, api } from "./api";
import { Alert, Badge, Loading, PageHeader, Empty } from "./ui";
import { ProductForm } from "./product-form";
import { type Product, type Asset, type Job } from "@/modules/inventory/types";
import { money, date } from "@/lib/format";
import { minorUnits, toMinor } from "@/lib/currency";
import { presets, type StudioInput } from "@/modules/studio/presets";
import { type benchmark } from "@/modules/pricing/engine";
import { margin } from "@/modules/pricing/margin";
type Benchmark = ReturnType<typeof benchmark>;
type Cost = {
  id: string;
  kind: string;
  known: boolean;
  amount_minor: number | null;
  currency: string;
  fx_rate: number | null;
  fx_source: string | null;
  fx_date: string | null;
};
type Listing = {
  id: string;
  channel: string;
  status: string;
  external_url: string;
  price_minor: number | null;
  confirmed_at: string | null;
};
type Detail = {
  capabilities: {
    composition: boolean;
    backgroundRemoval: boolean;
    marketingScene: boolean;
  };
  product: Product;
  assets: Asset[];
  costs: Cost[];
  benchmarks: {
    id: string;
    result: Benchmark;
    created_at: string;
    cost_minor: number | null;
    latency_ms: number | null;
  }[];
  listings: Listing[];
  jobs: Job[];
  audit: { event: string; created_at: string }[];
  suggestions: { id: string; evidence: Record<string, unknown> }[];
};
const tabs = [
  "Fiche",
  "Marché & prix",
  "Studio",
  "Listings",
  "Coûts",
  "Historique",
];
export function ProductDetail({ id }: { id: string }) {
  const { data, error, refresh } = useData<Detail>(`products/${id}`, true);
  const [tab, setTab] = useState("Fiche"),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(false),
    [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>, success = "Enregistré.") {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      setNotice(success);
      setFailure(false);
      await refresh();
    } catch (e) {
      setFailure(true);
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const job = (kind: string, input: Record<string, unknown> = {}) =>
    act(
      () =>
        api(`products/${id}/jobs`, "POST", {
          kind,
          input,
          requestId: crypto.randomUUID(),
        }),
      "Traitement enregistré. Vous pouvez continuer à naviguer.",
    );
  if (error) return <Alert error>{error}</Alert>;
  if (!data) return <Loading />;
  const p = data.product;
  const pending = data.jobs.filter((j) =>
    ["pending", "processing"].includes(j.status),
  );
  return (
    <>
      <Link className="back-link" href="/erp/inventaire">
        ← Inventaire
      </Link>
      <PageHeader
        eyebrow={p.sku + (p.is_demo ? " · DÉMONSTRATION" : "")}
        title={p.title}
        description={`${p.brand || "Marque à identifier"} · ${p.category || "Catégorie à préciser"} · ${p.attributes.size || "Taille à préciser"}`}
        action={
          <div className="inline">
            <Badge value={p.stock} />
            <Badge value={p.preparation} />
          </div>
        }
      />
      <div className="tabs" role="tablist" aria-label="Fiche produit">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {notice && <Alert error={failure}>{notice}</Alert>}
      {pending.length > 0 && (
        <Alert>
          {pending.length} traitement(s) en cours ou en attente.{" "}
          <Link href="/erp/traitements">Suivre la progression →</Link>
        </Alert>
      )}
      {tab === "Fiche" && (
        <>
          <ProductForm key={p.id} product={p} onSaved={refresh} />
          <section className="panel">
            <div className="section-heading">
              <h2>Aide à l’identification</h2>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => job("identify")}
              >
                <Sparkles size={16} />
                Analyser les originaux
              </button>
            </div>
            <p className="muted">
              Propositions à vérifier. L’IA ne certifie pas l’authenticité et ne
              modifie pas automatiquement la fiche.
            </p>
            {data.suggestions.map((s) => (
              <details key={s.id}>
                <summary>Observations, déductions et inconnues</summary>
                <pre>{JSON.stringify(s.evidence, null, 2)}</pre>
              </details>
            ))}
          </section>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(() =>
                api(
                  `products/${id}/authenticity`,
                  "POST",
                  Object.fromEntries(f),
                ),
              );
            }}
          >
            <h2>Dossier d’authenticité</h2>
            <p className="muted">
              Consignez le contrôle humain et, si disponible, un certificat
              externe. Aucun résultat IA ne constitue une garantie.
            </p>
            <div className="fields">
              <label>
                Contrôle
                <select name="status" defaultValue={p.authenticity.status}>
                  <option value="unreviewed">À contrôler</option>
                  <option value="reviewed">Contrôle humain effectué</option>
                  <option value="concern">Point de vigilance</option>
                </select>
              </label>
              <label>
                Certificat externe (URL facultative)
                <input
                  name="certificateUrl"
                  type="url"
                  defaultValue={p.authenticity.certificateUrl}
                />
              </label>
              <label className="wide">
                Observations
                <textarea
                  name="observations"
                  defaultValue={p.authenticity.observations}
                  rows={3}
                />
              </label>
            </div>
            <button className="secondary" disabled={busy}>
              Enregistrer le contrôle
            </button>
          </form>
        </>
      )}
      {tab === "Marché & prix" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Le marché, comme point de départ.</h2>
              <p className="muted">
                Échantillon web accessible de Vinted et Vestiaire Collective.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => job("pricing", { refresh: false })}
            >
              <Sparkles size={16} />
              Analyser le marché
            </button>
          </div>
          {data.benchmarks.length === 0 ? (
            <Empty
              title="Le prix commence par des comparables."
              text="Lancez une recherche pour conserver les sources, les exclusions et les calculs. Un accès fournisseur est nécessaire."
            />
          ) : (
            <>
              <label className="snapshot-label">
                Dernier benchmark · {date(data.benchmarks[0].created_at)}{" "}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => job("pricing", { refresh: true })}
                >
                  <RefreshCw size={14} />
                  Actualiser les sources
                </button>
              </label>
              <PricingResult
                snapshot={data.benchmarks[0]}
                p={p}
                costs={data.costs}
              />
              {data.benchmarks.length > 1 && (
                <details>
                  <summary>
                    Historique · {data.benchmarks.length} snapshots
                  </summary>
                  {data.benchmarks.slice(1).map((s) => (
                    <div key={s.id} className="row">
                      {date(s.created_at)} · {s.result.retainedCount}{" "}
                      comparables ·{" "}
                      {money(s.result.recommendations?.recommended)}
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
          <Alert>
            Les prix demandés ne sont pas des prix de vente réalisés. Un
            benchmark ne change jamais un prix publié.
          </Alert>
        </>
      )}
      {tab === "Studio" && (
        <Studio
          capabilities={data.capabilities}
          onDelete={(a) =>
            act(
              () => api(`assets/${a.id}`, "DELETE", {}),
              "Variante supprimée de la galerie. Original conservé.",
            )
          }
          assets={data.assets}
          busy={busy}
          onJob={(input) => job("studio", input)}
          onUpload={(files) =>
            act(async () => {
              for (const file of files) {
                const f = new FormData();
                f.set("file", file);
                await api(`products/${id}/upload`, "POST", f);
              }
            }, "Originaux conservés. Chaque transformation créera une variante.")
          }
          onReview={(a, review, selected, position) =>
            act(() =>
              api(`assets/${a.id}`, "PATCH", { review, selected, position }),
            )
          }
        />
      )}
      {tab === "Listings" && (
        <>
          <div className="panel">
            <div className="section-heading">
              <h2>Publication Shopify</h2>
              <Badge value={p.preparation} />
            </div>
            <p>
              Une photo documentaire validée, un contrôle humain, un prix et une
              description sont requis.
            </p>
            <div className="inline wrap">
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  act(
                    () => api(`products/${id}/approve`, "POST", {}),
                    "Pièce validée pour publication.",
                  )
                }
              >
                <Check size={17} />
                Valider la pièce (admin)
              </button>
              <button
                disabled={busy || p.preparation !== "approved"}
                onClick={() => job("publish")}
              >
                Publier sur Shopify <ArrowUpRight size={17} />
              </button>
            </div>
            {data.listings
              .filter((l) => l.channel === "shopify")
              .map((l) => (
                <p key={l.id}>
                  <Badge value={l.status} /> Dernière confirmation :{" "}
                  {date(l.confirmed_at)}
                </p>
              ))}
          </div>
          <div className="section-heading">
            <h2>Canaux externes</h2>
            <span className="muted small">Suivi déclaratif</span>
          </div>
          <Alert>
            Les retraits Vinted et Vestiaire sont manuels. Une vente peut
            survenir avant la confirmation du retrait : traitez les tâches
            prioritaires rapidement.
          </Alert>
          {(["vinted", "vestiaire"] as const).map((channel) => {
            const listing = data.listings.find((l) => l.channel === channel);
            return (
              <form
                key={channel}
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(() =>
                    api(`products/${id}/listing`, "POST", {
                      channel,
                      status: f.get("status"),
                      url: f.get("url"),
                      priceMinor: f.get("price")
                        ? Math.round(Number(f.get("price")) * 100)
                        : null,
                      title: p.title,
                      description: p.description,
                    }),
                  );
                }}
              >
                <div className="section-heading">
                  <h2>
                    {channel === "vinted" ? "Vinted" : "Vestiaire Collective"}
                  </h2>
                  {listing && <Badge value={listing.status} />}
                </div>
                <div className="copy-box">
                  <p>{p.title}</p>
                  <p className="muted">
                    {p.description || "Compléter la description dans la fiche."}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      act(
                        () =>
                          navigator.clipboard.writeText(
                            `${p.title}\n\n${p.description}\nDéfauts : ${p.defects}`,
                          ),
                        "Texte copié.",
                      )
                    }
                  >
                    <Copy size={16} />
                    Copier le listing
                  </button>
                </div>
                <div className="fields">
                  <label>
                    Prix canal (EUR)
                    <input
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={
                        (listing?.price_minor ?? p.price_minor ?? 0) / 100 || ""
                      }
                    />
                  </label>
                  <label>
                    État déclaré
                    <select
                      name="status"
                      defaultValue={
                        listing?.status === "published"
                          ? "published"
                          : listing?.status === "withdrawn"
                            ? "withdrawn"
                            : "draft"
                      }
                    >
                      <option value="draft">Brouillon</option>
                      <option value="published">
                        Publié (vérifié manuellement)
                      </option>
                      <option value="withdrawn">
                        Retiré (vérifié manuellement)
                      </option>
                    </select>
                  </label>
                  <label className="wide">
                    URL de l’annonce
                    <input
                      name="url"
                      type="url"
                      defaultValue={listing?.external_url}
                    />
                  </label>
                </div>
                <div className="inline wrap">
                  <button className="secondary" disabled={busy}>
                    Confirmer le statut
                  </button>
                  <button
                    type="button"
                    className="text-button danger"
                    disabled={busy || p.stock !== "available"}
                    onClick={() => {
                      const price = window.prompt(
                        "Prix de vente réalisé en EUR (la pièce devient indisponible)",
                      );
                      if (price && Number(price) > 0)
                        void act(
                          () =>
                            api(`products/${id}/sale`, "POST", {
                              channel,
                              priceMinor: Math.round(Number(price) * 100),
                            }),
                          "Vente enregistrée, disponibilité retirée et tâches créées.",
                        );
                    }}
                  >
                    Déclarer une vente externe
                  </button>
                </div>
                <p className="small muted">
                  Dernière confirmation : {date(listing?.confirmed_at)}
                </p>
              </form>
            );
          })}
          <h3>Photos approuvées pour le listing</h3>
          <div className="export-list">
            {data.assets
              .filter((a) => a.selected && a.review === "approved")
              .sort((a, b) => a.position - b.position)
              .map((a) => (
                <a
                  className="button secondary"
                  key={a.id}
                  href={`/api/images/${a.id}?download=1`}
                >
                  <Download size={16} />
                  Photo {a.position + 1} ·{" "}
                  {a.kind === "marketing" ? "Marketing" : "Documentaire"}
                </a>
              ))}
          </div>
        </>
      )}
      {tab === "Coûts" && (
        <>
          <PageHeader
            title="Des marges lisibles"
            description="Un coût inconnu reste inconnu. Les montants sont arrondis au centime."
          />
          <div className="metrics">
            <div>
              <span>Prix boutique</span>
              <strong>{money(p.price_minor)}</strong>
            </div>
            <div>
              <span>Achat</span>
              <strong>{money(p.purchase_minor, p.purchase_currency)}</strong>
            </div>
            <div>
              <span>Vente − achat (EUR)</span>
              <strong>
                {money(
                  p.price_minor
                    ? margin(
                        p.price_minor,
                        p.purchase_minor,
                        p.purchase_currency,
                        data.costs,
                        p.purchase_fx_rate,
                      ).saleLessPurchase
                    : null,
                )}
              </strong>
            </div>
          </div>
          {data.costs.map((c) => (
            <form
              className="cost-row"
              key={c.id}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act(() =>
                  api(`costs/${c.id}`, "PATCH", {
                    known: f.get("known") === "on",
                    amount_minor: f.get("amount")
                      ? toMinor(
                          Number(f.get("amount")),
                          String(f.get("currency")),
                        )
                      : null,
                    currency: f.get("currency"),
                    fx_rate: f.get("fx_rate") ? Number(f.get("fx_rate")) : null,
                    fx_source: f.get("fx_source") || null,
                    fx_date: f.get("fx_date") || null,
                  }),
                );
              }}
            >
              <h3>{c.kind}</h3>
              <div className="fields">
                <label className="check">
                  <input
                    type="checkbox"
                    name="known"
                    defaultChecked={c.known}
                  />
                  Coût connu (y compris zéro)
                </label>
                <label>
                  Montant
                  <input
                    name="amount"
                    type="number"
                    step=".001"
                    min="0"
                    defaultValue={
                      c.amount_minor === null
                        ? ""
                        : c.amount_minor / minorUnits(c.currency)
                    }
                  />
                </label>
                <label>
                  Devise
                  <select name="currency" defaultValue={c.currency}>
                    <option>EUR</option>
                    <option>TND</option>
                    <option>USD</option>
                    <option>GBP</option>
                  </select>
                </label>
                <label>
                  Taux vers EUR
                  <input
                    name="fx_rate"
                    type="number"
                    step=".000001"
                    min=".000001"
                    defaultValue={c.fx_rate ?? ""}
                  />
                </label>
                <label>
                  Source du taux
                  <input name="fx_source" defaultValue={c.fx_source ?? ""} />
                </label>
                <label>
                  Date du taux
                  <input
                    name="fx_date"
                    type="date"
                    defaultValue={c.fx_date?.slice(0, 10) ?? ""}
                  />
                </label>
              </div>
              <button className="secondary" disabled={busy}>
                Enregistrer
              </button>
            </form>
          ))}
        </>
      )}
      {tab === "Historique" && (
        <section className="panel">
          <h2>Journal de la pièce</h2>
          {data.audit.length ? (
            data.audit.map((a, i) => (
              <div className="row" key={i}>
                <span>{a.event}</span>
                <time>{date(a.created_at)}</time>
              </div>
            ))
          ) : (
            <p className="muted">Aucun événement.</p>
          )}
        </section>
      )}
    </>
  );
}
function PricingResult({
  snapshot,
  p,
  costs,
}: {
  snapshot: Detail["benchmarks"][number];
  p: Product;
  costs: Cost[];
}) {
  const b = snapshot.result;
  return (
    <>
      <div className="strategy-grid">
        {(
          [
            ["Vente rapide", "quick"],
            ["Recommandé", "recommended"],
            ["Marge maximale", "maximum"],
          ] as const
        ).map(([label, key]) => (
          <div key={key} className={key === "recommended" ? "recommended" : ""}>
            <span>{label}</span>
            <strong>
              {b.recommendations
                ? money(b.recommendations[key])
                : "Données insuffisantes"}
            </strong>
            <small>
              {b.recommendations
                ? `Après coûts connus : ${money(margin(b.recommendations[key], p.purchase_minor, p.purchase_currency, costs, p.purchase_fx_rate).afterKnownVariableCosts)}`
                : "Au moins 5 comparables pertinents par marché"}
            </small>
          </div>
        ))}
      </div>
      <p className="small muted">
        Stratégies, sans promesse de délai. Marché retenu :{" "}
        {b.selectedMarket ?? "aucun"}. Coût recherche :{" "}
        {snapshot.cost_minor === null
          ? "non mesuré"
          : money(snapshot.cost_minor)}{" "}
        · Latence :{" "}
        {snapshot.latency_ms === null
          ? "non mesurée"
          : `${(snapshot.latency_ms / 1000).toFixed(1)} s`}
        .
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Marché</th>
              <th>Bruts / retenus</th>
              <th>P25 → P75</th>
              <th>Médiane pondérée</th>
              <th>Similarité / dispersion</th>
              <th>Qualité</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(b.markets).map(([key, m]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>
                  {m.raw} / {m.stats?.count ?? 0}
                </td>
                <td>
                  {m.stats
                    ? `${money(m.stats.p25)} → ${money(m.stats.p75)}`
                    : "—"}
                </td>
                <td>{money(m.stats?.weightedMedian)}</td>
                <td>
                  {Math.round(m.similarity * 100)} /{" "}
                  {m.dispersion === null ? "—" : m.dispersion.toFixed(2)}
                </td>
                <td>
                  {m.quality} · {m.verified} vérifiés
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{b.explanation}</p>
      <details>
        <summary>Toutes les statistiques et paramètres calculés</summary>
        <pre>{JSON.stringify(b.markets, null, 2)}</pre>
      </details>
      <h3>Comparables inspectables · {b.rawCount} résultats</h3>
      {b.comparables.map((c, i) => (
        <div className="comparable" key={`${c.url}-${i}`}>
          <div>
            <a href={c.url} target="_blank" rel="noreferrer">
              {c.title} <ArrowUpRight size={13} />
            </a>
            <small>
              {c.marketplace} · Prix{" "}
              {c.priceType === "asking" ? "demandé" : "vendu"} ·{" "}
              {c.accessibility === "snippet_only"
                ? "Extrait, activité non vérifiée"
                : c.accessibility}{" "}
              · {date(c.retrievedAt)}
            </small>
            <p>{c.evidence}</p>
            {c.excluded && <p className="danger">Exclu : {c.excluded}</p>}
            <details>
              <summary>Provenance et caractéristiques</summary>
              <pre>{JSON.stringify(c, null, 2)}</pre>
            </details>
          </div>
          <strong>{money(c.priceMinor, c.currency)}</strong>
        </div>
      ))}
    </>
  );
}
function Studio({
  capabilities,
  onDelete,
  assets,
  busy,
  onJob,
  onUpload,
  onReview,
}: {
  capabilities: Detail["capabilities"];
  onDelete: (a: Asset) => void;
  assets: Asset[];
  busy: boolean;
  onJob: (input: StudioInput) => void;
  onUpload: (files: File[]) => void;
  onReview: (
    a: Asset,
    review: string,
    selected: boolean,
    position: number,
  ) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]),
    [preset, setPreset] = useState<keyof typeof presets>("Clean"),
    [compare, setCompare] = useState<string | null>(null);
  const originals = assets.filter((a) => a.kind === "original"),
    variants = assets.filter((a) => a.kind !== "original");
  return (
    <>
      <div className="studio-intro">
        <div>
          <p className="eyebrow">SPOTLIGHT STUDIO</p>
          <h2>La pièce, sous son meilleur jour.</h2>
          <p className="muted">
            Des photos cohérentes. Des détails toujours fidèles.
          </p>
        </div>
        <label className="button secondary upload-button">
          <Upload size={17} />
          Importer des photos
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files) onUpload(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="small muted">
        JPEG, PNG, WebP · 4 Mo maximum par image · Les originaux sont privés et
        immuables.
      </p>
      <div className="section-heading">
        <h3>
          Originaux <span className="muted">{originals.length}</span>
        </h3>
        <span className="small muted">
          Sélectionnez une ou plusieurs images
        </span>
      </div>
      {!originals.length ? (
        <Empty
          title="Le studio attend votre première photo."
          text="Importez la face, le dos, les détails, les défauts et les étiquettes de la pièce."
        />
      ) : (
        <div className="gallery">
          {originals.map((a) => (
            <div
              key={a.id}
              className={`photo-card ${chosen.includes(a.id) ? "chosen" : ""}`}
            >
              <button
                className="photo-select"
                aria-label={`Sélectionner original ${a.id.slice(0, 8)}`}
                aria-pressed={chosen.includes(a.id)}
                onClick={() =>
                  setChosen((s) =>
                    s.includes(a.id)
                      ? s.filter((id) => id !== a.id)
                      : [...s, a.id],
                  )
                }
              >
                <Image
                  unoptimized
                  src={`/api/images/${a.id}`}
                  alt="Photo originale de la pièce"
                  width={260}
                  height={300}
                />
                <span className="select-circle">
                  {chosen.includes(a.id) ? "✓" : "+"}
                </span>
              </button>
              <div className="photo-meta">
                <strong>Original</strong>
                <span>
                  {a.width} × {a.height}
                </span>
              </div>
              <div className="photo-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => onReview(a, "approved", true, a.position)}
                >
                  <Check size={14} />
                  Valider pour la vente
                </button>
                <Badge value={a.review} />
              </div>
            </div>
          ))}
        </div>
      )}
      <form
        className="studio-controls panel"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onJob({
            assetIds: chosen,
            preset,
            format: f.get("format") as StudioInput["format"],
            background: String(f.get("background")),
            margin: Number(f.get("margin")) / 100,
            shadow: f.get("shadow") === "on",
            removeBackground: f.get("remove") === "on",
          });
        }}
      >
        <h3>Choisissez un rendu</h3>
        <div className="preset-list">
          {Object.entries(presets).map(([key, value]) => (
            <button
              type="button"
              key={key}
              className={preset === key ? "selected" : ""}
              disabled={value.marketing && !capabilities.marketingScene}
              onClick={() => setPreset(key as keyof typeof presets)}
            >
              <span
                className="preset-swatch"
                style={{ background: value.background }}
              >
                <span />
              </span>
              <strong>{key}</strong>
              <small>
                {value.marketing
                  ? capabilities.marketingScene
                    ? "Mise en scène IA"
                    : "Accès requis"
                  : "Photo documentaire"}
              </small>
            </button>
          ))}
        </div>
        <div key={preset} className="studio-options">
          <label>
            Format
            <select name="format" defaultValue={presets[preset].format}>
              <option>1:1</option>
              <option>4:5</option>
              <option>9:16</option>
            </select>
          </label>
          <label>
            Fond
            <input
              type="color"
              name="background"
              defaultValue={presets[preset].background}
            />
          </label>
          <label>
            Marge (%)
            <input
              type="number"
              name="margin"
              min={5}
              max={30}
              defaultValue={presets[preset].margin * 100}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="shadow"
              defaultChecked={presets[preset].shadow}
            />
            Ombre simple
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="remove"
              defaultChecked={capabilities.backgroundRemoval}
              disabled={!capabilities.backgroundRemoval}
            />
            Détourage PhotoRoom
            {!capabilities.backgroundRemoval && " · accès requis"}
          </label>
        </div>
        <div className="inline wrap">
          <button disabled={busy || !chosen.length || chosen.length > 6}>
            <Sparkles size={16} />
            Créer {chosen.length || "les"} variante
            {chosen.length !== 1 ? "s" : ""}
          </button>
          <span className="small muted">
            6 images maximum par lot. Une validation est requise pour chaque
            résultat.
          </span>
        </div>
        <p className="small muted">
          Détourage et presets Lifestyle/Ad nécessitent des accès PhotoRoom.
          Sans détourage, le fond de la photo source est conservé à l’intérieur
          du cadre. Les mises en scène sont des visuels marketing.
        </p>
      </form>
      <h3>Variantes & sélection de vente</h3>
      {!variants.length ? (
        <p className="muted">
          Les variantes apparaîtront ici à la fin des traitements.
        </p>
      ) : (
        <div className="gallery">
          {variants.map((a) => (
            <div className="photo-card" key={a.id}>
              <Image
                unoptimized
                src={`/api/images/${compare === a.id && a.source_id ? a.source_id : a.id}`}
                alt={
                  compare === a.id ? "Avant traitement" : "Variante à contrôler"
                }
                width={260}
                height={320}
              />
              <div className="photo-meta">
                <Badge value={a.kind} />
                <Badge value={a.review} />
              </div>
              <div className="photo-actions">
                <button
                  className="text-button"
                  onClick={() => setCompare(compare === a.id ? null : a.id)}
                >
                  {compare === a.id ? "Voir après" : "Comparer avant"}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => onReview(a, "approved", true, a.position)}
                >
                  <Check size={15} />
                  Valider
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => onReview(a, "rejected", false, a.position)}
                >
                  <X size={15} />
                  Rejeter
                </button>
                <button
                  type="button"
                  className="text-button danger"
                  disabled={busy || a.selected || !!a.public_url}
                  onClick={() => onDelete(a)}
                >
                  Supprimer la variante
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="selection-list">
        {assets
          .filter((a) => a.review === "approved")
          .sort((a, b) => a.position - b.position)
          .map((a) => (
            <div className="row" key={a.id}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={a.selected}
                  onChange={(e) =>
                    onReview(a, "approved", e.target.checked, a.position)
                  }
                />
                {a.kind === "marketing" ? "Marketing" : "Photo documentaire"} ·{" "}
                {a.id.slice(0, 8)}
              </label>
              <label className="inline small">
                Ordre (0 = principale)
                <input
                  aria-label={`Ordre ${a.id.slice(0, 8)}`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={a.position}
                  onBlur={(e) => {
                    if (Number(e.target.value) !== a.position)
                      onReview(
                        a,
                        "approved",
                        a.selected,
                        Number(e.target.value),
                      );
                  }}
                />
              </label>
              <a
                href={`/api/images/${a.id}?download=1`}
                aria-label="Exporter la photo"
              >
                <Download size={17} />
              </a>
            </div>
          ))}
      </div>
    </>
  );
}
