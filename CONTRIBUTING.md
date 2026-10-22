# Contributing to Sourcebook

Thanks for helping make Sourcebook more useful for people who keep project
materials in Obsidian.

## Good first contributions

- Report a reproducible bug or an unclear workflow.
- Share a real project-material workflow that Sourcebook should support.
- Improve documentation, accessibility, translations, or tests.
- Submit a focused fix with a clear before-and-after description.

For feature proposals, open an issue before implementing a large change. Explain
the user problem, the expected workflow, and how original Vault files should be
kept safe.

## Development setup

```bash
npm install
npm run check
npm run package
```

To test in Obsidian, copy the generated `sourcebook` directory into a disposable
Vault at `.obsidian/plugins/sourcebook/`, then enable it in Community plugins.
Use a disposable Vault for manual testing; do not use a production Vault as a
test fixture.

## Pull request expectations

- Keep changes scoped and explain the user-visible result.
- Preserve original Vault files. Removing a material from a Book must not delete
  the source file.
- Keep Sourcebook local-first: do not add background uploads, telemetry, or
  network requests without first discussing the product and privacy impact.
- Validate paths and avoid overwriting user files on collision.
- Run `npm run check`; manually test relevant flows in a disposable Vault when
  the change affects the Obsidian interface or file writes.
- Update public documentation when behavior or requirements change.

## Code and design notes

- The plugin uses Obsidian's public APIs and keeps paths Vault-relative.
- Book data is readable Markdown; project notes contain native file links and
  ordinary editable prose.
- Native file clipboard support is optional and experimental. Keep it opt-in
  unless it has been tested on the target operating system and destination app.

## Reporting security issues

Please do not post a suspected security or data-loss issue publicly first. Use
the repository owner's contact method listed on GitHub and include a minimal,
safe reproduction.
