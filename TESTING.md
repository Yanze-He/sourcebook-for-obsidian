# Validation status — 0.2.0 development preview

## Completed in the isolated build environment

- `npm run check:offline`: passes against the documented host-interface subset.
- `npm test`: automated unit/install coverage must pass (currently 53 tests).
- Browser harness: 11 interaction checks pass with no uncaught errors (mock host, not Obsidian).
- Build and release-structure checks pass after packaging.

The environment could not complete `npm install`, so an official Obsidian npm type
check has not yet run. Isolated tests do not replace a real Obsidian test.

## Required local test

1. Use a disposable Vault and remove old v1 `Sourcebook/` test data.
2. Create/rename/archive/restore a Book.
3. Add an existing Vault PNG and Markdown note; verify no wrapper Source files.
4. Add short text and a link; promote one to a reusable material note.
5. Edit Book notes from both the card and Book Markdown; verify one shared value.
6. Put the same file in two Books with different notes.
7. Create and append project-note references; verify files use native links with
   backlinks, and text/Book context is ordinary editable project prose.
8. Send that project note to AI; verify linked binary files are collected while
   linked `Sourcebook/Assets/*.md` or `Sourcebook/Materials/*.md` files are not
   attached or read into the prompt.
9. Remove, restore and permanently delete a Book entry; originals must remain.
10. Run quick AI handoff and verify no Snapshot directory is created.
11. Save a handoff snapshot and verify prompt, manifest and copied bytes.
12. Restart Obsidian, check dark/light themes, narrow panels and plugin unload.
13. Test native file clipboard separately on real macOS/Windows before enabling it
    by default or claiming target-client support.
