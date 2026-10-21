# Sourcebook for Obsidian

A local-first material workspace built around one rule: **keep one original copy**.
Books organize existing Vault files, short text and links; project notes use
ordinary Obsidian links plus editable prose; AI handoff uses original files
unless the user explicitly saves a frozen snapshot.

**0.2.0 local development preview — not yet published. Test in a disposable Vault.**

## What changed in v2

- Existing Vault files are collected directly; no wrapper Source Markdown.
- Book membership, ordering and Book-specific notes are readable in Book Markdown.
- Short text and simple links live in the Book; they can be promoted to reusable
  Markdown material notes.
- Add to note writes native links for files and ordinary editable Markdown for
  text and Book context. Linked Material Markdown is navigational only and is
  never read or attached when handing a project note to AI.
- Send to AI creates a prompt and uses original attachment paths without writing
  export copies to the Vault.
- Save handoff snapshot is the only action that copies selected material.
- Removed entries retain their block IDs and notes until permanently deleted.
- External imports reuse identical Asset bytes using SHA-256 metadata.

## Vault layout

```text
Sourcebook/
  Books/
  Materials/
  Assets/
  _data/library.json   # optional provenance/import metadata only
  Snapshots/           # explicit frozen handoffs only
```

The metadata registry does not store Book membership, notes, duplicate titles,
content bodies or file sizes.

## Local test installation

Copy the packaged `sourcebook` folder into:

```text
<test vault>/.obsidian/plugins/sourcebook/
```

Enable Sourcebook in Community plugins. For this local preview, remove the old
`Sourcebook/` test-data folder before testing v2. Schema v1 is detected but never
migrated or rewritten.

Suggested test:

1. Create a Book and add an existing image, existing note, short text and link.
2. Edit a Book note in the card and inspect the same text in Book Markdown.
3. Add the same file to a second Book with a different note.
4. Add selected entries to a project note; verify the source file has a native
   backlink and that inserted text/context can be edited as normal prose.
5. Use Send to AI from that note; verify linked binary files are copied, while
   linked Material Markdown is neither attached nor read into the prompt.
6. Explicitly save a handoff snapshot and inspect `Sourcebook/Snapshots/`.
7. Remove and restore an entry; original files must remain untouched.

## Privacy and scope

No network requests, telemetry, MCP, built-in AI, Picker receiver, OCR, video
transcription or Sourcebook Desktop dependency. Native multi-file clipboard is
experimental and off by default. Quick handoff never proves that a target AI has
received or read attachments; verify them in the destination.

## Development

```bash
npm install
npm run check
npm run package
```

Offline fallback:

```bash
npm run check:offline
npm test
npm run package
```

The offline host contract is not equivalent to compilation against the official
Obsidian npm package or a real-app test.

## Release

`manifest.json`, `package.json` and `versions.json` must agree. Do not publish or
submit to the community directory without real Obsidian testing and explicit user
approval. See `TESTING.md` and `docs/RELEASE.md`.

## License

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
