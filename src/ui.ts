import { App, Modal, FuzzySuggestModal, TFile, Notice } from 'obsidian';
import { message } from './core';
export type Language = 'zh' | 'en';
export const label = (lang: Language, zh: string, en: string): string => lang === 'zh' ? zh : en;
export function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
    const node = parent.ownerDocument.createElement(tag);
    if (text)
        node.textContent = text;
    if (cls)
        node.className = cls;
    parent.append(node);
    return node;
}
export function action(parent: HTMLElement, text: string, fn: () => void | Promise<void>, cls = ''): HTMLButtonElement {
    const b = el(parent, 'button', text, cls);
    b.type = 'button';
    b.addEventListener('click', () => {
        b.disabled = true;
        Promise.resolve().then(fn).catch(e => new Notice(message(e))).finally(() => { b.disabled = false; });
    });
    return b;
}
export class FormModal extends Modal {
    constructor(app: App, private title: string, private fields: {
        key: string;
        label: string;
        value?: string;
        multiline?: boolean;
        placeholder?: string;
        required?: boolean;
        maxLength?: number;
    }[], private submitLabel: string, private submit: (values: Record<string, string>) => Promise<void>) { super(app); }
    onOpen(): void {
        // Obsidian provides the outer `.modal`; style it as the one modal surface
        // instead of leaving the native shell around a second bordered card.
        this.modalEl?.classList.add('sb-modal-shell');
        this.contentEl.classList.add('sb-modal', 'sb-form-modal');
        const header = el(this.contentEl, 'header', '', 'sb-modal-head');
        el(header, 'h2', this.title);
        const body = el(this.contentEl, 'div', '', 'sb-modal-body');
        const values: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};
        for (const f of this.fields) {
            const l = el(body, 'label', '', 'sb-field');
            el(l, 'span', f.label);
            const input = f.multiline ? el(l, 'textarea') : el(l, 'input');
            input.value = f.value || '';
            input.placeholder = f.placeholder || '';
            input.required = Boolean(f.required);
            if (f.maxLength) input.maxLength = f.maxLength;
            values[f.key] = input;
        }
        const error = el(body, 'p', '', 'sb-error');
        error.setAttribute('role', 'alert');
        const footer = el(this.contentEl, 'footer', '', 'sb-modal-footer');
        const requiredEmpty = () => this.fields.some(field => field.required && !values[field.key]?.value.trim());
        const submitButton = el(footer, 'button', this.submitLabel, 'mod-cta');
        submitButton.type = 'button';
        const updateSubmitState = () => { submitButton.disabled = requiredEmpty(); };
        for (const input of Object.values(values)) input.addEventListener('input', updateSubmitState);
        submitButton.addEventListener('click', () => {
            if (requiredEmpty()) {
                error.textContent = 'Please complete the required field.';
                updateSubmitState();
                return;
            }
            submitButton.disabled = true;
            error.textContent = '';
            Promise.resolve(this.submit(Object.fromEntries(Object.entries(values).map(([key, input]) => [key, input.value]))))
                .then(() => this.close())
                .catch(e => { error.textContent = message(e); })
                .finally(updateSubmitState);
        });
        updateSubmitState();
        Object.values(values)[0]?.focus();
    }
    onClose(): void { this.contentEl.replaceChildren(); }
}
export class FilePicker extends FuzzySuggestModal<TFile> {
    constructor(app: App, private predicate: (f: TFile) => boolean, private choose: (f: TFile) => Promise<void>) { super(app); }
    getItems(): TFile[] { return this.app.vault.getFiles().filter(this.predicate); }
    getItemText(file: TFile): string { return file.path; }
    onChooseItem(file: TFile): void { void this.choose(file).catch(e => new Notice(message(e))); }
}
export class ConfirmModal extends Modal {
    constructor(app: App, private title: string, private detail: string, private confirmLabel: string, private confirm: () => Promise<void>, private alternate?: { label: string; confirm: () => Promise<void>; danger?: boolean }) { super(app); }
    onOpen(): void {
        this.modalEl?.classList.add('sb-modal-shell');
        this.contentEl.classList.add('sb-modal', 'sb-confirm-modal');
        const header = el(this.contentEl, 'header', '', 'sb-modal-head');
        el(header, 'h2', this.title);
        const body = el(this.contentEl, 'div', '', 'sb-modal-body');
        el(body, 'p', this.detail);
        const footer = el(this.contentEl, 'footer', '', 'sb-modal-footer');
        action(footer, this.confirmLabel, async () => { await this.confirm(); this.close(); }, this.alternate ? '' : 'mod-warning sb-delete-action');
        if (this.alternate) action(footer, this.alternate.label, async () => { await this.alternate?.confirm(); this.close(); }, this.alternate.danger ? 'mod-warning sb-delete-action' : '');
    }
    onClose(): void { this.contentEl.replaceChildren(); }
}

