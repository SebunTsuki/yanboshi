import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BLINK_SEQUENCE,
  BREATH_LAYERS,
  EXPRESSION_PRESETS,
  HEAD_LAYERS,
  LAYER_ORDER,
  MOUTH_SHAPES,
  SPRITE_MOUTH_SHAPES,
  pickMouthShape,
} from "../src/puppetConfig.js";

describe("puppet animation config", () => {
  it("keeps face features above the face and places the hat above the hair", () => {
    assert.ok(LAYER_ORDER.indexOf("face") < LAYER_ORDER.indexOf("eyewhite-r"));
    assert.ok(LAYER_ORDER.indexOf("irides-r") < LAYER_ORDER.indexOf("eyelash-r"));
    assert.ok(LAYER_ORDER.indexOf("eyelash-l") < LAYER_ORDER.indexOf("front hair"));
    assert.ok(LAYER_ORDER.indexOf("front hair") < LAYER_ORDER.indexOf("headwear"));
  });

  it("keeps the neck attached to the body group instead of the head rotation group", () => {
    assert.ok(BREATH_LAYERS.includes("neck"));
    assert.equal(HEAD_LAYERS.includes("neck"), false);
    assert.ok(LAYER_ORDER.indexOf("topwear") < LAYER_ORDER.indexOf("neck"));
    assert.ok(LAYER_ORDER.indexOf("neck") < LAYER_ORDER.indexOf("face"));
  });

  it("keeps the source mouth attached to the same breathing motion as the face", () => {
    assert.ok(HEAD_LAYERS.includes("mouth"));
    assert.ok(BREATH_LAYERS.includes("mouth"));
  });

  it("defines usable procedural mouth shapes until painted mouths are added", () => {
    const required = ["rest", "smile", "a", "i", "u", "o"];

    for (const name of required) {
      assert.ok(MOUTH_SHAPES[name], `missing mouth shape ${name}`);
      assert.equal(typeof MOUTH_SHAPES[name].path, "string");
      assert.ok(MOUTH_SHAPES[name].viewBox.length > 0);
    }
  });

  it("uses atlas-based mouths only for open-mouth lip sync shapes", () => {
    const required = ["a", "i", "u", "o"];

    for (const name of required) {
      assert.ok(SPRITE_MOUTH_SHAPES[name], `missing sprite mouth ${name}`);
      assert.match(SPRITE_MOUTH_SHAPES[name].file, /^expressions\/mouth-/);
      assert.ok(SPRITE_MOUTH_SHAPES[name].frame.width > 0);
      assert.ok(SPRITE_MOUTH_SHAPES[name].frame.height > 0);
    }

    assert.equal(SPRITE_MOUTH_SHAPES.rest, undefined);
    assert.equal(SPRITE_MOUTH_SHAPES.smile, undefined);
  });

  it("defines expression presets that can hide base eye layers and show atlas overlays", () => {
    assert.ok(EXPRESSION_PRESETS.neutral);
    assert.equal(EXPRESSION_PRESETS.neutral.hideBaseEyes, false);
    assert.equal(EXPRESSION_PRESETS.happy.hideBaseEyes, true);
    assert.equal(EXPRESSION_PRESETS.happy.overlays.length, 2);
    assert.equal(EXPRESSION_PRESETS.surprise.mouth, "o");
    assert.equal(EXPRESSION_PRESETS.surprise.lockMouth, true);
  });

  it("maps audio energy into readable mouth states", () => {
    assert.equal(pickMouthShape(0.01, 0), "rest");
    assert.equal(pickMouthShape(0.18, 1), "i");
    assert.equal(pickMouthShape(0.42, 2), "a");
    assert.equal(pickMouthShape(0.62, 3), "o");
  });

  it("has a blink sequence with closed eyes in the middle", () => {
    assert.deepEqual(BLINK_SEQUENCE.map((frame) => frame.eyeScale), [1, 0.2, 0.04, 0.2, 1]);
  });
});
