"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownCopiesByTemplate = ownCopiesByTemplate;
exports.shopCategoryId = shopCategoryId;
exports.laojiCategoryId = laojiCategoryId;
exports.normalizeAttributes = normalizeAttributes;
exports.productDetailChanges = productDetailChanges;
const common_1 = require("@nestjs/common");
function ownCopiesByTemplate(categories, vendorId) {
    const copies = new Map();
    for (const c of categories) {
        if (c.ownerVendorId === vendorId && c.templateCategoryId)
            copies.set(c.templateCategoryId, c);
    }
    return copies;
}
function shopCategoryId(categoryId, copies) {
    return copies.get(categoryId)?.id ?? categoryId;
}
function laojiCategoryId(categoryId, byId) {
    const category = byId.get(categoryId);
    return category?.ownerVendorId && category.templateCategoryId ? category.templateCategoryId : categoryId;
}
function normalizeAttributes(attributes) {
    if (!attributes)
        return null;
    const entries = Object.entries(attributes)
        .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
        .sort(([a], [b]) => a.localeCompare(b));
    return entries.length > 0 ? Object.fromEntries(entries) : null;
}
const optionalText = (value) => (value ?? '').trim() || null;
function productDetailChanges(product, input, sameCategory) {
    const changes = {};
    if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name)
            throw new common_1.BadRequestException('Product name is required');
        if (name !== product.name.trim())
            changes.name = name;
    }
    if (input.unit !== undefined) {
        const unit = input.unit.trim();
        if (!unit)
            throw new common_1.BadRequestException('Unit is required');
        if (unit !== product.unit.trim())
            changes.unit = unit;
    }
    for (const key of ['brand', 'size', 'imageUrl', 'description']) {
        if (input[key] === undefined)
            continue;
        const value = optionalText(input[key]);
        if (value !== optionalText(product[key]))
            changes[key] = value;
    }
    if (input.mrp !== undefined && (input.mrp ?? null) !== product.mrp)
        changes.mrp = input.mrp ?? null;
    if (input.categoryId !== undefined && !sameCategory(input.categoryId))
        changes.categoryId = input.categoryId;
    if (input.attributes !== undefined) {
        const attributes = normalizeAttributes(input.attributes);
        if (JSON.stringify(attributes) !== JSON.stringify(normalizeAttributes(product.attributes))) {
            changes.attributes = attributes;
        }
    }
    return changes;
}
//# sourceMappingURL=catalog-ownership.js.map