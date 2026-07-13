const GOOGLE_SHEET_ID = '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';

function doGet() {
  return ContentService.createTextOutput('Online Barber Apps Script endpoint is ready.').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  let payload = {};
  try {
    if (e && e.postData && e.postData.type === 'application/json') {
      payload = JSON.parse(e.postData.contents || '{}');
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'Invalid JSON payload.' });
  }

  const action = String(payload.type || payload.action || 'booking').toLowerCase();

  if (action === 'purchase') {
    const client = createOrGetClient(payload);
    const purchase = recordPurchase(payload, client.clientId);
    const whatsappUrl = buildWhatsAppUrl({
      name: payload.name || client.name || '',
      phone: payload.phone || client.phone || '',
      service: 'Merch purchase',
      notes: payload.notes || 'Purchase recorded'
    }, 'purchase', 'Purchase');

    return jsonResponse({
      status: 'ok',
      message: 'Purchase recorded. A WhatsApp copy is ready.',
      clientId: client.clientId,
      purchaseId: purchase.purchaseId,
      whatsappUrl: whatsappUrl
    });
  }

  if (action === 'register_referrer' || action === 'register_referral') {
    const client = createOrGetClient(payload);
    const purchased = checkClientPurchased(client.clientId);

    if (!purchased) {
      const code = ensureReferralCodeForClient(client.clientId);
      recordReferralJoinRequest(client.clientId, code, false, payload);
      const whatsappUrl = buildWhatsAppUrl({
        name: payload.name || client.name || '',
        phone: payload.phone || client.phone || '',
        email: payload.email || client.email || '',
        service: 'Referral programme',
        notes: payload.notes || 'Join request received. Waiting for purchase qualification.'
      }, 'referral', 'Referral request');

      return jsonResponse({
        status: 'pending',
        message: 'Referral request received. It will be approved once you qualify.',
        clientId: client.clientId,
        code: code,
        whatsappUrl: whatsappUrl
      });
    }

    const code = ensureReferralCodeForClient(client.clientId);
    const shareUrl = buildShareUrl(code);
    recordReferralIssuance(client.clientId, code, payload);
    const whatsappUrl = buildWhatsAppUrl({
      name: payload.name || client.name || '',
      phone: payload.phone || client.phone || '',
      email: payload.email || client.email || '',
      service: 'Referral programme',
      notes: payload.notes || 'Referral programme activated. Share the link to earn rewards.'
    }, 'referral', 'Referral programme');

    return jsonResponse({
      status: 'ok',
      message: 'Referral programme activated. Share your link to earn rewards.',
      clientId: client.clientId,
      code: code,
      shareUrl: shareUrl,
      whatsappUrl: whatsappUrl
    });
  }

  if (action === 'booking') {
    const validation = validateBookingPayload(payload);
    if (!validation.valid) {
      return jsonResponse({ status: 'error', message: validation.message });
    }

    const client = createOrGetClient(payload);
    const eventId = bookAppointment(payload, client.clientId);

    let referralResult = null;
    if (payload.referralCode) {
      referralResult = processReferral(payload.referralCode, client.clientId, eventId);
    }

    const whatsappUrl = buildWhatsAppUrl({
      name: payload.name || client.name || '',
      phone: payload.phone || client.phone || '',
      email: payload.email || client.email || '',
      service: payload.serviceLabel || payload.service || 'Booking',
      date: payload.date || '',
      time: payload.slot || payload.time || '',
      notes: payload.notes || ''
    }, 'booking', 'Booking');

    const trackingId = `client_${client.clientId}|booking_${eventId}`;

    return jsonResponse({
      status: 'ok',
      message: 'Booking saved to Sheets and a WhatsApp copy is ready.',
      clientId: client.clientId,
      eventId: eventId,
      trackingId: trackingId,
      referral: referralResult,
      whatsappUrl: whatsappUrl
    });
  }

  return jsonResponse({ status: 'error', message: 'Unsupported action.' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function validateBookingPayload(data) {
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const service = String(data.service || data.serviceLabel || '').trim();
  const date = String(data.date || '').trim();
  const slot = String(data.slot || data.time || '').trim();

  if (!name) {
    return { valid: false, message: 'Please provide your full name.' };
  }

  const normalizedPhone = phone.replace(/[^0-9]/g, '');
  if (!normalizedPhone || normalizedPhone.length < 9 || normalizedPhone.length > 13) {
    return { valid: false, message: 'Please provide a valid phone number.' };
  }

  if (!service) {
    return { valid: false, message: 'Please choose a service.' };
  }

  if (!date) {
    return { valid: false, message: 'Please choose a booking date.' };
  }

  if (!slot) {
    return { valid: false, message: 'Please choose a time slot.' };
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, message: 'Please enter a valid booking date.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsedDate < today) {
    return { valid: false, message: 'Booking date cannot be in the past.' };
  }

  return { valid: true };
}

function buildWhatsAppUrl(data, type, label) {
  const number = getWhatsAppNumber();
  const name = data.name || '';
  const phone = data.phone || '';
  const service = data.service || 'Service';
  const notes = data.notes || 'None';
  const date = data.date || '';
  const time = data.time || '';
  const email = data.email || '';

  const lines = [];
  lines.push(`${label || 'Online Barber'} request`);
  lines.push(`Name: ${name}`);
  lines.push(`Phone: ${phone}`);
  if (email) lines.push(`Email: ${email}`);
  lines.push(`Service: ${service}`);
  if (date) lines.push(`Date: ${date}`);
  if (time) lines.push(`Time: ${time}`);
  lines.push(`Notes: ${notes}`);
  lines.push(`Type: ${type}`);

  const text = lines.join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function getWhatsAppNumber() {
  const props = PropertiesService.getScriptProperties();
  return (props.getProperty('WHATSAPP_NUMBER') || '27645386347').replace(/[^0-9]/g, '');
}

function createOrGetClient(data) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Clients');
  if (!sheet) {
    sheet = ss.insertSheet('Clients');
    sheet.appendRow(['ClientId', 'CreatedAt', 'Name', 'Email', 'Phone', 'ReferralCode', 'PurchasedMerch']);
  }

  const email = String(data.email || '').trim().toLowerCase();
  const phone = String(data.phone || '').replace(/[^0-9]/g, '').trim();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = String(row[3] || '').trim().toLowerCase();
    const rowPhone = String(row[4] || '').replace(/[^0-9]/g, '').trim();
    if ((email && rowEmail === email) || (phone && rowPhone === phone)) {
      return {
        clientId: String(row[0]),
        name: String(row[2] || ''),
        email: String(row[3] || ''),
        phone: String(row[4] || ''),
        referralCode: String(row[5] || ''),
        purchasedMerch: String(row[6] || '').toLowerCase() === 'true'
      };
    }
  }

  const clientId = makeClientId();
  const now = new Date();
  sheet.appendRow([clientId, now, data.name || '', email, phone, '', 'false']);
  return {
    clientId: clientId,
    name: data.name || '',
    email: email,
    phone: phone,
    referralCode: '',
    purchasedMerch: false
  };
}

function makeClientId() {
  return 'CL-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(1000 + Math.random() * 9000);
}

function bookAppointment(data, clientIdOverride) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Bookings');
  if (!sheet) {
    sheet = ss.insertSheet('Bookings');
    sheet.appendRow(['CreatedAt', 'ClientId', 'Name', 'Email', 'Phone', 'BookingDate', 'BookingTime', 'Service', 'Notes', 'EventId', 'ReferralCode', 'TrackingId', 'Status']);
  }

  const dateValue = data.date || '';
  const timeValue = data.slot || data.time || '09:00';
  const parsedDate = new Date(dateValue);
  let start = null;
  if (!isNaN(parsedDate.getTime())) {
    const [hours, minutes] = String(timeValue).split(':').map(Number);
    start = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hours || 9, minutes || 0);
  }
  if (!start || isNaN(start.getTime())) {
    start = new Date();
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const eventId = createCalendarEvent(data, start, end);
  const trackingId = `client_${clientIdOverride || data.clientId || ''}|booking_${eventId || 'manual'}`;

  const row = [
    new Date(),
    clientIdOverride || data.clientId || '',
    data.name || '',
    data.email || '',
    data.phone || '',
    data.date || '',
    data.slot || data.time || '',
    data.serviceLabel || data.service || '',
    data.notes || '',
    eventId || '',
    data.referralCode || '',
    trackingId,
    'Booked'
  ];
  sheet.appendRow(row);
  return eventId || trackingId;
}

