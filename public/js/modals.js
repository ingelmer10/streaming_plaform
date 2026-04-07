// ============================================
// Modal Management
// ============================================

function openModal(content) {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  container.innerHTML = content;
  overlay.classList.remove('hidden');
  // Focus first input
  setTimeout(() => {
    const firstInput = container.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
}

function closeModalOverlay(e) {
  if (e.target === e.currentTarget) {
    closeModal();
  }
}

// Toast notifications
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Confirm dialog
function showConfirm(title, message, onConfirm) {
  openModal(`
    <div class="confirm-dialog">
      <div class="confirm-icon">⚠️</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-message">${message}</div>
      <div class="confirm-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" id="confirm-btn">Eliminar</button>
      </div>
    </div>
  `);

  document.getElementById('confirm-btn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}
