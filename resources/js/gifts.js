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

// Simple in-memory cache for gifts to avoid extra network roundtrips
const giftsCache = new Map();

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
  if (!gifts || gifts.length === 0) {
    container.innerHTML = `<div class="coming-soon"><h3>Coming Soon...</h3></div>`;
    return;
  }
  container.innerHTML = `
    <table class="gifts-table" aria-label="Gift registry">
      <thead>
        <tr>
          <th>Item</th>
          <th>Description</th>
          <th>Price</th>
          <th>Available</th>
          <th>Link</th>
          <th>Quantity</th>
          <th>Reserve</th>
        </tr>
      </thead>
      <tbody id="gifts-table-body"></tbody>
    </table>
  `;
  const body = $('gifts-table-body');
  if (!body) return;
  body.innerHTML = '';
  gifts.forEach(g => {
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
        <input class="reserve-qty" type="number" min="1" value="1" ${available <= 0 ? 'disabled' : ''} />
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
}

  function onBuy(e){
    const btn = e.currentTarget;
    const url = btn.dataset.href;
    if (url) window.open(url, '_blank', 'noopener');
  }
function escapeHtml(s){ return s ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }

async function onReserve(e){
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const row = btn.closest('tr');
  if (!id || !row) return;
  const qtyInput = row.querySelector('.reserve-qty');
  const feedback = row.querySelector('.reserve-feedback');
  const qty = Number(qtyInput?.value) || 1;
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
      if (qtyInput) qtyInput.max = Math.max(1, json.remaining);
      if (json.remaining <= 0) {
        btn.disabled = true;
        if (qtyInput) qtyInput.disabled = true;
      }
    } else if (res.status === 409) {
      if (feedback) feedback.textContent = `Not enough quantity available (remaining: ${json.available})`;
    } else {
      if (feedback) feedback.textContent = json.error || 'Reservation failed';
    }
  } catch (err) {
    console.error(err);
    if (feedback) feedback.textContent = 'Network error';
  }
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
