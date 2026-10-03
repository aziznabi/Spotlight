import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { StoreHeader, StoreFooter } from "@/components/store-shell";
import { storeProduct } from "@/modules/commerce/storefront";
import { AddToCart } from "@/components/cart";
import { money } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const p = await storeProduct(handle);
  if (!p) notFound();
  const v = p.variants.nodes[0];
  return (
    <>
      <StoreHeader />
      <main id="main" className="store-main">
        <Link className="back-link" href="/#collection">
          ← La collection
        </Link>
        <div className="store-detail">
          <div className="store-detail-images">
            {p.images.nodes.map((image, i) => (
              <Image
                key={image.url}
                src={image.url}
                alt={image.altText ?? `${p.title} — photo ${i + 1}`}
                width={image.width || 700}
                height={image.height || 875}
                priority={i === 0}
              />
            ))}
          </div>
          <section>
            <p className="eyebrow">{p.vendor} · SECONDE MAIN</p>
            <h1>{p.title}</h1>
            {v && (
              <p className="store-detail-price">
                {money(
                  Math.round(Number(v.price.amount) * 100),
                  v.price.currencyCode,
                )}
              </p>
            )}
            <div className="description">{p.description}</div>
            {v && (
              <AddToCart
                variantId={v.id}
                available={p.availableForSale && v.availableForSale}
              />
            )}
            <p className="small muted">
              Consultez toutes les photos, les mesures et les défauts décrits
              avant de choisir votre pièce.
            </p>
          </section>
        </div>
      </main>
      <StoreFooter />
    </>
  );
}
