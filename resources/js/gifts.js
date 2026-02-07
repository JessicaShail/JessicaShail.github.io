const GIFT_API_BASE = '/.netlify/functions';

const API_BASE = '/.netlify/functions';

// Registry enabled is read from server (prefers Netlify env var). We fetch it at init.
async function fetchRegistryFlag(){
  try {
    const res = await fetch(`${API_BASE}/get-registry-flag`);
    if (!res.ok) return { enabled: false };
    const json = await res.json();
    return { enabled: !!json.enabled, source: json.source };
  } catch (err) {
    console.error('Failed to fetch registry flag', err);
    return { enabled: false };
  }
}

const $ = (id) => document.getElementById(id);

let pendingReserve = null;

// Simple in-memory cache for gifts to avoid extra network roundtrips
const giftsCache = new Map();
let currentSort = { key: null, dir: 'asc' };

async function fetchGifts() {
  const res = await fetch(`${GIFT_API_BASE}/get-gifts`);
  const json = await res.json();
  return json.gifts || [];
}

function renderLoading(){
  const container = $('gifts-list');
  if (!container) return;
  container.innerHTML = `<div class="gifts-loading" aria-busy="true" aria-live="polite"><div class="spinner" role="status" aria-hidden="true"></div><div class="loading-text">Loading registry…</div></div>`;
}

function renderGifts(gifts) {
  const container = $('gifts-list');
  if (!container) return;
  const visibleGifts = (gifts || []).filter(g => ((g.quantity || 0) - (g.reserved_count || 0)) > 0);
  if (!visibleGifts || visibleGifts.length === 0) {
    container.innerHTML = `<div class="coming-soon"><h3>Coming Soon...</h3></div>`;
    return;
  }
  container.innerHTML = `
    <table class="gifts-table" aria-label="Gift registry">
      <thead>
        <tr>
          <th class="sortable" data-sort="title" role="button" aria-sort="none" tabindex="0">Item</th>
          <th class="col-desc sortable" data-sort="description" role="button" aria-sort="none" tabindex="0">Description</th>
          <th class="sortable" data-sort="price" role="button" aria-sort="none" tabindex="0">Price</th>
          <th class="sortable" data-sort="available" role="button" aria-sort="none" tabindex="0">Available</th>
          <th class="sortable" data-sort="purchase" role="button" aria-sort="none" tabindex="0">Link</th>
          <th>Reserve</th>
        </tr>
      </thead>
      <tbody id="gifts-table-body"></tbody>
    </table>
  `;
  const body = $('gifts-table-body');
  if (!body) return;
  body.innerHTML = '';
  const sorted = sortGifts(visibleGifts);
  sorted.forEach(g => {
    // cache basic gift info for instant UI
    giftsCache.set(g.id, g);
    const row = document.createElement('tr');
    const available = (g.quantity || 0) - (g.reserved_count || 0);
    row.innerHTML = `
      <td class="gift-title">${escapeHtml(g.title)}</td>
      <td class="gift-desc">${escapeHtml(g.description || '')}</td>
        <td class="gift-price">${g.price ? ('$' + Number(g.price).toFixed(2)) : ''}</td>
        <td class="gift-qty" data-id="${g.id}">${available}</td>
      <td class="gift-link">
          ${g.purchase_url ? `<button type="button" class="buy-btn btn btn-secondary" data-href="${g.purchase_url}">View</button>` : ''}
      </td>
      <td>
        <button data-id="${g.id}" class="reserve-btn btn btn-primary" ${available <= 0 ? 'disabled' : ''}>Reserve</button>
        <div class="reserve-feedback" role="status"></div>
      </td>
    `;
    body.appendChild(row);
  });
    container.querySelectorAll('.reserve-btn').forEach(btn => btn.addEventListener('click', onReserve));
    container.querySelectorAll('.buy-btn').forEach(btn => btn.addEventListener('click', onBuy));
    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => onSort(th.dataset.sort));
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(th.dataset.sort); } });
    });
    updateSortIndicators(container);
}

  function onBuy(e){
    const btn = e.currentTarget;
    const url = btn.dataset.href;
    if (url) window.open(url, '_blank', 'noopener');
  }
function escapeHtml(s){ return s ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }

function onSort(key){
  if (!key) return;
  if (currentSort.key === key) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort = { key, dir: 'asc' };
  }
  const gifts = Array.from(giftsCache.values());
  renderGifts(gifts);
}

