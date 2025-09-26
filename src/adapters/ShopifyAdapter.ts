// src/adapters/ShopifyAdapter.ts

import { Adapter } from "./Adapter";
import { CanonicalProduct } from "../models/CanonicalProduct";
import { ShopifyProduct, ShopifyVariant } from "./types";
import { v4 as uuidv4 } from 'uuid';

export class ShopifyAdapter implements Adapter<ShopifyProduct> {
  fromPlatform(product: ShopifyProduct): CanonicalProduct {
    return {
      id: product.id,
      title: product.title,
      description: product.body_html,
      images: product.images,
      meta: {
        shopify: { id: product.id },
      },
      variants: product.variants.map((v: ShopifyVariant) => ({
        canonicalId: uuidv4(), // Generate a new stable ID
        title: v.title,
        price: parseFloat(v.price),
        sku: v.sku,
        inventory: v.inventory_quantity,
        meta: {
          shopify: { id: v.id },
        },
      })),
    };
  }

  toPlatform(product: CanonicalProduct): ShopifyProduct {
    return {
      id: product.meta?.shopify?.id?.toString() || product.id || "",
      title: product.title,
      body_html: product.description,
      images: product.images,
      variants: product.variants.map(v => ({
        id: v.meta?.shopify?.id?.toString() || "",
        title: v.title,
        price: v.price.toString(),
        sku: v.sku,
        inventory_quantity: v.inventory,
      })),
    };
  }
}