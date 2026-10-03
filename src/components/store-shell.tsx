import Link from "next/link";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
export function StoreHeader() {
  return (
    <header className="store-header">
      <Link className="brand" href="/">
        spotlight<span className="brand-dot">●</span>
      </Link>
      <nav aria-label="Boutique">
        <Link href="/#collection">La collection</Link>
        <Link href="/panier" className="bag-link">
          <ShoppingBag size={20} />
          <span>Panier</span>
        </Link>
      </nav>
    </header>
  );
}
export function StoreFooter() {
  return (
    <footer className="store-footer">
      <div>
        <Link href="/" className="brand">
          spotlight<span className="brand-dot">●</span>
        </Link>
        <p>Vêtements et accessoires de seconde main.</p>
      </div>
      <Link href="/connexion">
        Espace équipe <ArrowUpRight size={14} />
      </Link>
    </footer>
  );
}
