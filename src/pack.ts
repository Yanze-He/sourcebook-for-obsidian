import { Resolved, VaultIO, MAX_PACK_BYTES, id, safeName, SNAPSHOTS_DIR, ROOT, DocumentLanguage } from './core';

export interface ProjectContext {
    path: string;
    body: string;
}

export interface PackItem {
    ref: string;
    title: string;
    entryId: string;
    bookPath: string;
    note: string;
    url: string;
    kind: string;
    status: 'file' | 'text' | 'link' | 'missing';
    originalPath?: string;
    body?: string;
    bytes?: number;
    snapshotName?: string;
}

export interface PackPlan {
    id: string;
    bookTitle: string;
    task: string;
    project?: ProjectContext;
    createdAt: string;
    language: DocumentLanguage;
    items: PackItem[];
    warnings: string[];
}

export interface SnapshotResult {
    directory: string;
    prompt: string;
    files: string[];
    manifest: PackPlan;
}

export function planPack(items: Resolved[], bookTitle: string, task: string, project?: ProjectContext, language: DocumentLanguage = 'en'): PackPlan {
    if (!items.length && !project) throw new Error('Select at least one source or project note');
    if (items.reduce((total, item) => total + item.fileSize, 0) > MAX_PACK_BYTES) throw new Error('Selected files exceed 100 MB; select fewer files');
    const warnings: string[] = [];
    const rows: PackItem[] = items.map((item, index) => {
        const ref = String(index + 1);
        const row: PackItem = {
            ref,
            title: item.title,
            entryId: item.entry.id,
            bookPath: item.bookPath,
            note: item.entry.note,
            url: item.url,
            kind: item.kind,
            status: 'link'
        };
        if (item.filePath) {
            row.status = 'file';
            row.originalPath = item.filePath;
            row.bytes = item.fileSize;
            row.snapshotName = `${ref}-${safeName(item.filePath.split('/').pop() || 'file')}`;
            if (item.body) row.body = item.body;
        } else if (item.kind === 'text') {
            row.status = 'text';
            row.body = item.body;
            row.snapshotName = `${ref}-${safeName(item.title)}.txt`;
        } else if (item.missing) {
            row.status = 'missing';
            warnings.push(`${ref}: material file is missing; only its Book context remains`);
        } else if (!item.url) {
            row.status = 'missing';
            warnings.push(`${ref}: no local file or usable link`);
        }
        if (['file', 'video', 'audio'].includes(item.kind)) warnings.push(`${ref}: file/link supplied; no OCR, transcription or content analysis performed`);
        return row;
    });
    return { id: id(), bookTitle, task: task.trim(), project, createdAt: new Date().toISOString(), language, items: rows, warnings };
}

export function promptFor(plan: PackPlan): string {
    const zh = plan.language === 'zh';
    const files = plan.items.filter(item => item.status === 'file');
    const links = plan.items.filter(item => item.status === 'link');
    const texts = plan.items.filter(item => item.status === 'text');
    const lines = [zh ? '请将上传的文件、以下链接及其关联 Context 作为任务上下文。' : 'Use the uploaded files, links below, and any included context as task context.'];
    if (plan.task) lines.push(zh ? `## 任务\n\n${plan.task}` : `## Task\n\n${plan.task}`);
    if (plan.project) {
        lines.push(zh
            ? `## 项目笔记\n\n路径：${plan.project.path}\n\n${plan.project.body.trim() || '（空笔记）'}`
            : `## Project note\n\nPath: ${plan.project.path}\n\n${plan.project.body.trim() || '(empty note)'}`);
    }
    const uploaded = [
        ...files.map(item => ({ item, name: item.originalPath?.split('/').pop() || item.title })),
        ...texts.map(item => ({ item, name: handoffTextFileName(item) }))
    ];
    const withContext = (summary: string, context: string): string => context.trim() ? `${summary} ${context.trim()}` : summary;
    if (uploaded.length) lines.push([zh ? '## 上传的文件' : '## Uploaded files', ...uploaded.map(({ item, name }) => withContext(`${item.ref}. \`${name}\``, item.note))].join('\n\n'));
    if (links.length) lines.push([zh ? '## 链接' : '## Links', ...links.map(item => withContext(`${item.ref}. ${item.url}`, item.note))].join('\n\n'));
    const unavailable = plan.items.filter(item => item.status === 'missing');
    if (unavailable.length) lines.push([zh ? '## 不可用素材' : '## Unavailable sources', ...unavailable.map(item => `${item.ref}. ${item.title}`)].join('\n\n'));
    return lines.join('\n\n') + '\n';
}

export function attachmentPaths(plan: PackPlan): string[] {
    return [...new Set(plan.items.flatMap(item => item.status === 'file' && item.originalPath ? [item.originalPath] : []))];
}

export function handoffTextFileName(item: Pick<PackItem, 'ref' | 'title'>): string {
    return `${item.ref}-${safeName(item.title || 'text')}.txt`;
}

export function handoffFileCount(plan: PackPlan): number {
    return attachmentPaths(plan).length + plan.items.filter(item => item.status === 'text').length;
}

export async function saveSnapshot(io: VaultIO, plan: PackPlan): Promise<SnapshotResult> {
    const stamp = plan.createdAt.replace(/[:.]/g, '-').replace('T', '-').replace('Z', '');
    const directory = `${SNAPSHOTS_DIR}/${stamp}-${safeName(plan.bookTitle)}-${plan.id.slice(0, 6)}`;
    for (const path of [ROOT, SNAPSHOTS_DIR, directory, `${directory}/materials`]) if (!io.exists(path)) await io.mkdir(path);
    const files: string[] = [];
    let total = 0;
    try {
        for (const item of plan.items) {
            if (!item.snapshotName) continue;
            const target = `${directory}/materials/${item.snapshotName}`;
            if (item.status === 'file' && item.originalPath) {
                const bytes = await io.readBinary(item.originalPath);
                total += bytes.byteLength;
                if (total > MAX_PACK_BYTES) throw new Error('Files changed or snapshot exceeds 100 MB');
                await io.createBinary(target, bytes);
            } else if (item.status === 'text') {
                const text = item.body || '';
                total += new TextEncoder().encode(text).length;
                if (total > MAX_PACK_BYTES) throw new Error('Snapshot exceeds 100 MB');
                await io.create(target, text);
            } else continue;
            files.push(target);
        }
        const prompt = promptFor(plan);
        await io.create(`${directory}/prompt.md`, prompt);
        await io.create(`${directory}/manifest.json`, JSON.stringify({ ...plan, complete: true }, null, 2) + '\n');
        return { directory, prompt, files, manifest: plan };
    } catch (error) {
        await io.create(`${directory}/INCOMPLETE.txt`, plan.language === 'zh' ? '快照失败。此文件夹中的内容不完整，请重新创建快照。\n' : 'Snapshot failed. Files in this folder are incomplete. Retry with a new snapshot.\n').catch(() => undefined);
        throw error;
    }
}
