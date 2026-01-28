# Proto System Design Review

**Review Date:** 2026-01-28
**Reviewer:** Claude Opus 4.5
**Files Reviewed:**
- `/home/jomby/libraries/ng-proto/src/core/src/lib/proto.ts`
- `/home/jomby/libraries/ng-proto/src/core/src/lib/proto-ancestry.ts`
- `/home/jomby/libraries/ng-proto/src/core/src/lib/proto.spec.ts`
- `/home/jomby/libraries/ng-proto/src/core/utils/src/lib/signals/controlled-input.ts`
- `/home/jomby/libraries/ng-proto/src/core/utils/src/lib/deep-merge/deep-merge.ts`
- Implementation consumers: hover.ts, focus.ts, press.ts, interact.ts, focus-visible.ts

---

## Summary

The Proto system is a well-architected abstraction for creating composable Angular directives with hierarchical configuration, ancestry tracking, and controlled signals. The core design philosophy is sound: wrap directive instances with metadata and provide a consistent pattern for state management across primitives.

**Overall Assessment:** Good foundation with some areas needing refinement before being considered production-ready for external consumers. The API shows thoughtful design but has some rough edges in type safety, error handling, and documentation that could confuse library users.

**Strengths:**
- Clean separation between internal writable state and public readonly state
- Elegant ancestry system for parent-child directive communication
- Flexible configuration hierarchy with deep merge support
- Hooks system enables extensibility without modifying core directives

**Areas for Improvement:**
- Type safety issues with `as unknown as` casts
- Missing JSDoc on public API surface
- Edge cases in controlled input handling
- Potential memory concerns with ancestry chain

---

## Critical Issues

These must be addressed before the library is ready for external consumption.

### 1. Unsafe Type Casts in `createProto`

**Location:** `/home/jomby/libraries/ng-proto/src/core/src/lib/proto.ts` lines 106, 119, 183, 246

The code relies heavily on unsafe type assertions that could hide type errors:

```typescript
// Line 106 - Unsafe null cast
const source = signal(null as unknown as ProtoDirective<T>);

// Line 119 - Object.assign doesn't preserve type safety
Object.assign(source, metadata);
return source as unknown as ProtoState<T, C>;

// Line 183 - Assumes T can be cast to ProtoDirective<T>
proto.set(instance as ProtoDirective<T>);

// Line 246 - Final cast bypasses type system
} satisfies Proto<T, Record<PropertyKey, any>> as unknown as Proto<T, C>;
```

**Why this matters:** Library consumers expect type safety. If the types are wrong, TypeScript won't catch errors, leading to runtime failures that are hard to debug.

**Recommendation:** Consider using a branded type or a type guard to ensure safety. At minimum, add runtime checks during development mode:

```typescript
// Consider adding development-mode validation
if (typeof ngDevMode === 'undefined' || ngDevMode) {
  validateProtoDirective(instance);
}
```

### 2. `ProtoState` Signal Can Be Accessed Before Initialization

**Location:** `/home/jomby/libraries/ng-proto/src/core/src/lib/proto.ts` lines 154-164

The `injectState` function throws when the proto isn't initialized, but the error message references `init()` which doesn't exist - the method is `initState()`:

```typescript
throw new Error(
  `${name} proto not initialized. Call ${name}Proto.init() in your component or directive.`,
);
```

**Why this matters:** Incorrect error messages waste developer time debugging the wrong thing.

**Fix:** Change `init()` to `initState()` in the error message.

### 3. Controlled Input Relies on Angular Internals

**Location:** `/home/jomby/libraries/ng-proto/src/core/utils/src/lib/signals/controlled-input.ts`

The code imports from `@angular/core/primitives/signals`, which is a private/internal Angular API:

```typescript
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';
```

**Why this matters:** Internal APIs can change without notice between Angular versions. This creates maintenance burden and potential breaking changes for library consumers.

