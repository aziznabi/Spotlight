import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
async function login(page: Page, email = "admin@spotlight.test") {
  await page.goto("/connexion");
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill("Spotlight-demo-2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/erp");
  await expect(
    page.getByRole("heading", { name: "Chaque pièce avance." }),
  ).toBeVisible();
}
test("ERP protected, public surfaces never return internal notes or costs", async ({
  page,
  request,
}) => {
  await page.goto("/erp/inventaire");
  await expect(page).toHaveURL("/connexion");
  expect((await request.get("/api/erp/products")).status()).toBe(401);
  const response = await request.get("/");
  const html = await response.text();
  expect(html).not.toContain("purchase_minor");
  expect(html).not.toContain("internal_notes");
  expect(html).not.toContain("Données fictives de démonstration");
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
});
test("real private login, role enforcement, and CSRF refusal", async ({
  page,
}) => {
  await login(page, "operator@spotlight.test");
  const denied = await page.request.get("/api/erp/settings");
  expect(denied.status()).toBe(403);
  const products = await (await page.request.get("/api/erp/products")).json();
  const approve = await page.request.post(
    `/api/erp/products/${products[0].id}/approve`,
    { headers: { origin: "http://localhost:3000" }, data: {} },
  );
  expect(approve.status()).toBe(403);
  const csrf = await page.request.post("/api/erp/products", {
    headers: { origin: "https://attacker.invalid" },
    data: { title: "CSRF" },
  });
  expect(csrf.status()).toBe(403);
});
test("create/edit SKU, immutable upload, durable Studio job, approval and export", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "Ajouter une pièce" }).click();
  const title = `E2E synthetic ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Titre de travail").fill(title);
  await page.getByLabel("Marque", { exact: true }).fill("Fixture");
  await page
    .getByRole("combobox", { name: "Catégorie", exact: true })
    .fill("Veste");
  await page.getByLabel("Prix d’achat").fill("10");
  await page.getByLabel("Devise d’achat").selectOption("EUR");
  await page
    .getByRole("combobox", { name: "État", exact: true })
    .selectOption("good");
  await page.getByLabel("Prix boutique (EUR)").fill("50");
  await page
    .getByLabel("Description publique")
    .fill("Pièce synthétique de test. Aucune publication réelle.");
  await page.getByRole("button", { name: "Enregistrer la pièce" }).click();
  await expect(page).toHaveURL(/\/erp\/inventaire\/[0-9a-f-]{36}/);
  const id = page.url().split("/").at(-1)!;
  const initial = await (
    await page.request.get(`/api/erp/products/${id}`)
  ).json();
  const sku = initial.product.sku;
  await page.getByLabel("Emplacement", { exact: true }).fill("TEST · A1");
  await page.getByRole("button", { name: "Enregistrer la pièce" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Pièce enregistrée" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get(`/api/erp/products/${id}`)).json()).product
      .sku,
  ).toBe(sku);
  await page.getByRole("tab", { name: "Studio", exact: true }).click();
  const bytes = await sharp({
    create: { width: 320, height: 440, channels: 4, background: "#a8ad90" },
  })
    .png()
    .toBuffer();
  await page.locator("input[type=file]").setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: bytes,
  });
  await expect(page.getByText("Originaux conservés.")).toBeVisible();
  const detail = await (
    await page.request.get(`/api/erp/products/${id}`)
  ).json();
  const a = detail.assets[0];
  await page
    .getByRole("button", { name: `Sélectionner original ${a.id.slice(0, 8)}` })
    .click();
  await expect(page.getByLabel(/Détourage PhotoRoom/)).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Lifestyle Accès requis" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Créer 1 variante", exact: true })
    .click();
  await expect(page.getByText("Traitement enregistré.")).toBeVisible();
  await expect
    .poll(
      async () => {
        const data = await (
          await page.request.get(`/api/erp/products/${id}`)
        ).json();
        return data.jobs[0]?.status;
      },
      { timeout: 60000 },
    )
    .toBe("completed");
  await expect(
    page.getByRole("button", { name: "Comparer avant" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Comparer avant" }).click();
  await expect(
    page.getByRole("img", { name: "Avant traitement" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voir après" }).click();
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Exporter la photo" }),
  ).toBeVisible();
  const current = await (
    await page.request.get(`/api/erp/products/${id}`)
  ).json();
  expect(current.assets.find((x: { id: string }) => x.id === a.id).sha256).toBe(
    a.sha256,
  );
  expect(
    current.assets.filter((x: { kind: string }) => x.kind === "variant"),
  ).toHaveLength(1);
  const dl = await page.request.get(`/api/images/${a.id}?download=1`);
  expect(dl.headers()["content-disposition"]).toContain("attachment");
  await page.screenshot({
    path: `.local/studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Fiche", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Contrôle", exact: true })
    .selectOption("reviewed");
  await page
    .getByLabel("Observations", { exact: true })
    .fill("Contrôle humain synthétique pour test, aucune certification.");
  await page.getByRole("button", { name: "Enregistrer le contrôle" }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/erp/products/${id}`)).json())
          .product.authenticity.status,
    )
    .toBe("reviewed");
  await page.getByRole("tab", { name: "Listings", exact: true }).click();
  await page.getByRole("button", { name: "Valider la pièce (admin)" }).click();
  await expect(page.getByText("Pièce validée pour publication.")).toBeVisible();
  await page.getByRole("button", { name: "Publier sur Shopify" }).click();
  await expect(
    page.getByText("Démonstration : publication Shopify interdite."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Studio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Supprimer la variante" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Rejeter", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer la variante" }).click();
  await expect(
    page.getByText("Variante supprimée de la galerie."),
  ).toBeVisible();
  const archived = await (
    await page.request.get(`/api/erp/products/${id}`)
  ).json();
  expect(archived.assets.map((asset: { id: string }) => asset.id)).toEqual([
    a.id,
  ]);
  expect(archived.product.preparation).toBe("draft");
  await page.getByRole("tab", { name: "Marché & prix" }).click();
  await page.getByRole("button", { name: "Analyser le marché" }).click();
  await expect
    .poll(
      async () => {
        const d = await (
          await page.request.get(`/api/erp/products/${id}`)
        ).json();
        return d.jobs.find((j: { kind: string }) => j.kind === "pricing")
          ?.status;
      },
      { timeout: 30000 },
    )
    .toBe("failed");
  const priced = await (
    await page.request.get(`/api/erp/products/${id}`)
  ).json();
  expect(priced.benchmarks).toHaveLength(0);
  expect(priced.product.price_minor).toBe(5000);
});
test("external sale creates withdrawal and blocked integrations are explicit", async ({
  page,
}) => {
  await login(page);
  const created = await page.request.post("/api/erp/products", {
    headers: { origin: "http://localhost:3000" },
    data: { title: "E2E External Sale", price_minor: 5000 },
  });
  expect(created.status()).toBe(201);
  const p = await created.json();
  await page.request.post(`/api/erp/products/${p.id}/listing`, {
    headers: { origin: "http://localhost:3000" },
    data: {
      channel: "vestiaire",
      status: "published",
      url: "",
      priceMinor: 5000,
      title: p.title,
      description: "",
    },
  });
  const sold = await page.request.post(`/api/erp/products/${p.id}/sale`, {
    headers: { origin: "http://localhost:3000" },
    data: { channel: "vinted", priceMinor: 4500 },
  });
  expect(sold.status()).toBe(200);
  await page.goto("/erp/taches");
  await expect(
    page.getByText("Retirer l’annonce vestiaire").first(),
  ).toBeVisible();
  const detail = await (
    await page.request.get(`/api/erp/products/${p.id}`)
  ).json();
  expect(detail.product.stock).toBe("sold");
  await page.goto("/erp/commandes");
  const orderRow = page.getByRole("row").filter({ hasText: p.sku });
  await orderRow.getByText("Confirmer l’expédition").click();
  await orderRow.getByLabel("Transporteur").fill("Transport test");
  await orderRow.getByLabel("Référence de suivi").fill("SYNTHETIC-TRACKING");
  await orderRow.getByRole("button", { name: "Confirmer l’envoi" }).click();
  await expect(orderRow.getByText("Expédié", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `.local/orders-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/erp/reglages");
  await expect(page.getByText("À configurer").first()).toBeVisible();
});
test("desktop/mobile inventory and public storefront render without viewport overflow", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto("/erp/inventaire");
  await expect(
    page.getByRole("heading", { name: "Inventaire", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("DEMO-0001", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/inventory-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Les belles pièces ont plusieurs vies.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/store-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/panier");
  await expect(page.getByText("Le panier est vide.")).toBeVisible();
});
