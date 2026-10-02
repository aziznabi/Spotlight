import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="narrow">
      <h1>Page introuvable</h1>
      <p>Cette page ou cette pièce n’est plus accessible.</p>
      <Link href="/">Retour à Spotlight</Link>
    </main>
  );
}
