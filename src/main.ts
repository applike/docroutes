import * as ts from "typescript";
import { printRouter } from "./printer";
import { IDocumented, IExportedRoute, IExportedRouteMethod, IExportedRouter, Type } from "./types";

function getIdentifierName(id: ts.Identifier | { unescapedText: string }): string {
    if ("unescapedText" in id && typeof id.unescapedText === "string") {
        return id.unescapedText;
    }
    if ("escapedText" in id && typeof id.escapedText === "string") {
        return id.escapedText;
    }
    throw new Error("Failed to get type from identifier " + JSON.stringify(id));
}

function getDocumentation(node: ts.Node): IDocumented {
    if (ts.isJSDoc(node)) {
        if (node.comment !== undefined) {
            return {
                documentation: node.comment,
            };
        }
    }
    if ("jsDoc" in node) {
        const { jsDoc } = node as { jsDoc: ts.Node[] };
        return jsDoc.map(getDocumentation).reduce((acc, doc) => {
            if (acc.documentation !== null && doc.documentation !== null) {
                return {
                    documentation: acc.documentation + doc.documentation,
                };
            }
            if (acc.documentation !== null) {
                return acc;
            }
            return doc;
        });
    }
    return {
        documentation: null,
    };
}

function getRouterBase(doc: IDocumented): string | null {
    if (doc.documentation === null) {
        return null;
    }
    const m = doc.documentation.match(/#ExportRoute\((".*")\)/);
    if (m === null || m[1] === undefined) {
        return null;
    }
    try {
        const s = JSON.parse(m[1]);
        if (typeof s === "string") {
            // strip the comment from the documentation
            doc.documentation = doc.documentation.replace(/#ExportRoute\(".*"\)/, "").trim();
            return s;
        }
        return null;
    } catch (error) {
        return null;
    }
}

interface IMethodCallInfo {
    authorization: IExportedRouteMethod["authorization"];
    body: IExportedRouteMethod["body"];
    params: IExportedRouteMethod["params"];
    query: IExportedRouteMethod["query"];
    responses: IExportedRouteMethod["responses"];
}

import { stringify } from "circular-json";

function parseType(type: ts.Node, name: string | null = null): Type {
    switch (type.kind) {
        case ts.SyntaxKind.BooleanKeyword:
            return {
                ...getDocumentation(type),
                booleans: "all",
                name,
            };
        case ts.SyntaxKind.NumberKeyword:
            return {
                ...getDocumentation(type),
                name,
                numbers: "all",
            };
        case ts.SyntaxKind.StringKeyword:
            return {
                ...getDocumentation(type),
                name,
                strings: "all",
            };
        case ts.SyntaxKind.ObjectKeyword:
            return {
                ...getDocumentation(type),
                name,
                objectMembers: {},
            };
        case ts.SyntaxKind.NullKeyword:
            return {
                ...getDocumentation(type),
                null: true,
            };
        case ts.SyntaxKind.UndefinedKeyword:
            return {
                ...getDocumentation(type),
                undefined: true,
            };
    }
    console.log(stringify(type, undefined, 4));
    return {
        undefined: true,
    };
}

function findMethodCallInfoOnMembers(members: ts.NodeArray<ts.TypeElement>): IMethodCallInfo {
    const result: IMethodCallInfo = {
        authorization: null,
        body: null,
        params: [],
        query: [],
        responses: [],
    };
    for (const member of members) {
        if (member.name === undefined || member.kind !== ts.SyntaxKind.PropertySignature) {
            continue;
        }
        const { type } = member as ts.PropertySignature;
        const nameString: string | null = getMemberName(member as ts.PropertySignature);
        if (nameString === null || type === undefined) {
            continue;
        }
        switch (nameString) {
            case "authorization":
                result.authorization = {
                    ...getDocumentation(member),
                    type: parseType(type),
                };
                break;
            case "body":
                result.body = {
                    ...getDocumentation(member),
                    type: parseType(type),
                };
                break;
            case "param":
                // TODO
                break;
            case "query":
                // TODO
                break;
            case "response":
                // TODO
                break;
            default:
                throw new Error(`Unknown method member ${nameString}`);
        }
    }
    return result;
}

function findMethodCallInfo(node: ts.Node): IMethodCallInfo {
    switch (node.kind) {
        case ts.SyntaxKind.TypeAliasDeclaration: {
            const { type, typeParameters } = node as ts.TypeAliasDeclaration;
            if (typeParameters !== undefined && typeParameters.length > 0) {
                throw new Error("Type parameters not implemented");
            }
            return findMethodCallInfo(type);
        }
        case ts.SyntaxKind.InterfaceDeclaration: {
            const { members, typeParameters } = node as ts.InterfaceDeclaration;
            if (typeParameters !== undefined && typeParameters.length > 0) {
                throw new Error("Type parameters not implemented");
            }
            return findMethodCallInfoOnMembers(members);
        }
        case ts.SyntaxKind.TypeLiteral: {
            const { members } = node as ts.TypeLiteralNode;
            return findMethodCallInfoOnMembers(members);
        }
        default:
            return {
                authorization: null,
                body: null,
                params: [],
                query: [],
                responses: [],
            };
    }
}

function methodFromNameString(s: string): IExportedRouteMethod["method"] {
    switch (s) {
        case "GET":
        case "HEAD":
        case "POST":
        case "PUT":
        case "DELETE":
        case "CONNECT":
        case "OPTIONS":
        case "TRACE":
            return s;
    }
    throw new Error(`Invalid HTTP method: ${s}`);
}

function findMethodsOnMembers(members: ts.NodeArray<ts.TypeElement>): IExportedRouteMethod[] {
    const result: IExportedRouteMethod[] = [];
    for (const member of members) {
        if (member.name === undefined || member.kind !== ts.SyntaxKind.PropertySignature) {
            continue;
        }
        const { type } = member as ts.PropertySignature;
        const nameString: string | null = getMemberName(member as ts.PropertySignature);
        if (nameString === null || type === undefined) {
            continue;
        }
        const {
            authorization,
            body,
            params,
            query,
            responses,
        } = findMethodCallInfo(type);
        result.push({
            ...getDocumentation(member),
            authorization,
            body,
            method: methodFromNameString(nameString),
            params,
            query,
            responses,
        });
    }
    return result;
}

function findMethods(node: ts.Node): IExportedRouteMethod[] {
    switch (node.kind) {
        case ts.SyntaxKind.TypeAliasDeclaration: {
            const { type, typeParameters } = node as ts.TypeAliasDeclaration;
            if (typeParameters !== undefined && typeParameters.length > 0) {
                throw new Error("Type parameters not implemented");
            }
            return findMethods(type);
        }
        case ts.SyntaxKind.InterfaceDeclaration: {
            const { members, typeParameters } = node as ts.InterfaceDeclaration;
            if (typeParameters !== undefined && typeParameters.length > 0) {
                throw new Error("Type parameters not implemented");
            }
            return findMethodsOnMembers(members);
        }
        case ts.SyntaxKind.TypeLiteral: {
            const { members } = node as ts.TypeLiteralNode;
            return findMethodsOnMembers(members);
        }
        default:
            return [];
    }
}

function getMemberName(member: ts.PropertySignature): string | null {
    const { name } = member as ts.PropertySignature;
    switch (name.kind) {
        case ts.SyntaxKind.Identifier:
            return getIdentifierName(name as ts.Identifier);
        case ts.SyntaxKind.StringLiteral:
            return (name as ts.StringLiteral).text;
        case ts.SyntaxKind.NumericLiteral:
            return (name as ts.NumericLiteral).text;
        case ts.SyntaxKind.ComputedPropertyName:
            throw new Error("Can not process a computed property name as route name");
    }
    return null;
}

function findRoutes(members: ts.NodeArray<ts.TypeElement>): IExportedRoute[] {
    const result: IExportedRoute[] = [];
    for (const member of members) {
        if (member.name === undefined || member.kind !== ts.SyntaxKind.PropertySignature) {
            continue;
        }
        const { type } = member as ts.PropertySignature;
        const nameString: string | null = getMemberName(member as ts.PropertySignature);
        if (nameString === null || type === undefined) {
            continue;
        }
        const methods: IExportedRouteMethod[] = findMethods(type);
        result.push({
            ...getDocumentation(member),
            methods,
            route: nameString,
        });
    }
    return result;
}

function processRouterNode(
    doc: IDocumented,
    base: string,
    parentName: string | null,
    node: ts.Node,
): IExportedRouter | null {
    switch (node.kind) {
        case ts.SyntaxKind.TypeAliasDeclaration: {
            const { name, type, typeParameters } = node as ts.TypeAliasDeclaration;
            if (typeParameters !== undefined && typeParameters.length > 0) {
                throw new Error("Type parameters not implemented");
            }
            return processRouterNode(doc, base, parentName !== null ? parentName : getIdentifierName(name), type);
        }
        case ts.SyntaxKind.InterfaceDeclaration: {
            const { name, members, typeParameters } = node as ts.InterfaceDeclaration;
            if (typeParameters !== undefined && typeParameters.length > 0) {
                throw new Error("Type parameters not implemented");
            }
            const routes: IExportedRoute[] = findRoutes(members);
            if (routes.length === 0) {
                // TODO: emit warning
                return null;
            }
            return {
                ...doc,
                name: parentName !== null ? parentName : getIdentifierName(name),
                routeBase: base,
                routes,
            };
        }
        case ts.SyntaxKind.TypeLiteral: {
            const { members } = node as ts.TypeLiteralNode;
            const routes: IExportedRoute[] = findRoutes(members);
            if (routes.length === 0) {
                // TODO: emit warning
                return null;
            }
            return {
                ...doc,
                name: parentName !== null ? parentName : base,
                routeBase: base,
                routes,
            };
        }
        default:
            return null;
    }
}

// tslint:disable no-console

function compile(fileNames: string[], options: ts.CompilerOptions): void {
    const program = ts.createProgram(fileNames, options);
    console.log(program);
    for (const fileName of fileNames) {
        const sourceFile = program.getSourceFile(fileName);
        if (sourceFile === undefined) {
            continue;
        }
        console.log(fileName, sourceFile);
        const routers: IExportedRouter[] = [];
        sourceFile.forEachChild((node: ts.Node) => {
            const doc = getDocumentation(node);
            const base = getRouterBase(doc);
            if (base === null) {
                return;
            }
            const router = processRouterNode(doc, base, null, node);
            if (router !== null) {
                routers.push(router);
            }
        });
        console.log(routers.map(printRouter).join("\n"));
    }

    const allDiagnostics = ts
        .getPreEmitDiagnostics(program);

    allDiagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
                diagnostic.start!,
            );
            const message = ts.flattenDiagnosticMessageText(
                diagnostic.messageText,
                "\n",
            );
            console.log(
                `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
            );
        } else {
            console.log(
                `${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
            );
        }
    });
}

compile(process.argv.slice(2), {
    module: ts.ModuleKind.CommonJS,
    noEmitOnError: true,
    noImplicitAny: true,
    target: ts.ScriptTarget.ES5,
});
