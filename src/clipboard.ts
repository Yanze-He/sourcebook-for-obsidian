/** Native file-list clipboard, opt-in only. No shell interpolation of file paths. */
import { execFile } from 'node:child_process';
export interface ClipboardTextFile { name: string; text: string; }
type BrowserFileClipboardBridge = (paths: string[], texts: ClipboardTextFile[]) => Promise<void> | void;
type ElectronClipboard = { writeText(text: string): void; };

/** The browser harness has a virtual Vault, so it supplies a test-only file clipboard bridge. */
function browserFileClipboardBridge(): BrowserFileClipboardBridge | undefined {
    const candidate = (globalThis as typeof globalThis & { __sourcebookCopyFiles?: unknown }).__sourcebookCopyFiles;
    return typeof candidate === 'function' ? candidate as BrowserFileClipboardBridge : undefined;
}

export function fileClipboardPlatform(): boolean {
    return Boolean(browserFileClipboardBridge()) || (typeof process !== 'undefined' && ['darwin', 'win32'].includes(process.platform));
}

/** Obsidian runs in Electron, whose clipboard is more reliable than the Web API. */
function electronClipboard(): ElectronClipboard | undefined {
    try {
        if (typeof require !== 'function') return undefined;
        const candidate = (require('electron') as { clipboard?: unknown }).clipboard;
        return candidate && typeof (candidate as ElectronClipboard).writeText === 'function'
            ? candidate as ElectronClipboard
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Write plain text with an Obsidian-safe fallback for environments where the
 * async Clipboard API is unavailable or denied. The fallback must run while
 * handling the click, so callers should await it directly from the action.
 */
export async function copyText(text: string): Promise<void> {
    if (!text) throw new Error('No text to copy');
    const nativeClipboard = electronClipboard();
    if (nativeClipboard) {
        nativeClipboard.writeText(text);
        return;
    }
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard?.writeText) {
        try {
            await clipboard.writeText(text);
            return;
        } catch {
            // Older Obsidian webviews can reject the async API despite a user click.
        }
    }
    if (typeof document === 'undefined') throw new Error('Text clipboard is not available');
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    Object.assign(textarea.style, { position: 'fixed', opacity: '0', pointerEvents: 'none', inset: '0' });
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand?.('copy') === true;
    textarea.remove();
    if (!copied) throw new Error('Text clipboard access was denied');
}
/** Mirrors Desktop's AppKit path-list pasteboard write exactly. */
export function macClipboardScript(paths: string[]): string {
    return `ObjC.import("AppKit"); const paths = ${JSON.stringify(paths)}; const pasteboard = $.NSPasteboard.generalPasteboard; pasteboard.clearContents; const urls = $.NSMutableArray.array; paths.forEach((path) => urls.addObject($.NSURL.fileURLWithPath($(path)))); if (!pasteboard.writeObjects(urls)) throw new Error("Unable to write files to the clipboard.");`;
}

/** Mirrors Desktop's Windows Forms file-drop-list write exactly. */
export function windowsClipboardScript(paths: string[]): string {
    const parts = paths.map(path => `[void]$files.Add('${path.replace(/'/g, "''")}');`).join(' ');
    return "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Windows.Forms; $files = New-Object System.Collections.Specialized.StringCollection; " + parts + " [System.Windows.Forms.Clipboard]::SetFileDropList($files); if (-not [System.Windows.Forms.Clipboard]::ContainsFileDropList()) { throw 'Unable to write files to the clipboard.' }";
}
export function nativeCommand(platform: string, paths: string[]): {
    exe: string;
    args: string[];
} {
    if (!paths.length)
        throw new Error('No local files to copy');
    if (paths.length > 100)
        throw new Error('Select at most 100 files');
    if (paths.some(p => !p || /[\x00\r\n]/.test(p)))
        throw new Error('Invalid file path');
    if (platform === 'darwin')
        return { exe: '/usr/bin/osascript', args: ['-l', 'JavaScript', '-e', macClipboardScript(paths)] };
    if (platform === 'win32')
        return { exe: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-STA', '-Command', windowsClipboardScript(paths)] };
    throw new Error('Native file clipboard is not supported on this platform. Use exported files instead.');
}
export async function copyFiles(paths: string[]): Promise<void> {
    const bridge = browserFileClipboardBridge();
    if (bridge) { await bridge(paths, []); return; }
    if (!fileClipboardPlatform()) throw new Error('File clipboard requires Obsidian desktop on macOS or Windows');
    const cmd = nativeCommand(process.platform, paths);
    await new Promise<void>((resolve, reject) => {
        const child = execFile(cmd.exe, cmd.args, { timeout: 15000, maxBuffer: 64 * 1024, windowsHide: true }, (error, _out, err) => {
            if (error)
                reject(new Error(`Native clipboard failed: ${String(err || error.message).slice(0, 500)}`));
            else
                resolve();
        });
    });
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
    const fs = require('node:fs') as typeof import('node:fs');
    const os = require('node:os') as typeof import('node:os');
    const path = require('node:path') as typeof import('node:path');
    // Keep the generated files available after the click, matching Desktop's
    // `sourcebook-clipboard/packs` contract for a later paste into an agent.
    const directory = path.join(os.tmpdir(), 'sourcebook-clipboard', 'packs');
    fs.mkdirSync(directory, { recursive: true });
    const generated = texts.map((file, index) => {
        const name = file.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/^\.+$/, 'text') || `text-${index + 1}.txt`;
        const target = path.join(directory, name.endsWith('.txt') ? name : `${name}.txt`);
        fs.writeFileSync(target, file.text, 'utf8');
        return target;
    });
    await copyFiles([...paths, ...generated]);
}
