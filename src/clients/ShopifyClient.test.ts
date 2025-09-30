// src/clients/ShopifyClient.test.ts

import { ShopifyClient, SyncPayload } from './ShopifyClient';
import { ShopifyProduct } from '../adapters/types';
import { WooAdapter } from '../adapters/WooAdapter';
import { ShopifyAdapter } from '../adapters/ShopifyAdapter';
import { mockHydratedProduct } from '../adapters/VariableProduct.test'; // Assuming you export this for re-use

// Helper function to bridge the gap between the adapter and the client
function transformToSyncPayloads(product: ShopifyProduct): SyncPayload[] {
  // Extract shared product details
  const productDetails = {
    title: product.title,
    body_html: product.body_html,
    vendor: product.vendor,
    product_type: product.product_type,
    tags: product.tags,
    images: product.images,
    options: product.options, // Pass options for creation
  };

  // Create a separate payload for each variant
  return product.variants.map(variant => ({
    sku: variant.sku,
    productDetails,
    variantDetails: {
      price: variant.price,
      inventory: variant.inventory_quantity,
      title: variant.title,
      // Pass the specific option values for creation
      option1: variant.option1,
      option2: variant.option2,
      option3: variant.option3,
    },
  }));
}


describe('ShopifyClient', () => {
  let client: ShopifyClient;
  let findProductsBySkusSpy: jest.SpyInstance;
  let updateInventoryAndPriceSpy: jest.SpyInstance;
  let createProductSpy: jest.SpyInstance;

  // Let's get a realistic, multi-variant ShopifyProduct to test with
  const wooAdapter = new WooAdapter();
  const shopifyAdapter = new ShopifyAdapter();
  const shopifyProduct = shopifyAdapter.toPlatform(wooAdapter.fromPlatform(mockHydratedProduct));
  const syncPayloads = transformToSyncPayloads(shopifyProduct);

  beforeEach(() => {
    // Instantiate the client with dummy credentials
    client = new ShopifyClient({
      storeUrl: process.env.SHOPIFY_STORE_URL!,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
      defaultLocationId: process.env.SHOPIFY_LOCATION_ID!,
    });

    // Mock the private/protected methods that make network calls
    // We are testing the logic of syncProducts, not the network layer itself.
    findProductsBySkusSpy = jest.spyOn(client as any, '_findProductsBySkus').mockResolvedValue(new Map());
    updateInventoryAndPriceSpy = jest.spyOn(client, 'updateInventoryAndPrice').mockResolvedValue({});
    createProductSpy = jest.spyOn(client, 'createProduct').mockImplementation(async (prod) => prod as ShopifyProduct);
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Clean up spies after each test
  });

  it('should create ONE new product with 4 variants when SKUs are not found', async () => {
        findProductsBySkusSpy.mockResolvedValue(new Map());

        const result = await client.syncProducts(syncPayloads);

        // Assert
        expect(findProductsBySkusSpy).toHaveBeenCalledWith(['woo-hoodie-blue-logo', 'woo-hoodie-blue', 'woo-hoodie-green', 'woo-hoodie-red']);

        // *** THE KEY CHANGE: We expect ONE call to create the product ***
        expect(createProductSpy).toHaveBeenCalledTimes(1);
        expect(updateInventoryAndPriceSpy).not.toHaveBeenCalled();

        // Check the payload of that single call
        const createPayload = createProductSpy.mock.calls[0][0];
        expect(createPayload.title).toBe('Hoodie');
        expect(createPayload.variants).toHaveLength(4); // It should contain all 4 variants

        expect(result.created).toHaveLength(1);
        expect(result.updated).toHaveLength(0);
    });

    it('should update 4 existing variants when their SKUs are found', async () => {
        const existingProductsMap = new Map([
            ['woo-hoodie-blue-logo', { variantId: 'gid://shopify/ProductVariant/101' }],
            ['woo-hoodie-blue', { variantId: 'gid://shopify/ProductVariant/102' }],
            ['woo-hoodie-green', { variantId: 'gid://shopify/ProductVariant/103' }],
            ['woo-hoodie-red', { variantId: 'gid://shopify/ProductVariant/104' }],
        ]);
        findProductsBySkusSpy.mockResolvedValue(existingProductsMap);

        await client.syncProducts(syncPayloads);

        // Assert
        expect(createProductSpy).not.toHaveBeenCalled();
        expect(updateInventoryAndPriceSpy).toHaveBeenCalledTimes(1);

        const updateCallArgs = updateInventoryAndPriceSpy.mock.calls[0][0];
        expect(updateCallArgs).toHaveLength(4); // It should bulk-update all 4 variants
    });

    it('should correctly create and update in a mixed scenario', async () => {
        // Arrange: one variant exists, three are new
        const existingProductsMap = new Map([
            ['woo-hoodie-blue', { variantId: 'gid://shopify/ProductVariant/102' }],
        ]);
        findProductsBySkusSpy.mockResolvedValue(existingProductsMap);

        const result = await client.syncProducts(syncPayloads);

        // Assert
        // It should update the 1 existing variant
        expect(updateInventoryAndPriceSpy).toHaveBeenCalledTimes(1);
        const updateCallArgs = updateInventoryAndPriceSpy.mock.calls[0][0];
        expect(updateCallArgs).toHaveLength(1);

        // It should create ONE new product containing the 3 missing variants
        expect(createProductSpy).toHaveBeenCalledTimes(1);
        const createPayload = createProductSpy.mock.calls[0][0];
        expect(createPayload.variants).toHaveLength(3);

        const createdSkus = createPayload.variants.map((v: any) => v.sku);
        expect(createdSkus).toContain('woo-hoodie-blue-logo');
        expect(createdSkus).toContain('woo-hoodie-green');
        expect(createdSkus).toContain('woo-hoodie-red');

        expect(result.created).toHaveLength(1);
    });
});