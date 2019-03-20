export interface IDocumented {
    documentation: string | null;
}

export interface INamedType extends IDocumented {
    name: string | null;
}

export interface INumberType extends INamedType {
    numbers: "all" | number[];
}

export interface IBooleanType extends INamedType {
    booleans: "all" | boolean[];
}

export interface IStringType extends INamedType {
    strings: "all" | string[];
}

export interface IEnumType extends IDocumented {
    // TODO: keep this? we currently don't generate it!
    name: string;
    enumValues: {
        [name: string]: string;
    };
}

export interface IArrayType extends INamedType {
    arrayMembers: Type;
}

export interface ITupleType extends INamedType {
    tupleMembers: Type[];
}

export interface IObjectType extends INamedType {
    objectMembers: {
        [name: string]: Type;
    };
}

export interface INullType {
    null: true;
}

export interface IUndefinedType {
    undefined: true;
}

export interface IUnionType extends INamedType {
    union: Type[];
}

export interface IIntersectionType extends INamedType {
    intersection: Type[];
}

export type Type = INumberType
    | IBooleanType
    | IStringType
    | IEnumType
    | IArrayType
    | ITupleType
    | IObjectType
    | INullType
    | IUndefinedType
    | IUnionType
    | IIntersectionType;

export interface IAuthroization extends IDocumented {
    type: Type;
}

export interface IBody extends IDocumented {
    type: Type;
}

export interface IParam extends IDocumented {
    name: string;
    type: Type;
}

export interface IQueryParam extends IDocumented {
    name: string;
    required: boolean;
    type: Type;
}

export interface IResponse extends IDocumented {
    status: number;
    body: Type | null;
}

export interface IExportedRouteMethod extends IDocumented {
    name: string;
    method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE";
    authorization: IAuthroization | null;
    body: IBody | null;
    params: IParam[];
    query: IQueryParam[];
    responses: IResponse[];
}

export interface IExportedRoute extends IDocumented {
    route: string;
    methods: IExportedRouteMethod[];
}

export interface IExportedRouter extends IDocumented {
    name: string;
    routeBase: string;
    routes: IExportedRoute[];
}