function createCalendarEvent(data, start, end) {
  try {
    const props = PropertiesService.getScriptProperties();
    const calendarId = props.getProperty('CALENDAR_ID') || 'primary';
    let calendar = null;
    try {
      calendar = CalendarApp.getCalendarById(calendarId);
    } catch (err) {
      calendar = null;
    }
    if (!calendar) {
      try {
        calendar = CalendarApp.getDefaultCalendar();
      } catch (err) {
        calendar = null;
      }
    }
    if (!calendar) {
      return null;
    }
    const title = (data.serviceLabel || data.service || 'Booking') + ' — ' + (data.name || 'Client');
    const event = calendar.createEvent(title, start, end, {
      description: 'Phone: ' + (data.phone || '') + '\nNotes: ' + (data.notes || ''),
      guests: data.email ? [data.email] : []
    });
    return String(event.getId() || '');
  } catch (err) {
    return null;
  }
}

function recordPurchase(data, clientId) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Purchases');
  if (!sheet) {
    sheet = ss.insertSheet('Purchases');
    sheet.appendRow(['PurchaseId', 'CreatedAt', 'ClientId', 'Name', 'Phone', 'Email', 'Items', 'Total', 'Status']);
  }

  const purchaseId = 'PUR-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(1000 + Math.random() * 9000);
  const itemsText = Array.isArray(data.items) ? data.items.map(item => `${item.name} x${item.qty}`).join(' | ') : '';
  sheet.appendRow([purchaseId, new Date(), clientId || '', data.name || '', data.phone || '', data.email || '', itemsText, data.total || '', 'Recorded']);

  const clientsSheet = ss.getSheetByName('Clients');
  if (clientsSheet) {
    const rows = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '') === String(clientId)) {
        clientsSheet.getRange(i + 1, 7).setValue('true');
        break;
      }
    }
  }

  return { purchaseId: purchaseId };
}

