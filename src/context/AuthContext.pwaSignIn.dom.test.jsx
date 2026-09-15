/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Firebase itself is unconfigured in tests, so the auth module is mocked down
// to the three calls this behaviour turns on: which sign-in method is used.
const authApi = vi.hoisted(() => ({
  signInWithPopup: vi.fn(async () => ({ user: null })),
  signInWithRedirect: vi.fn(async () => undefined),
  getRedirectResult: vi.fn(async () => null)
}));

vi.mock('firebase/auth', () => ({
  ...authApi,
  onAuthStateChanged: (_auth, cb) => { cb(null); return () => {}; },
  GoogleAuthProvider: class { setCustomParameters() {} addScope() {} },
  OAuthProvider: class { setCustomParameters() {} addScope() {} },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  sendEmailVerification: vi.fn()
}));

vi.mock('../services/firebase', () => ({
  auth: { currentUser: null },
  db: null,
  isFirebaseConfigured: true,
  googleProvider: {},
  appleProvider: {},
  facebookProvider: {},
  getAppCheckDiagnostic: () => ({ state: 'unconfigured', detail: '' }),
  whenAppCheckSettled: () => Promise.resolve({ state: 'unconfigured', detail: '' })
}));

function Harness({ onReady }) {
  const auth = useAuth();
  React.useEffect(() => { onReady(auth); }, [auth, onReady]);
  return null;
}

const mountAuth = async () => {
  let api = null;
  await act(async () => {
    render(
      <AuthProvider>
        <Harness onReady={(a) => { api = a; }} />
      </AuthProvider>
    );
  });
  return () => api;
};

describe('Google sign-in chooses a flow the current display mode can finish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.navigator.standalone;
  });
  afterEach(cleanup);

  it('redirects instead of opening a popup inside an installed PWA', async () => {
    // The reported iPhone bug: installed to the home screen, the Google button
    // spun forever. signInWithPopup never settles there — no rejection, so no
    // error-code fallback could have saved it.
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });

    const getApi = await mountAuth();
    await act(async () => { await getApi().loginWithGoogle(); });

    expect(authApi.signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(authApi.signInWithPopup).not.toHaveBeenCalled();
  });

  it('still uses a popup in an ordinary browser tab', async () => {
    const getApi = await mountAuth();
    await act(async () => { await getApi().loginWithGoogle(); });

    expect(authApi.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(authApi.signInWithRedirect).not.toHaveBeenCalled();
  });
});
