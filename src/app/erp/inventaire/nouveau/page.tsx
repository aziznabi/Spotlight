import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/product-form";
export default function NewProduct() {
  return (
    <>
      <Link className="back-link" href="/erp/inventaire">
        ← Inventaire
      </Link>
      <PageHeader
        eyebrow="UNE NOUVELLE TROUVAILLE"
        title="Ajouter une pièce"
        description="Commencez par l’essentiel. Les photos et le marché viennent ensuite."
      />
      <ProductForm />
    </>
  );
}
