const deviceSequence = document.querySelector(".device-sequence");
const quietWord = document.querySelector(".quiet-word");
const hero = document.querySelector(".hero");
const intro = document.querySelector(".intro");
const scrollHeading = document.querySelector(".scroll-title h2");
const scrollDescription = document.querySelector(".scroll-description");
const scrollImage = document.querySelector(".scroll-image");
const dissolveCanvas = document.querySelector(".dissolve-canvas");
const gl = dissolveCanvas.getContext("webgl", {
  alpha: true,
  antialias: true,
  premultipliedAlpha: false,
});

const firstFrame = 18;
const lastFrame = 48;
const frameDuration = 1000 / (24 * 1.1);
const quietWordFrameDefault = 11;
const quietWordFrameDesktop = quietWordFrameDefault - 2;
const quietWordRevealFrames = 6;
const scrollTitleVisibleFrame = 11;
const particleStride = 14;
const sequenceFrames = Array.from({ length: lastFrame - firstFrame + 1 }, (_, index) => {
  const frame = String(firstFrame + index).padStart(4, "0");
  return `assets/test-2-sequence-webp/test${frame}.webp`;
});

const defaultShaderSettings = {
  titleDensity: 12,
  titleSize: 2.4,
  titleWave: 130,
  titleFrequency: 6.2,
  titleScatter: 130,
  titleCohesion: 0.82,
  titleBands: 3,
  imageDensity: 9,
  imageSize: 2,
  imageWave: 95,
  imageFrequency: 4.4,
  imageScatter: 210,
  imageCohesion: 0.68,
  imageBands: 5,
};

const shaderSettings = { ...defaultShaderSettings };
const preloadedFrames = sequenceFrames.map((src) => {
  const image = new Image();
  image.src = src;
  return image;
});

const dissolveSourceCanvas = document.createElement("canvas");
const dissolveSourceContext = dissolveSourceCanvas.getContext("2d", { willReadFrequently: true });

let frameIndex = 0;
let lastFrameTime = 0;
let quietWordMode = "";
let introAnimationComplete = false;
let scrollTicking = false;
let lastScrollY = window.scrollY;
let scrollingUp = false;
let dissolveProgress = 0;
let dissolveSignature = "";
let dissolveProgram = null;
let dissolveBuffer = null;
let dissolveUniforms = {};
let dissolveAnimationFrame = 0;
let dissolveShaderFailed = false;
let particleCount = 0;
let sourceReadFailed = false;

function getQuietWordMode() {
  if (window.matchMedia("(max-width: 390px)").matches) return "mini";
  return window.matchMedia("(max-width: 720px)").matches ? "mobile" : "desktop";
}

function getQuietWordText(mode) {
  if (mode === "desktop") return "SSSSSHT";
  return "SSSHT";
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

function smoothstep(edge0, edge1, value) {
  const progress = clamp01((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
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
    loadImage("assets/muzel-lifestyle.png"),
    ...sequenceFrames.map(loadImage),
  ]);
}

function clamp01(value) {
  return Math.max(0, Math.min(value, 1));
}

function getDissolveProgress() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const dissolveDistance = Math.max(1, window.innerHeight * 0.2);
  const dissolveStart = Math.max(0, maxScroll - dissolveDistance);

  return clamp01((window.scrollY - dissolveStart) / (maxScroll - dissolveStart));
}

