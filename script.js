const deviceSequence = document.querySelector(".device-sequence");
const quietWord = document.querySelector(".quiet-word");
const hero = document.querySelector(".hero");

const firstFrame = 18;
const lastFrame = 48;
const frameDuration = 1000 / (24 * 1.1);
const quietWordFrameDefault = 11;
const quietWordFrameDesktop = quietWordFrameDefault - 2;
const quietWordRevealFrames = 6;
const sequenceFrames = Array.from({ length: lastFrame - firstFrame + 1 }, (_, index) => {
  const frame = String(firstFrame + index).padStart(4, "0");
  return `assets/test-2-sequence-webp/test${frame}.webp`;
});

const preloadedFrames = sequenceFrames.map((src) => {
  const image = new Image();
  image.src = src;
  return image;
});

let frameIndex = 0;
let lastFrameTime = 0;
let quietWordMode = "";

function getQuietWordMode() {
  return window.matchMedia("(max-width: 720px)").matches ? "mobile" : "desktop";
}

function getQuietWordText(mode) {
  return mode === "mobile" ? "SSSSHT" : "SSSSSHT";
}

function syncQuietWordText() {
  const nextMode = getQuietWordMode();
  if (nextMode === quietWordMode) return;

  quietWordMode = nextMode;
  quietWord.textContent = getQuietWordText(nextMode);
  updateQuietWordMask();
}

function getQuietWordFrame() {
  return getQuietWordMode() === "desktop" ? quietWordFrameDesktop : quietWordFrameDefault;
}

function easeInCubic(value) {
  return value * value * value;
}

function updateQuietWordMask() {
  const revealStart = getQuietWordFrame();
  const revealProgress = Math.max(0, Math.min((frameIndex - revealStart) / quietWordRevealFrames, 1));
  const maskWidth = easeInCubic(revealProgress) * 50.5;
  const maskSize = `${maskWidth}% 100%, ${maskWidth}% 100%`;

  quietWord.style.maskSize = maskSize;
  quietWord.style.webkitMaskSize = maskSize;
}

function animateSequence(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;

  if (timestamp - lastFrameTime >= frameDuration) {
    frameIndex = Math.min(frameIndex + 1, sequenceFrames.length - 1);
    deviceSequence.src = preloadedFrames[frameIndex].src;
    lastFrameTime = timestamp;
    updateQuietWordMask();
  }

  if (frameIndex < sequenceFrames.length - 1) {
    requestAnimationFrame(animateSequence);
  } else {
    hero.classList.add("copy-visible");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  syncQuietWordText();
  requestAnimationFrame(animateSequence);
});

window.addEventListener("resize", syncQuietWordText);
