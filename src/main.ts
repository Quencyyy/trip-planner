import './style.css';
import { h, mount } from './dom';
import { clearDirty, isDirty, renderEditHome, renderEditor, renderSettings } from './edit';
import { renderHome, renderTrip } from './view';

const root = document.getElementById('app')!;
let current = location.hash;

async function route(): Promise<void> {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);
  try {
    if (parts[0] === 't' && parts[1]) await renderTrip(root, parts[1], parts[2] === 'today' ? 'today' : parts[2] === 'book' ? 'book' : 'all');
    else if (parts[0] === 'edit' && parts[1]) await renderEditor(root, parts[1]);
    else if (parts[0] === 'edit') await renderEditHome(root);
    else if (parts[0] === 'settings') renderSettings(root);
    else await renderHome(root);
  } catch (e) {
    mount(root,
      h('header', { class: 'top' }, h('a', { class: 'back', href: '#/' }, '‹'), h('div', { class: 'top-text' }, h('h1', {}, '讀取失敗'))),
      h('p', { class: 'empty' }, e instanceof Error ? e.message : String(e)),
      h('footer', { class: 'foot' }, h('a', { href: '#/' }, '回到列表'), '　', h('a', { href: '#/settings' }, '設定')),
    );
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
