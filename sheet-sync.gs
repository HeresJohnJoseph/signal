/* ============================================================
   Signal — Apps Script backend (project: "Signal Signups Backend")
   REFERENCE FILE — this MUST match the live standalone Apps Script.

   ⚠️ DEPLOYMENT NOTES (read before changing anything):
   - The tracker workbook is an UPLOADED .xlsx, so it cannot host a
     bound script and has no Extensions → Apps Script menu. The live
     code lives in a SEPARATE Apps Script project, opened from
     https://script.google.com/home → "Signal Signups Backend".
   - The live code writes via SpreadsheetApp.getActiveSpreadsheet(),
     i.e. it is bound to a native Google Sheet (NOT the .xlsx tracker).
     Do NOT switch this to openById(<xlsx id>) — openById can't open an
     .xlsx as a Sheet and it would break signup capture.
   - There are TWO web-app deployments. The app posts to the one whose
     URL starts AKfycbxFSOZ7… (see APPS_SCRIPT_URL in cs-data.jsx /
     signup.html). When redeploying, update THAT deployment via
     Deploy → Manage deployments → (pencil) → Version: New version,
     so the URL stays the same.

   To update: paste this over Code.gs, Save, then redeploy the
   AKfycbxFSOZ7… deployment as a New version.

   Handles:
   - Beta signups  → appends to the active sheet + emails John (unchanged).
   - Brand requests ({type:'brand_request'}) → "Brand Requests" tab,
     enriched with the requester's segment for the demand framework.
   ============================================================ */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- Brand request: zero-token demand capture. Logs brands users ask for
    //     (that aren't on the platform) to a "Brand Requests" tab, enriched with
    //     the requester's signup segment so demand can be measured by segment. ---
    if (data.type === 'brand_request') {
      var br = ss.getSheetByName('Brand Requests') || ss.insertSheet('Brand Requests');
      if (br.getLastRow() === 0) {
        br.appendRow(['Timestamp', 'Brand', 'Market', 'Requested by', 'Segment (Role)', 'Industry', 'Team Size']);
        br.getRange(1, 1, 1, 7).setFontWeight('bold');
      }
      var seg = '', ind = '', team = '';
      var reqEmail = (data.email || '').toString().trim().toLowerCase();
      var signupsTab = ss.getSheetByName('Signups') || ss.getSheets()[0];
      if (reqEmail && signupsTab && signupsTab.getLastRow() > 1) {
        var rows = signupsTab.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][2]).trim().toLowerCase() === reqEmail) {
            seg = rows[i][3] || ''; ind = rows[i][4] || ''; team = rows[i][5] || '';
            break;
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

    // --- Default: a beta signup (unchanged from the live deployment) ---
    const sheet = ss.getActiveSheet();

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'Name', 'Email', 'Company & Role',
        'Industry', 'Team Size', 'Report Time (monthly)',
        'Referral Source', 'Status', 'Notes'
      ]);
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
      'New',
      ''
    ]);

    MailApp.sendEmail({
      to: 'johnjayjoseph1127@gmail.com',
      subject: 'New Signal signup — ' + (data.name || 'Unknown'),
      body: [
        'New signup on Signal:',
        '',
        'Name: ' + data.name,
        'Email: ' + data.email,
        'Company & Role: ' + data.company_role,
        'Industry: ' + data.industry,
        'Team size: ' + data.team_size,
        'Report time/month: ' + data.report_time,
        'Referred by: ' + (data.referral_source || 'Direct')
      ].join('\n')
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
