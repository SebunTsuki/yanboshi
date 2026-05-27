export const LAYER_ORDER = [
  "back hair",
  "legwear",
  "footwear",
  "handwear-r",
  "handwear-l",
  "bottomwear",
  "topwear",
  "neck",
  "face",
  "ears-r",
  "ears-l",
  "nose",
  "eyewhite-r",
  "eyewhite-l",
  "irides-r",
  "irides-l",
  "eyebrow-r",
  "eyebrow-l",
  "eyelash-r",
  "eyelash-l",
  "earwear",
  "mouth",
  "front hair",
  "headwear",
];

export const EYE_LAYERS = [
  "eyewhite-r",
  "eyewhite-l",
  "irides-r",
  "irides-l",
  "eyelash-r",
  "eyelash-l",
];

export const EXPRESSION_BASE_LAYERS = [
  ...EYE_LAYERS,
  "eyebrow-r",
  "eyebrow-l",
];

export const HEAD_LAYERS = [
  "back hair",
  "face",
  "ears-r",
  "ears-l",
  "nose",
  "eyewhite-r",
  "eyewhite-l",
  "irides-r",
  "irides-l",
  "eyebrow-r",
  "eyebrow-l",
  "eyelash-r",
  "eyelash-l",
  "earwear",
  "mouth",
  "front hair",
  "headwear",
];

export const BREATH_LAYERS = [
  "topwear",
  "bottomwear",
  "handwear-r",
  "handwear-l",
  "neck",
  "face",
  "mouth",
  "front hair",
  "headwear",
];

export const SWAY_LAYERS = {
  "back hair": { rotate: 1.8, x: 2.5, y: 1.4, origin: "50% 8%" },
  "front hair": { rotate: 1.2, x: 1.6, y: 0.9, origin: "50% 0%" },
  earwear: { rotate: 5, x: 0.6, y: 2.8, origin: "50% 0%" },
  bottomwear: { rotate: 0.6, x: 0.8, y: 0.8, origin: "50% 0%" },
};

export const BLINK_SEQUENCE = [
  { at: 0, eyeScale: 1 },
  { at: 55, eyeScale: 0.2 },
  { at: 95, eyeScale: 0.04 },
  { at: 145, eyeScale: 0.2 },
  { at: 210, eyeScale: 1 },
];

export const MOUTH_SHAPES = {
  rest: {
    viewBox: "0 0 64 40",
    path: "M19 22 C29 27 39 27 48 21",
    width: 4,
    fill: "none",
  },
  smile: {
    viewBox: "0 0 64 40",
    path: "M17 20 C29 32 42 32 51 19",
    width: 4.5,
    fill: "none",
  },
  a: {
    viewBox: "0 0 64 40",
    path: "M20 18 C26 10 41 10 48 18 C47 34 23 35 20 18 Z",
    width: 2.2,
    fill: "#5b2b2c",
  },
  i: {
    viewBox: "0 0 64 40",
    path: "M18 22 C28 27 40 27 50 22 C42 30 27 30 18 22 Z",
    width: 2.1,
    fill: "#5b2b2c",
  },
  u: {
    viewBox: "0 0 64 40",
    path: "M25 19 C31 15 39 15 44 19 C44 28 26 28 25 19 Z",
    width: 2.1,
    fill: "#5b2b2c",
  },
  o: {
    viewBox: "0 0 64 40",
    path: "M23 20 C23 10 47 10 47 20 C47 33 23 33 23 20 Z",
    width: 2.2,
    fill: "#5b2b2c",
  },
};

export const SPRITE_MOUTH_SHAPES = {
  a: {
    file: "expressions/mouth-a.png",
    frame: { x: 618, y: 212, width: 28, height: 34 },
  },
  i: {
    file: "expressions/mouth-i.png",
    frame: { x: 625, y: 214, width: 14, height: 28 },
  },
  u: {
    file: "expressions/mouth-u.png",
    frame: { x: 621, y: 216, width: 22, height: 26 },
  },
  o: {
    file: "expressions/mouth-o.png",
    frame: { x: 621, y: 216, width: 22, height: 26 },
  },
  e: {
    file: "expressions/mouth-e.png",
    frame: { x: 613, y: 217, width: 36, height: 20 },
  },
};

export const EXPRESSION_PRESETS = {
  neutral: {
    label: "默认",
    hideBaseEyes: false,
    lockMouth: false,
    mouth: null,
    overlays: [],
  },
  happy: {
    label: "开心",
    hideBaseEyes: true,
    lockMouth: true,
    mouth: "smile",
    overlays: [
      {
        id: "happy-eye-r",
        file: "expressions/eye-happy-r.png",
        frame: { x: 573, y: 185, width: 44, height: 11 },
      },
      {
        id: "happy-eye-l",
        file: "expressions/eye-happy-l.png",
        frame: { x: 639, y: 176, width: 44, height: 11 },
      },
    ],
  },
  surprise: {
    label: "惊讶",
    hideBaseEyes: false,
    lockMouth: true,
    mouth: "o",
    overlays: [],
  },
};

export function pickMouthShape(energy, syllableIndex) {
  if (energy < 0.06) {
    return "rest";
  }

  if (energy > 0.55) {
    return syllableIndex % 2 === 0 ? "a" : "o";
  }

  if (energy > 0.32) {
    return syllableIndex % 3 === 0 ? "u" : "a";
  }

  return syllableIndex % 2 === 0 ? "smile" : "i";
}

export function orderLayers(layers) {
  const weights = new Map(LAYER_ORDER.map((name, index) => [name, index]));

  return [...layers].sort((a, b) => {
    const aWeight = weights.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bWeight = weights.get(b.name) ?? Number.MAX_SAFE_INTEGER;

    if (aWeight !== bWeight) {
      return aWeight - bWeight;
    }

    return a.index - b.index;
  });
}
