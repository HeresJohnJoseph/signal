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

    // --- Brand request: zero-token demand capture. Every brand a user asks
    //     for (that isn't on the platform) lands here, enriched with their
    //     segment from the Signups tab, so John can measure latent demand —
    //     volume, breadth, velocity — by market and by segment. ---
    if (data.type === 'brand_request') {
      const br = ss.getSheetByName('Brand Requests') || ss.insertSheet('Brand Requests');
      if (br.getLastRow() === 0) {
        br.appendRow(['Timestamp', 'Brand', 'Market', 'Requested by', 'Segment (Role)', 'Industry', 'Team Size']);
        br.getRange(1, 1, 1, 7).setFontWeight('bold');
      }
      // Enrich with the requester's signup profile (join on email) so the
      // demand pivot can break out agency vs SMM vs freelancer with no extra UI.
      var seg = '', ind = '', team = '';
      var reqEmail = (data.email || '').toString().trim().toLowerCase();
      if (reqEmail) {
        var signups = ss.getSheetByName('Signups');
        if (signups && signups.getLastRow() > 1) {
          var rows = signups.getDataRange().getValues();
          // Signups columns: Timestamp, Name, Email(2), Company & Role(3), Industry(4), Team Size(5)
          for (var i = 1; i < rows.length; i++) {
            if (String(rows[i][2]).trim().toLowerCase() === reqEmail) {
              seg = rows[i][3] || ''; ind = rows[i][4] || ''; team = rows[i][5] || '';
              break;
            }
          }
        }
      }
      br.appendRow([
        data.timestamp || new Date().toISOString(),
        data.brand || '',
        (data.market || '').toString().toUpperCase(),
        data.email || '',
        seg, ind, team
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
