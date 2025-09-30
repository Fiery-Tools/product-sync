// src/index.ts

import { Adapter } from './adapters/Adapter';

export {
  CanonicalProduct,
  CanonicalVariant,
  PlatformMeta,
} from './models/CanonicalProduct';

export { Adapter } from './adapters/Adapter';
export { ShopifyAdapter } from './adapters/ShopifyAdapter';
export { WooAdapter } from './adapters/WooAdapter';
// export { EbayAdapter } from './adapters/EbayAdapter';

export * from './adapters/types';

// use this convert function to turn woo product into shopify product and no special instructions
export function convert<T, U>(
  sourceProduct: T,
  fromAdapter: Adapter<T>,
  toAdapter: Adapter<U>
): U | null {
  const canonicalProduct = fromAdapter.fromPlatform(sourceProduct);

  // If the fromAdapter returned null, propagate it.
  if (!canonicalProduct) {
    return null;
  }

  return toAdapter.toPlatform(canonicalProduct);
}