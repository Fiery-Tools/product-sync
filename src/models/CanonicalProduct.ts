// src/models/CanonicalProduct.ts

/**
 * A flexible object to store platform-specific identifiers and metadata.
 * The key is the platform name (e.g., 'shopify', 'woo', 'ebay').
 */
export interface PlatformMeta {
  [platform: string]: {
    id?: string | number;
    sku?: string; // For platforms like eBay where SKU can differ
    [key: string]: any; // Allows for other platform-specific data
  };
}

/**
 * The canonical model for a single product variant.
 */
export interface CanonicalVariant {
  canonicalId: string; // **NEW**: A stable, internal-only ID generated once.
  title: string;
  price: number;
  sku: string;
  inventory: number;
  meta: PlatformMeta; // **NEW**: Stores platform-specific IDs and data.
}

/**
 * The canonical model for a product.
 */
export interface CanonicalProduct {
  id?: string; // The ID from the original source platform.
  title: string;
  description: string;
  images: { src: string }[];
  variants: CanonicalVariant[];
  meta: PlatformMeta; // Stores platform-specific data for the parent product.
}