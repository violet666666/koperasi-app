import prisma from "@/lib/prisma";

export interface ShiftDefinition {
    name: string;
    startHour: number;
    endHour: number;
}

const DEFAULT_SHIFT_SCHEDULE: ShiftDefinition[] = [
    { name: "Pagi", startHour: 7, endHour: 15 },
    { name: "Sore", startHour: 15, endHour: 21 },
    { name: "Malam", startHour: 21, endHour: 7 },
];

/**
 * Load shift schedule from app_settings, with fallback to defaults.
 * Key format: {unitType}_shift_schedule (e.g., "toko_shift_schedule")
 * Value: JSON array of { name, startHour, endHour }
 */
export async function getShiftSchedule(unitType?: string): Promise<ShiftDefinition[]> {
    try {
        const key = unitType ? `${unitType}_shift_schedule` : "toko_shift_schedule";
        const setting = await prisma.appSetting.findUnique({ where: { key } });
        if (setting) {
            const parsed = JSON.parse(setting.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed as ShiftDefinition[];
            }
        }
    } catch {
        // Fall through to default
    }
    return DEFAULT_SHIFT_SCHEDULE;
}

export function formatShiftLabel(shift: ShiftDefinition): string {
    const fmt = (h: number) => String(h).padStart(2, "0") + ":00";
    const fmtEnd = (h: number) => String(h).padStart(2, "0") + ":59";
    // endHour is exclusive (detection uses hour < endHour), so display last valid minute: (endHour - 1):59
    // For cross-midnight (e.g., endHour=7), the last valid hour is endHour-1 (could wrap to 23)
    const lastHour = shift.endHour === 0 ? 23 : shift.endHour - 1;
    return `${shift.name} (${fmt(shift.startHour)} - ${fmtEnd(lastHour)})`;
}

export function detectCurrentShift(schedule: ShiftDefinition[]): string {
    const hour = new Date().getHours();
    for (const shift of schedule) {
        if (shift.startHour < shift.endHour) {
            if (hour >= shift.startHour && hour < shift.endHour) return shift.name;
        } else {
            // Crosses midnight
            if (hour >= shift.startHour || hour < shift.endHour) return shift.name;
        }
    }
    return schedule[0]?.name || "Pagi";
}
