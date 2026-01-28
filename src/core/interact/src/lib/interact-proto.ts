import { createProto } from '@ng-proto/core';
import { Obj } from '@ng-proto/core/utils';
import { ProtoInteract } from './interact';

export const ProtoInteractEvents = new Set([
  'click',
  'keydown',
  'keyup',
  'pointerdown',
  'mousedown',
] as const);

export type ProtoInteractEventTypes = typeof ProtoInteractEvents extends Set<infer T> ? T : never;

export interface ProtoInteractEventConfig {
  /**
   * Whether to capture the event.
   * @default true
   */
  capture: boolean;

  /**
   * Whether to only handle the event on the current element.
   * If true, the event will be handled only if the target is the current element.
   * If false, bubbled events from children will be handled as well.
   * @default true
   */
  selfOnly: boolean;

  /**
   * Whether to prevent the default action of the event.
   * @default true
   */
  preventDefault: boolean;

  /**
   * Whether to stop the immediate propagation of the event.
   * @default true
   */
  stopImmediatePropagation: boolean;
}

export interface ProtoInteractConfig {
  /**
   * The fallback tab index to use when the element's `tabindex` attribute is absent.
   * @default 0
   */
  fallbackTabIndex: number;

  /**
   * The event configuration to handle.
   * @default
   * ```ts
   * {
   *   capture: true,
   *   selfOnly: true,
   *   preventDefault: true,
   *   stopImmediatePropagation: true,
   * }
   * ```
   * -for all events.
   */
  events: Record<ProtoInteractEventTypes, ProtoInteractEventConfig>;
}

export function createProtoInteractDefaultConfig(
  opts: { fallbackTabIndex?: number; allEvents?: Partial<ProtoInteractEventConfig> } = {},
): ProtoInteractConfig {
  return {
    fallbackTabIndex: opts.fallbackTabIndex ?? 0,
    events: Obj.fromEntries(
      Array.from(ProtoInteractEvents).map(event => [
        event,
        {
          capture: true,
          selfOnly: true,
          preventDefault: true,
          stopImmediatePropagation: true,
          ...opts.allEvents,
        } satisfies ProtoInteractEventConfig,
      ]),
    ),
  };
}

export const InteractProto = createProto<ProtoInteract, ProtoInteractConfig>(
  'Interact',
  createProtoInteractDefaultConfig,
);
