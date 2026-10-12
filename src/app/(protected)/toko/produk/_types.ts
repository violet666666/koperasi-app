export interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    price: number;
    costPrice: number;
    stock: number;
    stockGdg: number;
    stockToko: number;
    unit: string;
    minStock: number;
    isActive?: boolean;
    imageUrl?: string | null;
    trackStock?: boolean;
}

export interface IngredientOption {
    id: number;
    name: string;
    unit: string;
    costPrice: number;
    stockGdg: number;
}

