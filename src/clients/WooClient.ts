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
      const product = products[0];
      if (product.type === 'variable' && product.variations.length > 0) {
        console.log(`[Client] Fetching variations for product SKU: ${sku}`);
        const variations = await this._request<WooVariant[]>(`products/${product.id}/variations`, { per_page: '100' });
        product.variations = variations;
      }
      return product;
    }
    return null;
  }

  // --- Placeholders for methods to be implemented later ---

  createProduct(product: WooProduct): Promise<WooProduct> {
    throw new Error('Method not implemented.');
  }

  updateProduct(id: string | number, product: WooProduct): Promise<WooProduct> {
    throw new Error('Method not implemented.');
  }


  // --- Private Helper Methods ---

  /**
   * A centralized request method that handles API calls, authentication, and error handling.
   * @template T The expected type of the response data.
   * @param endpoint The API endpoint to call (e.g., 'products').
   * @param params Optional query parameters to add to the request.
   */
  private async _request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = this._buildUrl(endpoint, params);

    const response = await fetch(url);

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