// src/clients/Client.ts

/**
 * Defines the contract for a platform-specific API client.
 * A client is responsible for all communication with a platform's API,
 * including fetching and pushing data.
 *
 * @template T The platform-specific product type (e.g., ShopifyProduct, EbayProduct).
 */
export interface Client<T> {
  /**
   * Fetches the entire product catalog from the platform.
   * This method should handle all implementation details like pagination.
   */
  getAllProducts(): Promise<T[]>;

  /**
   * Creates a new product on the platform.
   * @param product The platform-specific product data to create.
   */
  createProduct(product: T): Promise<T>;

  /**
   * Updates an existing product on the platform.
   * @param id The ID of the product to update.
   * @param product The platform-specific product data to update.
   */
  updateProduct(id: string | number, product: T): Promise<T>;
}