**Recommendation:**
1. Document this dependency prominently in the README
2. Add integration tests that verify the internal API contract
3. Consider if there's a public API alternative (there may not be for this use case)
4. Pin Angular version ranges tightly in peer dependencies

### 4. Missing Cleanup in `controlledInput` When Used Multiple Times

**Location:** `/home/jomby/libraries/ng-proto/src/core/utils/src/lib/signals/controlled-input.ts` line 44

The function returns early if the input is already controlled, but doesn't validate that the existing controlled input matches expectations:

```typescript
if (isControlledInput(source)) {
  return source;
}
```

**Why this matters:** If `controlledInput` is accidentally called twice with different expectations, the second call silently returns the first wrapper, which may have stale state.

**Recommendation:** Add a debug-mode warning when this early return is triggered.

### 5. `deepMerge.options` Is Mutable Global State

**Location:** `/home/jomby/libraries/ng-proto/src/core/utils/src/lib/deep-merge/deep-merge.ts` lines 118-131

The `deepMerge.options` object is globally mutable, and `deepMerge.withOptions` temporarily mutates it then restores:

```typescript
deepMerge.withOptions = <T extends IObject[]>(options: Partial<IOptions>, ...objects: T) => {
  deepMerge.options = { ...defaultOptions, ...options };
  const result = deepMerge(...objects);
  deepMerge.options = defaultOptions;
  return result;
};
```

**Why this matters:** In concurrent or nested scenarios, this can cause race conditions where one merge operation affects another's options.

**Recommendation:** Either:
1. Make `deepMerge` accept options as a parameter instead of using global state
2. Remove `deepMerge.withOptions` from the public API and handle options internally

---

## Improvements

These would meaningfully improve the code but are not blocking.

### 1. Add JSDoc Documentation to Public API

The `createProto` function and `Proto` type are the main entry points for library consumers, but lack documentation:

```typescript
// Current - no documentation
export function createProto<T extends object, C extends object = object>(
  name: string,
  ...configArgs: NonNullable<DeepPartial<C>> extends C
    ? [defaultConfig?: MaybeFn<C>]
    : [defaultConfig: MaybeFn<C>]
): Proto<T, C> {
```

**Recommendation:** Add comprehensive JSDoc:

```typescript
/**
 * Creates a proto definition for a directive or component.
 *
 * A proto provides:
 * - State management with controlled signals
 * - Hierarchical configuration
 * - Ancestry tracking for parent-child communication
 * - Lifecycle hooks for extensibility
 *
 * @typeParam T - The directive/component type
 * @typeParam C - The configuration type (optional)
 * @param name - Unique name for this proto (used in error messages and IDs)
 * @param defaultConfig - Default configuration values (required if C has required properties)
 * @returns A Proto object with state/config providers and injection utilities
 *
 * @example
 * ```typescript
 * interface MyConfig { threshold: number; }
 * const MyProto = createProto<MyDirective, MyConfig>('MyDirective', { threshold: 10 });
 *
 * @Directive({
 *   providers: [MyProto.provideState()]
 * })
 * class MyDirective {
 *   readonly state = MyProto.initState(this);
 * }
 * ```
 */
```

### 2. Improve Ancestry Chain Memory Management

**Location:** `/home/jomby/libraries/ng-proto/src/core/src/lib/proto-ancestry.ts` line 53

The ancestry system creates a new reversed array for every proto instance:

```typescript
const ancestors = [...parentChain].reverse();
```

**Why this matters:** For deeply nested component trees, this copies arrays repeatedly. While not a major issue, it's wasteful.

**Recommendation:** Consider lazy reversal or using a linked list structure:

```typescript
// Alternative: reverse on demand
get parent(): ProtoAncestorEntry<T, C> | null {
  // Search from end of parentChain (nearest first)
  for (let i = parentChain.length - 1; i >= 0; i--) {
    if (parentChain[i].token === currentToken) {
      return parentChain[i] as ProtoAncestorEntry<T, C>;
    }
  }
  return null;
}
```

