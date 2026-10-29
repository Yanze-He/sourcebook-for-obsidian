import { App, Modal, FuzzySuggestModal, TFile, Notice, setIcon } from 'obsidian';
import { Book, message } from './core';
export type Language = 'zh' | 'en';
export const label = (lang: Language, zh: string, en: string): string => lang === 'zh' ? zh : en;
export function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
    return parent.createEl(tag, { text, cls });
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

/** Select another Book using the same simple Book list as the workspace header,
 * then choose whether the current membership should be copied or moved. */
export class BookTransferModal extends Modal {
    private targetId = '';
    private busy = false;
    constructor(
        app: App,
        private language: Language,
        private books: Book[],
        private itemCount: number,
        private submit: (target: Book, mode: 'copy' | 'move') => Promise<void>
    ) { super(app); }

    onOpen(): void {
        this.modalEl?.classList.add('sb-modal-shell');
        this.contentEl.classList.add('sb-modal', 'sb-transfer-modal');
        this.renderContents();
    }

    private renderContents(): void {
        this.contentEl.replaceChildren();
        const header = el(this.contentEl, 'header', '', 'sb-modal-head');
        el(header, 'h2', label(this.language, '移动到其他 Book', 'Move to another Book'));
        const body = el(this.contentEl, 'div', '', 'sb-modal-body');
        el(body, 'p', label(this.language, `已选 ${this.itemCount} 项素材。选择目标 Book 后，可决定复制或移动。`, `${this.itemCount} selected ${this.itemCount === 1 ? 'material' : 'materials'}. Choose a destination Book, then copy or move.`));
        if (!this.books.length) {
            el(body, 'p', label(this.language, '还没有其他可用的 Book。请先在顶部创建一个 Book。', 'There are no other available Books yet. Create one from the header first.'), 'sb-transfer-empty');
        } else {
            const list = el(body, 'div', '', 'sb-transfer-book-list');
            for (const book of this.books) {
                const selected = this.targetId === book.id;
                const button = el(list, 'button', '', `sb-transfer-book${selected ? ' is-selected' : ''}`);
                button.type = 'button';
                button.disabled = this.busy;
                button.setAttribute('aria-pressed', String(selected));
                const title = el(button, 'span', book.title);
                title.classList.add('sb-transfer-book-title');
                if (selected) {
                    const mark = el(button, 'span', '', 'sb-transfer-book-check');
                    setIcon(mark, 'check');
                }
                button.addEventListener('click', () => { this.targetId = book.id; this.renderContents(); });
            }
        }
        const footer = el(this.contentEl, 'footer', '', 'sb-modal-footer');
        const cancel = el(footer, 'button', label(this.language, '取消', 'Cancel'));
        cancel.type = 'button';
        cancel.disabled = this.busy;
        cancel.addEventListener('click', () => this.close());
        const target = this.books.find(book => book.id === this.targetId);
        const copy = el(footer, 'button', label(this.language, `复制 ${this.itemCount} 项`, `Copy ${this.itemCount} ${this.itemCount === 1 ? 'item' : 'items'}`));
        copy.type = 'button';
        copy.disabled = this.busy || !target;
        copy.addEventListener('click', () => { void this.run('copy'); });
        const move = el(footer, 'button', label(this.language, `移动 ${this.itemCount} 项`, `Move ${this.itemCount} ${this.itemCount === 1 ? 'item' : 'items'}`), 'mod-cta');
        move.type = 'button';
        move.disabled = this.busy || !target;
        move.addEventListener('click', () => { void this.run('move'); });
    }

    private async run(mode: 'copy' | 'move'): Promise<void> {
        const target = this.books.find(book => book.id === this.targetId);
        if (!target || this.busy) return;
        this.busy = true;
        this.renderContents();
        try {
            await this.submit(target, mode);
            this.close();
        } catch (error) {
            this.busy = false;
            this.renderContents();
            new Notice(message(error));
        }
    }

    onClose(): void { this.contentEl.replaceChildren(); }
}

export type PasteImportItem = {
    id: string;
    title: string;
    detail: string;
    kind: 'file' | 'link' | 'text' | 'unsupported';
    modality: 'file' | 'image' | 'video' | 'audio' | 'link' | 'text';
    status: 'pending' | 'importing' | 'imported' | 'unsupported' | 'failed';
    reason?: string;
    file?: File;
    value?: string;
};

