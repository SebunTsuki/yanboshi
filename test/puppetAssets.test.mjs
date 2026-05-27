import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { BREATH_LAYERS, LAYER_ORDER, SWAY_LAYERS } from "../src/puppetConfig.js";

const manifest = JSON.parse(readFileSync(new URL("../assets/puppet/manifest.json", import.meta.url), "utf8"));

function layerNamed(name) {
  return manifest.layers.find((layer) => layer.name === name);
}

describe("puppet replacement assets", () => {
  it("uses the original PSD clothing and the refreshed hat artwork", () => {
    assert.equal(layerNamed("topwear").file, "layers/08-topwear.png");
    assert.match(layerNamed("headwear").file, /^replacements\/headwear-v2\.png$/);
  });

  it("restores the original clothing frame and removes temporary clothing overlays", () => {
    assert.deepEqual(
      pickFrame(layerNamed("topwear")),
      { x: 520, y: 235, width: 211, height: 257 },
    );
    assert.deepEqual(
      pickFrame(layerNamed("headwear")),
      { x: 525, y: 53, width: 210, height: 118 },
    );

    for (const name of ["chest-badge", "waist-charms", "hand-overlay-r", "hand-overlay-l"]) {
      assert.equal(layerNamed(name), undefined, `${name} should not be mounted with original clothing`);
    }
  });

  it("places the refreshed hat above the front hair like the reference art", () => {
    assert.ok(LAYER_ORDER.indexOf("front hair") < LAYER_ORDER.indexOf("headwear"));
  });

  it("keeps old replacement overlay names out of the active motion groups", () => {
    for (const name of ["chest-badge", "waist-charms", "hand-overlay-r", "hand-overlay-l"]) {
      assert.equal(BREATH_LAYERS.includes(name), false);
      assert.equal(LAYER_ORDER.includes(name), false);
    }

    assert.equal(SWAY_LAYERS["waist-charms"], undefined);
  });
});

function pickFrame(layer) {
  const { x, y, width, height } = layer;

  return { x, y, width, height };
}
