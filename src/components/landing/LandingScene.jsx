import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getTheme, subscribeTheme } from '../../theme';

const PALETTES = ['#d6b978', '#b5a1dc', '#9ebc91', '#a6d3df'];

export default function LandingScene({ motionRef, onReady, onUnavailable }) {
  const canvasRef = useRef(null);
  const callbacksRef = useRef({ onReady, onUnavailable });
  callbacksRef.current = { onReady, onUnavailable };

  useEffect(() => {
    const canvas = canvasRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      callbacksRef.current.onUnavailable();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    camera.position.set(0, 0.25, 9);
    const group = new THREE.Group();
    scene.add(group);
    const core = new THREE.Group();
    group.add(core);
    const crystalMaterial = new THREE.MeshPhysicalMaterial({ color: PALETTES[0], metalness: 0.52, roughness: 0.23, clearcoat: 1, clearcoatRoughness: 0.15, flatShading: true });
    const crystalGeometry = new THREE.OctahedronGeometry(1.22, 0);
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.scale.set(0.8, 1.65, 0.8);
    core.add(crystal);
    const wireMaterial = new THREE.LineBasicMaterial({ color: '#f6dfab', transparent: true, opacity: 0.28 });
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(crystalGeometry), wireMaterial);
    wire.scale.copy(crystal.scale).multiplyScalar(1.005);
    core.add(wire);

    const shards = [];
    const shardGeometry = new THREE.OctahedronGeometry(0.18, 0);
    for (let index = 0; index < 12; index++) {
      const shard = new THREE.Mesh(shardGeometry, crystalMaterial);
      const angle = index / 12 * Math.PI * 2;
      const radius = 1.8 + (index % 3) * 0.22;
      shard.userData = { angle, radius, height: Math.sin(angle * 2) * 0.7 };
      shard.scale.set(0.65, 1.6 + (index % 3) * 0.4, 0.65);
      group.add(shard);
      shards.push(shard);
    }

    const rings = [];
    const ringMaterial = new THREE.MeshBasicMaterial({ color: PALETTES[0], transparent: true, opacity: 0.36 });
    for (let index = 0; index < 3; index++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1 + index * 0.25, 0.006, 4, 160), ringMaterial);
      ring.rotation.set(Math.PI * (0.22 + index * 0.2), index * 0.7, index * 0.4);
      group.add(ring);
      rings.push(ring);
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(2.85, 2.86, 128), new THREE.MeshBasicMaterial({ color: PALETTES[0], transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    group.add(halo);

    const particlePositions = new Float32Array(90 * 3);
    for (let index = 0; index < 90; index++) {
      const angle = index * 2.399963;
      const radius = 2.8 + (index % 9) * 0.24;
      particlePositions[index * 3] = Math.cos(angle) * radius;
      particlePositions[index * 3 + 1] = Math.sin(angle) * radius;
      particlePositions[index * 3 + 2] = Math.sin(index * 3.7) * 1.5;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: '#d9cba9', size: 0.018, transparent: true, opacity: 0.65 });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    scene.add(new THREE.AmbientLight('#f3e6d5', 1.8));
    const key = new THREE.DirectionalLight('#fff2d7', 5);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#b9cfff', 4);
    rim.position.set(4, -1, -2);
    scene.add(rim);
    const fill = new THREE.PointLight('#fff8e4', 12, 15);
    fill.position.set(0, -2, 3);
    scene.add(fill);

    let isLight = getTheme() === 'light';
    const applyTheme = theme => {
      isLight = theme === 'light';
      wireMaterial.opacity = isLight ? 0.45 : 0.28;
      ringMaterial.opacity = isLight ? 0.65 : 0.36;
      particleMaterial.opacity = isLight ? 0.8 : 0.65;
      renderer.toneMappingExposure = isLight ? 1.15 : 1.5;
    };
    applyTheme(getTheme());
    const unsubscribeTheme = subscribeTheme(applyTheme);
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = camera.aspect < 0.9 ? 11.8 : 9;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const targetColor = new THREE.Color();
    let frame;
    let lastTime = 0;
    let elapsed = 0;
    let progress = 0;
    let suspended = false;
    const animate = time => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
      lastTime = time;
      if (document.hidden || !motionRef.current.active || suspended) return;
      const motion = motionRef.current;
      const ease = 1 - Math.exp(-delta * 5);
      progress += (motion.progress - progress) * ease;
      if (!reducedMotion.matches) elapsed += delta;
      const rotation = reducedMotion.matches ? 0 : elapsed * 0.16 + progress * Math.PI * 2;
      core.rotation.y = rotation;
      core.rotation.z = 0.12 + (reducedMotion.matches ? 0 : Math.sin(elapsed * 0.4) * 0.1);
      core.position.y = reducedMotion.matches ? 0 : Math.sin(elapsed * 0.8) * 0.12;
      group.rotation.y += ((reducedMotion.matches ? 0 : motion.pointerX * 0.16) - group.rotation.y) * ease;
      group.rotation.x += ((reducedMotion.matches ? 0 : motion.pointerY * 0.12) - group.rotation.x) * ease;
      group.rotation.z = reducedMotion.matches ? 0 : -progress * 0.3;
      shards.forEach((shard, index) => {
        const { angle, radius, height } = shard.userData;
        const orbit = angle + rotation * (index % 2 ? 0.6 : -0.35);
        const spread = radius + Math.sin(progress * Math.PI * 4) * 0.35;
        shard.position.set(Math.cos(orbit) * spread, Math.sin(orbit) * spread * 0.7, height + Math.sin(orbit) * 0.6);
        shard.rotation.set(orbit, angle + rotation, angle);
      });
      rings.forEach((ring, index) => {
        ring.rotation.z = index * 0.4 + rotation * (index % 2 ? 0.2 : -0.2);
        ring.rotation.y = index * 0.7 + (reducedMotion.matches ? 0 : progress * 1.4);
      });
      targetColor.set(PALETTES[motion.world]);
      crystalMaterial.color.lerp(targetColor, ease);
      ringMaterial.color.lerp(targetColor, ease);
      particleMaterial.color.copy(targetColor).multiplyScalar(isLight ? 0.45 : 1);
      renderer.render(scene, camera);
    };
    const onContextLost = event => {
      event.preventDefault();
      suspended = true;
      callbacksRef.current.onUnavailable();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    frame = requestAnimationFrame(animate);
    callbacksRef.current.onReady();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      unsubscribeTheme();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
    };
  }, [motionRef]);

  return <canvas ref={canvasRef} className="landing-scene-canvas" aria-hidden="true" />;
}
