'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Clock } from 'lucide-react';
import { getStaffImage, getStaffInitial } from '@/lib/staffAvatar';

interface Job {
  id: string;
  job_name: string;
  start_time: string;
  end_time: string;
  user_name?: string;
  operators?: string;
}

interface User {
  name: string;
  id_code: string;
}

interface TimeTableProps {
  jobs: Job[];
  users: User[];
  selectedDate: string;
  formatDateForDisplay: (date: Date, format: 'full' | 'short') => string;
  isOpen: boolean;
  onClose: () => void;
}

// ฟังก์ชันสร้างช่องเวลา 30 นาที (ใช้เวลาจุดเริ่มต้นแต่ละช่อง และเพิ่มช่วงพักเที่ยงพิเศษ)
function generateTimeSlots(start = "08:00", end = "17:00", step = 30) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const result: string[] = [];
  let [h, m] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  while (h < endH || (h === endH && m < endM)) {
    const timeSlot = `${pad(h)}:${pad(m)}`;

    // ช่วงพักเที่ยง 12:30-13:15 เป็นคอลัมน์พิเศษ
    if (timeSlot === "12:30") {
      result.push("12:30-13:15");
      h = 13;
      m = 15;
      continue;
    }

    result.push(timeSlot);
    m += step;
    if (m >= 60) { h++; m = m - 60; }
  }
  return result;
}

// ฟังก์ชันเตรียมข้อมูลตารางเวลา
function getTimeTableData(jobs: Job[], users: User[], sortBy: 'time' | 'name' = 'time') {
  const mainUsers = users.filter(u => !["RD", "พี่สัญญา"].includes(u.name));
  const timeSlots = generateTimeSlots();
  const isLunchSlot = (slot: string) => slot.includes('-')
  const idxForTime = (t: string) => {
    for (let i = 0; i < timeSlots.length; i++) {
      if (isLunchSlot(timeSlots[i])) continue
      if (timeSlots[i] >= t) return i
    }
    return timeSlots.length - 1
  }

  // จัดลำดับผู้ใช้
  const sortedUsers = mainUsers.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    const aFirst = jobs.filter(j => j.user_name === a.name).map(j => j.start_time).sort()[0] || '99:99'
    const bFirst = jobs.filter(j => j.user_name === b.name).map(j => j.start_time).sort()[0] || '99:99'
    if (aFirst !== bFirst) return aFirst.localeCompare(bFirst)
    return a.name.localeCompare(b.name)
  })

  const data = sortedUsers.map(user => {
    const userJobs = jobs.filter(job => job.user_name === user.name)
    const slots = timeSlots.map((slot, slotIndex) => {
      // ช่วงพักเที่ยงพิเศษ
      if (slot === '12:30-13:15') {
        const jobCoversLunch = userJobs.some(j => (j.start_time <= '12:30' && j.end_time > '12:30'))
        return {
          hasJob: false,
          jobName: '',
          jobCode: '',
          isStart: false,
          isEnd: false,
          colspan: 1,
          isLunchBreak: jobCoversLunch
        }
      }

      const job = userJobs.find(j => slot >= j.start_time && slot < j.end_time)
      if (!job) {
        return { hasJob: false, jobName: '', jobCode: '', isStart: false, isEnd: false, colspan: 1, isLunchBreak: false }
      }

      const startIndex = idxForTime(job.start_time)
      let span = 0
      for (let i = startIndex; i < timeSlots.length; i++) {
        const s = timeSlots[i]
        if (isLunchSlot(s)) break
        if (s < job.end_time) span++
        else break
      }
      const colspan = Math.max(1, span)
      const isStart = slotIndex === startIndex
      return {
        hasJob: true,
        jobName: job.job_name,
        jobCode: job.id,
        isStart,
        isEnd: false,
        colspan: isStart ? colspan : 1,
        isLunchBreak: false
      }
    })

    return { name: user.name, slots }
  })

  return { timeSlots, data }
}

// ฟังก์ชันกำหนดสีให้กับงาน
const getJobColor = (jobName: string) => {
  const colorMap: Record<string, string> = {
    "ชาชูต้มซีอิ้ว": "bg-blue-400",
    "หมูปั้นก้อนนิ่ง": "bg-green-400",
    "ทำผัก": "bg-yellow-400",
    "ปลาแซลมอนสไลด์": "bg-purple-400",
    "ขนมผักกาด": "bg-pink-400",
    "ลูกรอก": "bg-indigo-400",
    "ซอส": "bg-orange-400",
    "เบิกของส่งสาขา": "bg-teal-400",
    "ตวงสูตร": "bg-cyan-400",
    "แป้งทอดมันข้าวโพด": "bg-lime-400"
  };
  
  // หาสีที่ตรงกับงาน
  for (const [key, color] of Object.entries(colorMap)) {
    if (jobName.includes(key)) {
      return color;
    }
  }
  
  // สีเริ่มต้น
  return "bg-gray-400";
};

// Convert backend job item into list of operator names
function extractOperatorNames(ops: any): string[] {
  if (!ops) return []
  if (typeof ops === 'string') {
    return ops.split(/\s*,\s*/).filter(Boolean)
  }
  if (Array.isArray(ops)) {
    return ops.map((o: any) => (typeof o === 'string' ? o : (o?.name || o?.id_code))).filter(Boolean)
  }
  // Support { operator1..4 }
  const cand = [ops.operator1, ops.operator2, ops.operator3, ops.operator4].filter(Boolean)
  return cand as string[]
}

