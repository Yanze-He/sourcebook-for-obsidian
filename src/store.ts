import {
    ASSETS_DIR, Book, BOOKS_DIR, DATA_DIR, emptyRegistry, Entry, entryId, id, Library,
    MaterialMetadata, newBookBody, PickerMetadata, plainTitle, parseRegistry, PROJECT_NOTES_DIR, REGISTRY_PATH, Resolved, ROOT, safeName,
    safeRelative, SCHEMA, serialize, SerialQueue, titleFromPath, VaultIO, webUrl, decodeBook, rewriteBookBody,
    kindFor, message, DocumentLanguage
} from './core';

export class SourcebookStore {
    readonly io: VaultIO;
    private queue = new SerialQueue();
    constructor(io: VaultIO) { this.io = io; }

    private defaultInlineTitle(type: 'text' | 'link', language: DocumentLanguage): string {
        if (language === 'zh') return type === 'text' ? '文字' : '链接';
        return type === 'text' ? 'Text' : 'Link';
    }

    async folders(): Promise<void> {
        for (const path of [ROOT, BOOKS_DIR, PROJECT_NOTES_DIR, ASSETS_DIR, DATA_DIR]) {
            if (!this.io.exists(path)) await this.io.mkdir(path);
        }
    }

    async load(): Promise<Library> {
        const books: Book[] = [], warnings: string[] = [], ids = new Set<string>();
        let legacyDetected = false;
        for (const file of this.io.listMarkdown().filter(f => f.path.startsWith(`${BOOKS_DIR}/`))) {
            try {
                const parsed = this.io.parse(await this.io.read(file.path));
                if (parsed.meta.sb_type === 'book' && parsed.meta.sb_schema === 1) {
                    legacyDetected = true;
                    warnings.push(`${file.path}: v1 test data is not supported. Back up needed originals, then remove the old Sourcebook folder.`);
                    continue;
                }
                if (parsed.meta.sb_type !== 'book') continue;
                const book = decodeBook(file.path, parsed);
                if (ids.has(book.id)) throw new Error(`Duplicate Book ID: ${book.id}`);
                ids.add(book.id);
                books.push(book);
            } catch (error) {
                warnings.push(`${file.path}: ${message(error)}`);
            }
        }
        if (this.io.exists(`${ROOT}/Sources`)) {
            legacyDetected = true;
            warnings.push('Legacy Sourcebook/Sources data detected. v2 does not read wrapper Source records.');
        }
        return { books: books.sort((a, b) => a.title.localeCompare(b.title)), warnings, legacyDetected };
    }

    private async uniquePath(folder: string, stem: string, extension: string): Promise<string> {
        const clean = safeName(stem);
        for (let index = 1; index < 10000; index++) {
            const suffix = index === 1 ? '' : ` ${index}`;
            const path = `${folder ? `${folder}/` : ''}${clean}${suffix}.${extension}`;
            if (!this.io.exists(path)) return path;
        }
        throw new Error('Could not find a free file name');
    }

    async createBook(title: string, language: DocumentLanguage = 'en'): Promise<Book> {
        return this.queue.run(async () => {
            await this.folders();
            const requestedTitle = title.trim() ? plainTitle(title) : 'New Book';
            const path = await this.uniquePath(BOOKS_DIR, requestedTitle, 'md');
            const meta = { sb_type: 'book', sb_schema: SCHEMA, sb_id: id(), sb_language: language, archived: false };
            const text = serialize(meta, newBookBody(language));
            await this.io.create(path, text);
            return decodeBook(path, this.io.parse(text));
        });
    }

    private async currentBook(book: Book): Promise<{ book: Book; parsed: ReturnType<VaultIO['parse']> }> {
        const parsed = this.io.parse(await this.io.read(book.path));
        const current = decodeBook(book.path, parsed);
        if (current.id !== book.id) throw new Error('Book identity changed; reload before editing');
        return { book: current, parsed };
    }

