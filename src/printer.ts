import { IExportedRouter } from "./types";

export function printRouter(router: IExportedRouter): string {
    return JSON.stringify(router, undefined, 4);
}
