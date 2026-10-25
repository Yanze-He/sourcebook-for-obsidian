# Changelog

All notable changes to Sourcebook for Obsidian are documented here.

## 0.2.5

- Improve the selected Picker menu item's icon contrast, restore the batch
  selection entry icon's intended size, and make the pairing-code refresh
  control a borderless icon button.
- Add a reviewed Cmd/Ctrl+V import flow for files, public web links, and short
  text pasted onto the Sourcebook surface. It shows the first 20 items,
  explains unsupported items, and retains per-item import results. Normal
  editor and form pasting is unchanged; nothing is saved until confirmed.
- Add a visible **Show in folder** action for local materials. It uses
  Electron to open the containing directory directly, rather than asking
  Finder or File Explorer to select one file.
- Remove the application-level file import size cap. Imports are now bounded
  only by available local memory and Vault storage.
- Use Electron's native copied-file clipboard format for the explicit **Copy
  files** action, avoiding renderer clipboard permission failures on macOS and
  Windows.
- Move **Show in folder** from the detail footer to the local file's **Path**
  field. The action now remains available when only Electron's reveal API is
  exposed by the host.

- Address additional Community Plugins review findings: remove shell execution,
  use Obsidian UI helpers, eliminate forced CSS overrides, and make settings
  searchable in Obsidian 1.13+.
- Use the native file-URI clipboard format for explicitly requested original
  file copies. Short text attachments continue to be generated only for an
  explicit Send to AI action.

## 0.2.3

- Let the release workflow create a testable draft while the repository remains
  private. Asset provenance attestations are generated automatically once the
  repository is public, where GitHub supports storing them.

## 0.2.2

- Address Community Plugins review feedback: remove an unused HTML injection
  path and legacy clipboard fallback, and respect Obsidian's configured trash
  behavior for managed deletions.
- Validate and limit local Picker receiver requests before processing captures.
- Document local filesystem and clipboard boundaries in both READMEs.
- Prepare future draft releases with readable notes and GitHub build provenance
  attestations for the standalone plugin assets.

## 0.2.1

- Organize original Vault files, notes, text, links, and Picker captures into
  project Books.
- Write native project-note links and embeds for files, preserving backlinks to
  their original source.
- Keep short text and Book notes as ordinary editable Markdown in project notes.
- Pair locally with Sourcebook Picker for browser captures.
- Improve material details, media metadata, save feedback, and narrow-panel
  accessibility.
