import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LOVE_PHRASES } from '../data/translations';
import { HEART_POLYGON } from '../geometry/heartGeometry';
import { buildPreRenderedHeart } from '../geometry/textHeartLayout';

interface HeartCanvas3DProps {
  textSize: number;
  glowEnabled: boolean;
  heartColor: string;
  fontFamily: string;
  heartShape: 'classic' | 'wide' | 'tall';
  particleDensity: number;
  isPlaying: boolean;
  rotationSpeed: number;
  animationKey: number;
  resetViewKey: number;
  onBuildComplete?: () => void;
}

const BUILD_DURATION_MS = 4200;

/**
 * Generates a high-resolution multilingual text strip texture for the 3D heart's side bevel wall.
 */
function createSideRibbonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090101';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ribbonPhrases = LOVE_PHRASES.slice(0, 36)
    .map((p) => p.t)
    .join('   ·   ');

  ctx.font =
    '500 32px "Noto Sans", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Bengali", "Noto Sans Arabic", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#ff3319');
  grad.addColorStop(0.25, '#ff7326');
  grad.addColorStop(0.5, '#e81922');
  grad.addColorStop(0.75, '#ff6624');
  grad.addColorStop(1, '#ff3319');

  ctx.fillStyle = grad;
  ctx.fillText(ribbonPhrases, 16, 42);
  ctx.fillStyle = 'rgba(255, 118, 48, 0.78)';
  ctx.fillText(ribbonPhrases, -340, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Creates a soft warm crimson-orange radial glow texture for the 3D atmospheric halo.
 */
function createHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(256, 256, 12, 256, 256, 256);
  g.addColorStop(0, 'rgba(255, 64, 24, 0.34)');
  g.addColorStop(0.35, 'rgba(210, 26, 12, 0.16)');
  g.addColorStop(0.7, 'rgba(110, 8, 4, 0.04)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds an exact volumetric 3D pillowed heart BufferGeometry whose front & back silhouettes
 * match HEART_POLYGON without distortion, with planar orthographic UV mapping for text clarity.
 */
function createVolumetricHeartGeometry(
  worldW: number,
  worldH: number,
  bevelHalfDepth: number,
  domeDepth: number
): { faceGeo: THREE.BufferGeometry; sideGeo: THREE.BufferGeometry } {
  const boundaryCount = 240;
  const step = Math.floor(HEART_POLYGON.points.length / boundaryCount);
  const boundary: { x: number; y: number }[] = [];
  for (let i = 0; i < boundaryCount; i++) {
    const p = HEART_POLYGON.points[(i * step) % HEART_POLYGON.points.length];
    // Convert screen-down Y to Three.js +Y up
    boundary.push({
      x: p.x * worldW,
      y: -p.y * worldH,
    });
  }

  // Interior hub strictly inside the star-shaped heart (below cleft)
  const hubX = 0;
  const hubY = 0;

  const rings = 26;
  const ringProfile = (r: number) => {
    // Smooth elliptical dome from bevel edge (r=1) to center (r=0)
    const t = Math.max(0, 1 - Math.pow(r, 2.15));
    return bevelHalfDepth + domeDepth * Math.sqrt(t);
  };

  // --- Front + Back Faces ---
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushSide = (zSign: number) => {
    const baseOffset = positions.length / 3;
    // Center hub vertex
    positions.push(hubX, hubY, zSign * ringProfile(0));
    uvs.push(hubX / worldW + 0.5, hubY / worldH + 0.5);

    for (let rIdx = 1; rIdx <= rings; rIdx++) {
      const r = rIdx / rings;
      const z = zSign * ringProfile(r);
      for (let i = 0; i < boundaryCount; i++) {
        const bx = boundary[i].x;
        const by = boundary[i].y;
        const x = hubX + r * (bx - hubX);
        const y = hubY + r * (by - hubY);
        positions.push(x, y, z);
        uvs.push(x / worldW + 0.5, y / worldH + 0.5);
      }
    }

    // Determine winding order from first inner fan triangle so normal points along zSign
    const testI0 = baseOffset;
    const testI1 = baseOffset + 1;
    const testI2 = baseOffset + 2;
    const ax = positions[testI1 * 3] - positions[testI0 * 3];
    const ay = positions[testI1 * 3 + 1] - positions[testI0 * 3 + 1];
    const bx = positions[testI2 * 3] - positions[testI0 * 3];
    const by = positions[testI2 * 3 + 1] - positions[testI0 * 3 + 1];
    const crossZ = ax * by - ay * bx;
    const flipWinding = (zSign > 0 && crossZ < 0) || (zSign < 0 && crossZ > 0);

    const pushTri = (a: number, b: number, c: number) => {
      if (flipWinding) indices.push(a, c, b);
      else indices.push(a, b, c);
    };

    // Hub fan
    for (let i = 0; i < boundaryCount; i++) {
      const next = (i + 1) % boundaryCount;
      pushTri(baseOffset, baseOffset + 1 + i, baseOffset + 1 + next);
    }

    // Concentric rings
    for (let rIdx = 1; rIdx < rings; rIdx++) {
      const rStart = baseOffset + 1 + (rIdx - 1) * boundaryCount;
      const rNextStart = baseOffset + 1 + rIdx * boundaryCount;
      for (let i = 0; i < boundaryCount; i++) {
        const next = (i + 1) % boundaryCount;
        const a = rStart + i;
        const b = rStart + next;
        const c = rNextStart + i;
        const d = rNextStart + next;
        pushTri(a, c, b);
        pushTri(b, c, d);
      }
    }
  };

  pushSide(1);
  pushSide(-1);

  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  faceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  faceGeo.setIndex(indices);
  faceGeo.computeVertexNormals();

  // --- Side Bevel Ribbon Wall ---
  const sidePos: number[] = [];
  const sideUvs: number[] = [];
  const sideIdx: number[] = [];

  for (let i = 0; i <= boundaryCount; i++) {
    const p = boundary[i % boundaryCount];
    const u = (i / boundaryCount) * 4.0; // Wrap ribbon seamlessly 4x around perimeter
    sidePos.push(p.x, p.y, bevelHalfDepth);
    sideUvs.push(u, 1);
    sidePos.push(p.x, p.y, -bevelHalfDepth);
    sideUvs.push(u, 0);
  }

  // Check outward radial direction on segment 0
  const p0 = boundary[0];
  const p1 = boundary[1];
  const edgeDx = p1.x - p0.x;
  const edgeDy = p1.y - p0.y;
  // Cross of (edge) and (0, 0, -1) gives (-edgeDy, edgeDx, 0)
  const midX = (p0.x + p1.x) * 0.5;
  const midY = (p0.y + p1.y) * 0.5;
  const dotOut = -edgeDy * midX + edgeDx * midY;
  const flipSide = dotOut < 0;

  for (let i = 0; i < boundaryCount; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    if (flipSide) {
      sideIdx.push(a, c, b, b, c, d);
    } else {
      sideIdx.push(a, b, c, b, d, c);
    }
  }

  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
  sideGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sideUvs, 2));
  sideGeo.setIndex(sideIdx);
  sideGeo.computeVertexNormals();

  return { faceGeo, sideGeo };
}

