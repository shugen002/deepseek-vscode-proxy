<h1 align="center">deepseek-vscode-proxy</h1>

> 在 DeepSeek Harness 网页端把「查看本地文件」改为用 VSCode SSH Remote 打开
> Open "view local file" actions in the DeepSeek Harness Web UI with VSCode over SSH Remote

<br/>

<!-- ============================================================= -->
<!--                            中文                                -->
<!-- ============================================================= -->

## 中文

### 简介

这是一个 **DeepSeek Harness 客户端插件**：拦截网页端「查看本地文件」的操作，不再用操作系统默认应用打开，而是改为在浏览器中发起 `vscode://` 链接，交给本地 VSCode 通过 **SSH Remote** 打开对应文件：

```
vscode://vscode-remote/ssh-remote+<主机><绝对路径>:1:1
```

末尾的 `:1:1`（行:列）强制 VSCode 以 **文件** 方式在编辑器里打开；若没有 ROW:COL，文件路径会被（错误地）当作文件夹处理。真正的目录加不加 `:1:1` 都是按文件夹打开。

### 拦截范围

以下入口都汇聚到客户端 `workspaces.openPath(path)` 服务，只替换这一处即可全部覆盖：

- 工具结果里的文件链接 —— `read` / `write` / `edit` 等文件行
- 回合结束后的 **产生文件** chips（`md`/`ts`/… 等）
- **「在文件夹中显示」** 的文件夹交接（在 VSCode 中打开该文件夹）

配置了 SSH 主机后，点击任一入口，浏览器就会把 `vscode://` 链接交给本地 VSCode，连接 SSH Remote 并打开文件。**未配置主机时保留原有的操作系统默认打开行为。**

### 配置

打开 **设置 → 插件 → 可配置**，会出现本插件的卡片：

> **VSCode SSH Remote Open**
> SSH Remote host for opening files via vscode://vscode-remote/ssh-remote+<host><path>:1:1.

输入你的 SSH Remote 主机，如 `myserver` 或 `user@myserver`（含端口也可写 `user@myserver:2222`，主机字符串原样透传）。配置值持久化到 `localStorage`（key `dsh.vscode-ssh-open.host`），页面刷新不丢失。留空则保持系统默认打开。

示例：主机 `myserver`，路径 `/home/user/app/main.ts` →

```
vscode://vscode-remote/ssh-remote+myserver/home/user/app/main.ts:1:1
```

### 原理

- 插件替换客户端 `workspaces` 服务实例上的 `openPath`（所有聊天文件链接调用的正是它），从而把所有交接导向浏览器。
- 插件停止或更新时通过 `ctx.effect` 的 disposer 自动恢复原方法。
- `vscode://` 用 **单次同上下文锚点导航** 交接（`<a href target="_self">` + `click()`）。外部协议会触发系统「打开 VSCode?」提示框，harness 页面本身不离开，也避免了 `window.open(url, '_blank')` 可能造成的空白新标签页 / 二次交接。

### 包结构

本目录是标准的客户端插件包（`dsh.client` 形态）：

| 路径 | 作用 |
| --- | --- |
| `package.json` | 清单：`dsh.client` 声明（`platform: "web"`、注入边）与 `./client` 导出 |
| `lib/index.js` | Node 半部 —— 空 `apply`（让该行存在于 host 组合） |
| `lib/client.js` | 浏览器半部 —— 手写的 `window.__ModuleLoader__.load({ id, factory })` bundle，导出 `apply`/`inject` |
| `src/index.js` | 客户端逻辑的可读副本（动态插件形态） |
| `README.md` | 本文档 |

### 永久安装（组合 profile）

包已符号链接进 profile 的 node_modules：

```
~/.dsh/profiles/node_modules/@deepseek-ai/dsh-vscode-ssh-open -> /root/deepseek-vscode-proxy
```

并在 profile 补丁层加了一行：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: vscode-ssh-open
      name: '@deepseek-ai/dsh-vscode-ssh-open'
