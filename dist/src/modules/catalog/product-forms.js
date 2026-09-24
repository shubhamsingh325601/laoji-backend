"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productFormFor = productFormFor;
exports.readProductAttributes = readProductAttributes;
const common_1 = require("@nestjs/common");
const COLUMN_KEYS = new Set(['name', 'brand', 'unit', 'size']);
const CATEGORY = { key: 'category', label: 'Category', type: 'category', required: true };
const GROCERY = {
    basic: [
        { key: 'name', label: 'Product name', type: 'text', required: true, placeholder: 'e.g. Amul Fresh Milk' },
        { key: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Amul (optional)' },
        CATEGORY,
        { key: 'unit', label: 'Unit', type: 'text', required: true, placeholder: 'e.g. 500g, 1L, 6 pcs' },
        { key: 'size', label: 'Size / variant', type: 'text', placeholder: 'optional' },
    ],
    details: [
        {
            key: 'foodType',
            label: 'Veg / Non-veg',
            type: 'select',
            options: ['Veg', 'Non-veg'],
            hint: 'Leave unselected for non-food items',
        },
    ],
    showMrp: true,
    categoryPlaceholder: 'e.g. Snacks, Pooja Items',
};
const FORMS = {
    grocery: GROCERY,
    general: GROCERY,
    vegetables_fruits: {
        basic: [
            { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Tomato' },
            CATEGORY,
            {
                key: 'unit',
                label: 'Sold per',
                type: 'select',
                required: true,
                options: ['1 kg', '500 g', '250 g', '1 dozen', '1 piece', '1 bunch'],
                defaultValue: '1 kg',
            },
        ],
        details: [{ key: 'organic', label: 'Organic', type: 'toggle', hint: 'Grown without chemical pesticides' }],
        showMrp: false,
        categoryPlaceholder: 'e.g. Leafy Vegetables, Seasonal Fruits',
    },
    medical: {
        basic: [
            { key: 'name', label: 'Medicine / product name', type: 'text', required: true, placeholder: 'e.g. Dolo 650 Tablet' },
            { key: 'brand', label: 'Manufacturer', type: 'text', placeholder: 'e.g. Micro Labs (optional)' },
            CATEGORY,
            { key: 'unit', label: 'Pack size', type: 'text', required: true, placeholder: 'e.g. Strip of 15, 100 ml bottle' },
            { key: 'size', label: 'Strength', type: 'text', placeholder: 'e.g. 650 mg' },
        ],
        details: [
            {
                key: 'dosageForm',
                label: 'Form',
                type: 'select',
                required: true,
                options: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream / Ointment', 'Drops', 'Powder', 'Device', 'Other'],
            },
            { key: 'composition', label: 'Composition / salt', type: 'text', placeholder: 'e.g. Paracetamol 650 mg' },
            {
                key: 'prescriptionRequired',
                label: 'Prescription required',
                type: 'toggle',
                hint: "Customer must show a doctor's prescription",
            },
        ],
        showMrp: true,
        categoryPlaceholder: 'e.g. Tablets, Syrups, First Aid',
    },
    clothing: {
        basic: [
            { key: 'name', label: 'Product name', type: 'text', required: true, placeholder: 'e.g. Cotton Round-neck T-shirt' },
            { key: 'brand', label: 'Brand', type: 'text', placeholder: "e.g. Levi's (optional)" },
            CATEGORY,
            { key: 'size', label: 'Size', type: 'text', required: true, placeholder: 'e.g. M, 32, UK 8, 4-5 Y' },
            {
                key: 'unit',
                label: 'Sold as',
                type: 'select',
                required: true,
                options: ['1 piece', '1 pair', 'Pack of 2', 'Pack of 3', 'Set'],
                defaultValue: '1 piece',
            },
        ],
        details: [
            { key: 'gender', label: 'For', type: 'select', required: true, options: ['Men', 'Women', 'Kids', 'Unisex'] },
            { key: 'color', label: 'Colour', type: 'text', placeholder: 'e.g. Navy blue' },
            { key: 'material', label: 'Material / fabric', type: 'text', placeholder: 'e.g. 100% cotton' },
        ],
        showMrp: true,
        categoryPlaceholder: 'e.g. T-Shirts, Sarees, Kids Wear',
    },
    stationery: {
        basic: [
            { key: 'name', label: 'Product name', type: 'text', required: true, placeholder: 'e.g. Classmate Long Notebook' },
            { key: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Classmate (optional)' },
            CATEGORY,
            { key: 'unit', label: 'Pack size', type: 'text', required: true, placeholder: 'e.g. 1 pc, Pack of 10' },
            { key: 'size', label: 'Size / specification', type: 'text', placeholder: 'e.g. A4, 172 pages' },
        ],
        details: [],
        showMrp: true,
        categoryPlaceholder: 'e.g. Notebooks, Pens, Art Supplies',
    },
    electronics: {
        basic: [
            { key: 'name', label: 'Product name', type: 'text', required: true, placeholder: 'e.g. boAt Airdopes 141' },
            { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g. boAt' },
            CATEGORY,
            { key: 'size', label: 'Colour / variant', type: 'text', placeholder: 'e.g. Black, 128 GB' },
            {
                key: 'unit',
                label: 'Sold as',
                type: 'select',
                required: true,
                options: ['1 piece', '1 pair', 'Pack of 2', 'Set'],
                defaultValue: '1 piece',
            },
        ],
        details: [
            { key: 'model', label: 'Model number', type: 'text', placeholder: 'e.g. Airdopes 141' },
            { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number', placeholder: 'e.g. 12' },
        ],
        showMrp: true,
        categoryPlaceholder: 'e.g. Mobile Accessories, Chargers',
    },
};
function productFormFor(businessType) {
    if (businessType === 'restaurant') {
        throw new common_1.BadRequestException('Restaurants add menu items instead of products');
    }
    return { businessType, ...(FORMS[businessType] ?? GROCERY) };
}
function readProductAttributes(form, product) {
    const columns = product;
    const attributes = {};
    for (const field of [...form.basic, ...form.details]) {
        if (field.type === 'category')
            continue;
        const raw = COLUMN_KEYS.has(field.key) ? columns[field.key] : product.attributes[field.key];
        const value = typeof raw === 'string' ? raw.trim() : raw;
        if (value === undefined || value === null || value === '') {
            if (field.required)
                throw new common_1.BadRequestException(`${field.label} is required`);
            continue;
        }
        if (!isValidValue(field, value))
            throw new common_1.BadRequestException(`${field.label} has an invalid value`);
        if (!COLUMN_KEYS.has(field.key))
            attributes[field.key] = value;
    }
    return attributes;
}
function isValidValue(field, value) {
    switch (field.type) {
        case 'text':
            return typeof value === 'string' && value.length <= 200;
        case 'number':
            return typeof value === 'number' && Number.isFinite(value) && value >= 0;
        case 'select':
            return typeof value === 'string' && (field.options ?? []).includes(value);
        case 'toggle':
            return typeof value === 'boolean';
        default:
            return false;
    }
}
//# sourceMappingURL=product-forms.js.map