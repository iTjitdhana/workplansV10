import { Calendar, ChevronDown as ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type PlanningHeaderProps = {
  userName: string;
  onOpenTimeTable: () => void;
};

export function PlanningHeader({ userName, onOpenTimeTable }: PlanningHeaderProps) {
  const { getRoleIdFromCookie } = require("../../../../lib/menuLinks");
  const { isMenuAllowed } = require("../../../../lib/menuLinks");
  const roleId = getRoleIdFromCookie();
  const hasPermission = (key: string) => isMenuAllowed(key as any, roleId);
  void hasPermission;

  const logsUrl = process.env.NEXT_PUBLIC_LOGS_URL || "http://192.168.0.96:3014/logs";
  const scheduleUrl = process.env.NEXT_PUBLIC_SCHEDULE_URL || "http://192.168.0.96:3019/";
  const showHeaderMenu = false;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-800 via-green-700 to-green-600 border-b border-green-600 shadow-md">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h1 className="text-sm sm:text-lg md:text-xl font-semibold text-white truncate">
              ระบบจัดการแผนการผลิตครัวกลาง บริษัท จิตต์ธนา จำกัด (สำนักงานใหญ่)
            </h1>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 flex-shrink-0">
            {showHeaderMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="hidden md:flex items-center space-x-1 text-sm text-green-100 hover:text-white hover:bg-white/10 transition-colors duration-200 p-2"
                  >
                    <span>เมนู</span>
                    <ChevronDownIcon className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-white border border-gray-200 shadow-lg">
                  <DropdownMenuItem asChild>
                    <a
                      href={logsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                    >
                      <span>ระบบประวัติการผลิต</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={scheduleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                    >
                      <span>ตารางงานและกระบวนการผลิตสินค้าครัวกลาง</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenTimeTable} className="flex items-center space-x-2 p-2 cursor-pointer">
                    <span>แสดงตารางเวลาการทำงาน</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <div className="flex items-center space-x-1 sm:space-x-2">
              <>
                <span className="hidden sm:block text-xs sm:text-sm text-white">ผู้ใช้: {userName || ""}</span>
                <span className="sm:hidden text-xs text-white">{userName || ""}</span>
              </>
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <span className="text-white text-xs sm:text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
