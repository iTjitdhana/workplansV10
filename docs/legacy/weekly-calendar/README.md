# WeeklyCalendar Component

Component สำหรับแสดงตารางแผนผลิตแบบรายสัปดาห์ พร้อมระบบ Drag & Drop

## Features

- 📅 แสดงตารางแผนผลิต 6 วัน (จันทร์-เสาร์)
- 🎯 ระบบ Drag & Drop สำหรับย้ายและเรียงลำดับงาน
- 🔄 การนำทางสัปดาห์ (ก่อนหน้า/ถัดไป)
- 📊 แสดงจำนวนงานในแต่ละวัน
- 🎨 สีพื้นหลังแตกต่างกันในแต่ละวัน
- ⚡ TypeScript Support
- 📱 Responsive Design

## Installation

```bash
# Copy files to your project
cp -r components/WeeklyCalendar/ your-project/src/components/
cp -r lib/types/weekly-calendar.ts your-project/src/lib/types/
cp -r hooks/useWeeklyCalendar.ts your-project/src/hooks/
```

## Usage

### Basic Usage

```tsx
import { WeeklyCalendar } from '@/components/WeeklyCalendar'
import { ProductionTask } from '@/lib/types/weekly-calendar'

const MyComponent = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [productionData, setProductionData] = useState<ProductionTask[]>([])

  const handleWeekChange = (newWeek: Date) => {
    setCurrentWeek(newWeek)
  }

  const handleTaskMove = (taskId, fromDate, toDate, fromIndex, toIndex) => {
    // Handle task movement
  }

  const handleTaskReorder = (taskId, date, fromIndex, toIndex) => {
    // Handle task reordering
  }

  return (
    <WeeklyCalendar
      productionData={productionData}
      currentWeek={currentWeek}
      onWeekChange={handleWeekChange}
      onTaskMove={handleTaskMove}
      onTaskReorder={handleTaskReorder}
    />
  )
}
```

### Advanced Usage

```tsx
<WeeklyCalendar
  productionData={productionData}
  currentWeek={currentWeek}
  onWeekChange={handleWeekChange}
  onTaskMove={handleTaskMove}
  onTaskReorder={handleTaskReorder}
  onTaskClick={(task) => console.log('Task clicked:', task)}
  onDateClick={(date) => console.log('Date clicked:', date)}
  onAddTask={(date, index) => console.log('Add task:', date, index)}
  showWeekNavigation={true}
  showTaskCount={true}
  className="custom-class"
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productionData` | `ProductionTask[]` | ✅ | ข้อมูลงานผลิต |
| `currentWeek` | `Date` | ✅ | วันที่ปัจจุบันของสัปดาห์ |
| `onWeekChange` | `(newWeek: Date) => void` | ✅ | Callback เมื่อเปลี่ยนสัปดาห์ |
| `onTaskMove` | `(taskId, fromDate, toDate, fromIndex, toIndex) => void` | ✅ | Callback เมื่อย้ายงาน |
| `onTaskReorder` | `(taskId, date, fromIndex, toIndex) => void` | ✅ | Callback เมื่อเรียงลำดับงาน |
| `onTaskClick` | `(task: ProductionTask) => void` | ❌ | Callback เมื่อคลิกงาน |
| `onDateClick` | `(date: string) => void` | ❌ | Callback เมื่อคลิกวันที่ |
| `onAddTask` | `(date: string, index: number) => void` | ❌ | Callback เมื่อเพิ่มงาน |
| `showWeekNavigation` | `boolean` | ❌ | แสดงปุ่มนำทางสัปดาห์ |
| `showTaskCount` | `boolean` | ❌ | แสดงจำนวนงาน |
| `className` | `string` | ❌ | CSS class เพิ่มเติม |

## Data Structure

### ProductionTask

```typescript
interface ProductionTask {
  id: number
  date: string // YYYY-MM-DD format
  title: string
  room: string
  staff: string
  time: string
  status: string
  recordStatus: "บันทึกแบบร่าง" | "บันทึกเสร็จสิ้น" | "พิมพ์แล้ว"
  notes?: string
  createdAt?: string
  updatedAt?: string
}
```

## Drag & Drop Rules

### Draggable Tasks
- ✅ "บันทึกแบบร่าง" - งานที่ยังไม่เสร็จ
- ✅ "บันทึกเสร็จสิ้น" - งานที่บันทึกแล้ว
- ❌ "พิมพ์แล้ว" - งานที่พิมพ์แล้ว

### Drop Rules
- ✅ ย้ายงานไปยังวันอื่น
- ✅ เรียงลำดับงานในวันเดียวกัน
- ❌ วางในตำแหน่งเดียวกัน
- ❌ วางในงานเดียวกัน

## Styling

Component ใช้ Tailwind CSS และสามารถ customize ได้ผ่าน `className` prop

### Custom Colors
```css
/* Override day colors */
.bg-yellow-50 { /* Monday */ }
.bg-pink-50 { /* Tuesday */ }
.bg-green-50 { /* Wednesday */ }
.bg-orange-50 { /* Thursday */ }
.bg-blue-50 { /* Friday */ }
.bg-purple-50 { /* Saturday */ }
```

## Examples

ดูตัวอย่างการใช้งานใน `components/examples/WeeklyCalendarExample.tsx`

## Dependencies

- React 18+
- TypeScript
- Tailwind CSS
- Lucide React Icons
- Radix UI (Button component)

## License

MIT
