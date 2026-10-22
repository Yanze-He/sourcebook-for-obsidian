/** Native file-list clipboard, opt-in only. No shell interpolation of file paths. */
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export interface ClipboardTextFile { name: string; text: string; }
type BrowserFileClipboardBridge = (paths: string[], texts: ClipboardTextFile[]) => Promise<void> | void;

/** The browser harness has a virtual Vault, so it supplies a test-only file clipboard bridge. */
function browserFileClipboardBridge(): BrowserFileClipboardBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    const candidate = (window as Window & { __sourcebookCopyFiles?: unknown }).__sourcebookCopyFiles;
    return typeof candidate === 'function' ? candidate as BrowserFileClipboardBridge : undefined;
}

export function fileClipboardPlatform(): boolean {
    return Boolean(browserFileClipboardBridge()) || (typeof process !== 'undefined' && ['darwin', 'win32'].includes(process.platform));
}

/** Write plain text only after an explicit user action. */
export async function copyText(text: string): Promise<void> {
    if (!text) throw new Error('No text to copy');
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clipboard?.writeText) throw new Error('Text clipboard is not available');
    try { await clipboard.writeText(text); }
    catch { throw new Error('Text clipboard access was denied'); }
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
    if (paths.some(p => !p || [...p].some(char => char.codePointAt(0)! <= 31)))
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
