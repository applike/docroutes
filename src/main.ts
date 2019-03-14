import * as ts from "typescript";

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
        sourceFile.forEachChild((node: ts.Node) => {
            console.log(node);
            switch (node.kind) {
                case ts.SyntaxKind.TypeAliasDeclaration: {
                    console.log("type alias");
                    const { name, type, typeParameters } = node as ts.TypeAliasDeclaration;
                    console.log(name, type, typeParameters);
                    break;
                }
                case ts.SyntaxKind.InterfaceDeclaration: {
                    console.log("interface");
                    const { name, members, typeParameters } = node as ts.InterfaceDeclaration;
                    console.log(name, members, typeParameters);
                    break;
                }
                case ts.SyntaxKind.TypeLiteral: {
                    console.log("type literal");
                    const { members } = node as ts.TypeLiteralNode;
                    console.log(members);
                    break;
                }
            }
        });
    }

    const allDiagnostics = ts
        .getPreEmitDiagnostics(program);

    allDiagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
                diagnostic.start!
            );
            const message = ts.flattenDiagnosticMessageText(
                diagnostic.messageText,
                "\n"
            );
            console.log(
                `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
            );
        } else {
            console.log(
                `${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`
            );
        }
    });
}

compile(process.argv.slice(2), {
    noEmitOnError: true,
    noImplicitAny: true,
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
});
