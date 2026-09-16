/**
 * How the app is being displayed: a browser tab, or an installed app.
 *
 * The distinction is not cosmetic. An installed PWA runs in a window the
 * browser treats as its own application context, and on iOS that context
 * cannot complete an OAuth *popup*: the provider page opens somewhere the app
 * cannot reach, and the sign-in promise neither resolves nor rejects. Auth has
 * to choose the redirect flow before it starts, not recover afterwards — there
 * is nothing to recover from, only a button that spins forever.
 */

/**
 * Whether the app is running as an installed PWA rather than in a browser tab.
 *
 * `navigator.standalone` is iOS's own flag for a home-screen web app and is
 * checked first because it is the case that matters most here. The
 * `display-mode` queries cover installed apps everywhere else, including the
 * two modes other than `standalone` that a manifest can ask for — an app
 * installed as `fullscreen` or `minimal-ui` is just as unable to use a popup.
 *
 * @param {Window} [win] window to inspect; defaults to the global one
 * @returns {boolean}
 */
export function isStandalonePwa(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;

  if (win.navigator?.standalone === true) return true;

  if (typeof win.matchMedia !== 'function') return false;
  return ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => {
    try {
      return win.matchMedia(`(display-mode: ${mode})`).matches;
    } catch {
      // Safari has historically thrown on an unknown media feature rather
      // than reporting no match.
      return false;
    }
  });
}
