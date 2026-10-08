import bunyan from 'bunyan';
import type { Express } from "express";
declare global {
    namespace NodeJS {
        interface Process {
            log: bunyan;
        }
    }
}
export declare const log: bunyan;
declare const app: Express;
export default app;
//# sourceMappingURL=app.d.ts.map