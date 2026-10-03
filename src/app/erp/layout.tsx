import { redirect } from "next/navigation";
import { getUser } from "@/modules/auth/server";
import { ErpShell } from "@/components/erp-shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/connexion");
  return <ErpShell user={user}>{children}</ErpShell>;
}
