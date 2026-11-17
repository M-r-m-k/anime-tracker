# Changelog

## Source update — Manual ordering safety

- Prevented drag-and-drop while a temporary sort or any active filter/search is applied.
- Prevented dragging across pinned and unpinned groups.
- Added a full-list integrity check before saving manual order.
- Added pointer-cancel handling to avoid persisting an interrupted drag.
- Kept IndexedDB database name and schema version unchanged (`anime_tracker_db`, v4).
- Preserved the current image resizing settings and existing card styles.

## Source update — Smooth drag and multi-select move

- Drag now follows the finger smoothly, other cards slide aside, and the page auto-scrolls near the screen edges.
- Long-press a card in edit mode to start multi-select; tap more cards, scroll anywhere, then tap a "move here" slot between any two cards (or use "to top" / "to bottom").
- Selection and drag stay inside one group (pinned or normal) and work only in manual sort with no search or filters.
- Added "Undo" after a multi-select move.
- No change to IndexedDB schema (v4), export/import format, or image handling.
