/**
 * dsh-vscode-ssh-open — node half.
 *
 * Registers the plugin's settings namespace so the browser half can read/write
 * the SSH Remote host through the official settings scope, and so the value can
 * be seeded (or overridden) from the composition's `config:` block exactly like
 * any Cordis plugin configuration (see the "配置 / Config" chapter of the
 * Cordis tutorial).
 *
 * The interception itself happens in the browser half (exports "./client");
 * this half only owns the configuration schema and its wiring into the settings
 * surface.
 */
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'

/** Settings namespace this package owns — also spelled in the browser half. */
export const VSCodeSSHOpenNamespace = settingsNamespace('dsh-vscode-ssh-open')

/** Plugin configuration: the SSH Remote host used to build vscode:// links. */
export const Config = Schema.object({
  sshHost: Schema.string(),
})

/**
 * Register the settings section. The browser half binds this namespace via
 * `ctx.settingsScope`; the config can also be supplied/overridden from the
 * composition row's `config:` block (defaults and validation applied by the
 * loader, per the Cordis config chapter).
 * @param ctx - host plugin context.
 * @param config - resolved plugin config (schema defaults applied).
 */
export function apply(ctx, config = {}) {
  installSettingsSection(ctx, VSCodeSSHOpenNamespace, Config, config, {
    setSource: () => {}, // interception runs browser-side; nothing to derive here
    onChange: () => {},
  })
}

export { settingsNamespace }
