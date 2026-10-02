"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Shirt,
  ListChecks,
  ShoppingBag,
  Activity,
  Settings,
  ArrowUpRight,
  LogOut,
  ScanLine,
} from "lucide-react";
import { type User } from "@/modules/auth/server";
const nav = [
  ["/erp", "Vue d’ensemble", LayoutGrid],
  ["/erp/inventaire", "Inventaire", Shirt],
  ["/erp/studio", "Spotlight Studio", ScanLine],
  ["/erp/taches", "Tâches", ListChecks],
  ["/erp/commandes", "Commandes", ShoppingBag],
  ["/erp/traitements", "Traitements", Activity],
  ["/erp/reglages", "Réglages", Settings],
] as const;
export function ErpShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter();
  return (
    <div className="erp">
      <aside className="sidebar">
        <Link href="/erp" className="brand">
          spotlight<span className="brand-dot">●</span>
        </Link>
        <span className="workspace-label">ESPACE ÉQUIPE</span>
        <nav aria-label="Navigation ERP">
          {nav
            .filter((n) => user.role === "admin" || n[0] !== "/erp/reglages")
            .map(([href, title, Icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  (
                    href === "/erp"
                      ? pathname === href
                      : pathname.startsWith(href)
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon size={19} />
                <span>{title}</span>
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" className="shop-link">
            Voir la boutique <ArrowUpRight size={16} />
          </Link>
          <div className="profile">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "Administrateur" : "Opérateur"}
              </small>
            </div>
            <button
              className="icon-button"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              onClick={async () => {
                await fetch("/api/auth", { method: "DELETE" });
                router.push("/connexion");
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="erp-body">
        <header className="topbar">
          <span>Atelier Spotlight</span>
          <span className="muted">Une pièce. Un parcours.</span>
        </header>
        <main id="main" className="content">
          {children}
        </main>
        <footer className="erp-footer">
          Spotlight · Espace de travail privé
        </footer>
      </div>
    </div>
  );
}
