import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { App } from 'obsidian';
import { type Book, type DocumentLanguage, type Entry, type PickerMetadata, safeName } from './core';
import { SourcebookStore } from './store';

const PORT = 27124;
const MAX_REQUEST_BYTES = 36 * 1024 * 1024;
const PICKER_MODALITIES = new Set<PickerPayload['modality']>(['text', 'image', 'video', 'audio', 'link', 'post', 'conversation']);
const PICKER_ORIGINS = new Set([
    'chrome-extension://cehohknopnehbkiokoffhfjepaieapan',
    'chrome-extension://pkglhngkfkjblabnhgcioindjgffgfpf'
]);

type PickerHost = {
    app: App;
    store: SourcebookStore;
    settings: { language: DocumentLanguage; bookId: string; pickerToken?: string; pickerPairingCode?: string };
    saveSettings(): Promise<void>;
    openView(): Promise<void>;
    refresh(): void;
};

type PickerPayload = {
    bookId?: string;
    modality: 'text' | 'image' | 'video' | 'audio' | 'link' | 'post' | 'conversation';
    title?: string;
    contentText?: string;
    contentUrl?: string;
    contentBase64?: string;
    contentMimeType?: string;
    thumbnailUrl?: string;
    thumbnailBase64?: string;
    thumbnailMimeType?: string;
    sourceUrl: string;
    sourceTitle: string;
    sourceOrigin: string;
    pickedAt?: string;
    faviconUrl?: string;
    pageMetadata?: { pageTitle?: string; description?: string; siteName?: string; author?: string; publishedAt?: string; canonicalUrl?: string; [key: string]: unknown };
    userNote?: string;
    post?: { bodyText?: string; title?: string; author?: { displayName?: string; handle?: string }; publishedAt?: string; tags?: string[] };
    conversation?: { provider?: string; messages?: Array<{ role?: string; text?: string; markdown?: string }>; messageCount?: number };
};

function optionalText(value: unknown, field: string, maximum = 100_000): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new Error(`${field} must be text`);
    if (value.length > maximum) throw new Error(`${field} is too large`);
    return value;
}

function requiredText(value: unknown, field: string, maximum = 100_000): string {
    const text = optionalText(value, field, maximum);
    if (!text) throw new Error(`${field} is required`);
    return text;
}

function optionalObject(value: unknown, field: string): Record<string, unknown> | undefined {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
    return value as Record<string, unknown>;
}

function pickerPayload(value: Record<string, unknown>): PickerPayload {
    const modality = value.modality;
    if (typeof modality !== 'string' || !PICKER_MODALITIES.has(modality as PickerPayload['modality'])) throw new Error('Unsupported Picker material type');
    return {
        modality: modality as PickerPayload['modality'],
        sourceUrl: requiredText(value.sourceUrl, 'sourceUrl', 4_000),
        sourceTitle: requiredText(value.sourceTitle, 'sourceTitle', 1_000),
        sourceOrigin: requiredText(value.sourceOrigin, 'sourceOrigin', 4_000),
        title: optionalText(value.title, 'title', 1_000),
        contentText: optionalText(value.contentText, 'contentText', 300_000),
        contentUrl: optionalText(value.contentUrl, 'contentUrl', 4_000),
        contentBase64: optionalText(value.contentBase64, 'contentBase64', MAX_REQUEST_BYTES),
        contentMimeType: optionalText(value.contentMimeType, 'contentMimeType', 200),
        thumbnailUrl: optionalText(value.thumbnailUrl, 'thumbnailUrl', 4_000),
        thumbnailBase64: optionalText(value.thumbnailBase64, 'thumbnailBase64', MAX_REQUEST_BYTES),
        thumbnailMimeType: optionalText(value.thumbnailMimeType, 'thumbnailMimeType', 200),
        faviconUrl: optionalText(value.faviconUrl, 'faviconUrl', 4_000),
        pickedAt: optionalText(value.pickedAt, 'pickedAt', 100),
        userNote: optionalText(value.userNote, 'userNote', 20_000),
        pageMetadata: optionalObject(value.pageMetadata, 'pageMetadata') as PickerPayload['pageMetadata'],
        post: optionalObject(value.post, 'post') as PickerPayload['post'],
        conversation: optionalObject(value.conversation, 'conversation') as PickerPayload['conversation']
    };
}

