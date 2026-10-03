import { labels } from "@/lib/format";
import { ArrowRight, Plus, PackageOpen } from "lucide-react";
import Link from "next/link";
export function Badge({ value }: { value: string }) {
  return (
    <span className={`status status-${value}`}>{labels[value] ?? value}</span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <PackageOpen size={36} strokeWidth={1.2} />
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <Link className="button" href={href}>
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Alert({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "error" : ""}`}
    >
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Chargement de l’atelier…
    </div>
  );
}
export function AddProduct() {
  return (
    <Link className="button" href="/erp/inventaire/nouveau">
      <Plus size={18} />
      Ajouter une pièce
    </Link>
  );
}
