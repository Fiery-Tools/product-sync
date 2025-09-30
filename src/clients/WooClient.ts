// src/clients/WooClient.ts

import { Client } from './Client';
import { WooProduct, WooVariableProduct, WooVariant } from '../adapters/types';

/**
 * The required configuration object for instantiating the WooCommerceClient.
 */
export interface WooCommerceClientConfig {
  storeUrl: string; // The base URL of the WordPress site, e.g., 'https://example.com'
  consumerKey: string;
  consumerSecret: string;
  apiVersion?: string;
}

/**
 * A client for interacting with the WooCommerce REST API.
 * It handles pagination for fetching all products and provides helper methods.
 */
export class WooCommerceClient implements Client<WooProduct> {
  private config: WooCommerceClientConfig;
  private apiVersion: string;
  private apiBaseUrl: string;

  constructor(config: WooCommerceClientConfig) {
    // Basic validation to ensure the URL is clean
    if (config.storeUrl.endsWith('/')) {
      config.storeUrl = config.storeUrl.slice(0, -1);
    }
    this.config = config;
    this.apiVersion = config.apiVersion || 'v3';
    this.apiBaseUrl = `${this.config.storeUrl}/wp-json/wc/${this.apiVersion}`;
  }

  /**
  * Fetches the entire product catalog from WooCommerce, automatically handling pagination
  * and enriching variable products with their full variation data.
  * @returns A promise that resolves to an array of all WooProduct objects.
  */
  async getAllProducts(): Promise<WooProduct[]> {
    const allProducts: WooProduct[] = [];
    let page = 1;
    const perPage = 100; // The maximum allowed by WooCommerce for efficiency

    console.log('[Client] Starting to fetch all products from WooCommerce...');

    while (true) {
      console.log(`[Client] Fetching page ${page}...`);

      const params = {
        page: page.toString(),
        per_page: perPage.toString(),
      };

      const productsOnPage = await this._request<WooProduct[]>('products', params);

      if (productsOnPage.length === 0) {
        // No more products, we've reached the last page.
        break;
      }

      // Identify variable products and create promises to fetch their variations
      const variationPromises = productsOnPage
        .filter((p): p is WooVariableProduct => p.type === 'variable' && p.variations.length > 0)
        .map(async (product) => { // 'product' is now correctly inferred as WooVariableProduct
          console.log(`[Client] Fetching variations for product ID: ${product.id}`);
          const variations = await this._request<WooVariant[]>(`products/${product.id}/variations`, { per_page: '100' });
          // Replace the array of IDs with the full variation data
          product.variations = variations;
        });

      // Wait for all variation requests on the current page to complete
      await Promise.all(variationPromises);

      allProducts.push(...productsOnPage);
      page++;
    }

    console.log(`[Client] Finished fetching. Found a total of ${allProducts.length} products.`);
    return allProducts;
  }

  /**
   * A helpful method to find a single product by its SKU.
   * @param sku The SKU to search for.
   * @returns The WooProduct if found, otherwise null.
   */
  async getProductBySku(sku: string): Promise<WooProduct | null> {
    const products = await this._request<WooProduct[]>('products', { sku });
    if (products.length > 0) {
      // If the found product is variable, we should fetch its variations as well
      const product: any = products[0];

      if (['variable', 'variation'].includes(product.type)) {
        let productId = product.type === 'variation' ? product.parent_id : product.id
        console.log(`[Client] Fetching variations for product SKU: ${sku}`);
        const variations = await this._request<WooVariant[]>(`products/${productId}/variations`, { per_page: '100' });
        product.variations = variations;
      }
      return product;
    }
    return null;
  }

  // --- Placeholders for methods to be implemented later ---

  async createProduct(product: WooProduct): Promise<WooProduct> {
    // Check if the product is a variable product that has variations.
    if (product.type === 'variable' && 'variations' in product && Array.isArray(product.variations) && product.variations.length > 0) {
      // --- Start: Two-Step Process for Variable Products ---

      // Type guard to ensure we are working with a variable product structure.
      const variableProduct = product as WooVariableProduct;

      // Store the variations temporarily. We will create them in the second step.
      const variationsToCreate = [...variableProduct.variations];

      // Create a payload for the parent product by removing the 'variations' key.
      const { variations, ...parentProductPayload } = variableProduct;

      // Step 1: Create the parent product with its attributes but WITHOUT variations.
      console.log('[Client] Step 1: Creating parent variable product...');
      const createdParentProduct = await this._request<WooVariableProduct>('products', {}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parentProductPayload),
      });
      console.log(`[Client] Parent product created successfully with ID: ${createdParentProduct.id}`);

