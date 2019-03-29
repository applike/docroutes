import TextBlock from "./TextBlock";

test("TextBlock Base", () => {
    const txt = new TextBlock("a\nb\nc\n");
    expect(txt.toString()).toBe("a\nb\nc\n");
    expect(txt.width()).toBe(1);
    expect(txt.height()).toBe(4);
    const txt2 = txt.indent(2);
    expect(txt2.toString()).toBe("  a\n  b\n  c\n  ");
    expect(txt2.width()).toBe(3);
    expect(txt2.height()).toBe(4);
});

test("TextBlock hcat", () => {
    const txt1 = new TextBlock("The early\nbird");
    expect(txt1.hcat()).toBe(txt1);
    const txt2 = new TextBlock("catches the worm", 1);
    const txt3 = new TextBlock("This text\nneeds to be\na little bit longer", 2);
    const txt4 = "than the rest";
    const result = [
        "The early catches the worm  This text          than the rest",
        "bird                        needs to be                     ",
        "                            a little bit longer             ",
    ].join("\n");
    expect(txt1.hcat(txt2, txt3, txt4).toString()).toBe(result);
});

test("TextBlock vcat", () => {
    const txt1 = new TextBlock("This text");
    expect(txt1.vcat()).toBe(txt1);
    const txt2 = new TextBlock("is indented\nand a little bit longer", 2);
    const txt3 = "than the rest";
    const result = [
        "This text",
        "  is indented",
        "  and a little bit longer",
        "than the rest",
    ].join("\n");
    expect(txt1.vcat(txt2, txt3).toString()).toBe(result);
});
