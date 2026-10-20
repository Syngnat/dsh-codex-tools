[English](<README.md>) | [简体中文](<README.zh-CN.md>)

# DeepSeek Harness 的 Codex 工具

把 Codex 桌面端的三项能力做成 Agent 工具，并加上插件自身的在线更新：computer use、浏览器操作、跨会话发消息、在线更新。

这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的插件包。前两个工具直接复用 Codex 自己在用的那套运行时；第三个是 Harness 原生的跨会话消息能力；第四个从本仓库的 GitHub Release 更新插件自己。

| 工具 | 做什么 | 来源 |
| --- | --- | --- |
| `computer_use` | 通过无障碍树和截图读写 macOS 原生 App | Codex 的 Computer Use 运行时 |
| `browser` | 列出浏览器与标签页、绑定一个、读取、点击、输入、导航 | Codex 的 browser-desktop provider |
| `session_message` | 在别的项目新建会话并注入完整任务简报，或对已有会话追问、分叉、改名 | Harness 原生服务 |
| `codex_tools_update` | 检查并安装本插件的更新稳定版 | Host `pluginManager` |

## 环境要求

- **macOS**，且已安装 `ChatGPT.app` —— Codex 的 Computer Use 运行时就在它里面。
- **DSH `>= 0.2.1-rc.1`**，不设未来版本上限。插件在挂载前检查所需的 Host 能力，缺哪个就报哪个名字，不靠版本号猜。
- **辅助功能与屏幕录制权限**（授予运行 Harness 的那个 App），`computer_use` 需要。
- **Codex 的 Chrome 扩展**，`browser` 操作 Chrome 时需要。

## 安装

```sh
# 在 profile 目录下
dsh plugin install github:Syngnat/dsh-codex-tools
```

也可以在会话里用 `plugin_manager`，`action: "install_bundle"`，spec 同上。本地目录同样可以：

```sh
dsh plugin install /absolute/path/to/dsh-codex-tools
```

插件通过 `cordis.patch.yml` 注册自己：

```yaml
- insert:
    - id: local-codex-tools
      name: '@local/dsh-codex-tools'
      config:
        surfaces: computer,browser
```

## 配置

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `surfaces` | `computer,browser` | 运行时绑定哪些 Codex provider。可只留 `computer` 或 `browser`。 |
| `computerUse` | `true` | 是否注册 `computer_use` 工具。 |
| `browser` | `true` | 是否注册 `browser` 工具。 |
| `sessionMessaging` | `true` | 是否注册 `session_message` 工具。 |
| `update` | `true` | 是否注册 `codex_tools_update` 工具。 |
| `callTimeoutMs` | `120000` | 单次 REPL 求值的超时。 |
| `codexSessionId` | 自动生成 | Codex turn metadata 里上报的固定 `session_id`。 |

环境变量覆盖：

| 变量 | 含义 |
| --- | --- |
| `DSH_CODEX_CUA_NODE` | `cua_node` 的绝对路径，ChatGPT.app 不在 `/Applications` 时使用。 |
| `DSH_CODEX_APP` | ChatGPT App bundle 的绝对路径。 |

## `computer_use`

动作：`list_apps`、`list_windows`、`get_state`、`click`、`type_text`、`paste`、
`press_key`、`scroll`、`drag`、`set_value`、`select_text`、
`perform_secondary_action`、`screenshot`。

工作流与 Codex 一致：先发现 App，再读状态拿到元素索引，对索引执行动作，然后重新读状态。
元素索引只对产生它的那次状态有效，所以每个动作默认都会重新读一次状态；
要连续批量操作时传 `return_state: false` 关掉。

`get_state` 默认返回相对上次的 **diff**；需要完整树时传 `full_tree: true`。

截图会写到系统临时目录的 PNG 并返回路径，用普通图片读取工具打开即可。

### 审批

运行时在读取或操作某个 App 之前，会通过 MCP form elicitation 请求客户端批准。
本插件默认回 `accept`，并把每次决定记在 `client.approvalLog`。
要改成拒绝，在插件配置里设 `approval: "deny"`。

上游的确认策略（删除数据、传输敏感数据、安装软件、解验证码、改系统设置）是**模型**的义务，
运行时并不强制，所以这段要求被写进了工具描述里。

### 屏幕上你会看到什么

`computer_use` 不激活目标窗口，也不移动系统鼠标指针：macOS 上运行时直接对元素执行无障碍动作
（`AXPress`、`AXValue` 等）。被压在别的 App 后面的窗口也能操作成功。

「ChatGPT is using your computer」那个宿主浮层不会出现，因为本插件直接连运行时。
但运行时自己会在动作期间画一个很小的软件光标。Codex 在一轮结束时用隐藏的 `turn_ended`
工具把它收掉；本插件在 `computer_use` / `browser` 返回时发同样的通知，所以光标不会留在屏幕上。

## `browser`

动作：`list_browsers`、`list_tabs`、`open_tab`、`get_tab`、`documentation`、
`state`、`click`、`type_text`、`paste`、`press_key`、`scroll`、`drag`、
`select_text`、`set_value`、`goto`、`back`、`forward`、`reload`、`close`、
`screenshot`。

浏览器来自 Codex 的 Chrome 扩展、内置浏览器，或运行时对外公布的其他 provider。
`list_browsers` 看有哪些连着，`list_tabs` 看标签页，`open_tab` 或 `get_tab` 绑定一个并保持绑定。

## `session_message`

动作：`list_workspaces`、`list_sessions`、`dispatch`、`create`、`send`、
`fork`、`rename`。

`dispatch` 是核心：一次调用在目标工作区建会话并投递完整简报。

