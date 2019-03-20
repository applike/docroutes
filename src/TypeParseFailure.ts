import { stringify } from "circular-json";
import * as ts from "typescript";

export default class TypeParseFailure extends Error {
    public static withContext(error: Error, type: ts.Node, file: ts.SourceFile): TypeParseFailure {
        const result = new TypeParseFailure();
        const typeDesc = ts.createPrinter().printNode(
            ts.EmitHint.Unspecified,
            type,
            file,
        );
        if (error instanceof TypeParseFailure) {
            result.failureOn = error.failureOn;
            result.unknownError = error.unknownError;
            result.description = error.description;
            result.in = [...error.in, typeDesc];
            result.updateMessage();
            return result;
        }
        result.unknownError = error;
        result.description = error.message;
        result.in.push(typeDesc);
        result.updateMessage();
        return result;
    }
    public static badType(type: ts.Node, file: ts.SourceFile): TypeParseFailure {
        const result = new TypeParseFailure();
        result.failureOn = ts.createPrinter().printNode(
            ts.EmitHint.Unspecified,
            type,
            file,
        );
        result.description = "Bad type for Web API";
        result.updateMessage();
        return result;
    }
    public static unhandledType(type: ts.Node, file: ts.SourceFile): TypeParseFailure {
        const result = new TypeParseFailure();
        result.failureOn = stringify(type, undefined, 4) + ": " + ts.createPrinter().printNode(
            ts.EmitHint.Unspecified,
            type,
            file,
        );
        result.description = "Unhandled type";
        result.updateMessage();
        return result;
    }
    private failureOn: string | null;
    private unknownError: Error | null;
    private description: string | null;
    private in: string[];
    private constructor() {
        super();
        this.failureOn = null;
        this.unknownError = null;
        this.description = null;
        this.in = [];
    }
    public toString(): string {
        return this.message;
    }
    private updateMessage(): void {
        this.message = `${this.description}
    on ${this.failureOn || "null"}
    caused by ${this.unknownError || "null"}
    in ${this.in.join("\n       ")}`;
    }
}
