// src/adapters/Adapter.ts

import { CanonicalProduct } from "../models/CanonicalProduct";

export interface Adapter<T> {
  fromPlatform(platformProduct: T): CanonicalProduct | null;
  toPlatform(canonicalProduct: CanonicalProduct): T;
}