```
session_message {
  action: "dispatch",
  workspace: "GoNavi",
  title: "修复重连循环",
  message: "背景：… 目标：… 涉及文件：… 完成标准：…"
}
```

目标会话看不到发起方的对话，所以简报必须自包含。
建出来的会话就是普通 Harness 会话：出现在侧边栏、独立运行，之后可以用 `send` 继续指挥。

`workspace` 接受工作区 id、绝对路径或标题片段。尚未注册的绝对路径会被建成新工作区。

这个工具用的是 Host 的 `sessionController` 和 `workspaceRegistry` 服务，
不碰存储格式，也不需要 Codex 运行时。

## `codex_tools_update`

动作：`status`、`check`、`install`。

用来更新插件自己。三个动作就是流程的三个独立阶段，只有最后一个会改变任何东西：

| 动作 | 做什么 |
| --- | --- |
| `status` | 报告当前运行版本、上次检查结果，以及这个安装能否在线替换。 |
| `check` | 从 GitHub 读最新稳定版。只读：不下载、不安装任何东西。 |
| `install` | 用最新版替换 bundle。必须传 `confirm: true`。 |

传 `confirm: true` 之前先问用户：插件是原地替换，Harness 可能需要重启。

### 安装保证什么

- **来源固定。** 仓库、发布接口、安装 spec 都是插件里的常量。不接受调用方传入的 URL、包名、registry 或版本豁免。
- **目标钉死。** 发布 tag 会解析成不可变 commit，并且该 commit 下的 `package.json` 必须声明本包名、本版本号和 bundle patch。不匹配就在替换任何东西之前中止。
- **不跑安装脚本。** 声明了 `preinstall`、`install`、`postinstall` 或 `prepare` 的清单直接拒绝。
- **事后核对。** 成功要求记录的 bundle 行与钉死的 commit 一致，而不只是管理器回执。
- **可恢复。** 如果 profile 已被改动之后替换失败，会重新安装并启用原来运行的版本。恢复也失败时会明说，并打印手动命令，而不是谎报成功。
- **不覆盖外来安装。** 期间被其他管理器调用者装上的版本会被识别出来并放过。

### 它不会做什么

在线更新只处理来自本仓库的安装。本地 `link:` 检出、fork，或不是可移除 profile 安装的 bundle 一律拒绝，`status` 会说明原因。没有 HTTP 路由、没有后台轮询、不会自动更新：不调用这个工具就什么都不会发生。

## Codex 是怎么做的

Codex 在 `ChatGPT.app` 里自带一套 Node 运行时：

```
/Applications/ChatGPT.app/Contents/Resources/cua_node/
  bin/node                                固定版本的 Node 24
  bin/node_repl                           承载 cua API 的 REPL 内核
  lib/node_modules/@oai/cua-repl          MCP launcher
  lib/node_modules/@oai/sky               原生 App provider（Sky）
  lib/node_modules/@oai/browser-desktop   浏览器 provider
```

`@oai/cua-repl` 的 launcher 把 `node_repl` 拉起来，绑定两个 trusted service
（`@oai/sky/service` 管原生 App，`@oai/browser-desktop/service` 管浏览器），
然后自己作为 MCP server 通过 stdio 通信。它只暴露四个工具：
`js`、`js_reset`、`js_add_node_module_dir`、`turn_ended`。其余全是 JavaScript：
模型对着全局 `cua` 对象写代码，REPL 持久化，所以 App 或标签页的绑定和元素索引跨调用有效。

两个很容易踩错、本插件都处理了的点：

- **必须告诉运行时它的 trusted 模块在哪。** 不设 `NODE_REPL_NODE_MODULE_DIRS` 和
  `NODE_REPL_TRUSTED_CODE_PATHS` 指向 `cua_node/lib/node_modules`，内核会直接死：
  *"Trusted RPC package must resolve within a configured trusted module directory"*。
- **浏览器 provider 要求 Codex turn metadata。** 每次调用都要带
  `_meta["x-codex-turn-metadata"]`（含 `session_id` 和 `turn_id`），否则浏览器服务拒答：
  *"Missing required Codex turn metadata"*。

`SkyComputerUseClient` 自带的 `cua mcp` 子命令**不能**替代：
它等的是 ChatGPT 宿主的 XPC bootstrap 握手，单独跑只会 `bootstrapTimedOut`。
直接 `import("@oai/sky")` 同样不行，会报
*"Sky Computer Use requires the trusted nodeRepl runtime"*。
`cua-repl` launcher 是目前唯一可独立运行的入口。

完整结论（含走过的死路）见 [docs/implementation.md](<docs/implementation.md>)。

## 目录结构

```
index.js                 插件入口：apply / inject，注册四个工具
lib/cua-repl-client.mjs  Codex REPL server 的 MCP stdio 客户端
lib/computer-tool.mjs    computer_use
lib/browser-tool.mjs     browser
lib/session-tool.mjs     session_message
lib/update-tool.mjs      codex_tools_update
lib/update-service.mjs   GitHub 发布检查与 bundle 替换
lib/version.mjs          严格稳定版本号
lib/define-tool.mjs      零依赖的 defineTool
cordis.patch.yml         bundle patch
docs/implementation.md   逆向报告
```

## 开发

```sh
npm test          # 50 项离线测试，不需要 Codex 运行时
npm run test:live # 5 项 live 测试，需要 ChatGPT.app
```

`lib/*.mjs` 不在 Harness 的 HMR 监听范围内。改完模块后要重挂插件，
运行中的实例才会用上新代码：

```
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: false }
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: true }
```

## 许可

MIT，见 [LICENSE](<LICENSE>)。
