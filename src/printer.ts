import * as path from "path";
import TextBlock from "./pretty/TextBlock";
import { IDocumented, IExportedRoute, IExportedRouteMethod, IExportedRouter, Type } from "./types";

const INDENT_SIZE = 2;

export function printMarkdownFull(routers: IExportedRouter[]): string {
    return new TextBlock([
        "# Routes",
        "",
        "[TOC]",
        "",
    ]).vcat(...routers.map((router) => printMarkdown(router, false))).toString().trim() + "\n";
}

export function printMarkdown(router: IExportedRouter, printTOC: boolean): string {
    const routerDesc = router.documentation !== null
        ? TextBlock.hcat("- ", router.documentation)
        : TextBlock.EMPTY;
    return TextBlock.vcat(
        `${printTOC ? "#" : "##"} ${router.name}`,
        "",
        TextBlock.hcat("- Prefix for all routes: `", router.routeBase, "`"),
        routerDesc,
        printTOC ? "\n[TOC]\n" : "",
        TextBlock.vJoin(router.routes.map(printMarkdownEndpoint(router.routeBase, printTOC ? 2 : 3)), "\n\n"),
    ).toString()
    .split("\n").map((s) => s.trimRight()).join("\n")
    .replace(
        /\n{3,}/g, "\n\n",
    ).trim() + "\n";
}

function printMarkdownEndpoint(routerBase: string, level: 2 | 3): (route: IExportedRoute) => TextBlock {
    return (route: IExportedRoute) => {
        const routeDesc = route.documentation !== null
            ? TextBlock.hcat("- ", route.documentation)
            : TextBlock.EMPTY;
        const routePath = TextBlock.hcat("`", path.join(routerBase, route.route), "`");
        return TextBlock.vJoin(route.methods.map(
            (method) => printMarkdownMethod(routePath, routeDesc, method, level),
        ), "\n\n");
    };
}

function printMarkdownMethod(
    routePath: TextBlock,
    routeDesc: TextBlock,
    method: IExportedRouteMethod,
    level: 2 | 3,
): TextBlock {
    const docs: TextBlock[] = [
        TextBlock.hcat("- Method: `", method.method, "`"),
        TextBlock.hcat("- Route: ", routePath),
    ];
    if (method.documentation !== null) {
        docs.push(TextBlock.hcat("- ", method.documentation));
    }
    if (method.authorization !== null) {
        docs.push(TextBlock.vcat(
            TextBlock.hcat("- Authorization: ", method.authorization.documentation || ""),
            "",
            TextBlock.vcat(
                "```ts",
                printMarkdownType(method.authorization.type),
                "```",
            ).indent(INDENT_SIZE),
            "",
        ));
    }
    if (method.body !== null) {
        docs.push(TextBlock.vcat(
            TextBlock.hcat("- Body: ", method.body.documentation || ""),
            "",
            TextBlock.vcat(
                "```ts",
                printMarkdownType(method.body.type),
                "```",
            ).indent(INDENT_SIZE),
            "",
        ));
    }
    if (method.params.length > 0) {
        docs.push(TextBlock.vcat(
            "- Parameters:",
            "",
            ...method.params.map((param) => TextBlock.vcat(
                TextBlock.hcat("- `", param.name, "`: ", param.documentation || ""),
                "",
                TextBlock.vcat(
                    "```ts",
                    printMarkdownType(param.type),
                    "```",
                ).indent(INDENT_SIZE),
                "",
            ).indent(INDENT_SIZE)),
        ));
    }
    if (method.query.length > 0) {
        docs.push(TextBlock.vcat(
            "- Query-Parameters:",
            "",
            ...method.query.map((param) => TextBlock.vcat(
                TextBlock.hcat(
                    "- `",
                    param.name,
                    "`",
                    param.required ? "" : " (optional)",
                    ": ",
                    param.documentation || ""),
                "",
                TextBlock.vcat(
                    "```ts",
                    printMarkdownType(param.type),
                    "```",
                ).indent(INDENT_SIZE),
                "",
            ).indent(INDENT_SIZE)),
        ));
    }
    if (method.responses.length > 0) {
        docs.push(TextBlock.vcat(
            "- Response:",
            "",
            ...method.responses.map((response) => TextBlock.vcat(
                TextBlock.hcat(
                    "- `",
                    response.status.toString(),
                    "`: ",
                    response.documentation || ""),
                "",
                response.body === null
                    ? new TextBlock("Empty response").indent(INDENT_SIZE)
                    : TextBlock.vcat(
                        "",
                        "```ts",
                        printMarkdownType(response.body),
                        "```",
                    ).indent(INDENT_SIZE),
                "",
            ).indent(INDENT_SIZE)),
        ));
    }
    return TextBlock.vcat(
        TextBlock.hcat(
            level === 2 ? "##" : "###",
            " ",
            method.name,
        ),
        "",
        routeDesc,
        ...docs,
    );
}

