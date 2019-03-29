export default class TextBlock {
    public static readonly EMPTY: TextBlock = new TextBlock([]);

    public static hJoin(blocks: Array<TextBlock | string>, delim: TextBlock | string): TextBlock {
        if (blocks.length === 0) {
            return TextBlock.EMPTY;
        }
        const delimBlock = TextBlock.asTextBlock(delim);
        const blockArray = [TextBlock.asTextBlock(blocks[0])];
        for (let i = 1; i < blocks.length; i++) {
            blockArray.push(delimBlock);
            blockArray.push(TextBlock.asTextBlock(blocks[i]));
        }
        return TextBlock.hcat(...blockArray);
    }

    public static vJoin(blocks: Array<TextBlock | string>, delim: TextBlock | string): TextBlock {
        if (blocks.length === 0) {
            return TextBlock.EMPTY;
        }
        const delimBlock = TextBlock.asTextBlock(delim);
        const blockArray = [TextBlock.asTextBlock(blocks[0])];
        for (let i = 1; i < blocks.length; i++) {
            blockArray.push(delimBlock);
            blockArray.push(TextBlock.asTextBlock(blocks[i]));
        }
        return TextBlock.vcat(...blockArray);
    }

    public static hcat(...blocks: Array<TextBlock | string>): TextBlock {
        return TextBlock.EMPTY.hcat(...blocks);
    }

    public static vcat(...blocks: Array<TextBlock | string>): TextBlock {
        return TextBlock.EMPTY.vcat(...blocks);
    }

    public static asTextBlock(block: TextBlock | string): TextBlock {
        if (typeof block === "string") {
            return new TextBlock(block);
        }
        return block;
    }

    private readonly lines: string[];
    private readonly indention: number;

    public constructor(text: string | string[], indention: number = 0) {
        this.lines = Array.isArray(text) ? text : text.split("\n");
        this.indention = indention;
    }

    /**
     * Indent this block by the given amount and return a new block.
     *
     * @param amount Number of spaces to indent with
     */
    public indent(amount: number): TextBlock {
        return new TextBlock(this.lines, this.indention + amount);
    }

    /**
     * Put several blocks beside each other, extending if needed.
     *
     * | ABC | DEF HIJ | 123 |
     * | 1   | KLM     | 222 |
     * |     |         | 33  |
     *
     * @param blocks Additional blocks to layout beside this block.
     */
    public hcat(...blocks: Array<TextBlock | string>): TextBlock {
        if (blocks.length === 0) {
            return this;
        }
        const fullBlocks: string[][] = [this.toRectString()].concat(blocks.map((block) =>
            TextBlock.asTextBlock(block).toRectString(),
        )).filter((block) => block.length > 0);
        const maxHeight = Math.max(this.height(), ...fullBlocks.map((block) => block.length));
        fullBlocks.forEach((block) => {
            while (block.length < maxHeight) {
                block.push(block[0].replace(/./g, " "));
            }
        });
        const newLines = fullBlocks.reduce((acc, block) => {
            block.forEach((line, index) => acc[index] += line);
            return acc;
        });
        return new TextBlock(newLines);
    }

    /**
     * Put several blocks underneath each other.
     *
     * | ABC |
     * |-----|
     * |    Another block we need to indent. |
     * |    It continues here.               |
     * |-------------------------------------|
     * | A third block. |
     *
     * @param blocks Blocks to put underneath each other.
     */
    public vcat(...blocks: Array<TextBlock | string>): TextBlock {
        if (blocks.length === 0) {
            return this;
        }
        const newLines: string[][] = blocks.map((block) =>
            TextBlock.asTextBlock(block).toIndentStrings(),
        );
        return new TextBlock(this.toIndentStrings().concat(...newLines));
    }

    /**
     * Get the width of this block in characters.
     */
    public width(): number {
        return Math.max(0, ...this.lines.map((line) => line.length)) + this.indention;
    }

    /**
     * Get the height (lines) of this block.
     */
    public height(): number {
        return this.lines.length;
    }

    /**
     * Serialize a block as a string. Lines are indented, but not padded.
     */
    public toString(): string {
        return this.toIndentStrings().join("\n");
    }

    public toIndentStrings(): string[] {
        let prefix = "";
        while (prefix.length < this.indention) {
            prefix += " ";
        }
        return this.lines.map((line) => prefix + line);
    }

    private toRectString(): string[] {
        const w = this.width();
        return this.toIndentStrings().map((line) => {
            let fullLine = line;
            while (fullLine.length < w) {
                fullLine += " ";
            }
            return fullLine;
        });
    }
}