// Expand each job to multiple entries per operator (user_name)
function expandJobsByOperators(jobs: Job[]): Job[] {
  const LUNCH_START = '12:30'
  const LUNCH_END = '13:15'
  const normalizeTime = (t: any) => {
    if (!t) return ''
    const s = String(t)
    return s.length >= 5 ? s.slice(0,5) : s
  }
  const expanded: Job[] = []
  for (const j of jobs) {
    const names = extractOperatorNames((j as any).operators_from_join || j.operators)
    if (names.length === 0) {
      // keep as is if already has user_name
      if (j.user_name) expanded.push({ ...j, start_time: normalizeTime(j.start_time), end_time: normalizeTime(j.end_time) })
      continue
    }
    const s = normalizeTime(j.start_time)
    const e = normalizeTime(j.end_time)
    const splitForLunch = s < LUNCH_START && e > LUNCH_START
    for (const name of names) {
      if (splitForLunch) {
        expanded.push({ ...j, user_name: name, start_time: s, end_time: LUNCH_START })
        expanded.push({ ...j, user_name: name, start_time: LUNCH_END, end_time: e })
      } else {
        expanded.push({ ...j, user_name: name, start_time: s, end_time: e })
      }
    }
  }
  return expanded
}

export default function TimeTable({ 
  jobs, 
  users, 
  selectedDate, 
  formatDateForDisplay, 
  isOpen, 
  onClose 
}: TimeTableProps) {
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');

  // Prepare jobs in the same way as TimeTablePopup (grouped by job but expanded by operators)
  const jobsForGrid = useMemo(() => expandJobsByOperators(jobs), [jobs])

  const { timeSlots, data } = useMemo(() => 
    getTimeTableData(jobsForGrid as any, users as any, sortBy), 
    [jobsForGrid, users, sortBy]
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] h-[95vh] max-w-none max-h-none overflow-hidden flex flex-col p-2">
        <DialogHeader className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="flex items-center space-x-2 text-sm sm:text-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              <span className="truncate">ตารางเวลาการทำงาน - {formatDateForDisplay(new Date(selectedDate), 'full')}</span>
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">เรียงตาม:</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'time' | 'name')}
                className="text-xs sm:text-sm border border-gray-300 rounded px-1 sm:px-2 py-1 bg-white min-w-0 flex-shrink"
              >
                <option value="time">เวลาที่เริ่มงาน</option>
                <option value="name">ชื่อพนักงาน</option>
              </select>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto mt-4">
          <div className="w-full overflow-x-auto">
            <table className="w-full border text-sm shadow-lg border-collapse table-fixed">
              <colgroup>
                <col className="w-32" />
                {timeSlots.map((slot, idx) => (
                  <col key={slot} className="w-16" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="p-2 border bg-gray-100 text-left font-semibold text-sm sticky left-0 z-10">ชื่อ</th>
                  {timeSlots.map((slot, idx) => (
                    <th 
                      key={slot} 
                      className="p-1 sm:p-2 border text-center font-bold text-xs sm:text-sm relative bg-green-100 text-green-800"
                    >
                      <div className="hidden sm:block">
                        {slot}
                      </div>
                      <div className="sm:hidden text-xs">
                        {slot.split('-')[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={row.name}>
                    <td className="p-2 border bg-white whitespace-nowrap sticky left-0 z-10">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {getStaffImage(row.name) ? (
                          <img 
                            src={getStaffImage(row.name)} 
                            alt={row.name} 
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover flex-shrink-0" 
                          />
                        ) : (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-600 text-white text-[14px] sm:text-[17px] font-semibold flex items-center justify-center flex-shrink-0">
                            {getStaffInitial(row.name)}
                          </div>
                        )}
                        <span className="font-semibold text-xs sm:text-sm">{row.name}</span>
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
                          className={`border p-1 sm:p-3 relative min-h-[40px] sm:min-h-[50px] ${
                            slot.isLunchBreak 
                              ? "bg-gray-200 text-gray-600" 
                              : slot.hasJob 
                                ? getJobColor(slot.jobName) 
                                : "bg-white"
                          }`}
                        >
                          {slot.isLunchBreak && (
                            <div className="flex items-center justify-center text-xs sm:text-base font-bold min-h-[40px] sm:min-h-[50px] text-orange-800">
                              <span className="text-center leading-tight">พักเที่ยง</span>
                            </div>
                          )}
                          
                          {slot.hasJob && (
                            <div className="flex items-center justify-center text-xs sm:text-sm font-bold min-h-[40px] sm:min-h-[50px] text-white text-center leading-tight">
                              <span title={`${slot.jobName} (${slot.colspan} ช่อง x 30 นาที)`}>
                                {slot.jobName}
                              </span>
                            </div>
                          )}
                          
                          {/* เส้นแบ่งภายในแท่งงาน */}
                          {slot.hasJob && slot.colspan > 1 && (
                            <div className="absolute inset-0 flex">
                              {Array.from({ length: slot.colspan - 1 }).map((_, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex-1 border-r border-white/30"
                                />
                              ))}
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
          
          {/* ข้อมูลเพิ่มเติมเกี่ยวกับโครงสร้างตาราง */}
          <div className="mt-2 sm:mt-4 p-2 sm:p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
            <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-3">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-300"></div>
                <span className="text-xs">ช่องเวลา 30 นาที</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-orange-200 border border-orange-300"></div>
                <span className="text-xs">เวลาพักเที่ยง</span>
              </div>
            </div>
            
            <div className="text-gray-500 text-xs">
              💡 <strong>หมายเหตุ:</strong> งานเดียวกันจะมีสีเดียวกัน | แต่ละช่องเวลา = 30 นาที | งานที่กินเวลานานจะขยายหลายช่อง
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

