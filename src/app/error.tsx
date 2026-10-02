"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="narrow">
      <h1>Une interruption est survenue</h1>
      <p>Vos données déjà enregistrées sont conservées.</p>
      <button onClick={reset}>Réessayer</button>
    </main>
  );
}
