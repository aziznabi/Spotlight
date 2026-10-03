export const ADMIN = {
  lookup:
    'query Existing($identifier:ProductIdentifierInput!,$location:ID!) { productByIdentifier(identifier:$identifier) { id tags variants(first:2) { nodes { id sku inventoryItem { id inventoryLevel(locationId:$location) { quantities(names:["available","committed"]) { name quantity } } } } } } }',
  context:
    "query Context { shop { name currencyCode } locations(first:10) { nodes { id name isActive } pageInfo { hasNextPage endCursor } } publications(first:10) { nodes { id } pageInfo { hasNextPage endCursor } } }",
  productSet:
    "mutation Upsert($input:ProductSetInput!,$identifier:ProductSetIdentifiers!) { productSet(input:$input,identifier:$identifier,synchronous:true) { product { id variants(first:1) { nodes { id inventoryItem { id } } } } userErrors { field message } } }",
  activate:
    "mutation Activate($item:ID!,$location:ID!,$key:String!) { inventoryActivate(inventoryItemId:$item,locationId:$location,available:1) @idempotent(key:$key) { inventoryLevel { id } userErrors { field message } } }",
  publish:
    "mutation Publish($id:ID!,$input:[PublicationInput!]!) { publishablePublish(id:$id,input:$input) { userErrors { field message } } }",
  level:
    'query Level($id:ID!,$location:ID!) { inventoryItem(id:$id) { inventoryLevel(locationId:$location) { quantities(names:["available","committed"]) { name quantity } } } }',
  zero: "mutation Zero($input:InventorySetQuantitiesInput!,$key:String!) { inventorySetQuantities(input:$input) @idempotent(key:$key) { userErrors { field message } } }",
  orders:
    "query Orders($after:String,$query:String!) { orders(first:25,after:$after,query:$query,sortKey:UPDATED_AT) { nodes { id name updatedAt cancelledAt displayFinancialStatus displayFulfillmentStatus test totalPriceSet { shopMoney { amount currencyCode } } lineItems(first:100) { nodes { id sku quantity discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } }",
} as const;
export const STOREFRONT = {
  eligibility:
    "query Eligibility($id:ID!) { node(id:$id) { ... on ProductVariant { availableForSale product { tags } } } }",
  catalog:
    "query Catalog($query:String,$after:String) { products(first:24,query:$query,after:$after) { nodes { id handle title description vendor productType tags availableForSale images(first:12) { nodes { url altText width height } } variants(first:1) { nodes { id availableForSale price { amount currencyCode } selectedOptions { name value } } } } pageInfo { hasNextPage endCursor } } }",
  product:
    "query Product($handle:String!) { product(handle:$handle) { id handle title description vendor productType tags availableForSale images(first:12) { nodes { url altText width height } } variants(first:1) { nodes { id availableForSale price { amount currencyCode } selectedOptions { name value } } } } }",
  cart: "query Cart($id:ID!) { cart(id:$id) { id checkoutUrl totalQuantity cost { totalAmount { amount currencyCode } } lines(first:100) { nodes { id quantity merchandise { ... on ProductVariant { id title availableForSale price { amount currencyCode } product { title handle } } } } } } }",
  create:
    "mutation CreateCart($input:CartInput!) { cartCreate(input:$input) { cart { id checkoutUrl totalQuantity cost { totalAmount { amount currencyCode } } lines(first:100) { nodes { id quantity merchandise { ... on ProductVariant { id title availableForSale price { amount currencyCode } product { title handle } } } } } } userErrors { field message } warnings { code message } } }",
  add: "mutation Add($cartId:ID!,$lines:[CartLineInput!]!) { cartLinesAdd(cartId:$cartId,lines:$lines) { cart { id checkoutUrl totalQuantity cost { totalAmount { amount currencyCode } } lines(first:100) { nodes { id quantity merchandise { ... on ProductVariant { id title availableForSale price { amount currencyCode } product { title handle } } } } } } userErrors { field message } warnings { code message } } }",
  remove:
    "mutation Remove($cartId:ID!,$lineIds:[ID!]!) { cartLinesRemove(cartId:$cartId,lineIds:$lineIds) { cart { id checkoutUrl totalQuantity cost { totalAmount { amount currencyCode } } lines(first:100) { nodes { id quantity merchandise { ... on ProductVariant { id title availableForSale price { amount currencyCode } product { title handle } } } } } } userErrors { field message } warnings { code message } } }",
} as const;
