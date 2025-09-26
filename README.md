# Cross-Platform Product Sync Library

A TypeScript library designed to reliably synchronize product data between different e-commerce platforms like Shopify, WooCommerce, and eBay. It uses a Canonical Product Model and an intelligent Adapter Pattern to prevent data loss and mutation during round-trip conversions.

![Built with TypeScript](https://img.shields.io/badge/built%20with-TypeScript-007ACC)

## The Core Problem

Syncing product data across e-commerce platforms is challenging because each platform has its own unique schema, identifiers, and rules. A naive mapping approach quickly leads to several critical issues:

-   **Variant ID Drift:** A variant's unique ID from one platform (e.g., Shopify) is often lost when syncing to another that doesn't have a direct equivalent, making it impossible to track that variant reliably.
-   **Data Mutation:** Platforms can add their own formatting or prefixes to data (e.g., WooCommerce adding "Variant:" to titles), which pollutes the clean, canonical data.
-   **Metadata Loss:** Platform-specific identifiers (like a WooCommerce variation ID or an eBay listing SKU) are overwritten at each step of a multi-platform sync, making it impossible to update the correct item on the source platform.
-   **Inaccurate Comparisons:** Simple object diffs fail because they incorrectly flag harmless identifier changes as meaningful data differences.

This library is designed to solve these problems.

## The Solution: Core Concepts

The architecture is built on three core concepts that guarantee data integrity and lossless synchronization.

### 1. The Canonical Product Model

This is the platform-agnostic "source of truth." All platform-specific product models are converted into this single, consistent format. Its key features are:

-   **`canonicalId`:** A stable, internally-generated UUID for each product variant. This ID is never sent to the platforms and is used to reliably track a variant through any number of conversions.
-   **`meta`:** A special field on both the product and variant level that acts as a storage container for all platform-specific identifiers and metadata. This prevents platform data from overwriting canonical fields.

### 2. The Adapter Pattern

Each platform is handled by a dedicated `Adapter` that knows how to convert data to and from the Canonical Model.

-   **`fromPlatform(product)`:** Converts a platform-specific product into a `CanonicalProduct`.
-   **`toPlatform(product)`:** Converts a `CanonicalProduct` back into a platform-specific product.

### 3. Intelligent Metadata Persistence

This is the key to a lossless round-trip. The adapters are designed to preserve the `meta` object across all conversions by storing it in platform-specific fields (like WooCommerce's `meta_data` or by encoding it in an eBay SKU).

## Project Structure

```
product-adapters/
├── src/
│   ├── adapters/
│   │   ├── ... (Adapter files)
│   ├── models/
│   │   └── CanonicalProduct.ts
│   └── index.ts                # The single public entry point
├── test-conversion.ts
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

-   Node.js and npm
-   TypeScript and ts-node

### Installation

1.  Clone the repository.
2.  Install the required dependencies:

    ```bash
    npm install
    ```

### Running the Test

The project includes a round-trip conversion test that verifies the core logic. To run the test, execute:

```bash
npm run test:conversion
```

## Usage

Once the package is installed in your project, you can easily import all necessary adapters, models, and types from the root.

### 1. Installation in Another Project


```bash
npm install github:pguardiario/product-adapters
```

### 2. Example: Syncing a Product from Shopify to WooCommerce

Here’s a practical example of how you would use the library to convert a product fetched from the Shopify API into a payload ready to be sent to the WooCommerce API.

```typescript
import {
  ShopifyAdapter,
  WooAdapter,
  CanonicalProduct,
  ShopifyProduct // Use this to type your platform-specific data
} from 'product-adapters';

// 1. Instantiate the adapters you need.
const shopifyAdapter = new ShopifyAdapter();
const wooAdapter = new WooAdapter();

// 2. Assume you have a product object fetched from the Shopify API.
const shopifyProduct: ShopifyProduct = {
  id: "shopify123",
  title: "Cool Shirt",
  body_html: "A very cool shirt.",
  variants: [
    { id: "v1", title: "Red / M", price: "29.99", sku: "SKU-RED-M", inventory_quantity: 10 },
    { id: "v2", title: "Blue / L", price: "31.99", sku: "SKU-BLU-L", inventory_quantity: 5 }
  ],
  images: [{ src: "https://example.com/shirt.jpg" }]
};

// 3. Convert the Shopify product into the canonical model.
const canonicalProduct: CanonicalProduct = shopifyAdapter.fromPlatform(shopifyProduct);

console.log('--- Canonical Product ---');
console.log(canonicalProduct.variants);
// Outputs an object with a new `canonicalId` and a `meta` field:
// {
//   canonicalId: '...',
//   title: 'Red / M',
//   ...,
//   meta: { shopify: { id: 'v1' } }
// }

// 4. Convert the canonical product into the WooCommerce format.
const wooPayload = wooAdapter.toPlatform(canonicalProduct);

console.log('\n--- WooCommerce Payload ---');
console.log(wooPayload.variations);
// The output is a payload ready for the WooCommerce API.
// Note how it now contains `meta_data` to preserve the canonical info.
// {
//   id: undefined,
//   sku: 'SKU-RED-M',
//   ...,
//   meta_data: [
//     { key: '_canonicalId', value: '...' },
//     { key: '_canonicalVariantMeta', value: { shopify: { id: 'v1' } } }
//   ]
// }
```
This demonstrates the core workflow: **Platform A → Canonical → Platform B**. The canonical model acts as the stable intermediary, ensuring no data is lost in translation.

## Future Work

-   **Adding More Adapters:** For platforms like BigCommerce, Magento, or Amazon.
-   **Real API Integration:** Connecting the adapters to the actual platform APIs.
-   **Sync Engine:** A central service to orchestrate synchronization and handle conflicts.

## License

This project is licensed under the MIT License.