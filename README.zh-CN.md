# Sourcebook for Obsidian

**把支撑项目工作的素材，留在项目身边。**

Sourcebook 是一个本地优先的 Obsidian 插件。它把已有 Vault 文件、笔记、短
文字、链接和可选的浏览器采集内容组织成 Book，帮助你写出可编辑的项目笔记，并
在需要时明确选择要交给 AI 的上下文。

[官网与使用说明](https://sourcebook.online/obsidian-plugin/) · [English README](README.md) · [参与贡献](CONTRIBUTING.md) · [反馈问题](https://github.com/Yanze-He/sourcebook-for-obsidian/issues)

## 为什么使用 Sourcebook

- **只保留一份原文件。** 已有 Vault 文件直接收录，不生成包装用的重复 Markdown。
- **保留 Obsidian 原生反向链接。** 文件加入项目笔记时会写成普通链接或嵌入，
  因此可以从原文件找到使用它的笔记。
- **项目笔记始终由你掌控。** 文字和本册备注会写成普通、可编辑的 Markdown，
  而不是隐藏的专有区块。
- **明确选择 AI 上下文。** 交给 AI 前由你选择需要的文件和链接；插件不会自动
  发送任何素材。
- **本地优先。** 不需要账号，没有云同步、分析、内置 AI、OCR 或转写服务。

## 使用方式

1. 为项目、问题或客户新建一个 **Book**。
2. 加入已有 Vault 文件、短文字或链接，并为每项素材写下本册备注。
3. 选中素材并转成项目笔记：文件保留原生链接，文字和上下文保留为可编辑正文。
4. 需要 AI 协助时，只选择这次任务真正需要的素材。

### 可选：从浏览器采集

通过本机配对码将 [Sourcebook Picker](https://sourcebook.online/obsidian-plugin/)
连接到当前 Vault 中的 Sourcebook。Picker 可将选中的网页内容、页面、链接、
媒体来源、帖子和支持的 AI 对话保存到指定 Book；整个连接只发生在你的设备上。

## 安装

### 从社区插件安装

Sourcebook 上架 Obsidian Community Plugins 后：

1. 打开 **设置 → 社区插件 → 浏览**。
2. 搜索 **Sourcebook**。
3. 安装并启用，然后从 Ribbon 或命令面板打开 Sourcebook。

### 手动安装

使用预发布版本或本地构建时，下载对应 GitHub Release 的 `main.js`、
`manifest.json` 和 `styles.css`，放入：

```text
<你的 Vault>/.obsidian/plugins/sourcebook/
```

然后在 **设置 → 社区插件** 中启用。测试预发布版本前，请先备份重要 Vault。

## 要求

- Obsidian 1.8.0 或更高版本。
- 仅支持桌面端 Obsidian，暂不支持移动端。
- 只有使用可选的 Sourcebook Picker 时才需要 Chromium 浏览器。

## 隐私

Sourcebook 只在当前打开的 Vault 中工作：不会扫描无关笔记正文，不会上传 Vault
内容，也不会连接外部服务。可选的 Picker 接收端仅在明确配对后，通过本机连接
接收请求。

## 参与贡献

欢迎提交 Bug 反馈、使用场景、文档修正、无障碍改进和聚焦的 Pull Request。开始前
请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与[架构说明](docs/ARCHITECTURE.md)。

## 开源协议

MIT，见 [LICENSE](LICENSE) 与[第三方声明](THIRD_PARTY_NOTICES.md)。
