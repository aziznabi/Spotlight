"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ArrowUpRight, Shirt } from "lucide-react";
import { useData } from "@/components/api";
import { type Product } from "@/modules/inventory/types";
import {
  PageHeader,
  Alert,
  Loading,
  Empty,
  Badge,
  AddProduct,
} from "@/components/ui";
import { money } from "@/lib/format";
export default function Inventory() {
  const [search, setSearch] = useState(""),
    [stock, setStock] = useState("");
  const { data, error } = useData<
    (Product & { thumbnail_id: string | null })[]
  >(`products?q=${encodeURIComponent(search)}&stock=${stock}`);
  return (
    <>
      <PageHeader
        eyebrow="COLLECTION EN COURS"
        title="Inventaire"
        description="Chaque pièce a sa place, son prix et son histoire."
        action={<AddProduct />}
      />
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Rechercher une pièce"
            placeholder="Rechercher une marque, un SKU, une pièce…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="État du stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        >
          <option value="">Tous les stocks</option>
          <option value="available">Disponibles</option>
          <option value="committed">Engagés</option>
          <option value="sold">Vendus</option>
          <option value="quarantine">À contrôler</option>
        </select>
        <span className="muted small">{data?.length ?? "…"} pièces</span>
      </div>
      {error ? (
        <Alert error>{error}</Alert>
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty
          title="Une nouvelle collection commence ici."
          text="Ajoutez une pièce pour démarrer son parcours."
          href="/erp/inventaire/nouveau"
          label="Ajouter une pièce"
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pièce</th>
                <th>SKU / emplacement</th>
                <th>Préparation</th>
                <th>Stock</th>
                <th>Prix boutique</th>
                <th>
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      className="product-cell"
                      href={`/erp/inventaire/${p.id}`}
                    >
                      <span className="thumb">
                        {p.thumbnail_id ? (
                          <Image
                            src={`/api/images/${p.thumbnail_id}`}
                            alt=""
                            width={56}
                            height={68}
                            unoptimized
                          />
                        ) : (
                          <Shirt size={24} />
                        )}
                      </span>
                      <span>
                        <strong>{p.title}</strong>
                        <small>
                          {p.brand || "Marque à préciser"} ·{" "}
                          {p.attributes.size || "Taille à préciser"}
                          {p.is_demo ? " · DÉMO" : ""}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="mono">{p.sku}</span>
                    <small>{p.location || "Emplacement à préciser"}</small>
                  </td>
                  <td>
                    <Badge value={p.preparation} />
                  </td>
                  <td>
                    <Badge value={p.stock} />
                  </td>
                  <td className="price">
                    {p.price_minor ? money(p.price_minor) : "À définir"}
                  </td>
                  <td>
                    <Link
                      aria-label={`Ouvrir ${p.sku}`}
                      href={`/erp/inventaire/${p.id}`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
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
