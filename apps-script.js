/**
 * ============================================================
 * KAS IT Dashboard v2 — Google Apps Script (Backend)
 * ============================================================
 * 
 * FILE INI HANYA COPY/REFERENSI.
 * Backend asli ada di: Google Sheet → Extensions → Apps Script
 * 
 * Kalau ada perubahan, UPDATE DI KEDUA TEMPAT:
 * 1. File ini (biar sinkron sebagai referensi)
 * 2. Google Apps Script editor (yang beneran jalan)
 * 
 * Setelah update di Apps Script, jangan lupa:
 * Deploy → Manage deployments → Edit → New version → Deploy
 * ============================================================
 * 
 * UNIFIED LEDGER — Transactions Sheet:
 * id | kategori | type | amount | status | memberNik | memberName | note | month | year | eventId | submittedAt | approvedAt | approvedBy | createdBy
 * 
 * Kategori: iuran, event, lainnya
 * Type: masuk, keluar
 * 
 * Members Sheet:
 * nik | name | position | isActive | activeFrom | password | isAdmin
 * 
 * Sessions Sheet:
 * token | createdAt | memberNik | memberName | isAdmin
 * ============================================================
 */

const SHEETS = {
  transactions: 'Transactions',
  members: 'Members',
  masterIuran: 'MasterIuran',
  events: 'Events',
  sessions: 'Sessions'
};

// Column index mapping for Transactions (1-based)
// id | kategori | type | amount | status | memberNik | memberName | note | month | year | eventId | submittedAt | approvedAt | approvedBy | createdBy
const TRX_COL = {
  id: 1,
  kategori: 2,
  type: 3,
  amount: 4,
  status: 5,
  memberNik: 6,
  memberName: 7,
  note: 8,
  month: 9,
  year: 10,
  eventId: 11,
  submittedAt: 12,
  approvedAt: 13,
  approvedBy: 14,
  createdBy: 15
};

// Auth config
const DEFAULT_PASS_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'; // SHA-256 of '123'
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function sha256(input) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  return raw.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function sheetToJson(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

// ============================================================
// GET
// ============================================================

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'transactions';
  let result;

  switch (action) {
    case 'members':
      result = sheetToJson(SHEETS.members).map(m => {
        const { password, ...safe } = m;
        return safe;
      });
      break;

    case 'masterIuran':
      result = sheetToJson(SHEETS.masterIuran);
      break;

    case 'events':
      result = sheetToJson(SHEETS.events);
      break;

    case 'transactions':
    default:
      result = sheetToJson(SHEETS.transactions);
      // Filter by kategori
      if (e && e.parameter && e.parameter.kategori) {
        result = result.filter(t => t.kategori === e.parameter.kategori);
      }
      // Filter by year
      if (e && e.parameter && e.parameter.year) {
        const year = parseInt(e.parameter.year);
        result = result.filter(t => parseInt(t.year) === year);
      }
      // Filter by eventId
      if (e && e.parameter && e.parameter.eventId) {
        result = result.filter(t => t.eventId === e.parameter.eventId);
      }
      break;
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ID Generators
// ============================================================

/**
 * Generate transaction ID: TRX-YYMMDD-NNN
 * Counter resets per day
 */
function generateTrxId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = 'TRX-' + yy + mm + dd + '-';

  const sheet = getSheet(SHEETS.transactions);
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]);
    if (id.startsWith(prefix)) {
      const num = parseInt(id.split('-')[2], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return prefix + String(maxNum + 1).padStart(3, '0');
}

/**
 * Generate event ID: EV-N (auto-increment)
 */
function generateEventId() {
  const sheet = getSheet(SHEETS.events);
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]);
    const match = id.match(/^EV-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return 'EV-' + (maxNum + 1);
}

