// ============================================
// WhatsApp — Message templates & wa.me links
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  // Extract only the date part (YYYY-MM-DD) from the string
  const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) return 'Invalid Date';
  const d = new Date(dateMatch[0] + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  // Extract only the date part (YYYY-MM-DD) from the string
  const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateMatch[0] + 'T00:00:00');
  if (isNaN(expiry.getTime())) return null;
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
  return `Hola *${profile.client_name}*
Te recuerdo que tu cuenta de *${platformName}* vence en *${daysText}*. Puedes renovar cuando gustes. ¡Estamos para ayudarte!`;
}

function waExpiryMessage(profile, platformName) {
  return `Hola ${profile.client_name}
Tu cuenta de *${platformName}* vence *hoy*. Para no perder el acceso, por favor renueva lo antes posible. ¡Gracias!`;
}

function waRenewalMessage(profile, platformName, newDate, account) {
  return `*${platformName.toUpperCase()}*
========================
📧 *CORREO:* ${account.email}
🔒 *CONTRASEÑA:* ${account.password}
👤 *PERFIL:* ${profile.profile_name}  *PIN:* ${profile.pin || 'Sin PIN'}
========================
📅 *FECHA VENC.: ${formatDate(newDate)}*
========================
*REGLAS:*
1.- NO COMPARTIR LA CUENTA.
2.- RESPETAR LOS DEMAS PERFILES.
3.- NO CAMBIAR NADA EN LA CUENTA.
4.- NO ACTIVAR MIEMBRO EXTRA.
5.- USAR SOLO EN UN DISPOSITIVO.
*¡GRACIAS POR SU PREFERENCIA! 😊*`;
}

function cleanPhoneNumber(phone) {
  // Remove everything except digits
  return phone.replace(/[^\d]/g, '');
}

function openWhatsApp(phone, message) {
  const cleanPhone = cleanPhoneNumber(phone);
  // Use proper UTF-8 encoding that preserves emojis
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

function sendRenewalNotice(profile, platformName, newDate, account) {
  if (!profile.client_whatsapp) {
    showToast('Este perfil no tiene número de WhatsApp', 'warning');
    return;
  }
  const msg = waRenewalMessage(profile, platformName, newDate, account);
  openWhatsApp(profile.client_whatsapp, msg);
  showToast('Abriendo WhatsApp con confirmación de renovación...', 'success');
}