function checkClientPurchased(clientId) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Purchases');
  if (!sheet) return false;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2] || '') === String(clientId)) {
      return true;
    }
  }
  return false;
}

function ensureReferralCodeForClient(clientId) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const clientsSheet = ss.getSheetByName('Clients');
  if (!clientsSheet) return '';

  const rows = clientsSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '') === String(clientId)) {
      const existing = String(rows[i][5] || '').trim();
      if (existing) return existing;
      const code = makeReferralCode();
      clientsSheet.getRange(i + 1, 6).setValue(code);
      return code;
    }
  }
  return '';
}

function makeReferralCode() {
  return 'OB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function recordReferralJoinRequest(clientId, code, approved, payload) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || GOOGLE_SHEET_ID;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Referrals');
  if (!sheet) {
    sheet = ss.insertSheet('Referrals');
    sheet.appendRow(['CreatedAt', 'ClientId', 'Name', 'Phone', 'Email', 'ReferralCode', 'Approved', 'Type', 'Notes']);
  }

  sheet.appendRow([
    new Date(),
    clientId || '',
    payload && payload.name ? payload.name : '',
    payload && payload.phone ? payload.phone : '',
    payload && payload.email ? payload.email : '',
    code || '',
    approved ? 'true' : 'false',
    'JoinRequest',
    payload && payload.notes ? payload.notes : ''
  ]);
}

function recordReferralIssuance(clientId, code, payload) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || GOOGLE_SHEET_ID;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Referrals');
  if (!sheet) {
    sheet = ss.insertSheet('Referrals');
    sheet.appendRow(['CreatedAt', 'ClientId', 'Name', 'Phone', 'Email', 'ReferralCode', 'Approved', 'Type', 'Notes']);
  }

  sheet.appendRow([
    new Date(),
    clientId || '',
    payload && payload.name ? payload.name : '',
    payload && payload.phone ? payload.phone : '',
    payload && payload.email ? payload.email : '',
    code || '',
    'true',
    'Issued',
    payload && payload.notes ? payload.notes : ''
  ]);
}

function processReferral(referralCode, clientId, bookingId) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || GOOGLE_SHEET_ID;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Referrals');
  if (!sheet) {
    sheet = ss.insertSheet('Referrals');
    sheet.appendRow(['CreatedAt', 'ClientId', 'Name', 'Phone', 'Email', 'ReferralCode', 'Approved', 'Type', 'Notes']);
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][5] || '').trim() === String(referralCode)) {
      const referralClientId = String(rows[i][1] || '').trim();
      sheet.appendRow([new Date(), clientId, '', '', '', referralCode, 'true', 'BookingLinked', `Linked to booking ${bookingId} from referrer ${referralClientId}`]);
      return { referralCode: referralCode, referrerClientId: referralClientId, bookingId: bookingId };
    }
  }

  return { referralCode: referralCode, bookingId: bookingId, status: 'unmatched' };
}

function buildShareUrl(code) {
  return `https://onlinebarberza.co.za/?ref=${encodeURIComponent(code)}`;
}

function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', GOOGLE_SHEET_ID);
  props.setProperty('CALENDAR_ID', 'primary');
  props.setProperty('WHATSAPP_NUMBER', '27645386347');
}

function setupSpreadsheetHeaders_manual() {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || GOOGLE_SHEET_ID;
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const sheets = [
    ['Bookings', ['CreatedAt', 'ClientId', 'Name', 'Email', 'Phone', 'BookingDate', 'BookingTime', 'Service', 'Notes', 'EventId', 'ReferralCode', 'TrackingId', 'Status']],
    ['Clients', ['ClientId', 'CreatedAt', 'Name', 'Email', 'Phone', 'ReferralCode', 'PurchasedMerch']],
    ['Purchases', ['PurchaseId', 'CreatedAt', 'ClientId', 'Name', 'Phone', 'Email', 'Items', 'Total', 'Status']],
    ['Referrals', ['CreatedAt', 'ClientId', 'Name', 'Phone', 'Email', 'ReferralCode', 'Approved', 'Type', 'Notes']]
  ];

  sheets.forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }
  });
}
