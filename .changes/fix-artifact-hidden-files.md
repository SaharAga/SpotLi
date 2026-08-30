---
type: patch
---

`actions/upload-artifact@v4` silently drops dotfiles/dot-directories unless `include-hidden-files: true` is set, so `public/.well-known/` never actually reached production despite firebase.json's ignore config being correct — that was the real cause of the Strix domain-verification file being unreachable.
