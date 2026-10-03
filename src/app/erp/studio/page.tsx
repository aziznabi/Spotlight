import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ScanLine, ArrowRight } from "lucide-react";
export default function Studio() {
  return (
    <>
      <PageHeader
        eyebrow="L’ATELIER PHOTO"
        title="Spotlight Studio"
        description="Un studio intégré à chaque fiche, du fichier original au visuel validé."
      />
      <section className="studio-cover">
        <ScanLine size={60} strokeWidth={1} />
        <h2>La fidélité, avant tout.</h2>
        <p>
          Importez vos photos depuis une fiche produit. Préparez un fond propre,
          des marges régulières et les formats adaptés à vos canaux.
        </p>
        <Link href="/erp/inventaire" className="button">
          Choisir une pièce <ArrowRight size={17} />
        </Link>
      </section>
      <div className="three-columns">
        <section>
          <span className="step-number">01</span>
          <h3>Conserver</h3>
          <p>
            Les originaux restent privés et immuables. Les défauts et étiquettes
            font partie du dossier.
          </p>
        </section>
        <section>
          <span className="step-number">02</span>
          <h3>Préparer</h3>
          <p>
            Clean, Marketplace, Luxury, Lifestyle et Ad. Les capacités
            disponibles dépendent des accès fournisseur.
          </p>
        </section>
        <section>
          <span className="step-number">03</span>
          <h3>Valider</h3>
          <p>
            Comparez avant/après, approuvez, ordonnez et exportez les photos
            sélectionnées.
          </p>
        </section>
      </div>
    </>
  );
}