function updateSortIndicators(container){
  const headers = container.querySelectorAll('th.sortable');
  headers.forEach(h => {
    const isActive = h.dataset.sort === currentSort.key;
    h.setAttribute('aria-sort', isActive ? (currentSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

function sortGifts(gifts){
  if (!currentSort.key) return gifts;
  const dir = currentSort.dir === 'asc' ? 1 : -1;
  const key = currentSort.key;
  const getVal = (g) => {
    switch (key) {
      case 'title': return (g.title || '').toLowerCase();
      case 'description': return (g.description || '').toLowerCase();
      case 'price': return g.price == null ? Number.POSITIVE_INFINITY : Number(g.price);
      case 'available': return (g.quantity || 0) - (g.reserved_count || 0);
      case 'purchase': return g.purchase_url ? 1 : 0;
      default: return '';
    }
  };
  return [...gifts].sort((a, b) => {
    const av = getVal(a);
    const bv = getVal(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

async function onReserve(e){
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const row = btn.closest('tr');
  if (!id || !row) return;
  const qtyInput = row.querySelector('.reserve-qty');
  const qty = qtyInput ? (Number(qtyInput.value) || 1) : 1;
  const gift = giftsCache.get(Number(id)) || giftsCache.get(id) || {};
  openReserveConfirm({ id, qty, row, btn, gift });
}

function openReserveConfirm(data){
  pendingReserve = data;
  const modal = ensureReserveModal();
  const text = $('reserve-confirm-text');
  const link = $('reserve-confirm-link');
  if (text) {
    const title = data.gift?.title ? `“${data.gift.title}”` : 'this item';
    text.textContent = `Are you sure you want to reserve ${title}?`;
  }
  if (link) {
    if (data.gift?.purchase_url) {
      link.href = data.gift.purchase_url;
      link.style.display = '';
    } else {
      link.style.display = 'none';
    }
  }
  if (modal) modal.hidden = false;
}

function closeReserveConfirm(){
  const modal = $('reserve-confirm');
  if (modal) modal.hidden = true;
  pendingReserve = null;
}

async function performReserve(){
  if (!pendingReserve) return;
  const { id, qty, row, btn } = pendingReserve;
  const feedback = row.querySelector('.reserve-feedback');
  if (feedback) feedback.textContent = 'Processing...';
  try {
    const res = await fetch(`${GIFT_API_BASE}/reserve-gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId: id, qty })
    });
    const json = await res.json();
    if (res.status === 201) {
      if (feedback) feedback.textContent = 'Reserved — thank you!';
      const qtyCell = row.querySelector('.gift-qty');
      if (qtyCell) qtyCell.textContent = String(json.remaining);
      if (json.remaining <= 0) {
        btn.disabled = true;
      }
    } else if (res.status === 409) {
      if (feedback) feedback.textContent = `Not enough quantity available (remaining: ${json.available})`;
    } else {
      if (feedback) feedback.textContent = json.error || 'Reservation failed';
    }
  } catch (err) {
    console.error(err);
    if (feedback) feedback.textContent = 'Network error';
  } finally {
    closeReserveConfirm();
  }
}

$('reserve-confirm-no')?.addEventListener('click', closeReserveConfirm);
$('reserve-confirm-yes')?.addEventListener('click', performReserve);

function ensureReserveModal(){
  let modal = $('reserve-confirm');
  if (modal) return modal;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="reserve-confirm" class="modal" hidden>
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="reserve-confirm-title">
        <h2 id="reserve-confirm-title">Confirm Reservation</h2>
        <p id="reserve-confirm-text">Are you sure you want to reserve this item?</p>
        <a id="reserve-confirm-link" href="#" target="_blank" rel="noopener" class="btn btn-secondary" style="display:none;">View Item</a>
        <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:1rem;">
          <button id="reserve-confirm-no" class="btn btn-secondary" type="button">No</button>
          <button id="reserve-confirm-yes" class="btn btn-primary" type="button">Yes</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
  $('reserve-confirm-no')?.addEventListener('click', closeReserveConfirm);
  $('reserve-confirm-yes')?.addEventListener('click', performReserve);
  modal = $('reserve-confirm');
  return modal;
}

async function load(){
  const container = $('gifts-list');
  const blurb = $('registry-blurb');

  // Determine flag from server (this will prefer any Netlify env var when present)
  renderLoading();
  const flag = await fetchRegistryFlag();
  if (!flag.enabled) {
    if (blurb) blurb.hidden = true;
    // skip DB call and show Coming Soon
    renderGifts([]);
    return;
  }
  if (blurb) blurb.hidden = false;

  try {
    // flag enabled -> fetch and render
    renderLoading();
    const gifts = await fetchGifts();
    renderGifts(gifts);
  } catch (err) {
    console.error('Failed to load gifts', err);
    if (container) container.innerHTML = `<div class="coming-soon"><h3>Coming Soon...</h3></div>`;
  }
}

// expose init function so the SPA can call it when showing the registry
export async function initGifts(){
  await load();
}

// Auto-init on standalone registry page
if (typeof window !== 'undefined') {
  const isStandalone = !document.querySelector('.content-section');
  if (isStandalone) {
    initGifts();
  }
}
