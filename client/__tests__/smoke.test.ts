import fs from "fs";
import path from "path";

describe("frontend smoke", () => {
  it("has the Vite entrypoint and root container", () => {
    const indexHtmlPath = path.resolve(__dirname, "..", "index.html");
    const entryPath = path.resolve(__dirname, "..", "src", "main.tsx");

    expect(fs.existsSync(indexHtmlPath)).toBe(true);
    expect(fs.existsSync(entryPath)).toBe(true);

    const html = fs.readFileSync(indexHtmlPath, "utf-8");

    expect(html).toContain("<div id=\"root\"></div>");
    expect(html).toContain("/src/main.tsx");
  });
});
