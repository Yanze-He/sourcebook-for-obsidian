import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type SourcebookPlugin from './main';
import {
    Book, Entry, Resolved, Library, BOOKS_DIR, DATA_DIR, SNAPSHOTS_DIR, canPreviewImage, humanSize,
    message, searchText, MAX_IMPORT_BYTES, safeName, Kind
} from './core';
import { planPack, promptFor, attachmentPaths, handoffFileCount, handoffTextFileName, PackPlan, ProjectContext } from './pack';
import { FormModal, FilePicker, ConfirmModal, PickerPairingModal, label } from './ui';
import { copyFiles, copyFilesWithText, copyText, fileClipboardPlatform } from './clipboard';
import { Fragment, h, render } from './jsx';
import { Icon, IconName, SourcebookMark } from './icons';

export const VIEW_TYPE = 'sourcebook-materials';

type Density = 'compact' | 'standard' | 'spacious';
type DateFilter = 'all' | 'today' | 'yesterday' | 'week';
type LocalFilter = 'all' | 'local' | 'none' | 'missing';
type Toast = { text: string; type: 'success' | 'error' };

type DetailRow = { label: string; value: string; reveal?: string };

function domainFor(url: string): string {
    if (!url) return '';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function formatDate(value?: number): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function formatDateTime(value?: number): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDuration(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '';
    const seconds = Math.floor(value);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = seconds % 60;
    return hours ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function kindIcon(kind: Kind): IconName {
    return kind === 'image' ? 'image' : kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : kind === 'conversation' ? 'message' : kind === 'post' || kind === 'note' ? 'file-text' : kind === 'text' ? 'text' : kind === 'link' ? 'link' : 'file';
}

function kindLabel(kind: Kind, lang: 'zh' | 'en'): string {
    const labels: Record<Kind, [string, string]> = {
        image: ['图片', 'Image'], text: ['文字', 'Text'], note: ['笔记', 'Note'], link: ['链接', 'Link'], file: ['文件', 'File'], audio: ['音频', 'Audio'], video: ['视频', 'Video'], post: ['帖子', 'Post'], conversation: ['对话', 'Conversation']
    };
    return lang === 'zh' ? labels[kind][0] : labels[kind][1];
}

/** Known conversation providers are deliberately local marks, never fetched favicons. */
function aiProviderBadge(url: string): string {
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (host.includes('chatgpt') || host.includes('openai')) return 'GPT';
        if (host.includes('claude')) return 'C';
        if (host.includes('gemini')) return 'G';
        if (host.includes('grok') || host.includes('x.ai')) return 'x';
        if (host.includes('perplexity')) return 'P';
        if (host.includes('copilot')) return 'Co';
    } catch { /* An ordinary non-URL source retains its regular link mark. */ }
    return '';
}

function SourcebookLockup(): JSX.Element {
    return <div className="sourcebook-lockup"><SourcebookMark size={26}/><div className="sourcebook-wordmark">sourcebook<span>for agents</span></div></div>;
}

function ToolButton(props: { icon: IconName; text?: string; title: string; primary?: boolean; active?: boolean; disabled?: boolean; onClick: () => void }): JSX.Element {
    const cls = ['desktop-button', props.text ? '' : 'icon-only', props.primary ? 'is-primary' : '', props.active ? 'is-active' : ''].filter(Boolean).join(' ');
    return <button aria-label={props.title} className={cls} data-tooltip={props.title} disabled={props.disabled} onClick={props.onClick} type="button"><Icon name={props.icon} size={17}/>{props.text ? <span>{props.text}</span> : null}</button>;
}

type EmptyStateAction = { icon: IconName; label: string; tone?: 'picker' | 'primary'; onAction: () => void };

function EmptyState(props: { title: string; description: string; actions: EmptyStateAction[] }): JSX.Element {
    return <div className="sourcebook-empty"><div className="sourcebook-empty-icon"><SourcebookMark size={44}/></div><h2>{props.title}</h2><p>{props.description}</p>{props.actions.length ? <div className="sourcebook-empty-actions">{props.actions.map(action => <button className={`desktop-button${action.tone === 'picker' ? ' sourcebook-empty-picker' : action.tone === 'primary' ? ' is-primary' : ''}`} onClick={action.onAction} type="button"><Icon name={action.icon} size={17}/>{action.label}</button>)}</div> : null}</div>;
}

export class SourcebookView extends ItemView {
    private library: Library = { books: [], warnings: [], legacyDetected: false };
    private book?: Book;
    private items: Resolved[] = [];
    private selected = new Set<string>();
    private query = '';
    private density: Density = 'standard';
    private kindFilters = new Set<Kind>();
    private sourceFilters = new Set<string>();
    private dateFilter: DateFilter = 'all';
    private localFilter: LocalFilter = 'all';
    private onlyFavorites = false;
    private selectionMode = false;
    private selectionIntent: 'batch' | 'handoff' = 'batch';
    private refreshId = 0;
    private unsubscribe?: () => void;
    private warnings: string[] = [];
    private bookMenuOpen = false;
    private addMenuOpen = false;
    private settingsMenuOpen = false;
    private filterOpen = false;
    private detailId = '';
    private batchMoreOpen = false;
    private bookOptionsId = '';
    private bookSettingsOpen = false;
    private handoffOpen = false;
    private handoffChoiceOpen = false;
    private handoffScopeExpanded = false;
    private handoffSource: 'sources' | 'project' = 'sources';
    private handoffPrompt = '';
    private handoffProject?: ProjectContext;
    private handoffProjectItems: Resolved[] = [];
    private handoffBusy = false;
    private handoffStatus = '';
    private handoffError = '';
    private toast?: Toast;
    private toastTimer?: ReturnType<typeof setTimeout>;
    private focusDetailNote = false;
    private masonryColumns = 1;
    private resizeObserver?: ResizeObserver;

    constructor(leaf: WorkspaceLeaf, readonly plugin: SourcebookPlugin) { super(leaf); }
    getViewType(): string { return VIEW_TYPE; }
    getDisplayText(): string { return 'Sourcebook'; }
    getIcon(): string { return 'library'; }
    t(zh: string, en: string): string { return label(this.plugin.settings.language, zh, en); }

    async onOpen(): Promise<void> {
        this.containerEl.classList.add('sourcebook-view-shell');
        this.contentEl.classList.add('sourcebook-plugin-host');
        this.unsubscribe = this.plugin.subscribe(() => { void this.reload(); });
        this.masonryColumns = this.computeMasonryColumns();
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                const next = this.computeMasonryColumns();
                if (next !== this.masonryColumns) { this.masonryColumns = next; this.renderApp(); }
            });
            this.resizeObserver.observe(this.contentEl);
        }
        await this.reload();
    }

    async onClose(): Promise<void> {
        this.refreshId++;
        this.unsubscribe?.();
        this.resizeObserver?.disconnect();
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.contentEl.replaceChildren();
    }

    private notify(text: string, type: Toast['type'] = 'success'): void {
        this.toast = { text, type };
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.toast = undefined; this.updateToast(); }, 3200);
        this.updateToast();
    }

    async reload(): Promise<boolean> {
        const token = ++this.refreshId;
        try {
            const library = await this.plugin.store.load();
            if (token !== this.refreshId) return false;
            this.library = library;
            const oldId = this.book?.id;
            this.book = library.books.find(book => book.id === this.plugin.settings.bookId && !book.archived) || library.books.find(book => !book.archived);
            if (oldId !== this.book?.id) { this.selected.clear(); this.bookOptionsId = ''; }
            const result = this.book ? await this.plugin.store.resolve(this.book, true) : { items: [], warnings: [] };
            this.items = result.items.filter(item => !item.entry.removed);
            this.warnings = [...library.warnings, ...result.warnings];
            for (const id of this.selected) if (!this.items.some(item => item.entry.id === id)) this.selected.delete(id);
            if (this.detailId && !this.items.some(item => item.entry.id === this.detailId)) this.detailId = '';
            this.renderApp();
            return true;
        } catch (error) {
            if (token !== this.refreshId) return false;
            render(<div className="sourcebook-load-error"><p>{message(error)}</p><button className="desktop-button is-primary" onClick={() => void this.reload()} type="button">{this.t('重试', 'Retry')}</button></div>, this.contentEl);
            return false;
        }
    }

    private async refreshFromControl(): Promise<void> {
        const refreshed = await this.reload();
        if (refreshed) this.notify(this.t(`已刷新 ${this.items.length} 个素材`, `Refreshed ${this.items.length} ${this.items.length === 1 ? 'source' : 'sources'}`));
    }

    private favoriteKey(item: Resolved): string { return `${item.bookPath}#${item.entry.id}`; }
    private isFavorite(item: Resolved): boolean { return this.plugin.settings.favoriteEntries.includes(this.favoriteKey(item)); }
    private async toggleFavorite(item: Resolved): Promise<void> {
        const key = this.favoriteKey(item);
        const values = new Set(this.plugin.settings.favoriteEntries);
        if (values.has(key)) values.delete(key); else values.add(key);
        this.plugin.settings.favoriteEntries = [...values];
        await this.plugin.saveSettings();
        this.syncFavoriteCard(item);
    }

    private sourceOptions(): string[] {
        const values = new Set<string>();
        for (const item of this.items) values.add(item.url ? domainFor(item.url) || this.t('网页链接', 'Web link') : this.t('本地文件', 'Local file'));
        return [...values].sort((a, b) => a.localeCompare(b));
    }

    private sourceLabel(item: Resolved): string {
        return item.url ? domainFor(item.url) || this.t('网页链接', 'Web link') : this.t('本地文件', 'Local file');
    }

    private hasActiveFilters(): boolean {
        return Boolean(this.kindFilters.size || this.sourceFilters.size || this.dateFilter !== 'all' || this.localFilter !== 'all');
    }

    private inDate(item: Resolved): boolean {
        if (this.dateFilter === 'all') return true;
        if (!item.modifiedAt) return false;
        const date = new Date(item.modifiedAt), now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (this.dateFilter === 'today') return date.getTime() >= startToday;
        if (this.dateFilter === 'yesterday') return date.getTime() >= startToday - 86400000 && date.getTime() < startToday;
        return date.getTime() >= startToday - 6 * 86400000;
    }

    private visibleItems(): Resolved[] {
        return this.items.filter(item => {
            if (!searchText(item, this.query, '')) return false;
            if (this.kindFilters.size && !this.kindFilters.has(item.kind)) return false;
            if (this.sourceFilters.size && !this.sourceFilters.has(this.sourceLabel(item))) return false;
            if (!this.inDate(item)) return false;
            if (this.localFilter === 'local' && !item.filePath) return false;
            if (this.localFilter === 'none' && item.filePath) return false;
            if (this.localFilter === 'missing' && !item.missing) return false;
            if (this.onlyFavorites && !this.isFavorite(item)) return false;
            return true;
        }).sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
    }

    private chosen(): Resolved[] { return this.items.filter(item => this.selected.has(item.entry.id)); }
    private chosenEntries(): Entry[] { return this.chosen().map(item => item.entry); }
    private detailItem(): Resolved | undefined { return this.items.find(item => item.entry.id === this.detailId); }

    private computeMasonryColumns(): number {
        const width = this.contentEl.clientWidth || this.contentEl.ownerDocument.defaultView?.innerWidth || 1200;
        const minimumWidth = this.density === 'compact' ? 198 : this.density === 'spacious' ? 340 : 258;
        if (width < 500) return 1;
        return Math.max(2, Math.min(8, Math.floor((width + 16) / (minimumWidth + 16))));
    }

    private densityLabel(density: Density): string {
        return density === 'compact'
            ? this.t('小', 'Small')
            : density === 'spacious'
                ? this.t('大', 'Large')
                : this.t('中', 'Medium');
    }

    private cycleDensity(): void {
        const densities: Density[] = ['compact', 'standard', 'spacious'];
        this.density = densities[(densities.indexOf(this.density) + 1) % densities.length] as Density;
        this.masonryColumns = this.computeMasonryColumns();
        this.renderApp();
    }

    private renderMasonry(items: Resolved[]): JSX.Element {
        const count = Math.max(1, this.masonryColumns);
        const columns: Resolved[][] = Array.from({ length: count }, () => []);
        items.forEach((item, index) => columns[index % count]!.push(item));
        return <div className="source-masonry-columns" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>{columns.map(column => <div className="source-masonry-column">{column.map(item => this.renderCard(item))}</div>)}</div>;
    }

    private renderApp(): void {
        const visible = this.visibleItems();
        const detail = this.detailItem();
        const lang = this.plugin.settings.language;
        const rootClass = `sourcebook-plugin-root density-${this.density}${this.selectionMode ? ' is-selection-mode' : ''}`;
        render(
            <div className={rootClass} lang={lang === 'zh' ? 'zh-CN' : 'en'}>
                <header className="panel-head">
                    <div className="header-left"><SourcebookLockup/>{this.book ? this.renderBookSwitcher() : null}</div>
                    <div className="header-actions">
                        {this.book ? this.renderAddActions() : null}
                        {this.renderSettingsMenu()}
                        <ToolButton icon="refresh" title={this.t('刷新', 'Refresh')} onClick={() => void this.refreshFromControl()}/>
                    </div>
                </header>

                {this.book ? <>
                    <section className="sources-search-toolbar">
                        <div className="search-box sources-search"><Icon name="search" size={17}/><input aria-label={this.t('搜索素材', 'Search sources')} placeholder={this.t('搜索素材', 'Search sources')} type="search" value={this.query} onInput={(event: Event) => this.updateSearch(event)}/></div>
                        <div className="filter-control"><button aria-expanded={this.filterOpen} aria-label={this.t('筛选', 'Filter')} aria-pressed={this.hasActiveFilters()} className={`round-tool-button${this.filterOpen || this.hasActiveFilters() ? ' is-active' : ''}`} data-tooltip={this.t('筛选', 'Filter')} onClick={() => { this.filterOpen = !this.filterOpen; this.bookMenuOpen = false; this.addMenuOpen = false; this.settingsMenuOpen = false; this.renderApp(); }} type="button"><Icon name="filter" size={18}/></button>{this.filterOpen ? this.renderFilterPopover() : null}</div>
                        <button aria-label={this.t('仅看收藏', 'Favorites only')} aria-pressed={this.onlyFavorites} className={`round-tool-button${this.onlyFavorites ? ' is-active' : ''}`} data-tooltip={this.t('仅看收藏', 'Favorites only')} onClick={() => { this.onlyFavorites = !this.onlyFavorites; this.renderApp(); }} type="button"><Icon name="star" size={18}/></button>
                        <div className="density-control"><button aria-label={this.t(`切换卡片尺寸：当前${this.densityLabel(this.density)}`, `Change card size: ${this.densityLabel(this.density)}`)} className={`density-cycle-button is-${this.density}`} data-tooltip={this.t(`卡片尺寸：${this.densityLabel(this.density)}；点击切换`, `Card size: ${this.densityLabel(this.density)}; click to switch`)} onClick={() => this.cycleDensity()} type="button"><span/></button></div>
                        <span className="sources-filter-count">{this.t(`显示：${visible.length} / ${this.items.length}`, `Showing: ${visible.length} / ${this.items.length}`)}</span>
                    </section>
                    {this.library.legacyDetected || this.warnings.length ? this.renderWarnings() : null}
                    <main className={`source-masonry${this.selectionMode ? ' is-selecting' : ''}`}>{visible.length ? this.renderMasonry(visible) : <EmptyState title={this.t(this.items.length ? '没有匹配的素材' : '还没有素材', this.items.length ? 'No matching sources' : 'No sources yet')} description={this.items.length ? this.t('请尝试其他搜索词或筛选条件。', 'Try another search or filter.') : this.t('使用 Picker 收集网页素材，或直接导入本地文件。', 'Use Picker to collect web content or import local files.')} actions={this.items.length ? [] : [{ icon: 'plus', label: this.t('添加素材', 'Add sources'), tone: 'primary', onAction: () => this.openAddMenu() }]}/>}</main>
                </> : <EmptyState title={this.t('给你的项目，建一本素材册', 'Start a Book for your next project')} description={this.t('为灵感、参考与随时可供 AI 使用的上下文，建立一册持续生长的素材册。', 'Build a living sourcebook for ideas, references, and AI-ready context.')} actions={[{ icon: 'plus', label: this.t('创建第一个 Book', 'Create your first Book'), tone: 'primary', onAction: () => this.createBook() }]}/>} 

        <div className="batch-actions-slot">{this.book && visible.length ? this.renderBatchActions(visible) : null}</div>
                {detail ? this.renderDetail(detail) : null}
                {this.bookSettingsOpen && this.book ? this.renderBookSettings(this.book) : null}
                {this.handoffOpen && this.book ? this.renderHandoff(this.book) : null}
                <div className="sourcebook-toast-slot">{this.renderToastContent()}</div>
            </div>,
            this.contentEl
        );
        this.focusDetailNote = false;
    }

    private renderToastContent(): JSX.Element | null {
        return this.toast ? <div className={`sources-message ${this.toast.type === 'error' ? 'is-error' : 'is-success'}`} role="status"><Icon name={this.toast.type === 'error' ? 'x' : 'circle-check'} size={16}/><span>{this.toast.text}</span></div> : null;
    }

    private updateToast(): void {
        const slot = this.contentEl.querySelector<HTMLElement>('.sourcebook-toast-slot');
        if (slot) render(this.renderToastContent(), slot);
        else this.renderApp();
    }

    private updateBatchActions(): void {
        const slot = this.contentEl.querySelector<HTMLElement>('.batch-actions-slot');
        if (slot) render(this.book ? this.renderBatchActions(this.visibleItems()) : null, slot);
        else this.renderApp();
    }

    private syncSelectionCards(): void {
        const root = this.contentEl.querySelector<HTMLElement>('.sourcebook-plugin-root');
        const masonry = this.contentEl.querySelector<HTMLElement>('.source-masonry');
        root?.classList.toggle('is-selection-mode', this.selectionMode);
        masonry?.classList.toggle('is-selecting', this.selectionMode);
        const hasSelection = this.selected.size > 0;
        this.contentEl.querySelectorAll<HTMLElement>('.source-masonry-card[data-source-id]').forEach(card => {
            const selected = this.selected.has(card.dataset.sourceId || '');
            card.classList.toggle('selected', selected);
            card.classList.toggle('is-dimmed', this.selectionMode && hasSelection && !selected);
            const select = card.querySelector<HTMLButtonElement>('.source-card-select');
            select?.classList.toggle('is-selected', selected);
            select?.setAttribute('aria-pressed', String(selected));
        });
    }

    private syncFavoriteCard(item: Resolved): void {
        const favorite = this.isFavorite(item);
        this.contentEl.querySelectorAll<HTMLElement>('.source-masonry-card[data-source-id]').forEach(card => {
            if (card.dataset.sourceId !== item.entry.id) return;
            card.classList.toggle('favorited', favorite);
            card.querySelectorAll<HTMLButtonElement>('.source-card-favorite, .source-card-favorite-pinned').forEach(button => {
                button.classList.toggle('active', favorite);
                button.setAttribute('aria-pressed', String(favorite));
                const label = favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite');
                button.setAttribute('aria-label', label);
                button.dataset.tooltip = label;
                button.querySelector('svg')?.setAttribute('fill', favorite ? 'currentColor' : 'none');
            });
            const pinned = card.querySelector<HTMLButtonElement>('.source-card-favorite-pinned');
            if (pinned) pinned.hidden = !favorite;
        });
        this.contentEl.querySelectorAll<HTMLButtonElement>('.detail-footer-favorite').forEach(button => {
            button.classList.toggle('active', favorite);
            button.setAttribute('aria-pressed', String(favorite));
            button.setAttribute('aria-label', favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite'));
            button.querySelector('svg')?.setAttribute('fill', favorite ? 'currentColor' : 'none');
        });
    }

    private renderBookSwitcher(): JSX.Element {
        const book = this.book as Book;
        const activeBooks = this.library.books.filter(item => !item.archived);
        return <div className="book-switcher-wrap">
            <button aria-expanded={this.bookMenuOpen} className="book-switcher" onClick={() => { this.bookMenuOpen = !this.bookMenuOpen; if (!this.bookMenuOpen) this.bookOptionsId = ''; this.filterOpen = false; this.addMenuOpen = false; this.settingsMenuOpen = false; this.renderApp(); }} type="button"><strong>{book.title}</strong><span>{activeBooks.length} {this.t('本', activeBooks.length === 1 ? 'Book' : 'Books')}</span><Icon name="chevron-down" size={16}/></button>
            {this.bookMenuOpen ? <><div aria-hidden="true" className="popover-dismiss-layer" onClick={() => { this.bookMenuOpen = false; this.bookOptionsId = ''; this.renderApp(); }}/><div className="book-picker-popover" role="menu">
                {activeBooks.map(candidate => <div className="book-menu-item"><button aria-expanded={this.bookOptionsId === candidate.id} aria-haspopup="menu" aria-label={this.t(`设置 ${candidate.title}`, `Settings for ${candidate.title}`)} className="book-options-button" onClick={() => { this.bookOptionsId = this.bookOptionsId === candidate.id ? '' : candidate.id; this.renderApp(); }} role="menuitem" type="button"><Icon name="more" size={17}/></button><button className={`book-menu-select${candidate.id === book.id ? ' is-active' : ''}`} onClick={() => void this.switchBook(candidate)} role="menuitem" type="button"><span>{candidate.title}</span>{candidate.id === book.id ? <Icon name="check" size={19}/> : null}</button>{this.bookOptionsId === candidate.id ? <div className="book-options-popover" role="menu"><button onClick={() => void this.openBookSettings(candidate)} role="menuitem" type="button"><Icon name="pencil" size={16}/><span>{this.t('重命名', 'Rename')}</span></button><div className="book-picker-divider"/><button className="is-danger" onClick={() => { this.bookOptionsId = ''; this.bookMenuOpen = false; this.renderApp(); this.deleteBook(candidate); }} role="menuitem" type="button"><Icon name="trash" size={16}/><span>{this.t('删除 Book', 'Delete Book')}</span></button></div> : null}</div>)}
                <div className="book-picker-divider"/>
                <button className="book-picker-new" onClick={() => { this.bookMenuOpen = false; this.renderApp(); this.createBook(); }} role="menuitem" type="button"><Icon name="plus" size={20}/><span>{this.t('新建 Book', 'New Book')}</span></button>
            </div></> : null}
        </div>;
    }

    private renderAddActions(): JSX.Element {
        const actions: Array<{ icon: IconName; label: string; title: string; run: () => void }> = [
            { icon: 'folder-open', label: this.t('导入 Vault 文件', 'Import Vault file'), title: this.t('导入 Vault 文件', 'Import Vault file'), run: () => this.pickVault() },
            { icon: 'upload', label: this.t('导入本地文件', 'Import local files'), title: this.t('导入本地文件', 'Import local files'), run: () => this.importFiles() },
            { icon: 'file-plus', label: this.t('添加文字', 'Add text'), title: this.t('添加文字', 'Add text'), run: () => this.addText() },
            { icon: 'file-text', label: this.t('添加笔记', 'Add Note'), title: this.t('新建并打开 Vault 笔记', 'Create and open a Vault note'), run: () => void this.addVaultNote() }
        ];
        const closeAndRun = (action: () => void) => {
            this.addMenuOpen = false;
            this.renderApp();
            action();
        };
        return <>
            <div className="header-add-actions">{actions.map(action => <ToolButton icon={action.icon} text={action.label} title={action.title} onClick={action.run}/>)}</div>
            <div className="add-actions-menu-wrap">
                <button aria-expanded={this.addMenuOpen} aria-haspopup="menu" aria-label={this.t('添加素材', 'Add materials')} className={`add-actions-trigger${this.addMenuOpen ? ' is-open' : ''}`} onClick={() => { this.addMenuOpen = !this.addMenuOpen; this.bookMenuOpen = false; this.filterOpen = false; this.settingsMenuOpen = false; this.renderApp(); }} type="button"><Icon name="plus" size={16}/><span>{this.t('添加', 'Add')}</span><Icon name="chevron-down" size={15}/></button>
                {this.addMenuOpen ? <><div aria-hidden="true" className="popover-dismiss-layer" onClick={() => { this.addMenuOpen = false; this.renderApp(); }}/><div className="book-picker-popover add-actions-popover" role="menu">
                    {actions.map(action => <button aria-label={action.title} onClick={() => closeAndRun(action.run)} role="menuitem" type="button"><Icon name={action.icon} size={17}/><span>{action.label}</span></button>)}
                    <div className="book-picker-divider add-actions-divider"/>
                    <button className="add-actions-picker-connect" onClick={() => closeAndRun(() => { void this.openPickerConnection(); })} role="menuitem" type="button"><Icon name="puzzle" size={17}/><span>{this.t('连接 Picker', 'Connect Picker')}</span><em className="picker-connection-status">{this.plugin.settings.pickerToken ? this.t('已连接', 'Connected') : this.t('未连接', 'Not connected')}</em></button>
                </div></> : null}
            </div>
        </>;
    }

    private openAddMenu(): void {
        this.addMenuOpen = true;
        this.bookMenuOpen = false;
        this.filterOpen = false;
        this.settingsMenuOpen = false;
        this.renderApp();
    }

    private renderSettingsMenu(): JSX.Element {
        const lang = this.plugin.settings.language;
        const close = () => { this.settingsMenuOpen = false; this.renderApp(); };
        return <div className="settings-menu-wrap">
            <button aria-expanded={this.settingsMenuOpen} aria-haspopup="menu" aria-label={this.t('设置', 'Settings')} className={`desktop-button icon-only${this.settingsMenuOpen ? ' is-active' : ''}`} onClick={() => { this.settingsMenuOpen = !this.settingsMenuOpen; this.bookMenuOpen = false; this.addMenuOpen = false; this.filterOpen = false; this.renderApp(); }} type="button"><Icon name="settings" size={17}/></button>
            {this.settingsMenuOpen ? <><div aria-hidden="true" className="popover-dismiss-layer" onClick={close}/><div className="settings-popover" role="menu">
                <button onClick={() => { close(); window.open('https://sourcebook.online/obsidian-plugin/', '_blank', 'noopener,noreferrer'); }} role="menuitem" type="button"><Icon name="help" size={19}/><span>{this.t('帮助', 'Help')}</span></button>
                <button onClick={() => { close(); window.open('https://sourcebook.online/feedback/', '_blank', 'noopener,noreferrer'); }} role="menuitem" type="button"><Icon name="message" size={19}/><span>{this.t('反馈', 'Feedback')}</span></button>
                <button onClick={() => void this.setLanguage(lang === 'zh' ? 'en' : 'zh')} role="menuitem" type="button"><Icon name="languages" size={19}/><span>{lang === 'zh' ? 'English' : '中文'}</span></button>
            </div></> : null}
        </div>;
    }

    private async openPickerConnection(): Promise<void> {
        this.settingsMenuOpen = false;
        this.renderApp();
        try {
            const code = await this.plugin.getPickerPairingCode();
            new PickerPairingModal(this.app, code, Boolean(this.plugin.settings.pickerToken), async () => {
                return this.plugin.refreshPickerPairingCode();
            }, async () => {
                await this.plugin.revokePickerConnection();
            }, () => Boolean(this.plugin.settings.pickerToken), this.plugin.settings.language).open();
        } catch (error) {
            this.notify(this.t(`无法打开连接窗口：${message(error)}`, `Could not open the connection window: ${message(error)}`), 'error');
        }
    }

    private renderFilterPopover(): JSX.Element {
        const sourceOptions = this.sourceOptions();
        const hasFilters = Boolean(this.kindFilters.size || this.sourceFilters.size || this.dateFilter !== 'all' || this.localFilter !== 'all');
        const chip = (active: boolean, text: string, onClick: () => void) => <button aria-pressed={active ? 'true' : 'false'} className="filter-chip" onClick={onClick} type="button">{text}</button>;
        return <><div aria-hidden="true" className="popover-dismiss-layer" onClick={() => { this.filterOpen = false; this.renderApp(); }}/><div className="source-item-filter-popover">
            <div className="filter-popover-head"><strong>{this.t('筛选', 'Filter')}</strong><button disabled={!hasFilters} onClick={() => { this.kindFilters.clear(); this.sourceFilters.clear(); this.dateFilter = 'all'; this.localFilter = 'all'; this.renderApp(); }} type="button">{this.t('重置', 'Reset')}</button></div>
            <section className="filter-section"><h2>{this.t('时间', 'Time')}</h2><div className="filter-row">{chip(this.dateFilter === 'today', this.t('今天', 'Today'), () => { this.dateFilter = this.dateFilter === 'today' ? 'all' : 'today'; this.renderApp(); })}{chip(this.dateFilter === 'yesterday', this.t('昨天', 'Yesterday'), () => { this.dateFilter = this.dateFilter === 'yesterday' ? 'all' : 'yesterday'; this.renderApp(); })}{chip(this.dateFilter === 'week', this.t('本周', 'This week'), () => { this.dateFilter = this.dateFilter === 'week' ? 'all' : 'week'; this.renderApp(); })}</div></section>
            <section className="filter-section"><h2>{this.t('类型', 'Type')}</h2><div className="filter-row">{(['image', 'text', 'note', 'video', 'audio', 'file', 'link', 'post', 'conversation'] as Kind[]).map(kind => chip(this.kindFilters.has(kind), kindLabel(kind, this.plugin.settings.language), () => { if (this.kindFilters.has(kind)) this.kindFilters.delete(kind); else this.kindFilters.add(kind); this.renderApp(); }))}</div></section>
            <section className="filter-section"><h2>{this.t('本地文件', 'Local file')}</h2><div className="filter-row">{chip(this.localFilter === 'none', this.t('无本地文件', 'No local file'), () => { this.localFilter = this.localFilter === 'none' ? 'all' : 'none'; this.renderApp(); })}{chip(this.localFilter === 'local', this.t('本地文件', 'Local file'), () => { this.localFilter = this.localFilter === 'local' ? 'all' : 'local'; this.renderApp(); })}{chip(this.localFilter === 'missing', this.t('文件丢失', 'File missing'), () => { this.localFilter = this.localFilter === 'missing' ? 'all' : 'missing'; this.renderApp(); })}</div></section>
            <section className="filter-section source-filter-section"><h2>{this.t('来源', 'Source')}</h2><div className="filter-row">{sourceOptions.map(source => chip(this.sourceFilters.has(source), source, () => { if (this.sourceFilters.has(source)) this.sourceFilters.delete(source); else this.sourceFilters.add(source); this.renderApp(); }))}</div></section>
        </div></>;
    }

    private renderWarnings(): JSX.Element {
        return <div className="workspace-warning"><Icon name="info" size={16}/><div>{this.library.legacyDetected ? <p><strong>{this.t('检测到 v1 测试数据', 'v1 test data detected')}</strong> {this.t('本次不做迁移，请清理旧测试目录。', 'No migration is included; remove the old test directory.')}</p> : null}{this.warnings.slice(0, 3).map(warning => <p>{warning}</p>)}</div></div>;
    }

    private renderCard(item: Resolved): JSX.Element {
        const selected = this.selectionMode && this.selected.has(item.entry.id);
        const faded = this.selectionMode && !selected;
        const favorite = this.isFavorite(item);
        const openableFile = Boolean(item.filePath && !item.missing);
        const source = this.sourceLabel(item);
        const date = formatDate(item.modifiedAt);
        const cls = [
            'source-masonry-card', `kind-${item.kind}`,
            selected ? 'selected' : '', faded ? 'is-dimmed' : '',
            favorite ? 'favorited' : '',
            !item.filePath && !item.thumbnailUrl ? 'has-no-artwork' : ''
        ].filter(Boolean).join(' ');
        const onCardClick = () => {
            if (this.selectionMode) this.toggleSelected(item);
            else { this.detailId = item.entry.id; this.renderApp(); }
        };
        const resourceUrl = item.filePath ? this.plugin.io.resource(item.filePath) : item.url;
        const aiProvider = item.kind === 'conversation' ? aiProviderBadge(item.url) : '';
        const artwork = item.filePath && canPreviewImage(item.filePath)
            ? <div className="source-masonry-media"><button aria-label={this.t('查看详情', 'View details')} className="source-masonry-media-button" onClick={(event: MouseEvent) => { event.stopPropagation(); if (this.selectionMode) this.toggleSelected(item); else { this.detailId = item.entry.id; this.renderApp(); } }} type="button"><img alt={item.title} className="media-thumb" src={this.plugin.io.resource(item.filePath)}/></button></div>
            : item.filePath && item.kind === 'video'
                ? <div className="source-masonry-media"><button aria-label={this.t('查看详情', 'View details')} className="source-masonry-media-button" onClick={(event: MouseEvent) => { event.stopPropagation(); if (this.selectionMode) this.toggleSelected(item); else { this.detailId = item.entry.id; this.renderApp(); } }} type="button"><video aria-label={item.title} className="media-thumb video-thumb" muted playsInline preload="metadata" src={this.plugin.io.resource(item.filePath)} onLoadedMetadata={(event: Event) => { const video = event.currentTarget as HTMLVideoElement; const badge = video.closest('.source-masonry-media')?.querySelector<HTMLElement>('.source-media-badge span'); const duration = formatDuration(video.duration); if (badge && duration) badge.textContent = duration; if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.min(.1, video.duration * .05); }}/></button><span className="source-media-badge"><Icon name="video" size={13}/><span>{this.t('视频', 'Video')}</span></span></div>
            : item.thumbnailUrl
                ? <div className="source-masonry-media"><button aria-label={this.t('查看详情', 'View details')} className="source-masonry-media-button" onClick={(event: MouseEvent) => { event.stopPropagation(); if (this.selectionMode) this.toggleSelected(item); else { this.detailId = item.entry.id; this.renderApp(); } }} type="button"><img alt={item.title} className="media-thumb" src={item.thumbnailUrl}/></button></div>
            : item.kind === 'audio' && resourceUrl
                ? <div className="source-audio-preview"><div className="source-card-kind"><Icon name="audio" size={16}/><strong>{this.t('音频', 'Audio')}</strong></div><audio aria-label={item.title} controls onClick={(event: MouseEvent) => event.stopPropagation()} src={resourceUrl}/></div>
            : item.kind === 'post' || item.kind === 'link'
                ? <div className="source-link-preview"><div className="source-card-kind"><Icon name="link" size={16}/><strong>{kindLabel(item.kind, this.plugin.settings.language)}</strong></div><p>{item.body.slice(0, 180) || item.url}</p></div>
            : item.kind === 'text' || item.kind === 'note' || Boolean(item.body)
                ? <div className="source-text-preview"><div className="source-card-kind"><Icon name="text" size={16}/><strong>{kindLabel(item.kind, this.plugin.settings.language)}</strong></div><p>{item.body.slice(0, 150)}</p></div>
                : <div className="source-file-preview"><div className="source-card-kind"><Icon name={kindIcon(item.kind)} size={16}/><strong>{item.filePath?.split('.').pop()?.toUpperCase() || kindLabel(item.kind, this.plugin.settings.language)}</strong>{item.filePath ? <span>{humanSize(item.fileSize)}</span> : null}</div></div>;
        return <article className={cls} data-source-id={item.entry.id} onClick={onCardClick}>
            <div className="source-card-hover-actions">
                {openableFile ? <button aria-label={this.t('打开原文件', 'Open original file')} className="source-card-quick-action" data-tooltip={this.t('打开原文件', 'Open original file')} onClick={(event: MouseEvent) => { event.stopPropagation(); void this.openOriginal(item.filePath as string); }} type="button"><Icon name="external-link" size={15}/></button> : null}
                <button aria-label={favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite')} aria-pressed={favorite} className={`source-card-favorite${favorite ? ' active' : ''}`} data-tooltip={favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite')} onClick={(event: MouseEvent) => { event.stopPropagation(); void this.toggleFavorite(item); }} type="button"><Icon filled={favorite} name="star" size={13}/></button>
                <button aria-label={this.selectionMode ? this.t('查看详情', 'View details') : this.t('复制到剪贴板', 'Copy to clipboard')} className="source-select-button" data-tooltip={this.selectionMode ? this.t('查看详情', 'View details') : this.t('复制到剪贴板', 'Copy to clipboard')} onClick={(event: MouseEvent) => { event.stopPropagation(); if (this.selectionMode) { this.detailId = item.entry.id; this.renderApp(); } else void this.copyCard(item); }} type="button">{this.selectionMode ? <><Icon name="eye" size={14}/><span className="source-select-label">{this.t('查看', 'View')}</span></> : <><Icon name="copy" size={14}/><span className="source-select-label">{this.t('复制', 'Copy')}</span></>}</button>
            </div>
            <button aria-label={favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite')} aria-pressed={favorite} className={`source-card-favorite-pinned${favorite ? ' active' : ''}`} data-tooltip={favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite')} hidden={!favorite} onClick={(event: MouseEvent) => { event.stopPropagation(); void this.toggleFavorite(item); }} type="button"><Icon filled name="star" size={13}/></button>
            {artwork}
            <div className="source-masonry-body">
                <h3>{item.title}</h3>
                <div className="source-card-meta"><span className={`data-status-badge ${item.url ? 'is-link' : 'is-local'}${aiProvider ? ' is-ai-provider' : ''}`}>{aiProvider ? <span aria-hidden="true" className="source-ai-provider">{aiProvider}</span> : <><Icon name={item.url ? 'link' : 'hard-drive'} size={13}/>{item.url && item.faviconUrl ? <span aria-hidden="true" className="source-favicon" style={{ backgroundImage: `url("${item.faviconUrl}")` }}/> : null}</>}</span>{item.url ? <button aria-label={this.t(`访问 ${source}`, `Visit ${source}`)} className="source-card-source-link" onClick={(event: MouseEvent) => { event.stopPropagation(); window.open(item.url, '_blank', 'noopener,noreferrer'); }} type="button">{source}</button> : <span>{source}</span>}{date ? <time>{date}</time> : null}</div>
                <div className="source-card-context-row"><button aria-label={this.t(`编辑 ${item.title} 的备注`, `Edit context for ${item.title}`)} className={`source-card-note${item.entry.note ? ' has-note' : ''}`} onClick={(event: MouseEvent) => { event.stopPropagation(); this.detailId = item.entry.id; this.focusDetailNote = true; this.renderApp(); }} type="button"><Icon name="message" size={13}/><span>{item.entry.note || this.t('添加备注…', 'Add context…')}</span></button><button aria-label={this.t(`选择 ${item.title}`, `Select ${item.title}`)} aria-pressed={selected} className={`source-card-select${selected ? ' is-selected' : ''}`} onClick={(event: MouseEvent) => { event.stopPropagation(); this.toggleSelected(item); }} type="button"><Icon name="check" size={15}/></button></div>
            </div>
        </article>;
    }

    private renderBatchActions(visible: Resolved[]): JSX.Element {
        if (!this.selectionMode) return <div className="selection-entry-actions"><button aria-label={this.t('批量操作', 'Batch actions')} className="batch-actions-fab batch-actions-entry is-collapsed" onClick={() => this.startBatchSelection()} type="button"><Icon name="list" size={16}/></button><div className="handoff-entry-wrap"><button aria-expanded={this.handoffChoiceOpen} aria-haspopup="menu" className="batch-actions-fab is-collapsed handoff-entry" onClick={() => { this.handoffChoiceOpen = !this.handoffChoiceOpen; this.renderApp(); }} type="button"><Icon name="send" size={16}/><span className="batch-actions-label">{this.t('发送给 AI', 'Send to AI')}</span></button>{this.handoffChoiceOpen ? <><div aria-hidden="true" className="popover-dismiss-layer batch-popover-dismiss" onClick={() => { this.handoffChoiceOpen = false; this.renderApp(); }}/><div className="handoff-entry-popover" role="menu"><button onClick={() => this.startHandoffSelection()} role="menuitem" type="button"><Icon name="list" size={17}/><span>{this.t('选择素材发送', 'Send selected sources')}</span></button><button onClick={() => this.startProjectHandoff()} role="menuitem" type="button"><Icon name="file-text" size={17}/><span>{this.t('发送笔记', 'Send a note')}</span></button></div></> : null}</div></div>;
        const summary = this.renderSelectionSummary(visible);
        if (this.selectionIntent === 'handoff') return <div className="batch-actions-fab handoff-selection-bar is-expanded">{summary}<button className="is-primary batch-send-ai" disabled={!this.selected.size} onClick={() => this.openHandoffFromSources()} type="button"><Icon name="arrow-left-right" size={16}/>{this.t('继续', 'Continue')}</button><button aria-label={this.t('取消发送素材', 'Cancel sending sources')} className="batch-close" onClick={() => this.clearSelectionMode()} type="button"><Icon name="x" size={17}/></button></div>;
        if (!this.selected.size) return <div className="batch-actions-fab">{summary}<button aria-label={this.t('关闭批量操作', 'Close batch actions')} className="batch-close" onClick={() => this.clearSelectionMode()} type="button"><Icon name="x" size={17}/></button></div>;
        return <div className="batch-actions-fab is-expanded">{summary}<div className="batch-more-wrap"><button aria-expanded={this.batchMoreOpen} aria-haspopup="menu" className="batch-more-trigger" onClick={() => { this.batchMoreOpen = !this.batchMoreOpen; this.updateBatchActions(); }} type="button"><Icon name="more" size={16}/>{this.t('更多', 'More')}</button>{this.batchMoreOpen ? <><div aria-hidden="true" className="popover-dismiss-layer batch-popover-dismiss" onClick={() => { this.batchMoreOpen = false; this.updateBatchActions(); }}/><div className="batch-more-popover" role="menu"><button onClick={() => { this.batchMoreOpen = false; this.updateBatchActions(); this.remove(); }} role="menuitem" type="button"><Icon name="arrow-left-right" size={16}/>{this.t('移出', 'Remove')}</button><button className="is-danger" onClick={() => { this.batchMoreOpen = false; this.updateBatchActions(); this.confirmDeleteSelected(); }} role="menuitem" type="button"><Icon name="trash" size={16}/>{this.t('删除', 'Delete')}</button><button onClick={() => { this.batchMoreOpen = false; this.updateBatchActions(); this.batchNote(); }} role="menuitem" type="button"><Icon name="message" size={16}/>{this.t('添加备注', 'Add context')}</button><button onClick={() => { this.batchMoreOpen = false; this.updateBatchActions(); this.addToExistingNote(); }} role="menuitem" type="button"><Icon name="file-plus" size={16}/>{this.t('添加到笔记', 'Add to note')}</button></div></> : null}</div><button className="batch-project-note" onClick={() => this.createProjectNote()} type="button"><Icon name="file-plus" size={16}/>{this.t('转成笔记', 'Turn into note')}</button><button className="is-primary batch-send-ai" onClick={() => this.openHandoffFromSources()} type="button"><Icon name="send" size={16}/>{this.t('发送给 AI', 'Send to AI')}</button><button aria-label={this.t('关闭批量操作', 'Close batch actions')} className="batch-close" onClick={() => this.clearSelectionMode()} type="button"><Icon name="x" size={17}/></button></div>;
    }

    private renderDetail(item: Resolved): JSX.Element {
        const favorite = this.isFavorite(item);
        const rows: DetailRow[] = [
            ...(item.url ? [{ label: this.t('链接', 'Link'), value: item.url, reveal: item.url }] : []),
            { label: this.t('来源', 'Source'), value: this.sourceLabel(item) },
            { label: this.t('修改时间', 'Modified'), value: formatDateTime(item.modifiedAt) },
            { label: this.t('格式', 'Format'), value: item.kind },
            { label: this.t('大小', 'Size'), value: item.filePath ? humanSize(item.fileSize) : '—' },
            { label: this.t('位置', 'Path'), value: item.filePath || item.bookPath }
        ];
        return <div className="masonry-detail-backdrop" role="presentation" onClick={(event: MouseEvent) => { if (event.target === event.currentTarget) { this.detailId = ''; this.renderApp(); } }}>
            <aside aria-modal="true" className="masonry-detail-modal" role="dialog">
                <header className="detail-resource-header"><h2>{item.title}</h2><div className="detail-resource-actions"><button aria-label={this.t('编辑标题', 'Edit title')} className="detail-title-action" disabled={item.entry.type === 'file'} onClick={() => void this.editTitle(item)} type="button"><Icon name="pencil" size={20}/></button><button aria-label={this.t('关闭详情', 'Close detail')} className="detail-title-action detail-close-action" onClick={() => { this.detailId = ''; this.renderApp(); }} type="button"><Icon name="x" size={18}/></button></div></header>
                <div className="inspector-body">
                    {item.filePath && canPreviewImage(item.filePath) ? <figure className="detail-media-preview"><img alt={item.title} src={this.plugin.io.resource(item.filePath)}/></figure> : item.filePath && item.kind === 'video' ? <figure className="detail-media-preview"><video aria-label={item.title} muted playsInline preload="metadata" src={this.plugin.io.resource(item.filePath)} onLoadedMetadata={(event: Event) => { const video = event.currentTarget as HTMLVideoElement; if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.min(.1, video.duration * .05); }}/></figure> : item.kind === 'audio' && (item.filePath || item.url) ? <figure className="detail-media-preview detail-audio-preview"><audio aria-label={item.title} controls src={item.filePath ? this.plugin.io.resource(item.filePath) : item.url}/></figure> : item.thumbnailUrl ? <figure className="detail-media-preview"><img alt={item.title} src={item.thumbnailUrl}/></figure> : item.entry.type === 'text' ? <section className="detail-text-editor"><div className="detail-text-heading"><h3>{this.t('内容', 'Content')}</h3><span>{this.t('最多 20,000 字', '20,000 characters maximum')}</span></div><textarea aria-label={this.t('文本内容', 'Text content')} defaultValue={item.body} maxLength={20_000} onBlur={(event: FocusEvent) => void this.saveDetailText(item, event)}/></section> : item.kind === 'text' && item.body ? <section className="detail-text-editor"><div className="detail-text-heading"><h3>{this.t('内容', 'Content')}</h3></div><textarea aria-label={this.t('文本内容', 'Text content')} readOnly value={item.body}/></section> : item.body ? <pre className="detail-text-preview">{item.body}</pre> : item.url ? <div className="detail-link-preview"><Icon name="link" size={28}/><a href={item.url} rel="noopener noreferrer" target="_blank">{item.url}</a></div> : <div className="detail-file-preview"><Icon name={kindIcon(item.kind)} size={42}/><strong>{item.filePath || this.t('原文件缺失', 'Original file missing')}</strong></div>}
                    <section className="description-editor"><div className="description-editor-heading"><span>{this.t('备注', 'Context')}</span></div><textarea aria-label={this.t('本册备注', 'Book context')} autoFocus={this.focusDetailNote} defaultValue={item.entry.note} placeholder={this.t('可写素材的来源和用途，便于管理、检索并在发送给 AI 时作为上下文。', 'Describe the source and intended use to support management, search, and AI context.')} onBlur={(event: FocusEvent) => void this.saveDetailNote(item, event)} /></section>
                    <section className="inspector-section"><h3>{this.t('信息', 'Info')}</h3><dl className="field-grid">{rows.map(row => <><dt>{row.label}</dt><dd><span>{row.value}</span>{row.reveal ? <button aria-label={row.label === this.t('链接', 'Link') ? this.t('访问链接', 'Open link') : this.t('在本地文件夹中显示', 'Reveal in folder')} className="detail-reveal-path" onClick={() => row.label === this.t('链接', 'Link') ? window.open(row.reveal as string, '_blank', 'noopener,noreferrer') : this.revealOriginal(row.reveal as string)} type="button"><Icon name="external-link" size={13}/></button> : null}</dd></>)}</dl></section>
                </div>
                <footer className="inspector-footer"><div className="inspector-footer-actions"><div className="inspector-footer-utility"><button className="detail-delete-button" onClick={() => this.confirmDeleteOne(item)} type="button"><Icon name="trash" size={18}/>{this.t('删除', 'Delete')}</button><button className="desktop-button" onClick={() => this.removeOne(item)} type="button"><Icon name="arrow-left-right" size={19}/>{this.t('移出', 'Remove')}</button>{item.filePath ? <button className="desktop-button" onClick={() => void this.copyOne(item)} type="button"><Icon name="copy" size={18}/>{this.t('复制文件', 'Copy files')}</button> : item.url ? <button className="desktop-button" onClick={() => void this.copyCard(item)} type="button"><Icon name="copy" size={18}/>{this.t('复制链接', 'Copy link')}</button> : null}</div><div className="inspector-footer-selection-actions">{item.filePath ? <button className="desktop-button" onClick={() => void this.openOriginal(item.filePath as string)} type="button"><Icon name="external-link" size={18}/>{this.t('打开', 'Open')}</button> : null}<button aria-label={favorite ? this.t('取消收藏', 'Remove favorite') : this.t('收藏', 'Favorite')} aria-pressed={favorite} className={`detail-footer-favorite${favorite ? ' active' : ''}`} onClick={() => void this.toggleFavorite(item)} type="button"><Icon filled={favorite} name="star" size={21}/></button></div></div></footer>
            </aside>
        </div>;
    }

    private renderBookSettings(book: Book): JSX.Element {
        return <div className="desktop-modal-backdrop" role="presentation" onClick={(event: MouseEvent) => { if (event.target === event.currentTarget) { this.bookSettingsOpen = false; this.renderApp(); } }}><section aria-modal="true" className="desktop-modal book-settings-modal" role="dialog"><header><h2>{this.t('重命名', 'Rename Book')}</h2><button aria-label={this.t('关闭', 'Close')} className="modal-close-button" onClick={() => { this.bookSettingsOpen = false; this.renderApp(); }} type="button"><Icon name="x" size={16}/></button></header><div className="book-settings-body"><label><span>{this.t('Book 名称', 'Book name')}</span><input id="sourcebook-book-name" value={book.title}/></label><p>{this.t('重命名不会改变这本 Book 中的素材和原文件。', "Renaming keeps this Book's sources and local files unchanged.")}</p></div><footer><div><button className="modal-text-button" onClick={() => { this.bookSettingsOpen = false; this.renderApp(); }} type="button">{this.t('取消', 'Cancel')}</button><button className="modal-save-button" onClick={() => void this.saveBookSettings(book)} type="button"><Icon name="check" size={20}/>{this.t('保存', 'Save')}</button></div></footer></section></div>;
    }

    private renderHandoff(book: Book): JSX.Element {
        let plan: PackPlan | undefined;
        try { plan = planPack(this.effectiveHandoffItems(), book.title, '', this.handoffSource === 'project' ? this.handoffProject : undefined, this.plugin.settings.language); } catch (error) { this.handoffError = message(error); }
        const fileCount = plan ? handoffFileCount(plan) : 0;
        const linkCount = plan ? plan.items.filter(item => item.status === 'link').length : 0;
        const scopeFiles = plan?.items.filter(item => item.status !== 'link') ?? [];
        const scopeLinks = plan?.items.filter(item => item.status === 'link') ?? [];
        return <div className="desktop-modal-backdrop handoff-backdrop" role="presentation">
            <section aria-modal="true" className="handoff-modal" role="dialog">
                <header><h2>{this.t('发送给 AI', 'Send to AI')}</h2><button aria-label={this.t('关闭', 'Close')} className="modal-close-button" onClick={() => { this.handoffOpen = false; this.renderApp(); }} type="button"><Icon name="x" size={16}/></button></header>
                <div className="handoff-layout">
                    <section className={`handoff-scope-panel${this.handoffScopeExpanded ? ' is-expanded' : ''}`}>
                        <button aria-controls="handoff-included-list" aria-expanded={this.handoffScopeExpanded} className="handoff-scope-toggle" onClick={() => { this.handoffScopeExpanded = !this.handoffScopeExpanded; this.renderApp(); }} type="button"><span className="handoff-scope-title"><h3>{this.t('范围', 'Scope')}</h3><small>{this.t('文字和笔记会作为文件复制', 'Text and notes are copied as files')}</small></span><span className="handoff-scope-stats"><span>{this.t(`文件：${fileCount}`, `Files: ${fileCount}`)}</span><span>{this.t(`链接：${linkCount}`, `Links: ${linkCount}`)}</span></span><Icon name="chevron-down" size={15}/></button>
                        {this.handoffScopeExpanded ? <div className="handoff-file-items" id="handoff-included-list">{plan?.items.length ? <div className="handoff-scope-columns"><section className="handoff-scope-column"><h4>{this.t('文件', 'Files')}</h4>{scopeFiles.map((item, index) => <div className="handoff-scope-item"><span className="handoff-status is-file"><Icon name={item.status === 'file' ? 'hard-drive' : item.status === 'text' ? 'file-text' : 'x'} size={14}/></span><span><strong>[{index + 1}] {item.title}</strong><small>{item.status === 'file' ? item.originalPath : item.status === 'text' ? handoffTextFileName(item) : this.t('原文件缺失', 'Original file missing')}</small></span></div>)}</section><section className="handoff-scope-column"><h4>{this.t('链接', 'Links')}</h4>{scopeLinks.map((item, index) => <div className="handoff-scope-item"><span className="handoff-status is-link"><Icon name="link" size={14}/></span><span><strong>[{index + 1}] {item.title}</strong><small>{item.url}</small></span></div>)}</section></div> : <p>{this.t('项目笔记将直接写入提示词。', 'The project note is written directly into the prompt.')}</p>}</div> : null}
                    </section>
                    <div className="handoff-content">
                        <main><section className="handoff-prompt"><div className="handoff-section-heading"><h3>{this.t('提示词', 'Prompt')}</h3><button className="modal-text-button" onClick={() => this.restoreHandoffPrompt()} type="button">{this.t('恢复默认', 'Restore default')}</button></div><textarea aria-label={this.t('提示词', 'Prompt')} onInput={(event: Event) => { this.handoffPrompt = (event.currentTarget as HTMLTextAreaElement).value; }} value={this.handoffPrompt}/></section><section className="handoff-copy-help"><h3>{this.t('操作说明', 'How it works')}</h3><p>{this.t('先复制文件后在 Agent 输入框粘贴实现文件传入，再复制粘贴提示词，就可以让 Agent 获取并理解所有必要的数据；你可以补充自己的任务说明后直接发送。不同 Agent 对可上传文件的类型和数量要求不同；若上传失败，请重新选择素材后再次打包。', 'Copy files first and paste them into your agent input to attach them. Then copy and paste the prompt so the agent receives and understands the necessary context. Add your task instructions, then send. Each agent has different limits on supported file types and quantity. If uploading fails, select the materials again and create a new pack.')}</p></section></main>
                    </div>
                </div>
                <footer><div><button className="desktop-button is-primary" disabled={!plan || this.handoffBusy || !fileCount} onClick={() => plan ? void this.copyHandoffFiles(plan) : undefined} type="button"><Icon name="copy" size={17}/>{this.t('复制文件', 'Copy files')}</button><button className="desktop-button is-primary" disabled={!plan || this.handoffBusy || !this.handoffPrompt.trim()} onClick={() => void this.copyHandoffPrompt()} type="button"><Icon name="copy" size={17}/>{this.t('复制提示词', 'Copy prompt')}</button></div></footer>
            </section>
        </div>;
    }

    private updateSearch(event: Event): void {
        const input = event.currentTarget as HTMLInputElement;
        this.query = input.value;
        const start = input.selectionStart || this.query.length;
        this.renderApp();
        queueMicrotask(() => {
            const next = this.contentEl.querySelector<HTMLInputElement>('.sources-search input');
            next?.focus(); next?.setSelectionRange(start, start);
        });
    }

    private toggleSelected(item: Resolved): void {
        if (this.selected.has(item.entry.id)) this.selected.delete(item.entry.id); else this.selected.add(item.entry.id);
        this.selectionMode = true;
        this.syncSelectionCards();
        this.updateBatchActions();
    }

    private renderSelectionSummary(visible: Resolved[]): JSX.Element {
        const allSelected = visible.length > 0 && visible.every(item => this.selected.has(item.entry.id));
        const someSelected = visible.some(item => this.selected.has(item.entry.id));
        const state = allSelected ? ' is-checked' : someSelected ? ' is-mixed' : '';
        const label = this.selected.size
            ? this.t(`${this.selected.size} 个已选`, `${this.selected.size} selected`)
            : this.t('选择素材', 'Select sources');
        const action = allSelected
            ? this.t('取消选择当前显示的素材', 'Deselect visible sources')
            : this.t('选择当前显示的所有素材', 'Select all visible sources');
        return <span className="batch-actions-label batch-selection-summary"><button aria-checked={allSelected ? 'true' : someSelected ? 'mixed' : 'false'} aria-label={action} className={`batch-select-toggle${state}`} onClick={() => this.toggleVisibleSelection(visible)} role="checkbox" type="button">{allSelected ? <Icon name="check" size={13}/> : someSelected ? <span/> : null}</button><span>{label}</span></span>;
    }

    private toggleVisibleSelection(visible: Resolved[]): void {
        const allSelected = visible.length > 0 && visible.every(item => this.selected.has(item.entry.id));
        visible.forEach(item => {
            if (allSelected) this.selected.delete(item.entry.id);
            else this.selected.add(item.entry.id);
        });
        this.selectionMode = true;
        this.syncSelectionCards();
        this.updateBatchActions();
    }

    private async setLanguage(language: 'zh' | 'en'): Promise<void> {
        this.plugin.settings.language = language;
        await this.plugin.saveSettings();
        this.renderApp();
    }

    private async switchBook(book: Book): Promise<void> {
        this.plugin.settings.bookId = book.id;
        this.bookMenuOpen = false;
        this.bookOptionsId = '';
        await this.plugin.saveSettings();
        await this.reload();
    }

    private async openBookSettings(book: Book): Promise<void> {
        this.bookMenuOpen = false;
        this.bookOptionsId = '';
        this.plugin.settings.bookId = book.id;
        await this.plugin.saveSettings();
        await this.reload();
        this.bookSettingsOpen = true;
        this.renderApp();
    }

    private createBook(): void {
        new FormModal(this.app, this.t('新建 Book', 'New Book'), [{ key: 'title', label: this.t('Book 名称（选填）', 'Book name (optional)'), placeholder: this.t('留空则自动命名为 “New Book”；重名自动编号', 'Leave blank for “New Book”; duplicates are numbered') }], this.t('创建', 'Create'), async values => {
            const book = await this.plugin.store.createBook(values.title || '', this.plugin.settings.language);
            this.plugin.settings.bookId = book.id;
            await this.plugin.saveSettings();
            await this.reload();
        }).open();
    }

    private pickVault(): void {
        const book = this.book;
        if (!book) return;
        new FilePicker(this.app, file => !file.path.startsWith(`${BOOKS_DIR}/`) && !file.path.startsWith(`${SNAPSHOTS_DIR}/`) && file.path !== `${DATA_DIR}/library.json`, async file => {
            await this.plugin.store.addVaultFile(book, file.path, this.plugin.settings.language);
            await this.reload();
        }).open();
    }

    private importFiles(): void {
        const book = this.book;
        if (!book) return;
        const input = this.contentEl.ownerDocument.createElement('input');
        input.type = 'file'; input.multiple = true;
        input.addEventListener('change', () => {
            void (async () => {
                const files = Array.from(input.files || []); let count = 0; const errors: string[] = [];
                for (const file of files) {
                    try { if (file.size > MAX_IMPORT_BYTES) throw new Error('25 MB maximum'); await this.plugin.store.importFile(book, file.name, await file.arrayBuffer(), this.plugin.settings.language); count++; }
                    catch (error) { errors.push(`${file.name}: ${message(error)}`); }
                }
                this.notify(this.t(`已导入或复用 ${count} 个文件`, `Imported or reused ${count} files`));
                if (errors.length) new Notice(errors.join('\n'), 12000);
                await this.reload();
            })().catch(error => this.notify(message(error), 'error'));
        }, { once: true });
        input.click();
    }

    private addText(): void {
        const book = this.book;
        if (!book) return;
        new FormModal(this.app, this.t('添加文字', 'Add text'), [{ key: 'title', label: this.t('标题（选填）', 'Title (optional)'), placeholder: this.t('留空则命名为“文字”', 'Leave blank to name it “Text”') }, { key: 'body', label: this.t('正文（必填，最多 20,000 字）', 'Text (required, 20,000 characters maximum)'), multiline: true, required: true, maxLength: 20_000 }], this.t('保存', 'Save'), async values => { await this.plugin.store.addText(book, values.title || '', values.body || '', '', this.plugin.settings.language); await this.reload(); }).open();
    }

    private async addVaultNote(): Promise<void> {
        const book = this.book;
        if (!book) return;
        try {
            const path = await this.plugin.store.createVaultNote(book, this.plugin.settings.language);
            await this.plugin.io.open(path);
            await this.reload();
        } catch (error) { this.notify(message(error), 'error'); }
    }

    private batchNote(): void {
        const book = this.book; const items = this.chosen();
        if (!book || !items.length) return;
        new FormModal(this.app, this.t('添加本册备注', 'Add context'), [{ key: 'note', label: this.t('备注', 'Context'), multiline: true, placeholder: this.t('会写入所有已选素材。', 'Applied to all selected sources.') }], this.t('保存', 'Save'), async values => {
            for (const item of items) await this.plugin.store.updateNote(book, item.entry.id, values.note || '', item.entry.note);
            await this.reload();
        }).open();
    }

    private createProjectNote(): void {
        const book = this.book; const entries = this.chosenEntries();
        if (!book || !entries.length) return;
        new FormModal(this.app, this.t('新建项目笔记', 'Create project note'), [{ key: 'path', label: this.t('Vault 内路径', 'Vault path'), value: `${safeName(book.title)}.md` }], this.t('创建并打开', 'Create and open'), async values => {
            const path = await this.plugin.store.createProjectNote(book, entries, values.path || `${safeName(book.title)}.md`, this.plugin.settings.language);
            await this.plugin.io.open(path);
        }).open();
    }

    private addToExistingNote(): void {
        const book = this.book; const entries = this.chosenEntries();
        if (!book || !entries.length) return;
        new FilePicker(this.app, file => file.extension === 'md' && !file.path.startsWith(`${BOOKS_DIR}/`) && !file.path.startsWith(`${SNAPSHOTS_DIR}/`) && !file.path.startsWith(`${DATA_DIR}/`), async file => {
            await this.plugin.store.appendReferences(book, entries, file.path, this.plugin.settings.language);
            await this.plugin.io.open(file.path);
            this.notify(this.t('素材和备注已添加到笔记', 'Materials and context were added to the note'));
        }).open();
    }

    private remove(): void {
        const book = this.book; const ids = [...this.selected];
        if (!book || !ids.length) return;
        void this.plugin.store.remove(book, ids).then(async () => { this.selected.clear(); this.selectionMode = false; this.notify(this.t('已移出当前 Book。', 'Removed from this Book.')); await this.reload(); }).catch(error => this.notify(message(error), 'error'));
    }

    private removeOne(item: Resolved): void {
        const book = this.book;
        if (!book) return;
        void this.plugin.store.remove(book, [item.entry.id]).then(async () => { this.detailId = ''; this.notify(this.t('已移出当前 Book。', 'Removed from this Book.')); await this.reload(); }).catch(error => this.notify(message(error), 'error'));
    }

    private confirmDeleteOne(item: Resolved): void {
        const book = this.book;
        if (!book) return;
        const detail = item.filePath
            ? this.t('这会彻底删除素材及其 Vault 原文件，无法找回。引用该文件的其他 Book 或笔记都会受到影响。', 'This permanently deletes the source and its original Vault file. It cannot be recovered, and other Books or notes that reference the file will be affected.')
            : this.t('这会彻底删除当前 Book 中的素材条目，无法找回。引用该条目的其他 Book 或笔记可能受到影响。', 'This permanently deletes this source item from the current Book. It cannot be recovered, and other Books or notes that reference it may be affected.');
        new ConfirmModal(this.app, this.t('删除素材？', 'Delete source?'), detail, this.t('删除', 'Delete'), async () => { await this.plugin.store.deleteEntries(book, [item.entry.id], Boolean(item.filePath)); this.detailId = ''; await this.reload(); }).open();
    }

    private confirmDeleteSelected(): void {
        const book = this.book; const ids = [...this.selected]; const hasFiles = this.chosen().some(item => Boolean(item.filePath));
        if (!book || !ids.length) return;
        const detail = hasFiles
            ? this.t('这会彻底删除所选素材及其 Vault 原文件，无法找回。引用这些文件的其他 Book 或笔记都会受到影响。', 'This permanently deletes the selected sources and their original Vault files. It cannot be recovered, and other Books or notes that reference those files will be affected.')
            : this.t('这会彻底删除所选素材条目，无法找回。引用这些条目的其他 Book 或笔记可能受到影响。', 'This permanently deletes the selected source items. It cannot be recovered, and other Books or notes that reference them may be affected.');
        new ConfirmModal(this.app, this.t('删除所选素材？', 'Delete selected sources?'), detail, this.t('删除', 'Delete'), async () => { await this.plugin.store.deleteEntries(book, ids, hasFiles); this.selected.clear(); this.selectionMode = false; await this.reload(); }).open();
    }

    private async saveDetailNote(item: Resolved, event: FocusEvent): Promise<void> {
        const book = this.book; if (!book) return;
        const value = (event.currentTarget as HTMLTextAreaElement).value;
        if (value === item.entry.note) return;
        try { await this.plugin.store.updateNote(book, item.entry.id, value, item.entry.note); this.notify(this.t('备注已保存', 'Context saved')); await this.reload(); }
        catch (error) { this.notify(message(error), 'error'); }
    }

    private async openOriginal(path: string): Promise<void> {
        try { await this.plugin.io.open(path); }
        catch (error) { this.notify(message(error), 'error'); }
    }

    private revealOriginal(path: string): void {
        try { this.plugin.io.reveal(path); }
        catch (error) { this.notify(message(error), 'error'); }
    }

    private async saveDetailText(item: Resolved, event: FocusEvent): Promise<void> {
        const book = this.book; if (!book || item.entry.type !== 'text') return;
        const value = (event.currentTarget as HTMLTextAreaElement).value;
        if (value === item.body) return;
        try { await this.plugin.store.updateText(book, item.entry.id, value, item.body); this.notify(this.t('文本已保存', 'Text saved')); await this.reload(); }
        catch (error) { this.notify(message(error), 'error'); }
    }

    private async editTitle(item: Resolved): Promise<void> {
        const book = this.book;
        if (!book || item.entry.type === 'file') return;
        new FormModal(this.app, this.t('编辑标题', 'Edit title'), [{ key: 'title', label: this.t('标题', 'Title'), value: item.title, required: true, maxLength: 160 }], this.t('保存', 'Save'), async values => {
            await this.plugin.store.updateTitle(book, item.entry.id, values.title || '', item.entry.title || '');
            await this.reload();
        }).open();
    }

    private async copyOne(item: Resolved): Promise<void> {
        try {
            if (!item.filePath) throw new Error(this.t('没有可复制的本地文件', 'No local file to copy'));
            if (!fileClipboardPlatform()) throw new Error(this.t('当前平台不支持文件剪贴板', 'File clipboard is not supported on this platform'));
            await copyFiles([this.plugin.io.absolute(item.filePath)]);
            this.notify(this.t('文件已复制，可直接粘贴到 Agent 的文件输入框。', 'File copied. Paste it directly into the agent file input.'));
        } catch (error) { this.notify(message(error), 'error'); }
    }

    private async copyCard(item: Resolved): Promise<void> {
        try {
            if (item.filePath) { await this.copyOne(item); return; }
            const value = item.entry.type === 'text' ? item.body : item.url;
            if (!value) throw new Error(this.t('没有可复制的文本内容', 'No text content to copy'));
            await copyText(value);
            this.notify(this.t('已复制文本内容', 'Text copied'));
        } catch (error) {
            this.notify(message(error), 'error');
        }
    }

    private startBatchSelection(): void {
        this.handoffChoiceOpen = false;
        this.selectionIntent = 'batch';
        this.selectionMode = true;
        this.renderApp();
    }

    private startHandoffSelection(): void {
        this.handoffChoiceOpen = false;
        this.selected.clear();
        this.selectionIntent = 'handoff';
        this.selectionMode = true;
        this.renderApp();
    }

    private startProjectHandoff(): void {
        this.handoffChoiceOpen = false;
        this.selected.clear();
        this.selectionIntent = 'handoff';
        this.selectionMode = false;
        this.handoffSource = 'project';
        this.handoffProject = undefined;
        this.handoffProjectItems = [];
        this.chooseProjectNote();
        this.renderApp();
    }

    private clearSelectionMode(): void {
        this.selectionMode = false;
        this.selectionIntent = 'batch';
        this.batchMoreOpen = false;
        this.renderApp();
    }

    private openHandoffFromSources(): void {
        if (!this.selected.size || !this.book) return;
        this.handoffSource = 'sources';
        this.handoffProject = undefined;
        this.handoffProjectItems = [];
        this.handoffStatus = '';
        this.handoffError = '';
        this.handoffScopeExpanded = false;
        try { this.handoffPrompt = this.defaultHandoffPrompt(); this.handoffOpen = true; }
        catch (error) { this.handoffError = message(error); }
        this.renderApp();
    }

    private effectiveHandoffItems(): Resolved[] {
        return this.handoffSource === 'project' ? this.handoffProjectItems : this.chosen();
    }

    private defaultHandoffPrompt(): string {
        if (!this.book) return '';
        const project = this.handoffSource === 'project' ? this.handoffProject : undefined;
        return promptFor(planPack(this.effectiveHandoffItems(), this.book.title, '', project, this.plugin.settings.language));
    }

    private restoreHandoffPrompt(): void {
        try { this.handoffPrompt = this.defaultHandoffPrompt(); this.handoffError = ''; }
        catch (error) { this.handoffError = message(error); this.notify(message(error), 'error'); }
        this.renderApp();
    }

    private chooseProjectNote(): void {
        new FilePicker(this.app, file => file.extension === 'md' && !file.path.startsWith(`${BOOKS_DIR}/`) && !file.path.startsWith(`${SNAPSHOTS_DIR}/`) && !file.path.startsWith(`${DATA_DIR}/`), async file => {
            this.handoffProject = { path: file.path, body: await this.plugin.store.projectNote(file.path) };
            this.handoffProjectItems = await this.plugin.store.referencedItems(file.path);
            this.handoffPrompt = this.defaultHandoffPrompt();
            this.handoffScopeExpanded = false;
            this.handoffOpen = true;
            this.handoffStatus = ''; this.handoffError = ''; this.renderApp();
        }).open();
    }

    private async copyHandoffPrompt(): Promise<void> {
        this.handoffBusy = true; this.renderApp();
        try { await copyText(this.handoffPrompt); this.notify(this.t('提示词已复制，可粘贴到 Agent 对话框。', 'Prompt copied. Paste it into your agent chat.')); }
        catch (error) { this.notify(this.t(`无法复制提示词：${message(error)}`, `Could not copy prompt: ${message(error)}`), 'error'); }
        finally { this.handoffBusy = false; this.renderApp(); }
    }

    private async copyHandoffFiles(plan: PackPlan): Promise<void> {
        this.handoffBusy = true; this.renderApp();
        try { const paths = attachmentPaths(plan); const texts = plan.items.filter(item => item.status === 'text').map(item => ({ name: handoffTextFileName(item), text: item.body || '' })); if (!paths.length && !texts.length) throw new Error(this.t('没有可复制的文件', 'No files to copy')); await copyFilesWithText(paths.map(path => this.plugin.io.absolute(path)), texts); const count = paths.length + texts.length; this.notify(this.t(`已复制 ${count} 个文件，可粘贴到 Agent 输入框。`, `Copied ${count} ${count === 1 ? 'file' : 'files'}. Paste ${count === 1 ? 'it' : 'them'} into your agent input.`)); }
        catch (error) { this.notify(this.t(`无法复制文件：${message(error)}`, `Could not copy files: ${message(error)}`), 'error'); }
        finally { this.handoffBusy = false; this.renderApp(); }
    }

    private async saveBookSettings(book: Book): Promise<void> {
        const input = this.contentEl.querySelector<HTMLInputElement>('#sourcebook-book-name');
        const title = input?.value.trim() || '';
        if (!title || title === book.title) { this.bookSettingsOpen = false; this.renderApp(); return; }
        try { const updated = await this.plugin.store.renameBook(book, title); this.plugin.settings.bookId = updated.id; await this.plugin.saveSettings(); this.bookSettingsOpen = false; await this.reload(); }
        catch (error) { this.notify(message(error), 'error'); }
    }

    private deleteBook(book: Book): void {
        const finish = async (deleteOriginals: boolean) => { await this.plugin.store.deleteBook(book, deleteOriginals); this.bookSettingsOpen = false; this.plugin.settings.bookId = ''; await this.plugin.saveSettings(); await this.reload(); };
        new ConfirmModal(this.app, this.t('删除这个 Book？', 'Delete this Book?'), this.t('删除后无法找回。只删除 Book 会让相关笔记中的 Book 引用失效；同时删除原文件还会影响其他引用这些文件的 Book 或笔记。', 'Deletion cannot be undone. Deleting only the Book breaks its embeds in related notes; deleting original files also affects other Books or notes that reference them.'), this.t('只删除 Book', 'Delete Book only'), async () => finish(false), { label: this.t('同时删除原文件', 'Delete Book and original files'), confirm: async () => finish(true), danger: true }).open();
    }
}
