/**
 * @fileoverview This is the main entry point for the product-sync library.
 * It exports all the public-facing adapters, models, and types so that
 * consumers can import them from a single location.
 *
 * Example Usage:
 * import {
 *   ShopifyAdapter,
 *   CanonicalProduct,
 *   ShopifyProduct
 * } from 'product-sync';
 */

// --- CORE MODELS ---
// Export the canonical models and core types that define the library's structure.
export {
  CanonicalProduct,
  CanonicalVariant,
  PlatformMeta,
} from './models/CanonicalProduct';

// --- ADAPTERS ---
// Export the generic Adapter interface for type-checking or creating custom adapters.
export { Adapter } from './adapters/Adapter';

// Export the concrete adapter classes for each platform.
export { ShopifyAdapter } from './adapters/ShopifyAdapter';
export { WooAdapter } from './adapters/WooAdapter';
export { EbayAdapter } from './adapters/EbayAdapter';

// --- PLATFORM-SPECIFIC TYPES ---
// Export all the platform-specific data structures from the central types file.
// This is useful for consumers who need to type the data they fetch from platform APIs.
export * from './adapters/types';