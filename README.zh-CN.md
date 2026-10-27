[English](<README.md>) | [简体中文](<README.zh-CN.md>)

# 电脑操控 — DeepSeek Harness 的电脑与浏览器工具

三个真正动这台机器的 Agent 工具——操作原生 App、驱动插件自己的 Chrome 窗口、给其他 Harness 会话发消息——外加一个从 GitHub Release 更新插件自己的工具。

这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的插件包。全部逻辑都跑在 Harness 进程里或本插件自带的辅助程序里：不启动任何外部桌面客户端、不连 MCP 服务器、不调 PowerShell。

| 工具 | 做什么 | 实现方式 |
| --- | --- | --- |
| `computer_use` | 通过无障碍树和截图读写原生 App | macOS 用 `bin/dsh-ax`（辅助功能）；Windows 用 `bin/dsh-uia.exe`（UI Automation，首次使用时现编译） |
| `browser` | 列出插件自己的 Chrome 窗口与标签页、绑定一个、读取、点击、输入、导航 | 用 Chrome DevTools 协议驱动插件自己拉起的 Chrome（独立 profile） |
| `session_message` | 在别的项目新建会话并注入完整任务简报，或对已有会话追问、分叉、改名 | Host 的 `sessionController` 与 `workspaceRegistry` |
| `codex_tools_update` | 检查并安装本插件的更新稳定版 | Host 的 `pluginManager` 与 `jobs` |

## 环境要求

- **macOS 或 Windows。** macOS 上 `computer_use` 需要给 `bin/dsh-ax` 辅助功能权限，截图另需屏幕录制权限。Windows 上插件第一次调用时才用 `native/dsh-uia.cs` 编出 `bin/dsh-uia.exe`，用的是 Windows 自带的 .NET Framework 4.x 里的 `csc.exe`——不需要装 .NET SDK、不需要指定 PowerShell 版本、不需要管理员权限。
- **DSH `>= 0.2.1-rc.1`**，不设未来版本上限。插件在挂载前检查所需的 Host 能力，缺哪个就报哪个名字，不靠版本号猜。
- **不需要浏览器扩展。** 浏览器工具拉起自己的 Chrome，**不会**挂到你正在用的 Chrome 上，所以不会往你的浏览会话里注入任何东西。

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
      config: {}