function titleFor(payload: PickerPayload): string {
    // A captured selection is its own material. Its text belongs in the editable
    // content field, rather than being duplicated into the title.
    if (payload.modality === 'text') return '文字';
    const raw = (payload.title || payload.sourceTitle || payload.contentText?.slice(0, 80) || payload.contentUrl || payload.sourceUrl || 'Picker capture').trim();
    const title = payload.modality === 'conversation' && payload.conversation?.provider
        ? raw.replace(new RegExp(`\\s*[-–—|]\\s*${payload.conversation.provider.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'i'), '')
        : raw;
    return title.slice(0, 160) || 'Picker capture';
}

function extensionForMime(mime = ''): string {
    const normalized = mime.split(';', 1)[0]?.toLowerCase() || '';
    return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg' } as Record<string, string>)[normalized] || 'bin';
}

function markdownFor(payload: PickerPayload): string {
    const lines: string[] = [];
    const metadata = (): void => {
        const values: Array<[string, unknown]> = [
            ['Title', payload.pageMetadata?.pageTitle || payload.sourceTitle], ['Site', payload.pageMetadata?.siteName],
            ['Description', payload.pageMetadata?.description], ['Author', payload.pageMetadata?.author],
            ['Published', payload.pageMetadata?.publishedAt], ['Canonical URL', payload.pageMetadata?.canonicalUrl]
        ];
        const available = values.filter(([, value]) => typeof value === 'string' && value.trim());
        if (available.length) lines.push('## Metadata', ...available.map(([key, value]) => `- ${key}: ${String(value).trim()}`), '');
    };
    const source = (): void => { if (payload.sourceUrl) lines.push('## Source', payload.sourceUrl); };
    if (payload.modality === 'conversation' && payload.conversation) {
        for (const message of payload.conversation.messages || []) lines.push('', `## ${message.role || 'message'}`, '', message.markdown || message.text || '');
        return `${lines.join('\n').trim()}\n`;
    }
    if (payload.modality === 'post' && payload.post) {
        if (payload.thumbnailUrl) lines.push(`![Captured thumbnail](${payload.thumbnailUrl})`, '');
        metadata();
        const author = [payload.post.author?.displayName, payload.post.author?.handle ? `@${payload.post.author.handle}` : ''].filter(Boolean).join(' ');
        const postDetails = [author ? `- Author: ${author}` : '', payload.post.publishedAt ? `- Published: ${payload.post.publishedAt}` : '', payload.post.tags?.length ? `- Tags: ${payload.post.tags.join(', ')}` : ''].filter(Boolean);
        if (postDetails.length) lines.push('## Post metadata', ...postDetails, '');
        if (payload.post.bodyText) lines.push('## Post', payload.post.bodyText, '');
        source();
    } else {
        metadata();
        if (payload.contentUrl && payload.contentUrl !== payload.sourceUrl) lines.push(`- Captured item: ${payload.contentUrl}`, '');
        if (payload.contentText) lines.push('## Content', payload.contentText, '');
        source();
    }
    return `${lines.join('\n').trim()}\n`;
}

function pickerFor(payload: PickerPayload): PickerMetadata {
    const candidateDuration = payload.pageMetadata?.mediaDurationSeconds;
    const durationSeconds = typeof candidateDuration === 'number' && Number.isFinite(candidateDuration) && candidateDuration > 0
        ? candidateDuration
        : undefined;
    return {
        modality: payload.modality,
        title: titleFor(payload),
        contentText: payload.modality === 'text' ? payload.contentText?.slice(0, 20_000) : undefined,
        sourceUrl: payload.sourceUrl,
        sourceTitle: payload.sourceTitle,
        sourceOrigin: payload.sourceOrigin,
        thumbnailUrl: payload.thumbnailUrl,
        faviconUrl: payload.faviconUrl,
        ...(durationSeconds ? { durationSeconds } : {}),
        pickedAt: payload.pickedAt
    };
}

export class PickerReceiver {
    private server: Server | undefined;
    constructor(private host: PickerHost) {}

    async start(): Promise<void> {
        if (this.server) return;
        await new Promise<void>((resolve, reject) => {
            const server = createServer((request, response) => { void this.handle(request, response); });
            server.once('error', reject);
            server.listen(PORT, '127.0.0.1', () => {
                server.off('error', reject);
                this.server = server;
                resolve();
            });
        });
    }

    stop(): void { this.server?.close(); this.server = undefined; }

    async ensurePairingCode(): Promise<string> {
        if (!this.host.settings.pickerPairingCode) {
            this.host.settings.pickerPairingCode = randomBytes(9).toString('hex').toUpperCase();
            await this.host.saveSettings();
        }
        return this.host.settings.pickerPairingCode;
    }

    async rotatePairingCode(): Promise<string> {
        this.host.settings.pickerToken = undefined;
        this.host.settings.pickerPairingCode = randomBytes(9).toString('hex').toUpperCase();
        await this.host.saveSettings();
        return this.host.settings.pickerPairingCode;
    }

    /** Disconnecting deliberately rotates the secret, invalidating every Picker token. */
    async revoke(): Promise<void> { await this.rotatePairingCode(); }

    private origin(request: IncomingMessage, response: ServerResponse): boolean {
        const origin = request.headers.origin;
        if (typeof origin === 'string' && !PICKER_ORIGINS.has(origin)) { this.send(response, 403, { error: 'Untrusted Picker origin' }); return false; }
        if (typeof origin === 'string') response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        return true;
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        if (!this.origin(request, response)) return;
        if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
        const url = new URL(request.url || '/', `http://127.0.0.1:${PORT}`);
        if (request.method === 'GET' && url.pathname === '/api/health') { this.send(response, 200, { app: 'sourcebook-obsidian', connection: { origin: `http://127.0.0.1:${PORT}` } }); return; }
        if (request.method === 'POST' && url.pathname === '/api/pair') { await this.pair(request, response); return; }
        if (!this.authorized(request)) { this.send(response, 401, { error: 'Pair Picker with this Obsidian vault first', code: 'PAIRING_REQUIRED' }); return; }
        try {
            if (request.method === 'GET' && url.pathname === '/api/books') { await this.books(response); return; }
            if (request.method === 'POST' && url.pathname === '/api/books') { await this.createBook(request, response); return; }
            if (request.method === 'POST' && url.pathname === '/api/picks') { await this.savePick(request, response); return; }
            if (request.method === 'GET' && url.pathname === '/api/sources') { await this.sources(response, url.searchParams.get('bookId') || undefined); return; }
            if (request.method === 'PATCH' && /^\/api\/sources\/[^/]+\/note$/.test(url.pathname)) { await this.note(request, response, decodeURIComponent(url.pathname.split('/')[3] || ''), url.searchParams.get('bookId') || undefined); return; }
            if (request.method === 'POST' && url.pathname === '/api/open') { await this.open(url.searchParams.get('bookId') || undefined); this.send(response, 200, { status: 'ok' }); return; }
            this.send(response, 404, { error: 'Picker endpoint not found' });
        } catch (error) { this.send(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
    }

    private authorized(request: IncomingMessage): boolean {
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
        return Boolean(token && this.host.settings.pickerToken && token === this.host.settings.pickerToken);
    }
    private async body(request: IncomingMessage): Promise<Record<string, unknown>> {
        const declaredLength = Number(request.headers['content-length'] || 0);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) throw new Error('Picker request is too large');
        const chunks: Buffer[] = [];
        let received = 0;
        for await (const chunk of request) {
            if (!Buffer.isBuffer(chunk)) throw new Error('Invalid Picker request body');
            received += chunk.length;
            if (received > MAX_REQUEST_BYTES) throw new Error('Picker request is too large');
            chunks.push(chunk);
        }
        if (!chunks.length) return {};
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid request body');
        return parsed as Record<string, unknown>;
    }
    private send(response: ServerResponse, status: number, payload: unknown): void { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(payload)); }
    private async pair(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const body = await this.body(request);
        const pairingCode = await this.ensurePairingCode();
        if (body.code !== pairingCode) { this.send(response, 401, { error: 'Pairing code is invalid' }); return; }
        this.host.settings.pickerToken = randomBytes(32).toString('base64url');
        await this.host.saveSettings();
        this.host.refresh();
        this.send(response, 200, { token: this.host.settings.pickerToken, workspace: 'obsidian' });
    }
    private async findBook(id?: string): Promise<Book> {
        const library = await this.host.store.load();
        const book = library.books.find(candidate => candidate.id === (id || this.host.settings.bookId) && !candidate.archived);
        if (!book) throw new Error('Book not found');
        return book;
    }
    private async books(response: ServerResponse): Promise<void> {
        const library = await this.host.store.load();
        const books = library.books.filter(book => !book.archived).map(book => ({ id: book.id, name: book.title }));
        this.send(response, 200, { activeBookId: this.host.settings.bookId || books[0]?.id, books });
    }
    private async createBook(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const body = await this.body(request);
        const book = await this.host.store.createBook(typeof body.name === 'string' ? body.name : '', this.host.settings.language);
        this.host.settings.bookId = book.id; await this.host.saveSettings(); this.host.refresh();
        this.send(response, 200, { book: { id: book.id, name: book.title } });
    }
    private async addContext(book: Book, entry: Entry, context: string | undefined): Promise<void> {
        if (context?.trim()) await this.host.store.updateNote(book, entry.id, context.trim());
    }
    private async savePick(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const payload = pickerPayload(await this.body(request));
        const book = await this.findBook(payload.bookId);
        const metadata = { captureMethod: 'picker' as const, sourceUrl: payload.sourceUrl, sourceTitle: payload.sourceTitle, capturedAt: payload.pickedAt };
        const title = titleFor(payload);
        const picker = pickerFor(payload);
        let entry: Entry;
        if (payload.modality === 'image' && payload.contentBase64) {
            const bytes = Buffer.from(payload.contentBase64, 'base64');
            if (!bytes.byteLength) throw new Error('Picker image has no bytes');
            entry = await this.host.store.importFile(book, `${safeName(title)}.${extensionForMime(payload.contentMimeType)}`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), this.host.settings.language, metadata, picker);
        } else if (payload.modality === 'text') {
            entry = await this.host.store.addText(book, title, payload.contentText || '', payload.sourceUrl, this.host.settings.language, picker);
        } else if (payload.modality === 'post' || payload.modality === 'conversation' || payload.modality === 'link') {
            const text = markdownFor(payload);
            entry = await this.host.store.importFile(book, `${safeName(title)}.md`, new TextEncoder().encode(text).buffer, this.host.settings.language, metadata, picker);
        } else {
            const url = payload.contentUrl || payload.sourceUrl;
            entry = await this.host.store.addLink(book, title, url, this.host.settings.language, picker);
        }
        await this.addContext(book, entry, payload.userNote);
        this.host.refresh();
        this.send(response, 200, { status: 'saved', sourceItemId: entry.id, resourceId: entry.id, pickId: entry.id });
    }
    private async sources(response: ServerResponse, bookId?: string): Promise<void> {
        const book = await this.findBook(bookId);
        const { items } = await this.host.store.resolve(book);
        this.send(response, 200, { items: items.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0)).map(item => ({ id: item.entry.id, itemTitle: item.title, contentText: item.body, contentUrl: item.url, modality: item.kind, sourceOrigin: item.sourceOrigin || (item.url ? new URL(item.url).host : ''), pickedAt: item.pickedAt || (item.modifiedAt ? new Date(item.modifiedAt).toISOString() : new Date().toISOString()), thumbnailUrl: item.thumbnailUrl, faviconUrl: item.faviconUrl })) });
    }
    private async note(request: IncomingMessage, response: ServerResponse, id: string, bookId?: string): Promise<void> { const body = await this.body(request); const book = await this.findBook(bookId); await this.host.store.updateNote(book, id, typeof body.note === 'string' ? body.note : ''); this.host.refresh(); this.send(response, 200, { status: 'ok' }); }
    private async open(bookId?: string): Promise<void> { if (bookId) { await this.findBook(bookId); this.host.settings.bookId = bookId; await this.host.saveSettings(); } await this.host.openView(); }
}
