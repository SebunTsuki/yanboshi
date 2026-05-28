import {
  BLINK_SEQUENCE,
  BREATH_LAYERS,
  EYE_LAYERS,
  EXPRESSION_BASE_LAYERS,
  EXPRESSION_PRESETS,
  HEAD_LAYERS,
  MOUTH_SHAPES,
  SPRITE_MOUTH_SHAPES,
  hiddenBaseLayersForPreset,
  SWAY_LAYERS,
  orderLayers,
  pickMouthShape,
} from "./puppetConfig.js?v=20260528-1047";

const DEFAULT_TEXT =
  "欢迎来到悠然时光游戏周报。本周我们先看三条值得关注的游戏资讯，再聊一款适合周末开局的桌游。";

export class Web2DPuppet {
  constructor(root, manifest, options = {}) {
    this.root = root;
    this.manifest = manifest;
    this.assetBase = options.assetBase ?? "./assets/puppet/";
    this.scriptText = options.scriptText ?? DEFAULT_TEXT;
    this.layerElements = new Map();
    this.startedAt = 0;
    this.lastBlinkAt = 0;
    this.nextBlinkDelay = 1800;
    this.blinkStartedAt = null;
    this.syllableIndex = 0;
    this.lastMouthAt = 0;
    this.isSpeaking = true;
    this.manualEnergy = 0;
    this.audio = null;
    this.animationFrame = 0;
    this.currentExpression = "neutral";
    this.expressionOverlays = new Map();
    this.handleResize = () => this.fitStage();
  }

  mount() {
    this.root.innerHTML = "";
    this.root.style.setProperty("--canvas-width", this.manifest.canvas.width);
    this.root.style.setProperty("--canvas-height", this.manifest.canvas.height);

    const stage = document.createElement("div");
    stage.className = "puppet-stage";
    stage.style.aspectRatio = `${this.manifest.canvas.width} / ${this.manifest.canvas.height}`;

    for (const layer of orderLayers(this.manifest.layers)) {
      const image = document.createElement("img");
      image.className = this.classNameForLayer(layer.name);
      image.dataset.layer = layer.name;
      image.alt = "";
      image.draggable = false;
      image.src = new URL(layer.file, new URL(this.assetBase, window.location.href)).toString();
      image.style.left = `${layer.x}px`;
      image.style.top = `${layer.y}px`;
      image.style.width = `${layer.width}px`;
      image.style.height = `${layer.height}px`;
      const baseOpacity = `${layer.opacity / 255}`;
      image.dataset.baseOpacity = baseOpacity;
      image.style.opacity = baseOpacity;

      if (layer.name === "mouth") {
        image.classList.add("is-source-mouth");
        image.dataset.sourceOpacity = baseOpacity;
        image.style.opacity = "0";
      }

      stage.append(image);
      this.layerElements.set(layer.name, image);
    }

    const mouth = this.createProceduralMouth();
    stage.append(mouth);
    this.proceduralMouth = mouth;

    const spriteMouth = this.createSpriteMouth();
    stage.append(spriteMouth);
    this.spriteMouth = spriteMouth;

    for (const preset of Object.values(EXPRESSION_PRESETS)) {
      for (const overlay of preset.overlays) {
        const image = this.createExpressionOverlay(overlay);
        stage.append(image);
        this.expressionOverlays.set(overlay.id, image);
      }
    }

    this.root.append(stage);
    this.stage = stage;
    this.setExpression(this.currentExpression);
    this.fitStage();
    window.addEventListener("resize", this.handleResize);

    return this;
  }

  start() {
    this.startedAt = performance.now();
    this.lastBlinkAt = this.startedAt;
    this.lastMouthAt = this.startedAt;
    this.animationFrame = requestAnimationFrame((time) => this.tick(time));
  }

