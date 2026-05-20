// Modifiers / Add-on System — Configurable product modifiers for POS
// Used by Resto and Cafe LSP for options like "Tingkat Pedas", "Tambah Protein", etc.

export interface ModifierOption {
    id: string;
    name: string;
    priceAdjust: number;
    isDefault: boolean;
    sortOrder: number;
}

export interface ModifierGroup {
    id: string;
    name: string;
    isRequired: boolean;
    multiSelect: boolean;
    options: ModifierOption[];
}

export interface ModifierGroupWithSelection extends ModifierGroup {
    selectedOptionIds: string[];
}

export interface ModifierConfig {
    groups: ModifierGroup[];
}

export function getDefaultModifierGroup(): ModifierGroup {
    return {
        id: `mg_${Date.now()}`,
        name: "New Modifier Group",
        isRequired: false,
        multiSelect: false,
        options: [],
    };
}

export function getDefaultModifierOption(): ModifierOption {
    return {
        id: `mo_${Date.now()}`,
        name: "New Option",
        priceAdjust: 0,
        isDefault: false,
        sortOrder: 0,
    };
}

export function validateModifierGroup(group: Partial<ModifierGroup>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!group.name || group.name.trim().length === 0) {
        errors.push("name is required");
    }

    if (!group.options || !Array.isArray(group.options) || group.options.length === 0) {
        errors.push("options must be a non-empty array");
    } else {
        const seenIds = new Set<string>();
        for (const opt of group.options) {
            if (seenIds.has(opt.id)) {
                errors.push(`duplicate option id: ${opt.id}`);
                break;
            }
            seenIds.add(opt.id);
        }
    }

    return { valid: errors.length === 0, errors };
}

export function calculateModifierPrice(groups: ModifierGroupWithSelection[]): number {
    let total = 0;
    for (const group of groups) {
        if (!group.selectedOptionIds || !group.options) continue;
        for (const optId of group.selectedOptionIds) {
            const opt = group.options.find(o => o.id === optId);
            if (opt) total += opt.priceAdjust;
        }
    }
    return total;
}

export function serializeModifierConfig(config: ModifierConfig): string {
    return JSON.stringify(config);
}

export function deserializeModifierConfig(json: string): ModifierConfig {
    try {
        const parsed = JSON.parse(json);
        if (!parsed.groups || !Array.isArray(parsed.groups)) {
            return { groups: [] };
        }
        return { groups: parsed.groups };
    } catch {
        return { groups: [] };
    }
}