export class PickerPairingModal extends Modal {
    private statusTimer?: number;
    constructor(app: App, private code: string, private connected: boolean, private refreshCode: () => Promise<string>, private disconnect: () => Promise<void>, private isConnected: () => boolean | Promise<boolean>, private language: Language) { super(app); }
    onOpen(): void {
        this.modalEl?.classList.add('sb-modal-shell');
        this.contentEl.classList.add('sb-modal', 'sb-confirm-modal');
        const header = el(this.contentEl, 'header', '', 'sb-modal-head');
        el(header, 'h2', label(this.language, '连接 Picker', 'Connect Picker'));
        const connectionBadge = el(header, 'span', this.connected ? label(this.language, '已连接', 'Connected') : label(this.language, '未连接', 'Not connected'), `sb-pairing-connection-status${this.connected ? ' is-connected' : ''}`);
        const body = el(this.contentEl, 'div', '', 'sb-modal-body');
        el(body, 'p', label(this.language, '在 Picker 弹窗中选择 Obsidian，然后输入这组配对码。该配对码会保留，直到你刷新或断开连接。', 'In the Picker popup, choose Obsidian and enter this pairing code. It remains valid until you refresh it or disconnect.'));
        const codeRow = el(body, 'div', '', 'sb-pairing-code-row');
        const codeField = el(codeRow, 'div', '', 'sb-pairing-code-field');
        const input = el(codeField, 'input', '', 'sb-pairing-code');
        input.value = this.code;
        input.readOnly = true;
        const status = el(body, 'p', '', 'sb-pairing-status');
        const footer = el(this.contentEl, 'footer', '', 'sb-modal-footer sb-pairing-footer');
        action(footer, label(this.language, '下载 Picker', 'Download Picker'), async () => {
            const opened = window.open('https://chromewebstore.google.com/detail/picker-for-agent/pkglhngkfkjblabnhgcioindjgffgfpf?hl=en-US&utm_source=ext_sidebar', '_blank', 'noopener,noreferrer');
            if (!opened) throw new Error(label(this.language, '无法打开 Chrome Web Store。', 'Could not open the Chrome Web Store.'));
        }, 'sb-pairing-download');
        action(footer, label(this.language, '复制配对码', 'Copy code'), async () => { await navigator.clipboard.writeText(this.code); new Notice(label(this.language, '配对码已复制。', 'Pairing code copied.')); }, 'mod-cta');
        const disconnectSlot = el(footer, 'span', '', 'sb-pairing-disconnect-slot');
        const renderConnection = () => {
            connectionBadge.textContent = this.connected ? label(this.language, '已连接', 'Connected') : label(this.language, '未连接', 'Not connected');
            connectionBadge.classList.toggle('is-connected', this.connected);
            status.textContent = this.connected
                ? label(this.language, '当前浏览器已连接。刷新或断开连接会立即撤销它访问此 Vault 的权限。', 'A browser Picker is connected. Refreshing or disconnecting immediately revokes its access to this Vault.')
                : label(this.language, '尚未连接。复制配对码并在 Picker 中连接即可。', 'Not connected yet. Copy this code and connect it in Picker.');
            disconnectSlot.replaceChildren();
            if (this.connected) action(disconnectSlot, label(this.language, '断开连接', 'Disconnect'), async () => { await this.disconnect(); new Notice(label(this.language, 'Picker 已断开。', 'Picker disconnected.')); this.close(); }, 'mod-warning');
        };
        const refresh = action(codeField, '', async () => {
            this.code = await this.refreshCode();
            this.connected = false;
            input.value = this.code;
            renderConnection();
            status.textContent = label(this.language, '配对码已刷新；已连接的 Picker 需要重新连接。', 'Pairing code refreshed. Connected Pickers must pair again.');
        }, 'sb-pairing-refresh');
        refresh.setAttribute('aria-label', label(this.language, '刷新配对码', 'Refresh pairing code'));
        refresh.title = label(this.language, '刷新配对码', 'Refresh pairing code');
        const refreshIcon = refresh.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
        refreshIcon.setAttribute('aria-hidden', 'true'); refreshIcon.setAttribute('viewBox', '0 0 24 24');
        const refreshPath = refresh.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
        refreshPath.setAttribute('d', 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5');
        refreshIcon.append(refreshPath); refresh.append(refreshIcon);
        renderConnection();
        const syncConnection = async () => {
            const next = await this.isConnected();
            if (next === this.connected) return;
            this.connected = next;
            renderConnection();
        };
        this.statusTimer = window.setInterval(() => { void syncConnection(); }, 900);
        void syncConnection();
        input.select();
    }
    onClose(): void { if (this.statusTimer) window.clearInterval(this.statusTimer); this.statusTimer = undefined; this.contentEl.replaceChildren(); }
}