    private async mutateBook(book: Book, change: (entries: Entry[]) => Entry[]): Promise<Book> {
        let result: Book | undefined;
        await this.io.process(book.path, currentText => {
            const parsed = this.io.parse(currentText);
            const current = decodeBook(book.path, parsed);
            if (current.id !== book.id) throw new Error('Book identity changed; reload before editing');
            const entries = change(current.entries.map(entry => ({ ...entry })));
            const body = rewriteBookBody(parsed.body, entries, current.language);
            const next = serialize(parsed.meta, body);
            result = decodeBook(book.path, this.io.parse(next));
            return next;
        });
        if (!result) throw new Error('Book update failed');
        return result;
    }

    async renameBook(book: Book, title: string): Promise<Book> {
        return this.queue.run(async () => {
            const current = await this.currentBook(book);
            const targetName = `${safeName(plainTitle(title))}.md`;
            const folder = book.path.split('/').slice(0, -1).join('/');
            const target = `${folder}/${targetName}`;
            if (target !== book.path && this.io.exists(target)) throw new Error('A Book with that name already exists');
            if (target !== book.path) await this.io.rename(book.path, target);
            return { ...current.book, path: target, title: titleFromPath(target) };
        });
    }

    async archiveBook(book: Book, archived: boolean): Promise<void> {
        return this.queue.run(() => this.io.updateMeta(book.path, meta => {
            if (meta.sb_id !== book.id || meta.sb_schema !== SCHEMA) throw new Error('Book identity changed');
            meta.archived = archived;
        }));
    }


    async deleteBook(book: Book, deleteOriginals = false): Promise<void> {
        return this.queue.run(async () => {
            const current = await this.currentBook(book);
            if (current.book.id !== book.id) throw new Error('Book identity changed');
            await this.io.remove(book.path);
            if (!deleteOriginals) return;
            const originals = [...new Set(current.book.entries.filter(entry => entry.type === 'file').map(entry => this.io.resolveAttachment(entry.target || '', current.book.path)).filter((path): path is string => Boolean(path)))];
            for (const path of originals) if (this.io.exists(path)) await this.io.remove(path);
        });
    }

    private async addEntry(book: Book, entry: Entry): Promise<Entry> {
        let attached = entry;
        await this.mutateBook(book, entries => {
            if (entry.type === 'file') {
                const path = this.io.resolveAttachment(entry.target || '', book.path);
                const existing = entries.find(candidate => candidate.type === 'file' && path && this.io.resolveAttachment(candidate.target || '', book.path) === path);
                if (existing) {
                    attached = { ...existing, removed: false };
                    return entries.map(candidate => candidate.id === existing.id ? attached : candidate);
                }
            }
            if (entry.type === 'link') {
                const existing = entries.find(candidate => candidate.type === 'link' && candidate.url === entry.url);
                if (existing) {
                    attached = { ...existing, removed: false };
                    return entries.map(candidate => candidate.id === existing.id ? attached : candidate);
                }
            }
            return [...entries, entry];
        });
        return attached;
    }

    private async addVaultFileUnlocked(book: Book, path: string, language: DocumentLanguage, picker?: PickerMetadata, allowManagedAsset = false): Promise<Entry> {
        safeRelative(path);
        const file = this.io.getFile(path);
        if (!file) throw new Error('File does not exist');
        if (path === ROOT || (path.startsWith(`${ROOT}/`) && !(allowManagedAsset && path.startsWith(`${ASSETS_DIR}/`)))) throw new Error('Select a Vault file outside Sourcebook');
        const kind = kindFor(file.name);
        const target = this.io.link(path, book.path, ['image', 'audio', 'video'].includes(kind));
        return this.addEntry(book, { id: entryId(), type: 'file', removed: false, note: '', target, language, ...(picker ? { picker } : {}) });
    }

    async addVaultFile(book: Book, path: string, language: DocumentLanguage = book.language): Promise<Entry> {
        return this.queue.run(() => this.addVaultFileUnlocked(book, path, language));
    }

