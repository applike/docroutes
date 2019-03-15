import * as path from "path";
import { IDocumented, IExportedRoute, IExportedRouteMethod, IExportedRouter, Type } from "./types";

export function printRouter(router: IExportedRouter): string {
    return JSON.stringify(router, undefined, 4);
}

const INDENT_SIZE = 2;

export function printMarkdown(router: IExportedRouter): string {
    const routerDesc = router.documentation !== null
        ? `
- ${router.documentation}`
        : "";
    return `# ${router.name}

- Prefix for all routes: \`${router.routeBase}\`${routerDesc}

[TOC]

${router.routes.map(printMarkdownEndpoint(router.routeBase)).join("\n\n")}`.replace(
        /\n{3,}/g, "\n\n",
    ).split("\n").map((s) => s.trimRight()).join("\n");
}

function printMarkdownEndpoint(routerBase: string): (route: IExportedRoute) => string {
    return (route: IExportedRoute) => {
        const routeDesc = route.documentation !== null
            ? `

${route.documentation}`
            : "";
        return `## \`${path.join(routerBase, route.route)}\`${routeDesc}

${route.methods.map(printMarkdownMethod).join("\n\n")}`;
    };
}

function printMarkdownMethod(method: IExportedRouteMethod): string {
    return `### ${method.method}

${method.documentation !== null ? `- ${method.documentation}` : ""}
${method.authorization !== null ? `- Authorization: ${method.authorization.documentation || ""}

${indent(INDENT_SIZE)}\`\`\`ts
${printMarkdownType(method.authorization.type, INDENT_SIZE, false)}
${indent(INDENT_SIZE)}\`\`\`
` : ""}

${method.body !== null ? `- Body: ${method.body.documentation || ""}

${indent(INDENT_SIZE)}\`\`\`ts
${printMarkdownType(method.body.type, INDENT_SIZE, false)}
${indent(INDENT_SIZE)}\`\`\`
` : ""}
${method.params.length > 0 ? `- Parameters:

${method.params.map((param) => `${indent(INDENT_SIZE)}- \`${param.name}\`: ${param.documentation || ""}

${indent(2 * INDENT_SIZE)}\`\`\`ts
${printMarkdownType(param.type, 2 * INDENT_SIZE, false)}
${indent(2 * INDENT_SIZE)}\`\`\`
`)}` : ""}
${method.query.length > 0 ? `- Query-Parameters:

${method.query.map((param) => `${indent(INDENT_SIZE)}- \`${param.name}\`${
    param.required ? "" : " (optional)"
}: ${param.documentation || ""}

${indent(2 * INDENT_SIZE)}\`\`\`ts
${printMarkdownType(param.type, 2 * INDENT_SIZE, false)}
${indent(2 * INDENT_SIZE)}\`\`\`
`)}` : ""}
${method.responses.length > 0 ? `- Response:

${method.responses.map((response) => `${indent(INDENT_SIZE)}- \`${response.status}\`: ${response.documentation || ""}${
response.body === null ? "Empty response" : `

${indent(2 * INDENT_SIZE)}\`\`\`ts
${printMarkdownType(response.body, 2 * INDENT_SIZE, false)}
${indent(2 * INDENT_SIZE)}\`\`\`
`}
`).join("\n\n")}` : ""}`;
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
