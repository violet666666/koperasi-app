// Dynamic Queue System — Cafe LSP and other counter-based units
// Configurable queue number formatting, daily reset, admin settings.

export interface QueueConfig {
    prefix: string;       // "A", "Q", "C" — 1-3 chars
    digits: number;       // 3 = A001, 4 = A0001
    resetPolicy: "daily" | "manual" | "never";
    maxPerDay: number;    // 0 = unlimited
    autoCall: boolean;    // auto-advance on Antrian Board
}

const DEFAULT_CONFIG: QueueConfig = {
    prefix: "A",
    digits: 3,
    resetPolicy: "daily",
    maxPerDay: 0,
    autoCall: true,
};

export function getDefaultQueueConfig(): QueueConfig {
    return { ...DEFAULT_CONFIG };
}

export function mergeQueueConfig(partial: Partial<QueueConfig>): QueueConfig {
    return { ...DEFAULT_CONFIG, ...partial };
}

export function formatQueueNumber(count: number, config: Pick<QueueConfig, "prefix" | "digits">): string {
    const padded = String(count).padStart(config.digits, "0");
    return `${config.prefix}${padded}`;
}

export function getQueueDateKey(unitType: string, date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `queue_counter_${unitType}_${yyyy}-${mm}-${dd}`;
}

export function validateQueueConfig(config: Partial<QueueConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.prefix !== undefined) {
        if (!config.prefix || config.prefix.length > 3) {
            errors.push("prefix must be 1-3 characters");
        }
    }

    if (config.digits !== undefined && config.digits < 1) {
        errors.push("digits must be at least 1");
    }

    if (config.resetPolicy !== undefined) {
        const validPolicies = ["daily", "manual", "never"];
        if (!validPolicies.includes(config.resetPolicy)) {
            errors.push(`resetPolicy must be one of: ${validPolicies.join(", ")}`);
        }
    }

    return { valid: errors.length === 0, errors };
}
