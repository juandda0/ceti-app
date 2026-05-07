import { useAuthStore } from '@features/auth/store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      userRole: null,
      lastLogin: null,
      authReady: false,
      firebaseUid: null,
      linkedFamilyId: null,
    });
  });

  it('markAuthReady pone authReady en true', () => {
    useAuthStore.getState().markAuthReady();
    expect(useAuthStore.getState().authReady).toBe(true);
  });

  it('logout restaura estado inicial y mantiene authReady true', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      userRole: 'parent',
      lastLogin: 1,
      authReady: true,
      firebaseUid: 'x',
      linkedFamilyId: null,
    });
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.userRole).toBeNull();
    expect(s.authReady).toBe(true);
  });
});
