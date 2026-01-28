import { coerceElement } from '@angular/cdk/coercion';
import {
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  NgZone,
  runInInjectionContext,
} from '@angular/core';

export function listener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | ElementRef<HTMLElement> | Document,
  event: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: { injector?: Injector; config?: AddEventListenerOptions | boolean },
): () => void;
export function listener(
  element: HTMLElement | ElementRef<HTMLElement> | Document,
  event: string,
  handler: (event: Event) => void,
  options?: { injector?: Injector; config?: AddEventListenerOptions | boolean },
): () => void;
export function listener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | ElementRef<HTMLElement> | Document,
  event: K | string,
  handler: (event: HTMLElementEventMap[K] | Event) => void,
  options?: { injector?: Injector; config?: AddEventListenerOptions | boolean },
): () => void {
  return runInInjectionContext(options?.injector ?? inject(Injector), () => {
    const ngZone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    const nativeElement = coerceElement(element);

    const removeListener = () =>
      nativeElement.removeEventListener(event, handler as EventListener, options?.config);

    destroyRef.onDestroy(removeListener);

    ngZone.runOutsideAngular(() =>
      nativeElement.addEventListener(event, handler as EventListener, options?.config),
    );

    return removeListener;
  });
}