    async createVaultNote(book: Book, language: DocumentLanguage = book.language): Promise<string> {
        return this.queue.run(async () => {
            const title = language === 'zh' ? '新笔记' : 'New Note';
            const path = await this.uniquePath('', title, 'md');
            await this.io.create(path, '');
            await this.addVaultFileUnlocked(book, path, language);
            return path;
        });
    }

    async addText(book: Book, title: string, body: string, url = '', language: DocumentLanguage = book.language, picker?: PickerMetadata): Promise<Entry> {
        return this.queue.run(async () => {
            const text = body.trim();
            if (!text) throw new Error('Text cannot be empty');
            if (text.length > 20_000) throw new Error('Text records are limited to 20,000 characters');
            return this.addEntry(book, { id: entryId(), type: 'text', removed: false, note: '', title: plainTitle(title.trim() || this.defaultInlineTitle('text', language)), body: text, url: url ? webUrl(url) : '', updatedAt: new Date().toISOString(), language, ...(picker ? { picker } : {}) });
        });
    }

    async addLink(book: Book, title: string, url: string, language: DocumentLanguage = book.language, picker?: PickerMetadata): Promise<Entry> {
        return this.queue.run(() => this.addEntry(book, { id: entryId(), type: 'link', removed: false, note: '', title: plainTitle(title.trim() || this.defaultInlineTitle('link', language)), url: webUrl(url), updatedAt: new Date().toISOString(), language, ...(picker ? { picker } : {}) }));
    }

    private async loadRegistry() {
        if (!this.io.exists(REGISTRY_PATH)) return emptyRegistry();
        return parseRegistry(await this.io.read(REGISTRY_PATH));
    }

    private async saveRegistry(registry: ReturnType<typeof emptyRegistry>): Promise<void> {
        await this.folders();
        const text = JSON.stringify(registry, null, 2) + '\n';
        if (this.io.exists(REGISTRY_PATH)) await this.io.process(REGISTRY_PATH, () => text);
        else await this.io.create(REGISTRY_PATH, text);
    }

    private async sha256(bytes: ArrayBuffer): Promise<string> {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    }

    async importFile(book: Book, name: string, bytes: ArrayBuffer, language: DocumentLanguage = book.language, metadata: Pick<MaterialMetadata, 'sourceUrl' | 'sourceTitle' | 'capturedAt' | 'captureMethod'> = {}, picker?: PickerMetadata): Promise<Entry> {
        return this.queue.run(async () => {
            if (!bytes.byteLength) throw new Error('Empty file');
            await this.folders();
            const hash = await this.sha256(bytes);
            const registry = await this.loadRegistry();
            let path = Object.values(registry.materials).find(item => item.sha256 === hash && this.io.exists(item.path))?.path;
            if (!path) {
                const stem = name.replace(/\.[^.]+$/, ''), ext = (name.match(/\.([a-zA-Z0-9]{1,12})$/)?.[1] || 'bin').toLowerCase();
                path = await this.uniquePath(ASSETS_DIR, stem, ext);
                await this.io.createBinary(path, bytes);
                const materialId = id();
                registry.materials[materialId] = {
                    id: materialId,
                    path,
                    sha256: hash,
                    capturedAt: metadata.capturedAt || new Date().toISOString(),
                    captureMethod: metadata.captureMethod || 'import',
                    ...(metadata.sourceUrl ? { sourceUrl: metadata.sourceUrl } : {}),
                    ...(metadata.sourceTitle ? { sourceTitle: metadata.sourceTitle } : {})
                };
                await this.saveRegistry(registry);
            }
            return this.addVaultFileUnlocked(book, path, language, picker, true);
        });
    }

    async updateNote(book: Book, entryIdValue: string, note: string, expected?: string): Promise<void> {
        return this.queue.run(async () => {
            await this.mutateBook(book, entries => {
                const current = entries.find(entry => entry.id === entryIdValue);
                if (!current) throw new Error('Entry has been removed; reload');
                // A detail view can save on both blur and close.  Once the first
                // write lands, the second one is intentionally a no-op rather
                // than a stale-editor conflict.
                if (expected !== undefined && current.note !== expected && current.note !== note) throw new Error('Note changed while this dialog was open. Reopen it to avoid overwriting new content.');
                if (current.note === note) return entries;
                return entries.map(entry => entry.id === entryIdValue ? { ...entry, note } : entry);
            });
        });
    }

