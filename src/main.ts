import { stringify } from "circular-json";
import * as ts from "typescript";
import { printMarkdown, printRouter } from "./printer";
import { IDocumented, IExportedRoute, IExportedRouteMethod, IExportedRouter, IObjectType, Type } from "./types";

// tslint:disable no-console member-ordering

interface IMethodCallInfo {
    authorization: IExportedRouteMethod["authorization"];
    body: IExportedRouteMethod["body"];
    params: IExportedRouteMethod["params"];
    query: IExportedRouteMethod["query"];
    responses: IExportedRouteMethod["responses"];
}

interface IImportMap {
    [importingModule: string]: {
        [importedAs: string]: [string, string]; // module + name of the imported identifier
    };
}
class RoutesFrontend {
    public static getIdentifierName(id: ts.Identifier | { unescapedText: string }): string {
        if ("unescapedText" in id && typeof id.unescapedText === "string") {
            return id.unescapedText;
        }
        if ("text" in id && typeof id.text === "string") {
            return id.text;
        }
        if ("escapedText" in id && typeof id.escapedText === "string") {
            return id.escapedText;
        }
        throw new Error("Failed to get type from identifier " + JSON.stringify(id));
    }
    public static showEntityName(entity: ts.EntityName): string {
        if (entity.kind === ts.SyntaxKind.Identifier) {
            const i = entity as ts.Identifier;
            return RoutesFrontend.getIdentifierName(i);
        }
        const q = entity as ts.QualifiedName;
        const left = RoutesFrontend.showEntityName(q.left);
        return `${left}.${RoutesFrontend.getIdentifierName(q.right)}`;
    }

    private static mergeDocumentation(acc: IDocumented, doc: IDocumented): IDocumented {
        if (acc.documentation !== null && doc.documentation !== null) {
            return {
                documentation: acc.documentation + doc.documentation,
            };
        }
        if (acc.documentation !== null) {
            return acc;
        }
        return doc;
    }

    public static getDocumentation(node: ts.Node): IDocumented {
        if (ts.isJSDoc(node)) {
            if (node.comment !== undefined) {
                return {
                    documentation: node.comment,
                };
            }
        }
        if ("jsDoc" in node) {
            const { jsDoc } = node as { jsDoc: ts.Node[] };
            return jsDoc.map(RoutesFrontend.getDocumentation).reduce(RoutesFrontend.mergeDocumentation);
        }
        return {
            documentation: null,
        };
    }

