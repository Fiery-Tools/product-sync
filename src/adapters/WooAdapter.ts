// src/adapters/WooAdapter.ts
import { Adapter } from "./Adapter";
import { CanonicalProduct, CanonicalVariant, PlatformMeta } from "../models/CanonicalProduct";
import { WooProduct, WooVariant, WooSimpleProduct, WooVariableProduct } from "./types";
import path from "path";

/**
 * Adapter for converting between the CanonicalProduct model and the WooCommerce product model.
 *
 * This adapter intelligently handles the difference between 'simple' and 'variable'
 * WooCommerce products. It persists the `productType` in the canonical metadata to ensure
 * that a product's original intent is never lost during round-trip synchronization.
 */
export class WooAdapter implements Adapter<WooProduct> {
  /**
   * Converts a WooCommerce product (simple or variable) into the Canonical Product model.
   * It stores the original WooCommerce product type in the metadata.
   */

  fromPlatform(product: WooProduct): CanonicalProduct | null {
    if (product.type === 'grouped' || product.type === 'external') {
      console.warn(
        `[WooAdapter] Skipping unsupported product type "${product.type}" for product ID: ${product.id} (Name: "${product.name}").`
      );
      return null; // Signal that this product should be ignored.
    }

    const restoredMeta: PlatformMeta = product.meta_data?.find(m => m.key === '_canonicalMeta')?.value || {};
    let variants: CanonicalVariant[];

    const description = product.description || "";
    const shortDescription = product.short_description || "";
    const fullDescription = shortDescription ? `${description}\n${shortDescription}` : description;

    // *** THIS IS THE CRUCIAL LOGIC THAT WAS ACCIDENTALLY OMITTED ***
    if (product.type === 'simple') {
      let inventory = product.stock_quantity;
      if (inventory === null && product.stock_status === 'instock') {
        inventory = 1; // Default to 1 if in stock but not managed
      }
      variants = [{
        canonicalId: product.sku || `woo-${product.id}`,
        title: 'Default Title',
        price: parseFloat(product.sale_price || product.regular_price),
        compareAtPrice: product.sale_price ? parseFloat(product.regular_price) : undefined,
        sku: product.sku,
        inventory,
        requiresShipping: product.shipping_required,
        taxable: product.tax_status === 'taxable',
        meta: { woo: { id: product.id } },
      }];
    } else {
      // For a 'variable' product, map each variation to a canonical variant.
      variants = (product.variations || []).map((v: WooVariant) => {
        const canonicalId = v.meta_data?.find(m => m.key === '_canonicalId')?.value || v.sku;
        const restoredVariantMeta: PlatformMeta = v.meta_data?.find(m => m.key === '_canonicalVariantMeta')?.value || {};
        const title = v.attributes.map(a => a.option).join(' / ');

        let inventory = v.stock_quantity;
        if (inventory === null && v.stock_status === 'instock') {
          inventory = 1; // Default to 1 if in stock but not managed
        }
        return {
          canonicalId,
          title,
          price: parseFloat(v.sale_price || v.regular_price),
          compareAtPrice: v.sale_price ? parseFloat(v.regular_price) : undefined,
          sku: v.sku,
          image: v.image,
          inventory,
          manageStock: v.manage_stock, // NEW: Pass the flag to the canonical model

          requiresShipping: product.shipping_required,
          taxable: product.tax_status === 'taxable',
          meta: { ...restoredVariantMeta, woo: { id: v.id } },
        };
      });
    }
    // *** END OF CRUCIAL LOGIC ***

    return {
      id: restoredMeta.shopify?.id?.toString() || product.id.toString(),
      title: product.name,
      description: fullDescription,
      images: product.images.map(img => ({
        id: img.id,
        src: img.src,
        alt: img.alt || '',
      })),
      productType: product.categories?.[0]?.name,
      status: product.status,
      tags: product.tags?.map(t => t.name),
      options: product.attributes
        ?.filter(attr => attr.variation) // Only use attributes for variations
        .map(attr => ({
          name: attr.name,
          values: attr.options,
        })),
      meta: {
        ...restoredMeta,
        woo: {
          id: product.id,
          productType: product.type,
          parentSku: product.type === 'variable' ? product.sku : undefined,
        },
      },
      variants, // This array is now correctly populated
    };
  }

  toPlatform(product: CanonicalProduct): WooProduct {
    const productMeta = { key: '_canonicalMeta', value: product.meta };
    const mustBeVariable = product.meta?.woo?.productType === 'variable';
    const isSimple = product.variants.length === 1 && !mustBeVariable;

    const baseProperties = {
      id: product.meta?.woo?.id as number,
      name: product.title,
      description: product.description,
      short_description: '',
      images: product.images.map(img => ({
        id: img.id as number,
        src: img.src,
        name: path.basename(img.src),
        alt: img.alt || '',
      })),
      status: (product.status === 'active' ? 'publish' : 'draft') as 'publish' | 'draft',
      categories: product.productType ? [{ id: 0, name: product.productType, slug: product.productType.toLowerCase() }] : [],
      tags: product.tags ? product.tags.map(t => ({ id: 0, name: t, slug: t.toLowerCase() })) : [],
      virtual: !(product.variants[0]?.requiresShipping ?? true),
      shipping_required: product.variants[0]?.requiresShipping ?? true,
      tax_status: (product.variants[0]?.taxable ?? true) ? 'taxable' : 'none' as 'taxable' | 'none',
      weight: '',
      meta_data: [productMeta],
    };

    if (isSimple) {
      const variant = product.variants[0];
      const simpleProduct: WooSimpleProduct = {
        ...baseProperties,
        type: 'simple',
        sku: variant.sku,

        regular_price: (variant.compareAtPrice || variant.price).toString(),
        sale_price: variant.compareAtPrice ? variant.price.toString() : '',
        stock_quantity: variant.inventory,
      };
      return simpleProduct;
    }

    const variations: WooVariant[] = product.variants.map(v => ({
      id: v.meta?.woo?.id as number,
      sku: v.sku,
      regular_price: (v.compareAtPrice || v.price).toString(),
      sale_price: v.compareAtPrice ? v.price.toString() : '',
            manage_stock: v.manageStock ?? false, // Default to false if undefined

      stock_quantity: v.inventory,
      attributes: v.title.split(' / ').map(t => ({ name: 'Option', option: t.trim() })),
      meta_data: [
        { key: '_canonicalId', value: v.canonicalId },
        { key: '_canonicalVariantMeta', value: v.meta },
      ],
    }));

    const variableProduct: WooVariableProduct = {
      ...baseProperties,
      type: 'variable',
      variations,
      sku: product.meta?.woo?.parentSku,
    };
    return variableProduct;
  }
}