### 3. Config Provider Creates Duplicate `configToken` Providers

**Location:** `/home/jomby/libraries/ng-proto/src/core/src/lib/proto.ts` lines 194-209

Every call to `provideConfig` provides both the contribution AND the resolved config:

```typescript
function provideConfig(cfg: MaybeFn<DeepPartial<C>>): Provider[] {
  return [
    { provide: configContributionToken, multi: true, ... },
    { provide: configToken, useFactory: (): C => injectConfig() },  // Redundant?
  ];
}
```

**Why this matters:** If `provideConfig` is called at multiple levels (grandparent, parent, child), each creates a `configToken` provider. The innermost one wins, which is correct, but it's wasteful to create factories that won't be used.

**Recommendation:** Only provide `configToken` once in `provideState()`:

```typescript
function provideState(): Provider {
  return [
    // ... existing providers ...
    { provide: configToken, useFactory: () => injectConfig() },
  ];
}
```

Then `provideConfig` only provides the contribution:

```typescript
function provideConfig(cfg: MaybeFn<DeepPartial<C>>): Provider {
  return {
    provide: configContributionToken,
    multi: true,
    useFactory: () => { ... }
  };
}
```

### 4. Add Development-Mode Warnings

Consider adding warnings for common mistakes:

```typescript
function initState(instance: T): ProtoState<T, C> {
  const proto = inject(internalProtoToken);

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    // Warn if initState called outside constructor
    if (!isInConstructorContext()) {
      console.warn(
        `${name}Proto.initState() should be called in the constructor, not in lifecycle hooks.`
      );
    }

    // Warn if no inputs found
    const hasInputs = Object.keys(instance).some(k => isInputSignal(instance[k as keyof T]));
    if (!hasInputs) {
      console.warn(
        `${name}Proto.initState() called but no input signals found. ` +
        `Did you forget to declare inputs?`
      );
    }
  }
  // ...
}
```

### 5. Consider Exposing `protoType` in Metadata

The current metadata includes `protoId` and `protoName`, but not a reference to the directive constructor. This would be useful for debugging:

```typescript
interface ProtoMetadata<T extends object, C extends object> {
  readonly protoId: string;
  readonly protoName: string;
  readonly protoType: Type<T>;  // Add this
  readonly config: C;
  // ...
}
```

### 6. Hooks Should Support Async/Promise Return

Current hooks are synchronous only:

```typescript
export type ProtoHook<T extends object, C extends object> = (proto: ProtoState<T, C>) => void;
```

**Recommendation:** Allow hooks to return cleanup functions (similar to `effect`):

```typescript
export type ProtoHook<T extends object, C extends object> =
  (proto: ProtoState<T, C>) => void | (() => void);
```

---

## Nitpicks

Minor style or preference items.

### 1. Inconsistent Naming: `PressPrimitive` vs `HoverProto`

**Location:** `/home/jomby/libraries/ng-proto/src/core/press/src/lib/press.ts` line 26

```typescript
export const PressPrimitive = createProto<ProtoPress, PressConfig>('Press', ...);
```

All other protos use the `*Proto` naming convention (`HoverProto`, `FocusProto`, `InteractProto`). `PressPrimitive` breaks this pattern.

**Fix:** Rename to `PressProto` for consistency.

### 2. `as unknown as` Could Use Type Predicates

Instead of `as unknown as`, consider type predicates:

```typescript
function isProtoState<T, C>(value: unknown): value is ProtoState<T, C> {
  return value !== null && typeof value === 'function' && 'protoId' in value;
}
```

### 3. Magic Number in Touch Event Timeout

**Location:** `/home/jomby/libraries/ng-proto/src/core/hover/src/lib/hover.ts` line 39

```typescript
setTimeout(() => (ignoreEmulatedMouseEvents = false), 50);
```

