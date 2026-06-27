/* ============================================================
   Signal — Signup → Google Sheet sync (Google Apps Script)
   REFERENCE FILE — paste into Extensions → Apps Script, then
   Deploy → Manage deployments → Edit → New version → Deploy
   (keeps the same URL). Execute as: Me · Who has access: Anyone.

   Writes every signup to a dedicated "Signups" tab in the
   tracker sheet, so leads live in one clean, sortable list.

   Also handles Stripe Pro grants: a POST with {type:'pro', email}
   (sent by /api/stripe-webhook on a completed checkout) appends the
   paying email to the "Pro" tab, which api/analyze.js reads to let
   paying customers bypass the invite-only beta allowlist.
   ============================================================ */

var TRACKER_SHEET_ID = '1zIEipR_aJMiDk9XoT7LmEnXu4yg6cNgF';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(TRACKER_SHEET_ID);

    // --- Stripe Pro grant: record the paying email in the "Pro" tab ---
    if (data.type === 'pro') {
      const email = (data.email || '').toString().trim().toLowerCase();
      if (email) {
        const pro = ss.getSheetByName('Pro') || ss.insertSheet('Pro');
        if (pro.getLastRow() === 0) {
          pro.appendRow(['Email', 'Granted', 'Source']);
          pro.getRange(1, 1, 1, 3).setFontWeight('bold');
        }
        const existing = pro.getRange(1, 1, Math.max(1, pro.getLastRow()), 1)
          .getValues().map(function (r) { return String(r[0]).trim().toLowerCase(); });
        if (existing.indexOf(email) < 0) {
          pro.appendRow([email, new Date().toISOString(), data.source || 'stripe']);
          MailApp.sendEmail({
            to: 'johnjayjoseph1127@gmail.com',
            subject: '◈ New Signal PRO customer — ' + email,
            body: 'A new paying customer was just granted Pro access:\n\n' + email
          });
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', pro: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- Brand search log: record every brand searched in the app so John
    //     knows what's in demand and which brands to add to the dataset. ---
    if (data.type === 'brand_search') {
      const bs = ss.getSheetByName('Brand Requests') || ss.insertSheet('Brand Requests');
      if (bs.getLastRow() === 0) {
        bs.appendRow(['Timestamp', 'Brand', 'Market', 'In dataset?', 'Category', 'Searched by']);
        bs.getRange(1, 1, 1, 6).setFontWeight('bold');
      }
      bs.appendRow([
        data.timestamp || new Date().toISOString(),
        data.brand || '',
        (data.market || '').toString().toUpperCase(),
        data.known === 'yes' ? 'Yes' : 'No — add',
        data.category || '',
        data.email || ''
      ]);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', logged: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- Default: a beta signup → "Signups" tab ---
    const sheet = ss.getSheetByName('Signups') || ss.insertSheet('Signups');

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'Name', 'Email', 'Company & Role',
        'Industry', 'Team Size', 'Report Time (monthly)',
        'Referral Source', 'Status', 'Notes'
      ]);
      // Bold header row
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name || '',
      data.email || '',
      data.company_role || '',
      data.industry || '',
      data.team_size || '',
      data.report_time || '',
      data.referral_source || '',
      'New',   // Default status
      ''       // Notes — fill in manually
    ]);

    // Email notification to John
    MailApp.sendEmail({
      to: 'johnjayjoseph1127@gmail.com',
      subject: '◈ New Signal signup — ' + (data.name || 'Unknown'),
      body: [
        'New signup on Signal:',
        '',
        'Name: ' + data.name,
        'Email: ' + data.email,
        'Company & Role: ' + data.company_role,
        'Industry: ' + data.industry,
        'Team size: ' + data.team_size,
        'Report time/month: ' + data.report_time,
        'Referred by: ' + (data.referral_source || 'Direct'),
        '',
        'View sheet: REPLACE_WITH_YOUR_SHEET_URL',
      ].join('\n')
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
