/**
 * AssistStudio — Discovery Call form backend
 * Google Apps Script: saves each submission to a Sheet + emails hello@assiststudio.in
 *
 * SETUP: see SETUP.md in this folder.
 */

// ===== CONFIG (edit these) =====
var NOTIFY_EMAIL = 'hello@assiststudio.in';
// Optional: spreadsheet ID if this script is NOT bound to the sheet
// (File → Share → copy ID from URL). Leave '' when the script is container-bound to the sheet.
var SPREADSHEET_ID = '';
var SHEET_NAME = 'Leads';

/**
 * Receive POST from the website form.
 * Body is JSON (sent as text/plain to avoid CORS preflight).
 */
function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var name = str_(data.Name || data.name);
    var email = str_(data.Email || data.email);
    var phone = str_(data.Phone || data.phone);
    var project = str_(data['What they are building'] || data.project);
    var timeStudio = str_(data['Call time (your timezone)'] || data.call_time_studio);
    var timeVisitor = str_(data['Call time (their timezone)'] || data.call_time_visitor);
    var timeUtc = str_(data['Call start (UTC)'] || data.call_start_utc);
    var visitorTz = str_(data.visitor_timezone || data['Visitor timezone']);
    var subjectHint = str_(data._subject);

    if (!name || !email) {
      return json_({ ok: false, error: 'Name and email are required.' });
    }

    appendLead_({
      name: name,
      email: email,
      phone: phone,
      project: project,
      timeStudio: timeStudio,
      timeVisitor: timeVisitor,
      timeUtc: timeUtc,
      visitorTz: visitorTz
    });

    sendNotifyEmail_({
      name: name,
      email: email,
      phone: phone,
      project: project,
      timeStudio: timeStudio,
      timeVisitor: timeVisitor,
      timeUtc: timeUtc,
      visitorTz: visitorTz,
      subjectHint: subjectHint
    });

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Health check in browser */
function doGet() {
  return json_({ ok: true, service: 'AssistStudio booking', version: 1 });
}

// ===== Sheet =====

function getSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found. Bind the script to a Sheet or set SPREADSHEET_ID.');

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Header row if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp',
      'Name',
      'Email',
      'Phone',
      'Project',
      'Call time (studio)',
      'Call time (visitor)',
      'Call start (UTC)',
      'Visitor timezone',
      'Status'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendLead_(row) {
  var sheet = getSheet_();
  sheet.appendRow([
    new Date(),
    row.name,
    row.email,
    row.phone,
    row.project,
    row.timeStudio,
    row.timeVisitor,
    row.timeUtc,
    row.visitorTz,
    'new'
  ]);
}

// ===== Email (Gmail / Google account that owns the script) =====
// This uses Google's mail service (not raw SMTP). For a custom domain inbox,
// use a Google account that receives or forwards to hello@assiststudio.in,
// or set NOTIFY_EMAIL to that address and forward from Gmail.

function sendNotifyEmail_(row) {
  var subject = row.subjectHint
    ? row.subjectHint
    : ('Discovery call request: ' + row.name);

  var body = [
    'New discovery call request from the website.',
    '',
    'Name:    ' + row.name,
    'Email:   ' + row.email,
    'Phone:   ' + (row.phone || '—'),
    'Project: ' + (row.project || '—'),
    '',
    'Preferred time (studio):  ' + (row.timeStudio || '—'),
    'Preferred time (visitor): ' + (row.timeVisitor || '—'),
    'Start (UTC):              ' + (row.timeUtc || '—'),
    'Visitor timezone:         ' + (row.visitorTz || '—'),
    '',
    '— AssistStudio website form'
  ].join('\n');

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: body,
    replyTo: row.email,
    name: 'AssistStudio Website'
  });
}

// ===== Helpers =====

function str_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}