The 50ms timeout is unexplained. Consider extracting to a named constant with documentation:

```typescript
/**
 * Time in ms to ignore emulated mouse events after touch.
 * iOS fires onPointerEnter with pointerType="mouse" immediately after onPointerUp,
 * so we need a brief window to filter these out.
 */
const TOUCH_EMULATION_DEBOUNCE_MS = 50;
```

### 4. Test File Organization

The `proto.spec.ts` file is quite long (733 lines). Consider splitting into multiple test files:
- `proto-state.spec.ts` - State management tests
- `proto-ancestry.spec.ts` - Ancestry tests
- `proto-config.spec.ts` - Configuration hierarchy tests
- `proto-hooks.spec.ts` - Hook system tests

---

## Praise

Specifically calling out things done well.

### 1. Excellent Ancestry API Design

The ancestry system is beautifully designed. The API is intuitive:

```typescript
// Get immediate parent of same type
state.ancestry.parent

// Get parent of specific type
state.ancestry.parentOfType(FocusProto.token)

// Get all ancestors with filtering
state.ancestry.all(e => e.state.protoName === 'ParentDir')
```

This enables powerful composition patterns without complex DI gymnastics.

### 2. Controlled Input Pattern Is Clever

The `ControlledInput` abstraction elegantly solves a real problem: allowing programmatic override of template-bound values while preserving both:

```typescript
state().disabled.control(true);   // Programmatic override
state().disabled.templateValue()  // Still know what template says
state().disabled.reset()          // Return to template value
```

This is a pattern that would be useful beyond this library.

### 3. Config Hierarchy Just Works

The deep merge configuration with multi-provider contributions is a clean solution for hierarchical configuration:

```typescript
// Component
providers: [Proto.provideConfig({ a: 1 })]

// Can be overridden by child
providers: [Proto.provideConfig({ a: 2 })]  // Wins
```

The tests demonstrate this working correctly across grandparent/parent/child levels.

### 4. Immutable Public State

Deleting `set` and `update` from the public token prevents accidental mutation:

```typescript
delete (proto as Partial<WritableSignal<ProtoDirective<T>>>).set;
delete (proto as Partial<WritableSignal<ProtoDirective<T>>>).update;
```

While unconventional, this is a pragmatic solution to prevent misuse.

### 5. Comprehensive Test Coverage

The test file covers:
- Basic state management
- Controlled signal behavior
- Ancestry chains
- Config hierarchy
- Hooks with effects
- State inheritance

The tests serve as excellent documentation of expected behavior.

### 6. Touch Device Handling in Hover

The hover directive properly handles the notorious iOS "sticky hover" problem:

```typescript
// Global tracking for emulated mouse events
let ignoreEmulatedMouseEvents = false;

// Per-instance tracking
private ignoreEmulatedMouseEvents = false;
```

This dual-layer approach handles both global touch events and element-specific interactions correctly.

---

## Recommendations Summary

**Priority 1 (Do before release):**
1. Fix error message typo (`init()` -> `initState()`)
2. Document Angular internal API dependency
3. Add JSDoc to `createProto` and `Proto` type

**Priority 2 (Should do soon):**
4. Rename `PressPrimitive` to `PressProto`
5. Address `deepMerge.options` global state issue
6. Add development-mode warnings for common mistakes

**Priority 3 (Nice to have):**
7. Improve ancestry chain memory management
8. Support cleanup functions in hooks
9. Split large test file

---

## Conclusion

The Proto system shows strong architectural thinking and solves real problems in Angular primitive development. The controlled input pattern and ancestry system are particularly well-designed. With some polish on type safety, documentation, and edge case handling, this will be a solid foundation for the ng-proto library.

The main risk is the dependency on Angular internals (`@angular/core/primitives/signals`). This should be prominently documented and tested thoroughly across Angular versions to catch breaking changes early.
