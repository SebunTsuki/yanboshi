import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { Web2DPuppet } from "../src/puppetRuntime.js";

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.names = new Set();
  }

  add(...names) {
    for (const name of names) {
      this.names.add(name);
    }
    this.sync();
  }

  contains(name) {
    return this.names.has(name);
  }

  setFromClassName(value) {
    this.names = new Set(String(value).split(/\s+/).filter(Boolean));
    this.sync();
  }

  toggle(name, force) {
    const shouldAdd = force ?? !this.names.has(name);

    if (shouldAdd) {
      this.names.add(name);
    } else {
      this.names.delete(name);
    }

    this.sync();
    return shouldAdd;
  }

  sync() {
    this.element._className = [...this.names].join(" ");
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.attributes = new Map();
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
    };
    this.classList = new FakeClassList(this);
  }

  set className(value) {
    this.classList.setFromClassName(value);
  }

  get className() {
    return this._className ?? "";
  }

  set innerHTML(_value) {
    this.children = [];
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  getBoundingClientRect() {
    return { width: 720, height: 720 };
  }
}

function createManifest() {
  return {
    canvas: { width: 1000, height: 1000 },
    mouthAnchor: { x: 500, y: 500, width: 64, height: 40 },
    layers: [
      {
        index: 1,
        name: "face",
        file: "layers/face.png",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        opacity: 255,
      },
      {
        index: 2,
        name: "eyewhite-r",
        file: "layers/eyewhite-r.png",
        x: 450,
        y: 450,
        width: 40,
        height: 20,
        opacity: 255,
      },
      {
        index: 3,
        name: "irides-r",
        file: "layers/irides-r.png",
        x: 460,
        y: 452,
        width: 18,
        height: 18,
        opacity: 255,
      },
      {
        index: 4,
        name: "eyelash-r",
        file: "layers/eyelash-r.png",
        x: 448,
        y: 446,
        width: 44,
        height: 12,
        opacity: 255,
      },
      {
        index: 5,
        name: "eyebrow-r",
        file: "layers/eyebrow-r.png",
        x: 448,
        y: 430,
        width: 44,
        height: 10,
        opacity: 128,
      },
      {
        index: 6,
        name: "mouth",
        file: "layers/mouth.png",
        x: 480,
        y: 500,
        width: 40,
        height: 16,
        opacity: 255,
      },
    ],
  };
}

describe("Web2DPuppet mouth rendering", () => {
  beforeEach(() => {
    globalThis.document = {
      createElement: (tagName) => new FakeElement(tagName),
      createElementNS: (_namespace, tagName) => new FakeElement(tagName),
    };
    globalThis.window = {
      addEventListener() {},
      removeEventListener() {},
      location: { href: "http://localhost:4173/" },
    };
  });

  it("uses the transparent PSD mouth layer instead of the drawn fallback for rest and smile", () => {
    const root = new FakeElement("div");
    const puppet = new Web2DPuppet(root, createManifest()).mount();
    const sourceMouth = puppet.layerElements.get("mouth");

    puppet.applyMouthShape("rest");

    assert.equal(sourceMouth.classList.contains("is-active-source-mouth"), true);
    assert.equal(sourceMouth.style.opacity, "1");
    assert.equal(puppet.proceduralMouth.hidden, true);
    assert.equal(puppet.spriteMouth.hidden, true);

    puppet.applyMouthShape("smile");

    assert.equal(sourceMouth.classList.contains("is-active-source-mouth"), true);
    assert.equal(sourceMouth.style.opacity, "1");
    assert.equal(puppet.proceduralMouth.hidden, true);
    assert.equal(puppet.spriteMouth.hidden, true);
  });

  it("hides the PSD source mouth when a painted open mouth sprite is active", () => {
    const root = new FakeElement("div");
    const puppet = new Web2DPuppet(root, createManifest()).mount();
    const sourceMouth = puppet.layerElements.get("mouth");

    puppet.applyMouthShape("a");

    assert.equal(sourceMouth.classList.contains("is-active-source-mouth"), false);
    assert.equal(sourceMouth.style.opacity, "0");
    assert.equal(puppet.proceduralMouth.hidden, true);
    assert.equal(puppet.spriteMouth.hidden, false);
  });

  it("really hides base eyes and eyebrows for happy expression, then restores their PSD opacity", () => {
    const root = new FakeElement("div");
    const puppet = new Web2DPuppet(root, createManifest()).mount();
    const baseFeatureNames = ["eyewhite-r", "irides-r", "eyelash-r", "eyebrow-r"];

    puppet.setExpression("happy");

    for (const name of baseFeatureNames) {
      assert.equal(puppet.layerElements.get(name).style.opacity, "0", `${name} should be hidden`);
    }

    puppet.setExpression("neutral");

    assert.equal(puppet.layerElements.get("eyewhite-r").style.opacity, "1");
    assert.equal(puppet.layerElements.get("irides-r").style.opacity, "1");
    assert.equal(puppet.layerElements.get("eyelash-r").style.opacity, "1");
    assert.equal(puppet.layerElements.get("eyebrow-r").style.opacity, `${128 / 255}`);
  });
});
