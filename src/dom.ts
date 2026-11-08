// 小型 DOM 輔助：一律用 textContent，不用 innerHTML 塞資料

type Attrs = Record<string, string | boolean | number | EventListener | undefined | null>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function toast(msg: string, kind: 'ok' | 'err' = 'ok'): void {
  const el = h('div', { class: `toast toast-${kind}`, role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.classList.add('toast-hide'), kind === 'err' ? 6000 : 3000);
  setTimeout(() => el.remove(), kind === 'err' ? 6500 : 3500);
}

/** 換掉 root 的內容，略過 null／false */
export function mount(root: HTMLElement, ...children: Child[]): void {
  root.replaceChildren(...children.filter((c): c is Node | string => c != null && c !== false));
}
