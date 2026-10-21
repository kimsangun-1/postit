export interface SheetTodoItem {
  timestamp: string;
  datetime: string;
  category: string;
  content: string;
  color: "yellow" | "pink" | "green" | "blue";
  state: "완료" | "미완료";
  order: number;
}

// 1. 시트 메모 목록 조회
export async function fetchSheetTodos(customUrl?: string): Promise<{
  success: boolean;
  data?: SheetTodoItem[];
  error?: string;
  notConfigured?: boolean;
}> {
  try {
    const endpoint = customUrl
      ? `${customUrl}${customUrl.includes("?") ? "&" : "?"}action=read`
      : "/api/todos?action=read";

    const res = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
    });

    return await res.json();
  } catch (err) {
    return { success: false, error: "서버 통신 실패: " + String(err) };
  }
}

// 2. 새 메모 추가
export async function createSheetTodo(
  payload: {
    timestamp: string;
    datetime: string;
    category: string;
    content: string;
    color: string;
    state: string;
    order: number;
  },
  customUrl?: string
) {
  try {
    const endpoint = customUrl || "/api/todos";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", data: payload }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: "메모 추가 요청 실패: " + String(err) };
  }
}

// 3. 메모 수정 (내용, 카테고리, 상태, 순서 등)
export async function updateSheetTodo(
  payload: {
    timestamp: string;
    content?: string;
    category?: string;
    state?: string;
    order?: number;
    color?: string;
  },
  customUrl?: string
) {
  try {
    const endpoint = customUrl || "/api/todos";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", data: payload }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: "메모 수정 요청 실패: " + String(err) };
  }
}

// 4. 메모 삭제
export async function deleteSheetTodo(
  timestamp: string,
  customUrl?: string
) {
  try {
    const endpoint = customUrl || "/api/todos";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", data: { timestamp } }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: "메모 삭제 요청 실패: " + String(err) };
  }
}

// 5. 드래그 앤 드롭 순서 변경 (Reorder)
export async function reorderSheetTodos(
  orders: { timestamp: string; order: number }[],
  customUrl?: string
) {
  try {
    const endpoint = customUrl || "/api/todos";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", data: orders }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: "순서 저장 요청 실패: " + String(err) };
  }
}
