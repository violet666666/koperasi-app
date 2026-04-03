"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type PeriodMode = "all" | "today" | "day" | "month" | "year";

export interface DateRange {
    start: Date | null;
    end: Date | null;
    mode: PeriodMode;
    label: string;
}

interface DatePeriodFilterProps {
    onChange: (range: DateRange) => void;
    defaultMode?: PeriodMode;
    showImportNote?: boolean;
    className?: string;
}

const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function buildYearOptions(): string[] {
    const now = new Date().getFullYear();
    const years: string[] = [];
    for (let y = now; y >= now - 5; y--) years.push(String(y));
    return years;
}

function startOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function endOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Reusable date-period filter component.
 * Provides quick-select buttons (Semua / Hari Ini / Bulan Ini / Tahun Ini)
 * plus a granular day/month/year picker.
 *
 * Usage:
 *   <DatePeriodFilter onChange={(range) => setDateRange(range)} />
 *
 * Then filter your array:
 *   filteredData = data.filter(item => matchesDateRange(item.date, range))
 */
export function DatePeriodFilter({
    onChange,
    defaultMode = "all",
    showImportNote = false,
    className,
}: DatePeriodFilterProps) {
    const now = new Date();
    const [mode, setMode] = React.useState<PeriodMode>(defaultMode);
    // Specific day picker
    const [pickedDay, setPickedDay] = React.useState(
        now.toISOString().slice(0, 10)
    );
    // Month/year picker
    const [pickedMonth, setPickedMonth] = React.useState(String(now.getMonth() + 1));
    const [pickedYear, setPickedYear] = React.useState(String(now.getFullYear()));

    const yearOptions = React.useMemo(() => buildYearOptions(), []);

    // Calculate and emit the range whenever any picker changes
    React.useEffect(() => {
        let start: Date | null = null;
        let end: Date | null = null;
        let label = "Semua Data";

        switch (mode) {
            case "today": {
                start = startOfDay(now);
                end = endOfDay(now);
                label = `Hari Ini (${now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`;
                break;
            }
            case "day": {
                const d = new Date(pickedDay);
                if (!isNaN(d.getTime())) {
                    start = startOfDay(d);
                    end = endOfDay(d);
                    label = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                }
                break;
            }
            case "month": {
                const m = parseInt(pickedMonth) - 1;
                const y = parseInt(pickedYear);
                start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
                end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)); // day=0 → last day of previous month
                label = `${MONTHS[m]} ${y}`;
                break;
            }
            case "year": {
                const y = parseInt(pickedYear);
                start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
                end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
                label = `Tahun ${y}`;
                break;
            }
            default:
                break;
        }

        onChange({ start, end, mode, label });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, pickedDay, pickedMonth, pickedYear]);

    const quickBtnClass = (m: PeriodMode) =>
        cn(
            "h-8 text-xs px-3 rounded-full border transition-colors",
            mode === m
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground"
        );

    return (
        <div className={cn("space-y-3", className)}>
            {/* Row 1: Quick buttons */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Periode:</span>
                </div>

                <button className={quickBtnClass("all")} onClick={() => setMode("all")}>
                    Semua
                </button>
                <button className={quickBtnClass("today")} onClick={() => setMode("today")}>
                    Hari Ini
                </button>
                <button className={quickBtnClass("day")} onClick={() => setMode("day")}>
                    Pilih Hari
                </button>
                <button className={quickBtnClass("month")} onClick={() => setMode("month")}>
                    Pilih Bulan
                </button>
                <button className={quickBtnClass("year")} onClick={() => setMode("year")}>
                    Pilih Tahun
                </button>
            </div>

            {/* Row 2: Granular pickers */}
            {mode === "day" && (
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Pilih Tanggal:</Label>
                    <Input
                        type="date"
                        value={pickedDay}
                        onChange={(e) => setPickedDay(e.target.value)}
                        className="w-40 h-8 text-sm"
                    />
                </div>
            )}

            {(mode === "month" || mode === "year") && (
                <div className="flex items-center gap-2">
                    {mode === "month" && (
                        <>
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Bulan:</Label>
                            <Select value={pickedMonth} onValueChange={setPickedMonth}>
                                <SelectTrigger className="w-[130px] h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => (
                                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Tahun:</Label>
                    <Select value={pickedYear} onValueChange={setPickedYear}>
                        <SelectTrigger className="w-[100px] h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Import note */}
            {showImportNote && mode === "day" && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                        Beberapa data hasil import mungkin tidak muncul pada filter Hari karena hanya memiliki presisi bulan (tanpa tanggal spesifik). Gunakan filter <strong>Bulan</strong> untuk melihat semua data.
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * Utility: Check if a date string/Date falls within the given DateRange.
 * Returns true if range.mode is "all" or date is within [start, end].
 * Handles null/undefined/invalid dates gracefully — they are INCLUDED in "all" mode
 * but EXCLUDED from any specific period filter.
 */
export function matchesDateRange(dateValue: string | Date | null | undefined, range: DateRange): boolean {
    if (range.mode === "all" || (!range.start && !range.end)) return true;

    if (!dateValue) return false; // No date → exclude from specific filters

    const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (isNaN(d.getTime())) return false; // Invalid date → exclude

    const ts = d.getTime();
    const startTs = range.start ? range.start.getTime() : -Infinity;
    const endTs = range.end ? range.end.getTime() : Infinity;

    return ts >= startTs && ts <= endTs;
}
