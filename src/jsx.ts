export type Primitive = string | number | boolean | null | undefined;
export type Child = Primitive | VNode | Node | Child[];
export type Component<P = Record<string, unknown>> = (props: P & { children?: Child }) => Child;
export type ElementType = string | Component<Record<string, unknown>>;
export interface VNode { type: ElementType; props: Record<string, unknown>; children: Child[]; }

export function h(type: ElementType, props: Record<string, unknown> | null, ...children: Child[]): VNode {
    return { type, props: props || {}, children };
}

export function Fragment(props: { children?: Child }): Child { return props.children ?? []; }

function flatten(children: Child[], output: Child[] = []): Child[] {
    for (const child of children) {
        if (Array.isArray(child)) flatten(child, output);
        else output.push(child);
    }
    return output;
}

const propertyNames = new Set(['value', 'checked', 'selected', 'disabled', 'readOnly', 'multiple', 'autofocus', 'autoFocus', 'open', 'muted', 'controls', 'loop', 'playsInline']);
const eventListeners = new WeakMap<Element, Map<string, EventListener>>();

function setProp(element: Element, key: string, value: unknown): void {
    if (key === 'children' || key === 'key' || value === undefined || value === null || value === false) return;
    if (key === 'className') { element.setAttribute('class', String(value)); return; }
    if (key === 'htmlFor') { element.setAttribute('for', String(value)); return; }
    if (key === 'style' && value && typeof value === 'object') {
        Object.assign((element as HTMLElement).style, value);
        return;
    }
    if (key === 'ref' && typeof value === 'function') { (value as (node: Element) => void)(element); return; }
    if (/^on[A-Z]/.test(key) && typeof value === 'function') {
        const event = key.slice(2).toLowerCase();
        element.addEventListener(event, value as EventListener);
        const listeners = eventListeners.get(element) || new Map<string, EventListener>();
        listeners.set(key, value as EventListener);
        eventListeners.set(element, listeners);
        return;
    }
    if (propertyNames.has(key)) {
        const target = element as unknown as Record<string, unknown>;
        target[key === 'autoFocus' ? 'autofocus' : key] = value;
        if (value === true) element.setAttribute(key === 'autoFocus' ? 'autofocus' : key.toLowerCase(), '');
        return;
    }
    if (value === true) { element.setAttribute(key, ''); return; }
    element.setAttribute(key, String(value));
}

const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'linearGradient', 'stop', 'ellipse']);

export function render(child: Child, container: HTMLElement): void {
    reconcileChildren(container, normalized(child), container.ownerDocument);
}

type Renderable = string | number | Node | VNode;

function normalized(child: Child): Renderable[] {
    if (child === null || child === undefined || child === false || child === true) return [];
    if (Array.isArray(child)) return child.flatMap(normalized);
    if (child instanceof Node || typeof child === 'string' || typeof child === 'number') return [child];
    if (typeof child.type === 'function') return normalized(child.type({ ...child.props, children: child.children }));
    return [child];
}

function isText(value: Renderable): value is string | number { return typeof value === 'string' || typeof value === 'number'; }

function removeProp(element: Element, key: string, value: unknown): void {
    if (key === 'children' || key === 'key') return;
    if (/^on[A-Z]/.test(key)) {
        const listeners = eventListeners.get(element);
        const listener = listeners?.get(key);
        if (listener) element.removeEventListener(key.slice(2).toLowerCase(), listener);
        listeners?.delete(key);
        return;
    }
    if (key === 'className') { element.removeAttribute('class'); return; }
    if (key === 'htmlFor') { element.removeAttribute('for'); return; }
    if (key === 'style' && value && typeof value === 'object') {
        for (const styleKey of Object.keys(value as Record<string, unknown>)) (element as HTMLElement).style.removeProperty(styleKey.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`));
        return;
    }
    if (propertyNames.has(key)) {
        const target = element as unknown as Record<string, unknown>;
        target[key === 'autoFocus' ? 'autofocus' : key] = key === 'value' ? '' : false;
    }
    element.removeAttribute(key === 'autoFocus' ? 'autofocus' : key.toLowerCase());
}

function patchProps(element: Element, previous: Record<string, unknown>, next: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(previous)) {
        if (!(key in next) || next[key] === undefined || next[key] === null || next[key] === false) removeProp(element, key, value);
    }
    for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'children' || key === 'key') continue;
        if (/^on[A-Z]/.test(key)) removeProp(element, key, previous[key]);
        // DOM inputs can change without a render (for example while typing). Always
        // resync their value during a render, even when the previous virtual value
        // happens to match the next one.
        if (previous[key] !== value || key === 'value' || /^on[A-Z]/.test(key) || (key === 'style' && value && typeof value === 'object')) setProp(element, key, value);
    }
}

function createNode(value: Renderable, documentRef: Document, svg = false): Node {
    if (isText(value)) return documentRef.createTextNode(String(value));
    if (value instanceof Node) return value;
    const tag = value.type as string;
    const nextSvg = svg || SVG_TAGS.has(tag);
    const element = nextSvg
        ? documentRef.createElementNS('http://www.w3.org/2000/svg', tag)
        : documentRef.createElement(tag);
    for (const [key, prop] of Object.entries(value.props)) setProp(element, key, prop);
    (element as Element & { __jsxProps?: Record<string, unknown> }).__jsxProps = value.props;
    reconcileChildren(element, normalized(value.children), documentRef, nextSvg);
    if (value.props.autoFocus === true) queueMicrotask(() => (element as HTMLElement).focus?.());
    return element;
}

function patchNode(parent: Node, oldNode: Node | undefined, value: Renderable, documentRef: Document, svg = false): Node {
    if (!oldNode) {
        const created = createNode(value, documentRef, svg);
        parent.appendChild(created);
        return created;
    }
    if (isText(value)) {
        if (oldNode.nodeType === Node.TEXT_NODE) {
            const text = String(value);
            if (oldNode.nodeValue !== text) oldNode.nodeValue = text;
            return oldNode;
        }
    } else if (value instanceof Node) {
        if (oldNode === value) return oldNode;
    } else if (oldNode.nodeType === 1 && (oldNode as Element).localName === value.type) {
        const elementSvg = svg || SVG_TAGS.has(value.type);
        const previous = (oldNode as Element & { __jsxProps?: Record<string, unknown> }).__jsxProps || {};
        patchProps(oldNode as Element, previous, value.props);
        (oldNode as Element & { __jsxProps?: Record<string, unknown> }).__jsxProps = value.props;
        reconcileChildren(oldNode, normalized(value.children), documentRef, elementSvg);
        return oldNode;
    }
    const replacement = createNode(value, documentRef, svg);
    parent.replaceChild(replacement, oldNode);
    return replacement;
}

function reconcileChildren(parent: Node, next: Renderable[], documentRef: Document, svg = false): void {
    const existing = Array.from(parent.childNodes);
    next.forEach((value, index) => patchNode(parent, existing[index], value, documentRef, svg));
    for (let index = existing.length - 1; index >= next.length; index--) existing[index]?.remove();
}

declare global {
    namespace JSX {
        interface IntrinsicElements { [name: string]: unknown; }
        interface Element extends VNode {}
        interface ElementChildrenAttribute { children: Record<string, never>; }
    }
}
