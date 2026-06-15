"use client"

import React, { useMemo, useRef, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { formatDateForDisplay } from "@/lib/dateUtils"
import { getOperatorsArray } from "@/lib/utils"
import { getStaffImage, getStaffInitial } from "@/lib/staffAvatar"
import { User } from "@/types/production"
import { TimeTableJob, TimeTableData, WorkerRowData } from "./timetable/types"
import { TIMETABLE_CONSTANTS } from "./timetable/constants"
import {
  generateTimeSlots,
  isValidWorkPlanJob,
  normalizeTime,
  padTime,
  formatTimeSlotLabel,
  calculateDuration,
  isLunchSlot,
} from "./timetable/utils"

// พาเลตสีแบบ tailwind ตามที่ผู้ใช้กำหนด (โทนอ่อน)
export const COLOR_PALETTE = [
  'bg-blue-200',     // 1 - น้ำเงิน
  'bg-purple-200',   // 2 - ม่วง
  'bg-violet-200',   // 3 - ม่วงอ่อน
  'bg-pink-200',     // 4 - ชมพู
  'bg-cyan-200',     // 5 - ฟ้าอมเขียว
  'bg-sky-200',      // 6 - ฟ้า
  'bg-indigo-200',   // 7 - คราม
  'bg-amber-300',    // 8 - น้ำตาลกาแฟ (แทน slate-200) - โทนน้ำตาลกาแฟ
  'bg-amber-400',    // 9 - น้ำตาลกาแฟเข้ม (แทน gray-200) - โทนน้ำตาลกาแฟเข้ม
  'bg-yellow-200',   // 10 - เหลือง (ไม่ใช่ส้ม)
  'bg-fuchsia-200',  // 11 - ม่วงชมพู
  'bg-rose-200',     // 12 - ชมพูอ่อน (ไม่ใช่แดง)
]

// แปลง Tailwind class เป็น CSS color สำหรับ inline style
const tailwindToColor: Record<string, string> = {
  'bg-blue-200': '#bfdbfe',      // blue-200
  'bg-purple-200': '#e9d5ff',    // purple-200
  'bg-violet-200': '#ddd6fe',     // violet-200
  'bg-pink-200': '#fbcfe8',       // pink-200
  'bg-cyan-200': '#a5f3fc',       // cyan-200
  'bg-sky-200': '#bae6fd',        // sky-200
  'bg-indigo-200': '#c7d2fe',     // indigo-200
  'bg-amber-300': '#fcd34d',      // amber-300
  'bg-amber-400': '#fbbf24',      // amber-400
  'bg-yellow-200': '#fef08a',     // yellow-200
  'bg-fuchsia-200': '#f5d0fe',    // fuchsia-200
  'bg-rose-200': '#fecdd3',       // rose-200
}

// สีสำหรับแต่ละคน (ยังเก็บไว้สำหรับอนาคต)
const workerColors: { [key: string]: string } = {
  "ป้าน้อย": "bg-blue-400",
  "พี่ตุ่น": "bg-green-400",
  "พี่ภา": "bg-yellow-400",
  "สาม": "bg-purple-400",
  "อาร์ม": "bg-pink-400",
  "เอ": "bg-indigo-400",
  "แจ็ค": "bg-orange-400",
  "แมน": "bg-red-400",
  "โอเล่": "bg-teal-400"
}

interface TimeTablePopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: string
  jobs: TimeTableJob[]
  users: User[]
}

// generateTimeSlots is now imported from utils