    async updateText(book: Book, entryIdValue: string, body: string, expected?: string): Promise<void> {
        return this.queue.run(async () => {
            const nextBody = body.trim();
            if (!nextBody) throw new Error('Text cannot be empty');
            if (nextBody.length > 20_000) throw new Error('Text records are limited to 20,000 characters');
            await this.mutateBook(book, entries => {
                const current = entries.find(entry => entry.id === entryIdValue);
                if (!current || current.type !== 'text') throw new Error('Text source no longer exists; reload');
                // See updateNote: repeated saves of the same text are safe.
                if (expected !== undefined && current.body !== expected && current.body !== nextBody) throw new Error('Text changed while this detail view was open. Reopen it to avoid overwriting new content.');
                if (current.body === nextBody) return entries;
                return entries.map(entry => entry.id === entryIdValue ? { ...entry, body: nextBody, updatedAt: new Date().toISOString() } : entry);
            });
        });
    }

    async updateTitle(book: Book, entryIdValue: string, title: string, expected?: string): Promise<void> {
        return this.queue.run(async () => {
            const nextTitle = plainTitle(title);
            const { book: currentBook } = await this.currentBook(book);
            const current = currentBook.entries.find(entry => entry.id === entryIdValue);
            if (!current) throw new Error('Material no longer exists; reload');
            if (expected !== undefined && (current.title || '') !== expected) throw new Error('Title changed while this detail view was open. Reopen it to avoid overwriting new content.');
            if (current.type === 'file') {
                const currentPath = this.io.resolveAttachment(current.target || '', currentBook.path);
                const file = currentPath ? this.io.getFile(currentPath) : undefined;
                if (!currentPath || !file) throw new Error('Original file no longer exists; reload');
                const folder = currentPath.split('/').slice(0, -1).join('/');
                const extension = file.extension ? `.${file.extension}` : '';
                const nextPath = `${folder ? `${folder}/` : ''}${safeName(nextTitle)}${extension}`;
                if (nextPath !== currentPath && this.io.exists(nextPath)) throw new Error('A file with that name already exists');
                if (nextPath !== currentPath) await this.io.rename(currentPath, nextPath);
                const target = this.io.link(nextPath, currentBook.path, ['image', 'audio', 'video'].includes(kindFor(file.name)));
                await this.mutateBook(currentBook, entries => entries.map(entry => entry.id === entryIdValue ? { ...entry, title: nextTitle, target, updatedAt: new Date().toISOString() } : entry));
                return;
            }
            await this.mutateBook(book, entries => {
                return entries.map(entry => entry.id === entryIdValue ? { ...entry, title: nextTitle, updatedAt: new Date().toISOString() } : entry);
            });
        });
    }

    async remove(book: Book, entryIds: string[]): Promise<void> {
        return this.queue.run(async () => { await this.mutateBook(book, entries => entries.filter(entry => !entryIds.includes(entry.id))); });
    }

    async restore(book: Book, entryIdValue: string): Promise<void> {
        return this.queue.run(async () => { await this.mutateBook(book, entries => entries.map(entry => entry.id === entryIdValue ? { ...entry, removed: false } : entry)); });
    }

    async deleteEntry(book: Book, entryIdValue: string): Promise<void> {
        return this.queue.run(async () => { await this.mutateBook(book, entries => entries.filter(entry => entry.id !== entryIdValue)); });
    }

    async deleteEntries(book: Book, entryIds: string[], deleteOriginals = false): Promise<void> {
        return this.queue.run(async () => {
            const current = await this.currentBook(book);
            const selected = current.book.entries.filter(entry => entryIds.includes(entry.id));
            await this.mutateBook(current.book, entries => entries.filter(entry => !entryIds.includes(entry.id)));
            if (!deleteOriginals) return;
            const originals = [...new Set(selected.filter(entry => entry.type === 'file').map(entry => this.io.resolveAttachment(entry.target || '', current.book.path)).filter((path): path is string => Boolean(path)))];
            for (const path of originals) if (this.io.exists(path)) await this.io.remove(path);
        });
    }

