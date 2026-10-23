import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Db } from '../../../config/database.module';
import { DRIZZLE } from '../../../config/database.module';
import { users } from '../../../../drizzle/schema';
import { JwtAccessPayload } from '../auth.types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    config: ConfigService,
    @Inject(DRIZZLE) private readonly db: Db,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    // A suspended admin must stop working at once, not when the token expires.
    if (payload.role === 'admin') {
      const [row] = await this.db
        .select({ status: users.status, role: users.role })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!row || row.role !== 'admin' || row.status !== 'active') {
        throw new UnauthorizedException('This admin account is suspended or no longer exists');
      }
    }
    return payload;
  }
}