// ฟังก์ชันเตรียมข้อมูล Time Table แบบ Group by Person (จัดกลุ่มตามคน)
function getTimeTableData(jobs: TimeTableJob[], users: User[]): TimeTableData {
  const timeSlots = generateTimeSlots();
  
  // 1. กรองงานที่แสดงใน TimeTable (ต้องมี operators_from_join และเวลา)
  const workPlanJobs = jobs.filter(isValidWorkPlanJob);
  
  // 2. รวบรวมคนทั้งหมดและงานที่แต่ละคนทำ
  const personJobMap: Record<string, TimeTableJob[]> = {};
  const jobColorMap: Record<string, string> = {};
  let colorIndex = 0; // ตัวนับสำหรับเรียงสีตามลำดับงาน

  workPlanJobs.forEach((job) => {
    // ใช้เฉพาะ operators_from_join (จาก work_plan_operators)
    const operators = getOperatorsArray(job.operators_from_join);
    // กรอง RD, พี่สัญญา ออก
    const validOperators = operators.filter(
      name => !TIMETABLE_CONSTANTS.EXCLUDED_OPERATORS.includes(name as any)
    );
    // Use job identifier only (same job gets same color everywhere)
    const jobKeySimple = String(job.job_code || job.job_name || "unknown");
    
    // กำหนดสีให้กับงานนี้ (เรียงตามลำดับงานที่เจอครั้งแรก)
    if (!jobColorMap[jobKeySimple]) {
      // เลือกสีจาก palette ตามลำดับ (งานแรก = สีแรก, งานที่สอง = สีที่สอง)
      const paletteIndex = colorIndex % COLOR_PALETTE.length;
      const tailwindClass = COLOR_PALETTE[paletteIndex];
      jobColorMap[jobKeySimple] = tailwindToColor[tailwindClass] || tailwindToColor['bg-blue-200'];
      colorIndex++; // เพิ่มตัวนับสำหรับงานถัดไป
    }
    
    // เพิ่มงานเข้าไปในแต่ละคน
    validOperators.forEach(workerName => {
      if (!personJobMap[workerName]) {
        personJobMap[workerName] = [];
      }
      personJobMap[workerName].push({
        ...job,
        jobColor: jobColorMap[jobKeySimple],
        start_time: normalizeTime(job.start_time),
        end_time: normalizeTime(job.end_time),
      });
    });
  });
  
  // 3. เรียงลำดับคนตามเวลางานแรก แล้วสร้างข้อมูลแถว
  const sortedWorkers = Object.keys(personJobMap).sort((a, b) => {
    const aJobs = personJobMap[a].sort((x, y) => 
      (x.start_time || '').localeCompare(y.start_time || '')
    );
    const bJobs = personJobMap[b].sort((x, y) => 
      (x.start_time || '').localeCompare(y.start_time || '')
    );
    
    if (aJobs.length === 0 && bJobs.length === 0) return a.localeCompare(b);
    if (aJobs.length === 0) return 1;
    if (bJobs.length === 0) return -1;
    
    const timeCompare = (aJobs[0].start_time || '').localeCompare(bJobs[0].start_time || '');
    if (timeCompare !== 0) return timeCompare;
    return a.localeCompare(b);
  });
  
  // 4. สร้างข้อมูลแถวสำหรับแต่ละคน
  const data: WorkerRowData[] = [];
  
  sortedWorkers.forEach(workerName => {
    const workerJobs = (personJobMap[workerName] || []).sort((a, b) => 
      (a.start_time || '').localeCompare(b.start_time || '')
    );
    
    const slots = timeSlots.map((slot, slotIndex) => {
      // ตรวจสอบว่าเป็นเวลาพักเที่ยงหรือไม่
      if (isLunchSlot(slot)) {
        // แสดงพักเที่ยงถ้ามีงานที่ครอบคลุมช่วงนี้
        const jobCoversLunch = workerJobs.some(j => 
          (j.start_time || '') <= TIMETABLE_CONSTANTS.LUNCH_BREAK.START && 
          (j.end_time || '') > TIMETABLE_CONSTANTS.LUNCH_BREAK.START
        );
        return {
          hasJob: false,
          jobName: "",
          jobCode: "",
          isStart: false,
          isEnd: false,
          colspan: 1,
          isLunchBreak: jobCoversLunch
        };
      }
      
      // หางานที่ตรงกับ slot นี้
      const matchingJob = workerJobs.find(job => {
        const slotStart = slot;
        const jobStart = job.start_time || '';
        const jobEnd = job.end_time || '';
        return slotStart >= jobStart && slotStart < jobEnd;
      });
      
      if (matchingJob) {
        // คำนวณ colspan
        const jobStartSlotIndex = timeSlots.findIndex(s => {
          if (isLunchSlot(s)) return false;
          return s >= (matchingJob.start_time || '');
        });
        const jobEndSlotIndex = timeSlots.findIndex(s => {
          if (isLunchSlot(s)) return false;
          return s >= (matchingJob.end_time || '');
        });
        const colspan = jobEndSlotIndex > jobStartSlotIndex 
          ? jobEndSlotIndex - jobStartSlotIndex 
          : 1;
        
        const isStart = slotIndex === jobStartSlotIndex;
        
        return {
          hasJob: true,
          jobName: matchingJob.job_name,
          jobCode: matchingJob.job_code,
          jobColor: matchingJob.jobColor,
          isStart,
          isEnd: false,
          colspan: isStart ? colspan : 1,
          isLunchBreak: false
        };
      }
      
      return {
        hasJob: false,
        jobName: "",
        jobCode: "",
        isStart: false,
        isEnd: false,
        colspan: 1,
        isLunchBreak: false
      };
    });
    
    data.push({
      name: workerName,
      slots,
      jobs: workerJobs
    });
  });
  
  return { timeSlots, data, jobColorMap };
}

