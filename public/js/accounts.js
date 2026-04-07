// ============================================
// Accounts — Account list view for a platform
// ============================================

let currentPlatform = null;

async function renderAccounts(platformId) {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar() + `
    <div class="page-container">
      <div class="breadcrumbs">
        <span class="breadcrumb-item" onclick="navigateTo('dashboard')">📺 Plataformas</span>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-item active" id="breadcrumb-platform">Cargando...</span>
      </div>
      <div id="platform-alerts-bar"></div>
      <div class="page-header animate-fadeInUp">
        <div class="page-header-info">
          <h2 id="accounts-title">Cuentas</h2>
          <p id="accounts-subtitle">Cargando...</p>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" onclick="navigateTo('dashboard')">← Volver</button>
          <button class="btn btn-primary" id="btn-add-account" onclick="openAccountModal(${platformId})">+ Nueva Cuenta</button>
        </div>
      </div>
      <div id="accounts-grid" class="cards-grid">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  try {
    currentPlatform = await apiGetPlatform(platformId);
    document.getElementById('breadcrumb-platform').textContent = currentPlatform.icon + ' ' + currentPlatform.name;
    document.getElementById('accounts-title').textContent = currentPlatform.icon + ' ' + currentPlatform.name;
    document.getElementById('accounts-subtitle').textContent = 'Gestiona las cuentas de ' + currentPlatform.name;
    // Show alerts bar
    const alertsBar = document.getElementById('platform-alerts-bar');
    const alerts = [];
    if (currentPlatform.expired_accounts > 0) alerts.push(`🔴 ${currentPlatform.expired_accounts} cuenta(s) vencida(s)`);
    if (currentPlatform.expiring_soon_accounts > 0) alerts.push(`🟡 ${currentPlatform.expiring_soon_accounts} cuenta(s) por vencer (7 días)`);
    if (currentPlatform.expired_profiles > 0) alerts.push(`🔴 ${currentPlatform.expired_profiles} perfil(es) vencido(s)`);
    if (currentPlatform.expiring_soon_profiles > 0) alerts.push(`🟡 ${currentPlatform.expiring_soon_profiles} perfil(es) por vencer (7 días)`);
    if (alerts.length > 0) {
      alertsBar.innerHTML = `<div class="alerts-bar animate-fadeIn">${alerts.map(a => `<span class="alert-chip">${a}</span>`).join('')}</div>`;
    }
  } catch (e) {
    showToast('Error al cargar plataforma', 'error');
  }
  await loadAccounts(platformId);
}

async function loadAccounts(platformId) {
  try {
    const accounts = await apiGetAccounts(platformId);
    const grid = document.getElementById('accounts-grid');
    const maxP = currentPlatform ? currentPlatform.max_profiles : 5;
    if (!accounts.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <span class="empty-state-icon">📧</span>
          <div class="empty-state-title">Sin cuentas</div>
          <div class="empty-state-text">Agrega la primera cuenta para esta plataforma</div>
          <button class="btn btn-primary" onclick="openAccountModal(${platformId})">+ Agregar Cuenta</button>
        </div>
      `;
      return;
    }
    const color = currentPlatform ? currentPlatform.color : '#6c5ce7';
    grid.innerHTML = accounts.map((a, i) => {
      const pct = Math.min(100, (a.profile_count / maxP) * 100);
      const isFull = a.profile_count >= maxP;
      const accExpiry = getExpiryStatus(a.expiry_date);
      return `
      <div class="account-card stagger-${i+1} animate-fadeInUp" onclick="navigateTo('account/${a.id}')">
        <div class="account-card-header">
          <div class="account-card-email">
            <span class="email-icon">📧</span>
            <span>${a.email}</span>
          </div>
          <div class="account-card-actions">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="event.stopPropagation(); openAccountModal(${platformId}, ${a.id})" title="Editar">✏️</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="event.stopPropagation(); openRenewAccountModal(${a.id}, '${a.email}', '${a.expiry_date || ''}', ${a.cost || 0})" title="Renovar">🔄</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="event.stopPropagation(); deleteAccount(${a.id}, '${a.email}', ${platformId})" title="Eliminar">🗑️</button>
          </div>
        </div>
        <div class="account-card-details">
          ${a.provider_name ? `<div class="profile-detail"><span class="detail-icon">🏪</span> Proveedor: <span class="detail-value">${a.provider_name}</span></div>` : ''}
          ${a.provider_phone ? `<div class="profile-detail"><span class="detail-icon">📞</span> Tel: <span class="detail-value">${a.provider_phone}</span></div>` : ''}
          ${a.cost > 0 ? `<div class="profile-detail"><span class="detail-icon">💰</span> Costo: <span class="detail-value">${formatMoney(a.cost)}</span></div>` : ''}
          ${a.expiry_date ? `<div class="profile-detail"><span class="detail-icon">📅</span> Vence: <span class="detail-value">${formatDate(a.expiry_date)}</span></div>` : ''}
        </div>
        <div class="account-card-info">
          <div class="account-card-profiles">
            <span>👤</span>
            <span><span class="count">${a.profile_count}</span> / ${maxP} perfiles</span>
          </div>
          <div class="flex gap-sm">
            ${a.expiry_date ? `<span class="expiry-badge ${accExpiry.class}">${accExpiry.icon} ${accExpiry.text}</span>` : ''}
            ${isFull ? '<span class="expiry-badge expired">Llena</span>' : ''}
          </div>
        </div>
        ${a.total_revenue > 0 ? `<div class="account-revenue mt-sm"><span class="text-muted" style="font-size:0.75rem">💵 Ingresos: <strong class="text-success">${formatMoney(a.total_revenue)}</strong></span></div>` : ''}
        <div class="profile-progress">
          <div class="profile-progress-bar ${isFull ? 'full' : ''}" style="width:${pct}%; background:${isFull ? '' : color}"></div>
        </div>
      </div>`;
    }).join('') + `
      <div class="add-card" onclick="openAccountModal(${platformId})">
        <div class="add-card-icon">+</div>
        <div class="add-card-text">Agregar Cuenta</div>
      </div>
    `;
  } catch (err) {
    showToast('Error al cargar cuentas: ' + err.message, 'error');
  }
}

