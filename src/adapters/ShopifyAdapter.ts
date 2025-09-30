// src/adapters/ShopifyAdapter.ts

import { Adapter } from "./Adapter";
import { CanonicalAttribute, CanonicalImage, CanonicalProduct, CanonicalProductOption } from "../models/CanonicalProduct";
import { ShopifyImage, ShopifyProduct, ShopifyVariant } from "./types";
import { v4 as uuidv4 } from 'uuid';

export class ShopifyAdapter implements Adapter<ShopifyProduct> {
  fromPlatform(product: ShopifyProduct): CanonicalProduct {


    let toProduct: CanonicalProduct = {
      id: product.id,
      title: product.title,
      description: product.body_html,
      images: product.images,
      productType: product.product_type,
      status: product.status,
      tags: product.tags?.split(',').map(t => t.trim()),
      meta: {
        shopify: { id: product.id },
      },
      variants: product.variants.map((v: ShopifyVariant) => {
        let attributes: CanonicalAttribute[] = []
        let options = product.options
        for(let i = 1; i<=3; i++){
          const key = `option${i}` as keyof ShopifyVariant; // Assert the key's type
          let optionName: any = v[key];
          if(optionName){
            attributes.push({
              name: options?.[i - 1]?.name || "Option",
              value: "" + v[key],
            })
          }
        }
        let variant = {
          canonicalId: uuidv4(), // Generate a new stable ID
          title: v.title,
          price: parseFloat(v.price),
          compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : undefined,
          sku: v.sku,
          attributes,
          image: v.image,
          inventory: v.inventory_quantity,
          requiresShipping: v.requires_shipping,
          taxable: v.taxable,
          meta: {
            shopify: { id: v.id },
          },
        }
        return variant
      }),
    };

    if (product.options) {
      let options: CanonicalProductOption[] = product.options?.map(option => ({
        name: option.name,
        values: option.values
      }))
      toProduct.options = options
    }


    return toProduct
  }

  toPlatform(product: CanonicalProduct): ShopifyProduct {

    let variants: ShopifyVariant[] = product.variants.map((v, i) => {
      // NEW: Split the variant title to populate option1, option2, etc.
      const optionValues = v.title.split(' / ').map(val => val.trim());
      let { options } = product

      let variant: ShopifyVariant = {
        id: v.meta?.shopify?.id?.toString() || "",
        title: v.title, // Shopify still uses the combined title internally
        price: v.price.toString(),
        compare_at_price: v.compareAtPrice?.toString(),
        sku: v.sku,
        inventory_quantity: v.inventory ?? 0,
        requires_shipping: v.requiresShipping,
        taxable: v.taxable,
        inventory_management: v.manageStock ? 'shopify' : null,
        inventory_policy: v.manageStock ? 'deny' : undefined,
        //'options' is possibly 'undefined'.
        option1: optionValues[0] || options?.[0]?.values[0] || null,
        option2: optionValues[1] || options?.[1]?.values[0] || null,
        option3: optionValues[2] || options?.[2]?.values[0] || null,
      };
      if (v.image) {
        let { id, src, alt, position } = v.image
        let image: ShopifyImage = {
          id: id as number | undefined,
          src, alt, position
        }
        variant.image = image
      }
      return variant
    })

    return {
      id: product.meta?.shopify?.id?.toString() || product.id || "",
      title: product.title,
      body_html: product.description,
      images: product.images.map(img => ({
        id: img.id as number | undefined, // Ensure type compatibility
        src: img.src,
        alt: img.alt,
        position: img.position,
      })),
      product_type: product.productType,
      options: product.options?.map(opt => ({
        name: opt.name,
        values: opt.values,
      })),
      status: product.status === 'publish' ? 'active' : 'draft', // Mapping status
      tags: product.tags?.join(', '), // Convert array to comma-separated string
      variants
    };
  }
}