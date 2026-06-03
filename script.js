const deviceSequence = document.querySelector(".device-sequence");
const quietWord = document.querySelector(".quiet-word");
const hero = document.querySelector(".hero");
const intro = document.querySelector(".intro");

const firstFrame = 18;
const lastFrame = 48;
const frameDuration = 1000 / (24 * 1.1);
const quietWordFrameDefault = 11;
const quietWordFrameDesktop = quietWordFrameDefault - 2;
const quietWordRevealFrames = 6;
const scrollTitleVisibleFrame = 11;
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
let introAnimationComplete = false;
let scrollTicking = false;
let lastScrollY = window.scrollY;
let scrollingUp = false;

function getQuietWordMode() {
  if (window.matchMedia("(max-width: 390px)").matches) return "mini";
  return window.matchMedia("(max-width: 720px)").matches ? "mobile" : "desktop";
}

function getQuietWordText(mode) {
  if (mode === "mini") return "SSSSHT";
  return mode === "mobile" ? "SSSS HT" : "SSSSSHT";
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
    introAnimationComplete = true;
    hero.classList.add("copy-visible");
    updateDeviceFromScroll();
  }
}

function loadImage(src) {
  const image = new Image();
  image.src = src;

  if (image.complete) {
    return Promise.resolve(image);
  }

  return new Promise((resolve) => {
    image.onload = () => resolve(image);
    image.onerror = () => resolve(image);
  });
}

function waitForHeroAssets() {
  return Promise.all([
    loadImage("assets/noise-texture-background.jpg"),
    loadImage("assets/group-2.svg"),
    ...sequenceFrames.map(loadImage),
  ]);
}

function updateDeviceFromScroll() {
  if (!introAnimationComplete) return;

  const reverseDistance = window.innerHeight * 0.45;
  const progress = Math.max(0, Math.min(window.scrollY / reverseDistance, 1));
  const nextFrameIndex = Math.round((1 - progress) * (sequenceFrames.length - 1));

  if (nextFrameIndex !== frameIndex) {
    frameIndex = nextFrameIndex;
    deviceSequence.src = preloadedFrames[frameIndex].src;
  }

  const fullMask = "50.5% 100%, 50.5% 100%";
  quietWord.style.maskSize = fullMask;
  quietWord.style.webkitMaskSize = fullMask;

  const quietWordRect = quietWord.getBoundingClientRect();
  const introRect = intro.getBoundingClientRect();
  hero.classList.toggle("scrolling-up", scrollingUp);
  hero.classList.toggle("button-pinned", introRect.bottom < 0);
  hero.classList.toggle("quiet-word-fading", quietWordRect.top < window.innerHeight * 0.5);
  hero.classList.toggle("scroll-title-visible", frameIndex <= scrollTitleVisibleFrame);
}

function requestScrollUpdate() {
  const currentScrollY = window.scrollY;
  scrollingUp = currentScrollY < lastScrollY;
  lastScrollY = currentScrollY;

  if (scrollTicking) return;

  scrollTicking = true;
  requestAnimationFrame(() => {
    updateDeviceFromScroll();
    scrollTicking = false;
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  syncQuietWordText();
  await waitForHeroAssets();
  document.body.classList.add("assets-ready");
  requestAnimationFrame(animateSequence);
});

window.addEventListener("resize", syncQuietWordText);
window.addEventListener("scroll", requestScrollUpdate, { passive: true });
window.addEventListener("resize", requestScrollUpdate);
