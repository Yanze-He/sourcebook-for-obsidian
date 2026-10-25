import { App, TFile, TFolder, parseYaml, FileSystemAdapter } from 'obsidian';
import { VaultIO, FileInfo, Frontmatter, Parsed, safeRelative, containingFolder } from './core';

export class ObsidianVaultIO implements VaultIO {
    constructor(readonly app: App) { }
    private file(path: string): TFile {
        const file = this.app.vault.getAbstractFileByPath(safeRelative(path));
        if (!(file instanceof TFile)) throw new Error(`File missing: ${path}`);
        return file;
    }
    private info(file: TFile): FileInfo { return { path: file.path, name: file.name, extension: file.extension, size: file.stat.size, mtime: file.stat.mtime }; }
    listMarkdown(): FileInfo[] { return this.app.vault.getMarkdownFiles().map(file => this.info(file)); }
    getFile(path: string): FileInfo | undefined {
        const file = this.app.vault.getAbstractFileByPath(safeRelative(path));
        return file instanceof TFile ? this.info(file) : undefined;
    }
    exists(path: string): boolean { return Boolean(this.app.vault.getAbstractFileByPath(safeRelative(path))); }
    async mkdir(path: string): Promise<void> {
        const existing = this.app.vault.getAbstractFileByPath(safeRelative(path));
        if (existing) {
            if (!(existing instanceof TFolder)) throw new Error(`A file occupies the folder path: ${path}`);
            return;
        }
        await this.app.vault.createFolder(path);
    }
    read(path: string): Promise<string> { return this.app.vault.read(this.file(path)); }
    async create(path: string, text: string): Promise<void> { await this.app.vault.create(safeRelative(path), text); }
    async createBinary(path: string, bytes: ArrayBuffer): Promise<void> { await this.app.vault.createBinary(safeRelative(path), bytes); }
    readBinary(path: string): Promise<ArrayBuffer> { return this.app.vault.readBinary(this.file(path)); }
    async process(path: string, change: (current: string) => string): Promise<void> { await this.app.vault.process(this.file(path), change); }
    async rename(path: string, newPath: string): Promise<void> { await this.app.fileManager.renameFile(this.file(path), safeRelative(newPath)); }
    async remove(path: string): Promise<void> { await this.app.fileManager.trashFile(this.file(path)); }
    updateMeta(path: string, change: (meta: Frontmatter) => void): Promise<void> { return this.app.fileManager.processFrontMatter(this.file(path), change); }
    parse(text: string): Parsed {
        const normalized = text.replace(/^\uFEFF/, '');
        const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        if (!match) return { meta: {}, body: normalized };
        const value: unknown = parseYaml(match[1] || '');
        if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid YAML frontmatter');
        return { meta: value as Frontmatter, body: normalized.slice(match[0].length).trim() };
    }
    resolveAttachment(link: string, sourcePath: string): string | undefined {
        if (!link) return undefined;
        const wiki = link.match(/^!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]$/);
        const markdown = link.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);
        const target = wiki?.[1] || (markdown?.[1] ? decodeURIComponent(markdown[1].replace(/^<|>$/g, '')) : undefined);
        if (!target || /^(?:[a-z]+:|\/)/i.test(target)) return undefined;
        return this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path;
    }
    link(path: string, from: string, embed = false, alias?: string, subpath = ''): string {
        return this.app.fileManager.generateMarkdownLink(this.file(path), from, subpath, alias).replace(/^/, embed ? '!' : '');
    }
    resource(path: string): string { return this.app.vault.getResourcePath(this.file(path)); }
    private opensInsideObsidian(file: TFile): boolean {
        return ['md', 'canvas', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg', 'mp3', 'm4a', 'wav', 'ogg', 'flac', 'mp4', 'webm', 'mov'].includes(file.extension.toLowerCase());
    }
    private electronShell(): { openPath?: (path: string) => Promise<string>; showItemInFolder?: (path: string) => void } | undefined {
        try {
            const candidate = (window as Window & { require?: (module: string) => { shell?: unknown } }).require?.('electron')?.shell;
            const shell = candidate as { openPath?: unknown; showItemInFolder?: unknown } | undefined;
            return shell && (typeof shell.openPath === 'function' || typeof shell.showItemInFolder === 'function')
                ? shell as { openPath?: (path: string) => Promise<string>; showItemInFolder?: (path: string) => void }
                : undefined;
        } catch { return undefined; }
    }
    async open(path: string): Promise<void> {
        const file = this.file(path);
        if (this.opensInsideObsidian(file)) {
            await this.app.workspace.getLeaf('tab').openFile(file);
            return;
        }
        const shell = this.electronShell();
        if (!shell?.openPath) throw new Error('Opening this file externally requires Obsidian desktop');
        const failure = await shell.openPath(this.absolute(path));
        if (failure) throw new Error(failure);
    }
    async reveal(path: string): Promise<void> {
        const shell = this.electronShell();
        const absolute = this.absolute(path);
        // Opening the parent directory is much faster on macOS than asking
        // Finder to reveal and select one file. It also avoids Windows'
        // legacy Explorer /select, parsing entirely.
        if (shell?.openPath) {
            const failure = await shell.openPath(containingFolder(absolute));
            if (failure) throw new Error(failure);
            return;
        }
        if (!shell?.showItemInFolder) throw new Error('Revealing a file requires Obsidian desktop');
        shell.showItemInFolder(absolute);
    }
    absolute(path: string): string {
        this.file(path);
        const adapter = this.app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) throw new Error('This action requires a local filesystem Vault');
        return adapter.getFullPath(safeRelative(path));
    }
}