function printMarkdownType(type: Type): TextBlock {
    if ("numbers" in type) {
        if (type.numbers === "all") {
            return TextBlock.hcat("number", showDocType(type));
        }
        return TextBlock.hcat(type.numbers.join(" | "), showDocType(type));
    }
    if ("booleans" in type) {
        if (type.booleans === "all") {
            return TextBlock.hcat("boolean", showDocType(type));
        }
        return TextBlock.hcat(type.booleans.join(" | "), showDocType(type));
    }
    if ("strings" in type) {
        if (type.strings === "all") {
            return TextBlock.hcat("string", showDocType(type));
        }
        return TextBlock.hcat(type.strings.map((s) => JSON.stringify(s)).join(" | "), showDocType(type));
    }
    if ("arrayMembers" in type) {
        if (isSimpleType(type.arrayMembers)) {
            return TextBlock.hcat(printMarkdownType(type.arrayMembers), "[]", showDocType(type));
        }
        return new TextBlock("Array<" + printMarkdownType(type.arrayMembers) + ">").hcat(showDocType(type));
    }
    if ("tupleMembers" in type) {
        return new TextBlock("[" + type.tupleMembers.map(printMarkdownType).join(", ") + "]").hcat(showDocType(type));
    }
    if ("objectMembers" in type) {
        const memberKeys = Object.keys(type.objectMembers);
        if (memberKeys.length === 0) {
            if (type.name === null) {
                return TextBlock.hcat("{}", showDocType(type));
            }
            // we have a type we only know by name
            return TextBlock.hcat(type.name, showDocType(type));
        }
        const longestName = memberKeys.reduce((acc, key) => Math.max(acc, key.length), 0);
        return TextBlock.vcat(
            "{",
            ...memberKeys.map((memberName) =>
                TextBlock.hcat(
                    memberName,
                    ": ",
                    printMarkdownType(type.objectMembers[memberName]).indent(longestName - memberName.length),
                    ";",
                ).indent(INDENT_SIZE),
            ),
            TextBlock.hcat("}", showDocType(type)),
        );
    }
    if ("null" in type) {
        return new TextBlock("null");
    }
    if ("undefined" in type) {
        return new TextBlock("undefined");
    }
    if ("intersection" in type) {
        return TextBlock.hcat(type.intersection.map(printMarkdownType).join(" & "), showDocType(type));
    }
    if ("union" in type) {
        return TextBlock.hcat(type.union.map(printMarkdownType).join(" | "), showDocType(type));
    }
    return TextBlock.EMPTY;
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

function showDocType(doc: IDocumented): TextBlock {
    if (doc.documentation === null) {
        return TextBlock.EMPTY;
    }
    const docBlock = new TextBlock(doc.documentation);
    const endLines = [];
    while (endLines.length < docBlock.height()) {
        endLines.push(endLines.length + 1 < docBlock.height() ? "" : " */");
    }
    const endBlock = new TextBlock(endLines);
    return TextBlock.hcat(" /* ", docBlock, endBlock);
}
