import './style.css';
import { h, mount } from './dom';
import { clearDirty, isDirty, renderEditHome, renderEditor, renderSettings } from './edit';
import { renderHome, renderTrip, type TripTab } from './view';

const tabOf = (p?: string): TripTab => (p === 'today' || p === 'book' || p === 'money' ? p : 'all');

const app = document.getElementById('app')!;
let current = location.hash;
let seq = 0;

async function route(): Promise<void> {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);
  // 每次切頁畫在新的容器裡；比較慢回來的舊頁面不會蓋掉新頁面
  const my = ++seq;
  const root = document.createElement('div');
  root.className = 'view';
  const show = () => {
    if (my === seq) app.replaceChildren(root);
  };
  try {
    if (parts[0] === 't' && parts[1]) await renderTrip(root, parts[1], tabOf(parts[2]));
    else if (parts[0] === 'edit' && parts[1]) await renderEditor(root, parts[1]);
    else if (parts[0] === 'edit') await renderEditHome(root);
    else if (parts[0] === 'settings') renderSettings(root);
    else await renderHome(root);
    show();
  } catch (e) {
    mount(root,
      h('header', { class: 'top' }, h('a', { class: 'back', href: '#/' }, '‹'), h('div', { class: 'top-text' }, h('h1', {}, '讀取失敗'))),
      h('p', { class: 'empty' }, e instanceof Error ? e.message : String(e)),
      h('footer', { class: 'foot' }, h('a', { href: '#/' }, '回到列表'), '　', h('a', { href: '#/settings' }, '設定')),
    );
    show();
  }
}

window.addEventListener('hashchange', () => {
  if (isDirty() && location.hash !== current) {
    if (!confirm('有尚未儲存的變更，確定離開？')) {
      history.replaceState(null, '', current || '#/');
      return;
    }
    clearDirty();
  }
  current = location.hash;
  void route();
});

window.addEventListener('beforeunload', (e) => {
  if (isDirty()) e.preventDefault();
});

void route();
