import { inject, InjectionToken, InjectOptions } from '@angular/core';
import { ProtoState } from './proto';

export interface ProtoAncestorEntry<T extends object = object, C extends object = object> {
  readonly token: InjectionToken<ProtoState<T, C>>;
  readonly state: ProtoState<T, C>;
}

export const PROTO_ANCESTRY_CHAIN = new InjectionToken<ProtoAncestorEntry[]>('ProtoAncestryChain', {
  factory: () => [],
});

export interface ProtoAncestry<T extends object, C extends object> {
  /**
   * The immediate parent of the same proto type, if any.
   */
  get parent(): ProtoAncestorEntry<T, C> | null;

  /**
   * The immediate parent of the given proto token, if any.
   */
  parentOfType<TT extends object, CC extends object>(
    token: InjectionToken<ProtoState<TT, CC>>,
  ): ProtoAncestorEntry<TT, CC> | null;

  /**
   * All ancestors of same proto type, ordered from parent to genesis.
   * @param predicate - Optional predicate to filter ancestors.
   */
  ancestors(predicate?: (entry: ProtoAncestorEntry<T, C>) => boolean): ProtoAncestorEntry<T, C>[];

  /**
   * All ancestors of the given proto type, ordered from parent to genesis.
   * @param predicate - Optional predicate to filter ancestors.
   */
  ancestorsOfType<TT extends object, CC extends object>(
    token: InjectionToken<ProtoState<TT, CC>>,
    predicate?: (entry: ProtoAncestorEntry<TT, CC>) => boolean,
  ): ProtoAncestorEntry<TT, CC>[];

  /**
   * All ancestors of any type, ordered from parent to genesis.
   * @param predicate - Optional predicate to filter ancestors.
   */
  all(predicate?: (entry: ProtoAncestorEntry) => boolean): ProtoAncestorEntry[];
}

export function createProtoAncestry<T extends object, C extends object>(
  parentChain: readonly ProtoAncestorEntry[],
  currentToken: InjectionToken<ProtoState<T, C>>,
): ProtoAncestry<T, C> {
  // Pre-compute reversed array (nearest first)
  const ancestors = [...parentChain].reverse();

  return {
    get parent(): ProtoAncestorEntry<T, C> | null {
      const found = ancestors.find(e => e.token === currentToken);
      return (found as ProtoAncestorEntry<T, C>) ?? null;
    },

    parentOfType<TT extends object, CC extends object>(
      token: InjectionToken<ProtoState<TT, CC>>,
    ): ProtoAncestorEntry<TT, CC> | null {
      const found = ancestors.find(e => e.token === token);
      return (found as ProtoAncestorEntry<TT, CC>) ?? null;
    },

    ancestors(
      predicate?: (entry: ProtoAncestorEntry<T, C>) => boolean,
    ): ProtoAncestorEntry<T, C>[] {
      type A = ProtoAncestorEntry<T, C>;
      const sameType = ancestors.filter(e => e.token === currentToken) as A[];
      return predicate ? sameType.filter(predicate) : sameType;
    },

    ancestorsOfType<TT extends object, CC extends object>(
      token: InjectionToken<ProtoState<TT, CC>>,
      predicate?: (entry: ProtoAncestorEntry<TT, CC>) => boolean,
    ): ProtoAncestorEntry<TT, CC>[] {
      const ofType = ancestors.filter(e => e.token === token) as ProtoAncestorEntry<TT, CC>[];
      return predicate ? ofType.filter(predicate) : ofType;
    },

    all(predicate?: (entry: ProtoAncestorEntry) => boolean): ProtoAncestorEntry[] {
      return predicate ? ancestors.filter(predicate) : ancestors;
    },
  };
}

export function injectProtoAncestor<T extends object, C extends object>(
  token: InjectionToken<ProtoState<T, C>>,
  options?: InjectOptions & { optional?: false },
): ProtoState<T, C>;

export function injectProtoAncestor<T extends object, C extends object>(
  token: InjectionToken<ProtoState<T, C>>,
  options: InjectOptions & { optional: true },
): ProtoState<T, C> | null;

export function injectProtoAncestor<T extends object, C extends object>(
  token: InjectionToken<ProtoState<T, C>>,
  options: InjectOptions = {},
): ProtoState<T, C> | null {
  const { optional, ...injectOpts } = options;
  const state = inject(token, { ...injectOpts, optional: true, skipSelf: true });

  if (!state && !optional) {
    throw new Error(
      `Required ancestor state not found. ` +
        `Ensure the parent proto is present in the DOM hierarchy.`,
    );
  }

  return state ?? null;
}

export function injectProtoParent<T extends object, C extends object>(
  token: InjectionToken<ProtoState<T, C>>,
  options?: InjectOptions & { optional?: false },
): ProtoState<T, C>;

export function injectProtoParent<T extends object, C extends object>(
  token: InjectionToken<ProtoState<T, C>>,
  options: InjectOptions & { optional: true },
): ProtoState<T, C> | null;

export function injectProtoParent<T extends object, C extends object>(
  token: InjectionToken<ProtoState<T, C>>,
  options: InjectOptions = {},
): ProtoState<T, C> | null {
  return inject(token, { ...options, skipSelf: true }) ?? null;
}
