# Obsidian community listing — Sourcebook

This is the approved product introduction and release reference for the Obsidian
community submission. The public repository README remains the long-form
technical introduction.

## Listing summary

**Sourcebook** organizes existing Vault files, notes, short text, links, and
Picker captures into project Books. It preserves original files, writes native
Obsidian links into project notes, and helps you select explicit context for an
AI task without moving your work into a cloud service.

### What Sourcebook does

- Collect existing Vault files without creating duplicate wrapper Markdown.
- Keep Book membership and Book-specific notes readable in Book Markdown.
- Save short text and links directly in a Book.
- Add files to project notes as native Obsidian links, preserving backlinks to
  the original source file.
- Add short text and Book notes as ordinary editable Markdown.
- Pair locally with Picker for Agent to collect selected web material, pages,
  posts, media references, and supported AI conversations into a Book.
- Let you select the source files and links you want to hand off to an AI; it
  does not send material automatically.

### Privacy and scope

Sourcebook is local-first. It has no account, telemetry, cloud synchronization,
built-in AI, OCR, transcription, or analytics. The optional Picker connection
uses a pairing code and listens only on the local machine for the current Vault.

### Current requirements

- Obsidian `1.8.0` or later.
- Desktop Obsidian only (`isDesktopOnly: true`).
- A supported Chromium browser is required only for the optional Picker.

## 中文产品介绍

**Sourcebook** 是一个本地优先的 Obsidian 素材管理插件。它把已有 Vault
文件、笔记、文字、链接和浏览器 Picker 采集内容组织成项目 Book，并保留原始
文件。

- 已有文件直接收录，不创建重复的包装 Markdown。
- 文件加入项目笔记时会写为原生 Obsidian 链接，因此可以通过反向链接找到使用
  它的笔记。
- 文字和本册备注以普通、可编辑的 Markdown 写入项目笔记。
- 可选的 Picker 通过本机配对，把网页、链接、帖子、媒体和支持的 AI 对话保存
  到指定 Book。
- 发送给 AI 前由你明确选择素材；插件不会自动上传或同步任何内容。

Sourcebook 没有账号、遥测、云同步、内置 AI、OCR、转写或分析服务。Picker
只在当前电脑上、与当前 Vault 通过配对码连接。需要 Obsidian 1.8.0 或更高版本，
仅支持桌面端。

## Release assets and repository requirements

The root repository already contains the community-facing files:

| Item | Purpose |
| --- | --- |
| `manifest.json` | Plugin ID, version, minimum Obsidian version, and desktop-only flag. |
| `versions.json` | Compatibility map for future updates. |
| `README.md` | Public project overview. |
| `LICENSE` | MIT license. |
| `main.js` | Compiled plugin runtime; attached to each GitHub Release. |
| `styles.css` | Runtime styles; attached to each GitHub Release. |
| `.github/workflows/release.yml` | On a matching version tag, verifies and creates a **draft** release with the three standalone runtime assets. |

For release `0.2.1`, create the exact Git tag `0.2.1`. The workflow builds and
attaches `main.js`, `manifest.json`, and `styles.css` individually to a draft
GitHub Release. Do not upload a ZIP as the community plugin asset. After
publishing the release, submit the public repository URL through the Obsidian
Community directory; the directory checks the default-branch manifest and the
matching GitHub Release.

## Reviewer notes

- Sourcebook is not a fork of another plugin.
- It manages files and Markdown only in the open Vault.
- Its optional browser connection is local-only, explicit, and pairing-code
  protected.
- The plugin does not include a payment flow, account, or external API key.
