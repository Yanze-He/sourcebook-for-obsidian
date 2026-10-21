# Release gates

Before any public release:

- Install the official dependencies and run `npm run check`.
- Complete `TESTING.md` in a disposable real Obsidian Vault.
- Verify native file links/embeds and editable text/context in a project note in
  Reading view and Live Preview; confirm the original file receives a backlink.
- Verify normal file rename/link updates and AI handoff attachment selection.
- Keep native clipboard experimental/off unless tested on the target OS and AI app.
- Confirm plugin ID availability, minimum app version, privacy disclosures and
  current community submission requirements.
- Confirm that the root `manifest.json`, `versions.json`, `README.md`, `LICENSE`,
  `main.js` and `styles.css` are present. The community directory reads the root
  manifest and README; released builds must expose the standalone runtime assets.
- Obtain explicit approval before creating a public Release or submission.

When ready:

```bash
npm run check
npm run package
git tag 0.2.1
git push origin 0.2.1
```

The workflow verifies that the tag matches `manifest.json` and creates a draft
release with `main.js`, `manifest.json` and `styles.css`. Publication and a
community-directory pull request remain separate human decisions.