// คอมโพเนนต์ TimeTable แบบ Group by Person (จัดกลุ่มตามคน)
function TimeTable({ jobs, users }: { jobs: TimeTableJob[], users: User[] }) {
  const { timeSlots, data } = getTimeTableData(jobs, users);

  // Helper: map time string HH:mm or special slot to slot index
  // หา slot ที่ครอบคลุมเวลานั้น (เช่น 08:15 อยู่ใน slot 08:00-08:30)
  const slotIndexForTime = (t: string): number => {
    let lastValidIndex = 0;
    for (let i = 0; i < timeSlots.length; i++) {
      const s = timeSlots[i];
      if (isLunchSlot(s)) continue;
      // ถ้า slot >= t แสดงว่า slot นี้เริ่มหลังจาก t แล้ว
      // ดังนั้น slot ที่ถูกต้องคือ slot ก่อนหน้านี้ (lastValidIndex)
      if (s > t) {
        return lastValidIndex;
      }
      // ถ้า slot <= t ให้เก็บ index นี้ไว้
      lastValidIndex = i;
    }
    return lastValidIndex;
  };

  // Build lanes for overlapping jobs per person
  const buildLanes = (workerJobs: TimeTableJob[]): { blocks: Array<{ startIdx: number; endIdx: number; lane: number; jobName: string; color: string; startStr: string; endStr: string; durationStr: string }>; laneCount: number } => {
    const jobsByStart = [...workerJobs].sort((a, b) => 
      (a.start_time || '').localeCompare(b.start_time || '')
    );
    const lanesEnd: number[] = [];
    const blocks: Array<{ startIdx: number; endIdx: number; lane: number; jobName: string; color: string; startStr: string; endStr: string; durationStr: string }> = [];

    const lunchIndex = timeSlots.findIndex(s => isLunchSlot(s));
    
    for (const j of jobsByStart) {
      const startTime = j.start_time || '00:00';
      const endTime = j.end_time || '00:00';
      const startIdx = slotIndexForTime(startTime);
      
      // คำนวณ endIdx: หา slot ถัดไปหลังจาก slot ที่ครอบคลุม endTime
      let endIdx: number;
      if (endTime === TIMETABLE_CONSTANTS.LUNCH_BREAK.START && lunchIndex !== -1) {
        endIdx = lunchIndex;
      } else if (endTime >= TIMETABLE_CONSTANTS.WORK_HOURS.END) {
        // ถ้า end_time >= 17:00 ให้จบที่ขอบขวาของ slot สุดท้าย
        endIdx = timeSlots.length;
      } else {
        // หา slot ที่ครอบคลุม endTime โดยใช้ slotIndexForTime
        const endSlotIdx = slotIndexForTime(endTime);
        // หา slot ถัดไป (ข้าม lunch slot ถ้ามี)
        let nextSlotIdx = endSlotIdx + 1;
        while (nextSlotIdx < timeSlots.length && isLunchSlot(timeSlots[nextSlotIdx])) {
          nextSlotIdx++;
        }
        if (nextSlotIdx < timeSlots.length) {
          const nextSlotTime = timeSlots[nextSlotIdx];
          if (endTime === nextSlotTime) {
            // endTime ตรงกับจุดเริ่มต้นของ slot ถัดไป = จบที่จุดสิ้นสุดของ slot ปัจจุบัน
            endIdx = nextSlotIdx;
          } else {
            // endTime อยู่ใน slot ปัจจุบัน = ใช้ slot ถัดไป
            endIdx = nextSlotIdx;
          }
        } else {
          endIdx = timeSlots.length;
        }
      }
      
      // ตรวจสอบว่า endIdx ไม่เกิน timeSlots.length (ไม่ให้เลยตาราง)
      if (endIdx > timeSlots.length) {
        endIdx = timeSlots.length;
      }

      // assign lane
      let lane = 0;
      for (; lane < lanesEnd.length; lane++) {
        if (startIdx >= lanesEnd[lane]) break;
      }
      if (lane === lanesEnd.length) {
        lanesEnd.push(endIdx);
      } else {
        lanesEnd[lane] = endIdx;
      }
      
      const startStr = normalizeTime(startTime);
      const endStr = normalizeTime(endTime);
      const durationStr = calculateDuration(startTime, endTime);
      blocks.push({
        startIdx,
        endIdx,
        lane,
        jobName: j.job_name || '',
        color: j.jobColor || tailwindToColor[COLOR_PALETTE[0]],
        startStr,
        endStr,
        durationStr
      });
    }
    const laneCount = lanesEnd.length || 1;
    return { blocks, laneCount };
  };

  // Responsive measurements using ResizeObserver
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [containerHeight, setContainerHeight] = useState<number>(600)

  // Fix SSR issue - initialize width on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContainerWidth(window.innerWidth);
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect
        setContainerWidth(cr.width)
        setContainerHeight(cr.height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ปรับให้ nameColPx ใช้พื้นที่น้อยลงเพื่อให้ slot ขยายเต็มมากขึ้น
  const nameColPx = Math.round(
    Math.min(
      TIMETABLE_CONSTANTS.LAYOUT.NAME_COL_MAX_WIDTH,
      Math.max(
        TIMETABLE_CONSTANTS.LAYOUT.NAME_COL_MIN_WIDTH,
        containerWidth * TIMETABLE_CONSTANTS.LAYOUT.NAME_COL_WIDTH_RATIO
      )
    )
  );
  // คำนวณ slotPx ให้ใช้พื้นที่ทั้งหมดที่เหลือ (ไม่จำกัดขั้นต่ำ)
  const remainingWidth = containerWidth - nameColPx;
  const slotPx = Math.round(remainingWidth / Math.max(1, timeSlots.length));
  const tableMinWidth = nameColPx + timeSlots.length * slotPx;

  return (
    <div ref={containerRef} className="rounded-lg border-2 border-gray-200 shadow-xl" style={{display: 'block', width: '100%', minWidth: '100%'}}>
      <div style={{width: '100%', display: 'block', minWidth: '100%'}}>
        <table className="border-collapse bg-white" style={{ width: `${tableMinWidth}px`, minWidth: `${tableMinWidth}px`, tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="sticky left-0 z-20 px-3 py-2 leading-tight bg-gradient-to-r from-gray-100 to-gray-50 text-left font-bold text-sm md:text-base text-gray-800 border-r-2 border-gray-300 h-9" style={{ width: `${nameColPx}px` }}>
              <div className="flex items-center space-x-2">
                <span>👤</span>
                <span>ชื่อผู้ปฏิบัติงาน</span>
              </div>
            </th>
            {timeSlots.map((slot, idx) => (
              <th 
                key={slot} 
                className={`px-2 py-1 leading-tight text-center font-semibold text-xs md:text-sm lg:text-lg border-r border-gray-200 h-9 whitespace-nowrap ${
                  isLunchSlot(slot)
                    ? "bg-gradient-to-b from-orange-200 to-orange-100 text-orange-900" 
                    : "bg-gradient-to-b from-green-100 to-green-50 text-green-900"
                }`}
                style={{ width: `${slotPx}px` }}
              >
                <div className="flex flex-col items-center">
                  {isLunchSlot(slot) ? (
                    <>
                      <span className="font-bold whitespace-nowrap text-[10px] md:text-xs lg:text-sm">พักเที่ยง</span>
                      <span className="text-[8px] md:text-[10px] lg:text-xs">{TIMETABLE_CONSTANTS.LUNCH_BREAK.LABEL}</span>
                    </>
                  ) : (
                    <span className="whitespace-nowrap text-[10px] md:text-xs lg:text-sm">{formatTimeSlotLabel(slot)}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={timeSlots.length + 1} className="text-center py-12 text-gray-500">
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-4xl">📅</span>
                  <span className="text-lg">ไม่มีข้อมูลงานในวันนี้</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const jobCount = row.jobs?.length || 0;
              const { blocks, laneCount } = buildLanes(row.jobs || []);
              const baseLane = Math.round(
                Math.min(
                  TIMETABLE_CONSTANTS.LAYOUT.BASE_LANE_MAX,
                  Math.max(
                    TIMETABLE_CONSTANTS.LAYOUT.BASE_LANE_MIN,
                    containerHeight / Math.max(TIMETABLE_CONSTANTS.LAYOUT.BASE_LANE_DIVISOR, data.length)
                  )
                )
              );
              const laneHeight = baseLane;
              const rowHeight = Math.max(
                laneHeight * laneCount,
                baseLane + TIMETABLE_CONSTANTS.LAYOUT.ROW_HEIGHT_PADDING
              );

              return (
                <tr key={`person-${row.name}-${idx}`} className="border-b-2 border-gray-300">
                  <td className="sticky left-0 z-10 px-4 py-3 bg-white border-r-2 border-b border-gray-300 whitespace-nowrap align-top text-2xl md:text-4xl">
                    <div className="flex items-center space-x-3">
                      {getStaffImage(row.name) ? (
                        <img 
                          src={getStaffImage(row.name)} 
                          alt={row.name} 
                          className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-gray-300 shadow-sm" 
                        />
                      ) : (
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-green-600 text-white text-[20px] md:text-[22px] font-semibold border-2 border-gray-300 shadow-sm flex items-center justify-center">
                          {getStaffInitial(row.name)}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-bold text-lg md:text-2xl text-gray-900">{row.name}</span>
                        {jobCount > 0 && (
                          <span className="text-sm md:text-xl text-gray-600">{jobCount} งาน</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td colSpan={timeSlots.length} className="p-0 border-b border-gray-300">
                    <div className="relative border-y border-gray-200" style={{ height: rowHeight }}>
                      {/* vertical guides (background grid) */}
                      <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))` }}>
                        {timeSlots.map((slot, i) => (
                          <div
                            key={`bg-${i}`}
                            className={`border-r ${isLunchSlot(slot) ? 'bg-gray-200' : 'bg-white'}`}
                          />
                        ))}
                      </div>

                      {/* interactive time cells */}
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))` }}>
                        {timeSlots.map((slot, i) => {
                          const label = formatTimeSlotLabel(slot);
                          const startStr = isLunchSlot(slot)
                            ? TIMETABLE_CONSTANTS.LUNCH_BREAK.START
                            : slot;
                          const endStr = isLunchSlot(slot)
                            ? TIMETABLE_CONSTANTS.LUNCH_BREAK.END
                            : (() => {
                                const [hh, mm] = slot.split(':').map(Number);
                                const start = new Date(2000, 0, 1, hh, mm);
                                const plus = (hh === 13 && mm === 15) ? 45 : 30;
                                const end = new Date(start.getTime() + plus * 60000);
                                return `${padTime(end.getHours())}:${padTime(end.getMinutes())}`;
                              })();
                          return (
                            <div
                              key={`cell-${row.name}-${i}`}
                              role="gridcell"
                              tabIndex={0}
                              aria-label={`เวลา ${label}`}
                              title={label}
                              data-start={startStr}
                              data-end={endStr}
                              className="relative border-r border-transparent hover:bg-green-50/60 focus:bg-green-100/60 focus:outline-none"
                            />
                          );
                        })}
                      </div>
                      {/* blocks */}
                      {blocks.map((b, i) => {
                        // คำนวณตำแหน่งและความกว้างจาก startTime และ endTime จริง
                        const [sH, sM] = (b.startStr || '00:00').split(':').map(Number)
                        const [eH, eM] = (b.endStr || '00:00').split(':').map(Number)
                        
                        // หา slot time ของ slot ที่ startIdx
                        const startSlotTime = timeSlots[b.startIdx];
                        let startSlotMinutes = 0;
                        let startSlotDuration = 30; // default 30 minutes
                        if (isLunchSlot(startSlotTime)) {
                          // lunch break slot (12:30-13:15) = 45 minutes
                          const [slH, slM] = TIMETABLE_CONSTANTS.LUNCH_BREAK.START.split(':').map(Number);
                          startSlotMinutes = slH * 60 + slM;
                          startSlotDuration = 45;
                        } else if (startSlotTime) {
                          const [ssH, ssM] = startSlotTime.split(':').map(Number);
                          startSlotMinutes = ssH * 60 + ssM;
                          // ตรวจสอบว่าเป็นช่อง 45 นาทีหรือไม่ (12:30-13:15 หรือ 13:15-14:00)
                          if ((ssH === 12 && ssM === 30) || (ssH === 13 && ssM === 15)) {
                            startSlotDuration = 45; // 45 minutes = 3 ช่อง 15 นาที
                          }
                        }
                        
                        // คำนวณ offset ภายใน slot แรก (ใช้ slotDuration ที่ถูกต้อง)
                        const startMinutes = sH * 60 + sM;
                        const startOffset = startSlotMinutes > 0 ? (startMinutes - startSlotMinutes) / startSlotDuration : 0;
                        // จำกัด offset ระหว่าง 0-1
                        const startOffsetClamped = Math.max(0, Math.min(1, startOffset));
                        
                        // คำนวณ leftCols
                        let leftCols = b.startIdx + startOffsetClamped;
                        
                        // หา slot time ของ slot สุดท้ายที่งานครอบคลุม
                        // ใช้ slotIndexForTime เพื่อหา slot ที่ครอบคลุม endTime
                        // slotIndexForTime จะคืนค่า slot ที่ครอบคลุม endTime อยู่แล้ว
                        // (เช่น 14:15 อยู่ใน slot 14:00-14:30, slotIndexForTime จะคืนค่า index ของ slot "14:00")
                        const endSlotIdx = slotIndexForTime(b.endStr);
                        const endSlotTime = timeSlots[endSlotIdx];
                        let endSlotMinutes = 0;
                        let endSlotDuration = 30; // default 30 minutes
                        if (isLunchSlot(endSlotTime)) {
                          // lunch break slot (12:30-13:15) = 45 minutes
                          const [elH, elM] = TIMETABLE_CONSTANTS.LUNCH_BREAK.START.split(':').map(Number);
                          endSlotMinutes = elH * 60 + elM;
                          endSlotDuration = 45; // lunch break is 45 minutes
                        } else if (endSlotTime) {
                          const [esH, esM] = endSlotTime.split(':').map(Number);
                          endSlotMinutes = esH * 60 + esM;
                          // ตรวจสอบว่าเป็นช่อง 45 นาทีหรือไม่ (12:30-13:15 หรือ 13:15-14:00)
                          if ((esH === 12 && esM === 30) || (esH === 13 && esM === 15)) {
                            endSlotDuration = 45; // 45 minutes = 3 ช่อง 15 นาที
                          }
                        }
                        
                        // คำนวณ offset ภายใน slot สุดท้าย (ใช้ endSlotDuration ที่ถูกต้อง)
                        const endMinutes = eH * 60 + eM;
                        let endOffset = 0;
                        if (endSlotMinutes > 0) {
                          // ตรวจสอบว่า endTime ตรงกับจุดเริ่มต้นของ slot ถัดไปหรือไม่
                          // หา slot ถัดไป (ข้าม lunch slot ถ้ามี)
                          let nextSlotIdx = endSlotIdx + 1;
                          while (nextSlotIdx < timeSlots.length && isLunchSlot(timeSlots[nextSlotIdx])) {
                            nextSlotIdx++;
                          }
                          if (nextSlotIdx < timeSlots.length) {
                            const nextSlotTime = timeSlots[nextSlotIdx];
                            if (b.endStr === nextSlotTime) {
                              // endTime ตรงกับจุดเริ่มต้นของ slot ถัดไป = จบที่จุดสิ้นสุดของ slot ปัจจุบัน
                              endOffset = 1.0;
                            } else {
                              // endTime อยู่ใน slot ปัจจุบัน
                              endOffset = (endMinutes - endSlotMinutes) / endSlotDuration;
                            }
                          } else {
                            // ไม่มี slot ถัดไป
                            endOffset = (endMinutes - endSlotMinutes) / endSlotDuration;
                          }
                        }
                        // จำกัด offset ระหว่าง 0-1
                        const endOffsetClamped = Math.max(0, Math.min(1, endOffset));
                        
                        // คำนวณ widthCols
                        // ความกว้าง = ระยะห่างจากจุดเริ่มต้นถึงจุดสิ้นสุด
                        // = ส่วนที่เหลือใน slot แรก + slot เต็มระหว่างกลาง + ส่วนที่ใช้ใน slot สุดท้าย
                        // ใช้ endSlotIdx แทน endIdx เพื่อคำนวณจำนวน slot ระหว่างกลางให้ถูกต้อง
                        let widthCols: number;
                        if (endSlotIdx === b.startIdx) {
                          // งานอยู่ใน slot เดียวกัน
                          widthCols = endOffsetClamped - startOffsetClamped;
                        } else {
                          // งานครอบคลุมหลาย slot
                          // = ส่วนที่เหลือใน slot แรก + slot เต็มระหว่างกลาง + ส่วนที่ใช้ใน slot สุดท้าย
                          // ใช้ endSlotIdx เพื่อคำนวณจำนวน slot ระหว่างกลาง
                          const firstSlotPortion = 1 - startOffsetClamped;
                          const middleSlots = Math.max(0, endSlotIdx - b.startIdx - 1);
                          const lastSlotPortion = endOffsetClamped;
                          widthCols = firstSlotPortion + middleSlots + lastSlotPortion;
                        }
                        
                        // ✅ ตรวจสอบว่า widthCols ไม่เกินจำนวน slots (ไม่ให้เลยตาราง)
                        if (widthCols > timeSlots.length - leftCols) {
                          widthCols = timeSlots.length - leftCols;
                        }
                        if (widthCols < 0) widthCols = 0;
                        
                        const left = (leftCols / timeSlots.length) * 100
                        const width = (widthCols / timeSlots.length) * 100
                        
                        // ✅ ตรวจสอบว่า width + left ไม่เกิน 100% (ไม่ให้เลยตาราง)
                        const maxWidth = 100 - left;
                        const finalWidth = Math.min(width, maxWidth);
                        const tooltipPosClass = idx === 0 ? 'top-full mt-2' : 'bottom-full mb-2';
                        return (
                          <div
                            key={i}
                            className={`group absolute rounded text-sm md:text-base leading-tight flex items-center justify-start ring-1 ring-black/5`}
                            style={{
                              left: `${left}%`,
                              width: `${finalWidth}%`,
                              top: (b.lane * laneHeight) + TIMETABLE_CONSTANTS.LAYOUT.BLOCK_PADDING,
                              height: Math.max(
                                TIMETABLE_CONSTANTS.LAYOUT.BLOCK_MIN_HEIGHT,
                                Math.round((laneHeight - 6) * TIMETABLE_CONSTANTS.LAYOUT.BLOCK_HEIGHT_MULTIPLIER)
                              ),
                              background: b.color
                            }}
                          >
                            <span className="px-3 overflow-hidden text-ellipsis whitespace-nowrap text-black font-bold">{b.jobName}</span>
                            {/* Hover card tooltip (white card like example) */}
                            <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${tooltipPosClass} bg-white text-sm md:text-base text-gray-800 rounded-md px-3 py-2 shadow-xl border border-black/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}>
                              <div className="font-semibold">{b.jobName}</div>
                              <div className="text-gray-600">ระยะเวลา: {b.durationStr}</div>
                              <div className="text-gray-600">เวลา: {b.startStr} - {b.endStr}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Component หลัก TimeTablePopup
export function TimeTablePopup({ open, onOpenChange, selectedDate, jobs, users }: TimeTablePopupProps) {
  // คำนวณจำนวนคนและงาน (ใช้ useMemo เพื่อ cache)
  const { data: timetableData } = useMemo(() => getTimeTableData(jobs, users), [jobs, users]);
  const workPlanJobs = useMemo(() => {
    return jobs.filter(isValidWorkPlanJob);
  }, [jobs]);
  
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!tableWrapperRef.current || !contentContainerRef.current || !open) return;
    
    const SCALE_FACTOR = 1;
    
    // ฟังก์ชันหลักสำหรับตั้งค่า width ให้ตารางขยายเต็มพื้นที่
    const setupTableWidth = () => {
      if (!contentContainerRef.current || !tableWrapperRef.current) return;
      
      // หา container width ที่แท้จริง (ยึดตามความกว้างของ Dialog ทั้งหมดเพื่อให้ชิดขวา)
      const dialogWidth = dialogContentRef.current?.clientWidth || window.innerWidth;
      const containerParentWidth = dialogWidth;
      
      // คำนวณ wrapper width ที่ต้องการ (หลัง scale 0.7 จะได้ขนาด containerParentWidth)
      const wrapperTargetWidth = containerParentWidth / SCALE_FACTOR;
      
      // ตั้งค่า DialogContent width
      if (dialogContentRef.current) {
        dialogContentRef.current.style.setProperty('width', `${dialogWidth}px`, 'important');
        dialogContentRef.current.style.setProperty('maxWidth', `${dialogWidth}px`, 'important');
      }
      
      // ตั้งค่า contentContainer width
      contentContainerRef.current.style.setProperty('width', `${containerParentWidth}px`, 'important');
      contentContainerRef.current.style.setProperty('minWidth', `${containerParentWidth}px`, 'important');
      contentContainerRef.current.style.setProperty('maxWidth', `${containerParentWidth}px`, 'important');
      
      // ตั้งค่า wrapper width
      tableWrapperRef.current.style.setProperty('width', `${wrapperTargetWidth}px`, 'important');
      tableWrapperRef.current.style.setProperty('minWidth', `${wrapperTargetWidth}px`, 'important');
      tableWrapperRef.current.style.setProperty('maxWidth', 'none', 'important');
      
      // ตั้งค่า table container และ table width
      const tableContainer = tableWrapperRef.current.querySelector('.rounded-lg') as HTMLElement;
      if (tableContainer) {
        tableContainer.style.setProperty('width', `${wrapperTargetWidth}px`, 'important');
        tableContainer.style.setProperty('minWidth', `${wrapperTargetWidth}px`, 'important');
        
        const innerTable = tableContainer.querySelector('table') as HTMLElement;
        if (innerTable) {
          innerTable.style.setProperty('width', `${wrapperTargetWidth}px`, 'important');
          innerTable.style.setProperty('minWidth', `${wrapperTargetWidth}px`, 'important');
          
          // อัพเดท column widths
          const nameCol = innerTable.querySelector('th:first-child') as HTMLElement;
          const timeSlotHeaders = innerTable.querySelectorAll('th:not(:first-child)');
          const timeSlotCount = timeSlotHeaders.length;
          
          if (nameCol && timeSlotCount > 0) {
            const nameColPx = Math.round(Math.min(240, Math.max(140, wrapperTargetWidth * 0.14)));
            nameCol.style.setProperty('width', `${nameColPx}px`, 'important');
            
            const remainingWidth = wrapperTargetWidth - nameColPx;
            const slotPx = Math.round(remainingWidth / timeSlotCount);
            
            timeSlotHeaders.forEach((th) => {
              (th as HTMLElement).style.setProperty('width', `${slotPx}px`, 'important');
            });
          }
        }
      }
    };
    
    // ตั้งค่า height
    const setupTableHeight = () => {
      if (!contentContainerRef.current || !tableWrapperRef.current) return;
      
      const tableContainer = tableWrapperRef.current.querySelector('.rounded-lg') as HTMLElement;
      if (!tableContainer) {
        setTimeout(setupTableHeight, 100);
        return;
      }
      
      const tableHeight = tableContainer.scrollHeight;
      if (tableHeight === 0) {
        setTimeout(setupTableHeight, 100);
        return;
      }
      
      const maxHeight = window.innerHeight * TIMETABLE_CONSTANTS.LAYOUT.CONTENT_HEIGHT_RATIO;
      const scaledHeight = tableHeight * SCALE_FACTOR;
      const finalHeight = Math.min(scaledHeight, maxHeight);
      
      tableWrapperRef.current.style.setProperty('height', `${tableHeight}px`, 'important');
      tableWrapperRef.current.style.setProperty('maxHeight', `${maxHeight / SCALE_FACTOR}px`, 'important');
      
      contentContainerRef.current.style.setProperty('height', `${finalHeight}px`, 'important');
      contentContainerRef.current.style.setProperty('maxHeight', `${maxHeight}px`, 'important');
      // ให้เลื่อนตารางได้เสมอถ้ามีเนื้อหาเกินความสูง
      contentContainerRef.current.style.overflowY = 'auto';
      contentContainerRef.current.style.overflowX = 'hidden';
    };
    
    // เรียกใช้หลังจาก render เสร็จ
    const timeout1 = setTimeout(() => {
      setupTableWidth();
      setupTableHeight();
    }, 100);
    
    const timeout2 = setTimeout(() => {
      setupTableWidth();
      setupTableHeight();
    }, 500);
    
    // ใช้ ResizeObserver เพื่อ enforce width เมื่อมีการ resize
    const resizeObserver = new ResizeObserver(() => {
      setupTableWidth();
    });
    
    if (contentContainerRef.current) {
      resizeObserver.observe(contentContainerRef.current);
    }
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      resizeObserver.disconnect();
    };
  }, [jobs, users, timetableData, open]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={dialogContentRef}
        className="w-full h-full max-w-full max-h-full p-0 gap-0 rounded-md [&>button]:hidden !grid-cols-none" 
        style={{
          height: '100vh',
          width: '100vw',
          maxWidth: '100vw',
          maxHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'fixed',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          transform: 'none',
          margin: 0,
          padding: 0,
          gap: 0,
          rowGap: 0,
          columnGap: 0
        }}
      >
        <DialogHeader className="px-1 py-0 border-b bg-gradient-to-r from-green-50 to-blue-50 flex-none relative" style={{height: `calc(100vh * ${TIMETABLE_CONSTANTS.LAYOUT.HEADER_HEIGHT_RATIO})`, flexShrink: 0, flexGrow: 0, margin: 0, paddingTop: 0, paddingBottom: 0, width: '100%'}}>
          {/* Large top-right close button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(false);
            }}
            style={{ 
              position: 'absolute', 
              top: '8px', 
              right: '8px', 
              zIndex: 1000, 
              pointerEvents: 'auto',
              width: `${TIMETABLE_CONSTANTS.LAYOUT.CLOSE_BUTTON_SIZE}px`,
              height: `${TIMETABLE_CONSTANTS.LAYOUT.CLOSE_BUTTON_SIZE}px`
            }}
            className="rounded-full bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 flex items-center justify-center shadow-lg cursor-pointer transition-colors border-2 border-gray-300"
            aria-label="ปิด"
          >
            <X className="w-7 h-7 pointer-events-none font-bold" />
          </button>
          <DialogTitle className="flex items-center space-x-2 text-2xl md:text-4xl h-full">
            {/* removed clock icon */}
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-800 text-2xl md:text-4xl">ตารางเวลาการทำงานของผู้ปฏิบัติงาน</span>
              <span className="text-2xl md:text-4xl text-gray-700 font-semibold">{formatDateForDisplay(new Date(selectedDate), 'full')}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div 
          ref={contentContainerRef}
          className="[&::-webkit-scrollbar]:hidden [scrollbar-width:none]" 
          style={{flex: '0 0 auto', minWidth: 0, minHeight: 0, maxHeight: `calc(100vh * ${TIMETABLE_CONSTANTS.LAYOUT.CONTENT_HEIGHT_RATIO})`, msOverflowStyle: 'none', overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 0, margin: 0}}
        >
          <div ref={tableWrapperRef} style={{ transform: 'none', transformOrigin: 'top left', flexShrink: 0, marginBottom: 0, paddingBottom: 0, marginRight: 0, paddingRight: 0, display: 'block' }}>
            <TimeTable
              jobs={jobs}
              users={users}
            />
          </div>
        </div>
        <DialogFooter className="px-2 py-0.5 border-t bg-gray-50 flex-none w-full" style={{height: `calc(100vh * ${TIMETABLE_CONSTANTS.LAYOUT.FOOTER_HEIGHT_RATIO})`, flexShrink: 0, flexGrow: 0, width: '100%', margin: 0, paddingTop: 0, paddingBottom: 0}}>
          <div className="flex items-center justify-between w-full">
            <div className="text-base md:text-2xl text-gray-700">
              👥 จำนวนผู้ปฏิบัติงาน: <span className="font-semibold text-gray-800">{timetableData.length} คน</span>
              {' | '}
              📊 จำนวนงานทั้งหมด: <span className="font-semibold text-gray-800">{workPlanJobs.length} งาน</span>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


