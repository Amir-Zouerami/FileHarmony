<h1 align="center">File Harmony</h1>

<p align="center">
  <img src="./icon.png" alt="File Harmony Logo" width="150">
</p>

<p align="center">
  A high-performance, one-way file synchronization extension for VS Code with advanced conflict resolution.
</p>

---

File Harmony is a Visual Studio Code extension engineered for developers who need a reliable and configurable way to keep two directories in sync. It moves beyond simple file copying by providing a robust feature set designed to prevent data loss and give you complete control over the synchronization process, whether you're working with a local development server, managing build artifacts, or deploying to a remote location.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Core Features](#core-features)
- [Installation](#installation)
- [Getting Started: The Control Panel](#getting-started-the-control-panel)
- [Configuration Deep Dive](#configuration-deep-dive)
    - [Sync Mode: `Smart` vs. `Force`](#sync-mode-smart-vs-force)
    - [Conflict Resolution](#conflict-resolution)
    - [The Ignore List](#the-ignore-list)
- [Key Workflows](#key-workflows)
    - [Workflow 1: The "Fire-and-Forget" Live Sync](#workflow-1-the-fire-and-forget-live-sync)

## Core Features

- **High-Performance, Real-Time File Watching:** Uses `chokidar` to efficiently watch for file changes and sync them in real-time with minimal performance overhead.
- **Advanced, Configurable Conflict Resolution:** Never accidentally overwrite work. Define exactly how the extension should behave when it detects that a target file has been modified externally.
- **Comprehensive "Dry Run" Sync Previews:** See a full, color-coded report of all pending creations, updates, deletions, and conflicts before you commit to a manual sync.
- **Integrated Side-by-Side Diff Viewing:** From the preview panel, open a standard VS Code diff view for any file marked for update or conflict to inspect the changes.
- **Persistent & Actionable Error States:** A robust UI state that ensures you never miss a critical sync error. The status bar will remain in an error state until you manually acknowledge it.
- **Glob-Powered, Multi-level Ignore Patterns:** Use powerful and familiar glob patterns (`**/node_modules`) to precisely exclude files and folders from the synchronization process.


## Installation

1.  Open **Visual Studio Code**.
2.  Go to the **Extensions** view (`Ctrl+Shift+X`).
3.  Search for `File Harmony`.
4.  Click **Install**.

## Getting Started: The Control Panel

After installation, you will find the File Harmony icon in your activity bar. Clicking it opens the main control panel, which is the central hub for all configuration.

1.  **Source & Target Paths:** These are the foundational inputs for the sync process. The **Source Path** is the directory you will work in, and the **Target Path** is where the files will be copied to.

2.  **Ignore List UI:** This is an interactive list for defining which files and folders to exclude from the sync. Type a glob pattern into the input box and click the `+` button to add it. Click the `x` on any pill to remove it.

3.  **Sync Mode:** This segmented control determines the core strategy for the sync operation. Choose between `Smart` for speed and safety, or `Force` for creating an exact mirror.

4.  **Conflict Resolution:** This dropdown menu is the heart of the extension's safety features. It allows you to define exactly what should happen when a conflict is detected during a `Smart` sync.

5.  **Sync Status:** This is the master switch for the live, real-time file watcher. When this is ON, the extension will automatically sync changes as they happen. When OFF, all syncing must be done manually.

6.  **Action Buttons:**
    *   **Preview:** Performs a "dry run" of the sync and opens a detailed report without changing any files.
    *   **Sync Now:** Executes a full, one-time bulk sync based on the current settings.
    *   **Save:** Saves your current configuration to the workspace state.

7.  **Unsaved Indicator:** The **Save** button will glow with a subtle pulse effect whenever you have made changes to the configuration that have not yet been saved. This glow disappears once you click Save.

8.  **Secondary Actions:**
    *   **View Activity Log:** Opens a detailed, real-time log viewer panel that shows every action the extension takes.
    *   **Reset Settings:** Resets all settings in the control panel to their default values for the current workspace.

9.  **Status Indicators:**
    *   **Last Synced:** This timestamp at the bottom shows when the last successful file operation occurred, providing a quick check on the extension's activity.



## Configuration Deep Dive

Understanding the core settings is key to unlocking the full power and safety of File Harmony. These options allow you to tailor the synchronization behavior to your specific needs.

#### Sync Mode: `Smart` vs. `Force`

This setting controls the fundamental logic of the sync operation.

*   **Smart (Default):** This is the recommended mode for most use cases. It performs a check before copying and will only overwrite a target file if the source file is determined to be newer. This is the only mode where the **Conflict Resolution** logic is active, providing the highest level of safety against data loss.

*   **Force Overwrite:** This is a direct, brute-force mode. It will overwrite every file in the target directory that also exists in the source, regardless of timestamps or content. This is useful when you need to guarantee that the target is an exact mirror of the source. **Use with caution**, as this mode bypasses all safety checks and will not trigger conflict resolution.

#### Conflict Resolution

This setting is the heart of File Harmony's safety features and is only active when using the `Smart` Sync Mode.

First, it is critical to understand what a "conflict" is in this context. A conflict is detected when: **the target file has been modified since the last successful sync operation performed by the extension.** This prevents false positives and ensures we only flag files that have been genuinely altered by an external process.

You can choose one of four strategies to handle this situation:

*   **Source Wins (Default):** Automatically overwrites the modified target file. This strategy operates on the philosophy that the source directory is always the single source of truth. A warning is logged to the Activity Log when this happens.
*   **Target Wins:** Automatically skips the file, preserving the changes made in the target directory. This is useful when you are intentionally making manual hotfixes or changes in the target that you don't want to be overwritten.
*   **Log Error and Skip:** This is the safest automated option. It skips the file and puts the extension into a **persistent error state** (the status bar icon will turn red and stay red). This requires you to manually acknowledge the error by clicking the status bar item, ensuring you never miss a critical conflict.
*   **Ask:** This interactive mode is designed for the live auto-sync workflow. It pauses the sync for the conflicting file and displays a modal dialog, prompting you to decide what to do.

#### The Ignore List

The ignore list allows you to exclude specific files or folders from the sync process. It uses `micromatch` for robust pattern matching, giving you fine-grained control.

**Best Practices:**
For the most reliable behavior, especially in projects with nested directories, it is highly recommended to use the `**/` globstar prefix to match directories at any depth.

*   **Good, Robust Patterns:**
    ```
    **/node_modules
    **/.git
    **/*.log
    build/
    ```*   **Less Reliable Pattern:**
    ```
    node_modules  // Might not match nested instances like 'frontend/node_modules'
    ```

## Key Workflows

The configuration options above enable two distinct and powerful workflows, allowing you to choose between speed and deliberation.

#### Workflow 1: The "Fire-and-Forget" Live Sync

*   **Use Case:** You are actively developing in a source directory and want immediate, automatic mirroring to a target, such as a local development server's public folder or a compiled output directory.
*   **Setup:**
    1.  Set **Conflict Resolution** to your preferred automated behavior (`Source Wins`, `Target Wins`, or `Log Error and Skip`).
    2.  Turn **Sync Status** ON.
    3.  Click **Save**.
*   **Result:** The extension will now run in the background. As you save files, they will be instantly synced. Any conflicts will be handled automatically based on your chosen strategy, and the status bar will provide all the necessary feedback, alerting you to a persistent error state if one occurs