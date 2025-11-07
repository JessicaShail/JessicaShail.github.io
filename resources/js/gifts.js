const GIFT_API_BASE = '/.netlify/functions';

const $ = (id) => document.getElementById(id);

// Simple in-memory cache for gifts to avoid extra network roundtrips
const giftsCache = new Map();

async function fetchGifts() {
  const res = await fetch(`${GIFT_API_BASE}/get-gifts`);
  const json = await res.json();
  return json.gifts || [];
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
      <img src="${g.image_url || 'resources/images/Celebration.png'}" alt="${escapeHtml(g.title)}">
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

function onView(e){
  const id = e.currentTarget.dataset.id;
  openModal(id);
}

async function openModal(id){
  // Show modal immediately with a loading state to reduce perceived latency
  currentGift = null;
  $('gift-title').textContent = 'Loading…';
  $('gift-image').src = '/resources/images/Celebration.png';
  $('gift-image').alt = 'Loading';
  $('gift-desc').textContent = '';
  $('gift-price').textContent = '';
  $('gift-qty').textContent = '';
  $('reserve-qty').max = 1;
  $('reserve-qty').value = 1;
  $('reserver-name').value = '';
  $('reserver-email').value = '';
  $('reserve-note').value = '';
  $('reserve-feedback').textContent = '';
  // disable reserve until we know availability
  try { $('reserve-btn').disabled = true; } catch(e){}
  $('gift-modal').hidden = false;

  // If we have cached data, show it immediately while we refresh from the server
  const cached = giftsCache.get(id);
  if (cached) {
    currentGift = cached;
    $('gift-title').textContent = cached.title || 'Gift';
    $('gift-image').src = cached.image_url ? (cached.image_url) : '/resources/images/Celebration.png';
    $('gift-image').alt = cached.title || '';
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
        $('gift-image').src = gift.image_url ? gift.image_url : '/resources/images/Celebration.png';
        $('gift-image').alt = gift.title || '';
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

$('modal-close').addEventListener('click', () => { $('gift-modal').hidden = true; });

$('reserve-btn').addEventListener('click', async () => {
  if (!currentGift) return;
  const qty = Number($('reserve-qty').value) || 1;
  const name = $('reserver-name').value.trim();
  const email = $('reserver-email').value.trim();
  const note = $('reserve-note').value.trim();
  $('reserve-feedback').textContent = 'Processing...';
  try {
    const res = await fetch(`${GIFT_API_BASE}/reserve-gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId: currentGift.id, reserverName: name, reserverEmail: email, qty, note })
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
  const gifts = await fetchGifts();
  renderGifts(gifts);
}

// expose init function so the SPA can call it when showing the registry
export async function initGifts(){
  await load();
}
