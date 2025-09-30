// src/adapters/EbayAdapter.ts

import { Adapter } from "./Adapter";
import { CanonicalProduct } from "../models/CanonicalProduct";
import {
  EbayProduct,
  EbayInventoryItem,
  EbayInventoryItemGroup,
  EbayOfferDetails
} from "./types";

// The separator used to embed our JSON payload within the eBay SKU.
const META_SEPARATOR = "::meta=";

/**
 * Adapter for converting between the CanonicalProduct model and the eBay inventory models.
 * It intelligently handles both simple (EbayInventoryItem) and variable (EbayInventoryItemGroup)
 * product types, mirroring the logic used in the WooAdapter.
 */
export class EbayAdapter implements Adapter<EbayProduct> {
  /**
   * Converts an eBay product (simple or variable) into the Canonical Product model.
   */
  fromPlatform(product: EbayProduct): CanonicalProduct {
    // TYPE GUARD: Use the presence of 'inventoryItemGroupKey' to identify a variable product.
    if ('inventoryItemGroupKey' in product) {
      return this.fromItemGroup(product);
    }
    // Otherwise, it's a simple inventory item.
    return this.fromSimpleItem(product);
  }

  /**
   * Converts a Canonical Product into the appropriate eBay product model.
   */
  toPlatform(product: CanonicalProduct): EbayProduct {
    // **DECISION LOGIC**: If there is only one variant, create a simple inventory item.
    if (product.variants.length === 1) {
      const variant = product.variants[0];
      const simpleItem: EbayInventoryItem = {
        sku: variant.sku,
        condition: "NEW", // This would likely be configurable
        product: {
          title: product.title,
          description: product.description,
          imageUrls: product.images.map(img => img.src),
        },
        availability: {
          shipToLocationAvailability: {
            quantity: variant.inventory,
          },
        },
      };
      // Note: In the real eBay flow, you would also create a separate "Offer"
      // to associate a price with this inventory item.
      return simpleItem;
    }

    // If there are multiple variants, create a variable item group.
    const offers: EbayOfferDetails[] = product.variants.map(v => {
      const metaPayload = {
        canonicalId: v.canonicalId,
        title: v.title,
        meta: v.meta,
      };
      const ebaySku = `${v.sku}${META_SEPARATOR}${JSON.stringify(metaPayload)}`;

      return {
        sku: ebaySku,
        pricingSummary: { price: { value: v.price.toString(), currency: "USD" } },
        availability: { shipToLocationAvailability: { quantity: v.inventory } },
      };
    });

    const itemGroup: EbayInventoryItemGroup = {
      inventoryItemGroupKey: product.meta?.ebay?.id?.toString() || product.id || product.title.replace(/\s+/g, '-'),
      title: product.title,
      description: product.description,
      imageUrls: product.images.map(img => img.src),
      variantSKUs: offers.map(o => o.sku),
      offers,
    };
    return itemGroup;
  }

  /**
   * A helper to safely parse the original SKU and the JSON metadata payload.
   */
  private parseSku(ebaySku: string): { originalSku: string; restoredMeta: any } {
    if (ebaySku.includes(META_SEPARATOR)) {
      const parts = ebaySku.split(META_SEPARATOR);
      try {
        const restoredMeta = JSON.parse(parts[1]);
        return { originalSku: parts[0], restoredMeta };
      } catch (e) {
        return { originalSku: parts[0], restoredMeta: {} };
      }
    }
    return { originalSku: ebaySku, restoredMeta: {} };
  }

  // --- Private helpers for fromPlatform logic ---

  private fromSimpleItem(item: EbayInventoryItem): CanonicalProduct {
    const { originalSku, restoredMeta } = this.parseSku(item.sku);

    const variant = {
      canonicalId: restoredMeta.canonicalId || originalSku,
      title: restoredMeta.title || 'Default',
      // Price is part of the "Offer", not the "InventoryItem".
      // A real implementation would need a separate call to fetch the offer.
      price: 0,
      sku: originalSku,
      inventory: item.availability.shipToLocationAvailability.quantity,
      meta: {
        ...(restoredMeta.meta || {}),
        ebay: { sku: item.sku },
      },
    };

    return {
      id: item.sku,
      title: item.product.title,
      description: item.product.description,
      images: item.product.imageUrls.map(url => ({ src: url })),
      variants: [variant],
      meta: {
        ...(restoredMeta.meta || {}),
        ebay: { id: item.sku },
      },
    };
  }

  private fromItemGroup(group: EbayInventoryItemGroup): CanonicalProduct {
    const variants = (group.offers ?? []).map(offer => {
      const { originalSku, restoredMeta } = this.parseSku(offer.sku);
      const title = restoredMeta.title || "Title Not Found";

      return {
        canonicalId: restoredMeta.canonicalId || originalSku,
        title: title,
        price: parseFloat(offer.pricingSummary.price.value),
        sku: originalSku,
        inventory: offer.availability.shipToLocationAvailability.quantity,
        meta: {
          ...(restoredMeta.meta || {}),
          ebay: { sku: offer.sku },
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
        ebay: { id: group.inventoryItemGroupKey },
      },
    };
  }
}