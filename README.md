# Sourcebook for Obsidian

**A local-first source and note system for creative work—built for designers,
deck makers, video creators, and every creator working with AI.**

Sourcebook turns scattered project material into visual, reusable **Books**.
Collect almost any kind of source in one masonry-style library: existing Vault
files, images, video, audio, PDFs, web pages, links, posts, short text, and
supported AI conversations. Keep where it came from, add the creative note that
explains why it matters, and bring exactly the right context to your next task.

[Website](https://sourcebook.online/obsidian-plugin/) · [Chinese README](README.zh-CN.md) · [Contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/Yanze-He/sourcebook-for-obsidian/issues)

## Built for creative projects

- **See a project, not a folder tree.** A visual masonry view brings references,
  working files, links, posts, and conversations together. Create as many Books
  as you need—for a product, a presentation, a film, a client, or an idea.
- **Keep the source attached.** Cards retain source URLs and available metadata.
  Jump back to the original page when you need to check, cite, or reuse it.
- **Write the reason, not just the filename.** Add a Book-specific note to each
  material: the creative intent, decision, caveat, or instruction that future
  you (and an AI) needs to understand.
- **Work with nearly every common format.** Keep files alongside images, video,
  audio, PDFs, links, posts, web captures, and AI-chat material instead of
  maintaining separate collections for each.

## A library that belongs in your Vault

Sourcebook is not a separate workspace or a file silo. Add the files that
already live in your Vault, then manage them beside new links and captured web
material. When you add a material to any note, Sourcebook writes a normal
Obsidian link or embed. Your original resource keeps its native backlinks, and
your project note stays ordinary, editable Markdown.

Existing Vault files keep one authoritative copy; removing an item from a Book
never deletes its source file.

## Give AI the context it actually needs

Select multiple materials and turn them into a ready-to-use AI context. The
selection can be copied to the clipboard with the relevant files, links, and
your material notes, so the reasoning behind the selection travels with it.

This makes it much faster to start work in any product that accepts files and
prompts—such as Codex, Claude Code, Figma, or Lovable—without repeatedly
collecting references, choosing attachments, and rewriting the same brief.
Sourcebook never sends material automatically: you choose exactly what to pack
and where to use it.

## Optional: collect from the browser with Sourcebook Picker

[Sourcebook Picker](https://sourcebook.online/obsidian-plugin/) is a Chrome and
Edge extension for quickly growing a Book from the web. Pair it with the
Sourcebook plugin in your current Vault using a local pairing code, then capture
material while you browse resource-heavy pages or AI chats.

Picker supports images, video, audio, web pages, links, selected text, posts,
and supported AI conversations. Current chat support includes ChatGPT, Gemini,
DeepSeek, and Grok; current post support includes X and Xiaohongshu. Captures
retain their original source and available media information.

## How it works

1. Create a **Book** for a project, question, client, or creative direction.
2. Add existing Vault files, short text, links, or browser captures. Add a note
   explaining how each material should inform the work.
3. Add selected material to a project note whenever you need it. Files remain
   native links or embeds; text and notes remain editable prose.
4. Select only the material needed for the next AI task, then copy or hand off
   the prepared context.

## What we are exploring next

We are exploring direct local-agent workflows for tools such as Codex, Claude
Code, and Grokbot. The goal is to let an agent help organize materials and to
save approved outputs, project progress, and collaboration results back into
Sourcebook. This is a direction, not a currently released capability: users
will remain in control of what an agent can read or save.

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

Bug reports, creative workflows, documentation fixes, accessibility improvements,
and focused pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md)
and [the architecture guide](docs/ARCHITECTURE.md).

## License

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
