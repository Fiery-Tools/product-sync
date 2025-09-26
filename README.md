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

```typescript
// src/models/CanonicalProduct.ts

export interface PlatformMeta {
  [platform: string]: {
    id?: string | number;
    sku?: string;
    [key: string]: any;
  };
}

export interface CanonicalVariant {
  canonicalId: string; // The stable, internal ID
  title: string;
  price: number;
  sku: string;
  inventory: number;
  meta: PlatformMeta; // Stores Shopify ID, Woo ID, eBay SKU, etc.
}

export interface CanonicalProduct {
  // ... top-level fields
  variants: CanonicalVariant[];
  meta: PlatformMeta;
}
```

### 2. The Adapter Pattern

Each platform is handled by a dedicated `Adapter` that knows how to convert data to and from the Canonical Model.

-   **`fromPlatform(product)`:** Converts a platform-specific product (e.g., a `ShopifyProduct`) into a `CanonicalProduct`.
-   **`toPlatform(product)`:** Converts a `CanonicalProduct` back into a platform-specific product.

```typescript
// src/adapters/Adapter.ts
export interface Adapter<T> {
  fromPlatform(platformProduct: T): CanonicalProduct;
  toPlatform(canonicalProduct: CanonicalProduct): T;
}
```

### 3. Intelligent Metadata Persistence

This is the key to a lossless round-trip. The adapters are designed to preserve the `meta` object across all conversions.

-   **For platforms with metadata support (like WooCommerce):** The entire canonical `meta` object is serialized and stored in a `meta_data` field.
-   **For platforms without metadata support (like eBay):** The `canonicalId`, `title`, and `meta` object are serialized into a JSON string and cleverly embedded within a field the platform *does* support, like the SKU.

This ensures that when a product completes a `Shopify -> Woo -> eBay` round trip, the final canonical model still contains the original Shopify IDs, ready for a sync back to the source.

## Project Structure

```
product-adapters/
├── src/
│   ├── adapters/
│   │   ├── Adapter.ts          # The generic adapter interface
│   │   ├── ShopifyAdapter.ts   # Handles Shopify products
│   │   ├── WooAdapter.ts       # Handles WooCommerce products
│   │   ├── EbayAdapter.ts      # Handles eBay products
│   │   └── types.ts            # Platform-specific type definitions
│   └── models/
│       └── CanonicalProduct.ts # The core canonical model
├── test-conversion.ts          # The round-trip test runner
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

-   Node.js and npm
-   ts-node

### Installation

1.  Clone the repository.
2.  Install the required dependencies:

    ```bash
    npm install
    ```

### Running the Test

The project includes a round-trip conversion test that verifies the core logic. It converts a sample Shopify product through the entire adapter chain and performs an intelligent diff to ensure no data was lost or mutated.

To run the test, execute:

```bash
npm run test:conversion
```

You should see a success message confirming that all attributes and variants were preserved.

```--- Starting Round Trip Test ---
✅ Step 1: Shopify → Canonical (Initial state with new canonicalIds)
✅ Step 2: Canonical → Woo → Canonical
✅ Step 3: Canonical → eBay → Canonical (Final state)
------------------------------------
✅ SUCCESS: Attributes and variants preserved perfectly through the entire round-trip.
```

## Future Work

This library provides the foundational proof-of-concept for a robust sync engine. Next steps could include:

-   **Adding More Adapters:** For platforms like BigCommerce, Magento, or Amazon.
-   **Real API Integration:** Connecting the adapters to the actual platform APIs to fetch and push data.
-   **Sync Engine:** A central service that orchestrates the synchronization logic, manages schedules, and handles conflicts.
-   **Error Handling and Logging:** Implementing robust error handling for API failures and data validation issues.

## License

This project is licensed under the MIT License.