import { Web2DPuppet, loadManifest } from "./puppetRuntime.js?v=20260528-1047";

const ASSET_VERSION = "20260528-1047";

const root = document.querySelector("#puppet-root");
const status = document.querySelector("#status");
const speakToggle = document.querySelector("#speak-toggle");
const energyInput = document.querySelector("#energy");
const resetButton = document.querySelector("#reset");
const expressionButtons = document.querySelectorAll("[data-expression]");

let puppet;
const initialExpression = new URLSearchParams(window.location.search).get("expression") ?? "neutral";

async function boot() {
  try {
    const manifest = await loadManifest(`./assets/puppet/manifest.json?v=${ASSET_VERSION}`);
    puppet = new Web2DPuppet(root, manifest).mount();
    puppet.setExpression(initialExpression);
    setActiveExpression(initialExpression);
    puppet.start();
    status.textContent = "v0.1 running";
  } catch (error) {
    status.textContent = "load failed";
    console.error(error);
  }
}

speakToggle.addEventListener("change", () => {
  puppet?.setSpeaking(speakToggle.checked);
});

energyInput.addEventListener("input", () => {
  puppet?.setManualEnergy(Number(energyInput.value));
});

resetButton.addEventListener("click", () => {
  energyInput.value = "0";
  speakToggle.checked = true;
  puppet?.setManualEnergy(0);
  puppet?.setSpeaking(true);
  puppet?.setExpression("neutral");
  setActiveExpression("neutral");
});

for (const button of expressionButtons) {
  button.addEventListener("click", () => {
    const expression = button.dataset.expression ?? "neutral";
    puppet?.setExpression(expression);
    setActiveExpression(expression);
  });
}

function setActiveExpression(expression) {
  for (const button of expressionButtons) {
    button.classList.toggle("is-active", button.dataset.expression === expression);
  }
}

boot();
