# Discovery Call form → Google Sheets + email

This backend **does not use Node or Python**. It runs as a **Google Apps Script** web app:

1. Saves each submission as a **row in Google Sheets**
2. Sends an email to **hello@assiststudio.in** (via the Google account that owns the script)

---

## 1. Create the spreadsheet

1. Open [Google Sheets](https://sheets.google.com) while logged into the Google account you want to use for mail (ideally one that can reach `hello@assiststudio.in`, or forward from Gmail to that address).
2. Create a new spreadsheet, e.g. **AssistStudio — Leads**.
3. Rename the first tab to **`Leads`** (must match `SHEET_NAME` in `Code.gs`).

Headers are created automatically on the first submission. Optional manual header row:

| Timestamp | Name | Email | Phone | Project | Call time (studio) | Call time (visitor) | Call start (UTC) | Visitor timezone | Status |

---

## 2. Attach the script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete any default code in `Code.gs`.
3. Paste the full contents of **`Code.gs`** from this folder.
4. Confirm at the top of the file:

```javascript
var NOTIFY_EMAIL = 'hello@assiststudio.in';
var SPREADSHEET_ID = '';   // leave empty when script is bound to this Sheet
var SHEET_NAME = 'Leads';
```

5. **Save** the project (name it e.g. `AssistStudio Booking`).

---

## 3. Deploy as web app

1. Click **Deploy → New deployment**.
2. Type: **Web app**.
3. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone  
     (required so the public website can POST without Google login)
4. **Deploy**.
5. Authorize when prompted (review permissions: spreadsheets + send email).
6. Copy the **Web app URL**  
   (looks like `https://script.google.com/macros/s/XXXX/exec`).

If you change the code later: **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**.

---

## 4. Connect the website

In `index.html`, on the booking form, paste the web app URL into `data-endpoint`:

```html
<form id="book-form" novalidate data-endpoint="https://script.google.com/macros/s/XXXX/exec">
```

Leave `data-endpoint=""` for demo mode (no save / no email).

---

## 5. Test

1. Open the live site → Contact → submit with a real name + email.
2. Check the **Leads** sheet for a new row.
3. Check **hello@assiststudio.in** (and spam) for the notification.
4. Reply from your inbox should go to the visitor (`Reply-To` is their email).

---

## Email note (SMTP vs Google mail)

Apps Script sends mail with **`MailApp`** from the **Google account that owns the script**, not raw SMTP credentials in the browser.

Practical options:

- Own the script with a Google account and set `NOTIFY_EMAIL` to `hello@assiststudio.in`, or  
- Send to your Gmail and **forward** to `hello@assiststudio.in`, or  
- Use Google Workspace on `assiststudio.in` so the sending account is under your domain.

Daily Google mail quotas apply (usually enough for a contact form).

---

## Security notes

- The web app URL is public; only accept fields you expect (the script already requires name + email).
- Do not put SMTP passwords or API keys in the frontend.
- For heavy spam later, add a honeypot field or a form service in front.

---

## Switching later

When you move to a real API + database, keep the same JSON field names and only change `data-endpoint` to the new API URL.
