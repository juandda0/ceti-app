import { useCetiOverlayStore, showCetiToast } from './useCetiOverlayStore';

const reset = () => useCetiOverlayStore.setState({ toasts: [], notice: null, confirm: null });

describe('useCetiOverlayStore toasts', () => {
  beforeEach(reset);

  it('errores duran más que éxitos/info', () => {
    showCetiToast({ variant: 'error', title: 'x' });
    showCetiToast({ variant: 'success', title: 'y' });
    const [err, ok] = useCetiOverlayStore.getState().toasts;
    expect(err.durationMs).toBe(4500);
    expect(ok.durationMs).toBe(3000);
    expect(err.id).not.toBe(ok.id);
  });

  it('apila máximo 3 (los más viejos ceden)', () => {
    for (let i = 0; i < 5; i++) showCetiToast({ variant: 'info', title: String(i) });
    const { toasts } = useCetiOverlayStore.getState();
    expect(toasts.map((t) => t.title)).toEqual(['2', '3', '4']);
  });

  it('dismiss quita solo el toast indicado', () => {
    showCetiToast({ variant: 'info', title: 'a' });
    showCetiToast({ variant: 'info', title: 'b' });
    const first = useCetiOverlayStore.getState().toasts[0];
    useCetiOverlayStore.getState().dismissToast(first.id);
    expect(useCetiOverlayStore.getState().toasts.map((t) => t.title)).toEqual(['b']);
  });
});