    public static getRouterBase(doc: IDocumented): string | null {
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

    private readonly program: ts.Program;
    private currentModule: string | null;
    private imports: IImportMap;
    public constructor(program: ts.Program) {
        this.program = program;
        this.currentModule = null;
        this.imports = {};
        this.prepareImports();
    }

    private prepareImports() {
        for (const sourceFile of this.program.getSourceFiles()) {
            if (sourceFile === undefined) {
                continue;
            }
            const resolvedImports = getResolvedModules(sourceFile);
            sourceFile.forEachChild((node: ts.Node) => {
                if (node.kind === ts.SyntaxKind.ImportDeclaration) {
                    const importDecl = node as ts.ImportDeclaration;
                    const { importClause, moduleSpecifier } = importDecl;
                    if (importClause === undefined || importClause.namedBindings === undefined) {
                        return;
                    }
                    const importName = parseModuleSpecifier(moduleSpecifier);
                    if (resolvedImports[importName] === undefined) {
                        throw new Error(`Failed to resolve import of ${importName} in ${sourceFile.fileName}`);
                    }
                    const { namedBindings } = importClause;
                    switch (namedBindings.kind) {
                        case ts.SyntaxKind.NamedImports: {
                            const namedImports = namedBindings as ts.NamedImports;
                            for (const namedImport of namedImports.elements) {
                                const importAs = RoutesFrontend.getIdentifierName(namedImport.name);
                                const importedName = namedImport.propertyName === undefined
                                    ? importAs
                                    : RoutesFrontend.getIdentifierName(namedImport.propertyName);
                                this.addImport(
                                    getSourceFilePath(sourceFile),
                                    resolvedImports[importName],
                                    importAs,
                                    importedName,
                                );
                            }
                            break;
                        }
                        case ts.SyntaxKind.NamespaceImport: {
                            const namespaceImport = namedBindings as ts.NamespaceImport;
                            const namespace = RoutesFrontend.getIdentifierName(namespaceImport.name);
                            this.addImport(
                                getSourceFilePath(sourceFile),
                                resolvedImports[importName],
                                namespace,
                                namespace,
                            );
                            break;
                        }
                        default:
                            return;
                    }
                }
            });
        }
    }

    public addImport(importingModule: string, importedModule: string, importedAs: string, originalName: string) {
        if (this.imports[importingModule] === undefined) {
            this.imports[importingModule] = {};
        }
        this.imports[importingModule][importedAs] = [importedModule, originalName];
    }

    public setCurrentModule(moduleName: string | null) {
        this.currentModule = moduleName;
    }

    private lookupNode(moduleName: string, nodeName: string): [string, ts.Node] | null {
        const path: ts.Path = moduleName as ts.Path;
        const sourceFile: ts.SourceFile | undefined = this.program.getSourceFileByPath(path);
        if (sourceFile === undefined) {
            return null;
        }
        for (const stmt of sourceFile.statements) {
            switch (stmt.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    const decl = stmt as ts.Node as ts.VariableDeclaration;
                    if (decl.name.kind === ts.SyntaxKind.Identifier &&
                        RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
                case ts.SyntaxKind.VariableDeclarationList: {
                    const decls = stmt as ts.Node as ts.VariableDeclarationList;
                    for (const decl of decls.declarations) {
                        if (decl.name.kind === ts.SyntaxKind.Identifier &&
                            RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                            return [moduleName, decl];
                        }
                    }
                    break;
                }
                case ts.SyntaxKind.FunctionDeclaration: {
                    const decl = stmt as ts.FunctionDeclaration;
                    if (decl.name !== undefined && RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
                case ts.SyntaxKind.ClassDeclaration: {
                    const decl = stmt as ts.ClassDeclaration;
                    if (decl.name !== undefined && RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
                case ts.SyntaxKind.InterfaceDeclaration: {
                    const decl = stmt as ts.InterfaceDeclaration;
                    if (RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
                case ts.SyntaxKind.TypeAliasDeclaration: {
                    const decl = stmt as ts.TypeAliasDeclaration;
                    if (RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
                case ts.SyntaxKind.EnumDeclaration: {
                    const decl = stmt as ts.EnumDeclaration;
                    if (RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
                case ts.SyntaxKind.NamespaceExportDeclaration: {
                    const decl = stmt as ts.NamespaceExportDeclaration;
                    if (RoutesFrontend.getIdentifierName(decl.name) === nodeName) {
                        return [moduleName, decl];
                    }
                    break;
                }
            }
        }
        return null;
    }

    public lookupIdentifierInCurrentModule(identifier: string): [string, ts.Node] | null {
        if (this.currentModule === null) {
            return null;
        }
        return this.lookupNode(this.currentModule, identifier);
    }

    public lookupIdentifier(identifier: string): [string, ts.Node] | null {
        if (this.currentModule === null) {
            return null;
        }
        if (this.imports[this.currentModule] === undefined) {
            return this.lookupIdentifierInCurrentModule(identifier);
        }
        if (this.imports[this.currentModule][identifier] === undefined) {
            return this.lookupIdentifierInCurrentModule(identifier);
        }
        const [targetModule, targetName] = this.imports[this.currentModule][identifier];
        return this.lookupNode(targetModule, targetName);
    }

    public lookupEntity(entity: ts.EntityName): [string, ts.Node] | null {
        if (entity.kind === ts.SyntaxKind.Identifier) {
            const i = entity as ts.Identifier;
            return this.lookupIdentifier(RoutesFrontend.getIdentifierName(i));
        }
        const q = entity as ts.QualifiedName;
        const left = this.lookupEntity(q.left);
        if (left === null) {
            return null;
        }
        const [newModule, baseType] = left;
        const rightName = RoutesFrontend.getIdentifierName(q.right);
        switch (baseType.kind) {
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeLiteral: {
                const { members } = baseType as ts.InterfaceDeclaration | ts.TypeLiteralNode;
                for (const member of members) {
                    if (member.name !== undefined &&
                        member.kind === ts.SyntaxKind.PropertySignature &&
                        RoutesFrontend.getMemberName(member as ts.PropertySignature) === rightName) {
                        return [newModule, member];
                    }
                }
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                const { properties } = baseType as ts.ObjectLiteralExpression;
                for (const property of properties) {
                    switch (property.kind) {
                        case ts.SyntaxKind.PropertyAssignment: {
                            if (RoutesFrontend.getMemberName(property as ts.PropertyAssignment) === rightName) {
                                return [newModule, property];
                            }
                            break;
                        }
                        case ts.SyntaxKind.ShorthandPropertyAssignment: {
                            if (RoutesFrontend.getMemberName(
                                    property as ts.ShorthandPropertyAssignment,
                                ) === rightName) {
                                return [newModule, property];
                            }
                            break;
                        }
                        case ts.SyntaxKind.MethodDeclaration: {
                            if (RoutesFrontend.getMemberName(property as ts.MethodDeclaration) === rightName) {
                                return [newModule, property];
                            }
                            break;
                        }
                        case ts.SyntaxKind.GetAccessor:
                        case ts.SyntaxKind.SetAccessor: {
                            if (RoutesFrontend.getMemberName(property as ts.AccessorDeclaration) === rightName) {
                                return [newModule, property];
                            }
                            break;
                        }
                    }
                }
                break;
            }
        }
        return null;
    }

    private parseType(type: ts.Node, name: string | null = null): Type {
        switch (type.kind) {
            case ts.SyntaxKind.BooleanKeyword:
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    booleans: "all",
                    name,
                };
            case ts.SyntaxKind.NumberKeyword:
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    numbers: "all",
                };
            case ts.SyntaxKind.StringKeyword:
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    strings: "all",
                };
            case ts.SyntaxKind.ObjectKeyword:
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    objectMembers: {},
                };
            case ts.SyntaxKind.NullKeyword:
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    null: true,
                };
            case ts.SyntaxKind.UndefinedKeyword:
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    undefined: true,
                };
            case ts.SyntaxKind.ArrayType: {
                const array = type as ts.ArrayTypeNode;
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    arrayMembers: this.parseType(array.elementType, null),
                    name,
                };
            }
            case ts.SyntaxKind.TupleType: {
                const tuple = type as ts.TupleTypeNode;
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    tupleMembers: tuple.elementTypes.map((member) =>
                        this.parseType(member, null),
                    ),
                };
            }
            case ts.SyntaxKind.TypeReference: {
                const ref = type as ts.TypeReferenceNode;
                const r = this.lookupEntity(ref.typeName);
                if (r === null) {
                    return {
                        ...RoutesFrontend.getDocumentation(type),
                        name: RoutesFrontend.showEntityName(ref.typeName),
                        objectMembers: {},
                    };
                }
                const oldModule = this.currentModule;
                const [newModule, newType] = r;
                this.setCurrentModule(newModule);
                const result = this.parseType(
                    newType,
                    name === null ? RoutesFrontend.showEntityName(ref.typeName) : name,
                );
                this.setCurrentModule(oldModule);
                return result;
            }
            case ts.SyntaxKind.ExpressionWithTypeArguments: {
                const ex = type as ts.ExpressionWithTypeArguments;
                const identifier = RoutesFrontend.getIdentifierName(ex.expression as any);
                const r = this.lookupIdentifier(identifier);
                if (r !== null) {
                    const oldModule = this.currentModule;
                    const [newModule, newType] = r;
                    this.setCurrentModule(newModule);
                    const result = this.parseType(
                        newType,
                        name === null ? identifier : name,
                    );
                    this.setCurrentModule(oldModule);
                    return result;
                }
                break;
            }
            case ts.SyntaxKind.InterfaceDeclaration: {
                let objectMembers: IObjectType["objectMembers"] = {};
                const { heritageClauses, members } = type as ts.InterfaceDeclaration;
                for (const member of members) {
                    if (member.name === undefined || member.kind !== ts.SyntaxKind.PropertySignature) {
                        continue;
                    }
                    const { type: memberType } = member as ts.PropertySignature;
                    const nameString: string | null = RoutesFrontend.getMemberName(member as ts.PropertySignature);
                    if (nameString === null || type === undefined) {
                        continue;
                    }
                    objectMembers[nameString] = this.parseType(memberType as ts.Node, null);
                }
                if (heritageClauses !== undefined) {
                    for (const heritageClause of heritageClauses) {
                        for (const parentType of heritageClause.types) {
                            const parsedType = this.parseType(parentType, null);
                            if ("objectMembers" in parsedType) {
                                objectMembers = {
                                    ...objectMembers,
                                    ...parsedType.objectMembers,
                                };
                            }
                        }
                    }
                }
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    objectMembers,
                };
            }
            case ts.SyntaxKind.EnumDeclaration: {
                const union: Type[] = [];
                const { members } = type as ts.EnumDeclaration;
                let memberCounter = 0;
                for (const member of members) {
                    if (member.initializer !== undefined) {
                        switch (member.initializer.kind) {
                            case ts.SyntaxKind.NumericLiteral:
                                union.push({
                                    ...RoutesFrontend.getDocumentation(member),
                                    name: null,
                                    numbers: [parseInt((member.initializer as ts.NumericLiteral).text, 10)],
                                });
                                break;
                            case ts.SyntaxKind.StringLiteral:
                                union.push({
                                    ...RoutesFrontend.getDocumentation(member),
                                    name: null,
                                    strings: [(member.initializer as ts.StringLiteral).text],
                                });
                                break;
                            default:
                                throw new Error("Unknown enum member kind");
                        }
                    } else {
                        union.push({
                            ...RoutesFrontend.getDocumentation(member),
                            name: null,
                            numbers: [memberCounter],
                        });
                    }
                    memberCounter++;
                }
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    union,
                };
            }
            case ts.SyntaxKind.UnionType: {
                const union = type as ts.UnionTypeNode;
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    name,
                    union: union.types.map((subType) => this.parseType(subType, null)),
                };
            }
            case ts.SyntaxKind.IntersectionType: {
                const intersection = type as ts.IntersectionTypeNode;
                return {
                    ...RoutesFrontend.getDocumentation(type),
                    intersection: intersection.types.map((subType) => this.parseType(subType, null)),
                    name,
                };
            }
            case ts.SyntaxKind.TypeAliasDeclaration: {
                const { name: aliasName, type: nextType, typeParameters } = type as ts.TypeAliasDeclaration;
                if (typeParameters !== undefined && typeParameters.length > 0) {
                    throw new Error("Type parameters not implemented");
                }
                return this.parseType(nextType, name !== null ? name : RoutesFrontend.getIdentifierName(aliasName));
            }
        }
        throw new Error(`Unhandled type ${stringify(type, undefined, 4)}`);
    }

    private findMethodCallInfoOnMembers(members: ts.NodeArray<ts.TypeElement>): IMethodCallInfo {
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
            const nameString: string | null = RoutesFrontend.getMemberName(member as ts.PropertySignature);
            if (nameString === null || type === undefined) {
                continue;
            }
            switch (nameString) {
                case "authorization":
                    result.authorization = {
                        ...RoutesFrontend.getDocumentation(member),
                        type: this.parseType(type),
                    };
                    break;
                case "body":
                    result.body = {
                        ...RoutesFrontend.getDocumentation(member),
                        type: this.parseType(type),
                    };
                    break;
                case "param": {
                    const params: IExportedRouteMethod["params"] = [];
                    if (type.kind === ts.SyntaxKind.TypeLiteral) {
                        const { members: paramMembers } = type as ts.TypeLiteralNode;
                        for (const paramMember of paramMembers) {
                            if (paramMember.name === undefined ||
                                paramMember.kind !== ts.SyntaxKind.PropertySignature) {
                                continue;
                            }
                            const { type: paramType } = paramMember as ts.PropertySignature;
                            const paramName: string | null = RoutesFrontend.getMemberName(
                                paramMember as ts.PropertySignature,
                            );
                            if (paramName === null || paramType === undefined) {
                                continue;
                            }
                            params.push({
                                ...RoutesFrontend.getDocumentation(paramMember),
                                name: paramName,
                                type: this.parseType(paramType),
                            });
                        }
                    }
                    result.params = params;
                    break;
                }
                case "query": {
                    const query: IExportedRouteMethod["query"] = [];
                    if (type.kind === ts.SyntaxKind.TypeLiteral) {
                        const { members: queryMembers } = type as ts.TypeLiteralNode;
                        for (const queryMember of queryMembers) {
                            if (queryMember.name === undefined ||
                                queryMember.kind !== ts.SyntaxKind.PropertySignature) {
                                continue;
                            }
                            const { type: queryType, questionToken } = queryMember as ts.PropertySignature;
                            const queryName: string | null = RoutesFrontend.getMemberName(
                                queryMember as ts.PropertySignature,
                            );
                            if (queryName === null || queryType === undefined) {
                                continue;
                            }
                            query.push({
                                ...RoutesFrontend.getDocumentation(queryMember),
                                name: queryName,
                                required: questionToken === undefined,
                                type: this.parseType(queryType),
                            });
                        }
                    }
                    result.query = query;
                    break;
                }
                case "response": {
                    const responses: IExportedRouteMethod["responses"] = [];
                    if (type.kind === ts.SyntaxKind.TypeLiteral) {
                        const { members: responseMembers } = type as ts.TypeLiteralNode;
                        for (const responseMember of responseMembers) {
                            if (responseMember.name === undefined ||
                                responseMember.kind !== ts.SyntaxKind.PropertySignature) {
                                continue;
                            }
                            const { type: responseType } = responseMember as ts.PropertySignature;
                            const responseCode: string | null = RoutesFrontend.getMemberName(
                                responseMember as ts.PropertySignature,
                            );
                            const responseCodeNumber = Number.parseInt(responseCode || "", 10);
                            if (responseCode === null ||
                                Number.isNaN(responseCodeNumber) ||
                                responseType === undefined) {
                                continue;
                            }
                            responses.push({
                                ...RoutesFrontend.getDocumentation(responseMember),
                                body: responseType.kind === ts.SyntaxKind.UndefinedKeyword
                                    ? null
                                    : this.parseType(responseType),
                                status: responseCodeNumber,
                            });
                        }
                    }
                    result.responses = responses;
                    break;
                }
                default:
                    throw new Error(`Unknown method member ${nameString}`);
            }
        }
        return result;
    }

