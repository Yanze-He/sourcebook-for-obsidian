import { Child, Fragment, h } from './jsx';

export type IconName =
    | 'search' | 'filter' | 'star' | 'grid' | 'columns' | 'list' | 'file-plus' | 'upload' | 'link'
    | 'file-text' | 'settings' | 'refresh' | 'chevron-down' | 'more' | 'check' | 'trash' | 'message'
    | 'arrow-left-right' | 'package' | 'x' | 'pencil' | 'hard-drive' | 'external-link' | 'help'
    | 'copy' | 'languages' | 'plus' | 'puzzle' | 'archive' | 'book-open' | 'folder-open' | 'send' | 'eye'
    | 'image' | 'video' | 'audio' | 'file' | 'text' | 'info' | 'circle-check' | 'clock' | 'panel-top' | 'play' | 'pause';

const paths: Record<IconName, Child> = {
    search: <><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></>,
    filter: <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>,
    star: <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
    columns: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></>,
    list: <><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></>,
    'file-plus': <><path d="M11.35 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5.35"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M14 19h6"/><path d="M17 16v6"/></>,
    upload: <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M12 12v6"/><path d="m15 15-3-3-3 3"/></>,
    link: <><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></>,
    'file-text': <><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    settings: <><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></>,
    'chevron-down': <path d="m6 9 6 6 6-6"/>,
    more: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    message: <path d="M4 5h16v12H8l-4 4Z"/>,
    'arrow-left-right': <><path d="M7 7h13l-3-3M17 17H4l3 3"/><path d="m20 7-3 3M4 17l3-3"/></>,
    package: <><path d="m12 3 8 4-8 4-8-4Z"/><path d="m4 7 8 4v10l8-4V7M4 7v10l8 4"/></>,
    x: <path d="M6 6l12 12M18 6 6 18"/>,
    pencil: <><path d="m4 20 4-1 10-10-3-3L5 16Z"/><path d="m13 7 3 3"/></>,
    'hard-drive': <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h.01M11 15h6"/></>,
    'external-link': <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-1 .7-1.5 1.1-1.5 2.2M12 17h.01"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></>,
    languages: <><path d="M4 5h8M8 3v2M6 5c.5 4 2.5 6 6 7M11 5c-.6 3.7-2.6 6.3-6 8"/><path d="m15 19 3-8 3 8M16 16h4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    puzzle: <path d="M15.39 4.39a1 1 0 0 0-1.39 0L12.5 5.89a1 1 0 0 1-1.41 0L9.59 4.39a1 1 0 0 0-1.41 1.41L9.68 7.3a1 1 0 0 1 0 1.41L8.18 10.2a1 1 0 0 0 1.41 1.41l1.5-1.5a1 1 0 0 1 1.41 0l1.5 1.5a1 1 0 0 0 1.41-1.41l-1.5-1.49a1 1 0 0 1 0-1.41l1.5-1.5a1 1 0 0 0-.02-1.41ZM5 13.5V19a2 2 0 0 0 2 2h5.5M19 11V5a2 2 0 0 0-2-2h-5.5M13.5 19H19a2 2 0 0 0 2-2v-5.5M10.5 5H5a2 2 0 0 0-2 2v5.5"/>,
    archive: <><path d="M3 6h18v4H3Z"/><path d="M5 10v10h14V10M10 14h4"/></>,
    'book-open': <><path d="M3 5h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-4H3Z"/><path d="M21 5h-6a3 3 0 0 0-3 3v13a4 4 0 0 1 4-4h5Z"/></>,
    'folder-open': <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>,
    send: <><path d="m3 11 18-8-8 18-2-8Z"/><path d="m11 13 5-5"/></>,
    eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m21 15-5-5L5 20"/></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2Z"/></>,
    audio: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    file: <><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5"/></>,
    text: <><path d="M4 6h16M8 6v14M16 6v14M6 20h4M14 20h4"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    'circle-check': <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    'panel-top': <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></>
    ,play: <path d="m8 5 11 7-11 7Z"/>
    ,pause: <><path d="M8 5v14"/><path d="M16 5v14"/></>
};

export function Icon({ name, size = 18, className = '', filled = false }: { name: IconName; size?: number; className?: string; filled?: boolean }): JSX.Element {
    return <svg aria-hidden="true" className={className} fill={filled ? 'currentColor' : 'none'} height={size} stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width={size}>{paths[name]}</svg>;
}

export function SourcebookMark({ size = 30 }: { size?: number }): JSX.Element {
    return <svg aria-hidden="true" className="sourcebook-mark" height={size} viewBox="0 0 256 256" width={size}><g fill="currentColor"><rect x="36" y="60" width="42" height="28" rx="5"/><rect x="36" y="105" width="42" height="28" rx="5"/><rect x="36" y="150" width="42" height="28" rx="5"/><rect x="66" y="36" width="166" height="166" rx="15"/><rect x="94" y="190" width="36" height="34" rx="6"/><rect x="168" y="190" width="36" height="34" rx="6"/></g><path d="m133 100 19 20-19 20" fill="none" stroke="var(--mark-eye,#fff)" stroke-linecap="round" stroke-linejoin="round" stroke-width="18"/><rect x="179" y="91" width="18" height="58" rx="9" fill="var(--mark-eye,#fff)"/></svg>;
}
