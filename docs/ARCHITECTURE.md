# Architecture / 技术边界

Sourcebook v2 keeps one authoritative copy of content:

- Existing Vault files are materials directly; no wrapper Source Markdown is created.
- Short text and simple links live inside readable Book entries.
- Reusable long text can be promoted to a real Markdown file under `Sourcebook/Materials/`.
- Book membership, order and Book-specific notes live in the Book Markdown body.
- Project notes use native Obsidian links for files and ordinary Markdown for
  text and Book context. This deliberately makes inserted context a user-owned
  snapshot while preserving native file backlinks.
- Quick AI handoff uses original files. Only an explicit snapshot copies files.

## Modules

- `core.ts`: schema-v2 Book blocks, validation, IDs, registry and pure data rules.
- `store.ts`: Book/material operations over the minimal `VaultIO` port.
- `host.ts`: the sole adapter to Obsidian Vault/FileManager/workspace APIs.
- `pack.ts`: quick-handoff plan, prompt and explicit snapshot export.
- `clipboard.ts`: optional native original-file clipboard; off by default.
- `view.ts`, `ui.ts`: native ItemView and Modal UI.
- `main.ts`: plugin lifecycle, rename tracking and settings.

## Vault layout

```text
Sourcebook/
  Books/       readable Book Markdown and entry blocks
  Materials/   promoted reusable text/link Markdown
  Assets/      files explicitly imported from outside the Vault
  _data/       optional source/import metadata only
  Snapshots/   explicit frozen AI handoff snapshots
```

`Sourcebook/_data/library.json` never stores Book membership, Book notes, titles,
content bodies or file sizes. It only stores information an original binary file
cannot express, such as import hash or future Picker provenance.

## Book entry contract

Each managed Book region contains readable callout blocks with a stable block ID.
The file/link/text content and Book note are the authoritative record. The card UI
reads and writes the same block; there is no separate hidden `entries` array.
Unknown text inside a managed region causes writes to fail rather than overwrite it.
Text outside managed regions is preserved.

## Project-note insertion and AI handoff

No hidden Book marker is written into project notes. A file entry becomes a native
wiki link (or an embed for previewable media); a text entry and its Book context
become regular Markdown. This means later Book-note edits do not rewrite project
prose. When a project note is handed to AI, direct native links to active,
non-Markdown Sourcebook files are collected as attachments. The note's own prose
is the prompt context. Links to `Sourcebook/Assets/*.md` or
`Sourcebook/Materials/*.md` stay navigational and their Markdown body is not read
or attached. Legacy embedded Book blocks remain readable for compatibility.

## Safety and recovery

Writes are serialized within one plugin instance and use `Vault.process` for Book
body changes. Removing a material moves its entry to the Book's Removed region,
keeping its block ID and note. Permanent entry deletion never deletes the original
file. The plugin does not recursively scan unrelated note bodies.

Schema v1 test data is intentionally not migrated in 0.2.0. It is detected and
left untouched. Local testers should back up needed originals and start with a
fresh `Sourcebook/` folder.

## Out of scope

No Sourcebook Desktop dependency, MCP, built-in AI, Picker receiver, OCR, video
transcription, cloud service or telemetry. Picker remains a later milestone and
must reuse the existing browser extension.
