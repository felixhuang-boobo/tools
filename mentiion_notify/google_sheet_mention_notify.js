/**
 * Google Sheets @人（智能芯片）自动邮件通知脚本
 * 
 * 前置条件：需要在 Services 中添加 Google Sheets API
 * 
 * 使用方式：
 * 1. 打开 Google Sheet → 扩展程序 → Apps Script
 * 2. 左侧 Services 点 + → 添加 Google Sheets API
 * 3. 粘贴此代码
 * 4. 添加触发器：选择 onEditInstallable → 事件类型选"编辑时"
 * 5. 首次运行需要授权 Gmail 权限
 */

var NOTIFY_SUBJECT = "【Google Sheet 通知】你被提及了";

function onEditInstallable(e) {
  if (!e || !e.range) return;
  var sheet = e.source.getActiveSheet();
  var cell = e.range;
  var value = cell.getValue().toString();
  if (!value || value.trim() === "") return;

  var emails = getEmailsViaApi(e.source, sheet, cell);

  if (emails.length === 0) {
    var regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    var matches = value.match(regex);
    if (matches) {
      matches.forEach(function(m) {
        var lower = m.toLowerCase();
        if (emails.indexOf(lower) === -1) emails.push(lower);
      });
    }
  }

  if (emails.length === 0) return;

  var row = cell.getRow();
  var lastCol = sheet.getLastColumn();
  var rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var sheetName = sheet.getName();
  var sheetUrl = e.source.getUrl() + "#gid=" + sheet.getSheetId();
  var cellRef = cell.getA1Notation();

  var emailBody = buildEmailBody(headers, rowData, sheetName, cellRef, sheetUrl);
  var htmlBody = buildHtmlBody(headers, rowData, sheetName, cellRef, sheetUrl);

  emails.forEach(function(email) {
    try {
      GmailApp.sendEmail(email, NOTIFY_SUBJECT, emailBody, { htmlBody: htmlBody });
    } catch (err) {}
  });
}


function getEmailsViaApi(spreadsheet, sheet, cell) {
  var emails = [];
  try {
    var ssId = spreadsheet.getId();
    var sheetName = sheet.getName();
    var cellRef = cell.getA1Notation();
    var range = "'" + sheetName + "'!" + cellRef;

    var response = Sheets.Spreadsheets.get(ssId, {
      ranges: [range],
      includeGridData: true
    });

    var fullJson = JSON.stringify(response);
    var allEmails = extractEmailsFromText(fullJson);
    allEmails.forEach(function(em) {
      if (emails.indexOf(em) === -1) emails.push(em);
    });
  } catch (err) {}
  return emails;
}

function extractEmailsFromText(text) {
  var regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  var matches = text.match(regex);
  if (!matches) return [];
  var unique = [];
  matches.forEach(function(email) {
    var lower = email.toLowerCase();
    if (unique.indexOf(lower) === -1) unique.push(lower);
  });
  return unique;
}

function buildEmailBody(headers, rowData, sheetName, cellRef, sheetUrl) {
  var body = "你好，你在 Google Sheet 中被提及了。\n\n";
  body += "Sheet: " + sheetName + " | 位置: " + cellRef + "\n\n";
  body += "--- 该行完整内容 ---\n\n";
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i] || ("列" + (i + 1));
    var val = rowData[i] !== undefined && rowData[i] !== "" ? rowData[i] : "-";
    body += header + ": " + val + "\n";
  }
  body += "\n链接: " + sheetUrl + "\n";
  return body;
}

function buildHtmlBody(headers, rowData, sheetName, cellRef, sheetUrl) {
  var html = '<div style="font-family:Arial,sans-serif;max-width:600px">';
  html += '<h3 style="color:#1a73e8">Google Sheet 提及通知</h3>';
  html += '<p>你好，你在 <b>' + sheetName + '</b> 的 <b>' + cellRef + '</b> 处被提及了。</p>';
  html += '<table style="border-collapse:collapse;width:100%;margin:16px 0">';
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i] || ("列" + (i + 1));
    var val = rowData[i] !== undefined && rowData[i] !== "" ? rowData[i] : "-";
    var bg = i % 2 === 0 ? "#f8f9fa" : "#fff";
    html += '<tr style="background:' + bg + '">';
    html += '<td style="padding:8px 12px;border:1px solid #e0e0e0;font-weight:bold;width:30%">' + header + '</td>';
    html += '<td style="padding:8px 12px;border:1px solid #e0e0e0">' + val + '</td>';
    html += '</tr>';
  }
  html += '</table>';
  html += '<p><a href="' + sheetUrl + '" style="color:#1a73e8">点击查看原始 Sheet</a></p></div>';
  return html;
}
