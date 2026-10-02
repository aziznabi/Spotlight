"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight, Trash2 } from "lucide-react";
import { type PublicCart } from "@/modules/commerce/storefront";
import { money } from "@/lib/format";
import { Alert, Empty, Loading } from "./ui";
export function AddToCart({
  variantId,
  available,
}: {
  variantId: string;
  available: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [added, setAdded] = useState(false);
  return (
    <>
      <button
        className="add-cart"
        disabled={busy || !available}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "add", variantId }),
            });
            const b = await r.json();
            if (!r.ok) throw new Error(b.error);
            setAdded(true);
            if (b.warnings?.length) setError(b.warnings.join(" "));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ShoppingBag size={18} />
        {busy
          ? "Ajout…"
          : available
            ? "Ajouter au panier"
            : "Pièce indisponible"}
      </button>
      {error && <Alert error>{error}</Alert>}
      {added && (
        <Link className="button secondary" href="/panier">
          Voir mon panier <ArrowRight size={16} />
        </Link>
      )}
      <p className="small muted">
        L’ajout au panier ne réserve pas la pièce. La disponibilité sera
        vérifiée au checkout Shopify.
      </p>
    </>
  );
}
export function CartView() {
  const [cart, setCart] = useState<PublicCart | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/cart")
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setCart(b.cart);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  if (!loaded) return <Loading />;
  return (
    <>
      {error && <Alert error>{error}</Alert>}
      {!cart?.lines.nodes.length ? (
        <Empty
          title="Votre prochaine trouvaille vous attend."
          text="Le panier est vide."
          href="/"
          label="Explorer la collection"
        />
      ) : (
        <div className="cart-layout">
          <div>
            {cart.lines.nodes.map((l) => (
              <div className="cart-line" key={l.id}>
                <div>
                  <Link href={`/pieces/${l.merchandise.product.handle}`}>
                    <h2>{l.merchandise.product.title}</h2>
                  </Link>
                  <p>Pièce unique · Quantité {l.quantity}</p>
                  {!l.merchandise.availableForSale && (
                    <p className="danger">Cette pièce n’est plus disponible.</p>
                  )}
                </div>
                <strong>
                  {money(
                    Math.round(Number(l.merchandise.price.amount) * 100),
                    l.merchandise.price.currencyCode,
                  )}
                </strong>
                <button
                  className="icon-button"
                  aria-label={`Retirer ${l.merchandise.product.title}`}
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/cart", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "remove",
                          lineId: l.id,
                        }),
                      });
                      const b = await r.json();
                      if (!r.ok) throw new Error(b.error);
                      setCart(b.cart);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <aside className="cart-summary">
            <h2>Votre sélection</h2>
            <div className="row">
              <span>Total estimé</span>
              <strong>
                {money(
                  Math.round(Number(cart.cost.totalAmount.amount) * 100),
                  cart.cost.totalAmount.currencyCode,
                )}
              </strong>
            </div>
            <p className="small muted">
              Livraison et taxes calculées au checkout Shopify selon votre
              adresse.
            </p>
            {cart.lines.nodes.every((l) => l.merchandise.availableForSale) && (
              <a className="button" href={cart.checkoutUrl}>
                Passer au checkout <ArrowRight size={17} />
              </a>
            )}
            <p className="small muted">
              Le paiement et les informations de livraison sont traités par
              Shopify.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
