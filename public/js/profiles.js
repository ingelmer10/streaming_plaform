// ============================================
// Profiles — Profile list view for an account
// ============================================

let currentAccount = null;

async function renderProfiles(accountId) {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar() + `
    <div class="page-container">
      <div class="breadcrumbs">
        <span class="breadcrumb-item" onclick="navigateTo('dashboard')">📺 Plataformas</span>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-item" id="bc-platform">...</span>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-item active" id="bc-account">Cargando...</span>
      </div>
      <div class="page-header animate-fadeInUp">
        <div class="page-header-info">
          <h2 id="profiles-title">Perfiles</h2>
          <p id="profiles-subtitle">Cargando...</p>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" id="btn-back-accounts">← Volver</button>
          <button class="btn btn-primary" id="btn-add-profile">+ Nuevo Perfil</button>
        </div>
      </div>
      <div id="profiles-grid" class="cards-grid">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  try {
    currentAccount = await apiGetAccount(accountId);
    const pName = currentAccount.platform_icon + ' ' + currentAccount.platform_name;
    document.getElementById('bc-platform').textContent = pName;
    document.getElementById('bc-platform').onclick = () => navigateTo('platform/' + currentAccount.platform_id);
    document.getElementById('bc-account').textContent = '📧 ' + currentAccount.email;
    document.getElementById('profiles-title').textContent = '👤 Perfiles de ' + currentAccount.email;
    document.getElementById('profiles-subtitle').textContent = currentAccount.platform_name + ' — ' + currentAccount.profile_count + '/' + currentAccount.max_profiles + ' perfiles';
    document.getElementById('btn-back-accounts').onclick = () => navigateTo('platform/' + currentAccount.platform_id);
    document.getElementById('btn-add-profile').onclick = () => openProfileModal(accountId);
  } catch (e) {
    showToast('Error al cargar cuenta', 'error');
  }
  await loadProfiles(accountId);
}

async function loadProfiles(accountId) {
  try {
    const profiles = await apiGetProfiles(accountId);
    const grid = document.getElementById('profiles-grid');
    if (!profiles.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <span class="empty-state-icon">👤</span>
          <div class="empty-state-title">Sin perfiles</div>
          <div class="empty-state-text">Agrega el primer perfil para esta cuenta</div>
          <button class="btn btn-primary" onclick="openProfileModal(${accountId})">+ Agregar Perfil</button>
        </div>
      `;
      return;
    }
    grid.innerHTML = profiles.map((p, i) => {
      const expiry = getExpiryStatus(p.expiry_date);
      const days = daysUntilExpiry(p.expiry_date);
      const platName = p.platform_name || (currentAccount ? currentAccount.platform_name : '');
      const safeProfile = JSON.stringify(p).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `
      <div class="profile-card stagger-${i+1} animate-fadeInUp">
        <div class="profile-card-header">
          <div class="profile-card-name">
            <span class="profile-icon">👤</span>
            ${p.profile_name}
          </div>
          <div class="profile-card-actions">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="openProfileModal(${accountId}, ${p.id})" title="Editar">✏️</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="deleteProfile(${p.id}, '${p.profile_name}', ${accountId})" title="Eliminar">🗑️</button>
          </div>
        </div>
        <div class="profile-card-details">
          ${p.pin ? `<div class="profile-detail"><span class="detail-icon">🔑</span> PIN: <span class="detail-value">${p.pin}</span></div>` : ''}
          <div class="profile-detail"><span class="detail-icon">🧑</span> Cliente: <span class="detail-value">${p.client_name || 'Sin asignar'}</span></div>
          <div class="profile-detail"><span class="detail-icon">📱</span> WhatsApp: <span class="detail-value">${p.client_whatsapp || 'No registrado'}</span></div>
          <div class="profile-detail"><span class="detail-icon">💵</span> Precio: <span class="detail-value ${p.sale_price > 0 ? 'text-success' : ''}">${p.sale_price > 0 ? formatMoney(p.sale_price) : 'No definido'}</span></div>
          <div class="profile-detail"><span class="detail-icon">📅</span> Vencimiento: <span class="detail-value">${formatDate(p.expiry_date)}</span></div>
        </div>
        <div class="profile-card-footer">
          <span class="expiry-badge ${expiry.class}">${expiry.icon} ${expiry.text}</span>
          <div class="profile-wa-actions">
            ${p.client_whatsapp && days !== null && days > 0 ? `<button class="btn btn-whatsapp btn-sm" onclick="sendReminderById(${p.id})" title="Recordatorio">📨 Recordar</button>` : ''}
            ${p.client_whatsapp && days !== null && days <= 0 ? `<button class="btn btn-whatsapp btn-sm" onclick="sendExpiryById(${p.id})" title="Aviso">⚠️ Avisar</button>` : ''}
            <button class="btn btn-success btn-sm" onclick="openRenewModal(${p.id}, '${platName}', ${p.sale_price || 0})" title="Renovar">🔄 Renovar</button>
          </div>
        </div>
      </div>`;
    }).join('') + `
      <div class="add-card" onclick="openProfileModal(${accountId})">
        <div class="add-card-icon">+</div>
        <div class="add-card-text">Agregar Perfil</div>
      </div>
    `;
  } catch (err) {
    showToast('Error al cargar perfiles: ' + err.message, 'error');
  }
}

// WhatsApp actions by ID (safer than passing JSON inline)
async function sendReminderById(profileId) {
  try {
    const p = await apiGetProfile(profileId);
    sendReminder(p, p.platform_name);
  } catch(e) { showToast(e.message, 'error'); }
}

