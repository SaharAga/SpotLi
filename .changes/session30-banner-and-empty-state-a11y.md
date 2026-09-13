---
type: patch
---

Accessibility hardening for `FeatureNudgeBanner`, `FirstTimeEmptyState`, and `InstallPwaBanner`:

**FeatureNudgeBanner**:
- Banner root upgraded to `role="region"` with `aria-label` matching nudge title for landmark navigation.
- Decorative icon container and arrow icons marked `aria-hidden="true"`.
- Suppress-permanently button gains explicit `aria-label`.
- Close X icon marked `aria-hidden="true"`.

**FirstTimeEmptyState**:
- Header Sparkles badge icon marked `aria-hidden="true"`.
- All three tile icon containers (`Mail`, `MessageSquareText`, `Sparkles`) marked `aria-hidden="true"`.
- Added `id` to each tile `<h3>` and `<p>` description elements.
- Gmail, SMS, and Demo CTA buttons gain `aria-describedby` linking to their tile description paragraph.
- Arrow icons and Plus icon in buttons marked `aria-hidden="true"`.

**InstallPwaBanner**:
- Added `type="button"` to all three main banner buttons (Dismiss X, Install App, Not Now).
- Enforced `min-h-[48px]` on Install App and Not Now buttons (previously ~34px).
- Added `aria-label` to Install App and Not Now buttons.
- Enlarged Dismiss X button to `min-h-[48px] min-w-[48px]`.
- `Download` icon inside Install button marked `aria-hidden="true"`.
- iOS guide modal promoted to `role="dialog"` + `aria-modal="true"` + `aria-labelledby="ios-guide-title"`.
- `<h3>` in guide gets `id="ios-guide-title"`.
- Guide close X button gains `type="button"`, `aria-label`, `min-h-[48px] min-w-[48px]`.
- Got It button gains `type="button"` and `min-h-[48px]`.
- Step number badge `<span>` elements and inline icons (`Share`, `PlusSquare`, `Smartphone`) marked `aria-hidden="true"`.

New DOM tests: 17 new tests across `FeatureNudgeBanner.dom.test.jsx`, `FirstTimeEmptyState.dom.test.jsx`, and `InstallPwaBanner.dom.test.jsx`.
