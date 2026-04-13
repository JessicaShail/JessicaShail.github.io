const API_BASE = '/.netlify/functions';
let ADMIN_SECRET = null;
const adminGiftsCache = new Map();

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

function escapeHtml(s){ return s != null ? String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }

function renderAdminList(gifts){
  const c = $('admin-gifts-list');
  c.innerHTML = '';
  c.classList.add('admin-list');
  gifts.forEach(g => {
    adminGiftsCache.set(String(g.id), g);
    const div = document.createElement('div');
    div.className = 'gift-card';
    div.innerHTML = `
      <div class="gift-title">${escapeHtml(g.title)} (id: ${escapeHtml(String(g.id))})</div>
      <div>Qty: ${escapeHtml(String(g.quantity))} reserved: ${escapeHtml(String(g.reserved_count))}</div>
      <div class="admin-controls">
        <button data-id="${escapeHtml(String(g.id))}" class="edit btn btn-secondary">Edit</button>
        <button data-id="${escapeHtml(String(g.id))}" class="delete btn btn-danger">Delete</button>
      </div>
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
  const current = adminGiftsCache.get(String(id)) || {};
  openEditModal({ id, ...current });
}

function openEditModal(gift){
  const modal = $('edit-modal');
  if (!modal) return;
  $('edit-id').value = gift.id || '';
  $('edit-title').value = gift.title || '';
  $('edit-desc').value = gift.description || '';
  $('edit-image').value = gift.image_url || '';
  $('edit-price').value = (gift.price !== null && gift.price !== undefined) ? gift.price : '';
  $('edit-qty').value = Number.isFinite(gift.quantity) ? gift.quantity : 1;
  $('edit-purchase').value = gift.purchase_url || '';
  $('edit-feedback').textContent = '';
  modal.hidden = false;
}

function closeEditModal(){
  const modal = $('edit-modal');
  if (!modal) return;
  modal.hidden = true;
}

$('edit-cancel')?.addEventListener('click', closeEditModal);

$('edit-save')?.addEventListener('click', async ()=>{
  if (!ADMIN_SECRET) { alert('Set admin secret first'); return; }
  const id = $('edit-id').value;
  const title = $('edit-title').value.trim();
  const description = $('edit-desc').value.trim();
  const imageUrl = $('edit-image').value.trim();
  const priceInput = $('edit-price').value.trim();
  const price = priceInput === '' ? null : Number(priceInput);
  if (priceInput !== '' && !Number.isFinite(price)) { $('edit-feedback').textContent = 'Price must be a valid number'; return; }
  const quantity = Number($('edit-qty').value);
  if (!Number.isFinite(quantity) || quantity < 0) { $('edit-feedback').textContent = 'Quantity must be 0 or more'; return; }
  const purchaseUrl = $('edit-purchase').value.trim();

  $('edit-feedback').textContent = 'Saving...';
  const payload = { id, title, description, imageUrl, price, quantity, purchaseUrl };
  try {
    const res = await fetch(`${API_BASE}/update-gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_SECRET },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (res.ok && json.gift) {
      closeEditModal();
      loadAdminGifts();
    } else {
      $('edit-feedback').textContent = json.error || 'Update failed';
    }
  } catch (err) {
    $('edit-feedback').textContent = 'Network error';
  }
});

$('create-btn').addEventListener('click', async ()=>{
  if (!ADMIN_SECRET) { alert('Set admin secret first'); return; }
  const payload = {
    title: $('create-title').value.trim(),
    description: $('create-desc').value.trim(),
    price: $('create-price').value ? Number($('create-price').value) : null,
    quantity: $('create-qty').value ? Number($('create-qty').value) : 1,
    purchaseUrl: $('create-purchase').value.trim()
  };
  const res = await fetch(`${API_BASE}/create-gift`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_SECRET }, body: JSON.stringify(payload) });
  const json = await res.json();
  if (res.status === 201) { $('create-feedback').textContent = 'Created'; loadAdminGifts(); } else { $('create-feedback').textContent = json.error || 'Create failed'; }
});

window.addEventListener('load', loadAdminGifts);

// Registry toggle support
async function getRegistryFlag(){
  try {
    const res = await fetch(`${API_BASE}/get-registry-flag`);
    if (!res.ok) return { enabled: false };
    return await res.json();
  } catch (e) { return { enabled: false }; }
}

async function setRegistryFlag(enabled){
  if (!ADMIN_SECRET) return alert('Set admin secret first');
  try {
    const res = await fetch(`${API_BASE}/set-registry-flag`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_SECRET }, body: JSON.stringify({ enabled }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed');
    return json;
  } catch (err) { throw err; }
}

// Wire toggle UI
async function refreshToggleUI(){
  const btn = $('toggle-registry');
  const status = $('toggle-status');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Loading...';
  try {
    const flag = await getRegistryFlag();
    const enabled = !!flag.enabled;
    btn.textContent = enabled ? 'Enabled' : 'Disabled';
    btn.classList.toggle('btn-danger', !enabled);
    btn.classList.toggle('btn-primary', enabled);
    status.textContent = flag.source ? `source: ${flag.source}` : '';
    btn.disabled = false;
  } catch (e) {
    btn.textContent = 'Error';
    status.textContent = '';
  }
}

// Toggle click
const toggleBtn = $('toggle-registry');
if (toggleBtn) toggleBtn.addEventListener('click', async ()=>{
  if (!ADMIN_SECRET) return alert('Set admin secret first');
  try {
    toggleBtn.disabled = true; toggleBtn.textContent = 'Saving...';
    // flip current value
    const current = await getRegistryFlag();
    const newVal = !current.enabled;
    await setRegistryFlag(newVal);
    await refreshToggleUI();
    loadAdminGifts();
  } catch (err) {
    alert(err.message || 'Failed to update');
    console.error(err);
    toggleBtn.disabled = false;
    await refreshToggleUI();
  }
});

// Refresh toggle UI on load
window.addEventListener('load', refreshToggleUI);
