/* ============================================================
   Signal — Signup → Google Sheet sync (Google Apps Script)
   REFERENCE FILE — paste into Extensions → Apps Script, then
   Deploy → Manage deployments → Edit → New version → Deploy
   (keeps the same URL). Execute as: Me · Who has access: Anyone.

   Writes every signup to a dedicated "Signups" tab in the
   tracker sheet, so leads live in one clean, sortable list.
   ============================================================ */

var TRACKER_SHEET_ID = '1zIEipR_aJMiDk9XoT7LmEnXu4yg6cNgF';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(TRACKER_SHEET_ID);
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
