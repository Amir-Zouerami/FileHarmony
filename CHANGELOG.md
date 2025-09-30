# Change Log

All notable changes to this project will be documented in this file.

The format is based on on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2025-10-01

### Changed

-   Migrated all settings to `.vscode/settings.json` to allow for sharable workspace configurations.
-   Refactored core sync logic, breaking down the main `SyncManager` into smaller, dedicated services.
-   Centralized all command IDs and string constants into a single file for better maintainability.

### Fixed

-   Prevented errors when attempting to save settings or run a sync without an open workspace folder.
-   The "Save" button's unsaved indicator now correctly activates when settings are modified externally in `settings.json`.
-   File system errors during a live sync (e.g., permission denied) now properly trigger the persistent error state in the status bar.

## [2.0.0] - 2025-09-30

### Added

-   **Advanced Conflict Resolution:** Implemented a core safety system to handle cases where a target file has been modified.
-   **Four Resolution Strategies:** Added a dropdown in the UI to choose between `Source Wins`, `Target Wins`, `Log Error and Skip`, and `Ask`.
-   **Interactive "Ask" Mode:** When a conflict occurs during a live sync, a native VS Code dialog now prompts the user for an action (Overwrite, Skip, or View Diff).
-   **"Preview Changes" Mode:** Added a "Preview" button that performs a full "dry run" of the sync, showing all pending creations, updates, deletions, and conflicts in a new panel.
-   **Integrated Diff View:** Files listed in the Preview Panel can now be clicked to open a standard side-by-side diff view.
-   **Persistent Error State:** The status bar now enters a persistent error mode if a conflict occurs with the "Log Error" setting, requiring manual user acknowledgement to be cleared.
-   **"Unsaved Changes" Indicator:** The "Save" button now glows to indicate when configuration changes have not yet been saved.
-   **"Reset Settings" Button:** Added a button to the UI to reset the workspace's configuration back to the defaults.
-   **Checksum-Based Comparison:** For ambiguous cases where file sizes are identical and timestamps are very close, the extension now performs a SHA-256 checksum to definitively determine if files are different.

### Changed

-   **Improved File Comparison Engine:** The core file comparison logic was rewritten to use a robust, multi-stage hybrid strategy (Size -> Timestamp -> Checksum) for maximum performance and accuracy.
-   **Redefined "Conflict" Logic:** The definition of a conflict for the live watcher is now correctly based on whether the target file was modified *since the last successful sync*, making conflict detection far more accurate.
-   **Improved Default Ignore Patterns:** The default ignore list now uses robust globstar patterns (e.g., `**/node_modules`) to correctly ignore directories at any depth.
-   **Improved "Sync Now" Behavior:** The "Sync Now" button is now disabled when "Ask" mode is selected to prevent a "dialog hell" scenario, with a tooltip explaining why.

### Fixed

-   **Critical Timestamp Preservation Bug:** Fixed a major flaw where copied files did not retain their original modification timestamps, which caused the extension to immediately flag its own work as a conflict.
-   **Critical Conflict Detection Bug:** Fixed a bug where the live watcher would incorrectly overwrite a modified target file without flagging it as a conflict.
-   **"Sync Now" False Positives:** Fixed an issue where running "Sync Now" multiple times would generate false conflict warnings due to minor filesystem timestamp inaccuracies.
-   **"Unsaved Changes" UI Bug:** Fixed a bug where the "Save" button would remain glowing even after changes were successfully saved.
-   **"Reset Settings" UI Bug:** Fixed multiple issues where the "Reset Settings" button was unresponsive due to a missing message handler and a sandboxed `confirm()` dialog.

## [1.1.1] - 2024-11-30

### Fixed

-   the readme image url is now fixed.

## [1.1.0] - 2024-11-30

### Added

-   completed the `README.md` file with a short explanation about the extension.

### Changed

-   lowered the minimum supported vscode version to `1.54.0`.

## [1.0.1] - 2024-11-29

### Fixed

-   an error finding the initial webview html was fixed.

## [1.0.0] - 2024-11-29

### Added

-   v1.0 Initial mechanism and functionality implemented.

### Changed

-   Clean up by breaking functionalities into different classes.
-   Choosing `chokidar` to handle syncing. I give up.
-   final cleanups

### Fixed

-   Bug squashing for a good amount of time. This is what I get for trying to manually do things without using packages.