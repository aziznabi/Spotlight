import nextEnv from "@next/env";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { query, pool } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";
nextEnv.loadEnvConfig(process.cwd());
if (
  process.env.DEMO_SEED !== "true" ||
  process.env.DATABASE_ENV !== "development" ||
  !new URL(process.env.DATABASE_URL!).hostname.match(
    /^(127\.0\.0\.1|localhost)$/,
  )
)
  throw new Error(
    "Seed synthétique réservé à PostgreSQL local explicitement autorisé.",
  );
for (const [email, name, role] of [
  ["admin@spotlight.test", "Camille", "admin"],
  ["operator@spotlight.test", "Léa", "operator"],
])
  await query(
    "INSERT INTO users(email,name,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING",
    [email, name, role, hashPassword("Spotlight-demo-2026!")],
  );
const pieces = [
  ["Veste en laine à carreaux", "Atelier Démo", "Veste", "M", "#a09681", 7900],
  ["Chemise en coton écru", "Maison Démo", "Chemise", "L", "#d4cbb8", 3500],
  ["Pull col rond olive", "Atelier Démo", "Pull", "M", "#7d8064", 4900],
  ["Veste en denim brut", "Maison Démo", "Veste", "S", "#677784", 5900],
  ["Chemise rayée", "Atelier Démo", "Chemise", "M", "#a4adb0", 2900],
  ["Pull en maille chocolat", "Maison Démo", "Pull", "L", "#7a6558", 4500],
] as const;
for (let i = 0; i < pieces.length; i++) {
  const [title, brand, category, size, color, price] = pieces[i];
  const sku = `DEMO-${String(i + 1).padStart(4, "0")}`;
  let [p] = await query("SELECT id FROM products WHERE sku=$1", [sku]);
  if (p) continue;
  [p] = await query(
    "INSERT INTO products(sku,title,brand,category,attributes,condition,purchase_minor,purchase_currency,source,location,price_minor,description,is_demo,internal_notes) VALUES($1,$2,$3,$4,$5,'good',$6,'EUR','Jeu synthétique de vérification',$7,$8,$9,true,'Données fictives de démonstration. Ne pas publier.') RETURNING id",
    [
      sku,
      title,
      brand,
      category,
      {
        model: "Coupe droite",
        gender: "unisexe",
        size,
        color: "Voir illustration",
        material: "Inconnue",
        pattern: "",
        variant: "",
        measurements: "",
      },
      Math.round(price * 0.3),
      `Portant ${i < 3 ? "A" : "B"} · 0${i + 1}`,
      price,
      "Article synthétique pour vérifier le parcours de travail. Illustration de test, aucune pièce réelle associée.",
    ],
  );
  for (const kind of [
    "transport",
    "preparation",
    "authentification",
    "commission",
    "paiement",
    "livraison",
    "retours",
    "publicite",
  ])
    await query(
      "INSERT INTO costs(product_id,kind,currency) VALUES($1,$2,'EUR')",
      [p.id, kind],
    );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="600" height="750" fill="#eae9e1"/><ellipse cx="300" cy="640" rx="145" ry="15" fill="#d8d7cd"/><path d="M208 158 L140 182 L66 337 L151 375 L185 312 L175 612 Q300 637 425 612 L415 312 L449 375 L534 337 L460 182 L392 158 Q300 195 208 158Z" fill="${color}"/><path d="M245 166 Q300 214 355 166 L334 210 Q300 240 266 210Z" fill="#585951" opacity=".55"/><path d="M300 227V616 M196 314L185 600 M404 314L415 600" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/>${category === "Veste" ? '<path d="M210 374H272V442H210ZM328 374H390V442H328Z" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3"/>' : ""}<text x="300" y="707" text-anchor="middle" fill="#77796b" font-family="sans-serif" font-size="13" letter-spacing="3">ILLUSTRATION · DÉMONSTRATION</text></svg>`;
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer(),
    id = randomUUID(),
    key = `${p.id}/${id}.png`;
  await mkdir(`.local/objects/${p.id}`, { recursive: true });
  await writeFile(`.local/objects/${key}`, bytes, { flag: "wx" });
  await query(
    "INSERT INTO assets(id,product_id,kind,storage_key,sha256,mime,width,height,bytes,parameters) VALUES($1,$2,'original',$3,$4,'image/png',600,750,$5,$6)",
    [
      id,
      p.id,
      key,
      createHash("sha256").update(bytes).digest("hex"),
      bytes.length,
      {
        synthetic: true,
        description: "Illustration de vérification, pas une photo produit",
      },
    ],
  );
  await query(
    "INSERT INTO audit(product_id,event,details) VALUES($1,'demo.seed',$2)",
    [p.id, { synthetic: true }],
  );
}
console.log(
  "6 pièces synthétiques, illustrations et comptes locaux créés (publication Shopify interdite). Voir docs/development.md.",
);
await pool().end();
