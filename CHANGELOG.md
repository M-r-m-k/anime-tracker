# Changelog

## Source update — Manual ordering safety

- Prevented drag-and-drop while a temporary sort or any active filter/search is applied.
- Prevented dragging across pinned and unpinned groups.
- Added a full-list integrity check before saving manual order.
- Added pointer-cancel handling to avoid persisting an interrupted drag.
- Kept IndexedDB database name and schema version unchanged (`anime_tracker_db`, v4).
- Preserved the current image resizing settings and existing card styles.
