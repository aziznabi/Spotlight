import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { StoreHeader, StoreFooter } from "@/components/store-shell";
import { catalog, type StoreProduct } from "@/modules/commerce/storefront";
import { money } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Store({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; after?: string }>;
}) {
  const params = await searchParams;
  let products: StoreProduct[] = [],
    unavailable = false,
    next: string | undefined;
  try {
    const result = await catalog(params.q, params.category, params.after);
    products = result.nodes;
    next = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : undefined;
  } catch {
    unavailable = true;
  }
  return (
    <>
      <StoreHeader />
      <main id="main" className="store-main">
        <section className="store-hero">
          <p className="eyebrow">SECONDE MAIN. PREMIER CHOIX.</p>
          <h1>
            Les belles pièces
            <br />
            ont plusieurs vies.
          </h1>
          <div className="hero-bottom">
            <p>
              Des vêtements et accessoires choisis pour continuer leur histoire.
              La prochaine pourrait être la vôtre.
            </p>
            <a
              href="#collection"
              className="circle-link"
              aria-label="Découvrir la collection"
            >
              <ArrowDown size={24} />
            </a>
          </div>
        </section>
        <section id="collection" className="collection">
          <div className="section-heading">
            <h2>La collection</h2>
            <span className="muted small">Des pièces uniques, une à une.</span>
          </div>
          <form className="store-filters">
            <input
              aria-label="Rechercher dans la collection"
              name="q"
              placeholder="Rechercher une pièce…"
              defaultValue={params.q}
            />
            <select
              name="category"
              aria-label="Catégorie"
              defaultValue={params.category ?? ""}
            >
              <option value="">Toutes les catégories</option>
              <option>Veste</option>
              <option>Chemise</option>
              <option>Pull</option>
              <option>Pantalon</option>
              <option>Sac</option>
              <option>Accessoire</option>
            </select>
            <button className="secondary">Rechercher</button>
          </form>
          {unavailable ? (
            <div className="store-empty">
              <p className="eyebrow">À TRÈS BIENTÔT</p>
              <h3>La collection se prépare.</h3>
              <p>
                Le catalogue n’est pas disponible pour le moment. Revenez
                prochainement découvrir les pièces Spotlight.
              </p>
            </div>
          ) : !products.length ? (
            <div className="store-empty">
              <h3>Aucune pièce pour cette recherche.</h3>
              <Link href="/">Voir toute la collection</Link>
            </div>
          ) : (
            <div className="store-grid">
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/pieces/${p.handle}`}
                  className="store-product"
                >
                  <div className="store-photo">
                    {p.images.nodes[0] && (
                      <Image
                        src={p.images.nodes[0].url}
                        alt={p.images.nodes[0].altText ?? p.title}
                        width={600}
                        height={750}
                      />
                    )}
                    <span className="product-arrow">
                      <ArrowUpRight size={21} />
                    </span>
                    {!p.availableForSale && (
                      <span className="sold-label">Indisponible</span>
                    )}
                  </div>
                  <div className="store-product-info">
                    <div>
                      <small>{p.vendor}</small>
                      <h3>{p.title}</h3>
                    </div>
                    <strong>
                      {p.variants.nodes[0]
                        ? money(
                            Math.round(
                              Number(p.variants.nodes[0].price.amount) * 100,
                            ),
                            p.variants.nodes[0].price.currencyCode,
                          )
                        : "—"}
                    </strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {next && (
            <Link
              className="button secondary"
              href={`/?q=${encodeURIComponent(params.q ?? "")}&category=${encodeURIComponent(params.category ?? "")}&after=${encodeURIComponent(next)}#collection`}
            >
              Pièces suivantes
            </Link>
          )}
        </section>
      </main>
      <StoreFooter />
    </>
  );
}
