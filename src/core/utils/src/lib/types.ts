import type { Signal } from '@angular/core';
import { isFunction } from './validators';

export type MaybeFn<T> = T | (() => T);
export type MaybeSignal<T> = T | Signal<T>;

export type Unwrap<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Signal<infer U> ? U : T extends (...args: any[]) => infer R ? R : T;

export function unwrapFn<T>(value: MaybeFn<T>): T {
  return isFunction(value) ? value() : value;
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends (infer U)[]
        ? DeepPartial<U>[]
        : T[P] extends object | undefined
          ? DeepPartial<T[P]>
          : T[P];
    }
  : T;

export type DeepRequired<T> = T extends object
  ? {
      [P in keyof T]-?: T[P] extends (infer U)[]
        ? DeepRequired<U>[]
        : T[P] extends object | undefined
          ? DeepRequired<T[P]>
          : T[P];
    }
  : T;
