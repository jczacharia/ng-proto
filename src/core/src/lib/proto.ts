import {
  ElementRef,
  inject,
  InjectionToken,
  InjectOptions,
  Injector,
  InputSignal,
  InputSignalWithTransform,
  Provider,
  runInInjectionContext,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import {
  controlledInput,
  ControlledInput,
  deepMerge,
  DeepPartial,
  injectElementRef,
  isFunction,
  isInputSignal,
  MaybeFn,
  uniqueId,
} from '@ng-proto/core/utils';
import {
  createProtoAncestry,
  PROTO_ANCESTRY_CHAIN,
  ProtoAncestorEntry,
  ProtoAncestry,
} from './proto-ancestry';

export type ProtoDirective<T extends object> = {
  [K in keyof T]: T[K] extends InputSignalWithTransform<infer U, infer TransformT>
    ? ControlledInput<U, TransformT, T[K]>
    : T[K] extends InputSignal<infer V>
      ? ControlledInput<V, V, T[K]>
      : T[K];
};

export interface ProtoMetadata<T extends object, C extends object> {
  readonly protoId: string;
  readonly protoName: string;
  readonly config: C;
  readonly ancestry: ProtoAncestry<T, C>;
  readonly injector: Injector;
  readonly elementRef: ElementRef<HTMLElement>;
}

export type ProtoState<T extends object, C extends object> = Signal<ProtoDirective<T>> &
  ProtoMetadata<T, C>;

export type ProtoHook<T extends object, C extends object> = (proto: ProtoState<T, C>) => void;

export type Proto<T extends object, C extends object> = {
  readonly token: InjectionToken<ProtoState<T, C>>;
  readonly configToken: InjectionToken<C>;
  readonly hooksToken: InjectionToken<ProtoHook<T, C>[]>;

  provideState(): Provider;
  injectState(options?: InjectOptions & { optional?: false }): ProtoState<T, C>;
  injectState(options: InjectOptions & { optional: true }): ProtoState<T, C> | null;
  initState(instance: T): ProtoState<T, C>;

  provideHooks(...hooks: ProtoHook<T, C>[]): Provider;
  injectHooks(options?: Omit<InjectOptions, 'optional'>): ProtoHook<T, C>[];
} & (C extends Record<PropertyKey, never>
  ? unknown
  : {
      provideConfig(cfg: MaybeFn<DeepPartial<C>>): Provider[];
      injectConfig(options?: Omit<InjectOptions, 'optional'>): C;
    });

export function createProto<T extends object, C extends object = object>(
  name: string,
  ...configArgs: NonNullable<DeepPartial<C>> extends C
    ? [defaultConfig?: MaybeFn<C>]
    : [defaultConfig: MaybeFn<C>]
): Proto<T, C> {
  const [defaultConfig] = configArgs;

  /** Use for managing writable state */
  const internalProtoToken = new InjectionToken<
    WritableSignal<ProtoDirective<T>> & ProtoMetadata<T, C>
  >(`ProtoInternalState:${name}`);

  /** Use for exposing immutable state and ancestry lookups */
  const publicToken = new InjectionToken<ProtoState<T, C>>(`ProtoToken:${name}`);

  /** Use for proto configuration */
  const configToken = new InjectionToken<C>(`ProtoConfig:${name}`);

  /** Use for collecting config contributions from hostDirectives (multi provider) */
  const configContributionToken = new InjectionToken<DeepPartial<C>>(
    `ProtoConfigContribution:${name}`,
  );

  /** Use for proto hooks */
  const hooksToken = new InjectionToken<ProtoHook<T, C>[]>(`ProtoHooks:${name}`);

  function provideState(): Provider {
    return [
      {
        provide: internalProtoToken,
        useFactory: (): ProtoState<T, C> => {
          const source = signal(null as unknown as ProtoDirective<T>);
          const chain = inject(PROTO_ANCESTRY_CHAIN, { optional: true, skipSelf: true }) ?? [];

          const metadata: ProtoMetadata<T, C> = {
            protoId: uniqueId(name),
            protoName: name,
            config: injectConfig(),
            injector: inject(Injector),
            elementRef: injectElementRef<HTMLElement>(),
            ancestry: createProtoAncestry(chain, publicToken),
          };

          Object.assign(source, metadata);
          return source as unknown as ProtoState<T, C>;
        },
      },
      {
        provide: publicToken,
        useFactory: () => {
          const proto = inject(internalProtoToken);

          // Forbid mutation on the public token
          delete (proto as Partial<WritableSignal<ProtoDirective<T>>>).set;
          delete (proto as Partial<WritableSignal<ProtoDirective<T>>>).update;

          return proto;
        },
      },
      {
        provide: PROTO_ANCESTRY_CHAIN,
        useFactory: () => {
          const chain = inject(PROTO_ANCESTRY_CHAIN, { optional: true, skipSelf: true }) ?? [];
          const currentProto = inject(internalProtoToken);

          /** Use {@link publicToken} in ancestry entries for proto lookups. */
          const entry: ProtoAncestorEntry<T, C> = {
            token: publicToken,
            state: currentProto,
          };

          return [...chain, entry];
        },
      },
    ];
  }

  function injectState(opts?: InjectOptions & { optional?: false }): ProtoState<T, C>;
  function injectState(opts: InjectOptions & { optional: true }): ProtoState<T, C> | null;
  function injectState(opts: InjectOptions = {}): ProtoState<T, C> | null {
    const state = inject(publicToken, opts);

    if (!opts.optional && (!state || !state())) {
      throw new Error(
        `${name} proto not initialized. Call ${name}Proto.init() in your component or directive.`,
      );
    }

    return state ?? null;
  }

  function initState(instance: T): ProtoState<T, C> {
    const proto = inject(internalProtoToken);

    if (proto()) {
      throw new Error(`${name} proto already initialized. init() should only be called once.`);
    }

    const injector = inject(Injector);
    const hooks = inject<ProtoHook<T, C>[]>(hooksToken, { optional: true }) ?? [];

    for (const key of Object.keys(instance)) {
      const value = instance[key as keyof T];
      if (isInputSignal(value)) {
        controlledInput(value);
      }
    }

    proto.set(instance as ProtoDirective<T>);

    runInInjectionContext(injector, () => {
      for (const hook of hooks) {
        hook(proto);
      }
    });

    return inject(publicToken); // only expose the immutable public token
  }

  function provideConfig(cfg: MaybeFn<DeepPartial<C>>): Provider[] {
    return [
      {
        provide: configContributionToken,
        multi: true,
        useFactory: () => {
          const injector = inject(Injector);
          return isFunction(cfg) ? runInInjectionContext(injector, cfg) : cfg;
        },
      },
      {
        provide: configToken,
        useFactory: (): C => injectConfig(),
      },
    ];
  }

  function injectConfig(opts: Omit<InjectOptions, 'optional'> = {}): C {
    const injector = inject(Injector);
    const contributions = inject(configContributionToken, { ...opts, optional: true }) ?? [];
    const defaultCfg = isFunction(defaultConfig)
      ? runInInjectionContext(injector, defaultConfig)
      : (defaultConfig ?? {});
    return deepMerge(defaultCfg, ...contributions) as C;
  }

  function provideHooks(...hooks: ProtoHook<T, C>[]): Provider {
    return {
      provide: hooksToken,
      useFactory: () => {
        const parent = inject(hooksToken, { optional: true, skipSelf: true });
        return [...(parent ?? []), ...hooks];
      },
    };
  }

  function injectHooks(opts: Omit<InjectOptions, 'optional'> = {}): ProtoHook<T, C>[] {
    return inject(hooksToken, { ...opts, optional: true }) ?? [];
  }

  return {
    token: publicToken,
    configToken,
    hooksToken,
    provideState,
    injectState,
    initState,
    provideConfig,
    injectConfig,
    provideHooks,
    injectHooks,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } satisfies Proto<T, Record<PropertyKey, any>> as unknown as Proto<T, C>;
}
