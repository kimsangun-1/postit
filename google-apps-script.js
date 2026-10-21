/**
 * ==========================================================================
 * Google Sheets 연동 Post-it Todo List 백엔드 스크립트 (Google Apps Script)
 * ==========================================================================
 * 
 * [시트 구조 가이드]
 * 시트 이름: 'todos' (또는 첫 번째 기본 시트)
 * 헤더 행 (1행):
 *   A열: timestamp  - 고유 식별자(PK, 밀리초 단위 타임스탬프)
 *   B열: datetime   - 작성일시 (예: "2026. 10. 21. 오후 6:30")
 *   C열: category   - 카테고리 (예: "업무 💼")
 *   D열: content    - 메모 내용
 *   E열: color      - 포스트잇 색상 ("yellow" | "pink" | "green" | "blue")
 *   F열: state      - 상태 ("완료" | "미완료")
 *   G열: order      - 정렬 순서 번호 (정수, 1부터 시작)
 */

const SHEET_NAME = "todos";

/**
 * GET 요청 처리 (목록 조회)
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "read";

    if (action === "read") {
      return handleRead();
    }

    return createJsonResponse({
      success: false,
      error: "지원하지 않는 GET 액션입니다: " + action
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * POST 요청 처리 (Create, Update, Delete, Reorder 등)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const successLock = lock.tryLock(10000); // 최대 10초 대기

  if (!successLock) {
    return createJsonResponse({
      success: false,
      error: "다른 요청을 처리 중입니다. 잠시 후 다시 시도해 주세요."
    });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        error: "요청 본문(Body) 데이터가 비어 있습니다."
      });
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        success: false,
        error: "유효한 JSON 포맷이 아닙니다: " + parseErr.message
      });
    }

    const action = payload.action;

    switch (action) {
      case "create":
        return handleCreate(payload.data);

      case "update":
        return handleUpdate(payload.data);

      case "delete":
        return handleDelete(payload.data);

      case "reorder":
        return handleReorder(payload.data);

      default:
        return createJsonResponse({
          success: false,
          error: "지원하지 않는 POST 액션입니다: " + action
        });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: "서버 처리 중 오류 발생: " + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 시트 객체 가져오기 및 헤더 자동 초기화
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  // 데이터가 아예 비어있으면 헤더 작성
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp", "datetime", "category", "content", "color", "state", "order"]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f0f0f0");
  }

  return sheet;
}

/**
 * 1. 메모 목록 조회 (Read)
 */
function handleRead() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return createJsonResponse({ success: true, data: [] });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  const todos = values.map(function(row) {
    return {
      timestamp: String(row[0]),
      datetime: String(row[1]),
      category: String(row[2]),
      content: String(row[3]),
      color: String(row[4] || "yellow"),
      state: String(row[5] || "미완료"),
      order: Number(row[6]) || 0
    };
  }).filter(function(item) {
    return item.timestamp.trim() !== "";
  });

  todos.sort(function(a, b) {
    return a.order - b.order;
  });

  return createJsonResponse({
    success: true,
    data: todos
  });
}

/**
 * 2. 새 메모 추가 (Create)
 */
function handleCreate(data) {
  if (!data) {
    return createJsonResponse({ success: false, error: "전송된 데이터가 없습니다." });
  }

  const content = (data.content || "").trim();
  if (!content) {
    return createJsonResponse({ success: false, error: "메모 내용이 비어 있습니다." });
  }

  const sheet = getSheet();
  const now = new Date();

  const timestamp = data.timestamp ? String(data.timestamp) : String(now.getTime());
  const datetime = data.datetime || Utilities.formatDate(now, "Asia/Seoul", "yyyy. MM. dd. a hh:mm");
  const category = (data.category || "업무 💼").trim();
  const color = data.color || "yellow";
  const state = data.state || "미완료";

  const lastRow = sheet.getLastRow();
  let nextOrder = 1;

  if (lastRow > 1) {
    const orderRange = sheet.getRange(2, 7, lastRow - 1, 1);
    const orderValues = orderRange.getValues();
    for (let i = 0; i < orderValues.length; i++) {
      const currentVal = Number(orderValues[i][0]) || (i + 1);
      orderValues[i][0] = currentVal + 1;
    }
    orderRange.setValues(orderValues);
  }

  sheet.appendRow([timestamp, datetime, category, content, color, state, nextOrder]);

  return createJsonResponse({
    success: true,
    message: "메모가 성공적으로 추가되었습니다.",
    data: {
      timestamp: timestamp,
      datetime: datetime,
      category: category,
      content: content,
      color: color,
      state: state,
      order: nextOrder
    }
  });
}

