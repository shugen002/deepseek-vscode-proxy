/**
 * VSCode SSH Remote Open — DeepSeek Harness client plugin (readable source).
 *
 * This is the faithful readable copy of the client half that ships built in
 * `lib/client.js`. It intercepts the web UI's "view local file" action and,
 * instead of handing the path to the OS default application, opens it in VSCode
 * over SSH Remote via:
 *
 *   vscode://vscode-remote/ssh-remote+<host><abs-path>:1:1
 *
 * The trailing `:1:1` (ROW:COL) forces VSCode to open the path as a FILE; real
 * directories still open as folders.
 *
 * Configuration follows the official Cordis config model:
 *  - The node half (`lib/index.js`) declares the config Schema (Schemastery)
 *    and registers the `dsh-vscode-ssh-open` settings namespace via
 *    `installSettingsSection`; the value can be seeded from the composition
 *    row's `config:` block.
 *  - This client half binds that namespace with `ctx.settingsScope`, reads the
 *    resolved `sshHost` for the openPath interceptor, and edits it through the
 *    Settings > Plugins card.
 *
 * Covered entry points (all funnel through `workspaces.openPath`):
 *   - tool-result file rows (read/write/edit file-mutation links)
 *   - produced-files chips on a finished turn
 *   - the "Show in folder" folder hand-off
 */

/**
 * Returns the Cordis Client plugin.
 * @param {{ useState: Function, createElement: Function }} React
 * @returns {{ inject: string[], apply: Function }}
 */
return (() => {
  /** Namespace owned by this package (must match lib/index.js). */
  const NS = 'dsh-vscode-ssh-open'

  // Live, host-synchronized value read by the openPath interceptor.
  let sshHost = ''

  function buildUrl(host, path) {
    return 'vscode://vscode-remote/ssh-remote+' + host + encodeURI(path) + ':1:1'
  }

  function attemptOpen(url) {
    // One same-context anchor navigation so the OS protocol handler receives
    // the hand-off without leaving the harness page (and without the blank
    // new tab / double hand-off of window.open('_blank')).
    const a = window.document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    a.target = '_self'
    window.document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return {
    inject: ['slots', 'workspaces', 'settingsScope'],
    apply(ctx) {
      const ws = ctx.workspaces
      if (ws === undefined) return

      // settingsScope is a Context merge provided by the Settings base plugin.
      const scope = ctx.settingsScope.bind({ namespace: NS })

      const originalOpenPath = ws.openPath

      ws.openPath = async (path) => {
        const host = sshHost.trim()
        if (!host) return originalOpenPath.call(ws, path)
        if (typeof path === 'string' && path.length > 0) attemptOpen(buildUrl(host, path))
        return undefined
      }
      ctx.effect(() => () => { ws.openPath = originalOpenPath })

      // Keep sshHost in sync with the authoritative settings scope (composition
      // layer + user overrides) so the interceptor always uses the resolved value.
      const sync = () => {
        const v = scope.getSnapshot().value?.sshHost
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
          listStyle: 'none', padding: '12px 14px', borderRadius: '8px',
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
            type: 'button', style: headStyle, 'aria-expanded': open,
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
                  type: 'text', value: value, spellCheck: false, autoComplete: 'off',
                  placeholder: 'e.g. myserver  or  user@myserver[:port]  (empty = OS default)',
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
    },
  }
})()
