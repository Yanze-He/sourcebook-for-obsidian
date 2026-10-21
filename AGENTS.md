# Development rules

Independent Obsidian plugin. Do not modify Sourcebook Desktop or add MCP.
Picker integration is a later milestone and must reuse the existing browser extension.

- Preserve user data. Removing membership must never delete original files.
- Make no network requests or background uploads in 0.1.0.
- VaultIO is the sole file-access boundary; use Obsidian's public file APIs.
- Keep paths Vault-relative and validate all writes. Never overwrite on collision.
- Never execute HTML from a source or interpolate user data into OS commands.
- Native clipboard is opt-in and experimental until tested on the target OS.
- `npm run check` is the real type/test/build gate after online dependency install.
- `npm run check:offline` checks a partial host contract, not the official API.
- Do not report browser-harness tests as real Obsidian integration tests.
- Do not publish Release or submit to the community directory without approval.
