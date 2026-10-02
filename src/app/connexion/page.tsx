"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <main id="main" className="login-page">
      <div className="login-brand">
        <Link href="/" className="brand">
          spotlight<span className="brand-dot">●</span>
        </Link>
        <p>Une nouvelle vie pour les belles pièces.</p>
      </div>
      <form
        className="login-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(f)),
            });
            const b = await r.json();
            if (!r.ok) throw new Error(b.error);
            router.push("/erp");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="eyebrow">ESPACE PRIVÉ</p>
        <h1>Bienvenue à l’atelier.</h1>
        <p className="muted">
          Connectez-vous à votre espace de travail Spotlight.
        </p>
        <label>
          Adresse email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="vous@spotlight.fr"
          />
        </label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary">
          {busy ? "Connexion…" : "Se connecter"} <span>→</span>
        </button>
        <p className="small muted">
          Accès réservé à l’équipe. Pour obtenir un compte, contactez votre
          administrateur.
        </p>
      </form>
    </main>
  );
}
