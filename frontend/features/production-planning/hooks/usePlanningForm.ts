import { useCallback } from "react";
import type { ChangeEvent } from "react";
import { generateTimeOptions } from "../utils/planningFormat";

type UsePlanningFormParams = {
  setNote: (value: string) => void;
  setEditNote: (value: string) => void;
};

export const usePlanningForm = ({ setNote, setEditNote }: UsePlanningFormParams) => {
  const handleNoteChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setNote(e.target.value);
    },
    [setNote],
  );

  const handleEditNoteChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setEditNote(e.target.value);
    },
    [setEditNote],
  );

  const debouncedNoteChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setTimeout(() => setNote(value), 0);
    },
    [setNote],
  );

  const debouncedEditNoteChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setTimeout(() => setEditNote(value), 0);
    },
    [setEditNote],
  );

  const timeOptions = generateTimeOptions();

  return {
    timeOptions,
    handleNoteChange,
    handleEditNoteChange,
    debouncedNoteChange,
    debouncedEditNoteChange,
  };
};
