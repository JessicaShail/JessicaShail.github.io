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
  container.innerHTML = '';
  if (!gifts || gifts.length === 0) {
    container.innerHTML = `<div class="coming-soon"><h3>Coming Soon...</h3></div>`;
    return;
  }
  gifts.forEach(g => {
    // cache basic gift info for instant UI
    giftsCache.set(g.id, g);
    const card = document.createElement('div');
    card.className = 'gift-card';
    card.innerHTML = `
      <div class="gift-title">${escapeHtml(g.title)}</div>
      <div class="gift-price">${g.price ? ('$' + Number(g.price).toFixed(2)) : ''}</div>
      <div class="gift-qty">Available: ${g.quantity - g.reserved_count}</div>
      <div class="actions"><button data-id="${g.id}" class="gift-view btn btn-primary">View</button></div>
    `;
    container.appendChild(card);
  });
  container.querySelectorAll('.gift-view').forEach(btn => btn.addEventListener('click', onView));
}

function escapeHtml(s){ return s ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }

let currentGift = null;

// Autocomplete state for reserver name
let suggTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

function hideReserverSuggestions(){
  const box = $('reserverSuggestions'); if (!box) return;
  box.classList.remove('show');
  box.innerHTML = '';
  selectedSuggestionIndex = -1;
  currentSuggestions = [];
}

function showReserverSuggestions(items){
  const box = $('reserverSuggestions'); if (!box) return;
  if (!items || items.length === 0) { hideReserverSuggestions(); return; }
  box.innerHTML = items.map((g,i)=>{
    const partner = g.partner_name || g.partner || '';
    const details = partner ? partner : (g.email || '');
    // add role and aria-selected for better screen reader support
    return `<div class="suggestion-item" role="option" aria-selected="false" data-index="${i}"><div class="suggestion-name">${escapeHtml(g.guest_name)}</div><div class="suggestion-details">${escapeHtml(details)}</div></div>`;
  }).join('');
  box.classList.add('show');
  currentSuggestions = items;
  selectedSuggestionIndex = -1;
  // attach click handlers
  box.querySelectorAll('.suggestion-item').forEach(el=> el.addEventListener('click', (e)=>{
    const idx = Number(el.dataset.index);
    selectSuggestionByIndex(idx);
  }));
}

function selectSuggestionByIndex(i){
  if (!currentSuggestions[i]) return;
  const g = currentSuggestions[i];
  $('reserver-name').value = g.guest_name;
  // announce selection for screen readers
  const feedback = $('reserve-feedback');
  if (feedback) feedback.textContent = `Selected ${g.guest_name}`;
  hideReserverSuggestions();
}

function onView(e){
  const id = e.currentTarget.dataset.id;
  openModal(id);
}

