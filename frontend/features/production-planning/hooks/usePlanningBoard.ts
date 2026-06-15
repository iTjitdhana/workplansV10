import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { formatDateForAPI } from "@/lib/dateUtils";
import type { ProductionItem } from "@/types/production";

type SetProductionData = Dispatch<SetStateAction<ProductionItem[]>>;

type UsePlanningBoardParams = {
  setProductionData: SetProductionData;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: "daily" | "weekly") => void;
};

export const usePlanningBoard = ({ setProductionData, setSelectedDate, setViewMode }: UsePlanningBoardParams) => {
  const handleQuickAdd = useCallback(
    (dateKey: string) => {
      setSelectedDate(dateKey);
      setViewMode("daily");
    },
    [setSelectedDate, setViewMode],
  );

  const handleReorderSameDay = useCallback(
    (dateKey: string, newOrder: ProductionItem[]) => {
      setProductionData((prev) => {
        const keepOthers = prev.filter((p) => formatDateForAPI(p.production_date) !== dateKey);
        return [...keepOthers, ...newOrder];
      });
    },
    [setProductionData],
  );

  const handleMoveAcrossDays = useCallback(
    (fromKey: string, toKey: string, item: ProductionItem, position: number) => {
      setProductionData((prev) => {
        const updated = prev.map((p) => (p.id === item.id ? { ...p, production_date: toKey } : p));
        const target = updated.filter((p) => formatDateForAPI(p.production_date) === toKey);
        const others = updated.filter((p) => formatDateForAPI(p.production_date) !== toKey);
        const moved = target.find((p) => p.id === item.id);
        if (!moved) return prev;
        const rest = target.filter((p) => p.id !== item.id);
        const clampedPos = Math.min(Math.max(position, 0), rest.length);
        rest.splice(clampedPos, 0, moved);
        return [...others, ...rest];
      });
    },
    [setProductionData],
  );

  const handleTaskMove = useCallback(
    (taskId: number, fromDate: string, toDate: string, fromIndex: number, toIndex: number) => {
      setProductionData((prev) => {
        const updated = prev.map((p) => (p.id === taskId.toString() ? { ...p, production_date: toDate } : p));
        const target = updated.filter((p) => formatDateForAPI(p.production_date) === toDate);
        const others = updated.filter((p) => formatDateForAPI(p.production_date) !== toDate);
        const moved = target.find((p) => p.id === taskId.toString());
        if (!moved) return prev;
        const rest = target.filter((p) => p.id !== taskId.toString());
        const clampedPos = Math.min(Math.max(toIndex, 0), rest.length);
        rest.splice(clampedPos, 0, moved);
        return [...others, ...rest];
      });
    },
    [setProductionData],
  );

  const handleTaskReorder = useCallback(
    (taskId: number, date: string, fromIndex: number, toIndex: number) => {
      setProductionData((prev) => {
        const dayItems = prev.filter((p) => formatDateForAPI(p.production_date) === date);
        const otherItems = prev.filter((p) => formatDateForAPI(p.production_date) !== date);
        const reordered = arrayMove(dayItems, fromIndex, toIndex);
        return [...otherItems, ...reordered];
      });
    },
    [setProductionData],
  );

  return {
    handleQuickAdd,
    handleReorderSameDay,
    handleMoveAcrossDays,
    handleTaskMove,
    handleTaskReorder,
  };
};
