# Sourcebook — Obsidian 0.2.0 本地测试版

这是一次数据模型重构后的独立插件预览。请先在空的测试 Vault 中验证。
不依赖 Sourcebook Desktop、MCP、内置 AI 或浏览器 Picker。

## 这版解决什么

- 已有 Vault 文件直接成为素材，不再创建 `Sources/*.md` 包装文档。
- Book 的收录关系、排序和「本册备注」直接保存在 Book Markdown 正文。
- 短文本和普通链接直接存在 Book；需要长期复用时可转成独立素材笔记。
- 「添加到笔记」为文件写入原生链接，并将文字和本册备注写成可编辑的普通 Markdown；链接型素材对应的 Markdown 只用于跳转，不会在发送给 AI 时被读取或作为附件。
- 「发送给 AI」默认使用原始文件，不在 Vault 中制造副本。
- 只有明确点击「保存交接快照」时，才复制附件到 `Sourcebook/Snapshots/`。
- 移出 Book 会进入「已移出」区域，保留原文件、备注和块 ID，可恢复。
- 外部导入的完全相同文件会按内容哈希复用同一份 Asset。

## 文件结构

```text
Sourcebook/
├── Books/       素材册与本册备注
├── Materials/   从短文本/链接提升的可复用 Markdown
├── Assets/      从 Vault 外部导入的原文件
├── _data/       可选来源和导入档案
└── Snapshots/   用户明确保存的冻结交接版本
```

## 本地安装

将测试包中的 `sourcebook` 文件夹复制到：

```text
测试 Vault/.obsidian/plugins/sourcebook/
```

在设置 → 社区插件中启用 Sourcebook。建议先删除旧测试 Vault 中的
`Sourcebook/` 文件夹；本版会识别 v1 数据，但不会迁移或改写。

## 推荐验证流程

1. 新建 Book，加入一张已有 Vault 图片、一篇已有笔记、一段文字和一个链接。
2. 确认没有生成 `Sourcebook/Sources/` 包装文档。
3. 修改卡片的「本册备注」，再打开 Book Markdown，确认是同一份内容。
4. 将同一图片加入另一个 Book，填写不同备注，确认互不覆盖。
5. 选择素材 → 添加到笔记 → 新建项目笔记；确认原文件能通过反向链接找到该笔记，文字和备注可直接编辑。
6. 从该笔记发送给 AI；确认二进制文件会被收集，但链接型素材的 Markdown 不会作为附件或提示词正文，且未生成 Snapshot。
7. 明确点击「保存交接快照」，检查 `Snapshots/` 中出现固定副本。
8. 移出素材，检查项目笔记引用仍可显示；从「已移出」中恢复。

## 当前限制

- 没有 v1 数据迁移；本地测试请重置 `Sourcebook/`。
- 原生多文件剪贴板仍为实验能力，默认关闭。
- 没有 Picker、MCP、内置 AI、OCR、音视频解析或 Desktop 同步。
- Book 管理区域采用固定可读格式；如果手工破坏结构，插件会拒绝覆盖。
- 真实 Obsidian、macOS/Windows 剪贴板仍需实机验收。

## 开发检查

```bash
npm install
npm run check
npm run package
```

离线环境可运行：

```bash
npm run check:offline
npm test
npm run package
```
