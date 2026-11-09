# Responsive input and layout verification

2026-11-09, integrated local checkout at port 8100. Validation uses real headless Chrome through CDP; this is layout/input evidence, not a hardware-performance claim.

```sh
node project/tools/mobile_ui_validation.mjs http://localhost:8100/
```

Tested desktop 1280×720, portrait touch 375×812, landscape touch 812×375. Screenshots and machine-readable report are written to `/tmp/lmu-mobile-ui-sol/`.

## Changes

- Reserved separate rows for the four-line control legend and current quest. The atlas button no longer covers the quest card.
- Portrait touch layout separates the mini-map, journal, atlas, sound button and movement controls. Main touch actions retain their existing 56px targets; atlas close and place actions now provide 44px targets.
- Short landscape suppresses the redundant status legend and miniature map while retaining the full G atlas, objective and movement controls.
- The atlas sidebar scrolls in short landscape so destination actions remain reachable above the footer. The portrait atlas scrolls as a whole.
- Short-window title/settings screens scroll from the top rather than placing overflowing centred content above the viewport.

## Verified

Three viewport scenarios passed bounds checks, independent utility-panel separation, G opening the atlas, native Enter selecting a focused destination, W/P suppression while the atlas owns input, and Escape closing/releasing its movement lock. Fast-travel actions are reachable by scrolling/focus. Screenshots include walking HUD, atlas and pause screens for all sizes. No browser errors occurred.

CSS changes stay in date_story.css, date_title.css, date_input.css and lmu_world.css. No input routing JavaScript or inline index styles were changed. The photograph overlay stylesheet was inspected but is owned by the photography task; no changes were made there.
