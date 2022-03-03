import puppeteer from "puppeteer";
import gm from "gm";
import fs from "fs";

export interface Tree {
  nodeName: string;
  xpath: string;
  attrs: { [key: string]: string }; // objectの連想配列
  rect: Rect;
  style: Style;
  innerText: string;
  children: Tree[];
}

interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

type Style = {
  display: boolean;
};

const buildDomTree = async (page: puppeteer.Page): Promise<Tree> => {
  return (await page.evaluate(() => {
    function qs(el: HTMLElement, selector: string) {
      try {
        return document.querySelector(selector);
      } catch (e) {
        return null;
      }
    }

    // NOTE: 内部でjs実行するのでevaluate以下に定義しないといけない
    class DomTree {
      r: Rect;
      children: DomTree[];

      constructor(private el: HTMLElement) {
        const { top, left, right, bottom } = el.getBoundingClientRect();
        this.r = {
          top: top,
          left: left,
          right: right,
          bottom: bottom,
        };
        this.children = [...(el.children as any as HTMLElement[])].map(
          (el) => new DomTree(el)
        );
      }

      getAttrs() {
        const attrs: { [key: string]: string } = {};
        if (this.el.hasAttributes()) {
          for (let i = 0; i < this.el.attributes.length; i++) {
            attrs[this.el.attributes[i].name] = this.el.attributes[i].value;
          }
        }
        return attrs;
      }

      getStyle(): Style {
        const c = window.getComputedStyle(this.el);
        let d =
          c.display === "none" ||
          c.visibility === "hidden" ||
          c.visibility === "collapse" ||
          (this.el.nodeName === "INPUT" &&
            (this.el as HTMLInputElement).type === "hidden")
            ? false
            : true;

        return {
          display: d,
        };
      }

      // xpath
      getXPathForElement() {
        const idx = (sib: Element | null, name?: string): any =>
          sib
            ? idx(sib.previousElementSibling, name || sib.localName) +
              (sib.localName == name)
            : 1;
        const segs = (elm: any): any =>
          !elm || elm.nodeType !== 1
            ? [""]
            : elm.id && document.getElementById(elm.id) === elm
            ? [`id("${elm.id}")`]
            : [
                ...segs(elm.parentNode),
                `${elm.localName.toLowerCase()}[${idx(elm)}]`,
              ];
        return segs(this.el).join("/");
      }

      exportTree(): Tree {
        return {
          nodeName: this.el.nodeName,
          rect: this.r,
          attrs: this.getAttrs(),
          xpath: this.getXPathForElement(),
          style: this.getStyle(),
          innerText: this.el.innerText,
          children: this.children.map((child) => child.exportTree()),
        };
      }
    }

    const domTree = new DomTree(document.body);
    return domTree.exportTree();
  })) as Tree;
};

const parse = async (
  url: string,
  sOpt: puppeteer.ScreenshotOptions
): Promise<Tree> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["no-sandbox", "--disable-satuid-sandbox"],
    defaultViewport: {
      width: 1200,
      height: 800,
    },
  });
  const page = await browser.newPage();
  page.setUserAgent(
    "'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"
  );

  await page.goto(url);

  let tree = await buildDomTree(page);
  await page.screenshot(sOpt);
  writeScreenshot("screenshot.png", tree.rect);
  await browser.close();

  return tree;
};

const writeScreenshot = (path: string, rect: Rect): void => {
  // drawRectangleだとfillがはいるためdrawLine
  gm(path)
    .stroke("green", 3)
    .drawLine(rect.left, rect.top, rect.left, rect.bottom)
    .drawLine(rect.left, rect.top, rect.right, rect.top)
    .drawLine(rect.right, rect.bottom, rect.right, rect.top)
    .drawLine(rect.right, rect.bottom, rect.left, rect.bottom)
    .write("screenshot_drawed.png", function (err) {
      if (err) console.log("not done", err);
    });
};

const url = process.argv[2];

(async () => {
  const tree = await parse(url, {
    fullPage: true,
    type: "png",
    path: "screenshot.png",
  });
  fs.writeFile("dom.json", JSON.stringify(tree), (err) => {
    if (err) throw err;
  });
  // detect
  //const mainContents = detectMainContent(tree, documentWidth, documentHeight);
  //const { rect, xpath } = mainContents[0];
  // mein content
  writeScreenshot("screenshot.png", tree.rect);
})();
