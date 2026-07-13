function doGet() {
  return ContentService.createTextOutput('Booking endpoint is ready.').setMimeType(ContentService.MimeType.TEXT);
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
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON payload.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const validation = validateBookingPayload(payload);
  if (!validation.valid) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: validation.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const eventId = bookAppointment(payload);
  const whatsappUrl = buildWhatsAppUrl(payload, eventId);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'reserved',
    message: 'Your booking has been reserved.',
    eventId: eventId,
    whatsappUrl: whatsappUrl
  })).setMimeType(ContentService.MimeType.JSON);
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

function buildWhatsAppUrl(data, eventId) {
  const number = getWhatsAppNumber();
  const service = data.serviceLabel || data.service || 'Service';
  const notes = data.notes || 'None';
  const text = `New booking reserved.\nName: ${data.name || ''}\nPhone: ${data.phone || ''}\nService: ${service}\nDate: ${data.date || ''}\nTime: ${data.slot || data.time || ''}\nNotes: ${notes}\nEvent ID: ${eventId}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function getWhatsAppNumber() {
  const props = PropertiesService.getScriptProperties();
  return (props.getProperty('WHATSAPP_NUMBER') || '0645386347').replace(/[^0-9]/g, '');
}

function bookAppointment(data) {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const CALENDAR_ID = props.getProperty('CALENDAR_ID') || 'onlinebarberza@gmail.com';

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Bookings');
  if (!sheet) {
    sheet = ss.insertSheet('Bookings');
    sheet.appendRow(['CreatedAt', 'Name', 'Email', 'Phone', 'Start', 'End', 'Service', 'Notes', 'EventId']);
  }

  let start = data.start ? new Date(data.start) : null;
  if (!start) {
    const dateValue = data.date || '';
    const timeValue = data.slot || data.time || '09:00';
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      start = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hours || 9, minutes || 0);
    }
  }

  if (!start || isNaN(start.getTime())) {
    start = new Date();
  }

  const durationMinutes = Number(data.durationMinutes || 60);
  const end = data.end ? new Date(data.end) : new Date(start.getTime() + durationMinutes * 60 * 1000);
  const serviceText = data.serviceLabel || data.service || '';
  const notes = data.notes || '';
  const row = [
    new Date(),
    data.name || '',
    data.email || '',
    data.phone || '',
    start.toISOString(),
    end.toISOString(),
    serviceText,
    notes,
    ''
  ];
  sheet.appendRow(row);

  let cal;
  try {
    cal = CalendarApp.getCalendarById(CALENDAR_ID);
  } catch (err) {
    cal = null;
  }
  if (!cal) {
    cal = CalendarApp.getDefaultCalendar();
  }

  const title = serviceText ? (serviceText + ' — ' + (data.name || 'Booking')) : ('Booking — ' + (data.name || ''));
  const event = cal.createEvent(title, start, end, {
    description: 'Phone: ' + (data.phone || '') + '\nNotes: ' + notes,
    guests: data.email ? [data.email] : []
  });

  const eventId = event.getId();
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 9).setValue(eventId);
  return eventId;
}

function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc');
  props.setProperty('CALENDAR_ID', 'onlinebarberza@gmail.com');
  props.setProperty('WHATSAPP_NUMBER', '0645386347');
}

function setupSpreadsheetHeaders_manual() {
  const props = PropertiesService.getScriptProperties();
  const SHEET_ID = props.getProperty('SHEET_ID') || '1JsOlEQVi2f49sXY7L9HM1wRwSGf4rb4AQzyih5tw1fc';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Bookings');
  if (!sheet) {
    sheet = ss.insertSheet('Bookings');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 9).getValues()[0];
  if (headers.join('') === '') {
    sheet.getRange(1, 1, 1, 9).setValues([['CreatedAt', 'Name', 'Email', 'Phone', 'Start', 'End', 'Service', 'Notes', 'EventId']]);
  }
}