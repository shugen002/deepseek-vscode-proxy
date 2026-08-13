/**
 * dsh-vscode-ssh-open — browser half (built artifact).
 *
 * Hand-written plain-JS client bundle in the client-modules handoff shape
 * (`window.__ModuleLoader__.load({ id, factory })`), mirroring the source in
 * src/index.js. No TypeScript/JSX/imports; React arrives via require("react").
 *
 * Behavior:
 *  - Replaces `workspaces.openPath` on the live service instance, so every
 *    "view local file" hand-off (tool-result file rows, produced-files chips,
 *    "Show in folder") navigates the browser to
 *    `vscode://vscode-remote/ssh-remote+<host><abs-path>:1:1` instead of the OS
 *    default app. The `:1:1` ROW:COL forces file (not folder) semantics.
 *  - Registers one card under Settings > Plugins > Configurable
 *    (slot `settings.plugin.item`) where the SSH Remote host is edited and
 *    persisted to localStorage.
 *  - With no host configured, the original OS-open behavior is preserved.
 */
window.__ModuleLoader__.load({
  id: '@deepseek-ai/dsh-vscode-ssh-open',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const inject = ['slots', 'workspaces']

    const STORAGE_KEY = 'dsh.vscode-ssh-open.host'

    function readStoredHost() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) ?? ''
      } catch {
        return ''
      }
    }

    function writeStoredHost(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value)
      } catch {
        // Storage unavailable (private mode / policy): keep in-memory only.
      }
    }

    let sshHost = readStoredHost()

    function buildUrl(host, path) {
      // vscode-remote SSH form: ssh-remote+<host><abs-path>. Append :1:1 so
      // VSCode opens the path as a FILE in the editor; without trailing ROW:COL
      // a file path is (mis)treated as a folder. Real directories still open as
      // folders regardless of the line:column suffix.
      return 'vscode://vscode-remote/ssh-remote+' + host + encodeURI(path) + ':1:1'
    }

    function attemptOpen(url) {
      // One same-context anchor navigation: external protocols trigger the OS
      // "Open VSCode?" hand-off prompt and keep the harness page on screen.
      // Avoids the blank new tab / double hand-off of window.open('_blank').
      const a = window.document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      a.target = '_self'
      window.document.body.appendChild(a)
      a.click()
      a.remove()
    }

    function apply(ctx) {
      const ws = ctx.workspaces
      if (ws === undefined) return

      const originalOpenPath = ws.openPath

      ws.openPath = async (path) => {
        const host = sshHost.trim()
        if (!host) {
          return originalOpenPath.call(ws, path)
        }
        if (typeof path === 'string' && path.length > 0) {
          attemptOpen(buildUrl(host, path))
        }
        return undefined
      }

      ctx.effect(() => () => { ws.openPath = originalOpenPath })

      // Plugin card under Settings > Plugins > Configurable (slot
      // settings.plugin.item): one card per plugin, rendered inside the
      // configurable tab's card list. The card owns its internals — title,
      // description, and the SSH host field.
      const VscodeSshOpenCard = () => {
        const [value, setValue] = React.useState(sshHost)
        const cardStyle = {
          listStyle: 'none',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid var(--dsw-border-1, #d0d7de)',
          background: 'var(--dsw-bg-1, #fff)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }
        const nameStyle = { fontSize: '14px', fontWeight: 600, color: 'var(--dsw-text-1, #24292f)' }
        const descStyle = { fontSize: '12px', color: 'var(--dsw-text-2, #57606a)' }
        const inputStyle = {
          width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '6px',
          border: '1px solid var(--dsw-border-1, #d0d7de)', background: 'var(--dsw-bg-1, #fff)',
          color: 'var(--dsw-text-1, #24292f)', fontFamily: 'ui-monospace, monospace', fontSize: '13px',
        }
        return React.createElement('li', { style: cardStyle },
          React.createElement('div', { style: nameStyle }, 'VSCode SSH Remote Open'),
          React.createElement('div', { style: descStyle },
            'SSH Remote host for opening files via vscode://vscode-remote/ssh-remote+<host><path>:1:1. '
            + 'Leave empty to keep the OS default open.',
          ),
          React.createElement('input', {
            type: 'text',
            value: value,
            placeholder: 'e.g. myserver  or  user@myserver[:port]',
            spellCheck: false,
            autoComplete: 'off',
            style: inputStyle,
            onChange: (e) => {
              const next = e.target.value
              setValue(next)
              sshHost = next
              writeStoredHost(next)
            },
          }),
        )
      }

      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
        { name: 'settings.plugin.item', id: 'vscode-ssh-open', order: 30 },
        VscodeSshOpenCard,
      ))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
