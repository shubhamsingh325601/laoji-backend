import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { JwtAccessPayload } from '../auth.types';
declare const JwtAccessStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtAccessStrategy extends JwtAccessStrategy_base {
    constructor(config: ConfigService);
    validate(payload: JwtAccessPayload): JwtAccessPayload;
}
export {};
