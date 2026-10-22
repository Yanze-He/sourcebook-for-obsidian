# Sourcebook for Obsidian

**Keep the context behind your work close to the work itself.**

Sourcebook is a local-first Obsidian plugin for collecting project materials
into Books: existing Vault files, notes, short text, links, and optional browser
captures. It helps you turn selected material into ordinary project notes and
prepare deliberate context for the AI tool you choose.

[Website](https://sourcebook.online/obsidian-plugin/) · [Chinese README](README.zh-CN.md) · [Contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/Yanze-He/sourcebook-for-obsidian/issues)

## Why Sourcebook

- **Keep one original copy.** Existing Vault files are collected directly; the
  plugin does not make wrapper Markdown duplicates.
- **Preserve native backlinks.** Adding a file to a project note writes a normal
  Obsidian link or embed, so the original file can find the note that uses it.
- **Keep project notes yours.** Text and Book notes are inserted as ordinary,
  editable Markdown—not a hidden proprietary block.
- **Collect context deliberately.** Choose the files and links you want before
  handing material to an AI. Sourcebook never sends material automatically.
- **Stay local.** No account, cloud sync, analytics, built-in AI, OCR, or
  transcription.

## How it works

1. Create a **Book** for a project, question, or client.
2. Add existing Vault files, short text, or links. Each Book can keep its own
   notes about why a material matters.
3. Turn selected material into a project note. Files remain native links;
   written context remains editable prose.
4. When you need help from an AI, select only the material you want to use.

### Optional: collect from the browser

Pair [Sourcebook Picker](https://sourcebook.online/obsidian-plugin/) with the
Sourcebook plugin in your current Vault using a local pairing code. Picker can
save selected web material, pages, links, media references, posts, and supported
AI conversations into the Book you choose. The connection stays on your device.

## Installation

### Community Plugins

Once Sourcebook is listed in the Obsidian Community directory:

1. Open **Settings → Community plugins → Browse**.
2. Search for **Sourcebook**.
3. Install, enable it, then open Sourcebook from the ribbon or Command Palette.

### Manual installation

For a pre-release or a local build, download the matching GitHub Release assets
`main.js`, `manifest.json`, and `styles.css`, then place them in:

```text
<your-vault>/.obsidian/plugins/sourcebook/
```

Enable Sourcebook under **Settings → Community plugins**. Back up an important
Vault before trying any pre-release build.

## Requirements

- Obsidian 1.8.0 or later.
- Desktop Obsidian. Mobile is not supported yet.
- A Chromium browser is needed only for the optional Sourcebook Picker.

## Privacy

Sourcebook operates in the open Vault only. It does not scan unrelated note
bodies, upload Vault content, or contact an external service. The optional
Picker receiver accepts requests only on the local machine after explicit
pairing.

## Contributing

Bug reports, workflow examples, documentation fixes, accessibility improvements,
and focused pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md)
and [the architecture guide](docs/ARCHITECTURE.md).

## License

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
