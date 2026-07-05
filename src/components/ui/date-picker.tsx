"use client";

import * as React from "react";
import { CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatDate,
  formatDateTime,
  toDateValue,
  toDateTimeValue,
  fromDateValue,
  fromDateTimeValue,
} from "@/lib/datetime";

/* ------------------------------------------------------------------ */
/* DatePicker — German, dd.MM.yyyy, drop-in for <input type="date">     */
/* value / onChange use the machine format "yyyy-MM-dd".               */
/* ------------------------------------------------------------------ */

export interface DatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Datum wählen",
  disabled,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = fromDateValue(value) ?? undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start bg-background px-3 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          {selected ? formatDate(selected) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            onChange(d ? toDateValue(d) : "");
            setOpen(false);
          }}
          initialFocus
          className={cn("pointer-events-auto p-3")}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* TimeColumn — scrollable 24h selector column, themed for dark mode.  */
/* ------------------------------------------------------------------ */

function TimeColumn({
  values,
  active,
  onSelect,
  ariaLabel,
}: {
  values: number[];
  active: number;
  onSelect: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <ScrollArea className="h-56 w-16" aria-label={ariaLabel}>
      <div className="flex flex-col gap-1 p-1">
        {values.map((v) => {
          const isActive = v === active;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm font-medium tabular-nums transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {String(v).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/* ------------------------------------------------------------------ */
/* DateTimePicker — German, dd.MM.yyyy HH:mm, 24h.                      */
/* Drop-in for <input type="datetime-local">.                          */
/* value / onChange use "yyyy-MM-ddTHH:mm".                            */
/* ------------------------------------------------------------------ */

export interface DateTimePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Minute step for the minute column (default 5). Use 1 for full precision. */
  minuteStep?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Datum & Uhrzeit wählen",
  disabled,
  className,
  id,
  minuteStep = 5,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const current = fromDateTimeValue(value);
  const selected = current ?? undefined;

  const minutes = React.useMemo(() => {
    const step = minuteStep > 0 ? minuteStep : 1;
    const list = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
    // Ensure the current minute is selectable even if it is off-step.
    if (current && !list.includes(current.getMinutes())) list.push(current.getMinutes());
    return list.sort((a, b) => a - b);
  }, [minuteStep, current]);

  const emit = (base: Date) => onChange(toDateTimeValue(base));

  const setDatePart = (d?: Date) => {
    if (!d) return;
    const next = current ? new Date(current) : new Date();
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    if (!current) next.setHours(8, 0, 0, 0);
    emit(next);
  };

  const setHour = (h: number) => {
    const next = current ? new Date(current) : new Date();
    next.setHours(h, next.getMinutes(), 0, 0);
    if (!current) next.setMinutes(0);
    emit(next);
  };

  const setMinute = (m: number) => {
    const next = current ? new Date(current) : new Date();
    next.setMinutes(m, 0, 0);
    emit(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start bg-background px-3 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          {selected ? formatDateTime(selected) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={setDatePart}
            initialFocus
            className={cn("pointer-events-auto p-3")}
          />
          <div className="flex flex-col border-t border-border sm:border-l sm:border-t-0">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Uhrzeit
              <span className="ml-auto tabular-nums text-muted-foreground">
                {selected ? formatDateTime(selected).slice(-5) : "--:--"}
              </span>
            </div>
            <div className="flex">
              <TimeColumn
                values={HOURS}
                active={current ? current.getHours() : -1}
                onSelect={setHour}
                ariaLabel="Stunde"
              />
              <div className="w-px bg-border" />
              <TimeColumn
                values={minutes}
                active={current ? current.getMinutes() : -1}
                onSelect={setMinute}
                ariaLabel="Minute"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