function compileShader(type, source) {
  if (!gl) return null;

  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

  console.warn(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createDissolveProgram() {
  if (dissolveShaderFailed) return false;
  if (!gl || dissolveProgram) return Boolean(dissolveProgram);

  const vertexShader = compileShader(gl.VERTEX_SHADER, `
    attribute vec2 aOrigin;
    attribute vec2 aTarget;
    attribute vec2 aFinalTarget;
    attribute vec4 aColor;
    attribute vec4 aSeed;

    uniform vec2 uResolution;
    uniform float uProgress;
    uniform float uTime;
    uniform float uTitleSize;
    uniform float uTitleWave;
    uniform float uTitleFrequency;
    uniform float uTitleScatter;
    uniform float uTitleCohesion;
    uniform float uImageSize;
    uniform float uImageWave;
    uniform float uImageFrequency;
    uniform float uImageScatter;
    uniform float uImageCohesion;
    uniform vec3 uFinalColor;

    varying vec4 vColor;
    varying float vAlpha;

    float easeOutCubic(float value) {
      return 1.0 - pow(1.0 - value, 3.0);
    }

    void main() {
      float imageGroup = aSeed.w;
      float particleSize = mix(uTitleSize, uImageSize, imageGroup);
      float waveAmplitude = mix(uTitleWave, uImageWave, imageGroup);
      float waveFrequency = mix(uTitleFrequency, uImageFrequency, imageGroup);
      float scatterAmount = mix(uTitleScatter, uImageScatter, imageGroup);
      float cohesion = mix(uTitleCohesion, uImageCohesion, imageGroup);
      float delay = aSeed.x * 0.22;
      float local = clamp((uProgress - delay) / max(0.001, 1.0 - delay), 0.0, 1.0);
      float gather = smoothstep(0.08, 0.7, local) * cohesion;
      float finalMorph = easeOutCubic(smoothstep(0.68, 1.0, local));
      float wavePhase = (aTarget.x / uResolution.x) * waveFrequency * 6.283185 + uTime * 1.45 + aSeed.y * 6.283185;
      vec2 waveTarget = aTarget;
      waveTarget.y += sin(wavePhase) * waveAmplitude * (0.28 + aSeed.z * 0.72);
      waveTarget.y += sin(wavePhase * 0.47 + aSeed.y * 6.283185) * waveAmplitude * 0.22;

      float lift = sin(local * 3.14159);
      vec2 scatter = vec2(
        sin(aSeed.y * 34.0 + uTime * 1.2 + local * 5.0),
        cos(aSeed.z * 41.0 - uTime * 0.9 + local * 4.0)
      ) * scatterAmount * lift;
      vec2 sonicPull = normalize(vec2(1.0, sin(wavePhase) * 0.34)) * scatterAmount * 0.34 * smoothstep(0.5, 0.84, local);
      vec2 wavePosition = mix(aOrigin, waveTarget, easeOutCubic(gather)) + scatter * (1.0 - finalMorph * 0.78) + sonicPull * (1.0 - finalMorph);
      vec2 position = mix(wavePosition, aFinalTarget, finalMorph);

      vec2 clip = position / uResolution * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      gl_PointSize = mix(
        particleSize * (1.0 + lift * 0.8 + aSeed.z * 0.7),
        uTitleSize * (1.0 + aSeed.z * 0.35),
        finalMorph
      );
      vColor = vec4(mix(aColor.rgb, uFinalColor, finalMorph), aColor.a);
      vAlpha = smoothstep(0.02, 0.14, uProgress) * aColor.a;
    }
  `);

  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;

    varying vec4 vColor;
    varying float vAlpha;

    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float falloff = 1.0 - dot(point, point);
      float alpha = smoothstep(0.0, 0.74, falloff) * vAlpha;
      vec3 glow = mix(vColor.rgb, vec3(0.0, 0.6, 0.32), 0.12);
      gl_FragColor = vec4(glow, alpha);
    }
  `);

  if (!vertexShader || !fragmentShader) {
    dissolveShaderFailed = true;
    return false;
  }

  dissolveProgram = gl.createProgram();
  gl.attachShader(dissolveProgram, vertexShader);
  gl.attachShader(dissolveProgram, fragmentShader);
  gl.linkProgram(dissolveProgram);

  if (!gl.getProgramParameter(dissolveProgram, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(dissolveProgram));
    gl.deleteProgram(dissolveProgram);
    dissolveProgram = null;
    dissolveShaderFailed = true;
    return false;
  }

  dissolveBuffer = gl.createBuffer();
  dissolveUniforms = {
    origin: gl.getAttribLocation(dissolveProgram, "aOrigin"),
    target: gl.getAttribLocation(dissolveProgram, "aTarget"),
    finalTarget: gl.getAttribLocation(dissolveProgram, "aFinalTarget"),
    color: gl.getAttribLocation(dissolveProgram, "aColor"),
    seed: gl.getAttribLocation(dissolveProgram, "aSeed"),
    resolution: gl.getUniformLocation(dissolveProgram, "uResolution"),
    progress: gl.getUniformLocation(dissolveProgram, "uProgress"),
    time: gl.getUniformLocation(dissolveProgram, "uTime"),
    titleSize: gl.getUniformLocation(dissolveProgram, "uTitleSize"),
    titleWave: gl.getUniformLocation(dissolveProgram, "uTitleWave"),
    titleFrequency: gl.getUniformLocation(dissolveProgram, "uTitleFrequency"),
    titleScatter: gl.getUniformLocation(dissolveProgram, "uTitleScatter"),
    titleCohesion: gl.getUniformLocation(dissolveProgram, "uTitleCohesion"),
    imageSize: gl.getUniformLocation(dissolveProgram, "uImageSize"),
    imageWave: gl.getUniformLocation(dissolveProgram, "uImageWave"),
    imageFrequency: gl.getUniformLocation(dissolveProgram, "uImageFrequency"),
    imageScatter: gl.getUniformLocation(dissolveProgram, "uImageScatter"),
    imageCohesion: gl.getUniformLocation(dissolveProgram, "uImageCohesion"),
    finalColor: gl.getUniformLocation(dissolveProgram, "uFinalColor"),
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function syncDissolveCanvas() {
  if (!gl) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);

  if (dissolveCanvas.width === width && dissolveCanvas.height === height) return;

  dissolveCanvas.width = width;
  dissolveCanvas.height = height;
  gl.viewport(0, 0, width, height);
}

function getCanvasTextLines(element, context, maxWidth) {
  const styles = getComputedStyle(element);
  let text = element.innerText.trim();

  if (styles.textTransform === "uppercase") {
    text = text.toUpperCase();
  }

  const explicitLines = text.split("\n").filter(Boolean);

  if (explicitLines.length > 1) return explicitLines;

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawTextToDissolveSource(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const styles = getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize);
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;

  dissolveSourceContext.save();
  dissolveSourceContext.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  dissolveSourceContext.textAlign = styles.textAlign === "left" ? "left" : "center";
  dissolveSourceContext.textBaseline = "middle";
  dissolveSourceContext.fillStyle = styles.color;

  const lines = getCanvasTextLines(element, dissolveSourceContext, rect.width);
  const x = dissolveSourceContext.textAlign === "left" ? rect.left : rect.left + rect.width / 2;
  const totalHeight = (lines.length - 1) * lineHeight;
  const firstY = rect.top + rect.height / 2 - totalHeight / 2;

  lines.forEach((line, index) => {
    dissolveSourceContext.fillText(line, x, firstY + index * lineHeight);
  });

  dissolveSourceContext.restore();
}

function resetDissolveSource() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);

  dissolveSourceCanvas.width = width;
  dissolveSourceCanvas.height = height;
  dissolveSourceContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  dissolveSourceContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

  return dpr;
}

function collectSourceParticles(particles, dpr, density, group) {
  const width = dissolveSourceCanvas.width;
  const height = dissolveSourceCanvas.height;
  const step = Math.max(2, 30 - Number(density));
  const stepPx = step * dpr;
  let pixels;

  try {
    pixels = dissolveSourceContext.getImageData(0, 0, width, height).data;
  } catch {
    return false;
  }

  for (let y = 0; y < height; y += stepPx) {
    for (let x = 0; x < width; x += stepPx) {
      const pixelX = Math.floor(x);
      const pixelY = Math.floor(y);
      const pixelIndex = (pixelY * width + pixelX) * 4;
      const alpha = pixels[pixelIndex + 3];

      if (alpha < 42) continue;

      const originX = pixelX / dpr;
      const originY = pixelY / dpr;
      const seedA = Math.abs(Math.sin(originX * 12.9898 + originY * 78.233)) % 1;
      const seedB = Math.abs(Math.sin(originX * 39.346 + originY * 11.135)) % 1;
      const seedC = Math.abs(Math.sin(originX * 6.217 + originY * 72.197)) % 1;

      particles.push({
        originX,
        originY,
        r: pixels[pixelIndex] / 255,
        g: pixels[pixelIndex + 1] / 255,
        b: pixels[pixelIndex + 2] / 255,
        a: alpha / 255,
        seedA,
        seedB,
        seedC,
        group,
      });
    }
  }

  return true;
}

function drawTextSource() {
  resetDissolveSource();
  drawTextToDissolveSource(scrollHeading);
  drawTextToDissolveSource(scrollDescription);
}

function drawImageSource() {
  resetDissolveSource();
  const imageRect = scrollImage.getBoundingClientRect();
  if (imageRect.width > 0 && imageRect.height > 0 && scrollImage.complete) {
    try {
      dissolveSourceContext.drawImage(scrollImage, imageRect.left, imageRect.top, imageRect.width, imageRect.height);
    } catch {
      // Text particles remain available if the image cannot be sampled.
    }
  }
}

function drawComingSoonTargetSource() {
  resetDissolveSource();

  const styles = getComputedStyle(scrollHeading);
  const text = styles.textTransform === "uppercase" ? "COMING SOON" : "Coming soon";
  const maxWidth = Math.min(window.innerWidth - 40, 920);
  const baseFontSize = parseFloat(styles.fontSize);
  let fontSize = baseFontSize;

  dissolveSourceContext.save();
  dissolveSourceContext.textAlign = "center";
  dissolveSourceContext.textBaseline = "middle";
  dissolveSourceContext.fillStyle = styles.color;

  do {
    dissolveSourceContext.font = `${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
    if (dissolveSourceContext.measureText(text).width <= maxWidth || fontSize <= 18) break;
    fontSize -= 1;
  } while (fontSize > 18);

  dissolveSourceContext.fillText(text, window.innerWidth / 2, window.innerHeight / 2);
  dissolveSourceContext.restore();
}

function getColorComponents(color) {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return [0, 0.6, 0.32];

  return match[1].split(",").slice(0, 3).map((channel) => Number.parseFloat(channel) / 255);
}

function getSourceBounds() {
  const headingRect = scrollHeading.getBoundingClientRect();
  const descriptionRect = scrollDescription.getBoundingClientRect();
  const imageRect = scrollImage.getBoundingClientRect();
  const top = Math.min(headingRect.top, descriptionRect.top, imageRect.top);
  const bottom = Math.max(headingRect.bottom, descriptionRect.bottom, imageRect.bottom);

  return {
    top,
    bottom,
    center: top + (bottom - top) * 0.5,
  };
}

function getDissolveSignature() {
  const headingRect = scrollHeading.getBoundingClientRect();
  const imageRect = scrollImage.getBoundingClientRect();

  return [
    window.innerWidth,
    window.innerHeight,
    Math.round(headingRect.top),
    Math.round(headingRect.height),
    Math.round(imageRect.left),
    Math.round(imageRect.top),
    Math.round(imageRect.width),
    shaderSettings.titleDensity,
    shaderSettings.titleBands,
    shaderSettings.imageDensity,
    shaderSettings.imageBands,
  ].join(":");
}

function rebuildParticleBuffer() {
  if (!gl) return;

  sourceReadFailed = false;
  const dpr = resetDissolveSource();
  const bounds = getSourceBounds();
  const particles = [];

  drawTextSource();
  if (!collectSourceParticles(particles, dpr, shaderSettings.titleDensity, 0)) {
    sourceReadFailed = true;
    return;
  }

  drawImageSource();
  collectSourceParticles(particles, dpr, shaderSettings.imageDensity, 1);

  const finalTargets = [];
  drawComingSoonTargetSource();
  collectSourceParticles(
    finalTargets,
    dpr,
    Math.max(shaderSettings.titleDensity, shaderSettings.imageDensity, 24),
    0,
  );

  if (!finalTargets.length) {
    finalTargets.push({
      originX: window.innerWidth / 2,
      originY: window.innerHeight / 2,
    });
  }

  const data = new Float32Array(particles.length * particleStride);
  const waveTop = bounds.center - Math.min(130, window.innerHeight * 0.16);
  const bandGap = Math.min(62, Math.max(28, window.innerHeight * 0.055));
  const titleBandCount = Math.max(1, Math.round(shaderSettings.titleBands));
  const imageBandCount = Math.max(1, Math.round(shaderSettings.imageBands));
  const titleTotal = Math.max(1, particles.filter((particle) => particle.group < 0.5).length - 1);
  const imageTotal = Math.max(1, particles.filter((particle) => particle.group > 0.5).length - 1);
  let titleIndex = 0;
  let imageIndex = 0;

  particles.forEach((particle, index) => {
    const isImage = particle.group > 0.5;
    const bandCount = isImage ? imageBandCount : titleBandCount;
    const groupIndex = isImage ? imageIndex++ : titleIndex++;
    const normalizedIndex = isImage ? groupIndex / imageTotal : groupIndex / titleTotal;
    const groupCenter = isImage ? waveTop + bandGap * 0.75 : waveTop - bandGap * 0.75;
    const band = groupIndex % bandCount;
    const bandOffset = (band - (bandCount - 1) * 0.5) * bandGap;
    const lane = (normalizedIndex * bandCount) % 1;
    const targetX = window.innerWidth * (0.07 + lane * 0.86) + (particle.seedB - 0.5) * 34;
    const targetY = groupCenter + bandOffset + (particle.seedC - 0.5) * 20;
    const finalTarget = finalTargets[Math.floor((index * 1.61803398875 + particle.seedA * finalTargets.length) % finalTargets.length)];
    const offset = index * particleStride;

    data[offset] = particle.originX;
    data[offset + 1] = particle.originY;
    data[offset + 2] = targetX;
    data[offset + 3] = targetY;
    data[offset + 4] = finalTarget.originX;
    data[offset + 5] = finalTarget.originY;
    data[offset + 6] = particle.r;
    data[offset + 7] = particle.g;
    data[offset + 8] = particle.b;
    data[offset + 9] = particle.a;
    data[offset + 10] = particle.seedA;
    data[offset + 11] = particle.seedB;
    data[offset + 12] = particle.seedC;
    data[offset + 13] = particle.group;
  });

  particleCount = particles.length;
  gl.bindBuffer(gl.ARRAY_BUFFER, dissolveBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
}

function renderDissolve(progress) {
  if (!gl || !createDissolveProgram()) return;

  syncDissolveCanvas();
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (progress <= 0) return;

  const signature = getDissolveSignature();
  if (signature !== dissolveSignature) {
    dissolveSignature = signature;
    rebuildParticleBuffer();
  }

  if (!particleCount) return;

  const stride = particleStride * Float32Array.BYTES_PER_ELEMENT;

  gl.useProgram(dissolveProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, dissolveBuffer);
  gl.enableVertexAttribArray(dissolveUniforms.origin);
  gl.enableVertexAttribArray(dissolveUniforms.target);
  gl.enableVertexAttribArray(dissolveUniforms.finalTarget);
  gl.enableVertexAttribArray(dissolveUniforms.color);
  gl.enableVertexAttribArray(dissolveUniforms.seed);
  gl.vertexAttribPointer(dissolveUniforms.origin, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(dissolveUniforms.target, 2, gl.FLOAT, false, stride, 2 * 4);
  gl.vertexAttribPointer(dissolveUniforms.finalTarget, 2, gl.FLOAT, false, stride, 4 * 4);
  gl.vertexAttribPointer(dissolveUniforms.color, 4, gl.FLOAT, false, stride, 6 * 4);
  gl.vertexAttribPointer(dissolveUniforms.seed, 4, gl.FLOAT, false, stride, 10 * 4);
  gl.uniform2f(dissolveUniforms.resolution, window.innerWidth, window.innerHeight);
  gl.uniform1f(dissolveUniforms.progress, progress);
  gl.uniform1f(dissolveUniforms.time, performance.now() * 0.001);
  gl.uniform1f(dissolveUniforms.titleSize, shaderSettings.titleSize * Math.min(window.devicePixelRatio || 1, 2));
  gl.uniform1f(dissolveUniforms.titleWave, shaderSettings.titleWave);
  gl.uniform1f(dissolveUniforms.titleFrequency, shaderSettings.titleFrequency);
  gl.uniform1f(dissolveUniforms.titleScatter, shaderSettings.titleScatter);
  gl.uniform1f(dissolveUniforms.titleCohesion, shaderSettings.titleCohesion);
  gl.uniform1f(dissolveUniforms.imageSize, shaderSettings.imageSize * Math.min(window.devicePixelRatio || 1, 2));
  gl.uniform1f(dissolveUniforms.imageWave, shaderSettings.imageWave);
  gl.uniform1f(dissolveUniforms.imageFrequency, shaderSettings.imageFrequency);
  gl.uniform1f(dissolveUniforms.imageScatter, shaderSettings.imageScatter);
  gl.uniform1f(dissolveUniforms.imageCohesion, shaderSettings.imageCohesion);
  const finalColor = getColorComponents(getComputedStyle(scrollHeading).color);
  gl.uniform3f(dissolveUniforms.finalColor, finalColor[0], finalColor[1], finalColor[2]);
  gl.drawArrays(gl.POINTS, 0, particleCount);
}

function scheduleDissolveAnimation() {
  if (dissolveAnimationFrame || dissolveProgress <= 0 || dissolveProgress >= 1) return;

  dissolveAnimationFrame = requestAnimationFrame(() => {
    dissolveAnimationFrame = 0;
    renderDissolve(dissolveProgress);
    scheduleDissolveAnimation();
  });
}

function updateDissolve() {
  if (!gl || !createDissolveProgram()) {
    hero.style.setProperty("--dissolve-progress", "0");
    hero.style.setProperty("--dissolve-source-opacity", "1");
    hero.style.setProperty("--dissolve-particle-opacity", "0");
    hero.style.setProperty("--coming-soon-opacity", "0");
    hero.classList.remove("dissolve-active");
    return;
  }

  dissolveProgress = getDissolveProgress();
  renderDissolve(dissolveProgress);

  if (sourceReadFailed || !particleCount) {
    hero.style.setProperty("--dissolve-progress", "0");
    hero.style.setProperty("--dissolve-source-opacity", "1");
    hero.style.setProperty("--dissolve-particle-opacity", "0");
    hero.style.setProperty("--coming-soon-opacity", "0");
    hero.classList.remove("dissolve-active");
    return;
  }

  const sourceOpacity = 1 - smoothstep(0.11, 0.16, dissolveProgress);
  const particleOpacity = 1 - smoothstep(0.92, 1, dissolveProgress);
  const comingSoonOpacity = smoothstep(0.88, 0.98, dissolveProgress);
  hero.style.setProperty("--dissolve-progress", dissolveProgress.toFixed(3));
  hero.style.setProperty("--dissolve-source-opacity", sourceOpacity.toFixed(3));
  hero.style.setProperty("--dissolve-particle-opacity", particleOpacity.toFixed(3));
  hero.style.setProperty("--coming-soon-opacity", comingSoonOpacity.toFixed(3));
  hero.classList.toggle("dissolve-active", dissolveProgress > 0);
  scheduleDissolveAnimation();
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
  const showScrollTitle = frameIndex <= scrollTitleVisibleFrame;

  hero.classList.toggle("scrolling-up", scrollingUp);
  hero.classList.toggle("button-pinned", introRect.bottom < 0);
  hero.classList.toggle("quiet-word-fading", quietWordRect.top < window.innerHeight * 0.5);
  hero.classList.toggle("scroll-title-visible", showScrollTitle);
  updateDissolve();
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
  syncDissolveCanvas();
  await waitForHeroAssets();
  document.body.classList.add("assets-ready");
  requestAnimationFrame(animateSequence);
});

window.addEventListener("resize", () => {
  syncQuietWordText();
  dissolveSignature = "";
  updateDissolve();
});
window.addEventListener("scroll", requestScrollUpdate, { passive: true });