    async resolve(book: Book, includeRemoved = false): Promise<{ items: Resolved[]; warnings: string[] }> {
        const items: Resolved[] = [], warnings: string[] = [];
        const registry = await this.loadRegistry().catch(error => { warnings.push(message(error)); return emptyRegistry(); });
        const metadataByPath = new Map<string, MaterialMetadata>();
        for (const metadata of Object.values(registry.materials)) metadataByPath.set(metadata.path, metadata);
        for (const entry of book.entries.filter(candidate => includeRemoved || !candidate.removed)) {
            if (entry.type === 'file') {
                const path = this.io.resolveAttachment(entry.target || '', book.path);
                const file = path ? this.io.getFile(path) : undefined;
                const picker = entry.picker;
                let body = '', url = picker?.sourceUrl || metadataByPath.get(path || '')?.sourceUrl || '';
                if (picker?.modality === 'text' && picker.contentText) body = picker.contentText;
                if (file?.extension.toLowerCase() === 'md') {
                    try {
                        const parsed = this.io.parse(await this.io.read(file.path));
                        body = parsed.body;
                        if (typeof parsed.meta.source_url === 'string' && parsed.meta.source_url) url = webUrl(parsed.meta.source_url);
                    } catch (error) { warnings.push(`${file.path}: ${message(error)}`); }
                }
                const pickedAt = picker?.pickedAt ? Date.parse(picker.pickedAt) : NaN;
                items.push({ entry, bookPath: book.path, title: entry.title || picker?.title || (file ? titleFromPath(file.path) : 'Missing material'), kind: picker?.modality || (file ? kindFor(file.name) : 'file'), body, url, filePath: file?.path, missing: !file, fileSize: file?.size || 0, modifiedAt: Number.isFinite(pickedAt) ? pickedAt : file?.mtime, thumbnailUrl: picker?.thumbnailUrl, faviconUrl: picker?.faviconUrl, sourceTitle: picker?.sourceTitle, sourceOrigin: picker?.sourceOrigin, durationSeconds: picker?.durationSeconds, pickedAt: picker?.pickedAt });
                continue;
            }
            const picker = entry.picker;
            const pickedAt = picker?.pickedAt ? Date.parse(picker.pickedAt) : NaN;
            const updatedAt = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
            // Older Picker text entries can have their selection preserved only in
            // Picker metadata. Prefer the editable Book body, but recover that
            // metadata so existing captures remain visible and editable.
            const body = entry.type === 'text' ? entry.body || (picker?.modality === 'text' ? picker.contentText || '' : '') : '';
            items.push({ entry, bookPath: book.path, title: picker?.title || entry.title || 'Untitled', kind: picker?.modality || (entry.type === 'text' ? 'text' : 'link'), body, url: picker?.modality === 'audio' || picker?.modality === 'video' ? entry.url || picker?.sourceUrl || '' : picker?.sourceUrl || entry.url || '', missing: false, fileSize: 0, modifiedAt: Number.isFinite(pickedAt) ? pickedAt : Number.isFinite(updatedAt) ? updatedAt : undefined, thumbnailUrl: picker?.thumbnailUrl, faviconUrl: picker?.faviconUrl, sourceTitle: picker?.sourceTitle, sourceOrigin: picker?.sourceOrigin, durationSeconds: picker?.durationSeconds, pickedAt: picker?.pickedAt });
        }
        return { items, warnings };
    }

    /** Active original files across every Book; used to avoid duplicate management. */
    async managedVaultPaths(): Promise<Set<string>> {
        const managed = new Set<string>();
        const library = await this.load();
        for (const book of library.books) {
            const { items } = await this.resolve(book);
            for (const item of items) {
                if (item.filePath && !item.filePath.startsWith(`${ROOT}/`)) managed.add(item.filePath);
            }
        }
        return managed;
    }

