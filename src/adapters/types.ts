// src/adapters/types.ts

// --------------- Shopify ---------------
export interface ShopifyImage {
  id?: number;
  src: string;
  alt?: string;
  position?: number;
}

export interface ShopifyProductOption {
    name: string;
    values: string[];
}

export interface ShopifyVariant {
  id?: string;
  title: string;
  price: string;
  compare_at_price?: string;
  sku: string;
  inventory_quantity: number;
  taxable?: boolean;
  requires_shipping?: boolean;
  imageSrc?: string;
  image?: ShopifyImage;
  inventory_management?: 'shopify' | null;
  inventory_policy?: 'deny' | 'continue';
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}


export interface ShopifyProduct {
  id: string;
  title: string;
  body_html: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  // NEW: Add the top-level options array
  options?: ShopifyProductOption[];
  status?: 'active' | 'draft' | 'archived';
  tags?: string;
  vendor?: string;
  product_type?: string;
}


// --------------- WooCommerce ---------------
// Define a WooCommerce-specific image type
export interface WooImage {
  id: number;
  src: string;
  name: string;
  alt: string;
  position?: number; // Position is available on some endpoints
}

export interface WooCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WooTag {
  id: number;
  name: string;
  slug: string;
}

export interface WooAttribute {
    // id?: number;
    name: string;
    variation: boolean;
    visible: boolean;
    options: string[];
}

interface WooBaseProduct {
  id: number;
  name: string;
  description: string;
  short_description: string;
  images: WooImage[]; // Use the new Woo image type
  status: 'publish' | 'pending' | 'draft' | 'private';
  categories?: WooCategory[];
  tags?: WooTag[];
  sku: string;
  virtual?: boolean;
  shipping_required?: boolean;
  tax_status?: 'taxable' | 'shipping' | 'none';
  weight?: string;
  attributes?: WooAttribute[];
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  meta_data?: { key: string; value: any }[];
}

/**
 * Represents a WooCommerce 'simple' product with price/SKU at the top level.
 */
export interface WooSimpleProduct extends WooBaseProduct {
  type: 'simple';
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
}


/**
 * Represents a WooCommerce 'variable' product with child variations.
 */
export interface WooVariableProduct extends WooBaseProduct {
  type: 'variable';
  attributes: WooAttribute[];
  variations: WooVariant[];
}

/**
 * A discriminated union to safely handle both simple and variable WooCommerce products.
 */
export type WooProduct = WooSimpleProduct | WooVariableProduct | WooGroupedProduct | WooExternalProduct;

// Add placeholder interfaces for the new types. We only need their 'type' property for filtering.
export interface WooGroupedProduct extends WooBaseProduct {
    type: 'grouped';
}

export interface WooExternalProduct extends WooBaseProduct {
    type: 'external';
}
/**
 * Represents a single WooCommerce product variation.
 * Field names are corrected to match the WooCommerce API.
 */
export interface WooVariant {
  id: number;
  sku: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  attributes: { name: string; option: string }[];
  image?: WooImage; // <-- ADD THIS LINE
  meta_data?: { key: string; value: any }[];
}
// --------------- eBay ---------------
export interface EbayInventoryItem {
  sku: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
  };
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  condition: "NEW"; // Or other condition types
}

/**
 * Represents an offer associated with an inventory item, containing the price.
 */
export interface EbayOfferDetails {
  sku: string;
  pricingSummary: {
    price: {
      value: string;
      currency: string;
    };
  };
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
}

/**
 * Represents a group of inventory items (a "variable" product).
 * This is the direct equivalent of a WooCommerce 'variable' product.
 */
export interface EbayInventoryItemGroup {
  inventoryItemGroupKey: string;
  title: string;
  description: string;
  imageUrls: string[];
  variantSKUs: string[];
  offers?: EbayOfferDetails[];
}

/**
 * The main union type representing any eBay product, simple or variable.
 */
export type EbayProduct = EbayInventoryItem | EbayInventoryItemGroup;