import { ChangeDetectionStrategy, Component } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';
import { ProtoPress } from './press';

describe('ProtoPress', () => {
  @Component({
    selector: 'test-press',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ProtoPress],
    template: `
      <div data-testid="press-element" protoPress [protoPressDisabled]="disabled">Press me</div>
    `,
  })
  class TestPressComponent {
    disabled = false;
  }

  it('should set data-press when pressed', async () => {
    await render(TestPressComponent);
    const element = screen.getByTestId('press-element');

    expect(element).not.toHaveAttribute('data-press');

    fireEvent.pointerDown(element);
    expect(element).toHaveAttribute('data-press');

    fireEvent.pointerUp(document);
    expect(element).not.toHaveAttribute('data-press');
  });

  it('should not trigger press when disabled', async () => {
    await render(TestPressComponent, {
      componentProperties: { disabled: true },
    });
    const element = screen.getByTestId('press-element');

    fireEvent.pointerDown(element);
    expect(element).not.toHaveAttribute('data-press');
  });

  it('should reset press when pointer moves outside element', async () => {
    await render(TestPressComponent);
    const element = screen.getByTestId('press-element');

    fireEvent.pointerDown(element);
    expect(element).toHaveAttribute('data-press');

    // Simulate pointer moving outside the element
    fireEvent.pointerMove(document.body, { target: document.body });
    expect(element).not.toHaveAttribute('data-press');
  });

  it('should reset press on pointer cancel', async () => {
    await render(TestPressComponent);
    const element = screen.getByTestId('press-element');

    fireEvent.pointerDown(element);
    expect(element).toHaveAttribute('data-press');

    fireEvent.pointerCancel(document);
    expect(element).not.toHaveAttribute('data-press');
  });

  describe('outputs', () => {
    @Component({
      selector: 'test-press-callbacks',
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [ProtoPress],
      template: `
        <div
          data-testid="press-element"
          protoPress
          (protoPressEnd)="pressEndCount = pressEndCount + 1"
          (protoPressStart)="pressStartCount = pressStartCount + 1"
        >
          Press me
        </div>
      `,
    })
    class TestPressCallbacksComponent {
      pressStartCount = 0;
      pressEndCount = 0;
    }

    it('should emit pressStart and pressEnd events', async () => {
      const { fixture } = await render(TestPressCallbacksComponent);
      const component = fixture.componentInstance;
      const element = screen.getByTestId('press-element');

      expect(component.pressStartCount).toBe(0);
      expect(component.pressEndCount).toBe(0);

      fireEvent.pointerDown(element);
      expect(component.pressStartCount).toBe(1);
      expect(component.pressEndCount).toBe(0);

      fireEvent.pointerUp(document);
      expect(component.pressStartCount).toBe(1);
      expect(component.pressEndCount).toBe(1);
    });
  });
});