/**
 * 3. 메모 수정 (Update)
 */
function handleUpdate(data) {
  if (!data || !data.timestamp) {
    return createJsonResponse({
      success: false,
      error: "수정 대상의 timestamp(고유 식별자)가 필요합니다."
    });
  }

  if (data.content !== undefined && data.content.trim() === "") {
    return createJsonResponse({
      success: false,
      error: "메모 내용은 공백일 수 없습니다."
    });
  }

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return createJsonResponse({ success: false, error: "수정할 데이터가 시트에 없습니다." });
  }

  const targetId = String(data.timestamp);
  const idRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  let targetRowIndex = -1;
  for (let i = 0; i < idRange.length; i++) {
    if (String(idRange[i][0]) === targetId) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (targetRowIndex === -1) {
    return createJsonResponse({
      success: false,
      error: "해당 timestamp를 가진 메모를 찾을 수 없습니다: " + targetId
    });
  }

  const rowRange = sheet.getRange(targetRowIndex, 1, 1, 7);
  const rowValues = rowRange.getValues()[0];

  if (data.category !== undefined) rowValues[2] = String(data.category);
  if (data.content !== undefined)  rowValues[3] = String(data.content).trim();
  if (data.color !== undefined)    rowValues[4] = String(data.color);
  if (data.state !== undefined)    rowValues[5] = String(data.state);
  if (data.order !== undefined)    rowValues[6] = Number(data.order);

  rowRange.setValues([rowValues]);

  return createJsonResponse({
    success: true,
    message: "메모가 성공적으로 수정되었습니다.",
    data: {
      timestamp: String(rowValues[0]),
      datetime: String(rowValues[1]),
      category: String(rowValues[2]),
      content: String(rowValues[3]),
      color: String(rowValues[4]),
      state: String(rowValues[5]),
      order: Number(rowValues[6])
    }
  });
}

/**
 * 4. 메모 삭제 (Delete)
 */
function handleDelete(data) {
  if (!data || !data.timestamp) {
    return createJsonResponse({
      success: false,
      error: "삭제 대상의 timestamp(고유 식별자)가 필요합니다."
    });
  }

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return createJsonResponse({ success: false, error: "삭제할 데이터가 없습니다." });
  }

  const targetId = String(data.timestamp);
  const idRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  let targetRowIndex = -1;
  for (let i = 0; i < idRange.length; i++) {
    if (String(idRange[i][0]) === targetId) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (targetRowIndex === -1) {
    return createJsonResponse({
      success: false,
      error: "삭제할 메모를 찾을 수 없습니다: " + targetId
    });
  }

  sheet.deleteRow(targetRowIndex);

  const newLastRow = sheet.getLastRow();
  if (newLastRow > 1) {
    const remainingOrders = sheet.getRange(2, 7, newLastRow - 1, 1).getValues();
    for (let j = 0; j < remainingOrders.length; j++) {
      remainingOrders[j][0] = j + 1;
    }
    sheet.getRange(2, 7, newLastRow - 1, 1).setValues(remainingOrders);
  }

  return createJsonResponse({
    success: true,
    message: "메모가 성공적으로 삭제되었습니다."
  });
}

/**
 * 5. 순서 일괄 재배열 (Reorder)
 */
function handleReorder(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return createJsonResponse({
      success: false,
      error: "순서 변경 대상 목록이 올바르지 않습니다."
    });
  }

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return createJsonResponse({ success: true, message: "변경할 데이터가 없습니다." });
  }

  const orderMap = {};
  for (let k = 0; k < data.length; k++) {
    if (data[k].timestamp) {
      orderMap[String(data[k].timestamp)] = Number(data[k].order);
    }
  }

  const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const orderRange = sheet.getRange(2, 7, lastRow - 1, 1);
  const orderValues = orderRange.getValues();

  for (let i = 0; i < idValues.length; i++) {
    const id = String(idValues[i][0]);
    if (orderMap[id] !== undefined) {
      orderValues[i][0] = orderMap[id];
    }
  }

  orderRange.setValues(orderValues);

  return createJsonResponse({
    success: true,
    message: "순서가 성공적으로 갱신되었습니다."
  });
}

/**
 * JSON 응답 생성 헬퍼
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
