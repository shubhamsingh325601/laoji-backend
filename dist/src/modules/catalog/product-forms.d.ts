export type ProductFormFieldType = 'text' | 'number' | 'select' | 'toggle' | 'category';
export interface ProductFormField {
    key: string;
    label: string;
    type: ProductFormFieldType;
    required?: boolean;
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
    hint?: string;
}
export interface ProductForm {
    businessType: string;
    basic: ProductFormField[];
    details: ProductFormField[];
    showMrp: boolean;
    categoryPlaceholder: string;
}
export declare function productFormFor(businessType: string): ProductForm;
export declare function readProductAttributes(form: ProductForm, product: {
    name: string;
    brand?: string;
    unit: string;
    size?: string;
    attributes: Record<string, unknown>;
}): Record<string, string | number | boolean>;
