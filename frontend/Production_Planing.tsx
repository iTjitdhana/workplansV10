"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Clock,
  Edit,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  User as UserIcon,
  XCircle,
  BarChart3,
  ChevronDown as ChevronDownIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import AutosizeTextarea from "@/components/AutosizeTextarea"
import dynamic from "next/dynamic"
const RichNoteEditor = dynamic(() => import("@/components/RichNoteEditor"), { ssr: false })
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Noto_Sans_Thai } from "next/font/google"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchBox, SearchOption } from "./components/SearchBox";
import { JobSearchSelect } from "./components/JobSearchSelect";
import { SimpleDatePicker } from "./components/SimpleDatePicker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableSkeletonLoader, CardSkeletonLoader } from "@/components/SkeletonLoader";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { TimeTablePopup } from "@/components/TimeTablePopup";
import { ProductionTask } from "@/lib/types/weekly-calendar";
import { arrayMove } from "@dnd-kit/sortable";
import { createSafeDate, formatDateForDisplay, formatDateForAPI, formatDateThaiShort } from "@/lib/dateUtils";
import { config, debugLog, debugError } from "@/lib/config";
import { api, handleApiError, createAbortController } from "@/lib/api";
import { getOperatorsArray, getOperatorsString, isDraftItem, isSpecialItem } from "@/lib/utils";
import { getStaffImage, getStaffInitial } from "@/lib/staffAvatar";
import { clientCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import {
  formatDateForGoogleSheet,
  formatDateForValue,
  generateTimeOptions,
  generateTimeSlots,
  isEndTimeAfterStartTime,
  normalizeJobName,
  normalizeTimeForForm,
} from "@/features/production-planning/utils/planningFormat";
import {
  buildDailyProductionDisplayOrder,
  buildSelectedDayProductionOrder,
  sortByNumericId,
  sortByStartTimeAndFirstOperator,
} from "@/features/production-planning/utils/planningSort";
import {
  calculateDailySummary,
  formatDurationLabel as formatDuration,
  formatLogTime as formatTime,
  getDisplayJobName,
} from "@/features/production-planning/utils/planningSummary";
import {
  buildLogRows,
  buildReportDatePayload,
  buildSummaryRows,
  splitProductionJobs,
} from "@/features/production-planning/utils/googleSheetPayload";
import { getApiUrl, planningApi } from "@/features/production-planning/services/planningApi";
import { sendToGoogleSheet } from "@/features/production-planning/services/googleSheetService";
import { DEFAULT_JOB_CODES, GOOGLE_SHEET_TAB_URL } from "@/features/production-planning/constants/googleSheet";
import { usePlanningForm } from "@/features/production-planning/hooks/usePlanningForm";
import { usePlanningDialogs } from "@/features/production-planning/hooks/usePlanningDialogs";
import { usePlanningBoard } from "@/features/production-planning/hooks/usePlanningBoard";
import { FeedbackDialogs } from "@/features/production-planning/components/dialogs/FeedbackDialogs";
import { PlanningHeader } from "@/features/production-planning/components/layout/PlanningHeader";
import type { 
  User, 
  Machine, 
  ProductionRoom, 
  ProductionItem, 
  ProductionLog, 
  DraftWorkPlan,
  JobOption 
} from "@/types/production";
import Link from "next/link";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
})

const MIN_OPERATOR_SLOTS = 4;
const createOperatorSlots = (count = MIN_OPERATOR_SLOTS) => Array.from({ length: count }, () => "");
const normalizeOperatorSlots = (names: string[], minCount = MIN_OPERATOR_SLOTS) => {
  const normalized = names.filter((name) => typeof name === "string");
  while (normalized.length < minCount) {
    normalized.push("");
  }
  return normalized;
};
const HIDDEN_OPERATOR_DROPDOWN_NAMES = new Set(["Admin User"]);
type PlanningFieldKey = "jobName" | "operators" | "startTime" | "endTime" | "room";
type PlanningFieldErrors = Partial<Record<PlanningFieldKey, string>>;

