# Architecture

Sourcebook is designed around one rule: existing project material should retain
one authoritative copy in the Vault.

## Data model

- Existing Vault files are Book materials directly; Sourcebook does not create
  wrapper Markdown for them.
- Short text and simple links live in readable Book entries.
- Book membership, ordering, and Book-specific notes live in the Book Markdown
  body.
- Project notes use native Obsidian links or embeds for files, and ordinary
  Markdown for text and Book context. This preserves file backlinks while making
  inserted prose user-owned and freely editable.
- Optional Picker captures retain their source URL, title, timestamp, and
  available media metadata.

## Modules

- `core.ts`: Book blocks, validation, IDs, registry, and pure data rules.
- `store.ts`: Book and material operations over the `VaultIO` boundary.
- `host.ts`: adapter for Obsidian Vault, FileManager, and workspace APIs.
- `picker-receiver.ts`: local pairing and capture intake for Sourcebook Picker.
- `pack.ts`: explicit AI-handoff selection and prompt construction.
- `clipboard.ts`: optional native original-file clipboard support.
- `view.ts`, `ui.ts`: ItemView and modal user interfaces.
- `main.ts`: plugin lifecycle, rename tracking, commands, and settings.

## Vault layout

```text
Sourcebook/
  Books/          readable Book Markdown
  Project Notes/  project notes created from selected material
  Assets/         files explicitly imported from outside the Vault
  _data/          optional provenance and import metadata
```

`Sourcebook/_data/library.json` stores optional provenance and import details;
the Book Markdown remains the source of truth for membership, ordering, content,
and Book notes.

## Safety boundaries

- File writes are serialized and use Obsidian's Vault APIs.
- Removing a material unlinks it from a Book without deleting its original file.
- Sourcebook does not recursively scan unrelated note bodies.
- The optional Picker receiver is local-only and requires explicit pairing.
- AI handoff is explicit: users select the material to include. Link helper
  Markdown remains navigational and is not attached as an original file.

## Working on the plugin

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup, checks, and pull-request
expectations.