async function openAccountModal(platformId, accountId) {
  let account = null;
  if (accountId) {
    try { account = await apiGetAccount(accountId); } catch(e) { showToast(e.message,'error'); return; }
  }
  window.currentAccountExpiry = account ? account.expiry_date : null;
  const title = account ? 'Editar Cuenta' : 'Nueva Cuenta';
  openModal(`
    <div class="modal-header">
      <h3>📧 ${title}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Correo Electrónico</label>
        <input class="form-input" id="acc-email" type="email" value="${account ? account.email : ''}" placeholder="correo@ejemplo.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">Contraseña de la cuenta</label>
        <div class="form-input-wrapper">
          <input class="form-input" id="acc-password" type="password" value="${account ? account.password : ''}" placeholder="Contraseña" required>
          <button type="button" class="toggle-password" onclick="toggleAccPassword()">👁️</button>
        </div>
      </div>
      <hr style="border-color: var(--border-subtle); margin: 16px 0;">
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">📦 Información del Proveedor</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre del Proveedor</label>
          <input class="form-input" id="acc-provider" value="${account ? (account.provider_name || '') : ''}" placeholder="Ej: Juan Distribuciones">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono Proveedor</label>
          <input class="form-input" id="acc-provider-phone" value="${account ? (account.provider_phone || '') : ''}" placeholder="Ej: 5491112345678">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Costo de la Cuenta ($)</label>
          <input class="form-input" id="acc-cost" type="number" step="0.01" min="0" value="${account ? (account.cost || 0) : 0}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">Vigencia (días)</label>
          <input class="form-input" id="acc-duration" type="number" min="1" value="${account && account.expiry_date && daysUntilExpiry(account.expiry_date) > 0 ? daysUntilExpiry(account.expiry_date) : ''}" placeholder="30">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAccount(${platformId}, ${accountId || 'null'})">Guardar</button>
    </div>
  `);
}

function toggleAccPassword() {
  const inp = document.getElementById('acc-password');
  const btn = inp.nextElementSibling;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🔒'; }
  else { inp.type = 'password'; btn.textContent = '👁️'; }
}

async function saveAccount(platformId, accountId) {
  const duration = parseInt(document.getElementById('acc-duration').value, 10);
  let expiryDate = null;
  if (!Number.isNaN(duration) && duration > 0) {
    const date = new Date();
    date.setDate(date.getDate() + duration);
    expiryDate = date.toISOString().split('T')[0];
  }

  const data = {
    platform_id: platformId,
    email: document.getElementById('acc-email').value.trim(),
    password: document.getElementById('acc-password').value,
    provider_name: document.getElementById('acc-provider').value.trim(),
    provider_phone: document.getElementById('acc-provider-phone').value.trim(),
    cost: parseFloat(document.getElementById('acc-cost').value) || 0,
    expiry_date: expiryDate !== null ? expiryDate : (accountId ? window.currentAccountExpiry : null),
  };
  if (!data.email || !data.password) { showToast('Email y contraseña son requeridos', 'warning'); return; }
  try {
    if (accountId) { await apiUpdateAccount(accountId, data); showToast('Cuenta actualizada', 'success'); }
    else { await apiCreateAccount(data); showToast('Cuenta creada', 'success'); }
    closeModal();
    await loadAccounts(platformId);
  } catch (err) { showToast(err.message, 'error'); }
}

function openRenewAccountModal(accountId, accountEmail, currentExpiry, currentCost) {
  openModal(`
    <div class="modal-header">
      <h3>🔄 Renovar Cuenta</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nuevos días de vigencia</label>
        <input class="form-input" id="renew-account-days" type="number" min="1" value="30" placeholder="30">
      </div>
      <div class="form-group">
        <label class="form-label">Costo de renovación ($)</label>
        <input class="form-input" id="renew-account-cost" type="number" step="0.01" min="0" value="${currentCost || 0}" placeholder="0.00">
      </div>
      <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">💡 Esta renovación registra el costo con el proveedor y actualiza la nueva fecha de vencimiento.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-success" onclick="renewAccount(${accountId})">Renovar</button>
    </div>
  `);
}

async function renewAccount(accountId) {
  const days = parseInt(document.getElementById('renew-account-days').value, 10);
  const cost = parseFloat(document.getElementById('renew-account-cost').value) || 0;
  if (Number.isNaN(days) || days <= 0) { showToast('Ingresa una cantidad de días válida', 'warning'); return; }

  const date = new Date();
  date.setDate(date.getDate() + days);
  const newExpiryDate = date.toISOString().split('T')[0];

  try {
    await apiRenewAccount(accountId, newExpiryDate, cost);
    showToast('Cuenta renovada exitosamente', 'success');
    closeModal();
    if (currentPlatform) await loadAccounts(currentPlatform.id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteAccount(id, email, platformId) {
  showConfirm('Eliminar Cuenta', '¿Eliminar la cuenta "' + email + '"? Se eliminarán todos sus perfiles.', async () => {
    try {
      await apiDeleteAccount(id);
      showToast('Cuenta eliminada', 'success');
      await loadAccounts(platformId);
    } catch (err) { showToast(err.message, 'error'); }
  });
}
