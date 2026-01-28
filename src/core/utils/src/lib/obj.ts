/**
 * Utility functions for working with objects with type-safe keys and values.
 */
export const Obj = {
  keys: <O extends object, K extends keyof O>(o: O) => Object.keys(o) as K[],
  values: <O extends object, V extends O[keyof O]>(o: O) => Object.values(o) as V[],
  entries: <O extends object, K extends keyof O, V extends O[keyof O]>(o: O) =>
    Object.entries(o) as [K, V][],
  fromEntries: <K extends PropertyKey, V>(entries: [K, V][]) =>
    Object.fromEntries(entries) as Record<K, V>,
};
