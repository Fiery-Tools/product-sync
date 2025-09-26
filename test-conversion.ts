// test-conversion.ts

import { ShopifyAdapter } from "./src/adapters/ShopifyAdapter";
import { WooAdapter } from "./src/adapters/WooAdapter";
import { EbayAdapter } from "./src/adapters/EbayAdapter";
import { CanonicalProduct, CanonicalVariant } from "./src/models/CanonicalProduct";
import { ShopifyProduct } from "./src/adapters/types";

// --- Adapters ---
const shopifyAdapter = new ShopifyAdapter();
const wooAdapter = new WooAdapter();
const ebayAdapter = new EbayAdapter();

// --- Test Data ---
/* Example Shopify product with variants */
const shopifyProd: ShopifyProduct = {
  id: "shopify123",
  title: "Cool Shirt",
  body_html: "A very cool shirt.",
  variants: [
    { id: "v1", title: "Red / M", price: "29.99", sku: "SKU-RED-M", inventory_quantity: 10 },
    { id: "v2", title: "Blue / L", price: "31.99", sku: "SKU-BLU-L", inventory_quantity: 5 }
  ],
  images: [{ src: "https://example.com/shirt.jpg" }]
};

// --- INTELLIGENT DIFF FUNCTION ---
function diffCanonical(original: CanonicalProduct, final: CanonicalProduct): string[] {
  const diffs: string[] = [];

  // Compare top-level fields
  if (original.title !== final.title) diffs.push(`Title differs: "${original.title}" vs "${final.title}"`);
  if (original.description !== final.description) diffs.push("Description differs.");

  // Intelligent Variant Comparison using the stable canonicalId
  if (original.variants.length !== final.variants.length) {
    diffs.push("Variant count differs.");
    return diffs; // Exit early if counts mismatch
  }

  for (const originalVariant of original.variants) {
    const finalVariant = final.variants.find(
      v => v.canonicalId === originalVariant.canonicalId
    );

    if (!finalVariant) {
      diffs.push(`Variant with canonicalId "${originalVariant.canonicalId}" (SKU: ${originalVariant.sku}) is missing in the final result.`);
      continue;
    }

    const variantDiffs: string[] = [];
    if (originalVariant.title !== finalVariant.title) variantDiffs.push(`title`);
    if (originalVariant.price !== finalVariant.price) variantDiffs.push(`price`);
    if (originalVariant.sku !== finalVariant.sku) variantDiffs.push(`sku`);
    if (originalVariant.inventory !== finalVariant.inventory) variantDiffs.push(`inventory`);

    if (variantDiffs.length > 0) {
      const originalJSON = JSON.stringify(originalVariant);
      const finalJSON = JSON.stringify(finalVariant);
      diffs.push(
        `Variant canonicalId="${originalVariant.canonicalId}" differs in fields: ${variantDiffs.join(', ')}.\n  Original: ${originalJSON}\n  Final:    ${finalJSON}`
      );
    }
  }

  return diffs;
}

// --- ROUND-TRIP CONVERSION ---
console.log("--- Starting Round Trip Test ---");

// 1. Shopify -> Canonical
const canonical1 = shopifyAdapter.fromPlatform(shopifyProd);
console.log("✅ Step 1: Shopify → Canonical (Initial state with new canonicalIds)");
// console.log(JSON.stringify(canonical1, null, 2));


// 2. Canonical -> Woo -> Canonical
const wooProd = wooAdapter.toPlatform(canonical1);
const canonical2 = wooAdapter.fromPlatform(wooProd);
console.log("✅ Step 2: Canonical → Woo → Canonical");


// 3. Canonical -> eBay -> Canonical
const ebayProd = ebayAdapter.toPlatform(canonical2);
const canonical3 = ebayAdapter.fromPlatform(ebayProd);
console.log("✅ Step 3: Canonical → eBay → Canonical (Final state)");
// console.log(JSON.stringify(canonical3, null, 2));

console.log("------------------------------------");


// --- FINAL DIFF ---
const diffs = diffCanonical(canonical1, canonical3);

if (diffs.length === 0) {
  console.log("✅ SUCCESS: Attributes and variants preserved perfectly through the entire round-trip.");
} else {
  console.error("❌ FAILURE: Attribute differences found after round-trip:");
  diffs.forEach(d => console.error(` - ${d}`));
}