```

## 配置

两层，作用不同。

**Bundle 配置**决定「注册哪些工具」。写在上面那行 patch 的 `config` 里：

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `computerUse` | `true` | 是否注册 `computer_use`。 |
| `browser` | `true` | 是否注册 `browser`。 |
| `sessionMessaging` | `true` | 是否注册 `session_message`。 |
| `update` | `true` | 是否注册 `codex_tools_update`。 |

**设置页**决定「已注册的工具被允许做什么」。从 Harness 插件页里本插件自己的页面打开。它写 `~/.dsh/dsh-codex-tools/settings.json`，工具每次调用都读这个文件：

| 设置 | 默认值 | 含义 |
| --- | --- | --- |
| `computerEnabled` | `true` | `computer_use` 总开关。 |
| `anyApp` | `true` | 关闭后只允许操作 `allowedApps` 里的 App。 |
| `allowedApps` | `[]` | `anyApp` 关闭时允许的 App 名单。 |
| `browserEnabled` | `true` | `browser` 总开关。 |

## `computer_use`

动作：`list_apps`、`list_windows`、`get_state`、`click`、`type_text`、`paste`、
`press_key`、`scroll`、`drag`、`set_value`、`select_text`、
`perform_secondary_action`、`screenshot`。

先发现 App，再读状态拿到元素索引，对索引执行动作，然后重新读状态。元素索引只对产生它的那次状态有效，所以每个会改变界面的动作默认都会重新读一次状态；要连续批量操作时传 `return_state: false` 关掉。

`get_state` 默认返回相对上次的 **diff**；需要完整树时传 `full_tree: true`。

### 选窗口

`app` 只说明是哪个 App，具体窗口用 `pid`、`window_handle`、`window_title` 指定。
同一个进程可以有多个窗口显示不同页面（两个 Chrome 都叫 `chrome`），所以 `app`
命中多个窗口时**不会**默默取第一个，而是返回候选列表（pid、句柄、标题、会话）要求指定。
只给 pid 也可能仍有两个窗口，因为一个进程可以拥有多个窗口，这时再补 `window_handle`
或标题片段。先不带 `app` 调 `list_windows` 看全机器窗口的身份。元素索引属于产生它的
那个窗口，拿去操作另一个窗口会直接报错，不会被点出去。

截图会写到系统临时目录的 PNG 并返回路径，用普通图片读取工具打开即可。

### 屏幕上你会看到什么

macOS 上 `computer_use` 不激活目标窗口，也不移动系统鼠标指针：辅助程序直接对元素执行无障碍动作（`AXPress`、`AXValue` 等）。被压在别的 App 后面的窗口也能操作成功。

Windows 上输入必须走键盘，所以 `click`、`type_text`、`paste`、`set_value`、
`press_key`、`scroll`、`drag` 会先确认目标窗口确实持有前台（不是就抬到前台，并带
线程输入附加重试）；`set_value` 优先用 UI Automation 的 `ValuePattern`，可以完全不敲
键盘就填好字段。指针会移到即将点击的元素上，并在落点闪一下小箭头、约半秒后消失；
辅助程序启动时不显示，操作结束后也不会留在屏幕上。

除这个标记外不会往你桌面上画任何东西：没有宿主浮层，因为整条链路只有本插件的辅助程序在参与。删除数据、传输敏感数据、安装软件、解验证码、改系统设置这些确认，是**模型**与用户之间要商量的事，辅助程序不另外施加一套策略。

## `browser`

动作：`list_browsers`、`list_tabs`、`open_tab`、`get_tab`、`documentation`、
`state`、`click`、`type_text`、`paste`、`press_key`、`scroll`、`drag`、
`select_text`、`set_value`、`goto`、`back`、`forward`、`reload`、`close`、
`screenshot`。

插件通过 DevTools 协议拉起自己的 Chrome，profile 在 `~/.dsh/dsh-codex-tools/browser`。`list_browsers` 看自己开的窗口，`list_tabs` 看标签页，`open_tab` 或 `get_tab` 绑定一个并保持绑定。

`state` 每个无障碍节点打印一行，格式是 `[1234567] button Submit`。这个编号在同一个页面里保持有效，之后再读一次 `state` 不会重新编号。`press_key` 接受 xdotool 风格的按键名（`Return`、`Tab`、`ArrowDown`、`super+c`）和组合键。`set_value` 是替换输入框里的内容，不是追加。

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

目标会话看不到发起方的对话，所以简报必须自包含。建出来的会话就是普通 Harness 会话：出现在侧边栏、独立运行，之后可以用 `send` 继续指挥。

`send` 默认立即投递：即使目标正在跑一轮或一个目标，也会以 `agent-message` + `relay` 来源 steer 进去，不排到下一轮。目标消息行显示「来自会话 <发送方标题或 id>」，消息正文第一行也带发送方。只有显式传 `mode: "queue"` 时才按下一轮排队；子代理目标仍走宿主的所有权检查路径。

`session_id` 接受 `session-<uuid>` 或裸 UUID：工具先按规范形式解析，只有 not-found 才回退另一种，所有权或 busy 错误不会换目标重试。`list_sessions` 默认只列顶层会话，并带上 `origin` 与 `parentSessionId`；需要看裸 UUID 的子代理时显式传 `include_subagents: true`。

`workspace` 接受工作区 id、绝对路径或标题片段。尚未注册的绝对路径会被建成新工作区。

## `codex_tools_update`

动作：`status`、`check`、`install`、`operation`。

用来更新插件自己。这几个动作是流程里各自独立的一步，只有 `install` 会改变任何东西：

| 动作 | 做什么 |
| --- | --- |
| `status` | 报告当前运行版本、上次检查时间，以及这个安装能否在线替换。 |
| `check` | 从 GitHub 读最新稳定版。只读：不下载、不安装任何东西。 |
| `install` | 用最新版替换 bundle。必须传 `confirm: true`。 |
| `operation` | 读取已经在跑的更新任务的状态。 |

传 `confirm: true` 之前先问用户：插件是原地替换。

### 安装保证什么

- **来源固定。** 仓库、发布接口、安装 spec 都是插件里的常量。不接受调用方传入的 URL、包名、registry 或版本豁免。
- **目标钉死。** 发布 tag 会解析成不可变 commit，并且该 commit 下的 `package.json` 必须声明本包名、本版本号和 bundle patch。不匹配就在替换任何东西之前中止。
- **不跑安装脚本。** 声明了 `preinstall`、`install`、`postinstall` 或 `prepare` 的清单直接拒绝。
- **在插件之外执行。** 替换放在一个不属于插件的 Host 任务里跑，所以插件中途被卸载也杀不掉这次替换。
- **事后核对。** 成功要求记录的 bundle 行与钉死的 commit 一致，并且本插件自己的路由回报的就是新版本——不只是管理器回执。
- **可恢复。** 如果 profile 已被改动之后替换失败，会重新安装并启用原来运行的版本。恢复也失败时会明说，并打印手动命令，而不是谎报成功。
- **不覆盖外来安装。** 期间被其他管理器调用者装上的版本会被识别出来并放过。

### 它不会做什么

在线更新只处理来自本仓库的安装。本地 `link:` 检出、fork，或不是可移除 profile 安装的 bundle 一律拒绝，`status` 会说明原因。没有后台轮询、不会自动更新：不调用这个工具就什么都不会发生。

## 目录结构

```
index.js                 插件入口：apply / inject，注册工具
client-entry.js          设置页源码（client 半侧的构建输入）
client.js                构建后的 client 半侧（esbuild 产物）
lib/ax-client.mjs        电脑操控辅助程序的 JSON 行客户端
lib/computer-tool.mjs    computer_use
lib/cdp-browser.mjs      Chrome DevTools 协议驱动
lib/browser-tool.mjs     browser
lib/session-tool.mjs     session_message
lib/update-tool.mjs      codex_tools_update
lib/update-service.mjs   GitHub 发布检查
lib/online-update.mjs    原地替换 bundle
lib/update-host.mjs      设置页的更新路由
lib/settings-store.mjs   设置页写入的设置文件
lib/settings-host.mjs    设置页的设置路由
lib/owned-data.mjs       设置页拥有的开关之外的数据
lib/define-tool.mjs      零依赖的 defineTool
lib/format-time.mjs      设置页的时间格式化
lib/version.mjs          严格稳定版本号
cordis.patch.yml         bundle patch
native/                  电脑操控辅助程序源码（Swift、C#）
bin/                     编译好的电脑操控辅助程序
docs/architecture.md     各部件如何拼在一起
```

## 开发

```sh
npm test    # 离线测试，不需要任何权限或浏览器
```

`lib/*.mjs` 不在 Harness 的 HMR 监听范围内。改完模块后要重挂插件，运行中的实例才会用上新代码：

```
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: false }
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: true }
```

改完 `client-entry.js` 要重新构建 client 半侧：用 esbuild 打成浏览器用的 CommonJS，保留 Harness 要求的模块加载包装（`window.__ModuleLoader__.load({ id: "@local/dsh-codex-tools", factory(require) { … } })`），并把 `react`、`react-dom`、`react-dom/client`、`@deepseek-ai/*` 保持为 external。

## 许可

MIT，见 [LICENSE](<LICENSE>)。
