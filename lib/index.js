/**
 * dsh-vscode-ssh-open — node half.
 *
 * The empty apply exists so the plugin appears in the host cordis.yml / Loader;
 * the browser half owns all behavior (openPath interception + the Settings >
 * Plugins card) through exports["./client"], discovered from the package.json
 * dsh.client declaration — the same pattern as ui-settings-plugins.
 */

/** Host plugin body — no host-side behavior for this client surface plugin. */
export function apply() {}
