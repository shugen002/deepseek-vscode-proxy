/**
 * dsh-vscode-ssh-open — browser half (built artifact).
 *
 * Hand-written plain-JS client bundle in the client-modules handoff shape
 * (`window.__ModuleLoader__.load({ id, factory })`). No TypeScript/JSX/imports.
 *
 * Behavior (aligned with the official Cordis config model):
 *  - Binds the `dsh-vscode-ssh-open` settings namespace (registered by the node
 *    half via `installSettingsSection`) with `ctx.settingsScope`, so the SSH
 *    Remote host is real Cordis configuration — seedable from the composition
 *    row's `config:` block, editable here in Settings > Plugins, validated by
 *    the shared schemastery schema.
 *  - Replaces `workspaces.openPath` on the live service instance, so every
 *    "view local file" hand-off navigates the browser to
 *    `vscode://vscode-remote/ssh-remote+<host><abs-path>:1:1` instead of the OS
 *    default app. The `:1:1` ROW:COL forces file (not folder) semantics.
 *  - Registers one card under Settings > Plugins > Configurable (slot
 *    `settings.plugin.item`) that edits the `sshHost` field of that namespace.
 *  - With no host configured, the original OS-open behavior is preserved.
 */
window.__ModuleLoader__.load({
  id: '@shugen002/dsh-vscode-ssh-open',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const inject = ['slots', 'workspaces', 'settingsScope']

    /** Namespace owned by this package (spelled to match lib/index.js). */
    const NS = 'dsh-vscode-ssh-open'

    // Live, synchronized host value read by the openPath interceptor.
    let sshHost = ''

    function buildUrl(host, path) {
      // ssh-remote+<host><abs-path>. Append :1:1 so VSCode opens it as a FILE;
      // without trailing ROW:COL a file path is (mis)treated as a folder.
      return 'vscode://vscode-remote/ssh-remote+' + host + encodeURI(path) + ':1:1'
    }

    function attemptOpen(url) {
      // One same-context anchor navigation: external protocols trigger the OS
      // "Open VSCode?" hand-off prompt and keep the harness page on screen.
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

      // `settingsScope` is a Context merge (provided by the Settings base
      // plugin). Bind our namespace to read/write the SSH host as real Cordis
      // configuration. Declared via inject, so the runtime waits for it.
      const scope = ctx.settingsScope.bind({ namespace: NS })

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

      // Keep sshHost in sync with the authoritative settings scope so the
      // interceptor always uses the resolved value (composition + user layer).
      const sync = () => {
        const snap = scope.getSnapshot()
        const v = snap.value?.sshHost
        sshHost = typeof v === 'string' ? v : ''
      }
      sync()
      ctx.effect(() => scope.subscribe(sync))

      // Settings card under Settings > Plugins > Configurable: a staged edit
      // over the namespace's `sshHost` field, saved/discarded explicitly.
      const VscodeSshOpenCard = () => {
        const [value, setValue] = React.useState(sshHost)
        const [open, setOpen] = React.useState(false)
        const cardStyle = {
          listStyle: 'none',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid var(--dsw-border-1, #d0d7de)',
          background: 'var(--dsw-bg-1, #fff)',
        }
        const headStyle = {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', border: 'none', background: 'none', textAlign: 'left',
          fontFamily: 'inherit', cursor: 'pointer', color: 'inherit', padding: '0',
        }
        const nameStyle = { fontSize: '14px', fontWeight: 600 }
        const descStyle = { fontSize: '12px', color: 'var(--dsw-text-2, #57606a)', marginTop: '2px' }
        const bodyStyle = { marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }
        const labelStyle = { fontSize: '13px', fontWeight: 600 }
        const inputStyle = {
          width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '6px',
          border: '1px solid var(--dsw-border-1, #d0d7de)', background: 'var(--dsw-bg-1, #fff)',
          color: 'var(--dsw-text-1, #24292f)', fontFamily: 'ui-monospace, monospace', fontSize: '13px',
        }
        const footerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '8px' }
        const btnStyle = {
          padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--dsw-border-1, #d0d7de)',
          background: 'var(--dsw-bg-1, #fff)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px',
        }

        const onSave = () => {
          const trimmed = value.trim()
          const write = trimmed === '' ? scope.unset('sshHost') : scope.set('sshHost', trimmed)
          void write.then(() => { sshHost = trimmed; setOpen(false) })
        }
        const onDiscard = () => { setValue(sshHost); setOpen(false) }

        return React.createElement('li', { style: cardStyle },
          React.createElement('button', {
            type: 'button',
            style: headStyle,
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
              React.createElement('span', { style: nameStyle }, 'VSCode SSH Remote Open'),
              React.createElement('span', { style: descStyle },
                'Open local files via vscode://vscode-remote/ssh-remote+<host><path>:1:1',
              ),
            ),
            React.createElement('span', {}, open ? '▾' : '▸'),
          ),
          open
            ? React.createElement('div', { style: bodyStyle },
                React.createElement('label', { style: labelStyle }, 'SSH Remote host'),
                React.createElement('input', {
                  type: 'text',
                  value: value,
                  placeholder: 'e.g. myserver  or  user@myserver[:port]  (empty = OS default)',
                  spellCheck: false,
                  autoComplete: 'off',
                  style: inputStyle,
                  onChange: (e) => setValue(e.target.value),
                }),
                React.createElement('div', { style: footerStyle },
                  React.createElement('button', { type: 'button', style: btnStyle, onClick: onDiscard }, 'Discard'),
                  React.createElement('button', {
                    type: 'button',
                    style: Object.assign({}, btnStyle, { background: 'var(--dsw-accent, #2f81f7)', color: '#fff', borderColor: 'transparent' }),
                    onClick: onSave,
                  }, 'Save'),
                ),
              )
            : null,
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
