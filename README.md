# Sourcebook for Obsidian

A local-first material workspace built around one rule: **keep one original copy**.
Books organize existing Vault files, short text and links; project notes use
ordinary Obsidian links plus editable prose; AI handoff uses original files.

**0.2.1 development preview — prepared for the first public release, but not yet published. Test in a disposable Vault.**

## What changed in v2

- Existing Vault files are collected directly; no wrapper Source Markdown.
- Book membership, ordering and Book-specific notes are readable in Book Markdown.
- Short text and simple links live directly in the Book.
- Picker captures retain their original material type, media preview, source URL,
  title and timestamp where available.
- Add to note writes native links for files and ordinary editable Markdown for
  text and Book context. Linked helper Markdown is navigational only and is
  never attached when handing a project note to AI.
- Send to AI creates a prompt and uses original attachment paths without writing
  export copies to the Vault.
- Removed entries retain their block IDs and notes until permanently deleted.
- External imports reuse identical Asset bytes using SHA-256 metadata.

## Vault layout

```text
Sourcebook/
  Books/
  Project Notes/
  Assets/
  _data/library.json   # optional provenance/import metadata only
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
5. Click Send to AI, select source materials, then verify linked binary files
   are copied while linked helper Markdown is neither attached nor read into the
   prompt.
6. Remove and restore an entry; original files must remain untouched.

## Privacy and scope

No analytics, telemetry, MCP, built-in AI, OCR or video transcription. The
optional Picker receiver listens only on the local machine after you pair a
browser Picker with this Vault. Native multi-file clipboard is experimental and
off by default. Quick handoff never proves that a target AI has received or read
attachments; verify them in the destination.

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

`manifest.json`, `package.json` and `versions.json` already agree on `0.2.1`.
The repository includes the required release assets and a draft-release workflow.
Do not publish or submit to the community directory without real Obsidian testing
and explicit approval. See `TESTING.md` and `docs/RELEASE.md`.

## License

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
