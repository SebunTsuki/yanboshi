import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const version = "20260528-1047";
const videoWidth = 1280;
const videoHeight = 720;
const projectUrl = `http://localhost:4173/?v=${version}`;
const outputBase = "C:/Users/Administrator/Downloads/yanboshi-web2d-match-test";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const debugPort = 9347;
const profileDir = join(tmpdir(), `yanboshi-video-${Date.now()}`);

if (!existsSync(chromePath)) {
  throw new Error(`Chrome not found at ${chromePath}`);
}

await mkdir(profileDir, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  `--window-size=${videoWidth},${videoHeight}`,
  projectUrl,
], {
  stdio: "ignore",
});

try {
  const pageTarget = await waitForPageTarget();
  const client = await connectCdp(pageTarget.webSocketDebuggerUrl);

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await sleep(1500);

  const result = await client.send("Runtime.evaluate", {
    expression: `(${recordVideo.toString()})(${JSON.stringify({
      durationMs: 12000,
      fps: 30,
      height: videoHeight,
      version,
      width: videoWidth,
    })})`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }

  const metadata = result.result.value;
  const ext = metadata.mimeType.includes("mp4") ? "mp4" : "webm";
  const outputPath = `${outputBase}.${ext}`;
  const base64 = await readWindowBase64(client, metadata.base64Length);

  await writeFile(outputPath, Buffer.from(base64, "base64"));
  console.log(JSON.stringify({ outputPath, ...metadata }, null, 2));

  client.close();
} finally {
  await stopChrome(chrome);
  await removeProfile(profileDir);
}

async function waitForPageTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json`);
      const target = targets.find((item) => item.type === "page");

      if (target?.webSocketDebuggerUrl) {
        return target;
      }
    } catch {
      // Chrome is still starting.
    }

    await sleep(120);
  }

  throw new Error("Timed out waiting for Chrome DevTools target.");
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }

  return response.json();
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data);

    if (!message.id) {
      return;
    }

    const callbacks = pending.get(message.id);

    if (!callbacks) {
      return;
    }

    pending.delete(message.id);

    if (message.error) {
      callbacks.reject(new Error(JSON.stringify(message.error)));
    } else {
      callbacks.resolve(message.result);
    }
  });

  return {
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;

      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function readWindowBase64(client, length) {
  const chunkSize = 350000;
  let output = "";

  for (let offset = 0; offset < length; offset += chunkSize) {
    const result = await client.send("Runtime.evaluate", {
      expression: `window.__yanboshiVideoBase64.slice(${offset}, ${offset + chunkSize})`,
      returnByValue: true,
    });

    output += result.result.value;
  }

  return output;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopChrome(chromeProcess) {
  if (chromeProcess.exitCode !== null || chromeProcess.signalCode !== null) {
    return;
  }

  chromeProcess.kill();

  await new Promise((resolve) => {
    chromeProcess.once("exit", resolve);
  });
}

async function removeProfile(path) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 5) {
        console.warn(`Unable to remove temporary Chrome profile: ${error.message}`);
        return;
      }

      await sleep(250);
    }
  }
}

async function recordVideo(options) {
  const config = await import(`./src/puppetConfig.js?v=${options.version}`);
  const manifest = await fetch(`./assets/puppet/manifest.json?v=${options.version}`).then((response) => response.json());
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = options.width;
  canvas.height = options.height;
  canvas.style.width = `${options.width}px`;
  canvas.style.height = `${options.height}px`;
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.background = "#101419";
  document.body.append(canvas);

  const orderedLayers = config.orderLayers(manifest.layers);
  const puppetBase = new URL("./assets/puppet/", location.href);
  const layerImages = new Map();
  const extraImages = new Map();

  await Promise.all(orderedLayers.map(async (layer) => {
    layerImages.set(layer.name, await loadImage(new URL(layer.file, puppetBase).toString()));
  }));

  const extraFiles = new Set();

  for (const mouth of Object.values(config.SPRITE_MOUTH_SHAPES)) {
    extraFiles.add(mouth.file);
  }

  for (const preset of Object.values(config.EXPRESSION_PRESETS)) {
    for (const overlay of preset.overlays) {
      extraFiles.add(overlay.file);
    }
  }

  await Promise.all([...extraFiles].map(async (file) => {
    extraImages.set(file, await loadImage(new URL(file, puppetBase).toString()));
  }));

  const stream = canvas.captureStream(options.fps);
  const supportedTypes = [
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 2400000,
  });
  const done = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const startTime = performance.now();
  recorder.start(500);

  await new Promise((resolve) => {
    function frame(now) {
      const elapsed = now - startTime;
      const t = elapsed / 1000;

      drawFrame(t);

      if (elapsed < options.durationMs) {
        requestAnimationFrame(frame);
      } else {
        recorder.stop();
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });

  await done;

  const blob = new Blob(chunks, { type: mimeType });
  const base64 = await blobToBase64(blob);
  window.__yanboshiVideoBase64 = base64;

  return {
    base64Length: base64.length,
    bytes: blob.size,
    durationMs: options.durationMs,
    mimeType: blob.type || mimeType || "video/webm",
  };

  function drawFrame(t) {
    const expressionName = t < 4 ? "neutral" : (t < 8 ? "surprise" : "happy");
    const preset = config.EXPRESSION_PRESETS[expressionName] || config.EXPRESSION_PRESETS.neutral;
    const hiddenBaseLayers = new Set(config.hiddenBaseLayersForPreset(preset));
    const syllableIndex = Math.floor(t * 10);
    const energy = Math.min(0.84, Math.abs(Math.sin(t * 8.4)) * 0.62 + Math.abs(Math.sin(t * 2.5)) * 0.22);
    const mouthShape = preset.lockMouth
      ? (preset.mouth || "rest")
      : config.pickMouthShape(energy, syllableIndex);
    const spriteMouth = config.SPRITE_MOUTH_SHAPES[mouthShape];

    drawBackground(t, expressionName);

    for (const layer of orderedLayers) {
      if (hiddenBaseLayers.has(layer.name)) {
        continue;
      }

      if (layer.name === "mouth" && spriteMouth) {
        continue;
      }

      drawPuppetImage(layerImages.get(layer.name), layer, layer.name, t);
    }

    if (spriteMouth) {
      drawPuppetImage(extraImages.get(spriteMouth.file), {
        ...spriteMouth.frame,
        opacity: 255,
      }, "mouth", t, { head: true, breath: true });
    }

    for (const overlay of preset.overlays) {
      drawPuppetImage(extraImages.get(overlay.file), {
        ...overlay.frame,
        opacity: 255,
      }, overlay.id, t, { head: true, breath: true });
    }

    drawForeground(t, expressionName);
  }

  function drawPuppetImage(image, frame, layerName, t, flags = {}) {
    if (!image) {
      return;
    }

    const puppetScale = 0.58;
    const puppetX = 85;
    const puppetY = 15;
    const breath = Math.sin(t * 1000 / 820);
    const head = Math.sin(t * 1000 / 1700);
    const isBreath = flags.breath || config.BREATH_LAYERS.includes(layerName);
    const isHead = flags.head || config.HEAD_LAYERS.includes(layerName);
    const sway = config.SWAY_LAYERS[layerName];
    const centerX = frame.x + frame.width / 2;
    const centerY = frame.y + frame.height / 2;
    let dx = 0;
    let dy = 0;
    let rotate = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (isBreath) {
      dy += breath * -5;
      scaleX *= 1 + (breath + 1) * 0.0024;
      scaleY *= 1 + (breath + 1) * 0.0024;
    }

    if (isHead) {
      dx += head * 2.2;
      rotate += head * 1.2 * Math.PI / 180;
    }

    if (sway) {
      const wave = Math.sin(t * 1000 / 1150 + layerName.length);
      dx += wave * sway.x;
      dy += wave * sway.y;
      rotate += wave * sway.rotate * Math.PI / 180;
    }

    if (config.EYE_LAYERS.includes(layerName)) {
      scaleY *= eyeScaleAt(t);
    }

    ctx.save();
    ctx.translate(puppetX, puppetY);
    ctx.scale(puppetScale, puppetScale);
    ctx.translate(centerX + dx, centerY + dy);
    ctx.rotate(rotate);
    ctx.scale(scaleX, scaleY);
    ctx.globalAlpha = (frame.opacity ?? 255) / 255;
    ctx.drawImage(image, -frame.width / 2, -frame.height / 2, frame.width, frame.height);
    ctx.restore();
  }

  function drawBackground(t, expressionName) {
    const gradient = ctx.createLinearGradient(0, 0, options.width, options.height);
    gradient.addColorStop(0, "#14201f");
    gradient.addColorStop(0.5, "#101419");
    gradient.addColorStop(1, "#080b0e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, options.width, options.height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#6fd6bd";
    ctx.lineWidth = 1;

    for (let x = -40 + (t * 10) % 40; x < options.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, options.height);
      ctx.stroke();
    }

    for (let y = -40 + (t * 5) % 40; y < options.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(options.width, y);
      ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = "rgba(6, 10, 12, 0.62)";
    roundRect(780, 78, 370, 198, 12);
    ctx.fill();

    ctx.fillStyle = "#f6f3ec";
    ctx.font = "700 34px Microsoft YaHei, sans-serif";
    ctx.fillText("\u60a0\u7136\u65f6\u5149", 810, 130);
    ctx.font = "20px Microsoft YaHei, sans-serif";
    ctx.fillStyle = "#b9c4c0";
    ctx.fillText("Web2D \u4e3b\u64ad\u5339\u914d\u6d4b\u8bd5", 810, 166);
    ctx.fillText(`\u72b6\u6001\uff1a${stateLabel(expressionName)}`, 810, 202);

    ctx.fillStyle = "rgba(255, 155, 74, 0.95)";
    roundRect(810, 230, 250, 24, 12);
    ctx.fill();
  }

  function drawForeground(t, expressionName) {
    ctx.fillStyle = "rgba(10, 14, 16, 0.78)";
    roundRect(70, 620, 700, 54, 12);
    ctx.fill();
    ctx.fillStyle = "#f6f3ec";
    ctx.font = "700 22px Microsoft YaHei, sans-serif";
    ctx.fillText("\u6e38\u620f\u5468\u62a5\u8bd5\u64ad\uff1a\u53e3\u578b\u3001\u8868\u60c5\u3001\u5e3d\u5b50\u4e0e\u539f\u8863\u670d\u642d\u914d", 98, 654);

    const progress = Math.min(1, t / (options.durationMs / 1000));
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    roundRect(780, 300, 370, 10, 5);
    ctx.fill();
    ctx.fillStyle = expressionName === "happy" ? "#6fd6bd" : "#ff9b4a";
    roundRect(780, 300, 370 * progress, 10, 5);
    ctx.fill();
  }

  function eyeScaleAt(t) {
    const period = 2.9;
    const local = (t % period) * 1000;

    if (local < 55) return 1;
    if (local < 95) return 0.2;
    if (local < 145) return 0.04;
    if (local < 210) return 0.2;
    return 1;
  }

  function stateLabel(name) {
    if (name === "surprise") return "\u60ca\u8bb6\u53e3\u578b";
    if (name === "happy") return "\u5f00\u5fc3\u8868\u60c5";
    return "\u9ed8\u8ba4\u64ad\u62a5";
  }

  function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
      image.src = src;
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
