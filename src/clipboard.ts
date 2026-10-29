/** Native file-list clipboard, opt-in only. */
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export interface ClipboardTextFile { name: string; text: string; }
type BrowserFileClipboardBridge = (paths: string[], texts: ClipboardTextFile[]) => Promise<void> | void;
type ElectronFileClipboard = {
    clipboard: { write(items: unknown[]): Promise<void> | void };
    ClipboardItem: new (items: Record<'text/uri-list', string>) => unknown;
};

const MACOS_COPY_FILES_SCRIPT = `use framework "Foundation"
use framework "AppKit"
use scripting additions

on run argv
    set sourcebookFiles to current application's NSMutableArray's array()
    repeat with sourcebookPath in argv
        set sourcebookURL to current application's |NSURL|'s fileURLWithPath:(contents of sourcebookPath)
        (sourcebookFiles's addObject:sourcebookURL)
    end repeat
    set sourcebookPasteboard to current application's NSPasteboard's generalPasteboard()
    sourcebookPasteboard's clearContents()
    sourcebookPasteboard's writeObjects:sourcebookFiles
end run`;

const WINDOWS_FILE_PATHS_ENV_KEY = 'SOURCEBOOK_FILE_PATHS_B64';
const WINDOWS_COPY_FILES_SCRIPT = [
    `$sourcebookJson = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($env:${WINDOWS_FILE_PATHS_ENV_KEY}))`,
    '$sourcebookPaths = @($sourcebookJson | ConvertFrom-Json)',
    'if ($sourcebookPaths.Count -eq 0) { throw "No files were selected" }',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$sourcebookFiles = New-Object System.Collections.Specialized.StringCollection',
    'foreach ($sourcebookPath in $sourcebookPaths) { if (-not (Test-Path -LiteralPath $sourcebookPath -PathType Leaf)) { throw "File is no longer available" }; [void]$sourcebookFiles.Add([string]$sourcebookPath) }',
    '[System.Windows.Forms.Clipboard]::SetFileDropList($sourcebookFiles)',
].join('; ');

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
    try {
        // Obsidian plugins run in Electron's CommonJS plugin context. `require`
        // belongs to that context; it is not exposed as `window.require` in
        // recent macOS builds. Looking on `window` silently selected the web
        // clipboard fallback, which macOS correctly rejects for file payloads.
        // The local bundler forwards non-Sourcebook modules to this native
        // require, so this remains scoped to Electron's own clipboard API.
        const candidate = require('electron') as Partial<ElectronFileClipboard> | undefined;
        return candidate
            && candidate.clipboard
            && typeof candidate.clipboard.write === 'function'
            && typeof candidate.ClipboardItem === 'function'
            ? candidate as ElectronFileClipboard
            : undefined;
    } catch { return undefined; }
}

function macOSFileClipboard(): boolean {
    return typeof process !== 'undefined' && process.platform === 'darwin';
}

function windowsFileClipboard(): boolean {
    return typeof process !== 'undefined' && process.platform === 'win32';
}

/**
 * Electron 43+ limits the privileged file clipboard in plugin renderers.
 * This explicit macOS-only fallback uses AppleScript-ObjC to place NSURL file
 * objects on the general pasteboard—the same representation native upload
 * inputs receive from Finder. The script is fixed; paths are passed only as
 * separate argv values and are never interpolated into executable source.
 */
export function macFileClipboardInvocation(paths: string[]): { command: string; args: string[] } {
    return { command: '/usr/bin/osascript', args: ['-e', MACOS_COPY_FILES_SCRIPT, ...paths] };
}

async function copyFilesOnMac(paths: string[]): Promise<void> {
    const invocation = macFileClipboardInvocation(paths);
    await new Promise<void>((resolve, reject) => {
        execFile(invocation.command, invocation.args, { windowsHide: true, maxBuffer: 1024 * 1024 }, error => error ? reject(error) : resolve());
    });
}

/** Windows needs an STA process to set a native CF_HDROP file list. */
export function windowsFileClipboardInvocation(paths: string[]): { command: string; args: string[]; encodedPaths: string } {
    return {
        command: 'powershell.exe',
        args: ['-NoProfile', '-NonInteractive', '-Sta', '-Command', WINDOWS_COPY_FILES_SCRIPT],
        encodedPaths: Buffer.from(JSON.stringify(paths), 'utf16le').toString('base64')
    };
}

async function copyFilesOnWindows(paths: string[]): Promise<void> {
    const invocation = windowsFileClipboardInvocation(paths);
    await new Promise<void>((resolve, reject) => {
        const child = spawn(invocation.command, invocation.args, {
            env: { ...process.env, [WINDOWS_FILE_PATHS_ENV_KEY]: invocation.encodedPaths },
            windowsHide: true
        });
        let stderr = '';
        child.stderr?.on('data', (chunk: { toString(): string }) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`)));
    });
}

export function fileClipboardPlatform(): boolean {
    return Boolean(browserFileClipboardBridge()) || Boolean(electronFileClipboard()) || macOSFileClipboard() || windowsFileClipboard() || Boolean(
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
    // Electron 43 may resolve renderer clipboard writes without handing a
    // pasteable file payload to another application. macOS therefore always
    // uses Finder's native file-copy path rather than treating that response
    // as success and skipping the reliable system fallback.
    if (macOSFileClipboard()) {
        try { await copyFilesOnMac(paths); return; }
        catch { throw new Error('macOS file clipboard access was denied'); }
    }
    if (windowsFileClipboard()) {
        try { await copyFilesOnWindows(paths); return; }
        catch { throw new Error('Windows file clipboard access was denied'); }
    }
    const nativeClipboard = electronFileClipboard();
    if (nativeClipboard) {
        try {
            const uris = paths.map(fileUri).join('\r\n');
            await nativeClipboard.clipboard.write([new nativeClipboard.ClipboardItem({ 'text/uri-list': uris })]);
            return;
        } catch { /* Use the supported macOS fallback below when needed. */ }
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