async function sendExpiryById(profileId) {
  try {
    const p = await apiGetProfile(profileId);
    sendExpiryNotice(p, p.platform_name);
  } catch(e) { showToast(e.message, 'error'); }
}

async function openProfileModal(accountId, profileId) {
  let profile = null;
  if (profileId) {
    try { profile = await apiGetProfile(profileId); } catch(e) { showToast(e.message,'error'); return; }
  }
  const title = profile ? 'Editar Perfil' : 'Nuevo Perfil';
  window.currentProfileExpiry = profile ? profile.expiry_date : null;
  openModal(`
    <div class="modal-header">
      <h3>👤 ${title}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nombre del Perfil</label>
        <input class="form-input" id="pr-name" value="${profile ? profile.profile_name : ''}" placeholder="Ej: Perfil 1" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">PIN (opcional)</label>
          <input class="form-input" id="pr-pin" value="${profile ? (profile.pin || '') : ''}" placeholder="Ej: 1234" maxlength="10">
        </div>
        <div class="form-group">
          <label class="form-label">Precio de Venta ($)</label>
          <input class="form-input" id="pr-price" type="number" step="0.01" min="0" value="${profile ? (profile.sale_price || 0) : 0}" placeholder="0.00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre del Cliente</label>
        <input class="form-input" id="pr-client" value="${profile ? (profile.client_name || '') : ''}" placeholder="Nombre completo del cliente">
      </div>
      <div class="form-group">
        <label class="form-label">WhatsApp del Cliente</label>
        <input class="form-input" id="pr-whatsapp" value="${profile ? (profile.client_whatsapp || '') : ''}" placeholder="Ej: 5491112345678 (con código de país)">
      </div>
      <div class="form-group">
        <label class="form-label">Vigencia (días)</label>
        <input class="form-input" id="pr-duration" type="number" min="1" value="${profile && profile.expiry_date && daysUntilExpiry(profile.expiry_date) > 0 ? daysUntilExpiry(profile.expiry_date) : ''}" placeholder="30">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveProfile(${accountId}, ${profileId || 'null'})">Guardar</button>
    </div>
  `);
}

async function saveProfile(accountId, profileId) {
  const duration = parseInt(document.getElementById('pr-duration').value, 10);
  let expiryDate = null;
  if (!Number.isNaN(duration) && duration > 0) {
    const date = new Date();
    date.setDate(date.getDate() + duration);
    expiryDate = date.toISOString().split('T')[0];
  }

  const data = {
    account_id: accountId,
    profile_name: document.getElementById('pr-name').value.trim(),
    pin: document.getElementById('pr-pin').value.trim(),
    client_name: document.getElementById('pr-client').value.trim(),
    client_whatsapp: document.getElementById('pr-whatsapp').value.trim(),
    sale_price: parseFloat(document.getElementById('pr-price').value) || 0,
    expiry_date: expiryDate !== null ? expiryDate : (profileId ? window.currentProfileExpiry : null),
  };
  if (!data.profile_name) { showToast('El nombre del perfil es requerido', 'warning'); return; }
  try {
    if (profileId) { await apiUpdateProfile(profileId, data); showToast('Perfil actualizado', 'success'); }
    else { await apiCreateProfile(data); showToast('Perfil creado', 'success'); }
    closeModal();
    await loadProfiles(accountId);
  } catch (err) { showToast(err.message, 'error'); }
}

function openRenewModal(profileId, platformName, currentPrice) {
  openModal(`
    <div class="modal-header">
      <h3>🔄 Renovar Perfil</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Días de renovación</label>
        <input class="form-input" id="renew-days" type="number" min="1" value="30" placeholder="30">
      </div>
      <div class="form-group">
        <label class="form-label">Precio de Venta para esta Renovación ($)</label>
        <input class="form-input" id="renew-price" type="number" step="0.01" min="0" value="${currentPrice}" placeholder="0.00">
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">💡 Puedes ajustar el precio si esta renovación tiene un costo diferente</p>
      </div>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="renew-notify" checked> Enviar notificación por WhatsApp
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-success" onclick="renewProfile(${profileId}, '${platformName}')">Renovar</button>
    </div>
  `);
}

async function renewProfile(profileId, platformName) {
  const days = parseInt(document.getElementById('renew-days').value, 10);
  const salePrice = parseFloat(document.getElementById('renew-price').value) || 0;
  const notify = document.getElementById('renew-notify').checked;

  if (Number.isNaN(days) || days <= 0) {
    showToast('Ingresa una cantidad de días válida', 'warning');
    return;
  }

  const profile = await apiGetProfile(profileId);
  const currentExpiry = profile.expiry_date ? new Date(profile.expiry_date + 'T00:00:00') : new Date();
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiryDateObj = new Date(baseDate);
  newExpiryDateObj.setDate(newExpiryDateObj.getDate() + days);
  const newDate = newExpiryDateObj.toISOString().split('T')[0];

  try {
    const updated = await apiRenewProfile(profileId, newDate, salePrice);
    showToast('Perfil renovado exitosamente', 'success');
    closeModal();
    if (notify && updated.client_whatsapp) {
      sendRenewalNotice(updated, platformName, newDate);
    }
    if (currentAccount) await loadProfiles(currentAccount.id);
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteProfile(id, name, accountId) {
  showConfirm('Eliminar Perfil', '¿Eliminar el perfil "' + name + '"?', async () => {
    try {
      await apiDeleteProfile(id);
      showToast('Perfil eliminado', 'success');
      await loadProfiles(accountId);
    } catch (err) { showToast(err.message, 'error'); }
  });
}
