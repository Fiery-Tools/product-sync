import { Client } from './Client';
import { ShopifyProduct, ShopifyVariant } from '../adapters/types';

/**
 * The required configuration object for instantiating the ShopifyClient.
 */
export interface ShopifyClientConfig {
  storeUrl: string;
  accessToken: string;
  defaultLocationId?: string;
  apiVersion?: string;
}

/**
 * A richer data structure for the internal map of existing variants.
 */
type ExistingVariantData = {
  productId: string;
  variantId: string;
  price: string;
  inventory: number;
  inventoryItemId: string; // <-- THE KEY ADDITION
};

/**
 * A client for interacting with the Shopify Admin API.
 * It handles efficient bulk synchronization of products.
 */
export class ShopifyClient implements Client<ShopifyProduct> {
  private config: ShopifyClientConfig;
  private accessToken: string;
  private readonly apiVersion: string;
  private readonly locationGid: string | null;

  constructor(config: ShopifyClientConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || '2024-07';
    this.locationGid = config.defaultLocationId ? `gid://shopify/Location/${config.defaultLocationId}` : null;
  }

  async getAllProducts(): Promise<ShopifyProduct[]> {
    const query = `
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              bodyHtml
              images(first: 10) { edges { node { src } } }
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }`;

    const response = await this._request('graphql.json', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });

    // The response needs to be flattened from the GraphQL structure
    return this._flattenProducts(response.data.products);
  }
  /**
   * The primary method for synchronization. It accepts an array of complete ShopifyProduct objects.
   * It will intelligently create or update each product in the array.
   *
   * @param products The array of complete ShopifyProduct objects to sync.
   */
  async syncProducts(
    products: ShopifyProduct[]
  ): Promise<{ created: ShopifyProduct[]; updated: any[] }> {
    if (products.length === 0) return { created: [], updated: [] };
    console.log(`[Client] Starting sync for ${products.length} products.`);

    const allSkus = products.flatMap(p => p.variants.map(v => v.sku));
    if (allSkus.length === 0) {
      console.log('[Client] No variants with SKUs found to sync.');
      return { created: [], updated: [] };
    }
    const existingVariantsMap = await this._findProductsBySkus(allSkus);

    const productsToCreate: ShopifyProduct[] = [];
    const productsToUpdate: ShopifyProduct[] = [];
    for (const product of products) {
      const hasExistingVariant = product.variants.some(v => existingVariantsMap.has(v.sku));
      if (hasExistingVariant) {
        productsToUpdate.push(product);
      } else {
        productsToCreate.push(product);
      }
    }

    const createPromises = productsToCreate.map(product => this.createProduct(product));
    const updatePromises = productsToUpdate.map(product => this._updateSingleProduct(product, existingVariantsMap));
    const createdResults = await Promise.all(createPromises);
    const updatedResults = await Promise.all(updatePromises);
    console.log('[Client] Sync complete.');
    return { created: createdResults, updated: updatedResults.flat() };
  }

  /**
   * A private helper to update a single product.
   */
  private async _updateSingleProduct(
    product: ShopifyProduct,
    existingVariantsMap: Map<string, ExistingVariantData>
  ): Promise<any[]> {
    const variantsToUpdate: (ExistingVariantData & { newPrice: string, newInventory: number })[] = [];
    const variantsToCreate: ShopifyVariant[] = [];
    let existingProductId: string | null = null;
    let unchangedVariantCount = 0;

    for (const variant of product.variants) {
      const existing = existingVariantsMap.get(variant.sku);
      if (existing) {
        if (!existingProductId) existingProductId = existing.productId;
        const priceHasChanged = Number(existing.price) !== Number(variant.price);
        const inventoryHasChanged = existing.inventory !== variant.inventory_quantity;
        if (priceHasChanged || inventoryHasChanged) {
          variantsToUpdate.push({ ...existing, newPrice: variant.price, newInventory: variant.inventory_quantity });
        } else {
          unchangedVariantCount++;
        }
      } else {
        variantsToCreate.push(variant);
      }
    }

    if (!existingProductId && (variantsToUpdate.length > 0 || variantsToCreate.length > 0)) {
      throw new Error(`Could not determine parent product ID for "${product.title}".`);
    }
    if (unchangedVariantCount > 0) {
      console.log(`   - Found ${unchangedVariantCount} variants with no changes for "${product.title}".`);
    }

    const operations: Promise<any>[] = [];
    if (variantsToUpdate.length > 0) {
      operations.push(this.updatePriceAndInventory(variantsToUpdate));
    }
    if (variantsToCreate.length > 0) {
      operations.push(this.addVariantsToProduct(existingProductId!, variantsToCreate));
    }
    if (operations.length === 0) {
      console.log(`[Client] -> No effective changes needed for "${product.title}". Skipping update.`);
    }
    return Promise.all(operations);
  }

 async updatePriceAndInventory(
    updates: (ExistingVariantData & { newPrice: string, newInventory: number })[]
  ): Promise<any[]> {
    const operations: Promise<any>[] = [];

    // --- Price Update using REST API (JSON) ---
    const priceUpdates = updates.filter(u => u.price !== u.newPrice);
    if (priceUpdates.length > 0) {
      console.log(`   - Preparing ${priceUpdates.length} variants for price update via REST API.`);
      const pricePromises = priceUpdates.map(u => {
        const variantId = u.variantId.split('/').pop();
        const endpoint = `variants/${variantId}.json`;
        const payload = {
          variant: {
            id: variantId,
            price: u.newPrice,
          },
        };
        return this._request(endpoint, { method: 'PUT', body: JSON.stringify(payload) });
      });
      operations.push(...pricePromises);
    }

    // --- Inventory Update using GraphQL (this part was correct) ---
    const inventoryUpdates = updates.filter(u => u.inventory !== u.newInventory);
    if (inventoryUpdates.length > 0) {
      if (!this.locationGid) throw new Error("A defaultLocationId is required for inventory updates.");
      const inventoryMutations = inventoryUpdates.map((u, index) => `
        inventoryUpdate${index}: inventorySetOnHandQuantities(input: {inventoryLevels: {inventoryItemId: "${u.inventoryItemId}", locationId: "${this.locationGid}", availableQuantity: ${u.newInventory}}, reason: "correction", setAsUntracked: false}) {
          inventoryAdjustmentGroup { id }
          userErrors { field, message }
        }
      `).join('\n');

      const inventoryQuery = `mutation inventorySetQuantities {\n${inventoryMutations}\n}`;
      console.log(`   - Preparing ${inventoryUpdates.length} variants for inventory update via GraphQL.`);
      operations.push(this._request('graphql.json', { method: 'POST', body: JSON.stringify({ query: inventoryQuery }) }));
    }

    return Promise.all(operations);
  }

  // --- Core API Methods ---

  async createProduct(product: Partial<ShopifyProduct>): Promise<ShopifyProduct> {
    const response = await this._request('products.json', {
      method: 'POST',
      body: JSON.stringify({ product }),
    });
    return response.product;
  }

  async updateProduct(id: string, product: Partial<ShopifyProduct>): Promise<ShopifyProduct> {
    const numericId = id.split('/').pop();
    if (!numericId) {
      throw new Error(`Could not parse a numeric ID from the provided product ID: ${id}`);
    }
    const response = await this._request(`products/${numericId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ product }),
    });
    return response.product;
  }

  async addVariantsToProduct(productId: string, variants: ShopifyVariant[]): Promise<ShopifyVariant[]> {
    const numericId = productId.split('/').pop();
    const createdVariants: ShopifyVariant[] = [];
    for (const variant of variants) {
      const response = await this._request(`products/${numericId}/variants.json`, {
        method: 'POST',
        body: JSON.stringify({ variant }),
      });
      createdVariants.push(response.variant);
    }
    return createdVariants;
  }

  async updateInventoryAndPrice(updates: { variantId: string; price: string; inventory: number }[]): Promise<any> {
    if (!this.locationGid) {
      throw new Error("A defaultLocationId is required for inventory updates.");
    }
    const mutations = updates.map((u, index) => `
      productVariantUpdate${index}: productVariantUpdate(input: {id: "gid://shopify/ProductVariant/${u.variantId}", price: "${u.price}", inventoryQuantities: {availableQuantity: ${u.inventory}, locationId: "${this.locationGid}"}}) {
        productVariant { id, price, inventoryQuantity }
        userErrors { field, message }
      }
    `).join('\n');

    const query = `mutation {\n${mutations}\n}`;
    const response = await this._request('graphql.json', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return response.data;
  }

  // --- Private Internal Methods ---

  private async _findProductsBySkus(skus: string[]): Promise<Map<string, ExistingVariantData>> {
    const queryFilter = skus.map(sku => `sku:'${sku.replace(/'/g, "\\'")}'`).join(' OR ');
    const query = `
      query($filter: String!) {
        products(first: ${skus.length}, query: $filter) {
          edges {
            node {
              id
              variants(first: 250) {
                edges {
                  node {
                    id
                    sku
                    price
                    inventoryQuantity
                    inventoryItem { id }
                  }
                }
              }
            }
          }
        }
      }`;
    const variables = { filter: queryFilter };
    const response = await this._request('graphql.json', { method: 'POST', body: JSON.stringify({ query, variables }) });
    const resultMap = new Map<string, ExistingVariantData>();
    if (response.data.products.edges.length > 0) {
      for (const productEdge of response.data.products.edges) {
        for (const variantEdge of productEdge.node.variants.edges) {
          const variantNode = variantEdge.node;
          if (skus.includes(variantNode.sku)) {
            resultMap.set(variantNode.sku, {
              productId: productEdge.node.id,
              variantId: variantNode.id,
              price: variantNode.price,
              inventory: variantNode.inventoryQuantity,
              inventoryItemId: variantNode.inventoryItem.id, // <-- Store the inventoryItemId
            });
          }
        }
      }
    }
    return resultMap;
  }

  private async _request(endpoint: string, options: RequestInit): Promise<any> {
    const url = `https://${this.config.storeUrl}/admin/api/${this.apiVersion}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.accessToken,
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Shopify API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    return response.json();
  }


  private _flattenProducts(data: any): ShopifyProduct[] {
    return data.edges.map((edge: any) => ({
      ...edge.node,
      // Also flatten nested images and variants
      images: edge.node.images.edges.map((imgEdge: any) => imgEdge.node),
      variants: edge.node.variants.edges.map((varEdge: any) => varEdge.node),
    }));
  }
}