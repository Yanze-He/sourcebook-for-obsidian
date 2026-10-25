/** Native file-list clipboard, opt-in only. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export interface ClipboardTextFile { name: string; text: string; }
type BrowserFileClipboardBridge = (paths: string[], texts: ClipboardTextFile[]) => Promise<void> | void;
type ElectronFileClipboard = {
    clipboard: { write(items: unknown[]): Promise<void> | void };
    ClipboardItem: new (items: Record<'text/uri-list', string>) => unknown;
};

/** The browser harness has a virtual Vault, so it supplies a test-only file clipboard bridge. */
function browserFileClipboardBridge(): BrowserFileClipboardBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    const candidate = (window as Window & { __sourcebookCopyFiles?: unknown }).__sourcebookCopyFiles;
    return typeof candidate === 'function' ? candidate as BrowserFileClipboardBridge : undefined;
}

/**
 * Modern Electron maps text/uri-list to native copied-file data on macOS and
 * Windows. It is used only for validated Vault paths supplied by a deliberate
 * copy action, never for clipboard content received from a page.
 */
function electronFileClipboard(): ElectronFileClipboard | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        const candidate = (window as Window & { require?: (module: string) => unknown }).require?.('electron') as Partial<ElectronFileClipboard> | undefined;
        return candidate
            && candidate.clipboard
            && typeof candidate.clipboard.write === 'function'
            && typeof candidate.ClipboardItem === 'function'
            ? candidate as ElectronFileClipboard
            : undefined;
    } catch { return undefined; }
}

export function fileClipboardPlatform(): boolean {
    return Boolean(browserFileClipboardBridge()) || Boolean(electronFileClipboard()) || Boolean(
        typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined'
    );
}

/** Write plain text only after an explicit user action. */
export async function copyText(text: string): Promise<void> {
    if (!text) throw new Error('No text to copy');
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clipboard?.writeText) throw new Error('Text clipboard is not available');
    try { await clipboard.writeText(text); }
    catch { throw new Error('Text clipboard access was denied'); }
}
function validatePaths(paths: string[]): void {
    if (!paths.length)
        throw new Error('No local files to copy');
    if (paths.length > 100)
        throw new Error('Select at most 100 files');
    if (paths.some(p => !p || [...p].some(char => char.codePointAt(0)! <= 31)))
        throw new Error('Invalid file path');
}

/** Encode a local path as the native file-list URI format understood by Electron. */
export function fileUri(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const rooted = /^[A-Za-z]:\//.test(normalized) ? `/${normalized}` : normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `file://${encodeURI(rooted).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}
export async function copyFiles(paths: string[]): Promise<void> {
    const bridge = browserFileClipboardBridge();
    if (bridge) { await bridge(paths, []); return; }
    validatePaths(paths);
    const nativeClipboard = electronFileClipboard();
    if (nativeClipboard) {
        try {
            const uris = paths.map(fileUri).join('\r\n');
            await nativeClipboard.clipboard.write([new nativeClipboard.ClipboardItem({ 'text/uri-list': uris })]);
            return;
        } catch {
            throw new Error('Native file clipboard access was denied');
        }
    }
    if (!fileClipboardPlatform()) throw new Error('File clipboard requires a current Obsidian desktop version');
    try {
        const uris = paths.map(fileUri).join('\r\n');
        const item = new ClipboardItem({ 'text/uri-list': new Blob([uris], { type: 'text/uri-list' }) });
        await navigator.clipboard.write([item]);
    } catch {
        throw new Error('File clipboard access was denied');
    }
}

/** Text records become short-lived OS files for a direct file-list paste. */
export async function copyFilesWithText(paths: string[], texts: ClipboardTextFile[]): Promise<void> {
    const bridge = browserFileClipboardBridge();
    if (bridge) {
        if (!paths.length && !texts.length) throw new Error('No local files to copy');
        await bridge(paths, texts);
        return;
    }
    if (!texts.length) return copyFiles(paths);
    // Keep the generated files available after the click, matching Desktop's
    // `sourcebook-clipboard/packs` contract for a later paste into an agent.
    const directory = join(tmpdir(), 'sourcebook-clipboard', 'packs');
    mkdirSync(directory, { recursive: true });
    const generated = texts.map((file, index) => {
        const name = [...file.name].map(char => char.codePointAt(0)! <= 31 || '\\/:*?"<>|'.includes(char) ? '-' : char).join('').replace(/^\.+$/, 'text') || `text-${index + 1}.txt`;
        const target = join(directory, name.endsWith('.txt') ? name : `${name}.txt`);
        writeFileSync(target, file.text, 'utf8');
        return target;
    });
    await copyFiles([...paths, ...generated]);
}
