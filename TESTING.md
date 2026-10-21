# Validation status — 0.2.1 development preview

## Completed in the isolated build environment

- `npm run check:offline`: passes against the documented host-interface subset.
- `npm test`: automated unit/install coverage must pass.
- Browser harness: 11 interaction checks pass with no uncaught errors (mock host, not Obsidian).
- Build and release-structure checks pass after packaging.

The environment could not complete `npm install`, so an official Obsidian npm type
check has not yet run. Isolated tests do not replace a real Obsidian test.

## Required local test

1. Use a disposable Vault and remove old v1 `Sourcebook/` test data.
2. Create/rename/archive/restore a Book.
3. Add an existing Vault PNG and Markdown note; verify no wrapper Source files.
4. Add short text and a link; verify neither creates a reusable wrapper Markdown.
5. Edit a detail text field and a Book note, then close immediately; verify one
   success confirmation and persistence after reopening.
6. Put the same file in two Books with different notes.
7. Create and append project-note references; verify files use native links with
   backlinks, and text/Book context is ordinary editable project prose.
8. Click Send to AI and confirm it enters source multi-select directly (without
   a note-sending choice); verify linked binary files are collected while helper
   Markdown for a link or post is not attached or read into the prompt.
9. Remove, restore and permanently delete a Book entry; originals must remain.
10. Create a project note and confirm it lands in `Sourcebook/Project Notes/`.
11. Pair the browser Picker, check its immediate loading state, connection flow,
    recent picks, left-top page notices and the top-centre plugin toast.
12. Restart Obsidian, check dark/light themes, narrow panels and plugin unload.
13. Test native file clipboard separately on real macOS/Windows before enabling it
    by default or claiming target-client support.