async function openModal(id){
  // Show modal immediately with a loading state to reduce perceived latency
  currentGift = null;
  $('gift-title').textContent = 'Loading…';
  $('gift-desc').textContent = '';
  $('gift-price').textContent = '';
  $('gift-qty').textContent = '';
  $('reserve-qty').max = 1;
  $('reserve-qty').value = 1;
  $('reserver-name').value = '';
  $('reserve-feedback').textContent = '';
  // disable reserve until we know availability
  try { $('reserve-btn').disabled = true; } catch(e){}
  $('gift-modal').hidden = false;

  // If we have cached data, show it immediately while we refresh from the server
  const cached = giftsCache.get(id);
  if (cached) {
    currentGift = cached;
    $('gift-title').textContent = cached.title || 'Gift';
    $('gift-desc').textContent = cached.description || '';
    // show purchase link if available in cached data
    if (cached.purchase_url) {
      const a = $('gift-purchase');
      a.href = cached.purchase_url;
      a.style.display = '';
    } else {
      const a = $('gift-purchase'); if (a) a.style.display = 'none';
    }
    $('gift-price').textContent = cached.price ? '$' + Number(cached.price).toFixed(2) : '';
    const avail = (cached.quantity || 0) - (cached.reserved_count || 0);
    $('gift-qty').textContent = `Available: ${avail}`;
    $('reserve-qty').max = Math.max(1, avail);
    $('reserve-qty').value = Math.min(1, Math.max(1, $('reserve-qty').value));
    if (avail > 0) { try { $('reserve-btn').disabled = false; } catch(e){} }
  }

  // Fetch the authoritative gift details and update the modal when done
  try {
    const res = await fetch(`${GIFT_API_BASE}/get-gift?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const { gift } = await res.json();
      if (gift) {
        giftsCache.set(gift.id, gift);
        currentGift = gift;
        $('gift-title').textContent = gift.title || 'Gift';
        $('gift-desc').textContent = gift.description || '';
        // show purchase link if present
        if (gift.purchase_url) {
          const a = $('gift-purchase');
          a.href = gift.purchase_url;
          a.style.display = '';
        } else {
          const a = $('gift-purchase'); if (a) a.style.display = 'none';
        }
        $('gift-price').textContent = gift.price ? '$' + Number(gift.price).toFixed(2) : '';
        const available = (gift.quantity || 0) - (gift.reserved_count || 0);
        $('gift-qty').textContent = `Available: ${available}`;
        $('reserve-qty').max = Math.max(1, available);
        $('reserve-qty').value = 1;
        $('reserve-feedback').textContent = '';
        $('reserve-btn').disabled = available <= 0;
      }
    } else {
      $('reserve-feedback').textContent = 'Failed to load details';
    }
  } catch (err) {
    console.error('Failed to fetch gift details', err);
    $('reserve-feedback').textContent = 'Network error';
  }
}

// Initialize reserver-name autocomplete behaviors
function initReserverAutocomplete(){
  const input = $('reserver-name');
  const box = $('reserverSuggestions');
  if (!input || !box) return;

  input.addEventListener('input', ()=>{
    const q = input.value.trim();
    clearTimeout(suggTimeout);
    if (q.length < 2) { hideReserverSuggestions(); return; }
    suggTimeout = setTimeout(async ()=>{
      try {
        const res = await fetch(`${GIFT_API_BASE}/get-attending-guests?q=${encodeURIComponent(q)}`);
        if (!res.ok) { hideReserverSuggestions(); return; }
        const json = await res.json();
        // server returns rows with guest_name and email; map to expected shape
        const guests = (json.guests || []).map(r => ({ guest_name: r.guest_name, partner_name: r.partner_name, email: r.email }));
        showReserverSuggestions(guests);
      } catch(e){ hideReserverSuggestions(); }
    }, 250);
  });

  input.addEventListener('keydown', (e)=>{
    const boxEl = $('reserverSuggestions'); if (!boxEl || !boxEl.classList.contains('show')) return;
    const items = boxEl.querySelectorAll('.suggestion-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex+1, items.length-1);
        items.forEach((it,idx)=>{
          const selected = idx===selectedSuggestionIndex;
          it.classList.toggle('highlighted', selected);
          it.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex-1, 0);
        items.forEach((it,idx)=>{
          const selected = idx===selectedSuggestionIndex;
          it.classList.toggle('highlighted', selected);
          it.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
      }
    if (e.key === 'Enter') { e.preventDefault(); if (selectedSuggestionIndex>=0) selectSuggestionByIndex(selectedSuggestionIndex); }
    if (e.key === 'Escape') { hideReserverSuggestions(); }
  });

  // hide on outside click
  document.addEventListener('click', (e)=>{ const c = $('reserver-name'); const box = $('reserverSuggestions'); if (!c || !box) return; if (!c.contains(e.target) && !box.contains(e.target)) hideReserverSuggestions(); });
}

$('modal-close').addEventListener('click', () => { $('gift-modal').hidden = true; });

$('reserve-btn').addEventListener('click', async () => {
  if (!currentGift) return;
  const qty = Number($('reserve-qty').value) || 1;
  const name = $('reserver-name').value.trim();
  $('reserve-feedback').textContent = 'Processing...';
  try {
    const res = await fetch(`${GIFT_API_BASE}/reserve-gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId: currentGift.id, reserverName: name, qty })
    });
    const json = await res.json();
    if (res.status === 201) {
      $('reserve-feedback').textContent = 'Reserved — thank you!';
      $('gift-qty').textContent = `Available: ${json.remaining}`;
      // refresh main list
      load();
    } else if (res.status === 409) {
      $('reserve-feedback').textContent = `Not enough quantity available (remaining: ${json.available})`;
    } else {
      $('reserve-feedback').textContent = json.error || 'Reservation failed';
    }
  } catch (err) {
    console.error(err);
    $('reserve-feedback').textContent = 'Network error';
  }
});

async function load(){
  const container = $('gifts-list');

  // Determine flag from server (this will prefer any Netlify env var when present)
  renderLoading();
  const flag = await fetchRegistryFlag();
  if (!flag.enabled) {
    // skip DB call and show Coming Soon
    renderGifts([]);
    return;
  }

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
  initReserverAutocomplete();
}
