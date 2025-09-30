// src/models/CanonicalProduct.ts

export interface PlatformMeta {
  [key: string]: any;
}

// Define a richer, universal image model
export interface CanonicalImage {
  id?: number | string;
  src: string;
  alt?: string;
  position?: number;
}

export interface CanonicalAttribute {
  name: string;
  value: string;
}

export interface CanonicalVariant {
  canonicalId: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  attributes?: CanonicalAttribute[],
  sku: string;
  inventory: number | null;
  manageStock?: boolean;
  taxable?: boolean;
  image?: CanonicalImage;
  requiresShipping?: boolean;
  weight?: number;
  imageId?: number | string | null; // <-- ADD THIS LINE
  imageSrc?: string | null; // <-- ADD THIS LINE
  meta?: PlatformMeta;
}

// Define a universal structure for a product option (like "Color")
export interface CanonicalProductOption {
  name: string;
  values: string[];
}

export interface CanonicalProduct {
  id: string;
  title: string;
  description: string;
  images: CanonicalImage[];
  // NEW: Add a property to hold the product-level options
  options?: CanonicalProductOption[];
  productType?: string;
  status?: string;
  tags?: string[];
  variants: CanonicalVariant[];
  meta?: PlatformMeta;
}