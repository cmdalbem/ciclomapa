import { createRef } from 'react';
import {
  getFocusableElements,
  handleModalKeyDown,
  restoreModalFocus,
  setupModalFocus,
} from './modalFocusTrap';

function makeFocusableVisible(el: HTMLElement) {
  Object.defineProperty(el, 'offsetParent', {
    configurable: true,
    value: document.body,
  });
}

describe('getFocusableElements', () => {
  it('returns an empty array for nullish container', () => {
    expect(getFocusableElements(null)).toEqual([]);
    expect(getFocusableElements(undefined)).toEqual([]);
  });

  it('returns focusable visible elements in DOM order', () => {
    const root = document.createElement('div');
    const a = document.createElement('button');
    a.textContent = 'A';
    const b = document.createElement('a');
    b.href = '#';
    b.textContent = 'B';
    const disabled = document.createElement('button');
    disabled.setAttribute('disabled', '');
    root.append(a, b, disabled);
    document.body.appendChild(root);
    makeFocusableVisible(a);
    makeFocusableVisible(b);
    makeFocusableVisible(disabled);

    const focusable = getFocusableElements(root);
    expect(focusable).toEqual([a, b]);

    document.body.removeChild(root);
  });
});

describe('handleModalKeyDown', () => {
  it('calls onClose and prevents default on Escape', () => {
    const onClose = jest.fn();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalKeyDown(event, { current: null }, onClose);

    expect(preventDefault).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('wraps focus from last to first on Tab', () => {
    const root = document.createElement('div');
    const first = document.createElement('button');
    first.textContent = 'first';
    const last = document.createElement('button');
    last.textContent = 'last';
    root.append(first, last);
    document.body.appendChild(root);
    makeFocusableVisible(first);
    makeFocusableVisible(last);
    last.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalKeyDown(event, { current: root }, jest.fn());

    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(first);

    document.body.removeChild(root);
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    const root = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('button');
    root.append(first, last);
    document.body.appendChild(root);
    makeFocusableVisible(first);
    makeFocusableVisible(last);
    first.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalKeyDown(event, { current: root }, jest.fn());

    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(last);

    document.body.removeChild(root);
  });
});

describe('setupModalFocus and restoreModalFocus', () => {
  it('focuses container then first focusable; restore returns focus to previous element', () => {
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    const modal = document.createElement('div');
    modal.tabIndex = -1;
    const inner = document.createElement('button');
    inner.textContent = 'inner';
    modal.appendChild(inner);
    document.body.append(outside, modal);
    makeFocusableVisible(inner);

    outside.focus();
    expect(document.activeElement).toBe(outside);

    const containerRef = createRef<HTMLDivElement>();
    containerRef.current = modal;
    const prevRef = createRef<Element | null>();
    setupModalFocus(containerRef, prevRef);

    expect(document.activeElement).toBe(inner);

    restoreModalFocus(prevRef);
    expect(document.activeElement).toBe(outside);

    document.body.removeChild(outside);
    document.body.removeChild(modal);
  });
});
