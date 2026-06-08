import { useAuthStore } from '@features/auth/store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      lastLogin: null,
      authReady: false,
      firebaseUid: null,
    });
  });

  it('markAuthReady pone authReady en true', () => {
    useAuthStore.getState().markAuthReady();
    expect(useAuthStore.getState().authReady).toBe(true);
  });

  it('logout restaura estado inicial y mantiene authReady true', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      lastLogin: 1,
      authReady: true,
      firebaseUid: 'x',
    });
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.lastLogin).toBeNull();
    expect(s.authReady).toBe(true);
  });
});
