"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const gm_1 = __importDefault(require("gm"));
class Tree {
}
async function parse(url, sOpt) {
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['no-sandbox', '--disable-satuid-sandbox'],
        defaultViewport: {
            width: 1200,
            height: 800
        }
    });
    const page = await browser.newPage();
    page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.3");
    await page.goto(url);
    const tree = buildDomTree(page);
    await page.screenshot(sOpt);
    await browser.close();
    return tree;
}
async function buildDomTree(page) {
    return await page.evaluate(() => {
        let tree = new Tree();
        function qs(el, selector) {
            try {
                return document.querySelector(selector);
            }
            catch (e) {
                return null;
            }
        }
        let el = document.body;
        const computed = window.getComputedStyle(el);
        const { top, left, right, bottom } = el.getBoundingClientRect();
        const r = {
            top: top,
            left: left,
            right: right,
            bottom: bottom,
        };
        return element(page, el);
    });
}
const element = (page, el) => {
    // get rect
    const { top, left, right, bottom } = el.getBoundingClientRect();
    const r = {
        top: top,
        left: left,
        right: right,
        bottom: bottom,
    };
    // get attr
    const attrs = {};
    if (el.hasAttributes()) {
        for (let i = 0; i < el.attributes.length; i++) {
            attrs[el.attributes[i].name] = el.attributes[i].value;
        }
    }
    // children
    let children = el.children;
    // xpath
    function getXPathForElement(element) {
        const idx = (sib, name) => sib
            ? idx(sib.previousElementSibling, name || sib.localName) + (sib.localName == name)
            : 1;
        const segs = (elm) => !elm || elm.nodeType !== 1
            ? ['']
            : elm.id && document.getElementById(elm.id) === elm
                ? [`id("${elm.id}")`]
                : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm)}]`];
        return segs(element).join('/');
    }
    let xpath = getXPathForElement(el);
    // style
    function getStyle(el, c) {
        let d = (c.display === 'none' ||
            c.visibility === 'hidden' ||
            c.visibility === 'collapse' ||
            (el.nodeName === 'INPUT' && el.type === "hidden")) ? true : false;
        return {
            display: d
        };
    }
    const computed = window.getComputedStyle(el);
    let s = getStyle(el, computed);
    return {
        tagName: el.tagName,
        rect: r,
        attrs: attrs,
        xpath: xpath,
        style: s,
        innerText: el.innerText,
        children: children.map(c => element(page, c)),
    };
};
const writeScreenshot = (path, rect) => {
    gm_1.default(path)
        .stroke("green", 3)
        .drawRectangle(rect.x0, rect.y0, rect.x1, rect.y1)
        .write("screenshot_draw_maincontent.png", function (err) {
        if (!err)
            console.log('done');
    });
};
const url = process.argv[2];
(async () => {
    const tree = await parse(url, { fullPage: true, type: "png", path: "screenshot.png" });
    // detect
    //const mainContents = detectMainContent(tree, documentWidth, documentHeight);
    //const { rect, xpath } = mainContents[0];
    // mein content
    // draw body rect
    writeScreenshot('screenshot.png', tree.rect);
})();
