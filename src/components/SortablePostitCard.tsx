"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";

export type ColorType = "yellow" | "pink" | "green" | "blue";

export interface TodoItem {
  id: string;
  order: number;
  text: string;
  category: string;
  color: ColorType;
  completed: boolean;
  createdAt: string;
  rotation: number;
}

export const CATEGORIES = ["업무 💼", "개인 🧘", "학습 📚", "아이디어 💡", "쇼핑 🛒"];

export const COLOR_VARIANTS: Record<
  ColorType,
  {
    bg: string;
    tape: string;
    badge: string;
    text: string;
    border: string;
    completedText: string;
  }
> = {
  yellow: {
    bg: "bg-[#fff9a6] dark:bg-[#3d3714]",
    tape: "bg-[#f5e582]/80 dark:bg-[#665a1d]/60",
    badge: "bg-[#f2e268] text-amber-950 dark:bg-[#52491a] dark:text-amber-200",
    text: "text-amber-950 dark:text-[#fef08a]",
    border: "border-[#edd855] dark:border-[#71631a]",
    completedText: "dark:text-amber-300/40",
  },
  pink: {
    bg: "bg-[#ffd6e0] dark:bg-[#3c1824]",
    tape: "bg-[#fbb0c5]/80 dark:bg-[#6b263d]/60",
    badge: "bg-[#f8a5bc] text-rose-950 dark:bg-[#591d31] dark:text-rose-200",
    text: "text-rose-950 dark:text-[#fecdd3]",
    border: "border-[#f48fa9] dark:border-[#7c2642]",
    completedText: "dark:text-rose-300/40",
  },
  green: {
    bg: "bg-[#d4f5c9] dark:bg-[#13331b]",
    tape: "bg-[#aee69d]/80 dark:bg-[#20572d]/60",
    badge: "bg-[#a1e28d] text-emerald-950 dark:bg-[#1c4b26] dark:text-emerald-200",
    text: "text-emerald-950 dark:text-[#bbf7d0]",
    border: "border-[#8ad674] dark:border-[#276e37]",
    completedText: "dark:text-emerald-300/40",
  },
  blue: {
    bg: "bg-[#d4edff] dark:bg-[#122b3e]",
    tape: "bg-[#a8d9fc]/80 dark:bg-[#1d4c6f]/60",
    badge: "bg-[#96d0fb] text-sky-950 dark:bg-[#183f5c] dark:text-sky-200",
    text: "text-sky-950 dark:text-[#bae6fd]",
    border: "border-[#7ec1f5] dark:border-[#1e5883]",
    completedText: "dark:text-sky-300/40",
  },
};

interface SortablePostitCardProps {
  todo: TodoItem;
  isEditing: boolean;
  editText: string;
  setEditText: (v: string) => void;
  editCategory: string;
  setEditCategory: (v: string) => void;
  onStartEdit: (todo: TodoItem) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export function SortablePostitCard({
  todo,
  isEditing,
  editText,
  setEditText,
  editCategory,
  setEditCategory,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleComplete,
}: SortablePostitCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
    disabled: isEditing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform)
      ? `${CSS.Translate.toString(transform)} rotate(${todo.rotation}deg)`
      : `rotate(${todo.rotation}deg)`,
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.75 : 1,
    touchAction: "manipulation",
  };

  const variant = COLOR_VARIANTS[todo.color];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`animate-stick relative flex flex-col justify-between p-5 min-h-[240px] rounded-lg shadow-md dark:shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition-shadow duration-200 hover:scale-[1.02] hover:z-20 hover:shadow-xl ${variant.bg} ${variant.border} border-t-2 ${
        isDragging ? "ring-2 ring-amber-400 shadow-2xl scale-105" : ""
      }`}
    >
      {/* 상단 마스킹 테이프 (드래그 핸들 역할) */}
      <div
        {...attributes}
        {...listeners}
        title="길게 누르거나 드래그하여 순서 변경"
        className={`absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-6 ${variant.tape} backdrop-blur-xs rounded-xs shadow-xs cursor-grab active:cursor-grabbing flex items-center justify-center gap-1 select-none`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20"></span>
      </div>

      {/* 카드 상단: 카테고리 배지 & 순서 표시 & [편집, 삭제] 버튼 */}
      <div className="flex items-center justify-between gap-2 mb-3 mt-1">
        {isEditing ? (
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-black/40 border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-stone-100 focus:outline-none cursor-pointer"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xs ${variant.badge}`}
            >
              {todo.category}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-stone-500 dark:text-stone-400">
              #{todo.order}
            </span>
          </div>
        )}

        {/* 액션 버튼 그룹 */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => onSaveEdit(todo.id)}
                title="수정 완료"
                className="p-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                저장
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                title="취소"
                className="p-1 rounded bg-stone-500/20 hover:bg-stone-500/30 text-stone-600 dark:text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                취소
              </button>
            </>
          ) : (
            <>
              {/* 편집 버튼 */}
              <button
                type="button"
                onClick={() => onStartEdit(todo)}
                title="메모 편집"
                className="text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
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
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={() => onDelete(todo.id)}
                title="메모 삭제"
                className="text-stone-400 dark:text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 본문 텍스트 영역 */}
      <div className="flex-1 select-none flex flex-col justify-center">
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full p-2 text-sm rounded-md bg-white/90 dark:bg-black/40 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-medium"
            autoFocus
          />
        ) : (
          <p
            onClick={() => onToggleComplete(todo.id)}
            className={`text-base font-medium leading-relaxed break-words cursor-pointer transition-all ${
              variant.text
            } ${
              todo.completed
                ? `line-through opacity-40 font-normal ${variant.completedText}`
                : ""
            }`}
          >
            {todo.text}
          </p>
        )}
      </div>

      {/* 카드 하단: 완료 체크 버튼(완료/미완료) & 시간 */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-black/5 dark:border-white/10 text-xs">
        <button
          type="button"
          onClick={() => onToggleComplete(todo.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer select-none ${
            todo.completed
              ? "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30"
              : "bg-black/5 text-stone-600 dark:bg-white/10 dark:text-stone-300 border border-transparent hover:bg-black/10 dark:hover:bg-white/15"
          }`}
        >
          <span className="flex items-center justify-center w-3.5 h-3.5 rounded-xs border border-current">
            {todo.completed ? "✓" : ""}
          </span>
          <span>{todo.completed ? "완료" : "미완료"}</span>
        </button>

        <span className="text-[11px] text-stone-400 dark:text-stone-400 font-light">
          {todo.createdAt}
        </span>
      </div>
    </div>
  );
}