    /**
     * Project notes deliberately use ordinary Obsidian content, rather than an
     * embedded managed Book block. This gives the original file a native
     * backlink to the project note and leaves all copied context editable by
     * the author. Book notes are therefore a snapshot at insertion time.
     */
    referenceFragment(book: Book, entries: Entry[], target: string): string {
        const note = (entry: Entry): string => entry.note.trim();
        return entries.map(entry => {
            if (entry.type === 'file') {
                const path = this.io.resolveAttachment(entry.target || '', book.path);
                if (!path) return [entry.target || '', note(entry)].filter(Boolean).join(' ');
                const file = this.io.getFile(path);
                const embed = Boolean(file && ['image', 'audio', 'video'].includes(kindFor(file.name)));
                return [this.io.link(path, target, embed), note(entry)].filter(Boolean).join(' ');
            }
            if (entry.type === 'text') return entry.body || '';
            return [`[${entry.title || this.defaultInlineTitle('link', entry.language || book.language)}](${entry.url || ''})`, note(entry)].filter(Boolean).join(' ');
        }).filter(Boolean).join('\n\n') + '\n';
    }

    async createProjectNote(book: Book, entries: Entry[], path: string, language: DocumentLanguage = 'en'): Promise<string> {
        return this.queue.run(async () => {
            path = path.trim().replace(/\\/g, '/');
            if (!path.toLowerCase().endsWith('.md')) path += '.md';
            safeRelative(path);
            if (path.startsWith(`${BOOKS_DIR}/`) || path.startsWith(`${DATA_DIR}/`)) throw new Error('Choose a normal project-note location');
            if (this.io.exists(path)) throw new Error('A file already exists at that path');
            const latest = await this.currentBook(book);
            const selected = entries.map(entry => latest.book.entries.find(candidate => candidate.id === entry.id)).filter((entry): entry is Entry => Boolean(entry));
            const refs = this.referenceFragment(latest.book, selected, path);
            const text = refs;
            const folders = path.split('/').slice(0, -1);
            let folderPath = '';
            for (const folder of folders) {
                folderPath = folderPath ? `${folderPath}/${folder}` : folder;
                if (!this.io.exists(folderPath)) await this.io.mkdir(folderPath);
            }
            await this.io.create(path, text);
            return path;
        });
    }

    async createSummaryNote(book: Book, entries: Entry[], language: DocumentLanguage = 'en'): Promise<string> {
        return this.queue.run(async () => {
            await this.folders();
            const stem = language === 'zh' ? '项目笔记' : 'Project Note';
            let path = '';
            for (let index = 1; index < 10000; index++) {
                const candidate = `${PROJECT_NOTES_DIR}/${stem} ${index}.md`;
                if (!this.io.exists(candidate)) { path = candidate; break; }
            }
            if (!path) throw new Error('Could not find a free summary-note name');
            const latest = await this.currentBook(book);
            const selected = entries.map(entry => latest.book.entries.find(candidate => candidate.id === entry.id)).filter((entry): entry is Entry => Boolean(entry));
            await this.io.create(path, this.referenceFragment(latest.book, selected, path));
            return path;
        });
    }

    async appendReferences(book: Book, entries: Entry[], path: string, language: DocumentLanguage = 'en'): Promise<void> {
        safeRelative(path);
        if (!path.endsWith('.md') || !this.io.getFile(path)) throw new Error('Target note does not exist');
        if (path.startsWith(`${BOOKS_DIR}/`) || path.startsWith(`${DATA_DIR}/`)) throw new Error('Cannot append to a Sourcebook control record');
        await this.queue.run(async () => {
            const current = await this.currentBook(book);
            const selected = entries.map(entry => current.book.entries.find(candidate => candidate.id === entry.id)).filter((entry): entry is Entry => Boolean(entry));
            const fragment = this.referenceFragment(current.book, selected, path);
            await this.io.process(path, text => `${text.trimEnd()}\n\n${fragment}`);
        });
    }