/**
 * A deliberate review step for Cmd/Ctrl+V.  Clipboard data is never saved
 * until the person confirms this modal.
 */
export class PasteImportModal extends Modal {
    private busy = false;
    constructor(
        app: App,
        private language: Language,
        private items: PasteImportItem[],
        private hiddenCount: number,
        private bookName: string,
        private submit: (items: PasteImportItem[], update: (id: string, change: Partial<PasteImportItem>) => void) => Promise<void>
    ) { super(app); }
    onOpen(): void {
        this.modalEl?.classList.add('sb-modal-shell');
        this.contentEl.classList.add('sb-modal', 'sb-paste-modal');
        this.renderContents(true);
    }
    private renderContents(focusConfirm = false): void {
        this.contentEl.replaceChildren();
        const header = el(this.contentEl, 'header', '', 'sb-modal-head');
        el(header, 'h2', label(this.language, '粘贴到 Book', 'Paste to Book'));
        el(header, 'small', this.bookName, 'sb-paste-book-name');
        const body = el(this.contentEl, 'div', '', 'sb-modal-body');
        const heading = el(body, 'div', '', 'sb-paste-import-heading');
        el(heading, 'strong', label(this.language, '本次内容', 'Pasted content'));
        el(heading, 'span', String(this.items.length + this.hiddenCount));
        const list = el(body, 'ul', '', 'sb-paste-import-list');
        for (const item of this.items) {
            const row = el(list, 'li', '', `is-${item.modality} is-${item.status}`);
            const kind = el(row, 'span', '', 'sb-paste-import-kind');
            setIcon(kind, item.modality === 'image' ? 'image' : item.modality === 'video' ? 'video' : item.modality === 'audio' ? 'music-2' : item.modality === 'link' ? 'link' : item.modality === 'text' ? 'align-left' : 'file-text');
            const content = el(row, 'span', '', 'sb-paste-import-content');
            el(content, 'strong', item.title);
            el(content, 'small', item.status === 'imported' ? label(this.language, '已添加', 'Added') : item.status === 'importing' ? label(this.language, '正在添加…', 'Adding…') : item.reason || item.detail);
            if (item.status !== 'pending') {
                const state = el(row, 'span', '', 'sb-paste-import-status');
                setIcon(state, item.status === 'importing' ? 'loader-circle' : item.status === 'imported' ? 'circle-check' : 'circle-x');
            }
        }
        if (this.hiddenCount) el(body, 'p', label(this.language, `还有 ${this.hiddenCount} 项未显示：单次最多添加 20 项。`, `${this.hiddenCount} more item${this.hiddenCount === 1 ? ' is' : 's are'} not shown. Paste up to 20 items at a time.`), 'sb-paste-import-limit');
        const footer = el(this.contentEl, 'footer', '', 'sb-modal-footer');
        const cancel = action(footer, label(this.language, '取消', 'Cancel'), async () => { this.close(); });
        cancel.disabled = this.busy;
        const pending = this.items.filter(item => item.status === 'pending').length;
        const confirm = action(footer, this.busy ? label(this.language, '正在添加…', 'Adding…') : pending ? label(this.language, `添加 ${pending} 项`, `Add ${pending} item${pending === 1 ? '' : 's'}`) : label(this.language, '无可添加项', 'Nothing to add'), async () => { await this.importPending(); }, 'mod-cta');
        confirm.disabled = this.busy || !pending;
        if (focusConfirm && pending) confirm.focus();
    }
    private async importPending(): Promise<void> {
        if (this.busy || !this.items.some(item => item.status === 'pending')) return;
        this.busy = true;
        this.renderContents();
        try {
            await this.submit(this.items, (id, change) => {
                this.items = this.items.map(item => item.id === id ? { ...item, ...change } : item);
                this.renderContents();
            });
        } finally {
            this.busy = false;
            this.renderContents();
        }
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
            const opened = window.open('https://chromewebstore.google.com/detail/sourcebook-picker/pkglhngkfkjblabnhgcioindjgffgfpf?hl=en-US&utm_source=sourcebook_obsidian&utm_medium=in_product&utm_campaign=picker_install&utm_content=pairing_modal', '_blank', 'noopener,noreferrer');
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
        setIcon(refresh, 'refresh-cw');
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