  stop() {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.handleResize);
  }

  setSpeaking(value) {
    this.isSpeaking = value;
  }

  setManualEnergy(value) {
    this.manualEnergy = Math.max(0, Math.min(1, value));
  }

  setAudioEnergy(value) {
    this.audio = Math.max(0, Math.min(1, value));
  }

  setExpression(name) {
    const preset = EXPRESSION_PRESETS[name] ?? EXPRESSION_PRESETS.neutral;
    this.currentExpression = EXPRESSION_PRESETS[name] ? name : "neutral";
    const hiddenBaseLayers = new Set(hiddenBaseLayersForPreset(preset));

    for (const layerName of EXPRESSION_BASE_LAYERS) {
      this.setExpressionLayerHidden(layerName, hiddenBaseLayers.has(layerName));
    }

    for (const element of this.expressionOverlays.values()) {
      element.hidden = true;
    }

    for (const overlay of preset.overlays) {
      const element = this.expressionOverlays.get(overlay.id);
      if (element) {
        element.hidden = false;
      }
    }

    this.applyMouthShape(preset.mouth ?? "rest");
  }

  classNameForLayer(name) {
    const safe = name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    const groups = [];

    if (EYE_LAYERS.includes(name)) groups.push("eye-layer");
    if (HEAD_LAYERS.includes(name)) groups.push("head-layer");
    if (BREATH_LAYERS.includes(name)) groups.push("breath-layer");
    if (SWAY_LAYERS[name]) groups.push("sway-layer");

    return ["puppet-layer", `layer-${safe}`, ...groups].join(" ");
  }

  createProceduralMouth() {
    const anchor = this.manifest.mouthAnchor;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    svg.classList.add("procedural-mouth");
    svg.setAttribute("viewBox", MOUTH_SHAPES.rest.viewBox);
    svg.style.left = `${anchor.x - anchor.width / 2}px`;
    svg.style.top = `${anchor.y - anchor.height / 2}px`;
    svg.style.width = `${anchor.width}px`;
    svg.style.height = `${anchor.height}px`;

    path.classList.add("mouth-path");
    svg.append(path);
    this.mouthPath = path;
    this.applyMouthShape("rest");

    return svg;
  }

  createSpriteMouth() {
    const image = document.createElement("img");
    image.className = "sprite-mouth";
    image.alt = "";
    image.draggable = false;
    image.hidden = true;
    image.dataset.shape = "rest";

    return image;
  }

  createExpressionOverlay(overlay) {
    const image = document.createElement("img");
    image.className = "expression-overlay head-layer";
    image.dataset.expressionOverlay = overlay.id;
    image.alt = "";
    image.draggable = false;
    image.hidden = true;
    image.src = new URL(overlay.file, new URL(this.assetBase, window.location.href)).toString();
    image.style.left = `${overlay.frame.x}px`;
    image.style.top = `${overlay.frame.y}px`;
    image.style.width = `${overlay.frame.width}px`;
    image.style.height = `${overlay.frame.height}px`;

    return image;
  }

  setExpressionLayerHidden(layerName, hidden) {
    const element = this.layerElements.get(layerName);

    if (!element) {
      return;
    }

    element.classList.toggle("is-expression-hidden", hidden);
    element.style.opacity = hidden ? "0" : (element.dataset.baseOpacity ?? "1");
  }

  setSourceMouthVisible(visible, shapeName = "rest") {
    const sourceMouth = this.layerElements.get("mouth");

    if (!sourceMouth) {
      return false;
    }

    sourceMouth.classList.toggle("is-active-source-mouth", visible);
    sourceMouth.dataset.shape = shapeName;
    sourceMouth.style.opacity = visible ? (sourceMouth.dataset.sourceOpacity ?? "1") : "0";

    return true;
  }

  fitStage() {
    if (!this.stage) {
      return;
    }

    const bounds = this.root.getBoundingClientRect();
    const scale = Math.min(
      bounds.width / this.manifest.canvas.width,
      bounds.height / this.manifest.canvas.height,
    );

    this.stage.style.setProperty("--stage-scale", `${scale}`);
  }

  tick(time) {
    const elapsed = time - this.startedAt;
    this.updateBodyMotion(elapsed);
    this.updateBlink(time);
    this.updateMouth(time, elapsed);
    this.animationFrame = requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  updateBodyMotion(elapsed) {
    const breath = Math.sin(elapsed / 820);
    const head = Math.sin(elapsed / 1700);

    this.stage.style.setProperty("--breath-y", `${breath * -5}px`);
    this.stage.style.setProperty("--breath-scale", `${1 + (breath + 1) * 0.0024}`);
    this.stage.style.setProperty("--head-rotate", `${head * 1.2}deg`);
    this.stage.style.setProperty("--head-x", `${head * 2.2}px`);

    for (const [name, element] of this.layerElements) {
      const sway = SWAY_LAYERS[name];

      if (!sway) continue;

      const wave = Math.sin(elapsed / 1150 + name.length);
      element.style.setProperty("--sway-x", `${wave * sway.x}px`);
      element.style.setProperty("--sway-y", `${wave * sway.y}px`);
      element.style.setProperty("--sway-rotate", `${wave * sway.rotate}deg`);
      element.style.transformOrigin = sway.origin;
    }
  }

  updateBlink(time) {
    if (this.blinkStartedAt === null && time - this.lastBlinkAt > this.nextBlinkDelay) {
      this.blinkStartedAt = time;
    }

    if (this.blinkStartedAt === null) {
      this.stage.style.setProperty("--eye-scale", "1");
      return;
    }

    const elapsed = time - this.blinkStartedAt;
    let frame = BLINK_SEQUENCE[BLINK_SEQUENCE.length - 1];

    for (const next of BLINK_SEQUENCE) {
      if (elapsed >= next.at) {
        frame = next;
      }
    }

    this.stage.style.setProperty("--eye-scale", `${frame.eyeScale}`);

    if (elapsed > BLINK_SEQUENCE[BLINK_SEQUENCE.length - 1].at + 30) {
      this.blinkStartedAt = null;
      this.lastBlinkAt = time;
      this.nextBlinkDelay = 1700 + Math.random() * 2600;
      this.stage.style.setProperty("--eye-scale", "1");
    }
  }

  updateMouth(time, elapsed) {
    if (time - this.lastMouthAt < 92) {
      return;
    }

    const energy = this.currentEnergy(elapsed);
    const shouldMoveMouth = this.isSpeaking || this.manualEnergy > 0 || this.audio !== null;
    const preset = EXPRESSION_PRESETS[this.currentExpression] ?? EXPRESSION_PRESETS.neutral;
    const shape = preset.lockMouth
      ? (preset.mouth ?? "rest")
      : (shouldMoveMouth ? pickMouthShape(energy, this.syllableIndex) : (preset.mouth ?? "rest"));

    this.applyMouthShape(shape);
    this.syllableIndex += 1;
    this.lastMouthAt = time;
  }

  currentEnergy(elapsed) {
    if (this.audio !== null) {
      return this.audio;
    }

    if (this.manualEnergy > 0) {
      return this.manualEnergy;
    }

    const speechWave = Math.abs(Math.sin(elapsed / 125)) * 0.62;
    const cadence = Math.abs(Math.sin(elapsed / 380)) * 0.22;
    return Math.min(0.82, speechWave + cadence);
  }

  applyMouthShape(name) {
    const sprite = SPRITE_MOUTH_SHAPES[name];

    if (sprite && this.spriteMouth) {
      this.setSourceMouthVisible(false, name);
      this.spriteMouth.hidden = false;
      this.spriteMouth.src = new URL(sprite.file, new URL(this.assetBase, window.location.href)).toString();
      this.spriteMouth.style.left = `${sprite.frame.x}px`;
      this.spriteMouth.style.top = `${sprite.frame.y}px`;
      this.spriteMouth.style.width = `${sprite.frame.width}px`;
      this.spriteMouth.style.height = `${sprite.frame.height}px`;
      this.spriteMouth.dataset.shape = name;

      if (this.proceduralMouth) {
        this.proceduralMouth.hidden = true;
      }

      return;
    }

    if (this.spriteMouth) {
      this.spriteMouth.hidden = true;
    }

    if (this.setSourceMouthVisible(true, name)) {
      if (this.proceduralMouth) {
        this.proceduralMouth.hidden = true;
      }
      return;
    }

    const shape = MOUTH_SHAPES[name] ?? MOUTH_SHAPES.rest;
    if (this.proceduralMouth) {
      this.proceduralMouth.hidden = false;
    }
    this.proceduralMouth?.setAttribute("viewBox", shape.viewBox);
    this.mouthPath?.setAttribute("d", shape.path);
    this.mouthPath?.setAttribute("stroke-width", `${shape.width}`);
    this.mouthPath?.setAttribute("fill", shape.fill);
    if (this.proceduralMouth) {
      this.proceduralMouth.dataset.shape = name;
    }
  }
}

export async function loadManifest(path = "./assets/puppet/manifest.json") {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load puppet manifest: ${response.status}`);
  }

  return response.json();
}