    async projectNote(path: string): Promise<string> {
        safeRelative(path);
        const file = this.io.getFile(path);
        if (!file || file.extension.toLowerCase() !== 'md') throw new Error('Project note does not exist');
        const body = this.io.parse(await this.io.read(path)).body;
        // Captured Markdown is a navigational source document, not task prose.
        // Keep a readable label in the prompt, but never dereference or attach
        // its Markdown body when a project note is handed to an Agent.
        return body.replace(/!?\[\[([^#\]|]+)(?:#[^\]|]+)?(?:\|([^\]]*))?\]\]/g, (raw, _linkPath: string, alias: string | undefined) => {
            const resolved = this.io.resolveAttachment(raw, path);
            const linked = resolved ? this.io.getFile(resolved) : undefined;
            if (!linked || linked.extension.toLowerCase() !== 'md') return raw;
            if (!linked.path.startsWith(`${ASSETS_DIR}/`)) return raw;
            return (alias || titleFromPath(linked.path)).trim();
        });
    }

    async referencedItems(path: string): Promise<Resolved[]> {
        safeRelative(path);
        const file = this.io.getFile(path);
        if (!file || file.extension.toLowerCase() !== 'md') throw new Error('Project note does not exist');
        const text = await this.io.read(path);
        const library = await this.load();
        const found: Resolved[] = [];
        const seen = new Set<string>();
        // Keep supporting existing live Book block embeds. New project-note
        // insertions use the native file link scan below instead.
        const legacyPattern = /!?\[\[([^#\]|]+)#\^(sb-entry-[^\]|]+)(?:\|[^\]]*)?\]\]/g;
        let match: RegExpExecArray | null;
        while ((match = legacyPattern.exec(text))) {
            const rawLink = match[0] || '';
            const entryIdValue = match[2] || '';
            const bookPath = this.io.resolveAttachment(rawLink, path);
            if (!bookPath) continue;
            const book = library.books.find(candidate => candidate.path === bookPath);
            if (!book) continue;
            const key = `${book.id}:${entryIdValue}`;
            if (seen.has(key)) continue;
            const resolved = await this.resolve(book, true);
            const item = resolved.items.find(candidate => candidate.entry.id === entryIdValue);
            if (!item) continue;
            seen.add(key);
            found.push(item);
        }

        // Native file links give the source asset an ordinary Obsidian
        // backlink. Resolve only files that are active members of a Book; this
        // avoids sending arbitrary Vault links from the chosen note.
        const byPath = new Map<string, Resolved>();
        for (const book of library.books) {
            const resolved = await this.resolve(book);
            for (const item of resolved.items) {
                if (!item.filePath || item.missing || this.io.getFile(item.filePath)?.extension.toLowerCase() === 'md') continue;
                if (!byPath.has(item.filePath)) byPath.set(item.filePath, item);
            }
        }
        const nativePattern = /!?\[\[[^\]]+\]\]/g;
        while ((match = nativePattern.exec(text))) {
            const rawLink = match[0] || '';
            const materialPath = this.io.resolveAttachment(rawLink, path);
            if (!materialPath) continue;
            const item = byPath.get(materialPath);
            if (!item) continue;
            const key = `file:${materialPath}`;
            if (seen.has(key)) continue;
            seen.add(key);
            // Context was copied as normal project-note prose at insertion;
            // do not duplicate the current Book note in the AI prompt.
            found.push({ ...item, entry: { ...item.entry, note: '' } });
        }
        return found;
    }

    async handleRename(oldPath: string, newPath: string): Promise<void> {
        if (!this.io.exists(REGISTRY_PATH)) return;
        await this.queue.run(async () => {
            const registry = await this.loadRegistry();
            let changed = false;
            for (const metadata of Object.values(registry.materials)) {
                if (metadata.path === oldPath) { metadata.path = newPath; changed = true; }
            }
            if (changed) await this.saveRegistry(registry);
        });
    }
}
