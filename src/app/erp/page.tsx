"use client";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Clock,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { useData } from "@/components/api";
import { PageHeader, Alert, Loading, AddProduct } from "@/components/ui";
import { money } from "@/lib/format";
type Summary = {
  reporting: {
    pieces: number;
    assessable: number;
    afterKnownCosts: number | null;
    incomplete: number;
  };
  stock: {
    total: number;
    available: number;
    committed: number;
    sold: number;
    preparing: number;
    demo: number;
  };
  tasks: { open: number };
  orders: { preparing: number };
  sales: { count: number; eur: string | null };
};
export default function Dashboard() {
  const { data, error } = useData<Summary>("overview");
  if (error) return <Alert error>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="VOTRE ATELIER, EN UN REGARD"
        title="Chaque pièce avance."
        description="De la trouvaille à sa prochaine histoire."
        action={<AddProduct />}
      />
      {data.stock.demo > 0 && (
        <Alert>
          Environnement de démonstration · {data.stock.demo} pièces
          synthétiques, exclues de toute publication Shopify.
        </Alert>
      )}
      <section className="metrics" aria-label="État du stock">
        <div>
          <span>Pièces disponibles</span>
          <strong>{data.stock.available}</strong>
          <small>Stock global actuel</small>
        </div>
        <div>
          <span>En préparation</span>
          <strong>{data.stock.preparing}</strong>
          <small>Avant validation</small>
        </div>
        <div>
          <span>Pièces engagées</span>
          <strong>{data.stock.committed}</strong>
          <small>Réservées par commande</small>
        </div>
        <div>
          <span>Commandes à traiter</span>
          <strong>{data.orders.preparing}</strong>
          <small>Hors commandes annulées</small>
        </div>
      </section>
      <div className="section-heading">
        <h2>À faire avancer</h2>
        <Link href="/erp/taches">
          Toutes les tâches <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="work-list">
        <Link href="/erp/inventaire?stage=draft">
          <span className="work-icon">
            <Package size={22} />
          </span>
          <div>
            <strong>Préparer les prochaines pièces</strong>
            <p>Caractéristiques, photos et étude de marché.</p>
          </div>
          <span>{data.stock.preparing}</span>
          <ArrowRight size={18} />
        </Link>
        <Link href="/erp/taches">
          <span className="work-icon">
            <Clock size={22} />
          </span>
          <div>
            <strong>Publications et retraits à suivre</strong>
            <p>Les annonces externes demandent une confirmation humaine.</p>
          </div>
          <span>{data.tasks.open}</span>
          <ArrowRight size={18} />
        </Link>
        <Link href="/erp/commandes">
          <span className="work-icon">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <strong>Préparer les commandes</strong>
            <p>Vérifier les engagements avant l’expédition.</p>
          </div>
          <span>{data.orders.preparing}</span>
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className="dashboard-bottom">
        <section>
          <p className="eyebrow">LES 30 DERNIERS JOURS</p>
          <h2>Ventes enregistrées</h2>
          <p className="large-number">{data.sales.count}</p>
          <p className="muted">Commandes payées, hors tests et annulations.</p>
          <p>
            Total des commandes en EUR :{" "}
            <strong>
              {data.sales.eur === null
                ? "Aucune vente"
                : money(Number(data.sales.eur))}
            </strong>
          </p>
          <p className="small muted">
            Ce montant n’est pas une marge. Les coûts inconnus restent à
            renseigner.
          </p>
          <p>
            Après coûts variables connus :{" "}
            <strong>{money(data.reporting.afterKnownCosts)}</strong>
          </p>
          <p className="small muted">
            Estimation sur {data.reporting.assessable} / {data.reporting.pieces}{" "}
            pièces vendues en EUR, hors tests, remboursements et annulations.{" "}
            {data.reporting.incomplete} dossier(s) incomplet(s). Ce n’est pas un
            bénéfice comptable.
          </p>
        </section>
        <section className="quiet-panel">
          <p className="eyebrow">LE PARCOURS SPOTLIGHT</p>
          <h2>Un inventaire, plusieurs canaux.</h2>
          <p>
            Identifiez la pièce, justifiez son prix et préparez des photos
            fidèles. Une validation humaine ouvre la publication.
          </p>
          <Link href="/erp/inventaire">
            Ouvrir l’inventaire <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
