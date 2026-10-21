# Sourcebook — Obsidian 0.2.1 开发测试版

这是一次数据模型重构后的独立插件预览，已为首次公开发布准备好仓库文件，
但尚未发布。请先在空的测试 Vault 中验证。

## 这版解决什么

- 已有 Vault 文件直接成为素材，不再创建 `Sources/*.md` 包装文档。
- Book 的收录关系、排序和「本册备注」直接保存在 Book Markdown 正文。
- 短文本和普通链接直接存在 Book；文字可直接编辑并作为普通文本加入项目笔记。
- Picker 会保留采集素材的原始类型、缩略图、来源链接、标题和可用时间信息。
- 「添加到笔记」为文件写入原生链接，并将文字和本册备注写成可编辑的普通 Markdown；链接型素材对应的 Markdown 只用于跳转，不会在发送给 AI 时被读取或作为附件。
- 「发送给 AI」默认使用原始文件，不在 Vault 中制造副本。
- 移出 Book 不会删除原文件。
- 外部导入的完全相同文件会按内容哈希复用同一份 Asset。

## 文件结构

```text
Sourcebook/
├── Books/       素材册与本册备注
├── Project Notes/ 项目笔记
├── Assets/      从 Vault 外部导入的原文件
└── _data/       可选来源和导入档案
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
5. 选择素材 → 转成笔记；确认文件能通过反向链接找到该笔记，文字和备注可直接编辑。
6. 点击「发送给 AI」后直接选择素材；确认二进制文件会被收集，链接型素材仍属于「链接」且不会把辅助 Markdown 作为附件或提示词正文。
7. 使用浏览器 Picker 保存文字、网页、帖子和媒体；确认它们的类型、缩略图、来源与详情内容正确。
8. 移出素材，检查项目笔记引用仍可显示，原文件保持不变。

## 当前限制

- 没有 v1 数据迁移；本地测试请重置 `Sourcebook/`。
- 原生多文件剪贴板仍为实验能力，默认关闭。
- 没有 MCP、内置 AI、OCR、音视频转写或云端同步；Picker 与插件之间只通过本机配对连接。
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
