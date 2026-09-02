import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { throttler, context } = requestProps;

    const req = context.switchToHttp().getRequest();
    const url: string = req.originalUrl || req.url || '';

    // 1. Admin endpoints (/api/v1/admin/*) are authenticated operational endpoints;
    // do not throttle admin management calls with public limits.
    if (url.includes('/admin/')) {
      return true;
    }

    // 2. Named throttlers (e.g. otpRequest, orderCreate, productSuggestion, etc.)
    // are route-specific throttlers. In @nestjs/throttler v6, all named throttlers in
    // forRoot are evaluated globally unless the route explicitly skips them or unless
    // checked here. If a route did NOT declare a @Throttle({ [name]: ... }) for this
    // specific throttler name, skip it so tight limits (e.g. 3/min) don't lock out unrelated routes.
    if (throttler.name !== 'default') {
      const handler = context.getHandler();
      const classRef = context.getClass();
      const routeLimit = this.reflector.getAllAndOverride(
        `THROTTLER:LIMIT${throttler.name}`,
        [handler, classRef],
      );
      if (routeLimit === undefined) {
        return true;
      }
    }

    return super.handleRequest(requestProps);
  }
}