      // Step 2: Use the new product ID to batch-create its variations.
      if (createdParentProduct.id && variationsToCreate.length > 0) {
        console.log(`[Client] Step 2: Batch-creating ${variationsToCreate.length} variations for product ID ${createdParentProduct.id}...`);

        // The batch endpoint expects a payload with a 'create' key.
        const batchPayload = {
          create: variationsToCreate,
        };

        const batchResponse = await this._request<{ create: WooVariant[] }>(`products/${createdParentProduct.id}/variations/batch`, {}, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchPayload),
        });
        console.log('[Client] Variations created successfully.');

        // Attach the newly created variations (with their new IDs) to the parent product object.
        createdParentProduct.variations = batchResponse.create;
      }

      return createdParentProduct;
      // --- End: Two-Step Process ---

    } else {
      // For simple products (or variable products without variations), use the original single-step process.
      console.log('[Client] Creating a simple product...');
      return this._request<WooProduct>('products', {}, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });
    }
  }



  async syncProducts(
    products: WooProduct[]
  ): Promise<{ created: number; updated: number, skipped: number }> {
    const results = { created: 0, updated: 0, skipped: 0 };

    for (const product of products) {
      let skuToCheck: string | undefined;

      if (product.type === 'simple') {
        skuToCheck = product.sku;
      } else if (product.type === 'variable' && product.variations.length > 0) {
        skuToCheck = product.variations[0].sku;
      }

      if (!skuToCheck) {
        console.warn(`- Skipping product "${product.name}" because no valid SKU could be found.`);
        results.skipped++;
        continue;
      }

      const existingProduct: any = await this.getProductBySku(skuToCheck);

      if (existingProduct && 'variations' in product) {
        console.log(`- Updating product "${product.name}" (found via SKU: ${skuToCheck}, updating ID: ${existingProduct.id})...`);
        // We need to pass the full product object to update all its details and variations.
        await this.updateVariations(existingProduct, product.variations);
        results.updated++;
      } else {
        console.log(`- Creating new product "${product.name}" (could not find by SKU: ${skuToCheck})...`);
        let response = await this.createProduct(product);
        results.created++;
      }
    }

    return results
  }

  async updateVariations(oldProduct: any, variants: any): Promise<any> {
    for (let variation of oldProduct.variations) {
      for (let variant of variants) {
        if (variation.sku === variant.sku) {
          variant.id = variation.id
        }
      }
    }

    const batchPayload = { update: variants };
    let productId = oldProduct.type === 'variation' ? oldProduct.parent_id : oldProduct.id

    const response = await this._request<{ update: WooVariant[] }>(`products/${productId}/variations/batch`, {}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchPayload),
    });

    // Return a new product object with the updated variations
    return response
  }

  async updateProduct(id: string | number, product: WooProduct): Promise<WooProduct> {
    throw new Error('not implemented')
  }


  // --- Private Helper Methods ---

  /**
   * A centralized request method that handles API calls, authentication, and error handling.
   * @template T The expected type of the response data.
   * @param endpoint The API endpoint to call (e.g., 'products').
   * @param params Optional query parameters to add to the request.
   */
  private async _request<T>(endpoint: string, params: Record<string, string> = {}, options: RequestInit = {}): Promise<T> {
    const url = this._buildUrl(endpoint, params);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WooCommerce API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Constructs the full, authenticated URL for a given API endpoint and parameters.
   */
  private _buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.apiBaseUrl}/${endpoint}`);

    // Add all provided parameters to the search query
    for (const key in params) {
      url.searchParams.append(key, params[key]);
    }

    // Add WooCommerce authentication parameters
    url.searchParams.append('consumer_key', this.config.consumerKey);
    url.searchParams.append('consumer_secret', this.config.consumerSecret);

    return url.toString();
  }
}
