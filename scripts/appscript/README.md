Setup and deploy Apps Script for Calendar + Sheets booking

Steps

- Create a new Google Apps Script project in the Google Apps Script editor.
- Replace the default Code.gs content with the contents of `Code.gs` in this folder.
- Open Project Settings → Script properties and set `SHEET_ID` to your Google Sheet ID and `CALENDAR_ID` to your calendar ID (or `primary`).
- Run the `setupSpreadsheetHeaders_manual` function once from the editor to create headers in the sheet.
- Deploy → New deployment → Select `Web app`. Set `Execute as` to `Me` and `Who has access` to `Anyone` (or your domain) then deploy.

Client example (POST JSON)

Fetch example to call the web app URL returned by deployment:

```javascript
const url = 'YOUR_DEPLOYED_WEBAPP_URL';
const payload = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1234567890',
  start: '2026-07-10T15:00:00Z',
  end: '2026-07-10T16:00:00Z',
  service: 'Haircut',
  notes: 'First-time customer'
};

fetch(url, {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify(payload)
}).then(r=>r.json()).then(console.log).catch(console.error);
```

Notes

- Scopes will be requested on first run/first deploy. Approve Calendar and Sheets access.
- If you prefer locking credentials, store `SHEET_ID` and `CALENDAR_ID` in Script Properties or use a separate service account workflow.
