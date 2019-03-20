import * as path from "path";
import { IDocumented, IExportedRoute, IExportedRouteMethod, IExportedRouter, Type } from "./types";

export function printRouter(router: IExportedRouter): string {
    return JSON.stringify(router, undefined, 4);
}

const INDENT_SIZE = 2;

export function printMarkdownFull(routers: IExportedRouter[]): string {
    return `# Routes

[TOC]

${routers.map((router) => printMarkdown(router, false)).join("\n")}
`.trim() + "\n";
}

export function printMarkdown(router: IExportedRouter, printTOC: boolean): string {
    const routerDesc = router.documentation !== null
        ? `
- ${router.documentation}`
        : "";
    return `${printTOC ? "#" : "##"} ${router.name}

- Prefix for all routes: \`${router.routeBase}\`${routerDesc}
${printTOC ? "\n[TOC]\n" : ""}
${router.routes.map(printMarkdownEndpoint(router.routeBase, printTOC ? 2 : 3)).join("\n\n")}`.replace(
        /\n{3,}/g, "\n\n",
    ).split("\n").map((s) => s.trimRight()).join("\n").trim() + "\n";
}

function printMarkdownEndpoint(routerBase: string, level: 2 | 3): (route: IExportedRoute) => string {
    return (route: IExportedRoute) => {
        const routeDesc = route.documentation !== null ? "\n\n" + route.documentation : "";
        const routePath = `\`${path.join(routerBase, route.route)}\``;
        return route.methods.map((method) => printMarkdownMethod(routePath, routeDesc, method, level)).join("\n\n");
    };
}

function printMarkdownMethod(routePath: string, routeDesc: string, method: IExportedRouteMethod, level: 2 | 3): string {
    const docs: string[] = [
        `- Method: \`${method.method}\``,
        `- Route: ${routePath}`,
    ];
    if (method.documentation !== null) {
        docs.push(`- ${method.documentation}`);
    }
    if (method.authorization !== null) {
        docs.push(`- Authorization: ${method.authorization.documentation || ""}

${indent(INDENT_SIZE)}\`\`\`ts
${printMarkdownType(method.authorization.type, INDENT_SIZE, false)}
${indent(INDENT_SIZE)}\`\`\`
`);
    }
    if (method.body !== null) {
        docs.push(`- Body: ${method.body.documentation || ""}

${indent(INDENT_SIZE)}\`\`\`ts
${printMarkdownType(method.body.type, INDENT_SIZE, false)}
${indent(INDENT_SIZE)}\`\`\`
`);
    }
    if (method.params.length > 0) {
        docs.push(`- Parameters:

${method.params.map((param) => `${indent(INDENT_SIZE)}- \`${param.name}\`: ${param.documentation || ""}

${indent(2 * INDENT_SIZE)}\`\`\`ts
${printMarkdownType(param.type, 2 * INDENT_SIZE, false)}
${indent(2 * INDENT_SIZE)}\`\`\`
`)}`);
    }
    if (method.query.length > 0) {
        docs.push(`- Query-Parameters:

${method.query.map((param) => `${indent(INDENT_SIZE)}- \`${param.name}\`${
    param.required ? "" : " (optional)"
}: ${param.documentation || ""}

${indent(2 * INDENT_SIZE)}\`\`\`ts
${printMarkdownType(param.type, 2 * INDENT_SIZE, false)}
${indent(2 * INDENT_SIZE)}\`\`\`
`)}`);
    }
    if (method.responses.length > 0) {
        docs.push(`- Response:

${method.responses.map((response) => `${indent(INDENT_SIZE)}- \`${response.status}\`: ${response.documentation || ""}${
response.body === null ? "Empty response" : `

${indent(2 * INDENT_SIZE)}\`\`\`ts
${printMarkdownType(response.body, 2 * INDENT_SIZE, false)}
${indent(2 * INDENT_SIZE)}\`\`\`
`}
`).join("\n\n")}`);
    }
    return `${level === 2 ? "##" : "###"} ${method.name}${routeDesc}

${docs.join("\n")}`;
}

