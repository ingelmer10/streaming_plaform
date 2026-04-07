// ============================================
// WhatsApp — Message templates & wa.me links
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function getExpiryStatus(dateStr) {
  const days = daysUntilExpiry(dateStr);
  if (days === null) return { class: 'no-date', text: 'Sin fecha', icon: '📅' };
  if (days < 0) return { class: 'expired', text: `Venció hace ${Math.abs(days)} día(s)`, icon: '🔴' };
  if (days === 0) return { class: 'expired', text: 'Vence hoy', icon: '⚠️' };
  if (days <= 3) return { class: 'warning', text: `Vence en ${days} día(s)`, icon: '🟡' };
  return { class: 'active', text: `Vence en ${days} días`, icon: '🟢' };
}

// WhatsApp message templates
function waReminderMessage(profile, platformName) {
  const days = daysUntilExpiry(profile.expiry_date);
  const daysText = days === 1 ? '1 día' : `${days} días`;
  return `¡Hola ${profile.client_name}! 👋\n\nTe recordamos que tu perfil *"${profile.profile_name}"* de *${platformName}* vence en *${daysText}* (${formatDate(profile.expiry_date)}).\n\nSi deseas renovar, ¡contáctanos! 🎬✨`;
}

function waExpiryMessage(profile, platformName) {
  return `¡Hola ${profile.client_name}! 👋\n\nTe informamos que tu perfil *"${profile.profile_name}"* de *${platformName}* ha *vencido hoy* (${formatDate(profile.expiry_date)}).\n\n¿Te gustaría renovar tu suscripción? ¡Estamos para ayudarte! 🎬🔄`;
}

function waRenewalMessage(profile, platformName, newDate) {
  return `¡Hola ${profile.client_name}! 🎉\n\n¡Tu perfil *"${profile.profile_name}"* de *${platformName}* ha sido *renovado exitosamente*!\n\n📅 Nueva fecha de vencimiento: *${formatDate(newDate)}*\n\n¡Disfruta tu contenido! 🎬✨`;
}

function cleanPhoneNumber(phone) {
  // Remove everything except digits
  return phone.replace(/[^\d]/g, '');
}

function openWhatsApp(phone, message) {
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedMsg = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
  window.open(url, '_blank');
}

function sendReminder(profile, platformName) {
  if (!profile.client_whatsapp) {
    showToast('Este perfil no tiene número de WhatsApp', 'warning');
    return;
  }
  const msg = waReminderMessage(profile, platformName);
  openWhatsApp(profile.client_whatsapp, msg);
  showToast('Abriendo WhatsApp con recordatorio...', 'success');
}

function sendExpiryNotice(profile, platformName) {
  if (!profile.client_whatsapp) {
    showToast('Este perfil no tiene número de WhatsApp', 'warning');
    return;
  }
  const msg = waExpiryMessage(profile, platformName);
  openWhatsApp(profile.client_whatsapp, msg);
  showToast('Abriendo WhatsApp con aviso de vencimiento...', 'success');
}

function sendRenewalNotice(profile, platformName, newDate) {
  if (!profile.client_whatsapp) {
    showToast('Este perfil no tiene número de WhatsApp', 'warning');
    return;
  }
  const msg = waRenewalMessage(profile, platformName, newDate);
  openWhatsApp(profile.client_whatsapp, msg);
  showToast('Abriendo WhatsApp con confirmación de renovación...', 'success');
}
