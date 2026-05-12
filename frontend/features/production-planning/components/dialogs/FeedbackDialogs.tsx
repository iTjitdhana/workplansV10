import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FeedbackDialogsProps = {
  fontClassName: string;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  confirmTitle: string;
  confirmMessage: string;
  onConfirmNo: () => void;
  onConfirmYes: () => void;
  showSuccessDialog: boolean;
  setShowSuccessDialog: (open: boolean) => void;
  successDialogMessage: string;
};

export function FeedbackDialogs({
  fontClassName,
  confirmOpen,
  setConfirmOpen,
  confirmTitle,
  confirmMessage,
  onConfirmNo,
  onConfirmYes,
  showSuccessDialog,
  setShowSuccessDialog,
  successDialogMessage,
}: FeedbackDialogsProps) {
  return (
    <>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={fontClassName}>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className={fontClassName}>{confirmMessage}</p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onConfirmNo} className={fontClassName}>
              ยกเลิก
            </Button>
            <Button onClick={onConfirmYes} className={`bg-red-600 hover:bg-red-700 text-white ${fontClassName}`}>
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className={`max-w-xs text-center ${fontClassName}`}>
          <DialogHeader>
            <DialogTitle className={`${fontClassName} text-green-600`}>สำเร็จ</DialogTitle>
          </DialogHeader>
          <div className="mb-4 text-green-700">{successDialogMessage}</div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} className={`w-full bg-green-600 hover:bg-green-700 text-white ${fontClassName}`}>
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
