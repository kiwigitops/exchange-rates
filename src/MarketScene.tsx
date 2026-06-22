import { useEffect, useRef } from "react";
import * as THREE from "three";

type MarketSceneProps = {
  intensity: number;
  isReverse: boolean;
};

export default function MarketScene({ intensity, isReverse }: MarketSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "market-webgl";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    camera.position.set(0, 2.1, 12.4);

    const baseColor = isReverse ? 0xff6b4a : 0x33d17a;
    const accentColor = isReverse ? 0xffb86c : 0x64d2ff;

    const grid = new THREE.GridHelper(30, 34, 0x22c55e, 0x1b3b45);
    grid.position.y = -2.25;
    grid.position.z = -2.8;
    grid.rotation.x = 0.08;
    scene.add(grid);

    const ribbons: THREE.Line[] = [];
    const ribbonMaterial = new THREE.LineBasicMaterial({
      color: baseColor,
      opacity: 0.82,
      transparent: true,
    });
    const accentMaterial = new THREE.LineBasicMaterial({
      color: accentColor,
      opacity: 0.52,
      transparent: true,
    });

    for (let row = 0; row < 9; row += 1) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 120; i += 1) {
        const x = (i / 119 - 0.5) * 24;
        const z = row * -0.98 + 2.4;
        const y = Math.sin(i * 0.17 + row * 0.73) * 0.42 + row * 0.18 - 0.38;
        points.push(new THREE.Vector3(x, y, z));
      }

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        row % 3 === 0 ? accentMaterial : ribbonMaterial,
      );
      ribbons.push(line);
      scene.add(line);
    }

    const barMaterial = new THREE.MeshBasicMaterial({
      color: baseColor,
      opacity: 0.58,
      transparent: true,
    });
    const bars = new THREE.Group();
    const barMeshes: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let i = 0; i < 46; i += 1) {
      const height = 0.18 + ((i * 17) % 11) * 0.08;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.055, height, 0.055), barMaterial);
      bar.position.set((i / 45 - 0.5) * 18, -1.55 + height / 2, -4.8 - (i % 6) * 0.42);
      barMeshes.push(bar);
      bars.add(bar);
    }
    scene.add(bars);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      const pulse = 0.55 + Math.min(1.6, intensity / 2.8);

      ribbons.forEach((line, row) => {
        const geometry = line.geometry as THREE.BufferGeometry;
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;

        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i);
          const y =
            Math.sin(i * 0.18 + row * 0.66 + time * (0.72 + row * 0.025)) * 0.28 * pulse +
            Math.cos(i * 0.07 + time * 0.5) * 0.08 +
            row * 0.18 -
            0.38;
          position.setY(i, y);
          position.setX(i, x + Math.sin(time * 0.1 + row) * 0.0008);
        }

        position.needsUpdate = true;
        line.position.x = Math.sin(time * 0.17 + row) * 0.22;
      });

      barMeshes.forEach((child, index) => {
        child.scale.y = 0.72 + Math.abs(Math.sin(time * 1.35 + index * 0.43)) * 1.8 * pulse;
      });

      grid.position.z = ((time * 0.72) % 1.2) - 2.6;
      scene.rotation.y = Math.sin(time * 0.08) * 0.06;
      scene.rotation.x = -0.08 + Math.cos(time * 0.09) * 0.025;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      host.removeChild(renderer.domElement);
      renderer.dispose();
      grid.geometry.dispose();
      ribbonMaterial.dispose();
      accentMaterial.dispose();
      barMaterial.dispose();
      ribbons.forEach((line) => line.geometry.dispose());
      barMeshes.forEach((child) => child.geometry.dispose());
    };
  }, [intensity, isReverse]);

  return <div aria-hidden="true" className="market-scene" ref={hostRef} />;
}
