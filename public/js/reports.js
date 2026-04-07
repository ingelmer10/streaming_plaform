// ============================================
// Reports — Sales & Profit reports
// ============================================

async function renderReports() {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar() + `
    <div class="page-container">
      <div class="page-header animate-fadeInUp">
        <div class="page-header-info">
          <h2>📊 Reportes</h2>
          <p>Ventas, ganancias y estado de cuentas</p>
        </div>
        <button class="btn btn-secondary" onclick="navigateTo('dashboard')">← Dashboard</button>
      </div>

      <!-- Summary Cards -->
      <div id="report-summary" class="stats-row">
        <div class="loading-spinner" style="grid-column:1/-1"><div class="spinner"></div></div>
      </div>

      <!-- Tabs -->
      <div class="report-tabs mb-lg animate-fadeInUp">
        <button class="report-tab active" onclick="switchReportTab('platforms', this)">📺 Por Plataforma</button>
        <button class="report-tab" onclick="switchReportTab('renewals', this)">🔄 Renovaciones</button>
        <button class="report-tab" onclick="switchReportTab('expiring', this)">⚠️ Por Vencer</button>
      </div>

      <div id="report-content" class="animate-fadeInUp">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  await loadReportSummary();
  await loadReportPlatforms();
}

async function loadReportSummary() {
  try {
    const s = await apiGetReportSummary();
    const container = document.getElementById('report-summary');
    container.innerHTML = `
      <div class="stat-card stagger-1 animate-fadeInUp">
        <div class="stat-card-label">Plataformas</div>
        <div class="stat-card-value">${s.total_platforms}</div>
      </div>
      <div class="stat-card stagger-2 animate-fadeInUp">
        <div class="stat-card-label">Cuentas</div>
        <div class="stat-card-value">${s.total_accounts}</div>
      </div>
      <div class="stat-card stagger-3 animate-fadeInUp">
        <div class="stat-card-label">Perfiles Activos</div>
        <div class="stat-card-value">${s.total_profiles}</div>
      </div>
      <div class="stat-card stagger-4 animate-fadeInUp">
        <div class="stat-card-label">Clientes</div>
        <div class="stat-card-value">${s.active_clients}</div>
      </div>
      <div class="stat-card stagger-5 animate-fadeInUp" style="border-left: 3px solid var(--danger)">
        <div class="stat-card-label">💰 Costo Total</div>
        <div class="stat-card-value text-danger" style="font-size:1.5rem">${formatMoney(s.total_costs)}</div>
      </div>
      <div class="stat-card stagger-6 animate-fadeInUp" style="border-left: 3px solid var(--success)">
        <div class="stat-card-label">💵 Ingresos Totales</div>
        <div class="stat-card-value text-success" style="font-size:1.5rem">${formatMoney(s.total_revenue)}</div>
      </div>
      <div class="stat-card stagger-7 animate-fadeInUp" style="border-left: 3px solid ${s.total_profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
        <div class="stat-card-label">📈 Ganancia Neta</div>
        <div class="stat-card-value" style="font-size:1.5rem; color: ${s.total_profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatMoney(s.total_profit)}</div>
      </div>
      <div class="stat-card stagger-8 animate-fadeInUp" style="border-left: 3px solid var(--warning)">
        <div class="stat-card-label">⚠️ Por Vencer (7d)</div>
        <div class="stat-card-value text-warning">${s.expiring_soon_profiles + s.expiring_soon_accounts}</div>
      </div>
    `;
  } catch (err) {
    showToast('Error al cargar resumen', 'error');
  }
}

function switchReportTab(tab, btn) {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'platforms') loadReportPlatforms();
  else if (tab === 'renewals') loadReportRenewals();
  else if (tab === 'expiring') loadReportExpiring();
}

async function loadReportPlatforms() {
  const container = document.getElementById('report-content');
  try {
    const data = await apiGetReportPlatforms();
    if (!data.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-state-icon">📊</span><div class="empty-state-title">Sin datos</div></div>';
      return;
    }
    container.innerHTML = `
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Plataforma</th>
              <th>Cuentas</th>
              <th>Perfiles</th>
              <th>Costo Total</th>
              <th>Ingresos</th>
              <th>Ganancia</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(p => `
              <tr>
                <td><span style="font-size:1.2rem">${p.icon}</span> <strong>${p.name}</strong></td>
                <td>${p.account_count}</td>
                <td>${p.profile_count}</td>
                <td class="text-danger">${formatMoney(p.total_cost)}</td>
                <td class="text-success">${formatMoney(p.total_revenue)}</td>
                <td style="color: ${p.profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
                  ${formatMoney(p.profit)}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>${data.reduce((s,p) => s + p.account_count, 0)}</strong></td>
              <td><strong>${data.reduce((s,p) => s + p.profile_count, 0)}</strong></td>
              <td class="text-danger"><strong>${formatMoney(data.reduce((s,p) => s + p.total_cost, 0))}</strong></td>
              <td class="text-success"><strong>${formatMoney(data.reduce((s,p) => s + p.total_revenue, 0))}</strong></td>
              <td style="color: var(--success); font-weight: 700;"><strong>${formatMoney(data.reduce((s,p) => s + p.profit, 0))}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch (err) {
    showToast('Error al cargar reporte de plataformas', 'error');
  }
}

async function loadReportRenewals() {
  const container = document.getElementById('report-content');
  try {
    const { renewals, totalRevenue, count } = await apiGetReportRenewals();
    if (!renewals.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-state-icon">🔄</span><div class="empty-state-title">Sin renovaciones</div><div class="empty-state-text">Las renovaciones aparecerán aquí cuando renueves perfiles</div></div>';
      return;
    }
    container.innerHTML = `
      <div class="report-summary-bar mb-lg">
        <span>🔄 <strong>${count}</strong> renovaciones</span>
        <span>💵 Total: <strong class="text-success">${formatMoney(totalRevenue)}</strong></span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Plataforma</th>
              <th>Perfil</th>
              <th>Cliente</th>
              <th>Anterior</th>
              <th>Nueva Fecha</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            ${renewals.map(r => `
              <tr>
                <td>${new Date(r.created_at).toLocaleDateString('es-ES')}</td>
                <td>${r.platform_icon} ${r.platform_name}</td>
                <td>${r.renewal_type === 'account' ? r.account_email : r.profile_name}</td>
                <td>${r.renewal_type === 'account' ? 'Cuenta' : (r.client_name || '—')}</td>
                <td>${r.old_expiry_date ? formatDate(r.old_expiry_date) : '—'}</td>
                <td>${formatDate(r.new_expiry_date)}</td>
                <td class="text-success"><strong>${formatMoney(r.sale_price)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showToast('Error al cargar renovaciones', 'error');
  }
}

async function loadReportExpiring() {
  const container = document.getElementById('report-content');
  try {
    const data = await apiGetReportExpiring(30);
    const totalItems = data.accounts.length + data.profiles.length;
    if (totalItems === 0) {
      container.innerHTML = '<div class="empty-state"><span class="empty-state-icon">✅</span><div class="empty-state-title">¡Todo al día!</div><div class="empty-state-text">No hay cuentas ni perfiles por vencer en los próximos 30 días</div></div>';
      return;
    }
    let html = '';
    if (data.accounts.length > 0) {
      html += `
        <h3 class="mb-md" style="font-size: 1.1rem;">📧 Cuentas por Vencer/Vencidas (${data.accounts.length})</h3>
        <div class="report-table-wrap mb-lg">
          <table class="report-table">
            <thead><tr><th>Plataforma</th><th>Email</th><th>Proveedor</th><th>Costo</th><th>Vencimiento</th><th>Estado</th></tr></thead>
            <tbody>
              ${data.accounts.map(a => {
                const exp = getExpiryStatus(a.expiry_date);
                return `<tr>
                  <td>${a.platform_icon} ${a.platform_name}</td>
                  <td>${a.email}</td>
                  <td>${a.provider_name || '—'}</td>
                  <td>${formatMoney(a.cost)}</td>
                  <td>${formatDate(a.expiry_date)}</td>
                  <td><span class="expiry-badge ${exp.class}">${exp.icon} ${exp.text}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    if (data.profiles.length > 0) {
      html += `
        <h3 class="mb-md" style="font-size: 1.1rem;">👤 Perfiles por Vencer/Vencidos (${data.profiles.length})</h3>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr><th>Plataforma</th><th>Cuenta</th><th>Perfil</th><th>Cliente</th><th>Precio</th><th>Vencimiento</th><th>Estado</th></tr></thead>
            <tbody>
              ${data.profiles.map(p => {
                const exp = getExpiryStatus(p.expiry_date);
                return `<tr>
                  <td>${p.platform_icon} ${p.platform_name}</td>
                  <td>${p.account_email}</td>
                  <td>${p.profile_name}</td>
                  <td>${p.client_name || '—'}</td>
                  <td>${formatMoney(p.sale_price)}</td>
                  <td>${formatDate(p.expiry_date)}</td>
                  <td><span class="expiry-badge ${exp.class}">${exp.icon} ${exp.text}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    container.innerHTML = html;
  } catch (err) {
    showToast('Error al cargar items por vencer', 'error');
  }
}
