# Anime Tracker — Development Plan

## Non-negotiable compatibility requirements

- Keep Capacitor app ID `com.animeapp.tracker` and app name `Animelist` unchanged.
- Keep the existing IndexedDB database name `anime_tracker_db`, current stores, and schema version unless a carefully tested additive migration is required.
- Preserve existing anime IDs, list IDs, `order`, image data, settings, vault notes, and import/export compatibility.
- Preserve the current card layout and current image sizing/compression behavior. Do not upscale existing artwork or replace it with generated/enlarged images.
- Do not add automatic backups. Keep backup/export user-initiated.
- A new Android APK is an in-place update only if it has the same package ID and is signed with the exact same signing certificate/private key as the installed APK.

## Phase 1 — Manual ordering safety (implemented in this source update)

- Manual drag is available only in manual sort mode and when the full current list is visible.
- Search, status filters, pinned-only, hide-finished, and continue-watching filters disable drag handles.
- Temporary sort modes never write to the stored `order` field.
- Dragging is limited to the pinned or unpinned group so the pinned-at-top rule remains predictable.
- Save the complete visible list order only after verifying that every item in the current list is present.
- Handle pointer cancellation without persisting a partial drag.
- Keep the existing IndexedDB schema at version 4.

## Phase 2 — Search and filters

- Add combined filters for year, rating, episode count, studio, genre/tags, and status.
- Add clear-all and optional saved filter presets.
- Keep filtering as a view operation; never mutate `order`.

## Phase 3 — Statistics dashboard

- Calculate totals and status breakdowns from existing records.
- Add rating distribution, top-rated titles, release-year distribution, and monthly activity where source data exists.
- Avoid storing duplicate aggregates in IndexedDB.

## Phase 4 — Anime details

- Extend the existing detail view with optional metadata fields.
- Old records remain valid when new fields are absent.
- Do not require users to fill new fields to keep using existing records.

## Phase 5 — Calendar

- Add manually editable episode/release dates first.
- Only show externally sourced release dates when verified and clearly attributed.

## Phase 6 — Kanban

- Add a board view over existing statuses.
- Moving a card between columns updates the anime's actual status; board display order remains separate from manual list order.

## Phase 7 — Gallery

- Reuse existing image data and preserve current image dimensions/quality.
- Use bounded thumbnails and lazy loading; do not upscale low-resolution images.

## Phase 8 — Comparison

- Compare selected records using fields already available, with missing values shown as unavailable rather than guessed.

## Phase 9 — Bulk management

- Extend bulk selection for status changes, ratings, tags, pinning, copy/move, and deletion.
- Confirm destructive actions and preserve existing item IDs unless duplication explicitly creates a new record.

## Android update signing blocker

The included `apk/app-debug.apk` is signed with an Android Debug certificate. The archive does not contain the corresponding private keystore, and a certificate extracted from an APK cannot be used to sign another APK. The Android project/Gradle wrapper is also not included; the current workflow generates a fresh Android project and debug keystore on the hosted runner. Therefore, do not install a newly built APK over the existing installation until the original signing keystore is recovered and the new APK's signing certificate is verified to match. The web-source update can be prepared independently, but an in-place APK update cannot be guaranteed from this archive alone.
