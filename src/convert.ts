// src/convert.ts

import { Adapter } from './adapters/Adapter';

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