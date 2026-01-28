import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { render } from '@testing-library/angular';
import { ControlledInput, controlledInput } from './controlled-input';

describe('controlledInput', () => {
  @Component({
    selector: 'test-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: '',
  })
  class TestInputComponent {
    readonly testInput = input(0);
    readonly controlledInput = controlledInput(this.testInput);

    readonly testModel = model(0);
    readonly controlledModel = controlledInput(this.testModel);
  }

  it('should create a controlled input signal', async () => {
    const { fixture } = await render(TestInputComponent);
    const component = fixture.componentInstance;

    expect(component.controlledInput()).toBe(0);
    expect(component.controlledInput.templateValue()).toBe(0);
  });

  it('should allow setting static values', async () => {
    const { fixture } = await render(TestInputComponent);
    const component = fixture.componentInstance;

    component.controlledInput.control(42);
    expect(component.controlledInput()).toBe(42);
    expect(component.controlledInput.templateValue()).toBe(0); // Input unchanged
  });

  it('should track input value separately from controlled value', async () => {
    const { fixture, rerender } = await render(TestInputComponent, {
      componentInputs: { testInput: 10 },
    });
    const component = fixture.componentInstance;

    expect(component.controlledInput()).toBe(10);
    expect(component.testInput()).toBe(10);
    expect(component.controlledInput.templateValue()).toBe(10);
    expect(component.controlledInput.isControlled()).toBe(false);
    expect(component.controlledInput.controlValue()).toBe(0);

    // Programmatic override
    component.controlledInput.control(50);
    expect(component.controlledInput()).toBe(50);
    expect(component.testInput()).toBe(50);
    expect(component.controlledInput.templateValue()).toBe(10); // Still the input value
    expect(component.controlledInput.isControlled()).toBe(true);
    expect(component.controlledInput.controlValue()).toBe(50);

    // Update input - should update controlled value
    await rerender({ componentInputs: { testInput: 20 } });
    expect(component.controlledInput()).toBe(20);
    expect(component.testInput()).toBe(20);
    expect(component.controlledInput.templateValue()).toBe(20);
    expect(component.controlledInput.isControlled()).toBe(false);
    expect(component.controlledInput.controlValue()).toBe(50);
  });

  it('should support model inputs', async () => {
    const { fixture } = await render(TestInputComponent);
    const component = fixture.componentInstance;

    component.controlledModel.control(10);
    fixture.detectChanges();

    expect(component.controlledModel()).toBe(10);
    expect(component.testModel()).toBe(10);
    expect(component.controlledModel.templateValue()).toBe(0);
    expect(component.controlledModel.isControlled()).toBe(true);
    expect(component.controlledModel.controlValue()).toBe(10);

    component.controlledModel.set(20);
    fixture.detectChanges();

    expect(component.controlledModel()).toBe(20);
    expect(component.testModel()).toBe(20);
    expect(component.controlledModel.templateValue()).toBe(20);
    expect(component.controlledModel.isControlled()).toBe(false);
    expect(component.controlledModel.controlValue()).toBe(10);

    component.controlledModel.update(value => value + 1);
    fixture.detectChanges();

    expect(component.controlledModel()).toBe(21);
    expect(component.testModel()).toBe(21);
    expect(component.controlledModel.templateValue()).toBe(21);
    expect(component.controlledModel.isControlled()).toBe(false);
    expect(component.controlledModel.controlValue()).toBe(10);

    component.controlledModel.control(30);
    fixture.detectChanges();

    expect(component.controlledModel()).toBe(30);
    expect(component.testModel()).toBe(30);
    expect(component.controlledModel.templateValue()).toBe(21);
    expect(component.controlledModel.isControlled()).toBe(true);
    expect(component.controlledModel.controlValue()).toBe(30);

    component.controlledModel.reset();
    fixture.detectChanges();

    expect(component.controlledModel()).toBe(21);
    expect(component.testModel()).toBe(21);
    expect(component.controlledModel.templateValue()).toBe(21);
    expect(component.controlledModel.isControlled()).toBe(false);
    expect(component.controlledModel.controlValue()).toBe(30);
  });

  describe('readonly signal', () => {
    it('should return a readonly signal for input', async () => {
      const { fixture } = await render(TestInputComponent);
      const component = fixture.componentInstance;

      const readonlySignal = component.controlledInput.asReadonly();
      expect(readonlySignal).not.toHaveProperty('set');
      expect(readonlySignal).not.toHaveProperty('override');
      expect(readonlySignal).not.toHaveProperty('reset');

      expect(readonlySignal()).toBe(0);
      expect(component.testInput()).toBe(0);
      expect(component.controlledInput.templateValue()).toBe(0);
      expect(component.controlledInput.isControlled()).toBe(false);
      expect(component.controlledInput.controlValue()).toBe(0);

      component.controlledInput.control(10);
      fixture.detectChanges();

      expect(readonlySignal()).toBe(10);
      expect(component.testInput()).toBe(10);
      expect(component.controlledInput.templateValue()).toBe(0);
      expect(component.controlledInput.isControlled()).toBe(true);
      expect(component.controlledInput.controlValue()).toBe(10);
    });

    it('should return a readonly signal for model', async () => {
      const { fixture } = await render(TestInputComponent);
      const component = fixture.componentInstance;

      const readonlySignal = component.controlledModel.asReadonly();
      expect(readonlySignal).not.toHaveProperty('set');
      expect(readonlySignal).not.toHaveProperty('override');
      expect(readonlySignal).not.toHaveProperty('reset');

      expect(readonlySignal()).toBe(0);
      expect(component.testModel()).toBe(0);
      expect(component.controlledModel.templateValue()).toBe(0);
      expect(component.controlledModel.isControlled()).toBe(false);
      expect(component.controlledModel.controlValue()).toBe(0);

      component.controlledModel.control(10);
      fixture.detectChanges();

      expect(readonlySignal()).toBe(10);
      expect(component.testModel()).toBe(10);
      expect(component.controlledModel.templateValue()).toBe(0);
      expect(component.controlledModel.isControlled()).toBe(true);
      expect(component.controlledModel.controlValue()).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw when source is not an input signal', async () => {
      @Component({
        selector: 'error',
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: '',
      })
      class TestErrorComponent {
        controlled: ControlledInput<number> | null = null;

        tryInvalid() {
          this.controlled = controlledInput(42 as any);
        }
      }

      const { fixture } = await render(TestErrorComponent);
      expect(() => fixture.componentInstance.tryInvalid()).toThrow('Source is not a input signal');
    });
  });
});