export const HeartCanvas3D: React.FC<HeartCanvas3DProps> = ({
  textSize,
  glowEnabled,
  heartColor,
  fontFamily,
  heartShape,
  particleDensity,
  isPlaying,
  rotationSpeed,
  animationKey,
  resetViewKey,
  onBuildComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const isPlayingRef = useRef(isPlaying);
  const glowRef = useRef(glowEnabled);
  const heartColorRef = useRef(heartColor);
  const particleDensityRef = useRef(particleDensity);
  const heartShapeRef = useRef(heartShape);
  const rotationSpeedRef = useRef(rotationSpeed);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const resetAnimRef = useRef(false);

  isPlayingRef.current = isPlaying;
  glowRef.current = glowEnabled;
  heartColorRef.current = heartColor;
  particleDensityRef.current = particleDensity;
  heartShapeRef.current = heartShape;
  rotationSpeedRef.current = rotationSpeed;

  const sceneRefs = useRef<{
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    heartGroup?: THREE.Group;
    faceMat?: THREE.MeshStandardMaterial;
    sideMat?: THREE.MeshStandardMaterial;
    haloSprite?: THREE.Sprite;
    alphaTex?: THREE.DataTexture;
    alphaData?: Uint8Array;
    faceMapTex?: THREE.CanvasTexture;
    faceEmissiveTex?: THREE.CanvasTexture;
  }>({});

  // Reset build progress when animationKey increments
  useEffect(() => {
    progressRef.current = 0;
    completedRef.current = false;
  }, [animationKey]);

  // Smooth Reset View trigger
  useEffect(() => {
    if (resetViewKey > 0) {
      resetAnimRef.current = true;
    }
  }, [resetViewKey]);

  // Rebuild crisp 2048x2048 multilingual text textures whenever textSize changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs.faceMat) return;

    const texSize = 2048;
    const scaledFont = Math.max(13, Math.round(textSize * 2.55));
    const pre = buildPreRenderedHeart({
      canvasWidth: texSize,
      canvasHeight: texSize,
      dpr: 1,
      fontSize: scaledFont,
      fillRatio: 0.96,
      verticalOffset: 0,
      heartColor,
      fontFamily,
      heartShape: 'classic',
    });

    // Compose obsidian-tinted base map (so 3D sculpted obsidian body catches realistic lighting)
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = texSize;
    mapCanvas.height = texSize;
    const mCtx = mapCanvas.getContext('2d')!;
    mCtx.fillStyle = '#090202';
    mCtx.fillRect(0, 0, texSize, texSize);
    mCtx.drawImage(pre.baseCanvas, 0, 0);

    // Compose emissive map (text + soft glow)
    const emCanvas = document.createElement('canvas');
    emCanvas.width = texSize;
    emCanvas.height = texSize;
    const eCtx = emCanvas.getContext('2d')!;
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, texSize, texSize);
    eCtx.drawImage(pre.glowCanvas, 0, 0);
    eCtx.drawImage(pre.baseCanvas, 0, 0);

    const newMap = new THREE.CanvasTexture(mapCanvas);
    newMap.colorSpace = THREE.SRGBColorSpace;
    newMap.anisotropy = 8;

    const newEmissive = new THREE.CanvasTexture(emCanvas);
    newEmissive.colorSpace = THREE.SRGBColorSpace;
    newEmissive.anisotropy = 8;

    refs.faceMapTex?.dispose();
    refs.faceEmissiveTex?.dispose();

    refs.faceMapTex = newMap;
    refs.faceEmissiveTex = newEmissive;

    refs.faceMat.map = newMap;
    refs.faceMat.emissiveMap = newEmissive;
    refs.faceMat.needsUpdate = true;
  }, [textSize, heartColor, fontFamily, heartShape]);

  // Initialize Three.js WebGL scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const defaultCamZ = width < 640 ? 5.6 : 4.55;
    camera.position.set(0, 0.12, defaultCamZ);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 8.5;

    // Realistic Three-Point Warm Cinematic Lighting + Shadow
    const ambient = new THREE.AmbientLight(0x2a0806, 1.1);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffe0cc, 2.2);
    keyLight.position.set(2.8, 3.8, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.radius = 5;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff4218, 2.4);
    rimLight.position.set(-3.2, 1.8, -3.5);
    scene.add(rimLight);

    const warmCoreLight = new THREE.PointLight(0xff521b, 2.5, 9);
    warmCoreLight.position.set(0, -0.3, 2.4);
    scene.add(warmCoreLight);

    // Subtle matte obsidian shadow-catcher plane below the heart
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.42 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.65;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Subtle warm radial halo sprite behind heart
    const haloTex = createHaloTexture();
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: glowRef.current ? 0.85 : 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const haloSprite = new THREE.Sprite(haloMat);
    haloSprite.scale.set(4.5, 4.2, 1);
    haloSprite.position.set(0, 0.05, -0.6);
    scene.add(haloSprite);

    // Warm orbiting particle field with short luminous trails around the heart.
    // Kept separate from the heart mesh so the particles create a floating orbital effect.
    const particleGroup = new THREE.Group();
    const particleCount = 360;
    const particlePositions = new Float32Array(particleCount * 3);
    const trailPositions = new Float32Array(particleCount * 2 * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSeeds: { angle: number; radius: number; y: number; depth: number; speed: number; phase: number; length: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.48 + Math.random() * 0.82;
      const y = (Math.random() - 0.5) * 2.35;
      const depth = (Math.random() - 0.5) * 1.35;
      const speed = 0.18 + Math.random() * 0.42;
      const phase = Math.random() * Math.PI * 2;
      const length = 0.035 + Math.random() * 0.075;
      particleSeeds.push({ angle, radius, y, depth, speed, phase, length });

      const warm = Math.random();
      particleColors[i * 3] = 1;
      particleColors[i * 3 + 1] = 0.22 + warm * 0.48;
      particleColors[i * 3 + 2] = 0.08 + warm * 0.12;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.026,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particleGroup.add(particles);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xff7448,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
    particleGroup.add(trails);
    scene.add(particleGroup);

    // Build vertical 1x256 alpha reveal DataTexture (top-to-bottom smooth reveal)
    const alphaH = 256;
    const alphaData = new Uint8Array(alphaH * 4);
    alphaData.fill(255);
    const alphaTex = new THREE.DataTexture(alphaData, 1, alphaH, THREE.RGBAFormat);
    alphaTex.magFilter = THREE.LinearFilter;
    alphaTex.minFilter = THREE.LinearFilter;
    alphaTex.needsUpdate = true;

    // Initial 2048x2048 multilingual texture
    const texSize = 2048;
    const scaledFont = Math.max(7, Math.round(textSize * 2.4));
    const pre = buildPreRenderedHeart({
      canvasWidth: texSize,
      canvasHeight: texSize,
      dpr: 1,
      fontSize: scaledFont,
      fillRatio: 0.96,
      verticalOffset: 0,
      heartColor,
      fontFamily,
      heartShape: 'classic',
    });

    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = texSize;
    mapCanvas.height = texSize;
    const mCtx = mapCanvas.getContext('2d')!;
    mCtx.fillStyle = '#090202';
    mCtx.fillRect(0, 0, texSize, texSize);
    mCtx.drawImage(pre.baseCanvas, 0, 0);

    const emCanvas = document.createElement('canvas');
    emCanvas.width = texSize;
    emCanvas.height = texSize;
    const eCtx = emCanvas.getContext('2d')!;
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, texSize, texSize);
    eCtx.drawImage(pre.glowCanvas, 0, 0);
    eCtx.drawImage(pre.baseCanvas, 0, 0);

    const faceMapTex = new THREE.CanvasTexture(mapCanvas);
    faceMapTex.colorSpace = THREE.SRGBColorSpace;
    faceMapTex.anisotropy = 8;

    const faceEmissiveTex = new THREE.CanvasTexture(emCanvas);
    faceEmissiveTex.colorSpace = THREE.SRGBColorSpace;
    faceEmissiveTex.anisotropy = 8;

    const worldW = 2.55;
    const worldH = worldW / HEART_POLYGON.aspectRatio;
    const { faceGeo, sideGeo } = createVolumetricHeartGeometry(worldW, worldH, 0.14, 0.42);

    const faceMat = new THREE.MeshStandardMaterial({
      map: faceMapTex,
      emissiveMap: faceEmissiveTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: glowRef.current ? 1.3 : 0.78,
      roughness: 0.34,
      metalness: 0.16,
      alphaMap: alphaTex,
      transparent: true,
    });

    const sideTex = createSideRibbonTexture();
    const sideMat = new THREE.MeshStandardMaterial({
      map: sideTex,
      emissiveMap: sideTex,
      emissive: new THREE.Color(0xff5226),
      emissiveIntensity: glowRef.current ? 1.05 : 0.6,
      roughness: 0.38,
      metalness: 0.2,
    });

    const heartGroup = new THREE.Group();
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.castShadow = true;
    faceMesh.receiveShadow = true;

    const sideMesh = new THREE.Mesh(sideGeo, sideMat);
    sideMesh.castShadow = true;
    sideMesh.receiveShadow = true;

    heartGroup.add(faceMesh);
    heartGroup.add(sideMesh);
    heartGroup.position.y = 0.08;
    heartGroup.scale.set(
      heartShape === 'wide' ? 1.12 : heartShape === 'tall' ? 0.90 : 1,
      heartShape === 'wide' ? 0.92 : heartShape === 'tall' ? 1.10 : 1,
      1
    );
    scene.add(heartGroup);

    sceneRefs.current = {
      renderer,
      camera,
      controls,
      heartGroup,
      faceMat,
      sideMat,
      haloSprite,
      alphaTex,
      alphaData,
      faceMapTex,
      faceEmissiveTex,
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dtMs = Math.min(64, Math.max(0, now - lastTime));
      const dt = dtMs * 0.001;
      lastTime = now;

      // Advance build reveal
      if (isPlayingRef.current && progressRef.current < 1) {
        progressRef.current = Math.min(1, progressRef.current + dtMs / BUILD_DURATION_MS);
        if (progressRef.current >= 1 && !completedRef.current) {
          completedRef.current = true;
          onBuildComplete?.();
        }
      }

      // Update vertical alpha reveal texture (uv.y = 1 is top, uv.y = 0 is bottom in DataTexture?
      // Note: DataTexture row 0 corresponds to v=0 (bottom tip), row 255 to v=1 (top lobes)).
      const p = progressRef.current;
      const lead = 0.12;
      const threshold = 1 - p * (1 + lead);
      for (let row = 0; row < alphaH; row++) {
        const v = row / (alphaH - 1); // 0 = bottom tip, 1 = top lobes
        const raw = Math.min(1, Math.max(0, (v - threshold) / lead));
        const smooth = raw * raw * (3 - 2 * raw);
        const val = Math.round(smooth * 255);
        const idx = row * 4;
        alphaData[idx] = val;
        alphaData[idx + 1] = val;
        alphaData[idx + 2] = val;
        alphaData[idx + 3] = val;
      }
      alphaTex.needsUpdate = true;

      // Solidify side bevel harmoniously as the top-to-bottom reveal completes
      sideMat.opacity = p >= 1 ? 1 : Math.pow(p, 2.4);
      sideMat.transparent = p < 1;
      faceMat.transparent = p < 1;

      // Animate the orbital particles and their tiny trailing streaks.
      const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      const trailAttr = trailGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const seed = particleSeeds[i];
        const a = seed.angle + now * 0.00022 * seed.speed;
        const pulse = Math.sin(now * 0.0015 + seed.phase);
        const r = seed.radius + pulse * 0.035;
        const x = Math.cos(a) * r;
        const y = seed.y + Math.sin(now * 0.0009 + seed.phase) * 0.045;
        const z = Math.sin(a) * r * 0.42 + seed.depth;

        posAttr.setXYZ(i, x, y, z);
        const tail = i * 2;
        const tx = Math.cos(a - 0.055) * (r - seed.length);
        const tz = Math.sin(a - 0.055) * (r - seed.length) * 0.42 + seed.depth;
        trailAttr.setXYZ(tail, tx, y, tz);
        trailAttr.setXYZ(tail + 1, x, y, z);
      }
      posAttr.needsUpdate = true;
      trailAttr.needsUpdate = true;
      particleGroup.rotation.y = now * 0.000035;
      particleGroup.rotation.x = Math.sin(now * 0.00022) * 0.025;
      particleMaterial.opacity = glowRef.current ? 0.78 : 0.34;
      trailMaterial.opacity = glowRef.current ? 0.22 : 0.08;

      // Live-update silhouette proportions and particle density without rebuilding the scene.
      const shape = heartShapeRef.current;
      heartGroup.scale.set(
        shape === 'wide' ? 1.12 : shape === 'tall' ? 0.90 : 1,
        shape === 'wide' ? 0.92 : shape === 'tall' ? 1.10 : 1,
        1
      );
      const visibleParticles = Math.max(40, Math.min(particleCount, Math.round(particleCount * particleDensityRef.current)));
      particleGeometry.setDrawRange(0, visibleParticles);
      trailGeometry.setDrawRange(0, visibleParticles * 2);

      // Apply selected hue to the bevel and atmospheric halo in real time.
      const selectedTint = new THREE.Color(heartColorRef.current);
      sideMat.color.copy(selectedTint);
      haloMat.color.copy(selectedTint);
      particleMaterial.color.copy(selectedTint);
      trailMaterial.color.copy(selectedTint);
      // Glow modulation
      const breathe = p >= 1 ? 0.9 + 0.1 * Math.sin(now * 0.0016) : 1;
      faceMat.emissiveIntensity = glowRef.current ? 1.32 * breathe : 0.72;
      sideMat.emissiveIntensity = glowRef.current ? 1.05 * breathe : 0.55;
      haloMat.opacity = glowRef.current ? 0.85 * Math.min(1, p * 1.4) * breathe : 0;

      // Smooth 360-degree rotation
      if (isPlayingRef.current) {
        heartGroup.rotation.y += dt * 0.55 * rotationSpeedRef.current;
      }

      // Smooth Reset View interpolation
      if (resetAnimRef.current) {
        const targetCamZ = (container.clientWidth || window.innerWidth) < 640 ? 5.6 : 4.55;
        camera.position.lerp(new THREE.Vector3(0, 0.12, targetCamZ), 0.1);
        controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        // Normalize heart rotation.y to nearest 2*PI multiple
        const twoPi = Math.PI * 2;
        const modY = ((heartGroup.rotation.y % twoPi) + twoPi) % twoPi;
        const nearestZero = modY > Math.PI ? modY - twoPi : modY;
        heartGroup.rotation.y -= nearestZero * 0.12;
        heartGroup.rotation.x *= 0.88;

        if (
          Math.abs(nearestZero) < 0.01 &&
          camera.position.distanceTo(new THREE.Vector3(0, 0.12, targetCamZ)) < 0.02
        ) {
          heartGroup.rotation.y = 0;
          camera.position.set(0, 0.12, targetCamZ);
          resetAnimRef.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      faceGeo.dispose();
      sideGeo.dispose();
      faceMat.dispose();
      sideMat.dispose();
      haloMat.dispose();
      haloTex.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      sideTex.dispose();
      alphaTex.dispose();
      sceneRefs.current.faceMapTex?.dispose();
      sceneRefs.current.faceEmissiveTex?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full select-none overflow-hidden bg-black cursor-grab active:cursor-grabbing"
    />
  );
};