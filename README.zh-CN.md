# Sourcebook for Obsidian

**一套为创作型使用者打造的、本地优先的素材 + 笔记管理方式。**

无论你是设计师、Deck 制作者、视频创作者，还是正在与 AI 一起工作的人，
Sourcebook 都能把零散的项目素材沉淀成可复用的 **Book**。已有 Vault 文件、
图片、视频、音频、PDF、网页、链接、帖子、短文字和支持的 AI 对话，都可以在
同一个瀑布流素材库中统一管理；保留来源、写下创作备注，并在需要时把恰当的上下文
带给 AI。

[官网与使用说明](https://sourcebook.online/obsidian-plugin/?utm_source=github_obsidian_readme&utm_medium=referral&utm_campaign=picker_install) · [English README](README.md) · [参与贡献](CONTRIBUTING.md) · [反馈问题](https://github.com/Yanze-He/sourcebook-for-obsidian/issues)

## 为创作项目而生

- **看到的是项目，不是文件树。** 用瀑布流卡片把参考图、工作文件、链接、帖子和
  对话放在一起。你可以按产品、演示文稿、影片、客户或任何创作主题建立多个 Book。
- **来源始终可追溯。** 卡片会保留来源链接和可用的元数据，需要核对、引用或复用时，
  可以直接回到原始页面。
- **写下“为什么”，而不只是文件名。** 每个素材都可以有本册备注：创作意图、决策、
  使用限制或提示。未来的你和 AI 都能理解它为什么重要。
- **几乎所有常见格式统一管理。** 文件、图片、视频、音频、PDF、链接、帖子、网页
  采集和 AI 对话可以放在一起，不必再为不同类型维护多套素材库。

## 它属于你的 Vault，而不是另一个孤岛

Sourcebook 不是独立的工作空间或文件孤岛。你可以导入已经在 Vault 里的文件，再把
它们与新加入的链接、帖子和网页素材统一管理。把素材添加到任何笔记时，Sourcebook
写入的是普通 Obsidian 链接或嵌入：原始资源仍然拥有原生反向链接，项目笔记也保持为
普通、可编辑的 Markdown。

已有 Vault 文件始终只保留一份权威原件；从 Book 移出素材不会删除它的源文件。

## 三种加入素材的方式

1. **使用顶部“添加”菜单。** 可选择“添加 Vault 文件”纳入已有 Vault 文件、
   “导入本地文件”加入电脑中的文件，或直接添加短文字和笔记。
2. **从剪贴板粘贴。** 在 Sourcebook 页面按 Cmd/Ctrl+V，可先检查文件、公开链接或
   短文字；不支持的内容会说明原因，确认前不会写入 Vault。
3. **用 Picker 从浏览器收集。** 将可选的 Sourcebook Picker 浏览器扩展与当前 Book
   配对，即可在浏览网页时收集素材。

## 把真正需要的上下文交给 AI

多选素材即可快速打包成 AI 上下文，并复制到剪贴板。相关文件、链接和你为素材写下
的创作备注会一起进入提示词，因此选择背后的判断不会丢失。

这样你可以在任何接受文件和提示词的 AI 产品中快速开始工作，例如 Codex、Claude
Code、Figma 或 Lovable；不必反复整理参考资料、挑选附件和重写同一份 Brief。
Sourcebook 不会自动发送任何内容：你始终决定要打包什么，以及把它用在哪里。

## 可选：用 Sourcebook Picker 从浏览器扩充素材库

[Sourcebook Picker](https://sourcebook.online/obsidian-plugin/?utm_source=github_obsidian_readme&utm_medium=referral&utm_campaign=picker_install) 是一个 Chrome / Edge
浏览器插件，适合在资源流网页或 AI 对话界面中快速扩充 Book。通过本机配对码将它
连接到当前 Vault 中的 Sourcebook 后，即可边浏览边采集。

Picker 支持图像、视频、音频、网页、链接、选中文字、帖子和支持的 AI 对话。当前
支持 ChatGPT、Gemini、DeepSeek、Grok 对话，以及 X 和小红书帖子；采集内容会保留
原始来源和可用的媒体信息。

## 使用方式

1. 为项目、问题、客户或创作方向新建一个 **Book**。
2. 加入已有 Vault 文件、短文字、链接或浏览器采集内容，并写下每项素材对创作的意义。
3. 需要时把选中的素材添加到项目笔记：文件保留原生链接／嵌入，文字和备注保留为
   可编辑正文。
4. 面对下一次 AI 任务时，只选择真正需要的素材，复制或交接准备好的上下文。

## 接下来正在探索的方向

我们正在探索与本地 Agent 的直接协作方式，例如 Codex、Claude Code 和 Grokbot。
目标是让 Agent 协助整理素材，并把经过确认的产出、项目进展和协作结果保存回
Sourcebook。这是未来方向，而不是已经发布的功能；用户始终会控制 Agent 可以读取
或保存什么。

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

- Obsidian 1.13.0 或更高版本。
- 仅支持桌面端 Obsidian，暂不支持移动端。
- 只有使用可选的 Sourcebook Picker 时才需要 Chromium 浏览器。

## 隐私

Sourcebook 只在当前打开的 Vault 中工作：不会扫描无关笔记正文，不会上传 Vault
内容，也不会连接外部服务。可选的 Picker 接收端仅在明确配对后，通过本机连接接收
请求。

### 权限与本地操作

- 只有打开“添加 Vault 文件”选择器时，Sourcebook 才会列出 Vault 文件；选择器会
  排除 Sourcebook 管理的文件与已经加入管理的文件。
- 只有你主动点击复制，或在 Sourcebook 页面按下 Cmd/Ctrl+V 时才会使用剪贴板；
  粘贴内容会先显示确认列表，确认前不会写入 Vault。列表最多显示 20 项，并会说明
  文件夹等不支持项目的原因；导入完成后仍会保留每项成功或失败结果。Sourcebook 不会在后台读取
  剪贴板内容。
- “复制文件给 AI”是桌面端的主动操作。它会把经过校验的本地文件 URI 写入原生系统
  剪贴板，让选中的本地文件可以粘贴到 Agent 中；Sourcebook 不会执行 Shell 命令。若
  选择了短文字，会在操作系统临时目录中生成短暂使用的 `.txt` 文件。
- 删除受管理的 Book 或导入素材时，会遵从 Obsidian 配置的废纸篓行为；从 Book
  移出素材只会取消关联，不会删除原始 Vault 文件。

## 参与贡献

欢迎提交 Bug 反馈、创作工作流、文档修正、无障碍改进和聚焦的 Pull Request。开始前
请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与[架构说明](docs/ARCHITECTURE.md)。

## 开源协议

MIT，见 [LICENSE](LICENSE) 与[第三方声明](THIRD_PARTY_NOTICES.md)。
