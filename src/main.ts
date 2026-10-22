import { Plugin, PluginSettingTab, Setting, App, Notice, TAbstractFile } from 'obsidian';
import { SourcebookStore } from './store';
import { ObsidianVaultIO } from './host';
import { SourcebookView, VIEW_TYPE } from './view';
import { Language } from './ui';
import { PickerReceiver } from './picker-receiver';

interface Settings {
    language: Language;
    bookId: string;
    favoriteEntries: string[];
    pickerToken?: string;
    /** Long-lived secret shown in the Sourcebook UI and remembered by Picker. */
    pickerPairingCode?: string;
}

export default class SourcebookPlugin extends Plugin {
    settings: Settings = { language: 'en', bookId: '', favoriteEntries: [] };
    store!: SourcebookStore;
    io!: ObsidianVaultIO;
    private listeners = new Set<() => void>();
    private timer: number | undefined;
    private pickerReceiver!: PickerReceiver;

    async onload(): Promise<void> {
        const data: unknown = await this.loadData();
        const saved = data && typeof data === 'object' ? data as Partial<Settings> : {};
        this.settings = {
            language: saved.language === 'zh' || saved.language === 'en' ? saved.language : navigator.language.startsWith('zh') ? 'zh' : 'en',
            bookId: typeof saved.bookId === 'string' ? saved.bookId : '',
            favoriteEntries: Array.isArray(saved.favoriteEntries) ? saved.favoriteEntries.filter((value): value is string => typeof value === 'string') : [],
            pickerToken: typeof saved.pickerToken === 'string' ? saved.pickerToken : undefined,
            pickerPairingCode: typeof saved.pickerPairingCode === 'string' ? saved.pickerPairingCode : undefined
        };
        this.io = new ObsidianVaultIO(this.app);
        this.store = new SourcebookStore(this.io);
        this.pickerReceiver = new PickerReceiver(this);
        void this.pickerReceiver.start().catch(error => new Notice(`Picker receiver unavailable: ${String(error)}`));
        this.registerView(VIEW_TYPE, leaf => new SourcebookView(leaf, this));
        this.addRibbonIcon('book-heart', 'Sourcebook', () => { void this.openView(); });
        this.addCommand({ id: 'open', name: 'Open materials workspace', callback: () => { void this.openView(); } });
        this.addSettingTab(new SourcebookSettings(this.app, this));

        const changed = () => {
            if (!this.listeners.size) return;
            if (this.timer) window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                this.timer = undefined;
                this.listeners.forEach(listener => listener());
            }, 400);
        };
        this.registerEvent(this.app.vault.on('create', changed));
        this.registerEvent(this.app.vault.on('modify', changed));
        this.registerEvent(this.app.vault.on('delete', changed));
        this.registerEvent(this.app.vault.on('rename', (...args: unknown[]) => {
            const file = args[0] as TAbstractFile;
            const oldPath = typeof args[1] === 'string' ? args[1] : '';
            if (!file || !oldPath) { changed(); return; }
            void this.store.handleRename(oldPath, file.path).catch(error => new Notice(String(error))).finally(changed);
        }));
        this.register(() => {
            if (this.timer) window.clearTimeout(this.timer);
            this.listeners.clear();
        });
    }

    async saveSettings(): Promise<void> { await this.saveData(this.settings); }
    subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    refresh(): void { this.listeners.forEach(listener => listener()); }
    async getPickerPairingCode(): Promise<string> { return this.pickerReceiver.ensurePairingCode(); }
    async refreshPickerPairingCode(): Promise<string> { const code = await this.pickerReceiver.rotatePairingCode(); this.refresh(); return code; }
    async revokePickerConnection(): Promise<void> { await this.pickerReceiver.revoke(); this.refresh(); }

    async openView(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
        const leaf = existing || this.app.workspace.getLeaf('tab');
        if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
        await this.app.workspace.revealLeaf(leaf);
        // Picker can call this while another view owns focus. Revealing alone is
        // not enough in every Obsidian layout, so explicitly foreground the leaf.
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
        // The receiver is only available while Obsidian is already running.
        // Explicitly focus the renderer as well so Picker's “Open Sourcebook”
        // action brings the active Obsidian window forward where supported.
        window.focus();
    }

    onunload(): void {
        this.pickerReceiver?.stop();
        if (this.timer) window.clearTimeout(this.timer);
        this.listeners.clear();
    }
}

class SourcebookSettings extends PluginSettingTab {
    constructor(app: App, private plugin: SourcebookPlugin) { super(app, plugin); }
    display(): void {
        this.containerEl.replaceChildren();
        new Setting(this.containerEl).setName('Language / 语言').addDropdown(dropdown => dropdown.addOption('zh', '中文').addOption('en', 'English').setValue(this.plugin.settings.language).onChange(async (value: string) => {
            this.plugin.settings.language = value === 'zh' ? 'zh' : 'en';
            await this.plugin.saveSettings();
            this.plugin.refresh();
        }));
        new Setting(this.containerEl).setName('Storage / 存储').setDesc('Schema v2 stores Book membership and notes in Book Markdown. Existing Vault files are referenced directly. Send to AI copies the selected original files to the clipboard when supported. v1 test data is not migrated.');
        new Setting(this.containerEl).setName('Open workspace / 打开工作台').addButton(button => button.setButtonText('Sourcebook').onClick(() => { void this.plugin.openView().catch(error => new Notice(String(error))); }));
    }
}
