# Sourcebook 0.2.11

Sourcebook is a local-first material and note workspace for creative projects.
It keeps existing Vault files, media, web captures, links, posts, short text,
and supported AI conversations together in project-based Books.

## Highlights

- Select multiple materials, open **More → Move to another Book**, choose a
  destination, and explicitly **Copy** or **Move** their Book memberships.
  The original Vault files remain one shared source; they are never copied.
- Restores the bottom batch-selection icon to a fixed, readable size beside
  **Send to AI**.

## File clipboard fixes

- Fixes **Copy files** on macOS. Selected files now become native `NSURL` file
  objects on the system clipboard, so compatible AI upload inputs receive real
  attachments instead of a non-pasteable file reference.
- On Windows, selected files now use the native `CF_HDROP` clipboard format,
  including paths with Chinese characters or spaces.

## Highlights

- Resolves Community Plugins review feedback: uses Obsidian element helpers,
  removes shell execution, and registers searchable settings definitions.
- Simplifies stylesheet rules by removing forced overrides and expensive
  relational selectors while preserving the Sourcebook UI states.
- Create visual Books for a project, client, film, deck, or creative direction.
- Preserve source links and add Book-specific context for every material.
- Add materials to normal Obsidian notes using native links and embeds.
- Add material in three ways: the Add menu, reviewed clipboard pasting, or the
  optional paired Sourcebook Picker browser extension.
- Select materials and copy a focused AI-ready context with the associated
  creative notes.
- Optionally pair the local Sourcebook Picker browser extension to collect
  material from the web.

## Install

Download `main.js`, `manifest.json`, and `styles.css`. Place all three files
in `<your-vault>/.obsidian/plugins/sourcebook/`, then enable Sourcebook in
**Settings → Community plugins**.

## Requirements and privacy

- Requires Obsidian 1.13.0 or later on desktop.
- Sourcebook works only in the Vault you open. It does not upload Vault content
  or contact a remote service.
- Sourcebook Picker is optional and connects only after a local pairing action.
- File attachment copy is available only after an explicit user action. It uses
  the system clipboard and creates short-lived text attachments only when a
  selected text record needs to be pasted as a file.
- Cmd/Ctrl+V on the Sourcebook surface can prepare files, public links, or
  short text for import. It presents the first 20 items for review, labels
  unsupported items, and writes nothing until the user confirms.
- Local file imports no longer impose a 25 MB application limit. Copying files
  for AI uses Electron's native file clipboard format on macOS and Windows.
- **Show in folder** is attached to the local file's Path field in its detail
  view and directly opens its containing folder for a faster Finder response.

## Verification

When the repository is public, draft releases created from this workflow
attach GitHub build provenance attestations for each standalone asset. Private
repository drafts skip that GitHub-hosted step because GitHub does not offer
attestation storage for personal private repositories.

Before publishing this draft, complete real-app tests on a copy of a Vault.
See the [README](README.md) for product details and [CONTRIBUTING.md](CONTRIBUTING.md)
for development guidance.
