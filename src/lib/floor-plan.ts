// Dynamic Floor Plan — Configurable table layout for Resto POS
// Tables positioned on a grid with shape, size, and seat count.

export type TableShape = "rect" | "round";

export interface FloorTable {
    id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    seats: number;
    shape: TableShape;
}

export interface FloorArea {
    id: string;
    label: string;
}

export interface FloorPlan {
    tables: FloorTable[];
    areas: FloorArea[];
}

const DEFAULT_TABLES: FloorTable[] = Array.from({ length: 12 }, (_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    return {
        id: `t${i + 1}`,
        label: `Meja ${i + 1}`,
        x: col * 3,
        y: row * 3,
        w: 2,
        h: 2,
        seats: 4,
        shape: "rect" as TableShape,
    };
});

const DEFAULT_PLAN: FloorPlan = {
    tables: DEFAULT_TABLES,
    areas: [
        { id: "indoor", label: "Indoor" },
        { id: "outdoor", label: "Outdoor" },
    ],
};

export function getDefaultFloorPlan(): FloorPlan {
    return JSON.parse(JSON.stringify(DEFAULT_PLAN));
}

export function validateFloorPlan(data: Partial<FloorPlan>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.tables || !Array.isArray(data.tables) || data.tables.length === 0) {
        errors.push("tables must be a non-empty array");
        return { valid: false, errors };
    }

    const seenIds = new Set<string>();
    for (const table of data.tables) {
        if (!table.id || !table.label) {
            errors.push("each table must have id and label");
            continue;
        }
        if (typeof table.x !== "number" || typeof table.y !== "number") {
            errors.push(`table ${table.id}: x and y must be numbers`);
        }
        if (typeof table.w !== "number" || typeof table.h !== "number") {
            errors.push(`table ${table.id}: w and h must be numbers`);
        }
        if (typeof table.seats !== "number") {
            errors.push(`table ${table.id}: seats must be a number`);
        }
        if (table.shape !== "rect" && table.shape !== "round") {
            errors.push(`table ${table.id}: shape must be "rect" or "round"`);
        }
        if (seenIds.has(table.id)) {
            errors.push(`duplicate table id: ${table.id}`);
        }
        seenIds.add(table.id);
    }

    return { valid: errors.length === 0, errors };
}

export function mergeFloorPlan(partial: Partial<FloorPlan>): FloorPlan {
    const defaults = getDefaultFloorPlan();
    return {
        tables: partial.tables ?? defaults.tables,
        areas: partial.areas ?? defaults.areas,
    };
}

export function findTableById(plan: FloorPlan, id: string): FloorTable | undefined {
    return plan.tables.find((t) => t.id === id);
}

export function serializeFloorPlan(plan: FloorPlan): string {
    return JSON.stringify(plan);
}

export function deserializeFloorPlan(json: string): FloorPlan {
    try {
        const parsed = JSON.parse(json);
        if (!parsed.tables || !Array.isArray(parsed.tables)) {
            return getDefaultFloorPlan();
        }
        return {
            tables: parsed.tables,
            areas: parsed.areas ?? [],
        };
    } catch {
        return getDefaultFloorPlan();
    }
}
