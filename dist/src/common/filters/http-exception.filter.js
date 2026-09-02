"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        if (!(exception instanceof common_1.HttpException)) {
            console.error('[HttpExceptionFilter] Unhandled exception:', exception);
        }
        let status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let body = exception instanceof common_1.HttpException ? exception.getResponse() : undefined;
        if (!(exception instanceof common_1.HttpException) && typeof exception === 'object' && exception !== null) {
            const anyErr = exception;
            const code = anyErr.code ?? anyErr.cause?.code;
            const detail = anyErr.detail ?? anyErr.cause?.detail;
            if (code === '23503') {
                status = common_1.HttpStatus.CONFLICT;
                body = {
                    error: 'Conflict',
                    message: detail || 'Cannot complete operation: this record is referenced by other items.',
                };
            }
            else if (code === '23505') {
                status = common_1.HttpStatus.CONFLICT;
                body = {
                    error: 'Conflict',
                    message: detail || 'A record with this unique information already exists.',
                };
            }
        }
        const { code, message, details } = normalize(status, body);
        response.status(status).json({ error: { code, message, details } });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
function normalize(status, body) {
    if (typeof body === 'object' && body !== null) {
        const b = body;
        const message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? 'Error');
        const code = typeof b.error === 'string' ? toCode(b.error) : toCode(String(status));
        return { code, message: String(message), details: {} };
    }
    if (typeof body === 'string') {
        return { code: toCode(String(status)), message: body, details: {} };
    }
    return { code: toCode(String(status)), message: 'Internal server error', details: {} };
}
function toCode(value) {
    return value
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}
//# sourceMappingURL=http-exception.filter.js.map