```

**改完组合后重启 web 应用**（`dsh --profile web`）—— loader 在启动时组配各行，客户端 bundle 由 `dsh-client-modules` 对 Loader 条目的扫描发现。重启后插件对 **每个会话** 自动加载，无需每次授权。

卸载：删除补丁行（可选再删符号链接），然后重启。

### 临时安装（动态插件）

想不重启就做单会话试用：把 `src/index.js` 作为 `code.client` 通过 Cordis 动态插件运行时安装（`cordis_define` + `cordis_run`；先授予一次性客户端授权）。

### 说明

- 纯 JavaScript，无 TypeScript / JSX / `import` / `require`；React 通过 `React` 闭包符号（动态）或 `require("react")`（组合 bundle）以 `React.createElement` 使用。
- `encodeURI(path)` 保留绝对路径 `/` 分隔符，同时转义空格等其他 URL 不安全字符；`:1:1` ROW:COL 后缀接在路径之后，远端路径仍可解析。
- 设置项位于 **设置 → 插件 → 可配置**（插槽 `settings.plugin.item`）而非通用设置。

<!-- ============================================================= -->
<!--                            English                             -->
<!-- ============================================================= -->

## English

### Overview

A DeepSeek Harness **client** plugin that intercepts the web UI's "view local file" action and, instead of opening the path with the operating system's default application, attempts to open it in VSCode over **SSH Remote** in the browser:

```
vscode://vscode-remote/ssh-remote+<host><abs-path>:1:1
```

The trailing `:1:1` (ROW:COL) forces VSCode to open the path as a **file** in the editor. Without a trailing `ROW:COL`, a file path is (mis)treated as a *folder*. A real directory still opens as a folder regardless of the suffix.

### What gets intercepted

These entry points all funnel through the client `workspaces.openPath(path)` service, so a single replacement covers them all:

- file links in tool results — `read` / `write` / `edit` file-mutation rows
- **produced-files** chips on a finished turn (the `md`/`ts`/… chips)
- the **"Show in folder"** hand-off (opens the containing folder in VSCode)

Click any of them while an SSH host is configured and the browser hands the `vscode://` URL to your local VSCode, which connects to the SSH Remote and opens the file there. If no host is configured, the original OS-open behavior is kept.

### Configuration

Open **Settings → Plugins → Configurable**. This plugin's card appears there:

> **VSCode SSH Remote Open**
> SSH Remote host for opening files via vscode://vscode-remote/ssh-remote+<host><path>:1:1.

Enter your SSH Remote host — e.g. `myserver` or `user@myserver` (or `user@myserver:2222`; the host string is passed through verbatim). The value is persisted to `localStorage` (`dsh.vscode-ssh-open.host`), so it survives page reloads. Leave it empty to keep the OS default open behavior.

Example: host `myserver`, path `/home/user/app/main.ts` →

```
vscode://vscode-remote/ssh-remote+myserver/home/user/app/main.ts:1:1
```

### How it works

- The plugin replaces `openPath` on the live client `workspaces` service instance (the same instance every chat file link calls), so all hand-offs are routed through the browser.
- The original method is restored automatically when the plugin stops or updates (via a `ctx.effect` disposer).
- The `vscode://` URL is handed off with a **single** same-context anchor navigation (`<a href target="_self">` + `click()`). For an external protocol scheme the browser shows the OS "Open VSCode?" prompt and keeps the harness page on screen, avoiding the blank new tab / double hand-off of `window.open(url, '_blank')`.

### Package layout

| Path | Purpose |
| --- | --- |
| `package.json` | Manifest: `dsh.client` declaration (`platform: "web"`, inject edges) and the `./client` export. |
| `lib/index.js` | Node half — an empty `apply` so the row exists in the host composition. |
| `lib/client.js` | Browser half — hand-written `window.__ModuleLoader__.load({ id, factory })` bundle with `apply`/`inject` exports. |
| `src/index.js` | Readable copy of the client-half logic (the dynamic-plugin form). |
| `README.md` | This document. |

### Permanent installation (composed profile)

The package is symlinked into the profile's node_modules:

```
~/.dsh/profiles/node_modules/@deepseek-ai/dsh-vscode-ssh-open -> /root/deepseek-vscode-proxy
```

and one row was added to the profile patch layer:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: vscode-ssh-open
      name: '@deepseek-ai/dsh-vscode-ssh-open'
```

**Restart the web app** (`dsh --profile web`) after editing the composition — the loader composes rows at boot and the client bundle is discovered by the `dsh-client-modules` scan of the Loader entries. After restart the plugin loads for every session with no per-session approval.

To uninstall: remove the patch row (and optionally the symlink), then restart.

### Temporary (dynamic) install

For a per-session trial without a restart, feed `src/index.js` as `code.client` through the Cordis dynamic-plugin runtime (`cordis_define` + `cordis_run`; grant the one-time client approval).

### Notes

- Plain JavaScript only — no TypeScript, JSX, `import`, or `require`. React is reached through the `React` closure symbol (dynamic) or `require("react")` (composed bundle) with `React.createElement`.
- `encodeURI(path)` preserves the absolute `/` separators while escaping spaces and other URL-unsafe characters in the remote path; the `:1:1` ROW:COL suffix is appended after the path so the remote path stays parseable.
- The setting lives under **Settings → Plugins → Configurable** (slot `settings.plugin.item`), not the General settings.
