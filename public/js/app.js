// ============================================
// App — Main router & initialization
// ============================================

function navigateTo(route) {
  window.location.hash = route;
}

function getRoute() {
  const hash = window.location.hash.slice(1) || '';
  if (!hash || hash === 'login') return { view: 'login', params: {} };
  if (hash === 'dashboard') return { view: 'dashboard', params: {} };
  if (hash === 'reports') return { view: 'reports', params: {} };

  const platformMatch = hash.match(/^platform\/(\d+)$/);
  if (platformMatch) return { view: 'platform', params: { id: parseInt(platformMatch[1]) } };

  const accountMatch = hash.match(/^account\/(\d+)$/);
  if (accountMatch) return { view: 'account', params: { id: parseInt(accountMatch[1]) } };

  return { view: 'dashboard', params: {} };
}

async function handleRoute() {
  const route = getRoute();

  if (route.view !== 'login' && !isAuthenticated()) {
    navigateTo('login');
    return;
  }
  if (route.view === 'login' && isAuthenticated()) {
    navigateTo('dashboard');
    return;
  }

  switch (route.view) {
    case 'login':
      renderLogin();
      break;
    case 'dashboard':
      await renderDashboard();
      break;
    case 'platform':
      await renderAccounts(route.params.id);
      break;
    case 'account':
      await renderProfiles(route.params.id);
      break;
    case 'reports':
      await renderReports();
      break;
    default:
      navigateTo('dashboard');
  }
}

window.addEventListener('hashchange', handleRoute);

document.addEventListener('DOMContentLoaded', () => {
  handleRoute();
});
