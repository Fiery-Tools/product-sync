import { Adapter } from "./Adapter";
import { CanonicalProduct, PlatformMeta } from "../models/CanonicalProduct";
import { WooProduct, WooVariant } from "./types";

/**
 * Adapter for converting between the CanonicalProduct model and the WooCommerce product model.
 *
 * This adapter uses WooCommerce's `meta_data` fields to persist the canonical ID
 * and the entire canonical metadata object, ensuring no data from other platforms is lost
 * during a round-trip conversion.
 */
export class WooAdapter implements Adapter<WooProduct> {
  /**
   * Converts a WooCommerce product into the Canonical Product model.
   * It restores metadata that was previously saved from other platforms.
   */
  fromPlatform(product: WooProduct): CanonicalProduct {
    // Attempt to restore the full meta object saved from a previous step.
    // Fallback to an empty object if it's the first time seeing this product.
    const restoredMeta: PlatformMeta = product.meta_data?.find(m => m.key === '_canonicalMeta')?.value || {};

    const variants = (product.variations || []).map((v: WooVariant) => {
      // Restore the stable canonical ID for this variant.
      const canonicalId = v.meta_data?.find(m => m.key === '_canonicalId')?.value || v.sku;
      const title = v.attributes.map(a => a.option).join(' / ');

      // Restore the full metadata object for this variant.
      const restoredVariantMeta: PlatformMeta = v.meta_data?.find(m => m.key === '_canonicalVariantMeta')?.value || {};

      return {
        canonicalId,
        title,
        price: parseFloat(v.price),
        sku: v.sku,
        inventory: v.stock_quantity,
        meta: {
          ...restoredVariantMeta, // Restore previous meta (e.g., from Shopify)
          woo: { id: v.id },      // Add or update Woo-specific meta
        },
      };
    });

    return {
      // Use the ID from the original source platform if available, otherwise use Woo's ID.
      id: restoredMeta.shopify?.id?.toString() || product.id?.toString(),
      title: product.name,
      description: product.description,
      images: product.images,
      meta: {
        ...restoredMeta,         // Restore previous platform metadata
        woo: { id: product.id }, // Add or update Woo-specific metadata
      },
      variants,
    };
  }

  /**
   * Converts a Canonical Product into the WooCommerce product model.
   * It saves the canonical ID and the entire metadata object for future conversions.
   */
  toPlatform(product: CanonicalProduct): WooProduct {
    const variations = product.variants.map(v => ({
      // Use the Woo-specific ID if it exists in the meta.
      id: v.meta?.woo?.id as number,
      sku: v.sku,
      price: v.price.toString(),
      stock_quantity: v.inventory,
      // This is a simplification; a real implementation might need more robust attribute mapping.
      attributes: v.title.split(' / ').map(t => ({ name: 'Option', option: t.trim() })),
      meta_data: [
        // Persist the stable canonical ID.
        { key: '_canonicalId', value: v.canonicalId },
        // **KEY LOGIC**: Persist the ENTIRE variant meta object for the next step in the chain.
        { key: '_canonicalVariantMeta', value: v.meta }
      ],
    }));

    return {
      id: product.meta?.woo?.id as number,
      name: product.title,
      description: product.description,
      images: product.images,
      variations,
      // Persist the top-level product metadata.
      meta_data: [
        { key: '_canonicalMeta', value: product.meta }
      ]
    };
  }
}