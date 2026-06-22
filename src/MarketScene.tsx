import { useEffect, useRef } from "react";
import * as THREE from "three";

type MarketSceneProps = {
  intensity: number;
  isReverse: boolean;
};

type Ribbon = {
  baseY: number;
  geometry: THREE.BufferGeometry;
  line: THREE.Line;
  phase: number;
  positions: Float32Array;
};

export default function MarketScene({ intensity, isReverse }: MarketSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(intensity);
  const reverseRef = useRef(isReverse);

  useEffect(() => {
    intensityRef.current = intensity;
    reverseRef.current = isReverse;
  }, [intensity, isReverse]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "market-webgl";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    camera.position.set(0, 2.2, 13.8);
    camera.lookAt(0, -0.5, -4);

    const directColor = new THREE.Color(0x24d18f);
    const reverseColor = new THREE.Color(0xff6a4d);
    const accentColor = new THREE.Color(0x74c7ff);
    const pointDirectColor = new THREE.Color(0xb7fff1);
    const pointReverseColor = new THREE.Color(0xffc2ad);
    const activeColor = new THREE.Color();

    const grid = new THREE.GridHelper(36, 42, 0x163b34, 0x11242f);
    grid.position.set(0, -2.55, -4.8);
    grid.rotation.x = 0.035;
    scene.add(grid);

    const gridMaterial = grid.material as THREE.Material | THREE.Material[];
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.36;
      });
    } else {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.36;
    }

    const ribbonMaterial = new THREE.LineBasicMaterial({
      color: directColor,
      opacity: 0.7,
      transparent: true,
    });
    const accentMaterial = new THREE.LineBasicMaterial({
      color: accentColor,
      opacity: 0.34,
      transparent: true,
    });

    const ribbons: Ribbon[] = Array.from({ length: 8 }, (_, row) => {
      const count = 112;
      const positions = new Float32Array(count * 3);
      const baseY = -1.45 + row * 0.34;
      const z = 1.5 - row * 1.12;

      for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        positions[offset] = (index / (count - 1) - 0.5) * 25;
        positions[offset + 1] = baseY;
        positions[offset + 2] = z;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geometry, row % 3 === 0 ? accentMaterial : ribbonMaterial);
      scene.add(line);

      return {
        baseY,
        geometry,
        line,
        phase: row * 0.76,
        positions,
      };
    });

    const pointPositions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      const offset = index * 3;
      const band = index % 9;
      pointPositions[offset] = ((index * 37) % 1000) / 1000 * 28 - 14;
      pointPositions[offset + 1] = -1.6 + ((index * 23) % 1000) / 1000 * 5.2;
      pointPositions[offset + 2] = -1.2 - band * 1.35 - ((index * 11) % 100) / 120;
    }
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xb7fff1,
      opacity: 0.22,
      size: 0.035,
      transparent: true,
    });
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    let frameId = 0;
    const renderFrame = (timeMs: number) => {
      const time = timeMs / 1000;
      const pulse = 0.45 + Math.min(1.35, intensityRef.current / 3.2);
      activeColor.copy(reverseRef.current ? reverseColor : directColor);
      ribbonMaterial.color.copy(activeColor);
      ribbonMaterial.opacity = reverseRef.current ? 0.62 : 0.72;
      pointsMaterial.color.copy(reverseRef.current ? pointReverseColor : pointDirectColor);

      ribbons.forEach((ribbon, row) => {
        const position = ribbon.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < position.count; index += 1) {
          const x = ribbon.positions[index * 3];
          const drift = Math.sin(index * 0.08 + time * 0.42 + ribbon.phase) * 0.18;
          const wave = Math.sin(index * 0.16 + time * (0.28 + row * 0.018) + ribbon.phase) * 0.26 * pulse;
          position.setY(index, ribbon.baseY + wave + drift);
          position.setZ(index, ribbon.positions[index * 3 + 2] + Math.sin(time * 0.12 + row) * 0.12);
          position.setX(index, x);
        }
        position.needsUpdate = true;
        ribbon.line.position.x = Math.sin(time * 0.11 + row * 0.4) * 0.18;
      });

      points.rotation.y = Math.sin(time * 0.05) * 0.025;
      points.position.z = Math.sin(time * 0.16) * 0.25;
      grid.position.z = -4.8 + ((time * 0.18) % 0.9);
      scene.rotation.x = -0.02 + Math.sin(time * 0.06) * 0.012;
      scene.rotation.y = Math.sin(time * 0.045) * 0.035;

      renderer.render(scene, camera);
      if (!reduceMotion) frameId = window.requestAnimationFrame(renderFrame);
    };

    resize();
    renderFrame(0);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      host.removeChild(renderer.domElement);
      grid.geometry.dispose();
      if (Array.isArray(gridMaterial)) {
        gridMaterial.forEach((material) => material.dispose());
      } else {
        gridMaterial.dispose();
      }
      ribbons.forEach((ribbon) => ribbon.geometry.dispose());
      ribbonMaterial.dispose();
      accentMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div aria-hidden="true" className="market-scene" ref={hostRef} />;
}
