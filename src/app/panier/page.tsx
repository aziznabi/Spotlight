import { StoreHeader, StoreFooter } from "@/components/store-shell";
import { CartView } from "@/components/cart";
export default function Cart() {
  return (
    <>
      <StoreHeader />
      <main id="main" className="store-main cart-page">
        <p className="eyebrow">VOTRE SÉLECTION</p>
        <h1>Le panier</h1>
        <CartView />
      </main>
      <StoreFooter />
    </>
  );
}
