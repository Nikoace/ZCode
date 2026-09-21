# ZCode Hardened Profile

This fork changes ZCode from a convenience-first trust model to an explicit opt-in model for capabilities that can move data outside the workspace.

## Secure defaults

The following capabilities are disabled unless explicitly enabled:

| Capability | Opt-in variable |
| --- | --- |
| Desktop/business telemetry and ARMS | `ZCODE_ENABLE_TELEMETRY=1` |
| Model OTLP telemetry | `ZCODE_MODEL_TELEMETRY_ENABLED=1` |
| Bash tool | `ZCODE_ENABLE_BASH=1` |
| MCP servers | `ZCODE_ENABLE_MCP=1` |
| Lifecycle/plugin hooks | `ZCODE_ENABLE_HOOKS=1` |

Merely injecting a telemetry endpoint is not sufficient to turn telemetry on.

## File-system boundary

Agent file tools are restricted to the active workspace.

The following paths are blocked from Agent file tools even when they are inside the workspace:

- `.git/`
- `.ssh/`
- `.aws/`
- `.gnupg/`
- `.kube/`
- `.git-credentials`
- `.netrc`
- `.npmrc`
- `.pypirc`
- real `.env` files such as `.env`, `.env.local`, `.env.production`

Template environment files remain readable:

- `.env.example`
- `.env.sample`
- `.env.template`
- `.env.hardened.example`

## Bash warning

Upstream ZCode currently carries a `sandbox` field in its execution protocol, but the Node execution adapter directly spawns the child process.

The hardened profile therefore treats Bash as an unrestricted host capability and disables it by default.

When `ZCODE_ENABLE_BASH=1` is set, shell commands have the permissions of the ZCode process. Use OS/container isolation if you need Bash in a sensitive repo.

`dangerouslyDisableSandbox=true` is rejected by this profile.

## Recommended launch profile

For a cloud model with no MCP/Hooks/Bash:

```bash
unset ZCODE_ENABLE_TELEMETRY
unset ZCODE_MODEL_TELEMETRY_ENABLED
unset ZCODE_ENABLE_BASH
unset ZCODE_ENABLE_MCP
unset ZCODE_ENABLE_HOOKS
zcode
```

For a local OpenAI-compatible endpoint, configure a custom Provider and keep the same hardened defaults.

## Known remaining gaps

This Phase 1 patch is intentionally small and reviewable. It does not yet:

1. enforce an outbound network allowlist at the process/socket layer;
2. remove Conversation Share / Feedback / official account UI;
3. protect against every symlink-based escape from lexical workspace paths;
4. guarantee that third-party plugins are harmless when explicitly enabled;
5. provide a real OS-level Bash sandbox.

Those should be Phase 2 items rather than hidden behind a false "safe" label.