// ============================================================
// POST
// ============================================================

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action || 'addTransaction';
  let result = { ok: true };

  switch (action) {

    // ---- AUTH ----

    case 'login': {
      // Login by NIK + password (from Members sheet)
      const membersSheet = getSheet(SHEETS.members);
      const membersData = membersSheet.getDataRange().getValues();
      const headers = membersData[0];
      const nikCol = headers.indexOf('nik');
      const nameCol = headers.indexOf('name');
      const passCol = headers.indexOf('password');
      const adminCol = headers.indexOf('isAdmin');
      const activeCol = headers.indexOf('isActive');
      const retryCol = headers.indexOf('retry_count');

      let found = false;
      for (let i = 1; i < membersData.length; i++) {
        if (String(membersData[i][nikCol]) === String(body.nik)) {
          // Check if active
          const isActive = membersData[i][activeCol];
          if (isActive !== true && isActive !== 'TRUE') {
            result = { ok: false, error: 'Akun tidak aktif' };
            found = true;
            break;
          }
          // Check retry count (locked after 3 failures)
          const retryCount = Number(membersData[i][retryCol]) || 0;
          if (retryCount >= 3) {
            result = { ok: false, error: 'Akun terkunci. Hubungi admin untuk reset password.' };
            found = true;
            break;
          }
          // Check password
          const storedPass = String(membersData[i][passCol] || '').trim();
          const inputHash = sha256(body.password);
          const passMatch = storedPass ? (inputHash === storedPass) : (inputHash === DEFAULT_PASS_HASH);
          if (passMatch) {
            // Reset retry count on success
            if (retryCount > 0) {
              membersSheet.getRange(i + 1, retryCol + 1).setValue(0);
            }
            const token = Utilities.getUuid();
            const memberName = membersData[i][nameCol];
            const isAdmin = membersData[i][adminCol] === true || membersData[i][adminCol] === 'TRUE';
            const mustChangePassword = !storedPass; // force change if no password set
            const sessSheet = getSheet(SHEETS.sessions);
            const nikStr = String(body.nik).trim(); // Use input NIK (preserves leading zeros)
            const newRow = sessSheet.getLastRow() + 1;
            sessSheet.getRange(newRow, 1, 1, 5).setValues([[token, new Date().toISOString(), nikStr, memberName, isAdmin]]);
            result.token = token;
            result.memberNik = nikStr;
            result.memberName = memberName;
            result.isAdmin = isAdmin;
            result.mustChangePassword = mustChangePassword;
          } else {
            // Increment retry count
            membersSheet.getRange(i + 1, retryCol + 1).setValue(retryCount + 1);
            const remaining = 2 - retryCount;
            if (remaining > 0) {
              result = { ok: false, error: 'Password salah. ' + remaining + ' percobaan lagi sebelum akun terkunci.' };
            } else {
              result = { ok: false, error: 'Akun terkunci. Hubungi admin untuk reset password.' };
            }
          }
          found = true;
          break;
        }
      }
      if (!found) {
        result = { ok: false, error: 'NIK tidak ditemukan' };
      }
      break;
    }

    case 'verifyToken': {
      const sheet = getSheet(SHEETS.sessions);
      const data = sheet.getDataRange().getValues();
      let valid = false;
      // Clean up all expired sessions (loop backwards to safely delete rows)
      for (let i = data.length - 1; i >= 1; i--) {
        const created = new Date(data[i][1]).getTime();
        if (Date.now() - created >= TOKEN_EXPIRY_MS) {
          sheet.deleteRow(i + 1);
        }
      }
      // Re-read after cleanup
      const freshData = sheet.getDataRange().getValues();
      for (let i = 1; i < freshData.length; i++) {
        if (freshData[i][0] === body.token) {
          valid = true;
          // Auto-refresh: extend token expiry on activity
          sheet.getRange(i + 1, 2).setValue(new Date().toISOString());
          result.memberNik = String(freshData[i][2] || '');
          result.memberName = String(freshData[i][3] || '');
          result.isAdmin = freshData[i][4] === true || freshData[i][4] === 'TRUE';
          break;
        }
      }
      result.valid = valid;
      break;
    }

    case 'logout': {
      const sheet = getSheet(SHEETS.sessions);
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === body.token) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      break;
    }

    case 'changePassword': {
      // Use memberNik from body (frontend sends from sessionStorage which preserves leading zeros)
      let memberNik = body.memberNik ? String(body.memberNik).trim() : '';
      
      // Fallback: try to get from session if not provided
      if (!memberNik) {
        const sessSheet = getSheet(SHEETS.sessions);
        const sessData = sessSheet.getDataRange().getValues();
        for (let i = 1; i < sessData.length; i++) {
          if (sessData[i][0] === body.token) {
            const created = new Date(sessData[i][1]).getTime();
            if (Date.now() - created < TOKEN_EXPIRY_MS) {
              memberNik = String(sessData[i][2] || '').trim();
            }
            break;
          }
        }
      }
      if (!memberNik) {
        result = { ok: false, error: 'Token tidak valid atau session expired' };
        break;
      }
      if (!body.newPasswordHash) {
        result = { ok: false, error: 'Password baru wajib diisi' };
        break;
      }
      const membersSheet = getSheet(SHEETS.members);
      const membersData = membersSheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < membersData.length; i++) {
        if (String(membersData[i][0]).trim() === memberNik) {
          membersSheet.getRange(i + 1, 6).setValue(body.newPasswordHash);
          updated = true;
          break;
        }
      }
      if (!updated) {
        result = { ok: false, error: 'Member tidak ditemukan (NIK: ' + memberNik + ')' };
      }
      break;
    }

    case 'resetMemberPassword': {
      // Admin action: clear password + reset retry_count (force user to set new password on next login)
      if (!body.nik) { result = { ok: false, error: 'NIK wajib diisi' }; break; }
      const membersSheet = getSheet(SHEETS.members);
      const membersData = membersSheet.getDataRange().getValues();
      const headers = membersData[0];
      const nikCol = headers.indexOf('nik');
      const passCol = headers.indexOf('password');
      const retryCol = headers.indexOf('retry_count');
      let found = false;
      for (let i = 1; i < membersData.length; i++) {
        if (String(membersData[i][nikCol]).trim() === String(body.nik).trim()) {
          membersSheet.getRange(i + 1, passCol + 1).setValue('');
          membersSheet.getRange(i + 1, retryCol + 1).setValue(0);
          found = true;
          break;
        }
      }
      if (!found) { result = { ok: false, error: 'Member tidak ditemukan' }; }
      break;
    }

    // ---- TRANSACTIONS (unified) ----

    case 'addTransaction': {
      const sheet = getSheet(SHEETS.transactions);
      const id = generateTrxId();
      const kategori = body.kategori || 'iuran';

      // Duplicate check for event payments
      if (kategori === 'event' && body.eventId && body.memberNik) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][TRX_COL.eventId - 1]) === body.eventId &&
              String(data[i][TRX_COL.memberNik - 1]) === body.memberNik &&
              String(data[i][TRX_COL.kategori - 1]) === 'event' &&
              data[i][TRX_COL.status - 1] !== 'rejected') {
            result = { ok: false, error: 'Sudah pernah bayar event ini' };
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      const row = [
        id,
        kategori,
        body.type || 'masuk',
        body.amount,
        body.status || 'pending',
        String(body.memberNik || ''),
        body.memberName || '',
        body.note || '',
        body.month || '',
        body.year || '',
        body.eventId || '',
        body.submittedAt || new Date().toISOString(),
        body.approvedAt || '',
        body.approvedBy || '',
        body.createdBy || ''
      ];
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, 15).setValues([row]);
      result.id = id;
      break;
    }

    case 'approveTransaction': {
      const sheet = getSheet(SHEETS.transactions);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          sheet.getRange(i + 1, TRX_COL.status).setValue('approved');
          sheet.getRange(i + 1, TRX_COL.approvedAt).setValue(body.approvedAt || new Date().toISOString());
          sheet.getRange(i + 1, TRX_COL.approvedBy).setValue(body.approvedBy || '');
          break;
        }
      }
      break;
    }

    case 'rejectTransaction': {
      const sheet = getSheet(SHEETS.transactions);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          sheet.getRange(i + 1, TRX_COL.status).setValue('rejected');
          break;
        }
      }
      break;
    }

    case 'deleteTransaction': {
      const sheet = getSheet(SHEETS.transactions);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      break;
    }

    case 'bulkAddTransactions': {
      const sheet = getSheet(SHEETS.transactions);
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const prefix = 'TRX-' + yy + mm + dd + '-';
      const data = sheet.getDataRange().getValues();
      let maxNum = 0;
      for (let i = 1; i < data.length; i++) {
        const id = String(data[i][0]);
        if (id.startsWith(prefix)) {
          const num = parseInt(id.split('-')[2], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const rows = body.transactions.map((t, idx) => [
        prefix + String(maxNum + idx + 1).padStart(3, '0'),
        t.kategori || 'iuran',
        t.type || 'masuk',
        t.amount,
        t.status || 'pending',
        String(t.memberNik || ''),
        t.memberName || '',
        t.note || '',
        t.month || '',
        t.year || '',
        t.eventId || '',
        t.submittedAt || new Date().toISOString(),
        t.approvedAt || '',
        t.approvedBy || '',
        t.createdBy || ''
      ]);
      if (rows.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, 15).setValues(rows);
      }
      result.count = rows.length;
      break;
    }

    // ---- MEMBERS ----

    case 'addMember': {
      const sheet = getSheet(SHEETS.members);
      const row = [
        body.nik,
        body.name,
        body.position,
        body.isActive !== undefined ? body.isActive : true,
        body.activeFrom || '',
        '',  // password (empty = default "123")
        body.isAdmin || false
      ];
      sheet.appendRow(row);
      break;
    }

    case 'updateMember': {
      const sheet = getSheet(SHEETS.members);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.nik) {
          if (body.name !== undefined) sheet.getRange(i + 1, 2).setValue(body.name);
          if (body.position !== undefined) sheet.getRange(i + 1, 3).setValue(body.position);
          if (body.isActive !== undefined) sheet.getRange(i + 1, 4).setValue(body.isActive);
          if (body.activeFrom !== undefined) sheet.getRange(i + 1, 5).setValue(body.activeFrom);
          if (body.isAdmin !== undefined) sheet.getRange(i + 1, 7).setValue(body.isAdmin);
          break;
        }
      }
      break;
    }

    case 'toggleMember': {
      const sheet = getSheet(SHEETS.members);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.nik) {
          const current = data[i][3];
          const newVal = !(current === true || current === 'TRUE');
          sheet.getRange(i + 1, 4).setValue(newVal);
          result.isActive = newVal;
          break;
        }
      }
      break;
    }

    case 'deleteMember': {
      const sheet = getSheet(SHEETS.members);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.nik) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      break;
    }

    // ---- MASTER IURAN ----

    case 'updateMasterIuran': {
      const sheet = getSheet(SHEETS.masterIuran);
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === body.position) {
          sheet.getRange(i + 1, 2).setValue(body.amount);
          found = true;
          break;
        }
      }
      if (!found) sheet.appendRow([body.position, body.amount]);
      break;
    }

    // ---- EVENTS ----

    case 'addEvent': {
      const sheet = getSheet(SHEETS.events);
      const id = generateEventId();
      const row = [
        id,
        body.name,
        'active',
        body.iuranDirektur || 0,
        body.iuranSeniorManager || 0,
        body.iuranJuniorManager || 0,
        body.iuranCoordinator || 0,
        body.createdBy || '',
        new Date().toISOString()
      ];
      sheet.appendRow(row);
      result.id = id;
      break;
    }

    case 'updateEvent': {
      const sheet = getSheet(SHEETS.events);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          if (body.name !== undefined) sheet.getRange(i + 1, 2).setValue(body.name);
          if (body.iuranDirektur !== undefined) sheet.getRange(i + 1, 4).setValue(body.iuranDirektur);
          if (body.iuranSeniorManager !== undefined) sheet.getRange(i + 1, 5).setValue(body.iuranSeniorManager);
          if (body.iuranJuniorManager !== undefined) sheet.getRange(i + 1, 6).setValue(body.iuranJuniorManager);
          if (body.iuranCoordinator !== undefined) sheet.getRange(i + 1, 7).setValue(body.iuranCoordinator);
          break;
        }
      }
      break;
    }

    case 'closeEvent': {
      const sheet = getSheet(SHEETS.events);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          sheet.getRange(i + 1, 3).setValue('closed');
          break;
        }
      }
      break;
    }

    case 'reopenEvent': {
      const sheet = getSheet(SHEETS.events);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          sheet.getRange(i + 1, 3).setValue('active');
          break;
        }
      }
      break;
    }

    case 'deleteEvent': {
      const sheet = getSheet(SHEETS.events);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === body.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      // Also delete related transactions (kategori=event, eventId matches)
      const tSheet = getSheet(SHEETS.transactions);
      const tData = tSheet.getDataRange().getValues();
      for (let i = tData.length - 1; i >= 1; i--) {
        if (String(tData[i][TRX_COL.kategori - 1]) === 'event' &&
            String(tData[i][TRX_COL.eventId - 1]) === body.id) {
          tSheet.deleteRow(i + 1);
        }
      }
      break;
    }

    // ---- DEFAULT ----

    default:
      result = { ok: false, error: 'Unknown action' };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
