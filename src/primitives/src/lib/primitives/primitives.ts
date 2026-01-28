import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'primitive-primitives',
  imports: [],
  template: `
    <p>Primitives works!</p>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Primitives {}
