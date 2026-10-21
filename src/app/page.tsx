"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  SortablePostitCard,
  TodoItem,
  CATEGORIES,
  ColorType,
} from "@/components/SortablePostitCard";
import {
  fetchSheetTodos,
  createSheetTodo,
  updateSheetTodo,
  deleteSheetTodo,
  reorderSheetTodos,
} from "@/lib/sheetApi";

const COLOR_KEYS: ColorType[] = ["yellow", "pink", "green", "blue"];

export default function Home() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState("전체");

  // 시트 연동 상태 관리
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);

  // 환경변수 외 직접 입력 가능한 Web App URL 설정 모달/입력 필드
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);

  // 편집 모드 관리
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // 테마 관리 (기본 라이트 모드)
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // 롤백을 위한 이전 상태 참조
  const prevTodosRef = useRef<TodoItem[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("postit-theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "light";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const savedUrl = localStorage.getItem("gas-web-app-url") || "";
    setSheetUrl(savedUrl);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("postit-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // dnd-kit 센서
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 1. 페이지 진입 시 Google Sheets에서 메모 목록 불러오기
  const loadTodosFromSheet = async (overrideUrl?: string) => {
    setIsLoading(true);
    setSyncError(null);
    const targetUrl = overrideUrl !== undefined ? overrideUrl : sheetUrl;

    const res = await fetchSheetTodos(targetUrl || undefined);

    if (res.notConfigured && !targetUrl) {
      setIsConfigured(false);
      // 시트 URL이 설정되지 않은 경우 로컬 스토리지 데이터로 안전하게 표시
      const local = localStorage.getItem("postit-todos");
      if (local) {
        try {
          setTodos(JSON.parse(local));
        } catch {}
      }
      setIsLoading(false);
      return;
    }

    setIsConfigured(true);

    if (res.success && res.data) {
      const mapped: TodoItem[] = res.data.map((item, idx) => ({
        id: item.timestamp,
        order: Number(item.order) || idx + 1,
        text: item.content,
        category: item.category || CATEGORIES[0],
        color: (item.color as ColorType) || "yellow",
        completed: item.state === "완료",
        createdAt: item.datetime || "방금 전",
        rotation: Number((Math.random() * 6 - 3).toFixed(1)),
      }));

      // order 기준 오름차순 정렬
      mapped.sort((a, b) => a.order - b.order);
      setTodos(mapped);
      localStorage.setItem("postit-todos", JSON.stringify(mapped));
    } else {
      setSyncError(res.error || "시트 데이터를 불러오지 못했습니다.");
      // 로컬 캐시 폴백
      const local = localStorage.getItem("postit-todos");
      if (local) {
        try {
          setTodos(JSON.parse(local));
        } catch {}
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTodosFromSheet();
  }, []);

  // 에러 발생 시 안내 메시지 5초 후 자동 숨김
  const triggerError = (msg: string) => {
    setSyncError(msg);
    setTimeout(() => {
      setSyncError((cur) => (cur === msg ? null : cur));
    }, 5000);
  };

  // 2. 새 메모 추가 (Create)
  const handleAddTodo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const randomColor = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
    const randomRotation = Number((Math.random() * 6 - 3).toFixed(1));
    const timestamp = Date.now().toString();
    const datetime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newTodo: TodoItem = {
      id: timestamp,
      order: 1,
      text: inputText.trim(),
      category: selectedCategory,
      color: randomColor,
      completed: false,
      createdAt: datetime,
      rotation: randomRotation,
    };

    // 낙관적 UI 업데이트 (사용자 경험 개선)
    prevTodosRef.current = todos;
    const optimisticTodos = [newTodo, ...todos].map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));
    setTodos(optimisticTodos);
    setInputText("");
    setIsSyncing(true);

    const res = await createSheetTodo(
      {
        timestamp: newTodo.id,
        datetime: newTodo.createdAt,
        category: newTodo.category,
        content: newTodo.text,
        color: newTodo.color,
        state: "미완료",
        order: 1,
      },
      sheetUrl || undefined
    );

    setIsSyncing(false);
    if (!res.success) {
      // 실패 시 롤백하여 데이터 불일치 방지
      setTodos(prevTodosRef.current);
      triggerError("구글 시트에 메모 저장 실패: " + (res.error || "알 수 없는 오류"));
    } else {
      localStorage.setItem("postit-todos", JSON.stringify(optimisticTodos));
    }
  };

  // 편집 시작
  const startEditing = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditCategory(todo.category);
  };

  // 편집 취소
  const cancelEditing = () => {
    setEditingId(null);
    setEditText("");
    setEditCategory("");
  };

  // 3. 편집 저장 (Update)
  const saveEditing = async (id: string) => {
    if (!editText.trim()) return;

    prevTodosRef.current = todos;
    const updated = todos.map((todo) =>
      todo.id === id
        ? {
            ...todo,
            text: editText.trim(),
            category: editCategory || todo.category,
          }
        : todo
    );

    setTodos(updated);
    cancelEditing();
    setIsSyncing(true);

    const res = await updateSheetTodo(
      {
        timestamp: id,
        content: editText.trim(),
        category: editCategory,
      },
      sheetUrl || undefined
    );

    setIsSyncing(false);
    if (!res.success) {
      setTodos(prevTodosRef.current);
      triggerError("메모 수정 저장 실패: " + (res.error || "알 수 없는 오류"));
    } else {
      localStorage.setItem("postit-todos", JSON.stringify(updated));
    }
  };

  // 4. 완료 체크 시 state 값 반영 (Update)
  const toggleComplete = async (id: string) => {
    prevTodosRef.current = todos;
    const target = todos.find((t) => t.id === id);
    if (!target) return;

    const nextState = !target.completed;
    const updated = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: nextState } : todo
    );

    setTodos(updated);
    setIsSyncing(true);

    const res = await updateSheetTodo(
      {
        timestamp: id,
        state: nextState ? "완료" : "미완료",
      },
      sheetUrl || undefined
    );

    setIsSyncing(false);
    if (!res.success) {
      setTodos(prevTodosRef.current);
      triggerError("상태 변경 저장 실패: " + (res.error || "알 수 없는 오류"));
    } else {
      localStorage.setItem("postit-todos", JSON.stringify(updated));
    }
  };

  // 5. 삭제 시 시트에서 제거 및 화면 즉시 반영 (Delete)
  const deleteTodo = async (id: string) => {
    prevTodosRef.current = todos;
    const filtered = todos
      .filter((t) => t.id !== id)
      .map((t, idx) => ({ ...t, order: idx + 1 }));

    // 즉시 화면에서 제거
    setTodos(filtered);
    if (editingId === id) cancelEditing();
    setIsSyncing(true);

    const res = await deleteSheetTodo(id, sheetUrl || undefined);

    setIsSyncing(false);
    if (!res.success) {
      // 실패 시 복구하여 데이터 불일치 방지
      setTodos(prevTodosRef.current);
      triggerError("메모 삭제 저장 실패: " + (res.error || "알 수 없는 오류"));
    } else {
      localStorage.setItem("postit-todos", JSON.stringify(filtered));
    }
  };

  // 6. 카드 드래그 시 order 값 반영 (Reorder)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      prevTodosRef.current = todos;

      const oldIndex = todos.findIndex((i) => i.id === active.id);
      const newIndex = todos.findIndex((i) => i.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const moved = arrayMove(todos, oldIndex, newIndex);
        const updatedWithOrder = moved.map((item, idx) => ({
          ...item,
          order: idx + 1,
        }));

        setTodos(updatedWithOrder);
        setIsSyncing(true);

        const orderPayload = updatedWithOrder.map((item) => ({
          timestamp: item.id,
          order: item.order,
        }));

        const res = await reorderSheetTodos(orderPayload, sheetUrl || undefined);

        setIsSyncing(false);
        if (!res.success) {
          setTodos(prevTodosRef.current);
          triggerError("순서 변경 저장 실패: " + (res.error || "알 수 없는 오류"));
        } else {
          localStorage.setItem("postit-todos", JSON.stringify(updatedWithOrder));
        }
      }
    }
  };

  // 시트 URL 저장 핸들러
  const handleSaveSheetUrl = () => {
    localStorage.setItem("gas-web-app-url", sheetUrl.trim());
    setShowConfig(false);
    loadTodosFromSheet(sheetUrl.trim());
  };

  const filteredTodos = todos.filter((todo) => {
    if (selectedFilterCategory === "전체") return true;
    return todo.category === selectedFilterCategory;
  });

  return (
    <div className="min-h-screen bg-[#f8f6f0] dark:bg-[#121316] text-[#2d3748] dark:text-[#e2e8f0] flex flex-col items-center py-10 px-4 md:px-8 transition-colors duration-300">
      {/* 알림 토스트: 동기화 에러 발생 시 안내 메시지 */}
      {syncError && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-bounce">
          <span>⚠️ {syncError}</span>
          <button
            onClick={() => setSyncError(null)}
            className="ml-2 underline text-xs cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* 상단 컨트롤 바 (구글 시트 연동 상태, 동기화 스피너, 설정 버튼, 테마 버튼) */}
      <div className="w-full max-w-6xl flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* 구글 시트 연결 상태 배지 */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              isConfigured
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            ></span>
            <span>
              {isConfigured ? "Google Sheets 동기화 연결됨" : "시트 URL 설정 필요 (클릭)"}
            </span>
            <span className="text-[10px] opacity-70">⚙️</span>
          </button>

          {/* 동기화 진행 상태 표시기 */}
          {isSyncing && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 animate-pulse">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              시트 저장 중...
            </span>
          )}
        </div>

        {/* 테마 전환 버튼 */}
        <button
          onClick={toggleTheme}
          aria-label="라이트/다크 모드 전환"
          className="flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all text-xs font-semibold cursor-pointer"
        >
          {theme === "light" ? (
            <>
              <span className="text-amber-500 text-base">🌙</span>
              <span>다크 모드로 보기</span>
            </>
          ) : (
            <>
              <span className="text-amber-400 text-base">☀️</span>
              <span>라이트 모드로 보기</span>
            </>
          )}
        </button>
      </div>

      {/* 시트 Web App URL 설정 드롭다운 패널 */}
      {showConfig && (
        <div className="w-full max-w-6xl mb-6 p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-md transition-all">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-700 dark:text-stone-200">
                🔗 Google Apps Script 웹 앱 URL 설정
              </h3>
              <button
                onClick={() => setShowConfig(false)}
                className="text-stone-400 hover:text-stone-600 text-xs"
              >
                닫기 ✕
              </button>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              배포한 Google Apps Script의 웹 앱 URL을 입력하면 실시간으로 A~G열에 동기화됩니다. (.env.local의 NEXT_PUBLIC_GAS_WEB_APP_URL과도 호환됩니다)
            </p>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleSaveSheetUrl}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
              >
                저장 및 연결
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 영역 */}
      <header className="text-center mb-8">
        <div className="inline-block px-4 py-1.5 bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-700/60 rounded-full text-xs font-semibold text-amber-800 dark:text-amber-300 mb-3 shadow-xs">
          📌 Google Sheets 실시간 연동 포스트잇 메모 보드
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-stone-800 dark:text-stone-100 tracking-tight flex items-center justify-center gap-2">
          <span>Post-it</span>
          <span className="bg-gradient-to-r from-amber-500 via-rose-400 to-sky-500 dark:from-amber-400 dark:via-rose-300 dark:to-sky-400 bg-clip-text text-transparent">
            Todo List
          </span>
        </h1>
        <p className="text-stone-500 dark:text-stone-400 text-sm mt-2 font-medium">
          카드를 드래그하여 순서를 바꾸고 완료 상태를 구글 시트와 영구 동기화하세요!
        </p>
      </header>

      {/* 중앙 메모 입력 영역 */}
      <section className="w-full max-w-2xl bg-white/95 dark:bg-[#1a1c22] rounded-2xl p-5 md:p-6 shadow-lg border border-stone-200/90 dark:border-stone-700/80 mb-10 transition-all hover:shadow-xl">
        <form onSubmit={handleAddTodo} className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 카테고리 선택 드롭다운 */}
            <div className="w-full sm:w-44 flex-shrink-0">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                카테고리
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-11 px-3 bg-stone-50 dark:bg-[#252830] border border-stone-300 dark:border-stone-600 rounded-xl text-stone-800 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 cursor-pointer transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-white dark:bg-[#252830] text-stone-800 dark:text-stone-100">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 메모 입력창 */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                새로운 할 일 메모
              </label>
              <input
                type="text"
                placeholder="예: 구글 시트 연동 테스트 완료하기..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-11 px-4 bg-stone-50 dark:bg-[#252830] border border-stone-300 dark:border-stone-600 rounded-xl text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-stone-400 dark:text-stone-400">
              💡 작성 즉시 Google Sheets의 A~G열에 자동 저장됩니다.
            </span>
            <button
              type="submit"
              disabled={!inputText.trim() || isSyncing}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              붙이기
            </button>
          </div>
        </form>
      </section>

      {/* 카테고리 필터링 탭 */}
      <div className="w-full max-w-6xl flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedFilterCategory("전체")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedFilterCategory === "전체"
                ? "bg-stone-800 dark:bg-amber-500 text-white dark:text-stone-950 shadow-sm"
                : "bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300/80 dark:hover:bg-stone-700"
            }`}
          >
            전체 ({todos.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = todos.filter((t) => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedFilterCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedFilterCategory === cat
                    ? "bg-stone-800 dark:bg-amber-500 text-white dark:text-stone-950 shadow-sm"
                    : "bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300/80 dark:hover:bg-stone-700"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
          완료 {todos.filter((t) => t.completed).length} / 전체 {todos.length}
        </div>
      </div>

      {/* 로딩 표시기 */}
      {isLoading ? (
        <div className="w-full max-w-6xl flex flex-col items-center justify-center py-20 text-stone-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-3"></div>
          <p className="text-sm">Google Sheets에서 메모를 불러오는 중입니다...</p>
        </div>
      ) : (
        /* 포스트잇 카드 리스트 */
        <main className="w-full max-w-6xl">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-stone-100/60 dark:bg-stone-900/40 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-800">
              <span className="text-5xl mb-3">📝</span>
              <p className="text-base font-medium text-stone-600 dark:text-stone-300">
                등록된 포스트잇이 없습니다.
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                위의 입력창에서 새로운 할 일을 등록해 보세요!
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredTodos.map((t) => t.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-2">
                  {filteredTodos.map((todo) => (
                    <SortablePostitCard
                      key={todo.id}
                      todo={todo}
                      isEditing={editingId === todo.id}
                      editText={editText}
                      setEditText={setEditText}
                      editCategory={editCategory}
                      setEditCategory={setEditCategory}
                      onStartEdit={startEditing}
                      onSaveEdit={saveEditing}
                      onCancelEdit={cancelEditing}
                      onDelete={deleteTodo}
                      onToggleComplete={toggleComplete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </main>
      )}

      {/* 하단 푸터 */}
      <footer className="mt-16 mb-4 text-center text-xs text-stone-500 dark:text-stone-400 flex flex-col items-center justify-center gap-1.5 px-4">
        <p className="font-medium tracking-tight">
          Copyright INU Post-it Todo List by [kimminseo]
        </p>
        <p className="text-[11px] text-stone-400 dark:text-stone-500">
          Powered by Next.js & Google Sheets API
        </p>
      </footer>
    </div>
  );
}
