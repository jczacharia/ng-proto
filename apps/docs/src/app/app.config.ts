import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DocsAnchor } from './docs-anchor';
import { Test } from './test';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withIncrementalHydration()),
    provideBrowserGlobalErrorListeners(),
    provideRouter([
      {
        path: '',
        component: Test,
      },
      {
        path: 'anchor',
        component: DocsAnchor,
      },
    ]),
  ],
};
