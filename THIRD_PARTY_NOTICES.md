# Provenance

The product and Pack behavior follow Sourcebook for Agents by its contributors.
Native file-list clipboard scripts in `src/clipboard.ts` are adapted from the
macOS AppKit/JXA and Windows file-list strategy in
`Yanze-He/sourcebook-for-agents/apps/service-go/desktop_actions.go`, reviewed at
commit `c36aa1b87b25f572ef8bd1531af2e3b26accf8b8` (MIT). Its copyright and license
are preserved in LICENSE. No Go binary or Desktop database code is included.

The rest of this implementation was written for this independent plugin. It is
not a wholesale extraction of the existing Sources React screen, and does not
claim the previous prompt-template editor has been fully migrated.

Obsidian provides the runtime API and retains its own license. TypeScript,
@types/node and the obsidian type package are development dependencies, not
bundled runtime code. Official API reference: https://docs.obsidian.md/

Button icons reuse path geometry from lucide-react v1.37.0, as used by the
local Sourcebook Desktop project. Lucide is licensed under the ISC license;
see its bundled LICENSE in that project's dependency tree.