export default function MedicalAppointmentDashboard() {
  // ===== ALL STATE DECLARATIONS FIRST (ป้องกัน hooks order error) =====
  // Client-side check สำหรับแก้ไข hydration error
  const [isClient, setIsClient] = useState(false);
  
  // เปลี่ยน default selectedDate เป็นวันที่ปัจจุบัน (แก้ไข hydration error)
  const [selectedDate, setSelectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState("")
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily")
  const [isFormCollapsed, setIsFormCollapsed] = useState(false)
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // เพิ่ม state สำหรับฟอร์ม
  const [operators, setOperators] = useState<string[]>(createOperatorSlots());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [draftHighlightIds, setDraftHighlightIds] = useState<Set<string>>(new Set());

  // เพิ่ม state สำหรับ job search (ใช้ react-select แล้ว)
  const [jobQuery, setJobQuery] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rooms, setRooms] = useState<ProductionRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const jobInputRef = useRef<HTMLInputElement>(null);
  const jobFieldRef = useRef<HTMLDivElement>(null);
  const [jobName, setJobName] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PlanningFieldErrors>({});
  const [flashErrorFields, setFlashErrorFields] = useState<Set<PlanningFieldKey>>(new Set());
  const flashErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedFromDropdownRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false); // flag เพื่อป้องกัน race condition
  const hasInitializedDateRef = useRef(false); // flag เพื่อป้องกันการ set selectedDate ซ้ำ
  const [showWorkerDetails, setShowWorkerDetails] = useState(true); // เพิ่ม state สำหรับเปิด/ปิดรายละเอียด (default เปิด)
  const [showTimeTable, setShowTimeTable] = useState(false); // เพิ่ม state สำหรับเปิด/ปิด Time Table Popup (default ปิด)
  const [syncModeEnabled, setSyncModeEnabled] = useState(false); // เพิ่ม state สำหรับ sync mode
  const router = useRouter();
  
  // ปิด popup เลือกวิธีกรอกข้อมูลชั่วคราว (เปิดกลับได้ภายหลัง)
  const ENABLE_AUTO_FILL_SELECTION_DIALOG = false;

  // State สำหรับ popup ถามว่าจะใช้ข้อมูลตามแผนหรือไม่
  const [showAutoFillDialog, setShowAutoFillDialog] = useState(false);
  const [pendingJobData, setPendingJobData] = useState<{ jobCode: string; jobName: string } | null>(null);
  const [pendingLatestData, setPendingLatestData] = useState<any>(null); // เก็บข้อมูลล่าสุดเพื่อแสดงใน Dialog
  const [autoFillOption, setAutoFillOption] = useState<'latest' | 'best' | 'manual' | null>(null); // ตัวเลือกวิธีการกรอกข้อมูล (null = ยังไม่เลือก)
  const [expandedOption, setExpandedOption] = useState<'latest' | 'best' | 'manual' | null>(null); // ตัวเลือกที่กำลังขยายแสดงข้อมูล
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set()); // เก็บช่องที่ auto-fill แล้ว
  const [shouldFocusFields, setShouldFocusFields] = useState(false); // flag สำหรับ focus
  
  // Refs สำหรับ focus ที่ช่องต่างๆ
  const operatorTriggerRefs = [
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
  ];
  const getOperatorTriggerRef = (index: number) => operatorTriggerRefs[index] ?? undefined;
  const startTimeRef = useRef<HTMLButtonElement>(null);
  const endTimeRef = useRef<HTMLButtonElement>(null);
  const roomRef = useRef<HTMLButtonElement>(null);
  
  // เพิ่ม cache สำหรับผลลัพธ์การค้นหา
  const searchCacheRef = useRef<Map<string, SearchOption[]>>(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const selectableUsers = useMemo(
    () => users.filter((user) => !HIDDEN_OPERATOR_DROPDOWN_NAMES.has(user.name)),
    [users],
  );
  const clearFieldError = useCallback((field: PlanningFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFlashErrorFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);
  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
    setFlashErrorFields(new Set());
  }, []);
  const triggerFieldErrorFlash = useCallback((errors: PlanningFieldErrors) => {
    const errorKeys = (Object.keys(errors) as PlanningFieldKey[]).filter((field) => Boolean(errors[field]));
    if (errorKeys.length === 0) return;

    setFlashErrorFields(new Set(errorKeys));
    if (flashErrorTimeoutRef.current) {
      clearTimeout(flashErrorTimeoutRef.current);
    }
    flashErrorTimeoutRef.current = setTimeout(() => {
      setFlashErrorFields(new Set());
      flashErrorTimeoutRef.current = null;
    }, 2000);
  }, []);
  const focusFieldByError = useCallback((field: PlanningFieldKey) => {
    const getOperatorTarget = () => {
      const firstFilledOperatorIndex = operators.findIndex((op) => op && op !== "__none__");
      const targetIndex = firstFilledOperatorIndex >= 0 ? firstFilledOperatorIndex : 0;
      return getOperatorTriggerRef(targetIndex)?.current ?? getOperatorTriggerRef(0)?.current ?? null;
    };

    const targetMap: Record<PlanningFieldKey, HTMLElement | null> = {
      jobName: jobFieldRef.current,
      operators: getOperatorTarget(),
      startTime: startTimeRef.current,
      endTime: endTimeRef.current,
      room: roomRef.current,
    };

    const targetElement = targetMap[field];
    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      if (field === "jobName") {
        const jobInput = jobFieldRef.current?.querySelector("input") as HTMLInputElement | null;
        if (jobInput) {
          jobInput.focus();
          return;
        }
      }
      targetElement.focus?.();
    }, 150);
  }, [operators]);
  const scrollToFirstValidationError = useCallback((errors: PlanningFieldErrors) => {
    const fieldPriority: PlanningFieldKey[] = ["jobName", "operators", "startTime", "endTime", "room"];
    const firstErrorField = fieldPriority.find((field) => Boolean(errors[field]));
    if (firstErrorField) {
      focusFieldByError(firstErrorField);
    }
  }, [focusFieldByError]);

  const isCreatingRef = useRef(false); // <--- ย้ายมาอยู่นอก useEffect
  const draftHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ใช้ useDebounce หลังจากประกาศ jobQuery แล้ว
  const debouncedJobQuery = useDebounce(jobQuery, 200); // 200ms debounce

  const { timeOptions, handleNoteChange, handleEditNoteChange, debouncedNoteChange, debouncedEditNoteChange } =
    usePlanningForm({ setNote, setEditNote: (value) => setEditNote(value) });
  debugLog("⏰ Generated time options:", timeOptions);

  // state สำหรับข้อมูลแผนผลิตจริง
  const [productionData, setProductionData] = useState<ProductionItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Loading states
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  
  // User role state (ย้ายจาก JSX)
  const [userName, setUserName] = useState<string>('');
  
  // ===== ALL USEEFFECTS AFTER STATE DECLARATIONS =====
  // Client setup
  useEffect(() => {
    setIsClient(true);
  }, []);
  useEffect(() => {
    return () => {
      if (flashErrorTimeoutRef.current) {
        clearTimeout(flashErrorTimeoutRef.current);
      }
    };
  }, []);

  // ตรวจสอบและตั้งค่า selectedDate จาก URL query parameter หรือวันปัจจุบัน
  useEffect(() => {
    if (isClient && typeof window !== 'undefined' && !hasInitializedDateRef.current) {
      // อ่าน date จาก URL query parameter โดยตรง
      const urlParams = new URLSearchParams(window.location.search);
      const urlDate = urlParams.get('date');
      
      if (urlDate) {
        setSelectedDate(urlDate);
        debugLog('📅 Setting selectedDate from URL:', urlDate);
      } else {
        // ถ้าไม่มี date ใน URL ให้ตั้งเป็นวันปัจจุบัน
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayString = `${yyyy}-${mm}-${dd}`;
        setSelectedDate(todayString);
        debugLog('📅 Setting initial selectedDate:', todayString);
      }
      hasInitializedDateRef.current = true;
    }
  }, [isClient]);
  
  // ฟังการเปลี่ยนแปลง URL เมื่อใช้ back/forward (popstate)
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      const handlePopState = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlDate = urlParams.get('date');
        
        debugLog('🔙 Browser back/forward, checking date. URL date:', urlDate, 'Current selectedDate:', selectedDate);
        
        if (urlDate && urlDate !== selectedDate) {
          setSelectedDate(urlDate);
          debugLog('📅 Updating selectedDate from URL (back/forward):', urlDate);
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isClient, selectedDate]);
  

  // ตั้งค่า currentWeek หลัง client mount และให้สอดคล้องกับ selectedDate
  useEffect(() => {
    if (!isClient) return;
    // ถ้ายังไม่มี currentWeek ให้ใช้ selectedDate ถ้ามี ไม่เช่นนั้นใช้วันนี้
    if (!currentWeek) {
      const base = selectedDate ? new Date(selectedDate) : new Date();
      setCurrentWeek(base);
      return;
    }
  }, [isClient, currentWeek, selectedDate]);

  // เมื่อเปลี่ยนสัปดาห์จาก WeeklyCalendar ให้ sync วันที่เฉพาะตอนอยู่โหมดรายสัปดาห์เท่านั้น
  useEffect(() => {
    if (!isClient || !currentWeek) return;
    if (viewMode !== "weekly") return; // อย่าปรับวันที่ในโหมดรายวัน/ตอนปิด popup
    try {
      const startOfWeek = new Date(currentWeek);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      startOfWeek.setDate(diff);
      const yyyy = startOfWeek.getFullYear();
      const mm = String(startOfWeek.getMonth() + 1).padStart(2, '0');
      const dd = String(startOfWeek.getDate()).padStart(2, '0');
      const mondayStr = `${yyyy}-${mm}-${dd}`;
      if (selectedDate !== mondayStr) {
        setSelectedDate(mondayStr);
      }
    } catch (e) {
      // no-op
    }
  }, [isClient, currentWeek, viewMode]);

  // ตั้งค่า userName หลัง client mount
  useEffect(() => {
    if (isClient) {
      try {
        const cookieMatch = document.cookie.match(/(?:^|; )userRole=([^;]+)/);
        let roleId = cookieMatch ? parseInt(decodeURIComponent(cookieMatch[1])) : undefined;
        if (!roleId) {
          const segment = window.location.pathname.split('/').filter(Boolean)[0];
          const roleMap: Record<string, number> = {planner:1,admin:2,viewer:4,operation:5};
          roleId = roleMap[segment] || 2;
        }
        const roleNameMap: Record<number, string> = {1:'Planner',2:'Admin',4:'Viewer',5:'Operation'};
        setUserName(roleNameMap[roleId] || 'Admin');
      } catch (error) {
        setUserName('Admin');
      }
    }
  }, [isClient]);
  
  // ดึงข้อมูลแผนผลิตจริงและแบบร่างมารวมกัน - ลบออกเพราะจะให้ useEffect ที่ watch selectedDate จัดการเอง

  // อัปเดต URL เมื่อ selectedDate เปลี่ยน (URL sync)
  useEffect(() => {
    if (isClient && selectedDate && hasInitializedDateRef.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlDate = urlParams.get('date');
      
      if (urlDate !== selectedDate) {
        // อัปเดต URL ด้วย router.push (แต่ไม่ trigger popstate)
        const newUrl = `/planner/home?date=${encodeURIComponent(selectedDate)}`;
        debugLog('🔗 Updating URL to:', newUrl);
        router.push(newUrl, { scroll: false });
      }
    }
  }, [selectedDate, isClient, router]);
  
  // ดึงข้อมูลใหม่เมื่อเปลี่ยนวันที่
  useEffect(() => {
    if (selectedDate && isClient) {
      // ป้องกันการเรียกซ้ำ
      if (loadingRef.current) {
        debugLog('⚠️ Already loading, skipping...');
        return;
      }
      
      debugLog('📅 วันที่เปลี่ยนเป็น:', selectedDate);
      loadingRef.current = true;
      
      loadAllProductionData().finally(() => {
        loadingRef.current = false;
      });
    } else if (!selectedDate && isClient) {
      debugLog('⚠️ selectedDate is empty, waiting...');
    }
  }, [selectedDate, isClient]);

  // Fetch dropdown data on mount
  useEffect(() => {
    debugLog('🔍 Fetching dropdown data...');
    debugLog('API URL:', process.env.NEXT_PUBLIC_API_URL);
    
    // Fetch users with cache
    const cachedUsers = clientCache.get(CACHE_KEYS.USERS);
    if (cachedUsers) {
      debugLog('Using cached users data');
      setUsers(cachedUsers as User[]);
    } else {
      planningApi
        .getUsers()
        .then((data) => {
          debugLog("Users data:", data);
          const usersData = data?.data || [];
          setUsers(usersData);
          clientCache.set(CACHE_KEYS.USERS, usersData, CACHE_TTL.VERY_LONG);
        })
        .catch((err) => {
          debugError("Error fetching users:", err);
          setUsers([] as User[]);
        });
    }
    
    // Fetch machines with cache
    const cachedMachines = clientCache.get(CACHE_KEYS.MACHINES);
    if (cachedMachines) {
      debugLog('Using cached machines data');
      setMachines(cachedMachines as Machine[]);
    } else {
      planningApi
        .getMachines()
        .then((data) => {
          debugLog("Machines data:", data);
          const machinesData = data?.data || [];
          setMachines(machinesData);
          clientCache.set(CACHE_KEYS.MACHINES, machinesData, CACHE_TTL.VERY_LONG);
        })
        .catch((err) => {
          debugError("Error fetching machines:", err);
          setMachines([] as Machine[]);
        });
    }
    
    // Fetch production rooms
    planningApi
      .getProductionRooms()
      .then((data) => {
        debugLog("Rooms data:", data);
        setRooms(data?.data || []);
      })
      .catch((err) => {
        debugError("Error fetching rooms:", err);
        setRooms([]);
      });
  }, []);

  // Debug state changes
  useEffect(() => {
    debugLog('👥 Users state updated:', users);
    debugLog('⏰ Time options state updated:', timeOptions);
  }, [users, timeOptions]);

  // useEffect สำหรับ focus ที่ช่องที่ auto-fill แล้ว
  useEffect(() => {
    if (shouldFocusFields && autoFilledFields.size > 0) {
      // Focus ที่ช่องแรกที่ auto-fill
      const focusOrder = ['operators', 'startTime', 'endTime', 'room'];
      
      for (const field of focusOrder) {
        if (autoFilledFields.has(field)) {
          setTimeout(() => {
            if (field === 'operators') {
              // Focus ที่ผู้ปฏิบัติงานคนแรกที่มีค่า
              const firstOperatorIndex = operators.findIndex(op => op && op !== '');
              if (firstOperatorIndex >= 0 && getOperatorTriggerRef(firstOperatorIndex)?.current) {
                getOperatorTriggerRef(firstOperatorIndex)?.current?.focus();
              }
            } else if (field === 'startTime' && startTimeRef.current) {
              startTimeRef.current.focus();
            } else if (field === 'endTime' && endTimeRef.current) {
              endTimeRef.current.focus();
            } else if (field === 'room' && roomRef.current) {
              roomRef.current.focus();
            }
          }, 100);
          break; // ออกจาก for loop เมื่อเจอ field แรกที่ auto-fill
        }
      }
    }
  }, [shouldFocusFields, autoFilledFields, operators]);

  // useEffect สำหรับลบ focus เมื่อผู้ใช้คลิกที่อื่น
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // ถ้าคลิกนอกฟอร์มหรือคลิกที่ element อื่น ให้ลบ focus
      if (!target.closest('[role="combobox"]') && !target.closest('[role="listbox"]')) {
        setShouldFocusFields(false);
      }
    };

    if (shouldFocusFields) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [shouldFocusFields]);

  // Autocomplete job name/code - ใช้ local search แทน API เพื่อความเร็ว (ปิดใช้งานแล้ว)
  /*
  useEffect(() => {
  // ถ้าเพิ่งเลือกจาก dropdown ให้ข้าม effect นี้
  if (justSelectedFromDropdownRef.current) {
    debugLog('🔒 Skipping search - just selected from dropdown');
    justSelectedFromDropdownRef.current = false;
    setShowJobDropdown(false); // บังคับปิด dropdown
    setJobOptions([]); // เคลียร์ options
    return;
  }

  debugLog('🔍 useEffect triggered with debouncedJobQuery:', `"${debouncedJobQuery}"`);
  debugLog('🔍 Trimmed length:', debouncedJobQuery.trim().length);
  
  if (debouncedJobQuery.trim().length < 1) {
    debugLog('🚫 Empty search term, hiding dropdown');
    setShowJobDropdown(false);
    setJobOptions([]);
    setIsSearching(false);
    return;
  }

  setIsSearching(false);

  const searchTerm = debouncedJobQuery.trim().toLowerCase();
  debugLog('🔍 Searching for:', `"${searchTerm}"`);
  const allCachedResults: { job_code: string; job_name: string }[] = [];

  for (const results of searchCacheRef.current.values()) {
    allCachedResults.push(...results);
  }

  const filteredResults = allCachedResults.filter(
    (item) =>
      item.job_name.toLowerCase().includes(searchTerm) ||
      item.job_code.toLowerCase().includes(searchTerm)
  );

  const uniqueResults = filteredResults.filter((item, index, self) =>
    index === self.findIndex((t) =>
      t.job_code === item.job_code && t.job_name === item.job_name
    )
  );

  setJobOptions(uniqueResults);
  setShowJobDropdown(uniqueResults.length > 0);

  if (uniqueResults.length === 0 && debouncedJobQuery.trim().length >= 2) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      abortControllerRef.current = new AbortController();

             fetch(`/api/process-steps/search?query=${encodeURIComponent(debouncedJobQuery)}`, {
        signal: abortControllerRef.current.signal
      })
        .then(res => res.json())
        .then(data => {
          const results = data.data || [];
          const cacheKey = debouncedJobQuery.toLowerCase().trim();
          searchCacheRef.current.set(cacheKey, results);
          if (searchCacheRef.current.size > 50) {
            const firstKey = searchCacheRef.current.keys().next().value;
            if (firstKey) {
            searchCacheRef.current.delete(firstKey);
            }
          }
          setJobOptions(results);
          setShowJobDropdown(true);
          setIsSearching(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            debugError('Error fetching job options:', err);
            setJobOptions([]);
            setShowJobDropdown(false);
          }
          setIsSearching(false);
        });
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }
}, [debouncedJobQuery]);
*/

  // ฟังก์ชันสร้าง job_code ใหม่ (เลขงานอัตโนมัติ)
  const handleAddNewJob = () => {
    // หาเลขงานที่ยังไม่ซ้ำ (เริ่มจาก 1)
    let jobNumber = 1;
    const allCodes = productionData.map((item: any) => item.job_code?.toLowerCase()).filter(Boolean);
    
    // หาเลขงานที่ยังไม่ซ้ำ
    while (allCodes.includes(jobNumber.toString())) {
      jobNumber++;
    }
    
    // สร้าง job_code เป็นเลขงาน
    const newJobCode = jobNumber.toString();
    setJobCode(newJobCode);
    return newJobCode;
  };

  // Helper functions for week navigation
  const getWeekDates = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
    startOfWeek.setDate(diff)

    // เพิ่มเฉพาะ 6 วัน (จันทร์-เสาร์) ไม่รวมอาทิตย์
    for (let i = 0; i < 6; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }






  // เพิ่มฟังก์ชันสำหรับสีของแต่ละวัน

  // Get production data for current week

  // Get production data for selected day
  const getSelectedDayProduction = () => {
    const targetDate = viewMode === "daily" ? selectedDate : selectedWeekDay;
    if (!targetDate) return [];
    const defaultCodes = ['A', 'B', 'C', 'D'];
    const normalizeDate = (dateStr: string) => {
      if (!dateStr) return '';
      return formatDateForAPI(dateStr);
    };
    const dayData = productionData.filter(item => normalizeDate(item.production_date) === normalizeDate(targetDate));
    
    const normalJobs = dayData.filter(
      (item) => !defaultCodes.includes(item.job_code) && !isSpecialItem(item),
    );
    const specialJobs = dayData.filter(
      (item) => !defaultCodes.includes(item.job_code) && isSpecialItem(item),
    );

    // Debug: แสดงข้อมูลการแยกงาน
    debugLog("🔍 [DEBUG] getSelectedDayProduction แยกงาน:");
    debugLog("🔍 [DEBUG] งานปกติ:", normalJobs.length, "รายการ");
    debugLog("🔍 [DEBUG] งานพิเศษ:", specialJobs.length, "รายการ");
    debugLog("🔍 [DEBUG] งานปกติ:", normalJobs.map(item => ({ 
      job_name: item.job_name, 
      is_special: item.is_special, 
      workflow_status_id: item.workflow_status_id 
    })));
    debugLog("🔍 [DEBUG] งานพิเศษ:", specialJobs.map(item => ({ 
      job_name: item.job_name, 
      is_special: item.is_special, 
      workflow_status_id: item.workflow_status_id 
    })));

    // รวมกลุ่มตามลำดับเดิม: default -> งานปกติ -> งานพิเศษ
    return buildSelectedDayProductionOrder(dayData, isSpecialItem, defaultCodes);
  };

  // Use useMemo to recalculate when productionData changes

  const selectedDayProduction = useMemo(() => {
    const result = getSelectedDayProduction();
    debugLog('🎯 [DEBUG] selectedDayProduction useMemo recalculated');
    debugLog('🎯 [DEBUG] selectedDayProduction length:', result.length);
    debugLog('🎯 [DEBUG] selectedDayProduction sample:', result.slice(0, 3));
    return result;
  }, [productionData, selectedDate, selectedWeekDay, viewMode]);

  const clearDraftHighlights = () => {
    if (draftHighlightTimeoutRef.current) {
      clearTimeout(draftHighlightTimeoutRef.current);
      draftHighlightTimeoutRef.current = null;
    }
    setDraftHighlightIds(new Set());
  };

  const getBlockingRegularDrafts = () => {
    return getSelectedDayProduction().filter((item: any) => (
      item.job_type === 'regular' && item.workflow_status === 'draft'
    ));
  };

  const focusAndHighlightDraftCards = (draftItems: any[]) => {
    if (!draftItems.length) return;

    const ids = draftItems.map((item) => String(item.id)).filter(Boolean);
    if (!ids.length) return;

    setDraftHighlightIds(new Set(ids));

    if (draftHighlightTimeoutRef.current) {
      clearTimeout(draftHighlightTimeoutRef.current);
    }
    draftHighlightTimeoutRef.current = setTimeout(() => {
      setDraftHighlightIds(new Set());
      draftHighlightTimeoutRef.current = null;
    }, 2000);

    const firstId = ids[0];
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(`work-plan-card-${firstId}`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  useEffect(() => {
    return () => {
      if (draftHighlightTimeoutRef.current) {
        clearTimeout(draftHighlightTimeoutRef.current);
      }
    };
  }, []);

  // ฟังก์ชันคำนวณลำดับงานตามเวลาเริ่มและผู้ปฏิบัติงาน
  const calculateWorkOrder = (targetDate: string, targetStartTime: string, targetOperators: string) => {
    const jobsOnDate = productionData.filter(item => {
      const itemDate = item.production_date ? item.production_date.split('T')[0] : '';
      return itemDate === targetDate;
    });
    
    // เรียงงานตามเวลาเริ่มและผู้ปฏิบัติงาน
    const sortedJobs = sortByStartTimeAndFirstOperator(jobsOnDate);

    debugLog('🔍 [DEBUG] Sorted week data:', sortedJobs.map((item: any) => ({
      job_name: item.job_name,
      start_time: item.start_time,
      operators: item.operators,
      first_operator: (item.operators || "").split(", ")[0] || ""
    })));

    return sortedJobs.length + 1;
  }

  // ฟังก์ชันค้นหางานจากฐานข้อมูลโดยใช้ job_name
  const findJobCodeByName = async (jobName: string): Promise<string | null> => {
    if (!jobName || !jobName.trim()) return null;
    
    try {
      debugLog('🔍 Searching for job_code by job_name:', jobName.trim());
      
      // ค้นหาจาก process_steps (มีสูตร)
      const processStepsData = await planningApi.searchProcessSteps(jobName.trim());
      
      if (processStepsData.success && processStepsData.data && processStepsData.data.length > 0) {
        // หางานที่ตรงกับ job_name มากที่สุด (exact match หรือ closest match)
        const exactMatch = processStepsData.data.find((item: any) => 
          item.job_name && item.job_name.trim().toLowerCase() === jobName.trim().toLowerCase()
        );
        
        if (exactMatch && exactMatch.job_code) {
          debugLog('✅ Found exact match in process_steps:', exactMatch.job_code);
          return exactMatch.job_code.trim();
        }
        
        // ถ้าไม่มี exact match ให้ใช้ตัวแรกที่เจอ
        const firstMatch = processStepsData.data[0];
        if (firstMatch && firstMatch.job_code) {
          debugLog('✅ Found closest match in process_steps:', firstMatch.job_code);
          return firstMatch.job_code.trim();
        }
      }
      
      // ค้นหาจาก work_plans (งานที่เคยบันทึก)
      const workPlansData = await planningApi.searchWorkPlansByName(jobName.trim());
      
      if (workPlansData.success && workPlansData.data && workPlansData.data.length > 0) {
        // หางานที่ตรงกับ job_name มากที่สุด
        const exactMatch = workPlansData.data.find((item: any) => 
          item.job_name && item.job_name.trim().toLowerCase() === jobName.trim().toLowerCase()
        );
        
        if (exactMatch && exactMatch.job_code && exactMatch.job_code !== 'NEW') {
          debugLog('✅ Found exact match in work_plans:', exactMatch.job_code);
          return exactMatch.job_code.trim();
        }
        
        // ถ้าไม่มี exact match ให้ใช้ตัวแรกที่เจอ (แต่ไม่ใช่ 'NEW')
        const firstMatch = workPlansData.data.find((item: any) => 
          item.job_code && item.job_code !== 'NEW'
        );
        if (firstMatch && firstMatch.job_code) {
          debugLog('✅ Found closest match in work_plans:', firstMatch.job_code);
          return firstMatch.job_code.trim();
        }
      }
      
      debugLog('❌ No job_code found for:', jobName.trim());
      return null;
    } catch (error) {
      debugError('Error searching for job_code:', error);
      return null;
    }
  };

  // ฟังก์ชันสร้างเลขงานอัตโนมัติ
  const generateJobCode = () => {
    // หาเลขงานที่ยังไม่ซ้ำในวันนั้น
    const dayJobs = productionData.filter(item => 
      item.production_date === selectedDate
    );
    
    let jobNumber = 1;
    const existingCodes = dayJobs.map(job => job.job_code);
    
    // หาเลขงานที่ยังไม่ซ้ำ (เริ่มจาก 1, 2, 3, 4, 5...)
    while (existingCodes.includes(jobNumber.toString())) {
      jobNumber++;
    }
    
    return jobNumber.toString();
  };

  const isJobNameDuplicate = (name: string) => {
    // ตรวจสอบกับข้อมูลที่มีอยู่จริงในระบบเฉพาะวันที่เลือก
    const normalizedName = normalizeJobName(name);
    debugLog('🔍 [DEBUG] Checking for duplicate job name:', name);
    debugLog('🔍 [DEBUG] Normalized name:', normalizedName);
    debugLog('🔍 [DEBUG] Selected date:', selectedDate);
    
    // กรองข้อมูลเฉพาะวันที่เลือก
    const jobsOfSelectedDate = productionData.filter(item => {
      const itemDate = item.production_date ? item.production_date.split('T')[0] : '';
      return itemDate === selectedDate;
    });
    
    debugLog('🔍 [DEBUG] Jobs of selected date:', jobsOfSelectedDate.map(item => ({
      job_name: item.job_name || '',
      normalized: normalizeJobName(item.job_name || ''),
      production_date: item.production_date
    })));
    
    const isDuplicate = jobsOfSelectedDate.some(item => normalizeJobName(item.job_name || '') === normalizedName);
    debugLog('🔍 [DEBUG] Is duplicate:', isDuplicate);
    return isDuplicate;
  };

  // ฟังก์ชันดึงข้อมูลงานล่าสุด (return ข้อมูล)
  const fetchLatestWorkPlanData = async (jobCode: string, jobName: string) => {
    if (!jobCode && !jobName) return null;
    
    try {
      debugLog('🔍 Fetching latest work plan data for:', { jobCode, jobName });
      
      const params = new URLSearchParams();
      if (jobCode && jobCode !== 'NEW') params.set('job_code', jobCode);
      if (jobName) params.set('job_name', jobName);
      
      const data = await planningApi.getLatestByJob(params);
      
      if (data.success && data.data) {
        return data.data;
      } else {
        debugLog('⚠️ No latest work plan data found');
        return null;
      }
    } catch (error) {
      debugError('Error fetching latest work plan data:', error);
      return null;
    }
  };

  // ฟังก์ชัน auto-fill ข้อมูลพร้อม focus
  const applyAutoFillData = (latestData: any, jobName: string) => {
    const filledFields = new Set<string>();
    
    debugLog('✅ Applying auto-fill data:', latestData);
    
    // Auto-fill ผู้ปฏิบัติงาน
    if (latestData.operators && Array.isArray(latestData.operators) && latestData.operators.length > 0) {
      const operatorsArray = normalizeOperatorSlots(
        latestData.operators.map((op: any) => (typeof op === "object" ? op?.name || "" : op || "")),
      );
      setOperators(operatorsArray);
      filledFields.add('operators');
      debugLog('✅ Auto-filled operators:', operatorsArray);
    }
    
    // Auto-fill เวลาเริ่ม
    if (latestData.start_time) {
      const normalizedStartTime = normalizeTimeForForm(latestData.start_time);
      setStartTime(normalizedStartTime);
      filledFields.add('startTime');
      debugLog('✅ Auto-filled start_time:', normalizedStartTime);
    }
    
    // Auto-fill เวลาสิ้นสุด
    if (latestData.end_time) {
      const normalizedEndTime = normalizeTimeForForm(latestData.end_time);
      setEndTime(normalizedEndTime);
      filledFields.add('endTime');
      debugLog('✅ Auto-filled end_time:', normalizedEndTime);
    }
    
    // Auto-fill ห้องผลิต
    if (latestData.room_code) {
      setSelectedRoom(latestData.room_code);
      filledFields.add('room');
      debugLog('✅ Auto-filled room:', latestData.room_code);
    } else if (latestData.production_room_id) {
      // ถ้าไม่มี room_code ให้หา room_code จาก production_room_id
      const room = rooms.find(r => r.id === latestData.production_room_id || r.id?.toString() === latestData.production_room_id?.toString());
      if (room) {
        setSelectedRoom(room.room_code);
        filledFields.add('room');
        debugLog('✅ Auto-filled room from ID:', room.room_code);
      }
    }
    
    // Auto-fill เครื่องบันทึกข้อมูลการผลิต (optional)
    if (latestData.machine_code) {
      setSelectedMachine(latestData.machine_code);
      debugLog('✅ Auto-filled machine:', latestData.machine_code);
    } else if (latestData.machine_id) {
      // ถ้าไม่มี machine_code ให้หา machine_code จาก machine_id
      const machine = machines.find(m => m.id === latestData.machine_id || m.id?.toString() === latestData.machine_id?.toString());
      if (machine) {
        setSelectedMachine(machine.machine_code);
        debugLog('✅ Auto-filled machine from ID:', machine.machine_code);
      }
    }
    
    setAutoFilledFields(filledFields);
    setShouldFocusFields(true);
    setMessage(`✅ โหลดข้อมูลล่าสุดของงาน "${jobName}" แล้ว`);
  };

  const validateCompleted = (): PlanningFieldErrors => {
    const errors: PlanningFieldErrors = {};
    const normalizedJobName = (jobName || jobQuery || "").trim();
    const hasOperator = operators.filter((op) => op && op !== "__none__").length > 0;
    const normalizedRoom = selectedRoom && selectedRoom !== "__none__";

    if (!normalizedJobName) {
      errors.jobName = "กรุณากรอกชื่องาน";
    } else if (isJobNameDuplicate(normalizedJobName)) {
      errors.jobName = "ชื่องานนี้มีอยู่แล้ว";
    }
    if (!hasOperator) {
      errors.operators = "กรุณาเลือกผู้ปฏิบัติงานอย่างน้อย 1 คน";
    }
    if (!startTime.trim()) {
      errors.startTime = "กรุณาเลือกเวลาเริ่ม";
    }
    if (!endTime.trim()) {
      errors.endTime = "กรุณาเลือกเวลาสิ้นสุด";
    }
    if (!normalizedRoom) {
      errors.room = "กรุณาเลือกห้องผลิต";
    }
    if (startTime.trim() && endTime.trim() && !isEndTimeAfterStartTime(startTime, endTime)) {
      errors.endTime = "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม";
    }

    return errors;
  };

  const validateDraft = (): PlanningFieldErrors => {
    const errors: PlanningFieldErrors = {};
    const normalizedJobName = (jobName || jobQuery || "").trim();

    if (!normalizedJobName) {
      errors.jobName = "กรุณากรอกชื่องาน";
    } else if (isJobNameDuplicate(normalizedJobName)) {
      errors.jobName = "ชื่องานนี้มีอยู่แล้ว";
    }
    if (startTime.trim() && endTime.trim() && !isEndTimeAfterStartTime(startTime, endTime)) {
      errors.endTime = "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม";
    }

    return errors;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // ป้องกัน submit ซ้ำ
    setIsSubmitting(true);
    setMessage("");

    const validationErrors = validateCompleted();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      triggerFieldErrorFlash(validationErrors);
      scrollToFirstValidationError(validationErrors);
      setIsSubmitting(false);
      return;
    }
    clearAllFieldErrors();

    try {
      // map operators เป็น object { id_code, name }
      const operatorsToSend = operators
        .filter(Boolean)
        .map(name => {
          const user = users.find(u => u.name === name);
          return user ? { id_code: user.id_code, name: user.name } : { name };
        });
      debugLog("[DEBUG] create completed plan");
      // ใช้ค่าเริ่มต้นหากไม่มีการใส่เวลา
      const finalStartTime = startTime.trim() || "00:00";
      const finalEndTime = endTime.trim() || "00:00";
      
      // ค้นหางานจากฐานข้อมูลก่อน (ถ้ายังไม่มี job_code หรือ job_code เป็น empty string)
      let finalJobCode = jobCode;
      if (!finalJobCode || finalJobCode.trim() === '' || finalJobCode === 'NEW') {
        debugLog('🔍 Job code is empty or NEW, searching in database...');
        const foundJobCode = await findJobCodeByName(jobName || jobQuery);
        if (foundJobCode) {
          finalJobCode = foundJobCode;
          debugLog('✅ Found job_code from database:', finalJobCode);
          // อัพเดท state เพื่อให้ UI แสดง job_code ที่ถูกต้อง
          setJobCode(finalJobCode);
        } else {
          // ถ้าไม่เจอ ให้สร้างเลขงานอัตโนมัติ
          finalJobCode = generateJobCode();
          debugLog('⚠️ Job not found in database, generating new job_code:', finalJobCode);
        }
      } else {
        debugLog('✅ Using existing job_code:', finalJobCode);
      }
      
      // คำนวณลำดับงาน
      const workOrder = calculateWorkOrder(selectedDate, finalStartTime, operators.filter(Boolean).join(", "));
      const requestBody = {
        production_date: selectedDate,
        job_code: finalJobCode,
        job_name: jobName || jobQuery,
        start_time: finalStartTime,
        end_time: finalEndTime,
        machine_id: machines.find(m => m.machine_code === selectedMachine)?.id || selectedMachine || null,
        production_room_id: rooms.find(r => r.room_code === selectedRoom)?.id || null,
        notes: note,
        workflow_status: 'completed',
        operators: operatorsToSend,
        work_order: workOrder // เพิ่มลำดับงาน
      };
      debugLog("[DEBUG] requestBody:", requestBody);
      const data = await planningApi.createWorkPlan(requestBody);
      debugLog("[DEBUG] API response:", data);
      
      if (data.success) {
        resetForm();
        await loadAllProductionData();
      } else {
        console.warn("[DEBUG] API error message:", data.message);
        setMessage(data.message || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (err: any) {
      debugError("[DEBUG] API error:", err);
      setMessage(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ API');
    }
    setIsSubmitting(false);
  };

  const handleSaveDraft = async () => {
    debugLog('🔧 handleSaveDraft called');
    debugLog('🔧 Current state:', {
      jobName,
      jobQuery,
      jobCode,
      startTime,
      endTime,
      selectedMachine,
      selectedRoom,
      operators,
      note,
      isSubmitting
    });

    if (isSubmitting) {
      debugLog('🔧 Already submitting, returning');
      return; // ป้องกัน submit ซ้ำ
    }
    
    setIsSubmitting(true);
    setMessage("");

    const validationErrors = validateDraft();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      triggerFieldErrorFlash(validationErrors);
      scrollToFirstValidationError(validationErrors);
      setIsSubmitting(false);
      return;
    }
    clearAllFieldErrors();
    const finalJobName = (jobName?.trim() || jobQuery?.trim() || "");
    debugLog('🔧 Final job name:', finalJobName);

    try {
      debugLog('🔧 Starting API call');
      debugLog('📅 Saving draft with date:', selectedDate);
      debugLog('📅 selectedDate type:', typeof selectedDate);
      debugLog('📅 selectedDate value:', selectedDate);
      
      // แปลงวันที่ให้เป็น ISO format (YYYY-MM-DD)
      let formattedDate = selectedDate;
      if (selectedDate) {
        // คาดหวังให้ selectedDate เป็น string รูปแบบ YYYY-MM-DD เสมอ
        if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
          formattedDate = selectedDate;
        } else {
          const dateObj = new Date(selectedDate);
          if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
          }
        }
      }
      debugLog('📅 Formatted date for API:', formattedDate);
      
      // ไม่ใส่ค่า default ถ้าไม่ได้กรอก
      const finalStartTime = startTime?.trim() || "";
      const finalEndTime = endTime?.trim() || "";
      
      // ค้นหางานจากฐานข้อมูลก่อน (ถ้ายังไม่มี job_code หรือ job_code เป็น empty string)
      let finalJobCode = jobCode;
      if (!finalJobCode || finalJobCode.trim() === '' || finalJobCode === 'NEW') {
        debugLog('🔍 [Draft] Job code is empty or NEW, searching in database...');
        const foundJobCode = await findJobCodeByName(finalJobName);
        if (foundJobCode) {
          finalJobCode = foundJobCode;
          debugLog('✅ [Draft] Found job_code from database:', finalJobCode);
          // อัพเดท state เพื่อให้ UI แสดง job_code ที่ถูกต้อง
          setJobCode(finalJobCode);
        } else {
          // ถ้าไม่เจอ ให้สร้างเลขงานอัตโนมัติ
          finalJobCode = generateJobCode();
          debugLog('⚠️ [Draft] Job not found in database, generating new job_code:', finalJobCode);
        }
      } else {
        debugLog('✅ [Draft] Using existing job_code:', finalJobCode);
      }
      
      const requestBody = {
        production_date: formattedDate,
        job_code: finalJobCode,
        job_name: finalJobName,
        workflow_status: 'draft',
        start_time: finalStartTime || null,
        end_time: finalEndTime || null,
        machine_id: machines.find(m => m.machine_code === selectedMachine)?.id || selectedMachine || null,
        production_room_id: rooms.find(r => r.room_code === selectedRoom)?.id || null,
        notes: note || null,
        operators: operators.filter(Boolean).map(name => {
          const user = users.find(u => u.name === name);
          return user ? { id_code: user.id_code, name: user.name } : { name };
        })
      };
      
      debugLog('📅 Request body:', requestBody);
      debugLog('📅 API URL:', `/api/work-plans`);
      
      const data = await planningApi.createWorkPlan(requestBody);
      const success = data?.success ?? true;
      setMessage(success ? 'บันทึกแบบร่างสำเร็จ' : 'เกิดข้อผิดพลาด');
      if (success) {
        debugLog('🔧 Success - resetting form and reloading data');
        resetForm(); // ล้างค่าฟอร์มหลังบันทึกแบบร่างสำเร็จ
        await loadAllProductionData();
      } else {
        debugLog('🔧 API returned success: false');
        setMessage(data?.message || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (err: any) {
      debugError('📅 Error saving draft:', err);
      setMessage(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ API');
    }
    debugLog('🔧 Setting isSubmitting to false');
    setIsSubmitting(false);
  };

  // Helper function to get room name from room code or ID
  const getRoomName = (roomCodeOrId: string | number | undefined) => {
    if (!roomCodeOrId || roomCodeOrId === 'ไม่ระบุ') {
      debugLog('🏠 [DEBUG] getRoomName - No room data:', roomCodeOrId);
      return 'ไม่ระบุ';
    }
    
    debugLog('🏠 [DEBUG] getRoomName input:', roomCodeOrId, 'type:', typeof roomCodeOrId);
    
    // ลองหาโดยใช้ room_code ก่อน
    let room = rooms.find(r => r.room_code === roomCodeOrId);
    
    // หากไม่เจอ ลองหาโดยใช้ ID (รองรับทั้ง string และ number)
    if (!room) {
      room = rooms.find(r => r.id.toString() === roomCodeOrId.toString());
    }
    
    // หากไม่เจอ ลองหาโดยใช้ room_name (กรณีที่ส่งชื่อมาเลย)
    if (!room) {
      room = rooms.find(r => r.room_name === roomCodeOrId);
    }
    
    const result = room ? room.room_name : (typeof roomCodeOrId === 'number' ? roomCodeOrId.toString() : roomCodeOrId);
    debugLog('🏠 [DEBUG] getRoomName result:', result);
    return result;
  };

  // Helper function to render notes
  const renderNotes = (item: any, isFormCollapsed: boolean) => {
    if (!item.notes && !item.note) return null;
    
    return (
      <div
        className={`flex items-start space-x-1 sm:space-x-2 ${
          isFormCollapsed ? "text-sm sm:text-base" : "text-xs sm:text-sm"
        }`}
      >
        <span className="text-red-600 font-semibold flex-shrink-0">หมายเหตุ:</span>
        <span className="text-red-600 font-semibold bg-red-50 px-2 py-1 rounded border-l-2 border-red-400">
          {item.notes || item.note}
        </span>
      </div>
    );
  };





  // Helper function to render staff avatars
  // ✅ ปรับปรุง: ใช้ operators_from_join ก่อน (ข้อมูลจาก JOIN) ถ้าไม่มีค่อยใช้ operators
  const renderStaffAvatars = (staff: any, item?: any, isFormCollapsed?: boolean) => {
    // ✅ ใช้ operators_from_join ก่อน (ข้อมูลจาก Backend JOIN)
    let staffString = '';
    if (item && (item as any).operators_from_join) {
      staffString = String((item as any).operators_from_join);
    } else if (staff) {
      staffString = String(staff);
    }
    
    if (!staffString || staffString.trim() === "") {
      return (
        <span className="text-sm sm:text-base text-gray-500">
          ไม่มีผู้ปฏิบัติงาน
        </span>
      );
    }
    const staffList = getOperatorsArray(staffString);
    
    return (
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="flex -space-x-2">
          {staffList.map((person, index) => {
            // แปลง person เป็น string ถ้าเป็น object
            const personName = typeof person === 'object' ? ((person as any)?.name || (person as any)?.id_code || '') : String(person || '');
            
            return (
              <Avatar
                key={index}
                className={`${isFormCollapsed ? "w-12 h-12 sm:w-14 sm:h-14" : "w-10 h-10 sm:w-12 sm:h-12"} border-2 border-white shadow-sm`}
              >
                <AvatarImage
                  src={getStaffImage(personName)}
                  alt={personName}
                  className="object-cover object-center avatar-image"
                  style={{ imageRendering: "crisp-edges" }}
                />
                <AvatarFallback className="text-[17px] font-medium bg-green-600 text-white">
                  {getStaffInitial(personName)}
                </AvatarFallback>
              </Avatar>
            );
          })}
        </div>
        <span className={`${isFormCollapsed ? "text-base sm:text-lg" : "text-sm sm:text-base"} truncate text-slate-900`}>
          ผู้ปฏิบัติงาน: {staffList.map(person => 
            typeof person === 'object' ? ((person as any)?.name || (person as any)?.id_code || '') : String(person || '')
          ).join(', ')}
        </span>
      </div>
    )
  }

  const [editDraftModalOpen, setEditDraftModalOpen] = useState(false);
  const [editDraftData, setEditDraftData] = useState<any | null>(null);
  const [editDraftId, setEditDraftId] = useState<string>("");
  const { confirmOpen, setConfirmOpen, confirmTitle, confirmMessage, showConfirm, handleConfirmYes, handleConfirmNo } =
    usePlanningDialogs();
  
  // State สำหรับ modal แสดงรายละเอียดการผลิต
  const [productionDetailsModalOpen, setProductionDetailsModalOpen] = useState(false);
  const [productionDetailsData, setProductionDetailsData] = useState<any | null>(null);
  const [productionLogs, setProductionLogs] = useState<any[]>([]);

  // State สำหรับฟอร์มใน modal edit draft
  const [editJobName, setEditJobName] = useState("");
  const [editOperators, setEditOperators] = useState<string[]>(createOperatorSlots());
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editMachine, setEditMachine] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editFieldErrors, setEditFieldErrors] = useState<PlanningFieldErrors>({});
  const [editFlashErrorFields, setEditFlashErrorFields] = useState<Set<PlanningFieldKey>>(new Set());
  const editFlashErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editJobNameRef = useRef<HTMLInputElement>(null);
  const editFirstOperatorRef = useRef<HTMLButtonElement>(null);
  const editStartTimeRef = useRef<HTMLButtonElement>(null);
  const editEndTimeRef = useRef<HTMLButtonElement>(null);
  const editRoomRef = useRef<HTMLButtonElement>(null);

  // ฟังก์ชัน normalize เวลาให้เป็น HH:mm
  const normalizeTime = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  };

  // Prefill ข้อมูลเมื่อเปิด modal
  useEffect(() => {
    if (editDraftModalOpen && editDraftData && users.length > 0) {
      debugLog('🔧 Setting up edit form with data:', editDraftData);
      
      setEditJobName(editDraftData.job_name || "");
      
      // ตั้งค่าผู้ปฏิบัติงาน
      let operatorNames = createOperatorSlots();
      if (editDraftData.operators) {
        debugLog('🔧 Processing operators:', editDraftData.operators);
        
        try {
          if (Array.isArray(editDraftData.operators)) {
            // ถ้าเป็น array อยู่แล้ว
            operatorNames = editDraftData.operators.map((op: any) =>
              typeof op === "object" ? op?.name || "" : op || "",
            );
          } else if (typeof editDraftData.operators === "string") {
            // ลอง parse เป็น JSON ก่อน
            try {
              const parsed = JSON.parse(editDraftData.operators);
              if (Array.isArray(parsed)) {
                operatorNames = parsed.map((op: any) =>
                  typeof op === "object" ? op?.name || "" : op || "",
                );
              }
            } catch {
              // ถ้าไม่ใช่ JSON ให้แยกด้วย comma
              operatorNames = getOperatorsArray(editDraftData.operators);
            }
          }
          operatorNames = normalizeOperatorSlots(operatorNames);
          
          debugLog('🔧 Final operator names:', operatorNames);
        } catch (error) {
          debugError('Error processing operators:', error);
          operatorNames = createOperatorSlots();
        }
      }
      
      setEditOperators(operatorNames);
      setEditStartTime(normalizeTime(editDraftData.start_time) || "");
      setEditEndTime(normalizeTime(editDraftData.end_time) || "");

      // Prefill เครื่องบันทึกข้อมูลการผลิต (machine)
      let machineCode = "";
      if (editDraftData.machine_code) {
        machineCode = editDraftData.machine_code;
      } else if (editDraftData.machine_id) {
        const m = machines.find(m => m.id === editDraftData.machine_id || m.id?.toString() === editDraftData.machine_id?.toString());
        machineCode = m?.machine_code || "";
      } else if (editDraftData.machine) {
        machineCode = editDraftData.machine;
      }
      setEditMachine(machineCode);

      // Prefill ห้องผลิต (room)
      let roomCode = "";
      if (editDraftData.room_code) {
        roomCode = editDraftData.room_code;
      } else if (editDraftData.production_room_id) {
        const r = rooms.find(r => r.id === editDraftData.production_room_id || r.id?.toString() === editDraftData.production_room_id?.toString());
        roomCode = r?.room_code || "";
      } else if (editDraftData.production_room) {
        roomCode = editDraftData.production_room;
      }
      setEditRoom(roomCode);

      setEditNote(editDraftData.notes || editDraftData.note || "");
      setEditDate(editDraftData.production_date ? (editDraftData.production_date.split("T")[0]) : "");
      setEditFieldErrors({});
      setEditFlashErrorFields(new Set());
      
      debugLog('🔧 Form setup complete:', {
        jobName: editDraftData.job_name,
        operators: operatorNames,
        startTime: editDraftData.start_time,
        endTime: editDraftData.end_time,
        machine: machineCode,
        room: roomCode,
        note: editDraftData.notes || editDraftData.note
      });
    }
  }, [editDraftModalOpen, editDraftData, users, machines, rooms]);
  useEffect(() => {
    if (!editDraftModalOpen) {
      setEditFieldErrors({});
      setEditFlashErrorFields(new Set());
    }
  }, [editDraftModalOpen]);
  useEffect(() => {
    return () => {
      if (editFlashErrorTimeoutRef.current) {
        clearTimeout(editFlashErrorTimeoutRef.current);
      }
    };
  }, []);

  const handleEditDraft = (draftItem: any) => {
    debugLog('✏️ Opening edit modal for draft item:', draftItem);
    
    // ใช้ข้อมูลจริงแทนข้อมูล test
    const realData = {
      id: draftItem.id,
      job_name: draftItem.job_name,
      job_code: draftItem.job_code,
      workflow_status: draftItem.workflow_status,
      recordStatus: draftItem.recordStatus,
      isDraft: draftItem.isDraft,
      operators: draftItem.operators || [],
      start_time: draftItem.start_time,
      end_time: draftItem.end_time,
      production_date: draftItem.production_date,
      machine_id: draftItem.machine_id,
      production_room_id: draftItem.production_room_id,
      production_room: draftItem.production_room,
      machine_code: draftItem.machine_code,
      notes: draftItem.notes || draftItem.note || "",
      workflow_status_id: draftItem.workflow_status_id
    };
    
    debugLog('✏️ Using real data:', realData);
    
    // ตั้งค่า state ก่อน
    setEditDraftData(realData);
    setEditDraftId(realData.id.toString());
    
    // เปิด modal หลังจากตั้งค่า state แล้ว
    debugLog('✏️ Setting modal open to true');
    setEditDraftModalOpen(true);
    
    // ตรวจสอบ state หลังจากตั้งค่า
    setTimeout(() => {
      debugLog('✏️ Modal state check:', {
        editDraftModalOpen: true,
        editDraftData: realData,
        editDraftId: realData.id.toString()
      });
    }, 100);
  };

  const clearEditFieldError = useCallback((field: PlanningFieldKey) => {
    setEditFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setEditFlashErrorFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);
  const triggerEditFieldErrorFlash = useCallback((errors: PlanningFieldErrors) => {
    const errorKeys = (Object.keys(errors) as PlanningFieldKey[]).filter((field) => Boolean(errors[field]));
    if (errorKeys.length === 0) return;
    setEditFlashErrorFields(new Set(errorKeys));
    if (editFlashErrorTimeoutRef.current) {
      clearTimeout(editFlashErrorTimeoutRef.current);
    }
    editFlashErrorTimeoutRef.current = setTimeout(() => {
      setEditFlashErrorFields(new Set());
      editFlashErrorTimeoutRef.current = null;
    }, 2000);
  }, []);
  const focusEditFieldByError = useCallback((field: PlanningFieldKey) => {
    const targetMap: Record<PlanningFieldKey, HTMLElement | null> = {
      jobName: editJobNameRef.current,
      operators: editFirstOperatorRef.current,
      startTime: editStartTimeRef.current,
      endTime: editEndTimeRef.current,
      room: editRoomRef.current,
    };
    const target = targetMap[field];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus?.(), 120);
  }, []);
  const scrollToFirstEditValidationError = useCallback((errors: PlanningFieldErrors) => {
    const priority: PlanningFieldKey[] = ["jobName", "operators", "startTime", "endTime", "room"];
    const firstErrorField = priority.find((field) => Boolean(errors[field]));
    if (firstErrorField) {
      focusEditFieldByError(firstErrorField);
    }
  }, [focusEditFieldByError]);
  const validateEditDraft = (isDraft: boolean): PlanningFieldErrors => {
    const errors: PlanningFieldErrors = {};
    const normalizedJobName = editJobName.trim();
    const hasOperator = editOperators.filter((op) => op && op !== "__none__").length > 0;
    const hasStartTime = editStartTime.trim() !== "";
    const hasEndTime = editEndTime.trim() !== "";
    const hasRoom = editRoom.trim() !== "";

    if (!normalizedJobName) {
      errors.jobName = "กรุณากรอกชื่องาน";
    }

    if (!isDraft) {
      if (!hasOperator) {
        errors.operators = "กรุณาเลือกผู้ปฏิบัติงานอย่างน้อย 1 คน";
      }
      if (!hasStartTime) {
        errors.startTime = "กรุณาเลือกเวลาเริ่ม";
      }
      if (!hasEndTime) {
        errors.endTime = "กรุณาเลือกเวลาสิ้นสุด";
      }
      if (!hasRoom) {
        errors.room = "กรุณาเลือกห้องผลิต";
      }
    }

    if (hasStartTime && hasEndTime && !isEndTimeAfterStartTime(editStartTime, editEndTime)) {
      errors.endTime = "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม";
    }

    return errors;
  };

  const handleSaveEditDraft = async (isDraft = false) => {
    if (!editDraftData) return;
    setIsSubmitting(true);
    setMessage("");
    const validationErrors = validateEditDraft(isDraft);
    if (Object.keys(validationErrors).length > 0) {
      setEditFieldErrors(validationErrors);
      triggerEditFieldErrorFlash(validationErrors);
      scrollToFirstEditValidationError(validationErrors);
      setIsSubmitting(false);
      return;
    }
    setEditFieldErrors({});
    setEditFlashErrorFields(new Set());
    try {
      // map operators เป็น object { id_code, name }
      const operatorsToSend = editOperators
        .filter(Boolean)
        .map(name => {
          const user = users.find(u => u.name === name);
          return user ? { id_code: user.id_code, name: user.name } : { name };
        });
      const requestBody = {
        production_date: editDate,
        job_code: editDraftData.job_code,
        job_name: editJobName,
        start_time: editStartTime,
        end_time: editEndTime,
        machine_id: machines.find(m => m.machine_code === editMachine)?.id || null,
        production_room_id: rooms.find(r => r.room_code === editRoom)?.id || null,
        notes: editNote,
        workflow_status: isDraft ? 'draft' : 'completed',
        operators: operatorsToSend
      };
      // ตรวจสอบว่า editDraftData.id เป็น string และมี replace method
      const draftId = editDraftData.id && typeof editDraftData.id === 'string' 
        ? editDraftData.id.replace('draft_', '') 
        : String(editDraftData.id || '');
      
      const data = await planningApi.updateWorkPlan(draftId, requestBody);
      
      if (data.success) {
        const successMessage = isDraft ? "บันทึกแบบร่างสำเร็จ" : "บันทึกเสร็จสิ้น";
        setMessage(successMessage);
        // ไม่แสดง popup สำเร็จหลังบันทึกเสร็จสิ้น เพื่อไม่ขัด flow การใช้งาน
        setEditDraftModalOpen(false);
        await loadAllProductionData();
      } else {
        setMessage(data.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      debugError("[DEBUG] Error in handleSaveEditDraft:", err);
      setMessage(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ API");
    }
    setIsSubmitting(false);
  };

  // ฟังก์ชันพิมพ์ใบงาน
  const handlePrintWorkPlan = async () => {
    setIsSubmitting(true);
    setMessage("");
    clearDraftHighlights();
    
    try {
      // เช็คว่ามีงาน regular ที่ยังเป็น draft อยู่ไหม
      const regularDrafts = getBlockingRegularDrafts();
      
      if (regularDrafts.length > 0) {
        focusAndHighlightDraftCards(regularDrafts);
        setMessage(`กรุณาบันทึกงานให้เสร็จสิ้นทุกงานก่อนพิมพ์ (เหลืออีก ${regularDrafts.length} งาน)`);
        setIsSubmitting(false);
        return;
      }
      
      // ยืนยันการพิมพ์
      const confirmed = confirm(
        'คุณต้องการพิมพ์ใบงานผลิตใช่หรือไม่?\n' +
        'หลังจากพิมพ์แล้ว งานที่เพิ่มใหม่จะกลายเป็น "งานพิเศษ"'
      );
      
      if (!confirmed) {
        setIsSubmitting(false);
        return;
      }
      
      debugLog('🖨️ Printing work plan for:', selectedDate);
      
      const data = await planningApi.printWorkPlans({ production_date: selectedDate });
      
      if (data.success) {
        clearDraftHighlights();
        setMessage('พิมพ์ใบงานสำเร็จ');
        setSuccessDialogMessage('พิมพ์ใบงานสำเร็จ');
        setShowSuccessDialog(true);
        
        // รีโหลดข้อมูล
        await loadAllProductionData();

        const encodedDate = encodeURIComponent(selectedDate);
        window.open(`/planner/print/date/${encodedDate}`, "_blank", "noopener,noreferrer");
        
        // เปิด Google Sheet
        window.open("https://docs.google.com/spreadsheets/d/1lzsYNoIbTd1Uy5r37xUtK5PuOHyNlYYiqS7xZvrU8C8", "_blank");
      } else {
        setMessage(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (err: any) {
      debugError('Error printing work plan:', err);
      const errorMessage = err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ API';
      const regularDrafts = getBlockingRegularDrafts();
      if (regularDrafts.length > 0) {
        focusAndHighlightDraftCards(regularDrafts);
      }
      setMessage(errorMessage);
    }
    
    setIsSubmitting(false);
  };

  const handleSyncDrafts = async () => {
    clearDraftHighlights();
    const regularDrafts = getBlockingRegularDrafts();
    if (regularDrafts.length > 0) {
      focusAndHighlightDraftCards(regularDrafts);
      setMessage(`กรุณาบันทึกงานให้เสร็จสิ้นทุกงานก่อนพิมพ์ (เหลืออีก ${regularDrafts.length} งาน)`);
      return;
    }

    // ปุ่มพิมพ์ใบงานผลิต: ส่งข้อมูลไป Google Sheet ตามวันที่ที่เปิด และเปิดแท็บชีต
    await handleSyncDraftsOld();
  };

  // ฟังก์ชัน Sync Drafts เดิม (สำหรับ backward compatibility)
  const handleSyncDraftsOld = async () => {
    // เปิด Google Sheet ก่อน
    debugLog("🟢 [DEBUG] กำลังเปิด Google Sheet...");
    try {
      window.open(GOOGLE_SHEET_TAB_URL, "_blank");
      debugLog("🟢 [DEBUG] เปิด Google Sheet สำเร็จ");
    } catch (err) {
      debugError("🔴 [DEBUG] ไม่สามารถเปิด Google Sheet ได้:", err);
      // ลองเปิดด้วยวิธีอื่น
      const link = document.createElement('a');
      link.href = GOOGLE_SHEET_TAB_URL;
      link.target = "_blank";
      link.click();
    }

    setIsSubmitting(true);
    setMessage("");
    try {
      await planningApi.syncDraftsToPlans(selectedDate);
      // 1. เตรียมข้อมูล summaryRows สำหรับ 1.ใบสรุปงาน v.4 (ไม่เอา A, B, C, D)
      const defaultCodes: string[] = [...DEFAULT_JOB_CODES];
          // ฟังก์ชันแปลงรหัส/ID ห้องเป็นชื่อห้อง
    const getRoomNameByCodeOrId = (codeOrId: string | undefined) => {
      if (!codeOrId) return "";
      // ใช้ข้อมูลจาก Frontend
      const room = rooms.find(r => r.room_code === codeOrId || r.id?.toString() === codeOrId?.toString());
      return room?.room_name || codeOrId;
    };
    // ฟังก์ชันแปลง ID เครื่องเป็นชื่อเครื่อง
    const getMachineNameById = (machineId: string | undefined) => {
      if (!machineId) return "";
      // ใช้ข้อมูลจาก Frontend
      const machine = machines.find(m => m.id?.toString() === machineId?.toString());
      return machine?.machine_name || machineId;
    };
      // แยกงานปกติและงานพิเศษ (ใช้ is_special = 1 หรือ workflow_status_id = 10)
      const { normalJobs, specialJobs } = splitProductionJobs(productionData, selectedDate, defaultCodes);
      
      // เรียงงานปกติตาม id อย่างเดียว (เก่าสุดก่อน)
      const sortedNormalJobs = sortByNumericId(normalJobs);
      
      // เรียงงานพิเศษตาม id อย่างเดียว (เก่าสุดก่อน)
      const sortedSpecialJobs = sortByNumericId(specialJobs);
      
      // Debug: แสดงข้อมูลการแยกงาน
      debugLog("🔍 [DEBUG] แยกงานพิเศษ:");
      debugLog("🔍 [DEBUG] งานปกติ:", normalJobs.length, "รายการ");
      debugLog("🔍 [DEBUG] งานพิเศษ:", specialJobs.length, "รายการ");
      debugLog("🔍 [DEBUG] งานปกติ:", normalJobs.map(item => ({ 
        job_name: item.job_name, 
        is_special: item.is_special, 
        workflow_status_id: item.workflow_status_id 
      })));
      debugLog("🔍 [DEBUG] งานพิเศษ:", specialJobs.map(item => ({ 
        job_name: item.job_name, 
        is_special: item.is_special, 
        workflow_status_id: item.workflow_status_id 
      })));
      
      // รวมงานปกติ + งานพิเศษ (งานพิเศษอยู่ด้านล่างสุด)
      const filtered = [...sortedNormalJobs, ...sortedSpecialJobs];
      
      // สำหรับใบสรุปงาน: ตัดงานรหัส A/B/C/D ออก
      const summaryJobs = filtered.filter((item) => !defaultCodes.includes(item.job_code));

      // Debug: แสดงข้อมูลที่ส่งไป Google Sheet
      debugLog("🔍 [DEBUG] ข้อมูลที่ส่งไป Google Sheet:");
      debugLog("🔍 [DEBUG] จำนวนงานทั้งหมด (ไม่รวม A/B/C/D):", summaryJobs.length);
      debugLog("🔍 [DEBUG] ลำดับงาน:", summaryJobs.map((item, idx) => ({
        ลำดับ: idx + 1,
        job_name: item.job_name,
        is_special: item.is_special,
        workflow_status_id: item.workflow_status_id,
        start_time: item.start_time
      })));
      const summaryRows = buildSummaryRows(summaryJobs, getMachineNameById, getRoomNameByCodeOrId);
      // 2. ส่ง batch ไป 1.ใบสรุปงาน v.4
      debugLog("🟡 [DEBUG] ส่งข้อมูลไป 1.ใบสรุปงาน v.4:", summaryRows.length, "แถว");
      debugLog("🟡 [DEBUG] ข้อมูล summaryRows:", summaryRows);
      try {
        await sendToGoogleSheet({
          sheetName: "1.ใบสรุปงาน v.4",
          rows: summaryRows,
          clearSheet: true
        });
        debugLog("🟢 [DEBUG] ส่งข้อมูลไป 1.ใบสรุปงาน v.4 สำเร็จ");
      } catch (error) {
        debugError("🔴 [DEBUG] เกิดข้อผิดพลาดในการส่งข้อมูลไป 1.ใบสรุปงาน v.4:", error);
        throw error; // Re-throw เพื่อให้ caller จับได้
      }

      // 3. เตรียมข้อมูลสำหรับ Log_แผนผลิต (แยกแถวตามผู้ปฏิบัติงาน)
      // ใช้ selectedDate แทน today เพื่อให้วันที่ตรงกับข้อมูลงาน
       const selectedDateObj = createSafeDate(selectedDate);
       const dateString = selectedDateObj ? formatDateForGoogleSheet(selectedDateObj) : 'Invalid Date';
       const dateValue = selectedDateObj ? formatDateForValue(selectedDateObj) : 'Invalid Date';

      debugLog("🟡 [DEBUG] Date processing:");
      debugLog("🟡 [DEBUG] selectedDate (input):", selectedDate);
      debugLog("🟡 [DEBUG] selectedDateObj:", selectedDateObj);
      debugLog("🟡 [DEBUG] dateString:", dateString);
      debugLog("🟡 [DEBUG] dateValue:", dateValue);
      const { logRows, defaultJobsData } = buildLogRows({
        productionData,
        selectedDate,
        dateString,
        dateValue,
        defaultCodes,
        filteredJobs: filtered,
        getRoomNameByCodeOrId,
      });

      debugLog("🔍 [DEBUG] ข้อมูลงาน A B C D ที่หาได้:", defaultJobsData);
      debugLog("🔍 [DEBUG] selectedDate:", selectedDate);
      debugLog("🔍 [DEBUG] defaultCodes:", defaultCodes);
      debugLog("🔍 [DEBUG] productionData ทั้งหมด:", productionData.filter(item => item.production_date === selectedDate));

      // 4. ส่ง batch ไป Log_แผนผลิต (แยกการส่ง)
      if (logRows.length > 0) {
        debugLog("🟡 [DEBUG] ส่งข้อมูลไป Log_แผนผลิต:", logRows.length, "แถว");
        debugLog("🟡 [DEBUG] ข้อมูล logRows:", logRows);
        try {
          await sendToGoogleSheet({
            sheetName: "Log_แผนผลิต",
            rows: logRows
          });
          debugLog("🟢 [DEBUG] ส่งข้อมูลไป Log_แผนผลิต สำเร็จ");
        } catch (error) {
          debugError("🔴 [DEBUG] เกิดข้อผิดพลาดในการส่งข้อมูลไป Log_แผนผลิต:", error);
          throw error; // Re-throw เพื่อให้ caller จับได้
        }
      } else {
        debugLog("🟡 [DEBUG] ไม่มีข้อมูล logRows ที่จะส่ง");
      }
      // 5. อัปเดตวันที่ใน D1 ของ sheet รายงาน-เวลาผู้ปฏิบัติงาน
      const reportPayload = buildReportDatePayload(dateString, dateValue);
      debugLog("🟡 [DEBUG] อัปเดตวันที่ในรายงาน-เวลาผู้ปฏิบัติงาน:", dateValue);
      debugLog("🟡 [DEBUG] Sheet name:", reportPayload.sheetName);
      debugLog("🟡 [DEBUG] Sheet name length:", reportPayload.sheetName.length);
      debugLog("🟡 [DEBUG] selectedDate:", selectedDate);
      debugLog("🟡 [DEBUG] dateValue:", dateValue);
      try {
        await sendToGoogleSheet(reportPayload);
        debugLog("🟢 [DEBUG] อัปเดตวันที่ในรายงาน-เวลาผู้ปฏิบัติงาน สำเร็จ");
      } catch (error) {
        debugError("🔴 [DEBUG] เกิดข้อผิดพลาดในการอัปเดตวันที่ในรายงาน-เวลาผู้ปฏิบัติงาน:", error);
        throw error; // Re-throw เพื่อให้ caller จับได้
      }

      // 6. อัปเดต workflow_status ของงานในวันนั้นเป็น printed
      const printResult = await planningApi.printWorkPlans({ production_date: selectedDate });
      if (!printResult?.success) {
        throw new Error(printResult?.message || "ไม่สามารถอัปเดตสถานะพิมพ์ใบงานได้");
      }

      setIsSubmitting(false);
      
      // เพิ่มการ reload productionData หลัง sync สำเร็จ
      debugLog("🔄 [DEBUG] Sync completed, reloading production data...");
      await loadAllProductionData();
      debugLog("🟢 [DEBUG] Production data reloaded successfully");
      
      // แสดงข้อความสำเร็จ
      setMessage("Sync และพิมพ์ใบงานผลิตสำเร็จ");
      setSuccessDialogMessage("Sync และพิมพ์ใบงานผลิตสำเร็จ");
      setShowSuccessDialog(true);
      
    } catch (err: any) {
      setMessage(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ API");
      setIsSubmitting(false);
    }
  };

  // เพิ่มฟังก์ชันยกเลิกการผลิต
  const handleCancelProduction = async (workPlanId: string) => {
    debugLog('🔴 [DEBUG] handleCancelProduction called with workPlanId:', workPlanId);
    
    const accepted = await showConfirm(
      "คุณต้องการยกเลิกการผลิตนี้หรือไม่?",
      "ยืนยันการยกเลิกงานผลิต"
    );
    if (!accepted) {
      debugLog('🔴 [DEBUG] User cancelled the confirmation dialog');
      return;
    }
    
    debugLog('🔴 [DEBUG] User confirmed cancellation, proceeding...');
    setIsSubmitting(true);
    setMessage("");
    
    try {
      const data = await planningApi.cancelWorkPlan(workPlanId);
      debugLog('🔴 [DEBUG] Response data:', data);
      
      if (data.success) {
        debugLog('🔴 [DEBUG] Cancel successful, reloading production data...');
        setMessage("ยกเลิกการผลิตสำเร็จ");
        await loadAllProductionData(); // reload ข้อมูลหลังจากยกเลิก
        debugLog('🔴 [DEBUG] Production data reloaded');
      } else {
        debugLog('🔴 [DEBUG] Cancel failed:', data.message);
        setMessage(data.message || "เกิดข้อผิดพลาดในการยกเลิกการผลิต");
      }
    } catch (err) {
      debugError('🔴 [DEBUG] Error in handleCancelProduction:', err);
      setMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ API");
    }
    setIsSubmitting(false);
    debugLog('🔴 [DEBUG] handleCancelProduction completed');
  };

  const handleViewProductionDetails = async (item: any) => {
    debugLog('👁️ [DEBUG] handleViewProductionDetails called with item:', item);
    
    setProductionDetailsData(item);
    setProductionDetailsModalOpen(true);
    
    // ดึงข้อมูล logs สำหรับงานนี้
    try {
      const data = await planningApi.getLogsByWorkPlan(item.id);
      
      if (data.success) {
        setProductionLogs(data.data || []);
        debugLog('👁️ [DEBUG] Production logs loaded:', data.data);
      } else {
        debugLog('👁️ [DEBUG] Failed to load logs:', data.message);
        setProductionLogs([]);
      }
    } catch (error) {
      debugError('👁️ [DEBUG] Error loading production logs:', error);
      setProductionLogs([]);
    }
  };

  // ลบงานจริง (work_plans) ใช้ได้เมื่อเป็น draft หรือ completed
  const handleDeleteWorkPlan = async (workPlanId: string) => {
    const accepted = await showConfirm("คุณต้องการลบงานนี้หรือไม่?", "ยืนยันการลบงาน");
    if (!accepted) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      await planningApi.deleteWorkPlan(workPlanId);
      setMessage('ลบงานสำเร็จ');
      // ปิด modal ถ้าเปิดอยู่
      setEditDraftModalOpen(false);
      setEditDraftData(null);
      await loadAllProductionData();
    } catch (err: any) {
      debugError('🗑️ Error deleting work plan:', err);
      setMessage(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ API');
    }
    setIsSubmitting(false);
  };

  const handleDeleteDraft = async (draftId: string) => {
    debugLog('🗑️ Attempting to delete draft with ID:', draftId);
    debugLog('🗑️ Edit draft data:', editDraftData);
    
    const accepted = await showConfirm(
      "คุณต้องการลบแบบร่างนี้หรือไม่?",
      "ยืนยันการลบแบบร่าง"
    );
    if (!accepted) {
      return;
    }
    
    setIsSubmitting(true);
    setMessage("");
    try {
      const isPrefixed = typeof editDraftData?.id === 'string' && editDraftData.id.startsWith('draft_');
      const cleanId = isPrefixed ? editDraftData.id.replace('draft_', '') : draftId;

      // เลือกลำดับ endpoint ตามชนิด ID:
      // - draft_123 => ข้อมูลจาก drafts table เดิม ให้ลบ drafts ก่อน
      // - id ปกติ => ข้อมูลใน work_plans (workflow_status=draft) ให้ลบ work_plans ก่อน
      const urls = isPrefixed
        ? [
            getApiUrl(`/api/work-plans/drafts/${cleanId}`),
            getApiUrl(`/api/work-plans/${cleanId}`),
          ]
        : [
            getApiUrl(`/api/work-plans/${cleanId}`),
            getApiUrl(`/api/work-plans/drafts/${cleanId}`),
          ];
      try {
        await planningApi.deleteDraftByCandidateUrls(urls);
        setMessage('ลบแบบร่างสำเร็จ');
        setEditDraftModalOpen(false);
        await loadAllProductionData();
      } catch {
        throw new Error("ลบไม่สำเร็จทั้งสองปลายทาง");
      }
    } catch (err: any) {
      debugError('🗑️ Error deleting draft:', err);
      setMessage(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ API");
    }
    setIsSubmitting(false);
  };

  // ✅ ปรับปรุง: ใช้ Backend API แทนการสร้างงานเองที่ Frontend
  // เปลี่ยนจากสร้างทีละงาน → เรียก Backend API เดียว (transaction safety, performance ดีกว่า)
  useEffect(() => {
    if (viewMode !== "daily") return;
    if (!selectedDate) return;
    if (isCreatingRef.current) return;
    
    const createDefaultTasks = async () => {
      isCreatingRef.current = true;
      
      try {
        // ตรวจสอบว่า date มีค่า
        if (!selectedDate) {
          debugLog('[AUTO-DEFAULT] No selectedDate, skipping default task creation');
          return;
        }
        
        debugLog(`[AUTO-DEFAULT] Creating default tasks for date: ${selectedDate}`);
        
        // ✅ เรียก Next.js API route (ซึ่งจะ proxy ไปยัง Backend)
        // Backend จะเช็คและสร้างเฉพาะงานที่ยังไม่มี (ละเอียดและแม่นยำ)
        const responseData = await planningApi.createDefaultTasks(selectedDate);
        debugLog(`[AUTO-DEFAULT] Successfully processed default tasks:`, responseData);
        
        if (responseData?.created) {
          debugLog(`[AUTO-DEFAULT] Created ${responseData.createdCount || 0} new tasks`);
        } else {
          debugLog(`[AUTO-DEFAULT] All tasks already exist (${responseData?.skippedCount || 0} tasks)`);
        }
        
        // โหลดข้อมูลใหม่หลังจากสร้าง tasks
        await loadAllProductionData();
        
        debugLog(`[AUTO-DEFAULT] Completed processing default tasks for date: ${selectedDate}`);
      } catch (error) {
        debugError('[AUTO-DEFAULT] Error creating default tasks:', error);
      } finally {
        isCreatingRef.current = false;
      }
    };
    
    createDefaultTasks();
  }, [selectedDate]);

  // เพิ่มฟังก์ชัน syncWorkOrder
  const syncWorkOrder = async (date: string) => {
    if (!date) return;
    try {
      await planningApi.syncWorkOrder(date);
      debugLog(`[SYNC] work_order synced for date: ${date}`);
    } catch (err) {
      console.warn('Failed to sync work order:', err);
    }
  };

  // เพิ่มฟังก์ชัน resetForm สำหรับล้างค่าฟอร์ม
  const resetForm = () => {
    setJobName("");
    setOperators(createOperatorSlots());
    setStartTime("");
    setEndTime("");
    setNote("");
    setSelectedMachine("");
    setSelectedRoom("");
    setJobQuery("");
    setJobCode("");
    clearAllFieldErrors();
  };

  // ฟังก์ชันเคลียร์เฉพาะฟิลด์ที่เลือก (ไม่เคลียร์ job)
  const clearFormFields = () => {
    setOperators(createOperatorSlots());
    setStartTime("");
    setEndTime("");
    setNote("");
    setSelectedRoom("");
    // ล้างช่องค้นหางาน
    setJobQuery("");
    setJobCode("");
    setJobName("");
    // เคลียร์ focus และ auto-filled fields
    setShouldFocusFields(false);
    setAutoFilledFields(new Set());
    clearAllFieldErrors();
    setMessage("ล้างข้อมูลทั้งหมดแล้ว");
  };

  // ฟังก์ชันโหลดข้อมูลย้อนหลัง 30 วัน (background)
  const loadHistoricalData = async (currentDate: string) => {
    try {
      setIsLoadingHistorical(true);
      debugLog('🕐 Loading historical data (30 days) in background...');
      
      // คำนวณวันที่ 30 วันย้อนหลัง
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      // โหลดข้อมูลย้อนหลังแบบ chunks (ไม่ให้หนักเกินไป)
      const chunkSize = 100;
      let page = 1;
      let hasMore = true;
      const historicalData: any[] = [];
      
      while (hasMore && page <= 5) { // จำกัดไม่เกิน 5 หน้า
        const data = await planningApi.getWorkPlansPaged(page, chunkSize);
        
        if (data.success && data.data && data.data.length > 0) {
          // กรองเฉพาะข้อมูล 30 วันย้อนหลัง
          const filteredData = data.data.filter((item: any) => {
            const itemDate = new Date(item.production_date);
            const currentDateObj = new Date(currentDate);
            const diffDays = Math.ceil((currentDateObj.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 30;
          });
          
          historicalData.push(...filteredData);
          debugLog(`📦 Loaded chunk ${page}: ${filteredData.length} items (total: ${historicalData.length})`);
          
          hasMore = data.pagination?.hasNextPage || false;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      // รวมข้อมูลเก่าเข้ากับข้อมูลปัจจุบัน
      if (historicalData.length > 0) {
        setProductionData(prev => {
          // ตรวจสอบว่า prev มีข้อมูลหรือไม่ (ถ้าไม่มีอาจจะยังไม่โหลดเสร็จ)
          if (!prev || prev.length === 0) {
            debugLog('⚠️ Previous data is empty, skipping historical data merge');
            return prev; // ไม่ merge ถ้าข้อมูลหลักยังไม่โหลด
          }
          
          // ลบข้อมูลซ้ำ (ถ้ามี)
          const existingIds = new Set(prev.map((item: any) => item.id));
          const newData = historicalData.filter((item: any) => !existingIds.has(item.id));
          
          debugLog(`📈 Added ${newData.length} historical items to existing ${prev.length} items`);
          return [...prev, ...newData];
        });
      }
      
    } catch (error) {
      debugError('Error loading historical data:', error);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  // ฟังก์ชันโหลดข้อมูลหน้าถัดไป
  const loadMoreData = async () => {
    if (isLoadingMore || !hasNextPage) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      
      // ตรวจสอบว่า date มีค่า
      if (!selectedDate) {
        debugLog('⚠️ No selectedDate, skipping loadMoreData');
        return;
      }
      
      const data = await planningApi.getWorkPlansByDate(selectedDate, nextPage, 100);
      
      if (data.success && data.data) {
        // เพิ่มข้อมูลใหม่เข้าไปใน array เดิม
        setProductionData(prev => [...prev, ...data.data]);
        
        // อัปเดต pagination info
        if (data.pagination) {
          setCurrentPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setHasNextPage(data.pagination.hasNextPage);
        }
      }
    } catch (error) {
      debugError('Error loading more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ลบ infinite scroll logic แล้ว - ให้แสดงยาวลงมาเลย

  // เพิ่มฟังก์ชันโหลดข้อมูลทั้งหมด
  const loadAllProductionData = async () => {
    try {
      // ตรวจสอบว่า date มีค่าก่อนเรียก API
      if (!selectedDate) {
        debugLog('⚠️ No selectedDate available, skipping loadAllProductionData');
        return;
      }
      
      // Capture ค่า date เพื่อใช้ใน setTimeout
      const dateForLoad = selectedDate;
      
      setIsLoadingData(true);
      debugLog('🔄 Starting loadAllProductionData for date:', dateForLoad);
      
      // โหลดข้อมูลสำหรับ weekly view: ดึงข้อมูลวันจันทร์-เสาร์ของสัปดาห์ที่เลือกแบบขนาน
      debugLog('📅 Loading weekly data for base date:', dateForLoad);

      // คำนวณช่วงวันที่ของสัปดาห์ (จันทร์-เสาร์)
      const baseDate = new Date(dateForLoad);
      const baseDay = baseDate.getDay();
      const baseDiff = baseDate.getDate() - baseDay + (baseDay === 0 ? -6 : 1);
      const monday = new Date(baseDate);
      monday.setDate(baseDiff);
      const weekDatesStr: string[] = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayNum}`;
      });

      const weeklyJson = await Promise.all(
        weekDatesStr.map(async (dateItem) => {
          try {
            return await planningApi.getWorkPlansByDateNoStore(dateItem);
          } catch (error) {
            debugError(`❌ API Error for ${dateItem}:`, error);
            return { data: [] };
          }
        }),
      );

      const plans = { data: weeklyJson.flatMap((j: any) => j?.data || []) } as any;
      debugLog('📊 Loaded weekly plans total:', plans.data?.length || 0);
      
      // อัปเดต pagination info
      // สำหรับ weekly view เราอาจไม่มี pagination ที่รวมกันได้ จึง reset ค่าพื้นฐาน
      setCurrentPage(1);
      setTotalPages(1);
      setHasNextPage(false);
      
      // โหลดข้อมูลเพิ่มเติมสำหรับ weekly view ใน background
      setTimeout(() => {
        loadHistoricalData(dateForLoad);
      }, 1000); // เพิ่ม delay เพื่อให้แน่ใจว่าข้อมูลหลักถูก set แล้ว
      
      // ดึงสถานะจาก logs สำหรับ work plans
      const workPlanIds = (plans.data || []).map((p: any) => p.id).filter(Boolean);
      let logsStatusMap: { [key: number]: any } = {};
      
      if (workPlanIds.length > 0) {
        try {
          debugLog('[DEBUG] Fetching logs status for workPlanIds:', workPlanIds);
          const logsData = await planningApi.getLogsStatusByWorkPlanIds(workPlanIds);
          debugLog("[DEBUG] Logs response:", logsData);
          if (logsData?.success) {
            logsStatusMap = logsData.data;
            debugLog("[DEBUG] Logs status map:", logsStatusMap);
          }
        } catch (error) {
          debugError('Error fetching logs status:', error);
        }
      }
      // ประมวลผลข้อมูล work plans
      let allData = (plans.data || []).map((p: any) => {
        // กำหนดสถานะตาม workflow_status
        let recordStatus = 'แบบร่าง';
        let isPrintedFlag = false;
        
        if (p.workflow_status === 'draft') {
          recordStatus = 'แบบร่าง';
        } else if (p.workflow_status === 'completed') {
          recordStatus = 'บันทึกเสร็จสิ้น';
        } else if (p.workflow_status === 'printed') {
          recordStatus = 'พิมพ์แล้ว';
          isPrintedFlag = true;
        }
        
        // กำหนด isDraft ตาม workflow_status
        const isDraft = p.workflow_status === 'draft';
        
        // ใช้สถานะจาก logs ถ้ามี
        const logsStatus = logsStatusMap[p.id];
        let status = p.status_name || 'รอดำเนินการ';
        let status_name = p.status_name || 'รอดำเนินการ';
        
        debugLog(`[DEBUG] Work plan ${p.id} logs status:`, logsStatus);
        debugLog(`[DEBUG] Work plan ${p.id} workflow_status:`, p.workflow_status);
        debugLog(`[DEBUG] Work plan ${p.id} job_type:`, p.job_type);
        
        // ตรวจสอบ status_id จากฐานข้อมูล
        if (p.status_id === 9) {
          status = 'ยกเลิกการผลิต';
          status_name = 'ยกเลิกการผลิต';
        } else if (logsStatus) {
          status = logsStatus.message;
          status_name = logsStatus.message;
        }
        
        // Parse operators (Backend ส่งมาเป็น string แล้ว)
        // ✅ ใช้ operators_from_join ก่อน (ข้อมูลจาก Backend JOIN) ถ้าไม่มีค่อยใช้ operators
        let operatorNames = (p.operators_from_join || p.operators || '').trim();
        
        return {
          ...p,
          isDraft: isDraft,
          status: status,
          status_name: status_name,
          recordStatus: recordStatus,
          isPrinted: isPrintedFlag,
          operators: operatorNames,
          // ✅ เก็บ operators_from_join ไว้ด้วย (สำหรับ renderStaffAvatars)
          operators_from_join: p.operators_from_join || operatorNames,
          production_room: p.production_room_name || 'ไม่ระบุ',
          machine_id: p.machine_id || '',
          notes: p.notes || '',
          // รักษา backward compatibility
          is_special: p.job_type === 'special' ? 1 : 0,
          workflow_status_id:
            p.workflow_status === 'draft'
              ? 1
              : p.workflow_status === 'completed'
                ? 2
                : p.workflow_status === 'printed'
                  ? 3
                  : recordStatus === 'แบบร่าง'
                    ? 1
                    : 3,
        };
      });
             // ตั้งค่า state ทันทีหลังจากได้ข้อมูล
             debugLog('📊 [DEBUG] Setting production data:', allData.length, 'items');
             debugLog('📊 [DEBUG] Data sample before set:', allData.slice(0, 3));
             
             // ใช้ functional update เพื่อให้แน่ใจว่า state update ถูกต้อง
             setProductionData(() => {
               debugLog('📊 [DEBUG] Inside setProductionData callback, setting', allData.length, 'items');
               return allData;
             });
             
             // ตรวจสอบว่าข้อมูลถูก set หรือไม่
             setTimeout(() => {
               debugLog('📊 [DEBUG] Verifying data was set correctly');
             }, 100);
             
             debugLog('📊 [DEBUG] Production data set successfully');
             debugLog('📊 [DEBUG] Sample data:', allData.slice(0, 3));
             isCreatingRef.current = false; // reset flag หลังโหลดข้อมูลเสร็จ
     } catch (error) {
       debugError('❌ Error loading production data:', error);
       // ไม่ต้อง reset productionData ในกรณี error เพื่อไม่ให้ข้อมูลหาย
     } finally {
       setIsLoadingData(false);
       debugLog('✅ loadAllProductionData completed');
     }
  };

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successDialogMessage, setSuccessDialogMessage] = useState("");

  // เพิ่มฟังก์ชันเรียงลำดับงานแบบเดียวกับ Draft
  const sortJobsForDisplay = (jobs: any[]) => {
    return sortByStartTimeAndFirstOperator(jobs);
  };

  // ฟังก์ชันสำหรับ Daily View: งานปกติเรียงก่อน งานพิเศษต่อท้าย (ใช้ is_special)
  const getSortedDailyProduction = (jobs: any[]) => {
    return buildDailyProductionDisplayOrder(jobs);
  };
  const { handleQuickAdd, handleReorderSameDay, handleMoveAcrossDays, handleTaskMove, handleTaskReorder } =
    usePlanningBoard({ setProductionData, setSelectedDate, setViewMode });


  // ===== Weekly board interactions =====
  const handleEditClick = (item: any) => {
    try {
      if (isDraftItem(item)) {
        handleEditDraft(item)
      } else {
        debugLog("Open view/edit for non-draft item", item)
      }
    } catch (e) {
      debugError("handleEditClick error", e)
    }
  }

  // Helper functions for WeeklyCalendar
  const convertToProductionTasks = (data: ProductionItem[]): ProductionTask[] => {
    // Hide default A/B/C/D jobs in weekly view
    const defaultCodes = ['A', 'B', 'C', 'D']
    return data
      .filter(item => !defaultCodes.includes((item as any).job_code))
      .map(item => ({
      id: parseInt(item.id) || 0,
      date: formatDateForAPI(item.production_date),
      title: item.job_name,
      room: item.production_room || '',
      staff: getOperatorsString(item.operators),
      time: `${item.start_time || ''} - ${item.end_time || ''}`,
      status: (item as any).status_name || item.status || '',
      recordStatus: getJobStatus(item) as "บันทึกแบบร่าง" | "บันทึกเสร็จสิ้น" | "พิมพ์แล้ว",
      notes: (item as any).note || (item as any).notes || '',
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
  }

  const convertToProductionItem = (task: ProductionTask): ProductionItem => {
    // Find the original item from productionData
    const originalItem = productionData.find(item => item.id === task.id.toString())
    if (!originalItem) {
      throw new Error(`Production item with id ${task.id} not found`)
    }
    
    // Update the original item with new data
    return {
      ...originalItem,
      job_name: task.title,
      production_room: task.room,
      operators: task.staff,
      start_time: task.time.split(' - ')[0],
      end_time: task.time.split(' - ')[1],
      status: task.status as any,
      note: task.notes,
      production_date: task.date
    }
  }

  // ฟังก์ชันเตรียมข้อมูล Time Table
  function getTimeTableData(jobs: any[], users: any[]) {
    // กรองเฉพาะผู้ปฏิบัติงานหลัก
    const mainUsers = users.filter(u => !["RD", "พี่สัญญา"].includes(u.name));
    const timeSlots = generateTimeSlots();
    
    // สลับตำแหน่ง แมน กับ แจ็ค (แมนขึ้นก่อน)
    const sortedUsers = mainUsers.sort((a, b) => {
      if (a.name === "แมน") return -1;
      if (b.name === "แมน") return 1;
      if (a.name === "แจ็ค") return 1;
      if (b.name === "แจ็ค") return -1;
      return a.name.localeCompare(b.name);
    });
    
    // เตรียมข้อมูลแต่ละคน
    const data = sortedUsers.map(user => {
      // หางานที่ user นี้ทำ
      const userJobs = jobs.filter(job => {
        if (!job.operators || !job.start_time || !job.end_time) return false;
        return getOperatorsArray(job.operators).includes(user.name);
      });
      
      // สร้างข้อมูล slot ที่มีการ merge งานต่อเนื่อง
      const slots = timeSlots.map((slot, slotIndex) => {
        // ตรวจสอบว่าเป็นเวลาพักเที่ยงหรือไม่
        if (slot === "12:30-13:15") {
          return {
            hasJob: false,
            jobName: "",
            jobCode: "",
            isStart: false,
            isEnd: false,
            colspan: 1,
            isLunchBreak: true
          };
        }
        
        // หางานที่ตรงกับ slot นี้
        const jobInfo = userJobs.find(job => {
          return slot >= job.start_time && slot < job.end_time;
        });
        
        if (!jobInfo) {
          return {
            hasJob: false,
            jobName: "",
            jobCode: "",
            isStart: false,
            isEnd: false,
            colspan: 1,
            isLunchBreak: false
          };
        }
        
        // คำนวณ colspan สำหรับงานต่อเนื่อง
        const jobStartSlotIndex = timeSlots.findIndex(s => s >= jobInfo.start_time);
        const jobEndSlotIndex = timeSlots.findIndex(s => s >= jobInfo.end_time);
        const colspan = jobEndSlotIndex > jobStartSlotIndex ? jobEndSlotIndex - jobStartSlotIndex : 1;
        
        // ตรวจสอบว่าเป็น slot แรกของงานนี้หรือไม่
        const isStart = slotIndex === jobStartSlotIndex;
        
        // ตรวจสอบว่าเป็น slot สุดท้ายของงานนี้หรือไม่
        const isEnd = slotIndex === jobStartSlotIndex + colspan - 1;
        
        return {
          hasJob: true,
          jobName: jobInfo.job_name,
          jobCode: jobInfo.job_code,
          isStart,
          isEnd,
          colspan: isStart ? colspan : 1,
          isLunchBreak: false
        };
      });
      
      return { name: user.name, slots };
    });
    return { timeSlots, data };
  }

  // สีสำหรับแต่ละคน
  const workerColors = {
    "ป้าน้อย": "bg-blue-400",
    "พี่ตุ่น": "bg-green-400", 
    "พี่ภา": "bg-yellow-400",
    "สาม": "bg-purple-400",
    "อาร์ม": "bg-pink-400",
    "เอ": "bg-indigo-400",
    "แจ็ค": "bg-orange-400",
    "แมน": "bg-red-400",
    "โอเล่": "bg-teal-400"
  };

  // คอมโพเนนต์ TimeTable
  function TimeTable({ jobs, users }: { jobs: any[], users: any[] }) {
    const { timeSlots, data } = getTimeTableData(jobs, users);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border text-sm shadow-lg">
          <thead>
            <tr>
              <th className="p-2 border bg-gray-100 text-left font-semibold text-sm whitespace-nowrap">ชื่อ</th>
              {timeSlots.map((slot, idx) => (
                <th 
                  key={slot} 
                  className={`p-2 border text-center font-bold text-base min-w-[120px] whitespace-nowrap ${
                    slot === "12:30-13:15" 
                      ? "bg-orange-200 text-orange-800" 
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {slot === "12:30-13:15" ? "พักเที่ยง" : slot}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.name}>
                <td className="p-2 border bg-white whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getStaffImage(row.name) ? (
                      <img src={getStaffImage(row.name)} alt={row.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-green-600 text-white text-[14px] font-semibold flex items-center justify-center">
                        {getStaffInitial(row.name)}
                      </div>
                    )}
                    <span className="font-semibold text-sm">{row.name}</span>
                  </div>
                </td>
                {row.slots.map((slot, i) => {
                  // ข้าม slot ที่ไม่ใช่จุดเริ่มต้นของงาน
                  if (slot.hasJob && !slot.isStart) {
                    return null;
                  }
                  
                  return (
                    <td 
                      key={i} 
                      colSpan={slot.hasJob ? slot.colspan : 1}
                      className={`border p-3 relative min-h-[50px] ${
                        slot.isLunchBreak 
                          ? "bg-gray-200 text-gray-600" 
                          : slot.hasJob 
                            ? workerColors[row.name as keyof typeof workerColors] || "bg-green-400" 
                            : "bg-white"
                      }`}
                    >
                      {slot.isLunchBreak && (
                        <div className="flex items-center justify-center text-base font-bold min-h-[50px]">
                          <span className="text-center leading-tight">
                            พักเที่ยง
                          </span>
                        </div>
                      )}
                      {slot.hasJob && (
                        <div className="flex items-center justify-center text-white text-sm font-medium min-h-[50px] overflow-hidden">
                          <span className="text-center leading-tight" title={slot.jobName}>
                            {slot.jobName}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Debug Modal state
  useEffect(() => {
    debugLog('🔍 Modal state changed:', { editDraftModalOpen, editDraftData: !!editDraftData });
  }, [editDraftModalOpen, editDraftData]);

  // ฟังก์ชันโหลดการตั้งค่า
  const loadSettings = async () => {
    try {
      const data = await planningApi.getSettings();
      if (data.success && data.data) {
        setSyncModeEnabled(data.data.syncModeEnabled || false);
      }
    } catch (error) {
      debugError('Error loading settings:', error);
    }
  };

  // โหลดการตั้งค่าเมื่อ component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // ฟังก์ชันจัดการสถานะงาน
  const getJobStatus = (item: any) => {
    // ใช้ workflow_status จาก Backend
    if (item.workflow_status === 'draft') {
      return "แบบร่าง";
    }
    
    if (item.workflow_status === 'completed') {
      return "บันทึกเสร็จสิ้น";
    }
    
    if (item.workflow_status === 'printed') {
      return "พิมพ์แล้ว";
    }
    
    // Backward compatibility: ตรวจสอบ workflow_status_id เดิม
    if (item.workflow_status_id === 1 || item.workflow_status_id === "1") {
      return "แบบร่าง";
    }
    
    if (item.workflow_status_id === 2 || item.workflow_status_id === "2") {
      return "บันทึกเสร็จสิ้น";
    }
    
    // ตรวจสอบ recordStatus เดิม
    if (item.recordStatus === "พิมพ์แล้ว" || item.recordStatus === "บันทึกสำเร็จ") {
      return "พิมพ์แล้ว";
    }
    
    // งานที่มี status_id = 3 หรือ recordStatus เป็น "กำลังดำเนินการ"
    if ((item.status_id === 3 || item.status_id === "3") || 
        (item.recordStatus === "กำลังดำเนินการ" || item.recordStatus === "ดำเนินการ")) {
      return "กำลังดำเนินการ";
    }
    
    // งานปกติที่มีใน Table work_plans (ไม่ใช่ draft) และไม่มี workflow_status_id = 2 ควรเป็น "พิมพ์แล้ว"
    if (!item.isDraft && item.workflow_status_id && item.workflow_status_id !== 2) {
      return "พิมพ์แล้ว";
    }
    
    return item.recordStatus;
  };

  // ฟังก์ชันตรวจสอบว่าควรแสดง label "งานพิเศษ" หรือไม่
  const shouldShowSpecialJobLabel = (item: any) => {
    // แสดง label "งานพิเศษ" เมื่อ job_type เป็น 'special'
    if (item.job_type === 'special') {
      return true;
    }
    
    // Backward compatibility: ตรวจสอบ status_id = 10 หรือ is_special = 1
    return (item.status_id === 10 || item.status_id === "10" || item.is_special === 1);
  };

  return (
    <div className={`min-h-screen bg-gray-200 ${notoSansThai.className} flex flex-col`}>
      {/* แก้ไข hydration error - แสดง loading ถ้ายัง render ใน client ไม่เสร็จ */}
      {!isClient ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">กำลังโหลดระบบ...</p>
          </div>
        </div>
      ) : (
        <>
          <PlanningHeader userName={userName} onOpenTimeTable={() => setShowTimeTable(true)} />

      {/* Main Content */}
      <div className="flex-1 w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-8 pt-17 sm:pt-20 md:pt-24">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                    {/* Left Panel - Schedule Form */}
          <div
            className={`transition-all duration-300 ${isFormCollapsed ? "lg:w-0 lg:overflow-hidden" : "w-full lg:w-2/5"}`}
          >
            <Card className="shadow-lg bg-white h-fit">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2 text-sm sm:text-base md:text-lg">
                    <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    <span className="leading-7 text-2xl">เพิ่มงานที่ต้องการผลิต</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFormCollapsed(!isFormCollapsed)}
                    className="text-white bg-green-600 hover:bg-green-700 border-2 border-green-500 rounded-full w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              </CardHeader>

              {!isFormCollapsed && (
                <CardContent className="space-y-3 sm:space-y-4 md:space-y-6">
                  {/* Date Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700">วันที่ผลิต</Label>
                    <SimpleDatePicker
                      value={selectedDate}
                      onChange={setSelectedDate}
                      placeholder="เลือกวันที่ผลิต"
                      className="w-full"
                    />
                  </div>

                  {/* Autocomplete Job Name/Code */}
                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs sm:text-sm font-bold text-gray-700">เพิ่มงานผลิต</Label>
                      <button
                        type="button"
                        onClick={clearFormFields}
                        disabled={isSubmitting}
                        className="text-sm text-green-600 hover:text-green-700 underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        ล้างข้อมูลทั้งหมด
                      </button>
                    </div>
                    <div className="relative" ref={jobFieldRef}>
                      <JobSearchSelect
                        value={jobQuery}
                        onChange={async (jobCode, jobName) => {
                          debugLog('🎯 JobSearchSelect selected:', { jobCode, jobName });
                          setJobCode(jobCode);
                          setJobName(jobName);
                          setJobQuery(jobName);
                          clearFieldError("jobName");
                          
                          // ถ้าเป็นงานใหม่ ไม่ต้องแสดง popup
                          if (jobCode === 'NEW' || !jobCode) {
                            return;
                          }
                          
                          // ถ้าปิดฟีเจอร์ popup ไว้ ให้ข้ามขั้นตอนนี้ชั่วคราว
                          if (!ENABLE_AUTO_FILL_SELECTION_DIALOG) {
                            return;
                          }

                          // ดึงข้อมูลงานล่าสุดเพื่อตรวจสอบว่ามีข้อมูลหรือไม่
                          const latestData = await fetchLatestWorkPlanData(jobCode, jobName);
                          
                          // ถ้ามีข้อมูลล่าสุด ให้แสดง popup ถามผู้ใช้
                          if (latestData) {
                            setPendingJobData({ jobCode, jobName });
                            setPendingLatestData(latestData);
                            setShowAutoFillDialog(true);
                          }
                        }}
                        onAddNew={(jobName) => {
                          debugLog('➕ Adding new job:', jobName);
                          // สร้าง job_code ใหม่อัตโนมัติ
                          const newJobCode = handleAddNewJob();
                          setJobName(jobName);
                          setJobQuery(jobName);
                          clearFieldError("jobName");
                          setMessage(`✅ เพิ่มงานใหม่: "${jobName}" (รหัสงาน: ${newJobCode})`);
                        }}
                        placeholder="ค้นหางานผลิต..."
                        isDisabled={isSubmitting}
                        isInvalid={flashErrorFields.has("jobName")}
                        allowAddNew={true}
                      />
                    </div>
                    {flashErrorFields.has("jobName") && fieldErrors.jobName && (
                      <p className="text-xs text-red-600">{fieldErrors.jobName}</p>
                    )}
                  </div>

                  {/* Staff Positions */}
                  <div className="space-y-3 sm:space-y-4">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700">ผู้ปฏิบัติงาน (อย่างน้อย 1 คน)</Label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {operators.map((_, index) => {
                        const position = index + 1;
                        // กรองผู้ปฏิบัติงานที่เลือกแล้วในช่องอื่นๆ ออก
                        const selectedOperators = operators.filter((op, idx) => op && op !== "" && idx !== index);
                        const availableUsers = selectableUsers.filter(u => !selectedOperators.includes(u.name));
                        
                        // ตรวจสอบว่าช่องก่อนหน้ายังว่างอยู่หรือไม่ (สำหรับ validation)
                        const isPreviousEmpty = index > 0 && (!operators[index - 1] || operators[index - 1] === "");
                        const isDisabled = isPreviousEmpty;
                        
                        return (
                          <div key={position} className="space-y-1 sm:space-y-2">
                            <Label className={`text-xs text-gray-600 ${isDisabled ? 'text-gray-400' : ''}`}>
                              ผู้ปฏิบัติงาน {position}
                              {isDisabled && <span className="ml-1 text-xs text-gray-400">(ต้องกรอกคนที่ {position - 1} ก่อน)</span>}
                            </Label>
                            <Select
                              value={operators[index] || "__none__"}
                              onValueChange={(val) => {
                                const newOps = [...operators];
                                const newValue = val === "__none__" ? "" : val;
                                newOps[index] = newValue;
                                
                                // ถ้าเคลียร์ช่อง ให้เคลียร์ช่องถัดไปทั้งหมดด้วย
                                if (newValue === "") {
                                  for (let i = index + 1; i < newOps.length; i++) {
                                    newOps[i] = "";
                                  }
                                }
                                
                                setOperators(newOps);
                                if (newOps.some((op) => op && op !== "__none__")) {
                                  clearFieldError("operators");
                                }
                                // เมื่อผู้ใช้แก้ไข ให้ลบ focus
                                setShouldFocusFields(false);
                                setAutoFilledFields(new Set());
                              }}
                              disabled={isDisabled}
                            >
                              <SelectTrigger 
                                ref={getOperatorTriggerRef(index) as any}
                                className={`h-8 sm:h-9 text-sm focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                                  shouldFocusFields && autoFilledFields.has('operators') && operators[index] ? 'ring-2 ring-green-500 ring-offset-2' : ''
                                } ${
                                  !isDisabled && flashErrorFields.has("operators") && index === 0 ? 'border-red-500 focus:ring-red-500' : ''
                                } ${
                                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                disabled={isDisabled}
                              >
                                <SelectValue placeholder={isDisabled ? "กรุณากรอกคนที่ " + (position - 1) + " ก่อน" : "เลือก"} />
                              </SelectTrigger>
                              <SelectContent className={notoSansThai.className}>
                                <SelectItem value="__none__" className={notoSansThai.className}>กรุณาเลือก</SelectItem>
                                {availableUsers.map(u => (
                                  <SelectItem key={u.id_code} value={u.name} className={notoSansThai.className}>{u.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOperators((prev) => [...prev, ""])}
                      className="w-full sm:w-auto"
                      disabled={isSubmitting || !operators[operators.length - 1]?.trim()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      เพิ่มผู้ปฏิบัติงาน
                    </Button>
                    {flashErrorFields.has("operators") && fieldErrors.operators && (
                      <p className="text-xs text-red-600">{fieldErrors.operators}</p>
                    )}
                  </div>

                  {/* Time Slots */}
                  {/* ซ่อนฟิลด์เครื่องบันทึกข้อมูลการผลิต */}
                  {/* <div className="space-y-3 sm:space-y-4">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700">เครื่องบันทึกข้อมูลการผลิต</Label>
                    <Select
                      value={selectedMachine || "__none__"}
                      onValueChange={val => setSelectedMachine(val === "__none__" ? "" : val)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="เลือก..." />
                      </SelectTrigger>
                      <SelectContent className={notoSansThai.className}>
                        <SelectItem value="__none__" className={notoSansThai.className}>กรุณาเลือก</SelectItem>
                        {machines.map(m => (
                          <SelectItem key={m.machine_code} value={m.machine_code} className={notoSansThai.className}>{m.machine_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> */}

                  {/* Time Range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm font-bold text-gray-700">เวลาเริ่ม</Label>
                      <div className="relative">
                        <div className="relative">
                          <Select value={startTime || "__none__"} onValueChange={val => {
                            const newStartTime = val === "__none__" ? "" : val;
                            setStartTime(newStartTime);
                            clearFieldError("startTime");
                            
                            // ถ้าเปลี่ยนเวลาเริ่ม และเวลาสิ้นสุดปัจจุบันน้อยกว่าหรือเท่ากับเวลาเริ่มใหม่ ให้เคลียร์เวลาสิ้นสุด
                            if (newStartTime && endTime && endTime <= newStartTime) {
                              setEndTime("");
                            }
                            if (endTime && newStartTime && isEndTimeAfterStartTime(newStartTime, endTime)) {
                              clearFieldError("endTime");
                            }
                            
                            // เมื่อผู้ใช้แก้ไข ให้ลบ focus
                            setShouldFocusFields(false);
                            setAutoFilledFields(new Set());
                          }}>
                            <SelectTrigger 
                              ref={startTimeRef as any}
                              className={`text-sm pl-8 ${
                                shouldFocusFields && autoFilledFields.has('startTime') && startTime ? 'ring-2 ring-green-500 ring-offset-2' : ''
                              } ${flashErrorFields.has("startTime") ? 'border-red-500 focus:ring-red-500' : ''}`}
                            >
                              <SelectValue placeholder="เลือกเวลาเริ่ม..." />
                            </SelectTrigger>
                            <SelectContent className={notoSansThai.className}>
                              <SelectItem value="__none__" className={notoSansThai.className}>เลือกเวลาเริ่ม...</SelectItem>
                              {timeOptions.map(t => (
                                <SelectItem key={t} value={t} className={notoSansThai.className}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2" />
                        </div>
                      </div>
                      {flashErrorFields.has("startTime") && fieldErrors.startTime && (
                        <p className="text-xs text-red-600">{fieldErrors.startTime}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm font-bold text-gray-700">เวลาสิ้นสุด</Label>
                      <div className="relative">
                        <div className="relative">
                          <Select value={endTime || "__none__"} onValueChange={val => {
                            const nextEndTime = val === "__none__" ? "" : val;
                            setEndTime(nextEndTime);
                            if (!nextEndTime || !startTime || isEndTimeAfterStartTime(startTime, nextEndTime)) {
                              clearFieldError("endTime");
                            }
                            // เมื่อผู้ใช้แก้ไข ให้ลบ focus
                            setShouldFocusFields(false);
                            setAutoFilledFields(new Set());
                          }}>
                            <SelectTrigger 
                              ref={endTimeRef as any}
                              className={`text-sm pl-8 ${
                                shouldFocusFields && autoFilledFields.has('endTime') && endTime ? 'ring-2 ring-green-500 ring-offset-2' : ''
                              } ${flashErrorFields.has("endTime") ? 'border-red-500 focus:ring-red-500' : ''}`}
                            >
                              <SelectValue placeholder="เลือกเวลาสิ้นสุด..." />
                            </SelectTrigger>
                            <SelectContent className={notoSansThai.className}>
                              <SelectItem value="__none__" className={notoSansThai.className}>เลือกเวลาสิ้นสุด...</SelectItem>
                              {timeOptions
                                .filter(t => {
                                  // ถ้ามีเวลาเริ่ม ให้แสดงเฉพาะเวลาที่มากกว่าเวลาเริ่ม
                                  if (startTime && t <= startTime) {
                                    return false;
                                  }
                                  return true;
                                })
                                .map(t => (
                                  <SelectItem key={t} value={t} className={notoSansThai.className}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2" />
                        </div>
                      </div>
                      {flashErrorFields.has("endTime") && fieldErrors.endTime && (
                        <p className="text-xs text-red-600">{fieldErrors.endTime}</p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700">หมายเหตุ</Label>
                    <RichNoteEditor
                      value={note}
                      onChange={(v: string) => setNote(v)}
                      className="text-sm"
                      placeholder="เพิ่มหมายเหตุเพิ่มเติมสำหรับการผลิต..."
                    />
                  </div>

                  {/* ห้องผลิต (dropdown จริง ใต้เวลาเริ่ม-สิ้นสุด) */}
                  <div className="space-y-2 mt-2">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700">ห้องผลิต</Label>
                    <Select
                      value={selectedRoom || "__none__"}
                      onValueChange={val => {
                        const nextRoom = val === "__none__" ? "" : val;
                        setSelectedRoom(nextRoom);
                        if (nextRoom) {
                          clearFieldError("room");
                        }
                        // เมื่อผู้ใช้แก้ไข ให้ลบ focus
                        setShouldFocusFields(false);
                        setAutoFilledFields(new Set());
                      }}
                    >
                      <SelectTrigger 
                        ref={roomRef as any}
                        className={`text-sm ${
                          shouldFocusFields && autoFilledFields.has('room') && selectedRoom ? 'ring-2 ring-green-500 ring-offset-2' : ''
                        } ${flashErrorFields.has("room") ? 'border-red-500 focus:ring-red-500' : ''}`}
                      >
                        <SelectValue placeholder="เลือกห้องผลิต..." />
                      </SelectTrigger>
                      <SelectContent className={notoSansThai.className}>
                        <SelectItem value="__none__" className={notoSansThai.className}>กรุณาเลือก</SelectItem>
                        {rooms.map(r => (
                          <SelectItem key={r.room_code} value={r.room_code} className={notoSansThai.className}>{r.room_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {flashErrorFields.has("room") && fieldErrors.room && (
                      <p className="text-xs text-red-600">{fieldErrors.room}</p>
                    )}
                  </div>

                  {/* Submit Buttons */}
                  <div className="pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Button
                        variant="outline"
                        className="flex-1 border-2 border-gray-400 text-gray-700 hover:bg-gray-100 bg-white text-sm font-medium py-2 px-4"
                        onClick={() => {
                          debugLog('🔧 Button clicked!');
                          handleSaveDraft();
                        }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "กำลังบันทึก..." : "บันทึกแบบร่าง"}
                      </Button>
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 shadow-md"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "กำลังบันทึก..." : "บันทึกเสร็จสิ้น"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
            {/* Dashboard Card แยกออกมา */}
            {!isFormCollapsed && (
              <Card className="shadow-lg bg-white mt-8">
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="flex items-center space-x-2 text-sm sm:text-base md:text-lg">
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    <span>Dashboard การลงคนลงเวลา</span>
                  </CardTitle>
                  {true && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const dateStr = formatDateForAPI(selectedDate || new Date() as any);
                        router.push(`/planner/timetable?date=${encodeURIComponent(dateStr)}`)
                      }}
                      className="text-xs px-2 py-1 whitespace-nowrap border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      แสดงตารางเวลาการทำงาน
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(() => {
                      const summary = calculateDailySummary(getSelectedDayProduction(), users);
                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <div className="text-blue-600 font-medium">จำนวนผู้ปฏิบัติงาน</div>
                              <div className="text-2xl font-bold text-blue-700">{summary.totalWorkers} คน</div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <div className="text-green-600 font-medium">ชั่วโมงงาน</div>
                              <div className="text-2xl font-bold text-green-700">{summary.totalWorkHours.toFixed(1)} ชม.</div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                              <div className="text-orange-600 font-medium">เวลาที่ใช้ลงงาน</div>
                              <div className="text-2xl font-bold text-orange-700">{summary.totalUsedTime.toFixed(1)} ชม.</div>
                              <div className="text-xs text-orange-600 mt-1">(หักพักเที่ยง 45 นาที)</div>
                            </div>
                            <div className={`p-3 rounded-lg border ${
                              summary.capacityPercentage > 100 
                                ? 'bg-red-50 border-red-200' 
                                : summary.capacityPercentage >= 80 
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-yellow-50 border-yellow-200'
                            }`}>
                              <div className={`font-medium ${
                                summary.capacityPercentage > 100 
                                  ? 'text-red-600' 
                                  : summary.capacityPercentage >= 80 
                                    ? 'text-green-600'
                                    : 'text-yellow-600'
                              }`}>Capacity</div>
                              <div className={`text-2xl font-bold ${
                                summary.capacityPercentage > 100 
                                  ? 'text-red-700' 
                                  : summary.capacityPercentage >= 80 
                                    ? 'text-green-700'
                                    : 'text-yellow-700'
                              }`}>
                                {summary.capacityPercentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          
                          {/* รายชื่อผู้ปฏิบัติงาน */}
                          <div className="bg-gray-50 p-3 rounded-lg border">
                            <div className="text-gray-600 font-bold text-base mb-2">รายชื่อผู้ปฏิบัติงาน ({summary.totalWorkers} คน)</div>
                            <div className="text-sm text-gray-700">
                              {summary.uniqueWorkers.join(', ')}
                            </div>
                          </div>

                          {/* คนที่ยังรับงานได้ - แสดงเฉพาะเมื่อมีคนว่าง */}
                          {summary.availableWorkers.length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <div className="text-blue-600 font-medium mb-2">ผู้ปฏิบัติงานหลักที่ว่าง ({summary.availableWorkers.length} คน)</div>
                              <div className="text-sm text-blue-700">
                                {summary.availableWorkers.join(', ')}
                              </div>
                            </div>
                          )}

                          {/* รายละเอียดของแต่ละคน */}
                          <div 
                            className="bg-gray-50 p-3 rounded-lg border cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setShowWorkerDetails(!showWorkerDetails)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-gray-600 font-medium">รายละเอียดการทำงานของแต่ละคน</div>
                              {/* ลบปุ่มแสดงตารางเวลาการทำงานออก เหลือแค่ปุ่ม toggle รายละเอียด */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // ป้องกันการ trigger onClick ของ parent
                                  setShowWorkerDetails(!showWorkerDetails);
                                }}
                                className="p-1 h-6 w-6"
                              >
                                {showWorkerDetails ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            {showWorkerDetails && (
                              <div className="space-y-2">
                                {/* แสดงคนที่ยังรับงานได้ก่อน */}
                                {summary.workerDetails.filter(worker => worker.status === 'available').length > 0 && (
                                  <div className="text-xs font-semibold text-green-700 mb-2">🟢 คนที่ยังรับงานได้</div>
                                )}
                                {summary.workerDetails
                                  .filter(worker => worker.status === 'available')
                                  .map((worker, index) => (
                                <div key={index} className={`p-3 rounded border text-xs ${
                                  worker.status === 'full' 
                                    ? 'bg-red-50 border-red-200'
                                    : worker.status === 'limited'
                                      ? 'bg-yellow-50 border-yellow-200'
                                      : 'bg-green-50 border-green-200'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <Avatar className="w-8 h-8">
                                        <AvatarImage
                                          src={getStaffImage(worker.name)}
                                          alt={worker.name}
                                          className="object-cover object-center"
                                        />
                                        <AvatarFallback className="text-[17px] font-medium bg-green-600 text-white">
                                          {getStaffInitial(worker.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium text-sm">{worker.name}</span>
                                    </div>
                                    <span className={`font-bold text-sm ${
                                      worker.status === 'full' 
                                        ? 'text-red-600'
                                        : worker.status === 'limited'
                                          ? 'text-yellow-600'
                                          : 'text-green-600'
                                    }`}>
                                      {worker.displayText}
                                    </span>
                                  </div>
                                </div>
                                ))}
                                
                                {/* แสดงคนที่ใกล้เต็มเวลา */}
                                {summary.workerDetails.filter(worker => worker.status === 'limited').length > 0 && (
                                  <div className="text-xs font-semibold text-yellow-700 mb-2 mt-4">🟡 คนที่ใกล้เต็มเวลา</div>
                                )}
                                {summary.workerDetails
                                  .filter(worker => worker.status === 'limited')
                                  .map((worker, index) => (
                                  <div key={`limited-${index}`} className={`p-3 rounded border text-xs ${
                                    worker.status === 'full' 
                                      ? 'bg-red-50 border-red-200'
                                      : worker.status === 'limited'
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : 'bg-green-50 border-green-200'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <Avatar className="w-8 h-8">
                                          <AvatarImage
                                            src={getStaffImage(worker.name)}
                                            alt={worker.name}
                                            className="object-cover object-center"
                                          />
                                          <AvatarFallback className="text-[17px] font-medium bg-green-600 text-white">
                                            {getStaffInitial(worker.name)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{worker.name}</span>
                                      </div>
                                      <span className={`font-bold text-sm ${
                                        worker.status === 'full' 
                                          ? 'text-red-600'
                                          : worker.status === 'limited'
                                            ? 'text-yellow-600'
                                            : 'text-green-600'
                                      }`}>
                                        {worker.displayText}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* แสดงคนที่เต็มเวลา */}
                                {summary.workerDetails.filter(worker => worker.status === 'full').length > 0 && (
                                  <div className="text-xs font-semibold text-red-700 mb-2 mt-4">🔴 คนที่เต็มเวลา</div>
                                )}
                                {summary.workerDetails
                                  .filter(worker => worker.status === 'full')
                                  .map((worker, index) => (
                                  <div key={`full-${index}`} className={`p-3 rounded border text-xs ${
                                    worker.status === 'full' 
                                      ? 'bg-red-50 border-red-200'
                                      : worker.status === 'limited'
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : 'bg-green-50 border-green-200'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <Avatar className="w-8 h-8">
                                          <AvatarImage
                                            src={getStaffImage(worker.name)}
                                            alt={worker.name}
                                            className="object-cover object-center"
                                          />
                                          <AvatarFallback className="text-[17px] font-medium bg-green-600 text-white">
                                            {getStaffInitial(worker.name)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{worker.name}</span>
                                      </div>
                                      <span className={`font-bold text-sm ${
                                        worker.status === 'full' 
                                          ? 'text-red-600'
                                          : worker.status === 'limited'
                                            ? 'text-yellow-600'
                                            : 'text-green-600'
                                      }`}>
                                        {worker.displayText}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Status Indicator */}
                          <div className="bg-gray-50 p-3 rounded-lg border">
                            <div className="text-gray-600 font-medium mb-2">สถานะการลงคนลงเวลา</div>
                            <div className={`text-sm font-medium p-2 rounded ${
                              summary.capacityPercentage > 100 
                                ? 'text-red-700 bg-red-100 border border-red-200' 
                                : summary.capacityPercentage >= 80 
                                  ? 'text-green-700 bg-green-100 border border-green-200'
                                  : 'text-yellow-700 bg-yellow-100 border border-yellow-200'
                            }`}>
                              {summary.capacityPercentage > 100 
                                ? '⚠️ เกินความสามารถ (เกิน 100%) - ควรเพิ่มคนหรือลดงาน' 
                                : summary.capacityPercentage >= 80 
                                  ? '✅ การลงคนลงเวลาสมบูรณ์ (80-100%) - ใช้งานเต็มที่'
                                  : '⚡ การลงคนลงเวลาต่ำ (ต่ำกว่า 80%) - ควรเพิ่มงานหรือลดคน'
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </CardContent>
              </Card>
            )}
          </div>



          {/* Mobile Toggle Button */}
          {isFormCollapsed && (
            <div className="lg:hidden fixed bottom-4 right-4 z-40">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setIsFormCollapsed(false)}
                className="text-white bg-green-800 hover:bg-green-900 border-2 border-green-600 rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Desktop Toggle Button - Tab Style */}
          {isFormCollapsed && (
            <div className="hidden lg:block fixed left-0 top-32 z-40 group">
              <div className="bg-white rounded-r-lg shadow-lg border-r-2 border-green-200 hover:w-64 transition-all duration-300 w-10 h-20 flex items-center justify-center cursor-pointer hover:shadow-xl hover:bg-green-50" onClick={() => setIsFormCollapsed(false)}>
                <div className="flex items-center justify-center w-full h-full group-hover:justify-start group-hover:px-4">
                  <PanelLeftOpen className="w-4 h-4 text-green-600 group-hover:mr-3 group-hover:w-5 group-hover:h-5 transition-all duration-300" />
                  <span className="hidden group-hover:inline text-green-600 font-semibold whitespace-nowrap text-sm animate-fade-in">เพิ่มรายการใหม่</span>
                </div>
              </div>
            </div>
          )}

          {/* Right Panel - Schedule View */}
          <div className={`transition-all duration-300 ${isFormCollapsed ? "w-full lg:ml-0" : "w-full lg:w-3/5"}`}>
            <Card className="shadow-lg bg-white">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <CardTitle
                    className={`flex items-center space-x-2 ${
                      isFormCollapsed ? "text-lg sm:text-xl md:text-2xl" : "text-sm sm:text-base md:text-lg"
                    }`}
                  >
                    <Calendar
                      className={`${isFormCollapsed ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4 sm:w-5 sm:h-5"} text-green-600`}
                    />
                    <span className="text-2xl">รายการแผนผลิต</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {viewMode === "daily" && (
                                          <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncDrafts}
                      disabled={isSubmitting}
                      className="bg-white border-green-600 text-green-700 hover:bg-green-50 flex items-center space-x-1 sm:space-x-2"
                    >
                      <RefreshCw className={`${isFormCollapsed ? "w-3 h-3 sm:w-4 sm:h-4" : "w-3 h-3"}`} />
                      <span className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"}`}>พิมพ์ใบงานผลิต</span>
                    </Button>
                    )}
                    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                      <Button
                        variant={viewMode === "daily" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("daily")}
                        className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"} px-2 sm:px-3 py-1 ${
                          viewMode === "daily" ? "bg-green-600 text-white" : "text-gray-600"
                        }`}
                      >
                        รายวัน
                      </Button>
                      <Button
                        variant={viewMode === "weekly" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("weekly")}
                        className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"} px-2 sm:px-3 py-1 ${
                          viewMode === "weekly" ? "bg-green-600 text-white" : "text-gray-600"
                        }`}
                      >
                        รายสัปดาห์
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-8">
                {viewMode === "weekly" ? (
                  <WeeklyCalendar
                    productionData={convertToProductionTasks(productionData)}
                    currentWeek={currentWeek || new Date()}
                    onWeekChange={setCurrentWeek}
                    onTaskMove={handleTaskMove}
                    onTaskReorder={handleTaskReorder}
                    onTaskClick={(task) => handleEditClick(convertToProductionItem(task))}
                    onDateClick={(date) => console.log('Date clicked:', date)}
                    showWeekNavigation={true}
                    showTaskCount={true}
                  />
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {/* Loading Indicator */}
                    {isLoadingData && (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">กำลังโหลดข้อมูล...</p>
                        </div>
                      </div>
                    )}

                    {/* Daily View */}
                    {!isLoadingData && (
                      <>
                    <div
                      className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                        isFormCollapsed ? "text-sm sm:text-base" : "text-xs sm:text-sm"
                      } text-gray-600`}
                    >
                      <span>รายวัน</span>
                      <SimpleDatePicker
                        value={selectedDate}
                        onChange={setSelectedDate}
                        placeholder="เลือกวันที่"
                        className="w-full sm:w-auto"
                      />
                    </div>

                    <Separator />

                    {/* Get production data for selected date */}
                    {(() => {
                      // ใช้ getSelectedDayProduction() แทนการ filter โดยตรง เพื่อให้แสดงเลขงาน A B C D
                      const dailyProduction = getSelectedDayProduction();
                      
                      return dailyProduction.length > 0 ? (
                        <div className="space-y-1 sm:space-y-2">
                          <h4
                            className={`font-medium text-gray-900 ${
                              isFormCollapsed ? "text-sm sm:text-lg md:text-xl" : "text-xs sm:text-sm md:text-base"
                            }`}
                          >
                                                         งานผลิตวันที่ {formatDateForDisplay(new Date(selectedDate), 'full')} จำนวน {dailyProduction.length} งาน
                          </h4>

                          {getSortedDailyProduction(dailyProduction).map((item) => {
                            debugLog('🎯 [DEBUG] Rendering card for item:', {
                              id: item.id,
                              job_name: item.job_name,
                              operators: item.operators,
                              production_room: item.production_room,
                              operators_type: typeof item.operators
                            });
                            const isDraftBlocked =
                              draftHighlightIds.has(String(item.id)) &&
                              item.job_type === 'regular' &&
                              item.workflow_status === 'draft';
                            const isDraftDocumentStatus =
                              getJobStatus(item) === "แบบร่าง" ||
                              getJobStatus(item) === "บันทึกแบบร่าง";
                            return (
                            <div
                              key={item.id}
                              id={`work-plan-card-${item.id}`}
                              className={`border-l-4 ${
                                item.status === "งานผลิตถูกยกเลิก" || item.status_name === "ยกเลิกการผลิต"
                                  ? "border-l-red-400 bg-red-50"
                                  : item.status_name === "งานผลิตเสร็จสิ้น" || item.status_name === "เสร็จสิ้น"
                                      ? "border-l-green-400 bg-green-50"
                                      : (item.status_name && (item.status_name.includes("รอดำเนินการ") || item.status_name.toLowerCase().includes("pending")))
                                      ? "border-l-gray-400 bg-gray-50"
                                          : "border-l-gray-400 bg-gray-50"
                              } ${isDraftBlocked ? "ring-2 ring-red-500 ring-offset-2 border border-red-300 shadow-md" : ""} ${isFormCollapsed ? "p-3 sm:p-4 md:p-6" : "p-2 sm:p-3 md:p-4"} rounded-r-lg transition-all duration-300`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                                <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <Badge
                                      variant="outline"
                                      className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"} bg-blue-50 border-blue-300 text-blue-700 font-medium flex-shrink-0`}
                                    >
                                      {formatDateThaiShort(item.production_date)}
                                    </Badge>
                                    <h3
                                      className={`font-bold text-gray-900 ${
                                        isFormCollapsed
                                          ? "text-sm sm:text-lg md:text-xl"
                                          : "text-xs sm:text-sm md:text-base"
                                      } truncate`}
                                    >
                                      {getDisplayJobName(item, dailyProduction)}: {item.job_name}
                                    </h3>
                                    <Badge
                                      variant="outline"
                                      className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"} flex-shrink-0`}
                                    >
                                      ห้องผลิต: {getRoomName(item.production_room)}
                                    </Badge>
                                    <div className="flex items-center space-x-2">
                                      <Badge
                                        variant="outline"
                                        className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"} ${
                                          item.status_name === "งานผลิตถูกยกเลิก" || item.status_name === "ยกเลิกการผลิต"
                                                ? "border-red-500 text-red-700"
                                            : (item.status_name && (item.status_name.includes("รอดำเนินการ") || item.status_name.toLowerCase().includes("pending")))
                                              ? "border-gray-500 text-gray-700"
                                              : item.status_name === "งานผลิตเสร็จสิ้น" || item.status_name === "เสร็จสิ้น"
                                                ? "border-green-500 text-green-700"
                                                : "border-gray-500 text-gray-700"
                                        } flex-shrink-0`}
                                      >
                                        {item.status_name}
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className={`${isFormCollapsed ? "text-xs sm:text-sm" : "text-xs"} ${
                                          isDraftBlocked && isDraftDocumentStatus
                                            ? "border-red-500 text-red-800 bg-red-100 font-semibold"
                                            : getJobStatus(item) === "พิมพ์แล้ว"
                                            ? "border-green-500 text-green-700 bg-green-50"
                                            : getJobStatus(item) === "บันทึกเสร็จสิ้น" || getJobStatus(item) === "บันทึกสำเร็จ"
                                              ? "border-green-500 text-green-700 bg-green-50"
                                              : "border-gray-500 text-gray-700 bg-gray-50"
                                        } flex-shrink-0`}
                                      >
                                        {getJobStatus(item)}
                                      </Badge>
                                      {/* แสดง label "งานพิเศษ" เมื่อเปิดโหมดงานพิเศษ */}
                                      {shouldShowSpecialJobLabel(item) && (
                                        <Badge
                                          variant="secondary"
                                          className="bg-yellow-100 text-yellow-800 border-yellow-300 flex-shrink-0"
                                        >
                                          งานพิเศษ
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Staff and Planner Section - ในแถวเดียวกัน */}
                                  <div className="flex items-center justify-between">
                                    {/* Staff Section - ด้านซ้าย */}
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                    {renderStaffAvatars(item.operators || (item as any).operators_from_join, item, isFormCollapsed)}
                                  </div>

                                    {/* ผู้วางแผนการผลิต - ด้านขวาสุด */}
                                    <div className="flex items-center space-x-2">
                                      <div className="flex -space-x-2">
                                        {/* แสดงผู้ตรวจสอบ: จิ๋ว สำหรับแบบร่าง, จิ๋ว+จรัญ สำหรับเสร็จสิ้น */}
                                        {(item.recordStatus === "บันทึกแบบร่าง" || item.recordStatus === "แบบร่าง") ? (
                                          <Avatar
                                            className={`${isFormCollapsed ? "w-12 h-12 sm:w-14 sm:h-14" : "w-10 h-10 sm:w-12 sm:h-12"} border-2 border-white shadow-sm`}
                                          >
                                            <AvatarImage
                                              src="/images/staff/จิ๋ว.jpg"
                                              alt="จิ๋ว"
                                              className="object-cover object-center avatar-image"
                                              style={{ imageRendering: "crisp-edges" }}
                                            />
                                            <AvatarFallback className="text-xs font-medium bg-green-100 text-green-800">
                                              จิ
                                            </AvatarFallback>
                                          </Avatar>
                                        ) : (
                                          <>
                                            <Avatar
                                              className={`${isFormCollapsed ? "w-12 h-12 sm:w-14 sm:h-14" : "w-10 h-10 sm:w-12 sm:h-12"} border-2 border-white shadow-sm`}
                                            >
                                              <AvatarImage
                                                src="/images/staff/จิ๋ว.jpg"
                                                alt="จิ๋ว"
                                                className="object-cover object-center avatar-image"
                                                style={{ imageRendering: "crisp-edges" }}
                                              />
                                              <AvatarFallback className="text-xs font-medium bg-green-100 text-green-800">
                                                จิ
                                              </AvatarFallback>
                                            </Avatar>
                                            <Avatar
                                              className={`${isFormCollapsed ? "w-12 h-12 sm:w-14 sm:h-14" : "w-10 h-10 sm:w-12 sm:h-12"} border-2 border-white shadow-sm`}
                                            >
                                              <AvatarImage
                                                src="/images/staff/จรัญ.jpeg"
                                                alt="จรัญ"
                                                className="object-cover object-center avatar-image"
                                                style={{ imageRendering: "crisp-edges" }}
                                              />
                                              <AvatarFallback className="text-xs font-medium bg-green-100 text-green-800">
                                                จ
                                              </AvatarFallback>
                                            </Avatar>
                                          </>
                                        )}
                                      </div>
                                      <span
                                        className={`${isFormCollapsed ? "text-base sm:text-lg" : "text-sm sm:text-base"} text-slate-900`}
                                      >
                                        ตรวจสอบแผนการผลิต: {(item.recordStatus === "บันทึกแบบร่าง" || item.recordStatus === "แบบร่าง") ? "จิ๋ว ✔" : "จิ๋ว, จรัญ ✔✔"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div
                                      className={`flex items-center space-x-1 sm:space-x-2 ${isFormCollapsed ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}
                                  >
                                    <Clock
                                      className={`${isFormCollapsed ? "w-4 h-4 sm:w-5 sm:h-5" : "w-3 h-3 sm:w-4 sm:h-4"} text-gray-400 flex-shrink-0`}
                                    />
                                      <span className="text-blue-600 font-semibold">
                                        {item.start_time?.substring(0, 5) || "08:00"} - {(item.end_time || "17:00:00").substring(0, 5)}
                                      </span>
                                      {/* หมายเหตุ (ถ้ามี) - อยู่บรรทัดเดียวกับเวลา */}
                                      {item.notes && (
                                        <span
                                          className={`${isFormCollapsed ? "text-sm sm:text-base" : "text-xs sm:text-sm"} text-red-600 font-semibold ml-3 bg-red-50 px-2 py-1 rounded border-l-2 border-red-400`}
                                        >
                                          หมายเหตุ: {item.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                    </div>

                                <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                                  {/* ปุ่ม */}
                                  <div className="flex items-center space-x-1 sm:space-x-2">
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                      {/* เพิ่มปุ่มสำหรับรายการที่มี จิ๋ว เพียงคนเดียวในการตรวจสอบ */}
                                      {(item.recordStatus === "บันทึกแบบร่าง" || item.recordStatus === "แบบร่าง" || item.recordStatus === "รอดำเนินการ") && (
                                        <>
                                    <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditDraft(item)}
                                            className="border-2 border-gray-300 text-gray-600 hover:bg-gray-50 bg-white text-xs font-medium px-2 py-1"
                                          >
                                            <Edit className="w-3 h-3" />
                                    </Button>
                                        </>
                                      )}
                                      {/* เพิ่มปุ่มสำหรับรายการที่มี จิ๋ว, จรัญ ในการตรวจสอบ */}
                                      {(item.recordStatus === "บันทึกเสร็จสิ้น" || item.recordStatus === "เสร็จสิ้น" || item.recordStatus === "บันทึกสำเร็จ" || item.recordStatus === "พิมพ์แล้ว") && (
                                        <>
                                      {/* แสดงปุ่มรูปตาสำหรับงานที่มีสถานะ "กำลังดำเนินการ" */}
                                      {getJobStatus(item) === "กำลังดำเนินการ" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewProductionDetails(item)}
                                            className="border-2 border-blue-300 text-blue-600 hover:bg-blue-50 bg-white text-xs font-medium px-2 py-1"
                                          >
                                            <Eye className="w-3 h-3" />
                                        </Button>
                                      )}
                                      {/* เปลี่ยนปุ่มดินสอเป็นปุ่มกากบาทเมื่อสถานะเป็น "พิมพ์แล้ว" */}
                                      {getJobStatus(item) === "พิมพ์แล้ว" ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCancelProduction(item.id)}
                                            className="border-2 border-red-300 text-red-600 hover:bg-red-50 bg-white text-xs font-medium px-2 py-1"
                                          >
                                            <XCircle className="w-3 h-3" />
                                        </Button>
                                      ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditDraft(item)}
                                            className="border-2 border-gray-300 text-gray-600 hover:bg-gray-50 bg-white text-xs font-medium px-2 py-1"
                                          >
                                            <Edit className="w-3 h-3" />
                                        </Button>
                                      )}
                                        </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 sm:py-8 text-gray-500">
                          <Calendar
                            className={`${isFormCollapsed ? "w-12 h-12 sm:w-16 sm:h-16" : "w-8 h-8 sm:w-12 sm:h-12"} mx-auto mb-3 sm:mb-4 text-gray-300`}
                          />
                          <p className={`${isFormCollapsed ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`}>
                                                         ไม่มีงานผลิตในวันที่ {formatDateForDisplay(new Date(selectedDate), 'full')}
                          </p>
                        </div>
                      );
                    })()}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-green-800 via-green-700 to-green-600 border-t border-green-600 shadow-md mt-6 sm:mt-8">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-center items-center h-10 sm:h-12">
            <p className="text-xs sm:text-sm text-white text-center">
              © 2025 แผนกเทคโนโลยีสารสนเทศ บริษัท จิตต์ธนา จำกัด (สำนักงานใหญ่)
            </p>
          </div>
        </div>
      </footer>

      {/* Modal สำหรับแก้ไข draft */}
      <Dialog open={editDraftModalOpen} onOpenChange={setEditDraftModalOpen}>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${notoSansThai.className}`}>
          <DialogHeader>
            <DialogTitle className={notoSansThai.className}>แก้ไขแบบร่างงานผลิต</DialogTitle>
          </DialogHeader>

      {/* Modal สำหรับแสดงรายละเอียดการผลิต */}
      <Dialog open={productionDetailsModalOpen} onOpenChange={setProductionDetailsModalOpen}>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${notoSansThai.className}`}>
          <DialogHeader>
            <DialogTitle className={notoSansThai.className}>รายละเอียดการผลิต</DialogTitle>
          </DialogHeader>
          {productionDetailsData && (
            <div className="space-y-6">
              {/* ข้อมูลงาน */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>ชื่องาน</Label>
                    <p className={`text-lg font-semibold text-gray-900 ${notoSansThai.className}`}>
                      {productionDetailsData.job_name}
                    </p>
                  </div>
                  <div>
                    <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>หมายเหตุ</Label>
                    <p className={`text-sm text-gray-600 ${notoSansThai.className}`}>
                      {productionDetailsData.notes || productionDetailsData.note || "ไม่มีหมายเหตุ"}
                    </p>
                  </div>
                  <div>
                    <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>ผู้ปฏิบัติงาน</Label>
                    <p className={`text-sm text-gray-600 ${notoSansThai.className}`}>
                      {productionDetailsData.operators || "ไม่ระบุ"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>เวลาเริ่มต้นตามแผนผลิต</Label>
                    <p className={`text-lg font-semibold text-blue-600 ${notoSansThai.className}`}>
                      {productionDetailsData.start_time || "ไม่ระบุ"}
                    </p>
                  </div>
                  <div>
                    <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>เวลาสิ้นสุดตามแผนผลิต</Label>
                    <p className={`text-lg font-semibold text-blue-600 ${notoSansThai.className}`}>
                      {productionDetailsData.end_time || "ไม่ระบุ"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ข้อมูลจาก Logs */}
              <div>
                <Label className={`text-lg font-bold text-gray-700 ${notoSansThai.className}`}>ข้อมูลการผลิตตามจริง</Label>
                {productionLogs.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {productionLogs.map((log, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="mb-3">
                          <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>ขั้นตอนที่ {log.process_number}</Label>
                          <p className={`text-sm text-gray-600 ${notoSansThai.className}`}>
                            {log.process_description || "ไม่ระบุ"}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>เวลาเริ่มต้นตามจริง</Label>
                            <p className={`text-sm text-green-600 ${notoSansThai.className}`}>
                              {formatTime(log.start_time)}
                            </p>
                          </div>
                          <div>
                            <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>เวลาสิ้นสุดตามจริง</Label>
                            <p className={`text-sm text-green-600 ${notoSansThai.className}`}>
                              {formatTime(log.stop_time)}
                            </p>
                          </div>
                          <div>
                            <Label className={`text-sm font-bold text-gray-700 ${notoSansThai.className}`}>เวลาที่ใช้</Label>
                            <p className={`text-sm text-purple-600 ${notoSansThai.className}`}>
                              {formatDuration(log.used_time)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <p className={`text-sm text-gray-500 text-center ${notoSansThai.className}`}>
                      ไม่มีข้อมูลการผลิตตามจริง
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setProductionDetailsModalOpen(false)}
              className={notoSansThai.className}
            >
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-2">
            {/* คอลัมน์ซ้าย */}
            <div className="space-y-3">
              {/* วันที่ผลิต */}
              <div className="space-y-1">
                <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>วันที่ผลิต</Label>
                <SimpleDatePicker
                  value={editDate}
                  onChange={setEditDate}
                  placeholder="เลือกวันที่"
                  className="w-full"
                />
              </div>
              {/* ชื่องาน */}
              <div className="space-y-1">
                <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>ชื่องาน</Label>
                <Input
                  ref={editJobNameRef}
                  value={editJobName}
                  onChange={e => {
                    setEditJobName(e.target.value);
                    if (e.target.value.trim()) {
                      clearEditFieldError("jobName");
                    }
                  }}
                  className={`text-sm h-8 ${notoSansThai.className} ${editFlashErrorFields.has("jobName") ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {editFlashErrorFields.has("jobName") && editFieldErrors.jobName && (
                  <p className={`text-xs text-red-600 ${notoSansThai.className}`}>{editFieldErrors.jobName}</p>
                )}
              </div>
              {/* เครื่องบันทึกข้อมูลการผลิต */}
              <div className="space-y-1">
                <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>เครื่องบันทึกข้อมูลการผลิต</Label>
                <Select
                  value={editMachine || "__none__"}
                  onValueChange={val => setEditMachine(val === "__none__" ? "" : val)}
                >
                  <SelectTrigger className={`text-sm h-8 ${notoSansThai.className}`}>
                    <SelectValue placeholder="เลือก..." />
                  </SelectTrigger>
                  <SelectContent className={notoSansThai.className}>
                    <SelectItem value="__none__" className={notoSansThai.className}>กรุณาเลือก</SelectItem>
                    {machines.map(m => (
                      <SelectItem key={m.machine_code} value={m.machine_code} className={notoSansThai.className}>{m.machine_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* ห้องผลิต */}
              <div className="space-y-1">
                <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>ห้องผลิต</Label>
                <Select
                  value={editRoom || "__none__"}
                  onValueChange={val => {
                    const nextRoom = val === "__none__" ? "" : val;
                    setEditRoom(nextRoom);
                    if (nextRoom) {
                      clearEditFieldError("room");
                    }
                  }}
                >
                  <SelectTrigger
                    ref={editRoomRef as any}
                    className={`text-sm h-8 ${notoSansThai.className} ${editFlashErrorFields.has("room") ? "border-red-500 focus:ring-red-500" : ""}`}
                  >
                    <SelectValue placeholder="เลือกห้องผลิต..." />
                  </SelectTrigger>
                  <SelectContent className={notoSansThai.className}>
                    <SelectItem value="__none__" className={notoSansThai.className}>กรุณาเลือก</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.room_code} value={r.room_code} className={notoSansThai.className}>{r.room_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editFlashErrorFields.has("room") && editFieldErrors.room && (
                  <p className={`text-xs text-red-600 ${notoSansThai.className}`}>{editFieldErrors.room}</p>
                )}
              </div>
            </div>

            {/* คอลัมน์ขวา */}
            <div className="space-y-3">
              {/* ผู้ปฏิบัติงาน */}
              <div className="space-y-1">
                <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>ผู้ปฏิบัติงาน (อย่างน้อย 1 คน)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {editOperators.map((_, index) => {
                    const position = index + 1;
                    // ตรวจสอบว่าช่องก่อนหน้ายังว่างอยู่หรือไม่ (สำหรับ validation)
                    const isPreviousEmpty = index > 0 && (!editOperators[index - 1] || editOperators[index - 1] === "");
                    const isDisabled = isPreviousEmpty;
                    
                    return (
                      <div key={position} className="space-y-1">
                        <Label className={`text-xs text-gray-600 ${notoSansThai.className} ${isDisabled ? 'text-gray-400' : ''}`}>
                          ผู้ปฏิบัติงาน {position}
                          {isDisabled && <span className="ml-1 text-xs text-gray-400">(ต้องกรอกคนที่ {position - 1} ก่อน)</span>}
                        </Label>
                        <Select
                          value={editOperators[index] || "__none__"}
                          onValueChange={val => {
                            const newOps = [...editOperators];
                            const newValue = val === "__none__" ? "" : val;
                            newOps[index] = newValue;
                            
                            // ถ้าเคลียร์ช่อง ให้เคลียร์ช่องถัดไปทั้งหมดด้วย
                            if (newValue === "") {
                              for (let i = index + 1; i < newOps.length; i++) {
                                newOps[i] = "";
                              }
                            }
                            
                            setEditOperators(newOps);
                            if (newOps.some((op) => op && op !== "__none__")) {
                              clearEditFieldError("operators");
                            }
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger
                            ref={index === 0 ? (editFirstOperatorRef as any) : undefined}
                            className={`h-8 text-xs ${notoSansThai.className} ${
                              editFlashErrorFields.has("operators") && index === 0 && !isDisabled ? "border-red-500 focus:ring-red-500" : ""
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isDisabled}
                          >
                            <SelectValue placeholder={isDisabled ? "กรุณากรอกคนที่ " + (position - 1) + " ก่อน" : "เลือก"} />
                          </SelectTrigger>
                          <SelectContent className={notoSansThai.className}>
                            <SelectItem value="__none__" className={notoSansThai.className}>กรุณาเลือก</SelectItem>
                            {selectableUsers.length > 0 ? (
                              selectableUsers.map(u => (
                                <SelectItem key={u.id_code} value={u.name} className={notoSansThai.className}>{u.name}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__none__" className={notoSansThai.className}>ไม่พบข้อมูลผู้ปฏิบัติงาน</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOperators((prev) => [...prev, ""])}
                  className={`w-full mt-2 text-xs h-8 ${notoSansThai.className}`}
                  disabled={isSubmitting || !editOperators[editOperators.length - 1]?.trim()}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  เพิ่มผู้ปฏิบัติงาน
                </Button>
                {editFlashErrorFields.has("operators") && editFieldErrors.operators && (
                  <p className={`text-xs text-red-600 ${notoSansThai.className}`}>{editFieldErrors.operators}</p>
                )}
              </div>
              {/* เวลาเริ่ม-สิ้นสุด */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>เวลาเริ่ม</Label>
                  <Select value={editStartTime || "__none__"} onValueChange={val => {
                    const nextStartTime = val === "__none__" ? "" : val;
                    setEditStartTime(nextStartTime);
                    clearEditFieldError("startTime");
                    // ถ้าเวลาเริ่มใหม่มากกว่าหรือเท่ากับเวลาสิ้นสุดเดิม ให้บังคับเลือกเวลาสิ้นสุดใหม่
                    if (nextStartTime && editEndTime && editEndTime <= nextStartTime) {
                      setEditEndTime("");
                    }
                    if (editEndTime && nextStartTime && isEndTimeAfterStartTime(nextStartTime, editEndTime)) {
                      clearEditFieldError("endTime");
                    }
                  }}>
                    <SelectTrigger
                      ref={editStartTimeRef as any}
                      className={`text-sm h-8 ${notoSansThai.className} ${editFlashErrorFields.has("startTime") ? "border-red-500 focus:ring-red-500" : ""}`}
                    >
                      <SelectValue placeholder="เลือกเวลาเริ่ม..." />
                    </SelectTrigger>
                    <SelectContent className={notoSansThai.className}>
                      <SelectItem value="__none__" className={notoSansThai.className}>เลือกเวลาเริ่ม...</SelectItem>
                      {timeOptions && timeOptions.length > 0 ? (
                        timeOptions.map(t => (
                          <SelectItem key={t} value={t} className={notoSansThai.className}>{t}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none__" className={notoSansThai.className}>ไม่พบตัวเลือกเวลา</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {editFlashErrorFields.has("startTime") && editFieldErrors.startTime && (
                    <p className={`text-xs text-red-600 ${notoSansThai.className}`}>{editFieldErrors.startTime}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>เวลาสิ้นสุด</Label>
                  <Select value={editEndTime || "__none__"} onValueChange={val => {
                    const nextEndTime = val === "__none__" ? "" : val;
                    setEditEndTime(nextEndTime);
                    if (!nextEndTime || !editStartTime || isEndTimeAfterStartTime(editStartTime, nextEndTime)) {
                      clearEditFieldError("endTime");
                    }
                  }}>
                    <SelectTrigger
                      ref={editEndTimeRef as any}
                      className={`text-sm h-8 ${notoSansThai.className} ${editFlashErrorFields.has("endTime") ? "border-red-500 focus:ring-red-500" : ""}`}
                    >
                      <SelectValue placeholder="เลือกเวลาสิ้นสุด..." />
                    </SelectTrigger>
                    <SelectContent className={notoSansThai.className}>
                      <SelectItem value="__none__" className={notoSansThai.className}>เลือกเวลาสิ้นสุด...</SelectItem>
                      {timeOptions && timeOptions.length > 0 ? (
                        timeOptions
                          .filter(t => {
                            // ถ้ามีเวลาเริ่ม ให้แสดงเฉพาะเวลาที่มากกว่าเวลาเริ่ม
                            if (editStartTime && t <= editStartTime) {
                              return false;
                            }
                            return true;
                          })
                          .map(t => (
                          <SelectItem key={t} value={t} className={notoSansThai.className}>{t}</SelectItem>
                          ))
                      ) : (
                        <SelectItem value="__none__" className={notoSansThai.className}>ไม่พบตัวเลือกเวลา</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {editFlashErrorFields.has("endTime") && editFieldErrors.endTime && (
                    <p className={`text-xs text-red-600 ${notoSansThai.className}`}>{editFieldErrors.endTime}</p>
                  )}
                </div>
              </div>
              {/* หมายเหตุ */}
              <div className="space-y-1">
                <Label className={`text-xs font-bold text-gray-700 ${notoSansThai.className}`}>หมายเหตุ</Label>
                <RichNoteEditor
                  value={editNote}
                  onChange={(v: string) => setEditNote(v)}
                  className={`text-sm ${notoSansThai.className}`}
                  placeholder="เพิ่มหมายเหตุเพิ่มเติมสำหรับการผลิต..."
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {/* ปุ่มการกระทำซ้าย: ลบเมื่อเป็น draft, หรือยกเลิกงานเมื่อเป็น completed */}
            {(() => {
              if (!editDraftData) return null;
              const workflowStatusId = String(editDraftData.workflow_status_id ?? "");
              const recordStatus = String(editDraftData.recordStatus ?? "");
              const isDraftRecord =
                editDraftData.isDraft ||
                (typeof editDraftData.id === 'string' && editDraftData.id.startsWith('draft_')) ||
                editDraftData.workflow_status === 'draft' ||
                workflowStatusId === "1" ||
                recordStatus === "แบบร่าง" ||
                recordStatus === "บันทึกแบบร่าง";

              // กรณีเป็น Draft: แสดงปุ่มลบ
              if (isDraftRecord) {
                return (
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteDraft(editDraftId)}
                    disabled={isSubmitting}
                    className={`bg-red-600 hover:bg-red-700 text-white ${notoSansThai.className}`}
                  >
                    {isSubmitting ? "กำลังลบ..." : "ลบ"}
                  </Button>
                );
              }

              // ถ้าเป็นงานพิมพ์แล้ว ให้แสดงปุ่มยกเลิกงาน
              const isPrintedRecord = editDraftData.workflow_status === 'printed';
              if (isPrintedRecord && editDraftData.id) {
                return (
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelProduction(String(editDraftData.id))}
                    disabled={isSubmitting}
                    className={`bg-red-600 hover:bg-red-700 text-white ${notoSansThai.className}`}
                  >
                    {isSubmitting ? "กำลังยกเลิก..." : "ยกเลิกงาน"}
                  </Button>
                );
              }

              // ถ้าเป็นงานบันทึกเสร็จสิ้น ให้แสดงปุ่มลบ
              const isCompletedRecord =
                editDraftData.workflow_status === 'completed' ||
                workflowStatusId === "2" ||
                recordStatus === "บันทึกเสร็จสิ้น" ||
                recordStatus === "บันทึกสำเร็จ";
              if (isCompletedRecord && editDraftData.id) {
                return (
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteWorkPlan(String(editDraftData.id))}
                    disabled={isSubmitting}
                    className={`bg-red-600 hover:bg-red-700 text-white ${notoSansThai.className}`}
                  >
                    {isSubmitting ? "กำลังลบ..." : "ลบ"}
                  </Button>
                );
              }

              // fallback: ถ้าไม่ใช่งานพิมพ์แล้ว ให้อนุญาตลบผ่าน flow แบบร่าง
              return (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteDraft(editDraftId)}
                  disabled={isSubmitting}
                  className={`bg-red-600 hover:bg-red-700 text-white ${notoSansThai.className}`}
                >
                  {isSubmitting ? "กำลังลบ..." : "ลบ"}
                </Button>
              );
            })()}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSaveEditDraft(true)} disabled={isSubmitting} className={notoSansThai.className}>บันทึกแบบร่าง</Button>
              <Button onClick={() => handleSaveEditDraft(false)} disabled={isSubmitting} className={`bg-green-700 hover:bg-green-800 text-white ${notoSansThai.className}`}>
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกเสร็จสิ้น"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackDialogs
        fontClassName={notoSansThai.className}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        confirmTitle={confirmTitle}
        confirmMessage={confirmMessage}
        onConfirmNo={handleConfirmNo}
        onConfirmYes={handleConfirmYes}
        showSuccessDialog={showSuccessDialog}
        setShowSuccessDialog={setShowSuccessDialog}
        successDialogMessage={successDialogMessage}
      />

        {/* Dialog สำหรับถามว่าจะใช้ข้อมูลตามแผนหรือไม่ */}
        <Dialog open={showAutoFillDialog} onOpenChange={setShowAutoFillDialog}>
          <DialogContent className={notoSansThai.className}>
            <DialogHeader>
              <DialogTitle className="text-green-600">เลือกวิธีการกรอกข้อมูล</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="mb-4 text-gray-700 font-medium">
                <p className="font-bold">{pendingJobData?.jobCode} - {pendingJobData?.jobName}</p>
                <p className="mt-1">กรุณาเลือกรูปแบบการกรอกข้อมูล:</p>
              </div>
              
              {/* Radio Button Options */}
              <RadioGroup 
                value={autoFillOption || ''} 
                onValueChange={(value) => {
                  const newValue = value as 'latest' | 'best' | 'manual' | null;
                  setAutoFillOption(newValue);
                }}
                className="space-y-3 mb-4"
              >
                {/* ข้อมูลประวัติการผลิตย้อนหลัง (disabled) */}
                <div className="flex items-center space-x-3 opacity-50">
                  <RadioGroupItem value="best" id="best" disabled />
                  <label 
                    htmlFor="best" 
                    className="text-sm font-medium leading-none cursor-not-allowed flex-1"
                  >
                    <div className="text-gray-500">ข้อมูลประวัติการผลิตย้อนหลัง</div>
                  </label>
                </div>
                
                {/* ข้อมูลตามแผนผลิตครั่งล่าสุด */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="latest" id="latest" className="mt-0.5" />
                  <div className="flex-1">
                    <label 
                      htmlFor="latest" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer block"
                    >
                      <div className="text-gray-700">ข้อมูลตามแผนผลิตครั่งล่าสุด</div>
                    </label>
                    {/* แสดงข้อมูลออกมาเลยเมื่อมีข้อมูล */}
                    {pendingLatestData && (
                      <div className="mt-2 ml-0 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="space-y-2 text-sm">
                          {/* ผู้ปฏิบัติงาน */}
                          {pendingLatestData.operators && Array.isArray(pendingLatestData.operators) && pendingLatestData.operators.filter((op: string) => op && op !== '').length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-700 min-w-[100px]">ผู้ปฏิบัติงาน:</span>
                              <span className="text-gray-800 flex-1">
                                {pendingLatestData.operators.filter((op: string) => op && op !== '').join(' ')}
                              </span>
                            </div>
                          )}
                          
                          {/* เวลา */}
                          {(pendingLatestData.start_time || pendingLatestData.end_time) && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-700 min-w-[100px]">เวลา:</span>
                              <span className="text-gray-800 flex-1">
                                {pendingLatestData.start_time ? normalizeTimeForForm(pendingLatestData.start_time) : '--'}
                                {' - '}
                                {pendingLatestData.end_time ? normalizeTimeForForm(pendingLatestData.end_time) : '--'}
                              </span>
                            </div>
                          )}
                          
                          {/* ห้องผลิต */}
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-700 min-w-[100px]">ห้องผลิต:</span>
                            <span className="text-gray-800 flex-1">
                              {pendingLatestData.room_name || pendingLatestData.room_code || 'ไม่มีข้อมูล'}
                            </span>
                          </div>
                          
                          {/* วันที่ที่ดึงข้อมูลมา */}
                          {pendingLatestData.production_date && (() => {
                            const dataDate = createSafeDate(pendingLatestData.production_date);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (dataDate) {
                              dataDate.setHours(0, 0, 0, 0);
                              const diffTime = today.getTime() - dataDate.getTime();
                              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                              const formattedDate = formatDateThaiShort(dataDate);
                              let dayText = '';
                              if (diffDays === 0) {
                                dayText = 'วันนี้';
                              } else if (diffDays === 1) {
                                dayText = '1 วันที่แล้ว';
                              } else {
                                dayText = `${diffDays} วันที่แล้ว`;
                              }
                              return (
                                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-300 text-xs">
                                  <span className="font-semibold text-gray-700 min-w-[100px]">ข้อมูลจากวันที่:</span>
                                  <span className="text-gray-800 flex-1">
                                    {formattedDate} ({dayText})
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* กำหนดข้อมูลด้วยตัวเอง */}
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="manual" id="manual" />
                  <label 
                    htmlFor="manual" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="text-gray-700">กำหนดข้อมูลด้วยตัวเอง</div>
                  </label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (autoFillOption === 'latest' && pendingJobData && pendingLatestData) {
                    applyAutoFillData(pendingLatestData, pendingJobData.jobName);
                  }
                  setShowAutoFillDialog(false);
                  setPendingJobData(null);
                  setPendingLatestData(null);
                  setAutoFillOption(null); // Reset to null (ยังไม่เลือก)
                  setExpandedOption(null);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                disabled={autoFillOption === null}
              >
                ตกลง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Time Table Popup Dialog - ใช้ Component ใหม่ */}
        <TimeTablePopup
          open={showTimeTable}
          onOpenChange={setShowTimeTable}
          selectedDate={selectedDate}
          jobs={getSelectedDayProduction()}
          users={users}
        />

        {/* Time Table Popup Dialog - เก่า (ยังไม่ลบ) */}
        {/* <Dialog open={showTimeTable} onOpenChange={setShowTimeTable}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-green-600" />
                <span>ตารางเวลาการทำงาน - {formatDateForDisplay(new Date(selectedDate), 'full')}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <TimeTable
                jobs={getSelectedDayProduction()}
                users={users}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setShowTimeTable(false)}>
                ปิด
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog> */}
        </>
      )}
    </div>
  )
}
