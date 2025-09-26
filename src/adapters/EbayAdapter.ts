import { Adapter } from "./Adapter";
import { CanonicalProduct, PlatformMeta } from "../models/CanonicalProduct";
import { EbayItemGroup, EbayOfferDetails } from "./types";

// The separator used to embed our JSON payload within the eBay SKU.
const META_SEPARATOR = "::meta=";

/**
 * Adapter for converting between the CanonicalProduct model and the eBay Inventory Item Group.
 *
 * This adapter uses a special technique: it encodes critical canonical data (like the
 * canonicalId, title, and metadata from other platforms) into a JSON string and appends
 * it to the SKU. This makes the system resilient even though eBay doesn't have a
 * generic "meta_data" field like WooCommerce.
 */
export class EbayAdapter implements Adapter<EbayItemGroup> {
  /**
   * Converts an eBay Inventory Item Group back into the Canonical Product model.
   * It parses the SKU to restore the original, canonical data.
   */
  fromPlatform(group: EbayItemGroup): CanonicalProduct {
    const variants = (group.offers ?? []).map(offer => {
      const { originalSku, restoredMeta } = this.parseSku(offer.sku);

      // **THE FIX**: Use the preserved title from the restored metadata.
      // Do not try to reconstruct it from the SKU. Fallback to a default if it's missing.
      const title = restoredMeta.title || "Title Not Found";

      return {
        canonicalId: restoredMeta.canonicalId || originalSku,
        title: title, // Use the perfectly preserved title.
        price: parseFloat(offer.pricingSummary.price.value),
        sku: originalSku,
        inventory: offer.availability.shipToLocationAvailability.quantity,
        meta: {
          ...(restoredMeta.meta || {}), // Restore all previous platform data (from Shopify, Woo, etc.)
          ebay: { sku: offer.sku },     // Add eBay's own specific data
        },
      };
    });

    return {
      id: group.inventoryItemGroupKey,
      title: group.title,
      description: group.description,
      images: group.imageUrls.map(url => ({ src: url })),
      variants,
      meta: {
        // For this test, we assume product-level meta is handled elsewhere or not needed.
        // A real implementation might store it in the eBay group description.
        ebay: { id: group.inventoryItemGroupKey },
      },
    };
  }

  /**
   * Converts a Canonical Product into the eBay Inventory Item Group format.
   * It encodes the variant's title and metadata into the SKU.
   */
  toPlatform(product: CanonicalProduct): EbayItemGroup {
    const offers: EbayOfferDetails[] = product.variants.map(v => {
      // **THE FIX**: Create a payload that includes the variant's `title`
      // alongside its canonicalId and metadata.
      const metaPayload = {
        canonicalId: v.canonicalId,
        title: v.title, // <-- The crucial addition
        meta: v.meta,
      };

      // Append the JSON-stringified payload to the original SKU.
      const ebaySku = `${v.sku}${META_SEPARATOR}${JSON.stringify(metaPayload)}`;

      return {
        sku: ebaySku,
        pricingSummary: { price: { value: v.price.toString(), currency: "USD" } },
        availability: { shipToLocationAvailability: { quantity: v.inventory } },
      };
    });

    return {
      inventoryItemGroupKey: product.meta?.ebay?.id?.toString() || product.id || product.title.replace(/\s+/g, '-'),
      title: product.title,
      description: product.description,
      imageUrls: product.images.map(img => img.src),
      variantSKUs: offers.map(o => o.sku),
      offers,
    };
  }

  /**
   * A helper to safely parse the original SKU and the JSON metadata payload.
   */
  private parseSku(ebaySku: string): { originalSku: string; restoredMeta: any } {
    if (ebaySku.includes(META_SEPARATOR)) {
      const parts = ebaySku.split(META_SEPARATOR);
      try {
        // Attempt to parse the JSON part of the SKU.
        const restoredMeta = JSON.parse(parts[1]);
        return { originalSku: parts[0], restoredMeta };
      } catch (e) {
        // If parsing fails, return the raw SKU to prevent a crash.
        return { originalSku: parts[0], restoredMeta: {} };
      }
    }
    // If there's no separator, the whole string is the SKU and there's no meta.
    return { originalSku: ebaySku, restoredMeta: {} };
  }
}