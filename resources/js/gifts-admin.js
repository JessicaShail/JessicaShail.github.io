const API_BASE = '/.netlify/functions';
let ADMIN_SECRET = null;

const $ = (id)=> document.getElementById(id);

$('auth-save').addEventListener('click', ()=>{
  ADMIN_SECRET = $('admin-secret').value.trim();
  if (ADMIN_SECRET) {
    $('auth-status').textContent = 'Secret saved (in-memory)';
  } else {
    $('auth-status').textContent = 'Please enter a secret';
  }
});

async function loadAdminGifts(){
  const res = await fetch(`${API_BASE}/get-gifts`);
  const json = await res.json();
  renderAdminList(json.gifts || []);
}

function renderAdminList(gifts){
  const c = $('admin-gifts-list');
  c.innerHTML = '';
  gifts.forEach(g => {
    const div = document.createElement('div');
    div.className = 'gift-card';
    div.innerHTML = `
      <div class="gift-title">${g.title} (id: ${g.id})</div>
      <div>Qty: ${g.quantity} reserved: ${g.reserved_count}</div>
      <button data-id="${g.id}" class="edit">Edit</button>
      <button data-id="${g.id}" class="delete">Delete</button>
    `;
    c.appendChild(div);
  });
  c.querySelectorAll('.delete').forEach(b => b.addEventListener('click', onDelete));
  c.querySelectorAll('.edit').forEach(b => b.addEventListener('click', onEdit));
}

async function onDelete(e){
  if (!ADMIN_SECRET) return alert('Set admin secret first');
  const id = e.currentTarget.dataset.id;
  if (!confirm('Delete gift?')) return;
  const res = await fetch(`${API_BASE}/delete-gift`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_SECRET }, body: JSON.stringify({ id })
  });
  const json = await res.json();
  if (res.ok) { loadAdminGifts(); } else { alert(json.error || 'Delete failed'); }
}

function onEdit(e){
  const id = e.currentTarget.dataset.id;
  // Simple inline edit prompt (for MVP)
  const title = prompt('New title');
  if (title === null) return;
  const payload = { id, title };
  fetch(`${API_BASE}/update-gift`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_SECRET }, body: JSON.stringify(payload) })
    .then(r => r.json()).then(j => { if (j.gift) loadAdminGifts(); else alert(j.error || 'Update failed'); });
}

$('create-btn').addEventListener('click', async ()=>{
  if (!ADMIN_SECRET) { alert('Set admin secret first'); return; }
  const payload = {
    title: $('create-title').value.trim(),
    description: $('create-desc').value.trim(),
    imageUrl: $('create-image').value.trim(),
    price: $('create-price').value ? Number($('create-price').value) : null,
    quantity: $('create-qty').value ? Number($('create-qty').value) : 1,
    purchaseUrl: $('create-purchase').value.trim()
  };
  const res = await fetch(`${API_BASE}/create-gift`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_SECRET }, body: JSON.stringify(payload) });
  const json = await res.json();
  if (res.status === 201) { $('create-feedback').textContent = 'Created'; loadAdminGifts(); } else { $('create-feedback').textContent = json.error || 'Create failed'; }
});

window.addEventListener('load', loadAdminGifts);
