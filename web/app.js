const $ = selector => document.querySelector(selector);
let catalog = { members: [], images: [] };
let owner = '';
let view = 'grid';
const collator = new Intl.Collator('zh-CN', { numeric: true });
const size = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function selectOwner(name) {
  owner = name;
  $('#all-members').classList.toggle('active', !owner);
  document.querySelectorAll('.member-button').forEach(button => button.classList.toggle('active', button.dataset.owner === owner));
  $('#breadcrumb').textContent = owner || '全部图片';
  $('#page-title').textContent = owner ? `${owner} 的图片分册` : '所有人的图片，\n收在一起。';
  $('#page-description').textContent = owner ? '一个专属分册，收藏每一张值得留下的图片。' : '按成员整理的共享图片资产，让每一次查找都有迹可循。';
  render();
}
function preview(item) {
  $('#preview-owner').textContent = `${item.owner} / 图片预览`;
  $('#preview-title').textContent = item.name;
  $('#preview-meta').textContent = `${item.format} · ${size(item.bytes)} · ${item.sequence || '未编号'}`;
  $('#preview-path').textContent = item.path;
  $('#preview-image').src = item.url;
  $('#preview-image').alt = item.name;
  $('#download').href = item.url;
  $('#download').download = item.filename;
  $('#copy-path').textContent = '复制路径';
  $('#preview').showModal();
}
function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const images = catalog.images.filter(item => (!owner || item.owner === owner) && `${item.name} ${item.owner} ${item.filename}`.toLocaleLowerCase().includes(query));
  images.sort((a, b) => ($('#sort').value === 'owner' ? collator.compare(a.owner, b.owner) : 0) || collator.compare(a.name, b.name) || collator.compare(a.filename, b.filename));
  $('#result-count').textContent = `${owner || '全部收藏'} · ${images.length} 张图片`;
  $('#empty').hidden = images.length > 0;
  const gallery = $('#gallery');
  gallery.replaceChildren();
  gallery.className = view === 'grid' ? 'gallery' : 'catalog-table';
  if (view === 'list' && images.length) {
    const table = element('table');
    const head = element('thead');
    const headRow = element('tr');
    ['图片名称', '所属分册', '格式 / 大小', '调用路径'].forEach(text => headRow.append(element('th', '', text)));
    head.append(headRow); table.append(head);
    const body = element('tbody');
    for (const item of images) {
      const row = element('tr');
      const nameCell = element('td');
      const button = element('button', 'table-preview', item.name);
      button.addEventListener('click', () => preview(item)); nameCell.append(button);
      row.append(nameCell, element('td', '', item.owner), element('td', '', `${item.format} · ${size(item.bytes)}`), element('td', 'path-cell', item.path));
      body.append(row);
    }
    table.append(body); gallery.append(table); return;
  }
  for (const item of images) {
    const card = element('button', 'image-card');
    card.setAttribute('aria-label', `预览 ${item.owner} 的 ${item.name}`);
    const frame = element('div', 'image-frame');
    const img = element('img'); img.src = item.url; img.alt = item.name; img.loading = 'lazy';
    img.addEventListener('error', () => { frame.classList.add('image-error'); img.alt = '图片读取失败，请检查原文件'; });
    frame.append(img, element('span', 'format-badge', item.format), element('span', 'zoom-hint', '查看原图 ↗'));
    const info = element('div', 'card-info');
    info.append(element('h2', '', item.name));
    const meta = element('div', 'card-meta');
    meta.append(element('span', 'owner-tag', item.owner), element('span', '', `${size(item.bytes)} · ${item.sequence}`));
    info.append(meta); card.append(frame, info);
    card.addEventListener('click', () => preview(item)); gallery.append(card);
  }
}
async function load() {
  $('#refresh').disabled = true;
  $('#error').hidden = true;
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('读取失败');
    catalog = await response.json();
    $('#all-count').textContent = catalog.images.length;
    $('#member-count').textContent = catalog.members.length;
    $('#members').replaceChildren();
    for (const [index, member] of catalog.members.entries()) {
      const button = element('button', 'nav-item member-button'); button.dataset.owner = member.name;
      const avatar = element('span', `avatar avatar-${index % 4}`, [...member.name][0].toUpperCase());
      button.append(avatar, element('span', 'member-name', member.name), element('span', 'count', member.count));
      button.addEventListener('click', () => selectOwner(member.name)); $('#members').append(button);
    }
    if (!catalog.members.some(member => member.name === owner)) owner = '';
    selectOwner(owner);
  } catch {
    $('#result-count').textContent = '图片库暂时无法读取';
    $('#error').textContent = '无法读取图片库。请确认本地服务正在运行，然后点击“刷新图片”重试。';
    $('#error').hidden = false;
  } finally { $('#refresh').disabled = false; }
}
$('#all-members').addEventListener('click', () => selectOwner(''));
$('#search').addEventListener('input', render);
$('#sort').addEventListener('change', render);
$('#refresh').addEventListener('click', load);
for (const mode of ['grid', 'list']) {
  $(`#${mode}-view`).addEventListener('click', () => {
    view = mode;
    for (const other of ['grid', 'list']) { $(`#${other}-view`).classList.toggle('selected', other === mode); $(`#${other}-view`).setAttribute('aria-pressed', String(other === mode)); }
    render();
  });
}
$('#guide-button').addEventListener('click', () => $('#guide').showModal());
for (const name of ['preview', 'guide']) {
  $(`#close-${name}`).addEventListener('click', () => $(`#${name}`).close());
  $(`#${name}`).addEventListener('click', event => { if (event.target === $(`#${name}`)) { const box = event.target.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close(); } });
}
$('#copy-path').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#preview-path').textContent); $('#copy-path').textContent = '已复制 ✓'; }
  catch { $('#copy-path').textContent = '请选中下方路径复制'; }
});
load();
