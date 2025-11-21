"use client"

import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Using dashboard-style calendar grid instead of DayPicker
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Props = {
  value: string
  onChange: (v: string) => void
  id?: string
  className?: string
  placeholder?: string
}

function pad(n: number) { return String(n).padStart(2, "0") }
function toLocalInputFromDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
function parseLocalString(v: string) { try { return v ? new Date(v) : null } catch { return null } }

export function DateTimePicker({ value, onChange, id, className, placeholder }: Props) {
  const initialDate = useMemo(() => {
    if (!value) return new Date()
    const parsed = parseLocalString(value) || (value ? new Date(value) : null)
    return parsed
  }, [value])

  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate)
  const [viewMonth, setViewMonth] = useState<Date>(initialDate || new Date())
  const [hour, setHour] = useState<string>(pad((initialDate || new Date()).getHours()))
  const [minute, setMinute] = useState<string>(pad((initialDate || new Date()).getMinutes()))

  const display = useMemo(() => {
    if (!selectedDate) return ""
    const d = new Date(selectedDate)
    if (hour) d.setHours(Number(hour))
    if (minute) d.setMinutes(Number(minute))
    return toLocalInputFromDate(d)
  }, [selectedDate, hour, minute])

  const handleConfirm = () => {
    if (!selectedDate) return
    const d = new Date(selectedDate)
    const hh = hour ? Number(hour) : d.getHours()
    const mm = minute ? Number(minute) : d.getMinutes()
    d.setHours(hh)
    d.setMinutes(mm)
    onChange(toLocalInputFromDate(d))
    setOpen(false)
  }

  const hours = Array.from({ length: 24 }, (_, i) => pad(i))
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i))
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const dayNames = ["S","M","T","W","T","F","S"]
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" id={id} className={cn("justify-start font-normal w-full", className)} onClick={() => setOpen(true)}>
          {((value || display) ? (value || display).replace("T", " ") : (placeholder || "Select date & time"))}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-3 bg-white">
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-bold text-gray-900">
              {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {dayNames.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-gray-500 h-4 flex items-center justify-center">{d}</div>
            ))}
          </div>
          {(() => {
            const year = viewMonth.getFullYear()
            const month = viewMonth.getMonth()
            const days = daysInMonth(year, month)
            const firstDay = firstDayOfMonth(year, month)
            return (
              <div className="grid grid-cols-7 auto-rows-fr gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => (<div key={`empty-${i}`} />))}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1
                  const isSelected = selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day
                  const isToday = (() => { const t = new Date(); return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day })()
                  return (
                    <button
                      key={`day-${day}`}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                      className={cn(
                        "w-full h-8 rounded-sm flex items-center justify-center text-[11px] font-medium transition-all hover:bg-gray-100",
                        isSelected && "bg-rose-500 text-white hover:bg-rose-600 ring-1 ring-rose-300",
                        !isSelected && isToday && "bg-orange-100 text-orange-600"
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            )
          })()}
          <div className="grid grid-cols-4 gap-2 items-center">
            <div className="col-span-2">
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger>
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto scroll-smooth">
                  {hours.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto scroll-smooth">
                  {minutes.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <div className="col-span-2">
              <Input readOnly value={display} placeholder={placeholder || "YYYY-MM-DD HH:mm"} />
            </div>
            <Button onClick={handleConfirm}>Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}