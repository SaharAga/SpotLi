/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthModal } from './AuthModal';
import { renderWithLanguage } from '../test-utils/renderWithProviders';

function getSubmitButton(name) {
  return screen.getAllByRole('button', { name }).find((btn) => btn.type === 'submit');
}

// AuthContext talks to Firebase, which is unconfigured in tests (no env
// vars). Mocking useAuth lets these tests exercise the form's own
// validation and submit wiring without needing a real Firebase project —
// the same reason no test in this repo has rendered AuthModal before.
const authMocks = vi.hoisted(() => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  resetPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  logout: vi.fn(),
  deleteUserAccountAndData: vi.fn()
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loginWithGoogle: authMocks.loginWithGoogle,
    loginWithApple: authMocks.loginWithApple,
    loginWithEmail: authMocks.loginWithEmail,
    registerWithEmail: authMocks.registerWithEmail,
    resetPassword: authMocks.resetPassword,
    deleteUserAccountAndData: authMocks.deleteUserAccountAndData,
    logout: authMocks.logout
  })
}));

describe('AuthModal (rendered)', () => {
  beforeEach(() => {
    cleanup();
    Object.values(authMocks).forEach((fn) => fn.mockReset());
  });

  describe('install-first note', () => {
    const setUserAgent = (ua) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
    };
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
    const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';

    afterEach(() => {
      delete window.navigator.standalone;
    });

    it('offers installing first on an iPhone that has not installed yet', () => {
      // A session created in Safari is invisible to the home-screen app, so
      // signing in here costs the person a second sign-in after installing.
      setUserAgent(IPHONE);
      renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);
      expect(screen.getByText(/install the app first/i)).toBeInTheDocument();
    });

    it('does not nag Android, where the browser and the installed app share a session', () => {
      setUserAgent(ANDROID);
      renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);
      expect(screen.queryByText(/install the app first/i)).not.toBeInTheDocument();
    });

    it('does not show it once the app is already installed', () => {
      setUserAgent(IPHONE);
      Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
      renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);
      expect(screen.queryByText(/install the app first/i)).not.toBeInTheDocument();
    });

    it('leaves the sign-in form usable — it is advice, not a gate', async () => {
      setUserAgent(IPHONE);
      const user = userEvent.setup();
      renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);

      await user.type(screen.getByPlaceholderText('you@domain.com'), 'tester@example.com');
      await user.type(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), 'somepassword1!');
      await user.click(getSubmitButton(/sign in$/i));

      expect(authMocks.loginWithEmail).toHaveBeenCalled();
    });

    it('shows the install steps on demand', async () => {
      setUserAgent(IPHONE);
      const user = userEvent.setup();
      renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);

      const bannerBtn = screen.getByRole('button', { name: /install the app first/i });
      expect(bannerBtn).toHaveAttribute('aria-haspopup', 'dialog');
      expect(screen.getByText(/Tap for quick Safari installation steps/i)).toBeInTheDocument();

      await user.click(bannerBtn);
      expect(await screen.findByText(/Add to Home Screen/i)).toBeInTheDocument();
    });
  });

  it('rejects an invalid email without calling loginWithEmail', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('you@domain.com'), 'not-an-email');
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepassword1!');
    await user.click(getSubmitButton(/sign in$/i));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(authMocks.loginWithEmail).not.toHaveBeenCalled();
  });

  it('signs in with trimmed credentials and closes on success', async () => {
    authMocks.loginWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('you@domain.com'), '  test@example.com  ');
    await user.type(screen.getByPlaceholderText('••••••••'), 'correcthorse1!');
    await user.click(getSubmitButton(/sign in$/i));

    await vi.waitFor(() => {
      expect(authMocks.loginWithEmail).toHaveBeenCalledWith('test@example.com', 'correcthorse1!');
    });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('surfaces the thrown error message when sign-in fails, without closing', async () => {
    authMocks.loginWithEmail.mockRejectedValue(new Error('Wrong password.'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('you@domain.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'correcthorse1!');
    await user.click(getSubmitButton(/sign in$/i));

    expect(await screen.findByText('Wrong password.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('enforces the register tab\'s stronger password rules before submitting', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^register$/i }));
    await user.type(screen.getByPlaceholderText('e.g. Alex Cohen'), 'Alex Cohen');
    await user.type(screen.getByPlaceholderText('you@domain.com'), 'alex@example.com');

    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordFields[0], 'onlyletters'); // no number, no symbol
    await user.type(passwordFields[1], 'onlyletters');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/password must include both letters and numbers/i)).toBeInTheDocument();
    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords on register', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="register" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('e.g. Alex Cohen'), 'Alex Cohen');
    await user.type(screen.getByPlaceholderText('you@domain.com'), 'alex@example.com');
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordFields[0], 'Correct1!Horse');
    await user.type(passwordFields[1], 'Different1!Horse');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match\. please re-enter/i)).toBeInTheDocument();
    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
  });

  it('blocks registration until the Terms of Use / Privacy Policy checkbox is checked', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="register" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('e.g. Alex Cohen'), 'Alex Cohen');
    await user.type(screen.getByPlaceholderText('you@domain.com'), 'alex@example.com');
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordFields[0], 'Correct1!Horse');
    await user.type(passwordFields[1], 'Correct1!Horse');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/must agree to the terms of use/i)).toBeInTheDocument();
    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
  });

  it('registers with a valid form and calls onShowToast', async () => {
    authMocks.registerWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onShowToast = vi.fn();
    renderWithLanguage(
      <AuthModal isOpen initialMode="register" onClose={vi.fn()} onShowToast={onShowToast} />
    );

    await user.type(screen.getByPlaceholderText('e.g. Alex Cohen'), 'Alex Cohen');
    await user.type(screen.getByPlaceholderText('you@domain.com'), 'alex@example.com');
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordFields[0], 'Correct1!Horse');
    await user.type(passwordFields[1], 'Correct1!Horse');
    await user.click(screen.getByText(/agree to the/i).closest('label').querySelector('input[type="checkbox"]'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await vi.waitFor(() => {
      expect(authMocks.registerWithEmail).toHaveBeenCalledWith(
        'alex@example.com', 'Correct1!Horse', 'Alex Cohen', { aiTrainingOptIn: false }
      );
    });
    expect(onShowToast).toHaveBeenCalledWith(expect.stringMatching(/created/i), 'success');
  });

  it('passes the AI-training opt-in choice through to registerWithEmail when checked', async () => {
    authMocks.registerWithEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="register" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('e.g. Alex Cohen'), 'Alex Cohen');
    await user.type(screen.getByPlaceholderText('you@domain.com'), 'alex@example.com');
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwordFields[0], 'Correct1!Horse');
    await user.type(passwordFields[1], 'Correct1!Horse');
    await user.click(screen.getByText(/agree to the/i).closest('label').querySelector('input[type="checkbox"]'));
    await user.click(screen.getByText(/help us improve accuracy/i).closest('label').querySelector('input[type="checkbox"]'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await vi.waitFor(() => {
      expect(authMocks.registerWithEmail).toHaveBeenCalledWith(
        'alex@example.com', 'Correct1!Horse', 'Alex Cohen', { aiTrainingOptIn: true }
      );
    });
  });

  it('sends a password reset link from the forgot-password tab', async () => {
    authMocks.resetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    await user.type(screen.getByPlaceholderText('you@domain.com'), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await vi.waitFor(() => {
      expect(authMocks.resetPassword).toHaveBeenCalledWith('alex@example.com');
    });
    expect(await screen.findByText(/reset link has been sent/i)).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithLanguage(<AuthModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders educational banner when reason is gmail_sync', () => {
    renderWithLanguage(<AuthModal isOpen initialMode="signin" reason="gmail_sync" onClose={vi.fn()} />);
    expect(screen.getByText(/Connect with Google for Gmail Sync|חיבור עם Google לסנכרון Gmail/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Account is required to automatically connect/i)).toBeInTheDocument();
  });

  it('renders the language switcher button and toggles language', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />, { language: 'he' });

    const langBtn = screen.getByRole('button', { name: /switch to english/i });
    expect(langBtn).toBeInTheDocument();
    expect(langBtn).toHaveTextContent('EN');
    expect(langBtn.className).toMatch(/min-h-\[48px\]/);
    expect(langBtn.className).toMatch(/min-w-\[48px\]/);

    await user.click(langBtn);

    expect(screen.getByRole('button', { name: /החלף לעברית/i })).toBeInTheDocument();
    expect(screen.getByText('עב')).toBeInTheDocument();
  });

  it('renders the body container with overflow-y-auto for mobile and desktop scrolling', () => {
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);
    const scrollContainer = document.body.querySelector('[data-modal-panel] .overflow-y-auto');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveClass('overflow-y-auto');
    expect(scrollContainer).toHaveClass('flex-1');
    expect(scrollContainer).toHaveClass('min-h-0');
  });

  it('scrolls body container to top when setFormError is called on submit failure', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<AuthModal isOpen initialMode="signin" onClose={vi.fn()} />);
    const scrollContainer = document.body.querySelector('[data-modal-panel] .overflow-y-auto');
    scrollContainer.scrollTo = vi.fn();

    await user.click(getSubmitButton(/sign in$/i));

    expect(await screen.findByText(/Please enter an email address/i)).toBeInTheDocument();
    expect(scrollContainer.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
