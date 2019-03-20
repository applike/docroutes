# docroutes

This tool tries to solve the problem of keeping the documentation of your API in sync with the API.
Instead of having a separate documentation you need to update every time you need to change something in your API, you document the routes in your codebase (you have documentation in your codebase, right?).
You can then run the `docroutes` tool on your code base and generate one or more Markdown files containing not only your comments but also the types and interfaces your datatypes use.

[![npm version](https://badge.fury.io/js/docroutes.svg)](https://badge.fury.io/js/docroutes)

## Usage

```shell
docroutes [FLAGS] [FILES | DIRECTORIES]
```

Options:

    --help:                     Show this help
    --outdir [DIR]:             Set the output directory
    --output [FILE]:            Set a single output file (all output is concatenated)
    --config [FILE | DIR]:      Specify the path to tsconfig.json
    --checkUnchanged            Check whether any file changes were made and return failure if so.
                                You can use this option to ensure files are up to date (e.g., in CI)

Any additional files or directories specified will be used as inputs to the typescript compiler.

### Example

Defining routes happens by declaring types with a special structure.
Additionally, the routes are made known to the tool by a special comment on the type or interface declaration:

```ts
#ExportRoute("/prefix/of/your/route")
```

The special marker needs to be the last part of the documentation of the route.
An example of a full route declaration looks like this:

```ts
/**
 * Documentation for your route.
 *
 * #ExportRoute("/prefix/of/your/route")
 */
interface YourRoute {
    /**
     * This is your route.
     */
    "/your/:route": {
        /**
         * And this is the method of your route.
         */
        "POST": {
            authorization: string;
            body: { someThing: string };
            name: "Your Route";
            param: {
                /**
                 * Some parameter of your route.
                 */
                route: string;
            };
            query: {
                /**
                 * And some query parameter.
                 */
                someQueryParam?: boolean;
            }
            response: {
                /**
                 * This route might return status 201 with a number as response.
                 */
                201: number;
                /**
                 * Or it returns 202 without any body / an empty body.
                 */
                202: undefined;
            }
        };
    };
}
```

There is another example in [src/example.ts](https://github.com/applike/docroutes/blob/master/src/example.ts).
An example for the output can be found in [example.md](https://github.com/applike/docroutes/blob/master/example.md), which is generated from [src/example.ts](https://github.com/applike/docroutes/blob/master/src/example.ts).

Assume our current directory points to your custom typescript project.

We now run:

```shell
docroutes --config . --outdir docs --output fulldoc.md --checkUnchanged
```

- the tool will find all `*.ts(x)` files in your project
- load it into the typescript compiler using your `tsconfig.json` file
- extract all documented routes
- for each route `YourRoute`, generate a file `YourRoute.md` in `docs`
- also generate a single file containing all routes called `fulldoc.md`
- return status 0 (success) if all files were already up to date
- or return status 2 if any file was changed by running the tool

## TODO

- Extracting the data from the typescript AST is still quite basic. There is a good chance that something you write will not yet map cleanly to the internal representation
- Generating Markdown is quite ad-hoc
- Using the information we have, it would be nice to generate classes consuming or defining an API