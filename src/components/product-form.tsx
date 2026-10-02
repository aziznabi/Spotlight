"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { api } from "./api";
import { type Product } from "@/modules/inventory/types";
import { Alert } from "./ui";
import { minorUnits, toMinor } from "@/lib/currency";
export function ProductForm({
  product,
  onSaved,
}: {
  product?: Product;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const router = useRouter();
  return (
    <form
      className="product-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSuccess("");
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "");
        const payload = {
          title: s("title"),
          brand: s("brand"),
          category: s("category"),
          attributes: {
            model: s("model"),
            gender: s("gender"),
            size: s("size"),
            color: s("color"),
            material: s("material"),
            pattern: s("pattern"),
            variant: s("variant"),
            measurements: s("measurements"),
          },
          condition: s("condition"),
          defects: s("defects"),
          purchase_minor: s("purchase")
            ? toMinor(Number(s("purchase")), s("purchase_currency"))
            : null,
          purchase_currency: s("purchase_currency"),
          purchase_fx_rate: s("purchase_fx_rate")
            ? Number(s("purchase_fx_rate"))
            : null,
          purchase_fx_source: s("purchase_fx_source") || null,
          purchase_fx_date: s("purchase_fx_date") || null,
          purchased_on: s("purchased_on") || null,
          source: s("source"),
          location: s("location"),
          internal_notes: s("internal_notes"),
          price_minor: s("price") ? Math.round(Number(s("price")) * 100) : null,
          currency: "EUR",
          description: s("description"),
          tags: s("tags")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          revision: product?.revision,
        };
        try {
          const p = await api<Product>(
            product ? `products/${product.id}` : "products",
            product ? "PUT" : "POST",
            payload,
          );
          setSuccess(
            "Pièce enregistrée. Toute modification demande une nouvelle validation avant publication.",
          );
          if (onSaved) onSaved();
          else router.push(`/erp/inventaire/${p.id}`);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="form-section">
        <div>
          <h2>La pièce</h2>
          <p className="muted">
            Les informations observées. Laissez les inconnues vides.
          </p>
        </div>
        <div className="fields">
          <label className="wide">
            Titre de travail
            <input
              name="title"
              defaultValue={product?.title}
              required
              maxLength={180}
              placeholder="Ex. Veste en laine à carreaux"
            />
          </label>
          <label>
            Marque
            <input
              name="brand"
              defaultValue={product?.brand}
              placeholder="Marque sur l’étiquette"
            />
          </label>
          <label>
            Catégorie
            <input
              name="category"
              defaultValue={product?.category}
              list="categories"
              placeholder="Veste, chemise, sac…"
            />
            <datalist id="categories">
              <option>Veste</option>
              <option>Chemise</option>
              <option>Pull</option>
              <option>Pantalon</option>
              <option>Robe</option>
              <option>Sac</option>
              <option>Accessoire</option>
            </datalist>
          </label>
          <label>
            Modèle / coupe
            <input name="model" defaultValue={product?.attributes.model} />
          </label>
          <label>
            Genre
            <select
              name="gender"
              defaultValue={product?.attributes.gender ?? "unknown"}
            >
              <option value="unknown">Non renseigné</option>
              <option value="femme">Femme</option>
              <option value="homme">Homme</option>
              <option value="unisexe">Unisexe</option>
            </select>
          </label>
          <label>
            Taille
            <input name="size" defaultValue={product?.attributes.size} />
          </label>
          <label>
            Couleur
            <input name="color" defaultValue={product?.attributes.color} />
          </label>
          <label>
            Matière
            <input
              name="material"
              defaultValue={product?.attributes.material}
            />
          </label>
          <label>
            Motif
            <input name="pattern" defaultValue={product?.attributes.pattern} />
          </label>
          <label>
            Variante / logo
            <input name="variant" defaultValue={product?.attributes.variant} />
          </label>
          <label>
            État
            <select
              name="condition"
              defaultValue={product?.condition ?? "unknown"}
            >
              <option value="unknown">À examiner</option>
              <option value="new">Neuf</option>
              <option value="excellent">Excellent</option>
              <option value="good">Bon état</option>
              <option value="fair">État correct</option>
            </select>
          </label>
          <label className="wide">
            Mesures
            <textarea
              name="measurements"
              defaultValue={product?.attributes.measurements}
              placeholder="Largeur poitrine, longueur, entrejambe… préciser les unités."
              rows={2}
            />
          </label>
          <label className="wide">
            Défauts observés
            <textarea
              name="defects"
              defaultValue={product?.defects}
              placeholder="Taches, usure, reprises. Indiquer aussi les zones non vérifiées."
              rows={2}
            />
          </label>
        </div>
      </section>
      <section className="form-section">
        <div>
          <h2>Sourcing & achat</h2>
          <p className="muted">
            Privé. Ces informations ne sont pas envoyées à la boutique.
          </p>
        </div>
        <div className="fields">
          <label>
            Prix d’achat
            <input
              name="purchase"
              type="number"
              min="0"
              step="0.001"
              defaultValue={
                product?.purchase_minor == null
                  ? ""
                  : product.purchase_minor /
                    minorUnits(product.purchase_currency)
              }
            />
          </label>
          <label>
            Devise d’achat
            <select
              name="purchase_currency"
              defaultValue={product?.purchase_currency ?? "TND"}
            >
              <option>TND</option>
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </label>
          <label>
            Date d’achat
            <input
              type="date"
              name="purchased_on"
              defaultValue={product?.purchased_on?.slice(0, 10)}
            />
          </label>
          <label>
            Taux vers EUR (1 unité = … EUR)
            <input
              type="number"
              min="0.00000001"
              step="0.00000001"
              name="purchase_fx_rate"
              defaultValue={product?.purchase_fx_rate ?? ""}
            />
          </label>
          <label>
            Source du taux d’achat
            <input
              name="purchase_fx_source"
              defaultValue={product?.purchase_fx_source ?? ""}
              placeholder="Banque / justificatif de conversion"
            />
          </label>
          <label>
            Date du taux d’achat
            <input
              type="date"
              name="purchase_fx_date"
              defaultValue={product?.purchase_fx_date?.slice(0, 10) ?? ""}
            />
          </label>
          <label>
            Provenance
            <input
              name="source"
              defaultValue={product?.source}
              placeholder="Marché, vendeur, lot…"
            />
          </label>
          <label>
            Emplacement
            <input
              name="location"
              defaultValue={product?.location}
              placeholder="Ex. Portant A · 03"
            />
          </label>
          <label className="wide">
            Notes internes
            <textarea
              name="internal_notes"
              defaultValue={product?.internal_notes}
              rows={2}
            />
          </label>
        </div>
      </section>
      <section className="form-section">
        <div>
          <h2>Préparer la vente</h2>
          <p className="muted">
            Le prix reste votre décision. Enregistrer ne publie pas.
          </p>
        </div>
        <div className="fields">
          <label>
            Prix boutique (EUR)
            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={
                product?.price_minor ? product.price_minor / 100 : ""
              }
            />
          </label>
          <label>
            Tags, séparés par des virgules
            <input name="tags" defaultValue={product?.tags.join(", ")} />
          </label>
          <label className="wide">
            Description publique
            <textarea
              name="description"
              defaultValue={product?.description}
              rows={5}
              placeholder="Décrivez la pièce, les mesures et les défauts avec précision."
            />
          </label>
        </div>
      </section>
      {error && <Alert error>{error}</Alert>}
      {success && <Alert>{success}</Alert>}
      <div className="form-footer">
        <span className="muted small">
          {product
            ? `SKU ${product.sku} · Révision ${product.revision}`
            : "Le SKU est attribué automatiquement à l’enregistrement."}
        </span>
        <button disabled={busy}>
          <Save size={17} />
          {busy ? "Enregistrement…" : "Enregistrer la pièce"}
        </button>
      </div>
    </form>
  );
}
