/**
 * VSCode SSH Remote Open — DeepSeek Harness client plugin.
 *
 * Intercepts the web UI's "view local file" action and, instead of handing the
 * path to the operating system's default application, attempts to open the file
 * in VSCode over SSH Remote by navigating the browser to:
 *
 *   vscode://vscode-remote/ssh-remote+<host><abs-path>:1:1
 *
 * The trailing `:1:1` (ROW:COL) forces VSCode to open the path as a FILE in the
 * editor; without it a file path is (mis)treated as a folder. Real directories
 * still open as folders regardless of the suffix.
 *
 * Covered entry points (they all funnel through the client `workspaces.openPath`
 * service):
 *   - file links in tool results (read/write/edit file-mutation rows)
 *   - produced-files chips on a finished turn
 *   - the "Show in folder" folder hand-off (opens that folder in VSCode)
 *
 * Configuration lives under Settings > Plugins > Configurable, in the plugin's
 * own card (slot `settings.plugin.item`), and the SSH host is persisted to
 * localStorage so it survives page reloads.
 *
 * Plain JavaScript only: no TypeScript, JSX, or imports.
 */

/**
 * Returns the Cordis Client plugin.
 * @param {{ createElement: Function, useState: Function }} React
 * @returns {{ inject: string[], apply: Function }}
 */
return (() => {
  // Persisted SSH host, edited under Settings > Plugins. Empty means "fall back
  // to the original OS-open behavior".
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
    // vscode-remote SSH form: ssh-remote+<host><abs-path>.  Append :1:1 so
    // VSCode opens the path as a FILE in the editor; without trailing ROW:COL a
    // file path is (mis)treated as a folder. Real directories still open as
    // folders regardless of the line:column suffix.
    return 'vscode://vscode-remote/ssh-remote+' + host + encodeURI(path) + ':1:1'
  }

  function attemptOpen(url) {
    // One same-context anchor navigation: external protocols trigger the OS
    // "Open VSCode?" hand-off prompt and keep the harness page on screen. This
    // avoids the blank new tab / double hand-off of window.open(url, '_blank').
    const a = window.document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    a.target = '_self'
    window.document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return {
    inject: ['slots', 'workspaces'],
    apply(ctx) {
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

      const slots = ctx.slots
      slots.inject('settings.plugin.item', () => slots.register(
        { name: 'settings.plugin.item', id: 'vscode-ssh-open', order: 30 },
        VscodeSshOpenCard,
      ))
    },
  }
})()
