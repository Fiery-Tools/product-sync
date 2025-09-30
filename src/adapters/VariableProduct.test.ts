// src/adapters/VariableProduct.test.ts
import * as fs from 'fs';

import { WooAdapter } from './WooAdapter';
import { ShopifyAdapter } from './ShopifyAdapter';
import { WooVariableProduct } from './types';
import { CanonicalProduct } from '../models/CanonicalProduct';

export const mockHydratedProduct: WooVariableProduct = JSON.parse("" + fs.readFileSync('payloads/woo-variable-product.json'))

describe('WooCommerce to Shopify Conversion for Variable Products', () => {
  const wooAdapter = new WooAdapter();
  const shopifyAdapter = new ShopifyAdapter();

  // we need to use the payload I gave you for the test


  it('should correctly convert a variable WooCommerce product to a Shopify product', () => {
    const canonicalProduct = wooAdapter.fromPlatform(mockHydratedProduct);
    if (canonicalProduct) {
      const shopifyProduct = shopifyAdapter.toPlatform(canonicalProduct);

      // Assertions for main product
      expect(shopifyProduct.title).toBe('Hoodie');
      expect(shopifyProduct.variants).toHaveLength(4); // This will now pass

      // Verify parent SKU was captured
      expect(canonicalProduct.meta?.woo?.parentSku).toBe('woo-hoodie');

      // Assertions for variants will now pass
      const firstVariant = shopifyProduct.variants[0];
      const secondVariant = shopifyProduct.variants[1];

      expect(firstVariant.sku).toBe('woo-hoodie-blue-logo');
      expect(secondVariant.sku).toBe('woo-hoodie-blue');
      expect(secondVariant.price).toBe('45');
      expect(secondVariant.price).toBe('45');
    }

  });
});