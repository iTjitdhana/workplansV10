import { useCallback, useRef, useState } from "react";

export const usePlanningDialogs = () => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState<string>("ยืนยันการทำรายการ");
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const confirmResolverRef = useRef<(value: boolean) => void>();

  const showConfirm = useCallback((message: string, title = "ยืนยันการทำรายการ") => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmOpen(true);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }, []);

  const handleConfirmYes = useCallback(() => {
    setConfirmOpen(false);
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = undefined;
    resolver?.(true);
  }, []);

  const handleConfirmNo = useCallback(() => {
    setConfirmOpen(false);
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = undefined;
    resolver?.(false);
  }, []);

  return {
    confirmOpen,
    setConfirmOpen,
    confirmTitle,
    confirmMessage,
    showConfirm,
    handleConfirmYes,
    handleConfirmNo,
  };
};
