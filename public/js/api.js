// ============================================
// API Client — Fetch wrapper with JWT
// ============================================

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('sv_token');
}

function setToken(token) {
  localStorage.setItem('sv_token', token);
}

function removeToken() {
  localStorage.removeItem('sv_token');
}

function isAuthenticated() {
  return !!getToken();
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      removeToken();
      navigateTo('login');
      throw new Error('Sesión expirada');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }

    return data;
  } catch (err) {
    if (err.message === 'Sesión expirada') throw err;
    throw err;
  }
}

// Auth API
async function apiLogin(username, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

// Platforms API
async function apiGetPlatforms() {
  return apiFetch('/platforms');
}

async function apiGetPlatform(id) {
  return apiFetch(`/platforms/${id}`);
}

async function apiCreatePlatform(data) {
  return apiFetch('/platforms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function apiUpdatePlatform(id, data) {
  return apiFetch(`/platforms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function apiDeletePlatform(id) {
  return apiFetch(`/platforms/${id}`, {
    method: 'DELETE',
  });
}

// Accounts API
async function apiGetAccounts(platformId) {
  return apiFetch(`/accounts/platform/${platformId}`);
}

async function apiGetAccount(id) {
  return apiFetch(`/accounts/${id}`);
}

async function apiCreateAccount(data) {
  return apiFetch('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function apiUpdateAccount(id, data) {
  return apiFetch(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function apiDeleteAccount(id) {
  return apiFetch(`/accounts/${id}`, {
    method: 'DELETE',
  });
}

async function apiRenewAccount(id, newExpiryDate, renewalCost) {
  return apiFetch(`/accounts/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ new_expiry_date: newExpiryDate, renewal_cost: renewalCost }),
  });
}

// Profiles API
async function apiGetProfiles(accountId) {
  return apiFetch(`/profiles/account/${accountId}`);
}

async function apiGetProfile(id) {
  return apiFetch(`/profiles/${id}`);
}

async function apiCreateProfile(data) {
  return apiFetch('/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function apiUpdateProfile(id, data) {
  return apiFetch(`/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function apiDeleteProfile(id) {
  return apiFetch(`/profiles/${id}`, {
    method: 'DELETE',
  });
}

async function apiRenewProfile(id, newExpiryDate, salePrice) {
  return apiFetch(`/profiles/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ new_expiry_date: newExpiryDate, sale_price: salePrice }),
  });
}

// Reports API
async function apiGetReportSummary() {
  return apiFetch('/reports/summary');
}

async function apiGetReportPlatforms() {
  return apiFetch('/reports/platforms');
}

async function apiGetReportRenewals(from, to) {
  let url = '/reports/renewals?limit=100';
  if (from) url += '&from=' + from;
  if (to) url += '&to=' + to;
  return apiFetch(url);
}

async function apiGetReportMonthly() {
  return apiFetch('/reports/monthly');
}

async function apiGetReportExpiring(days) {
  return apiFetch('/reports/expiring?days=' + (days || 7));
}

async function apiResetData() {
  return apiFetch('/reports/reset', {
    method: 'POST'
  });
}
