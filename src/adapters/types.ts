// src/adapters/types.ts

// --------------- Shopify ---------------
export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  body_html: string;
  variants: ShopifyVariant[];
  images: { src: string }[];
}


// --------------- WooCommerce ---------------
export interface WooVariant {
  id: number;
  sku: string;
  price: string;
  stock_quantity: number;
  attributes: { name: string; option: string }[];
  meta_data?: { key: string; value: any }[];
}

export interface WooProduct {
  id: number;
  name: string;
  description: string;
  variations: WooVariant[];
  images: { src: string }[];
  meta_data?: { key: string; value: any }[]; // <--- ADD THIS LINE
}

// --------------- eBay ---------------
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

export interface EbayItemGroup {
  inventoryItemGroupKey: string;
  title: string;
  description: string;
  imageUrls: string[];
  variantSKUs: string[];
  offers?: EbayOfferDetails[];
}