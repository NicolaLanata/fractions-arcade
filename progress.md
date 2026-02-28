Original prompt: In the fractions arcade game all "games" have a "No stars" tag. If stars are never used, we should remove the "No stars" tag altogether. An alternative would be to introduce features that make this useful.

Updates:
- Implemented stars only for timed/scored games (games with bestKey + qCount): stars now equal best greens, clamped to game max (5).
- Removed all "No stars" UI labels from tiles and record rows.
- Non-star games now show no stars row at all.
- Summary and record-book totals now show real stars total (out of 30 for current game set).
- Bumped service worker cache version to force fresh assets.

Validation:
- Verified by source inspection that no "No stars" strings remain in app rendering code.
- Confirmed star display is conditional and tied to eligible games only.
- Node/npx not available in this environment, so Playwright client checks could not be run.

Next TODOs:
- Optional: if you want stars only visible after first play, hide "Stars 0/5" on unplayed scored games and show after first result.
- Optional: remove unused CSS classes .tile-stars-muted and .arcade-record-stars-muted if no longer needed.

2026-02-18 star regression fix:
- Root cause found: profile normalization clamped stars to 0..3 (legacy value), causing 5/5 runs to display as 3 stars after reload.
- Fix: clamp to 0..5 and compute displayed/aggregated stars from bestCorrect (greens) first.
