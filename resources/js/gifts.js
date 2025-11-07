const API_BASE = '/.netlify/functions';

const $ = (id) => document.getElementById(id);

async function fetchGifts() {
  const res = await fetch(`${API_BASE}/get-gifts`);
  const json = await res.json();
  return json.gifts || [];
}

function renderGifts(gifts) {
  const container = $('gifts-list');
  container.innerHTML = '';
  gifts.forEach(g => {
    const card = document.createElement('div');
    card.className = 'gift-card';
    card.innerHTML = `
      <img src="${g.image_url || 'resources/images/Celebration.png'}" alt="${escapeHtml(g.title)}">
      <div class="gift-title">${escapeHtml(g.title)}</div>
      <div class="gift-price">${g.price ? ('$' + Number(g.price).toFixed(2)) : ''}</div>
      <div class="gift-qty">Available: ${g.quantity - g.reserved_count}</div>
      <button data-id="${g.id}" class="gift-view">View</button>
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
  const res = await fetch(`${API_BASE}/get-gift?id=${encodeURIComponent(id)}`);
  if (!res.ok) return alert('Failed to load');
  const { gift } = await res.json();
  currentGift = gift;
  $('gift-title').textContent = gift.title;
  $('gift-image').src = gift.image_url || 'resources/images/Celebration.png';
  $('gift-image').alt = gift.title;
  $('gift-desc').textContent = gift.description || '';
  $('gift-price').textContent = gift.price ? '$' + Number(gift.price).toFixed(2) : '';
  $('gift-qty').textContent = `Available: ${gift.quantity - gift.reserved_count}`;
  $('reserve-qty').max = Math.max(1, gift.quantity - gift.reserved_count);
  $('reserve-qty').value = 1;
  $('reserver-name').value = '';
  $('reserver-email').value = '';
  $('reserve-note').value = '';
  $('reserve-feedback').textContent = '';
  $('gift-modal').hidden = false;
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
    const res = await fetch(`${API_BASE}/reserve-gift`, {
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

// initialize
window.addEventListener('load', load);