    private findMethodCallInfo(node: ts.Node): IMethodCallInfo {
        switch (node.kind) {
            case ts.SyntaxKind.TypeAliasDeclaration: {
                const { type, typeParameters } = node as ts.TypeAliasDeclaration;
                if (typeParameters !== undefined && typeParameters.length > 0) {
                    throw new Error("Type parameters not implemented");
                }
                return this.findMethodCallInfo(type);
            }
            case ts.SyntaxKind.InterfaceDeclaration: {
                const { members, typeParameters } = node as ts.InterfaceDeclaration;
                if (typeParameters !== undefined && typeParameters.length > 0) {
                    throw new Error("Type parameters not implemented");
                }
                return this.findMethodCallInfoOnMembers(members);
            }
            case ts.SyntaxKind.TypeLiteral: {
                const { members } = node as ts.TypeLiteralNode;
                return this.findMethodCallInfoOnMembers(members);
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

    private methodFromNameString(s: string): IExportedRouteMethod["method"] {
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

    private findMethodsOnMembers(members: ts.NodeArray<ts.TypeElement>): IExportedRouteMethod[] {
        const result: IExportedRouteMethod[] = [];
        for (const member of members) {
            if (member.name === undefined || member.kind !== ts.SyntaxKind.PropertySignature) {
                continue;
            }
            const { type } = member as ts.PropertySignature;
            const nameString: string | null = RoutesFrontend.getMemberName(member as ts.PropertySignature);
            if (nameString === null || type === undefined) {
                continue;
            }
            const {
                authorization,
                body,
                params,
                query,
                responses,
            } = this.findMethodCallInfo(type);
            result.push({
                ...RoutesFrontend.getDocumentation(member),
                authorization,
                body,
                method: this.methodFromNameString(nameString),
                params,
                query,
                responses,
            });
        }
        return result;
    }

    private findMethods(node: ts.Node): IExportedRouteMethod[] {
        switch (node.kind) {
            case ts.SyntaxKind.TypeAliasDeclaration: {
                const { type, typeParameters } = node as ts.TypeAliasDeclaration;
                if (typeParameters !== undefined && typeParameters.length > 0) {
                    throw new Error("Type parameters not implemented");
                }
                return this.findMethods(type);
            }
            case ts.SyntaxKind.InterfaceDeclaration: {
                const { members, typeParameters } = node as ts.InterfaceDeclaration;
                if (typeParameters !== undefined && typeParameters.length > 0) {
                    throw new Error("Type parameters not implemented");
                }
                return this.findMethodsOnMembers(members);
            }
            case ts.SyntaxKind.TypeLiteral: {
                const { members } = node as ts.TypeLiteralNode;
                return this.findMethodsOnMembers(members);
            }
            default:
                return [];
        }
    }

    private static getMemberName(member: { name: ts.PropertyName }): string | null {
        const { name } = member;
        switch (name.kind) {
            case ts.SyntaxKind.Identifier:
                return RoutesFrontend.getIdentifierName(name as ts.Identifier);
            case ts.SyntaxKind.StringLiteral:
                return (name as ts.StringLiteral).text;
            case ts.SyntaxKind.NumericLiteral:
                return (name as ts.NumericLiteral).text;
            case ts.SyntaxKind.ComputedPropertyName:
                throw new Error("Can not process a computed property name as route name");
        }
        return null;
    }

    private findRoutes(members: ts.NodeArray<ts.TypeElement>): IExportedRoute[] {
        const result: IExportedRoute[] = [];
        for (const member of members) {
            if (member.name === undefined || member.kind !== ts.SyntaxKind.PropertySignature) {
                continue;
            }
            const { type } = member as ts.PropertySignature;
            const nameString: string | null = RoutesFrontend.getMemberName(member as ts.PropertySignature);
            if (nameString === null || type === undefined) {
                continue;
            }
            const methods: IExportedRouteMethod[] = this.findMethods(type);
            result.push({
                ...RoutesFrontend.getDocumentation(member),
                methods,
                route: nameString,
            });
        }
        return result;
    }

    public processRouterNode(
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
                return this.processRouterNode(doc, base, parentName !== null
                    ? parentName
                    : RoutesFrontend.getIdentifierName(name), type);
            }
            case ts.SyntaxKind.InterfaceDeclaration: {
                const { name, members, typeParameters } = node as ts.InterfaceDeclaration;
                if (typeParameters !== undefined && typeParameters.length > 0) {
                    throw new Error("Type parameters not implemented");
                }
                const routes: IExportedRoute[] = this.findRoutes(members);
                if (routes.length === 0) {
                    return null;
                }
                return {
                    ...doc,
                    name: parentName !== null ? parentName : RoutesFrontend.getIdentifierName(name),
                    routeBase: base,
                    routes,
                };
            }
            case ts.SyntaxKind.TypeLiteral: {
                const { members } = node as ts.TypeLiteralNode;
                const routes: IExportedRoute[] = this.findRoutes(members);
                if (routes.length === 0) {
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
}

function getSourceFilePath(file: ts.SourceFile | { fileName: string, resolvedPath?: string, path?: string }): string {
    if ("resolvedPath" in file && typeof file.resolvedPath === "string") {
        return file.resolvedPath;
    }
    if ("path" in file && typeof file.path === "string") {
        return file.path;
    }
    return file.fileName;
}

interface IImportMapEntry {
    resolvedFileName: string;
}

function getResolvedModules(
    file: ts.SourceFile | { resolvedModules?: Map<string, IImportMapEntry> },
): { [importName: string]: string } {
    const result: { [importName: string]: string } = {};
    if ("resolvedModules" in file && file.resolvedModules instanceof Map) {
        const resolvedModules: Map<string, IImportMapEntry | undefined> = file.resolvedModules;
        resolvedModules.forEach((targetModule, importName) => {
            if (targetModule !== undefined) {
                result[importName] = targetModule.resolvedFileName;
            }
        });
    }
    return result;
}

function parseModuleSpecifier(s: ts.Expression): string {
    if (s.kind === ts.SyntaxKind.StringLiteral) {
        const l = s as ts.StringLiteral;
        return l.text;
    }
    throw new Error(`Invalid module specifier kind ${s.kind}`);
}

function compile(fileNames: string[], options: ts.CompilerOptions): void {
    const program = ts.createProgram(fileNames, options);
    const frontend = new RoutesFrontend(program);
    const routers: IExportedRouter[] = [];
    for (const fileName of fileNames) {
        const sourceFile = program.getSourceFile(fileName);
        if (sourceFile === undefined) {
            continue;
        }
        frontend.setCurrentModule(getSourceFilePath(sourceFile));
        sourceFile.forEachChild((node: ts.Node) => {
            const doc = RoutesFrontend.getDocumentation(node);
            const base = RoutesFrontend.getRouterBase(doc);
            if (base === null) {
                return;
            }
            const router = frontend.processRouterNode(doc, base, null, node);
            if (router !== null) {
                routers.push(router);
            }
        });
    }
    console.log(routers.map(printRouter).join("\n"));
    console.log(routers.map(printMarkdown).join("\n"));
    ts.sys.writeFile("./example.md", routers.map(printMarkdown).join("\n"));

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
