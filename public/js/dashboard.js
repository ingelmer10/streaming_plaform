// ============================================
// Dashboard — Platforms grid view
// ============================================

function renderNavbar() {
  const currentHash = window.location.hash.slice(1);
  const isReports = currentHash === 'reports';
  return `
    <nav class="navbar">
      <a class="navbar-brand" onclick="navigateTo('dashboard')">
        <span>🎬</span>
        <span>StreamVault</span>
      </a>
      <div class="navbar-actions">
        <button class="btn ${isReports ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="navigateTo('reports')">📊 Reportes</button>
        <div class="navbar-user">
          <div class="navbar-user-avatar">A</div>
          <span>Admin</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="logout()">Salir</button>
      </div>
    </nav>
  `;
}

function formatMoney(n) {
  return '$' + (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function renderDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar() + `
    <div class="page-container">
      <div class="page-header animate-fadeInUp">
        <div class="page-header-info">
          <h2>📺 Plataformas</h2>
          <p>Gestiona tus plataformas de streaming</p>
        </div>
        <button class="btn btn-primary" onclick="openPlatformModal()">+ Nueva Plataforma</button>
      </div>
      <div id="platforms-grid" class="cards-grid">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  await loadPlatforms();
}

async function loadPlatforms() {
  try {
    const platforms = await apiGetPlatforms();
    const grid = document.getElementById('platforms-grid');
    if (!platforms.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <span class="empty-state-icon">📺</span>
          <div class="empty-state-title">Sin plataformas</div>
          <div class="empty-state-text">Agrega tu primera plataforma de streaming</div>
          <button class="btn btn-primary" onclick="openPlatformModal()">+ Agregar Plataforma</button>
        </div>
      `;
      return;
    }
    grid.innerHTML = platforms.map((p, i) => {
      const alerts = [];
      if (p.expired_accounts > 0) alerts.push(`<span class="expiry-badge expired">🔴 ${p.expired_accounts} cuenta(s) vencida(s)</span>`);
      if (p.expiring_soon_accounts > 0) alerts.push(`<span class="expiry-badge warning">🟡 ${p.expiring_soon_accounts} cuenta(s) por vencer</span>`);
      if (p.expired_profiles > 0) alerts.push(`<span class="expiry-badge expired">🔴 ${p.expired_profiles} perfil(es) vencido(s)</span>`);
      if (p.expiring_soon_profiles > 0) alerts.push(`<span class="expiry-badge warning">🟡 ${p.expiring_soon_profiles} perfil(es) por vencer</span>`);
      const alertsHtml = alerts.length > 0 ? `<div class="platform-alerts mt-sm">${alerts.join('')}</div>` : '';
      return `
      <div class="platform-card stagger-${i + 1} animate-fadeInUp" style="--platform-color: ${p.color}" onclick="navigateTo('platform/${p.id}')">
        <div class="platform-card-header">
          <div class="platform-card-icon">${p.icon}</div>
          <div class="platform-card-actions">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="event.stopPropagation(); openPlatformModal(${p.id})" title="Editar">✏️</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="event.stopPropagation(); deletePlatform(${p.id}, '${p.name}')" title="Eliminar">🗑️</button>
          </div>
        </div>
        <div class="platform-card-name">${p.name}</div>
        <div class="platform-card-stats">
          <div class="platform-stat">
            <div class="platform-stat-value">${p.account_count}</div>
            <div class="platform-stat-label">Cuentas</div>
          </div>
          <div class="platform-stat">
            <div class="platform-stat-value">${p.profile_count}</div>
            <div class="platform-stat-label">Perfiles</div>
          </div>
        </div>
        ${alertsHtml}
      </div>`;
    }).join('') + `
      <div class="add-card" onclick="openPlatformModal()">
        <div class="add-card-icon">+</div>
        <div class="add-card-text">Agregar Plataforma</div>
      </div>
    `;
  } catch (err) {
    showToast('Error al cargar plataformas: ' + err.message, 'error');
  }
}

async function openPlatformModal(id) {
  let platform = null;
  if (id) {
    try { platform = await apiGetPlatform(id); } catch (e) { showToast(e.message, 'error'); return; }
  }
  const title = platform ? 'Editar Plataforma' : 'Nueva Plataforma';
  const presets = ['#E50914','#113CCF','#00A8E1','#B834DB','#1DB954','#FF9900','#F5C518','#00D4AA'];
  openModal(`
    <div class="modal-header">
      <h3>📺 ${title}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form id="platform-form" class="modal-body">
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="form-input" id="pf-name" value="${platform ? platform.name : ''}" placeholder="Ej: Netflix" required>
      </div>
      <div class="form-group">
        <label class="form-label">Ícono (emoji)</label>
        <input class="form-input" id="pf-icon" value="${platform ? platform.icon : '📺'}" placeholder="📺" maxlength="4">
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="color-picker-group">
          <input type="color" class="color-picker-input" id="pf-color" value="${platform ? platform.color : '#6c5ce7'}">
          <div class="color-presets">
            ${presets.map(c => `<div class="color-preset" style="background:${c}" onclick="document.getElementById('pf-color').value='${c}'"></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Máx. Perfiles por Cuenta</label>
        <input type="number" class="form-input" id="pf-max" value="${platform ? platform.max_profiles : 5}" min="1" max="20">
      </div>
    </form>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="savePlatform(${id || 'null'})">Guardar</button>
    </div>
  `);
}

async function savePlatform(id) {
  const data = {
    name: document.getElementById('pf-name').value.trim(),
    icon: document.getElementById('pf-icon').value || '📺',
    color: document.getElementById('pf-color').value,
    max_profiles: parseInt(document.getElementById('pf-max').value) || 5,
  };
  if (!data.name) { showToast('El nombre es requerido', 'warning'); return; }
  try {
    if (id) { await apiUpdatePlatform(id, data); showToast('Plataforma actualizada', 'success'); }
    else { await apiCreatePlatform(data); showToast('Plataforma creada', 'success'); }
    closeModal();
    await loadPlatforms();
  } catch (err) { showToast(err.message, 'error'); }
}

function deletePlatform(id, name) {
  showConfirm('Eliminar Plataforma', `¿Estás seguro de eliminar "${name}"? Se eliminarán todas sus cuentas y perfiles.`, async () => {
    try {
      await apiDeletePlatform(id);
      showToast('Plataforma eliminada', 'success');
      await loadPlatforms();
    } catch (err) { showToast(err.message, 'error'); }
  });
}
