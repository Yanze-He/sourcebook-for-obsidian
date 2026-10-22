# Changelog

All notable changes to Sourcebook for Obsidian are documented here.

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