function printMarkdownType(type: Type, indention: number, isInline: boolean): string {
    if ("numbers" in type) {
        if (type.numbers === "all") {
            return `${indent(indention, isInline)}number${showDocType(type)}`;
        }
        return `${indent(indention, isInline)}${type.numbers.join(" | ")}${showDocType(type)}`;
    }
    if ("booleans" in type) {
        if (type.booleans === "all") {
            return `${indent(indention, isInline)}boolean${showDocType(type)}`;
        }
        return `${indent(indention, isInline)}${type.booleans.join(" | ")}${showDocType(type)}`;
    }
    if ("strings" in type) {
        if (type.strings === "all") {
            return `${indent(indention, isInline)}string${showDocType(type)}`;
        }
        return `${indent(indention, isInline)}${type.strings.map((s) =>
            JSON.stringify(s),
        ).join(" | ")}${showDocType(type)}`;
    }
    if ("arrayMembers" in type) {
        if (isSimpleType(type.arrayMembers)) {
            return `${indent(indention, isInline)}${
                printMarkdownType(type.arrayMembers, indention, true)
            }[]${showDocType(type)}`;
        }
        return `${indent(indention, isInline)}Array<${
            printMarkdownType(type.arrayMembers, indention, true)
        }>${showDocType(type)}`;
    }
    if ("tupleMembers" in type) {
        return `${indent(indention, isInline)}[${
            type.tupleMembers.map((member) => printMarkdownType(member, indention, true)).join(", ")
        }]${showDocType(type)}`;
    }
    if ("objectMembers" in type) {
        const memberKeys = Object.keys(type.objectMembers);
        if (memberKeys.length === 0) {
            if (type.name === null) {
                return `${indent(indention, isInline)}{}${showDocType(type)}`;
            }
            // we have a type we only know by name
            return `${indent(indention, isInline)}${type.name}${showDocType(type)}`;
        }
        const longestName = memberKeys.reduce((acc, key) => Math.max(acc, key.length), 0);
        return `${indent(indention, isInline)}{${
            memberKeys.map((memberName) => `
${indent(indention + INDENT_SIZE)}${memberName}:${indent(longestName - memberName.length)} ${
    printMarkdownType(type.objectMembers[memberName], indention + INDENT_SIZE, true)
};`,
            ).join("")
        }
${indent(indention, false)}}${showDocType(type)}`;
    }
    if ("null" in type) {
        return `${indent(indention, isInline)}null`;
    }
    if ("undefined" in type) {
        return `${indent(indention, isInline)}undefined`;
    }
    if ("intersection" in type) {
        return `${indent(indention, isInline)}${
            type.intersection.map((member) => printMarkdownType(member, indention, true)).join(" & ")
        }${showDocType(type)}`;
    }
    if ("union" in type) {
        return `${indent(indention, isInline)}${
            type.union.map((member) => printMarkdownType(member, indention, true)).join(" | ")
        }${showDocType(type)}`;
    }
    return "";
}

function isSimpleType(type: Type): boolean {
    if ("numbers" in type) {
        return (type.numbers === "all");
    }
    if ("booleans" in type) {
        return (type.booleans === "all");
    }
    if ("strings" in type) {
        return (type.strings === "all");
    }
    if ("arrayMembers" in type) {
        return (isSimpleType(type.arrayMembers));
    }
    if ("tupleMembers" in type) {
        return true;
    }
    if ("objectMembers" in type) {
        return false;
    }
    if ("null" in type) {
        return true;
    }
    if ("undefined" in type) {
        return true;
    }
    if ("union" in type) {
        return false;
    }
    if ("intersection" in type) {
        return false;
    }
    return false;
}

function showDocType(doc: IDocumented): string {
    if (doc.documentation === null) {
        return "";
    }
    return ` /* ${doc.documentation} */`;
}

function indent(amount: number, isInline: boolean = false): string {
    if (isInline) {
        return "";
    }
    return [...new Array(amount)].map(() => " ").join("");
}
