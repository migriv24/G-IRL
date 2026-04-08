/**
 * ModelViz3D — vanilla Three.js neural network visualization.
 *
 * Aesthetic goals:
 *  - Deep space background, glowing nodes, flowing connections
 *  - Nodes sized by layer role: input (teal), hidden (indigo/purple), output (gold)
 *  - Slow orbit rotation + breathing pulse on neurons
 *  - Training state: faster pulse, connections flash with activity color
 *  - Artistic, not diagnostic — no axes, minimal labels
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const LAYER_COLORS = {
  input:  { node: 0x00c8c8, emissive: 0x004444, line: 0x004444 },
  hidden: { node: 0x8844ff, emissive: 0x220044, line: 0x330066 },
  output: { node: 0xffcc00, emissive: 0x442200, line: 0x442200 },
};

const MAX_DISPLAY_NODES = 18;   // per layer, visual cap
const LAYER_SPACING     = 3.2;  // X distance between layers
const NODE_RADIUS       = 0.14;
const CONN_OPACITY      = 0.18;

function buildScene(architecture, container) {
  // ── Setup ────────────────────────────────────────────────────────────────
  const W = container.clientWidth  || 600;
  const H = container.clientHeight || 400;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x050510, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.06);

  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
  const nLayers = architecture.length;
  camera.position.set((nLayers - 1) * LAYER_SPACING * 0.5, 0, 9);
  camera.lookAt((nLayers - 1) * LAYER_SPACING * 0.5, 0, 0);

  // ── Lights ───────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x111133, 2));
  const camLight = new THREE.PointLight(0x4466ff, 3, 30);
  camLight.position.set((nLayers - 1) * LAYER_SPACING * 0.5, 4, 9);
  scene.add(camLight);

  // ── Build node layers ─────────────────────────────────────────────────────
  const layerGroups = [];   // array of { group, meshes[], nodePositions[], actualCount }

  architecture.forEach((nNodes, li) => {
    const role = li === 0 ? 'input' : li === architecture.length - 1 ? 'output' : 'hidden';
    const colors = LAYER_COLORS[role];
    const displayCount = Math.min(nNodes, MAX_DISPLAY_NODES);
    const totalHeight  = Math.max(displayCount - 1, 1) * 0.5;

    const group = new THREE.Group();
    group.position.x = li * LAYER_SPACING;
    scene.add(group);

    const meshes = [];
    const positions = [];

    for (let ni = 0; ni < displayCount; ni++) {
      const y = displayCount === 1
        ? 0
        : -totalHeight / 2 + ni * (totalHeight / (displayCount - 1));

      const geo  = new THREE.SphereGeometry(NODE_RADIUS, 14, 10);
      const mat  = new THREE.MeshStandardMaterial({
        color:    colors.node,
        emissive: colors.emissive,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, y, 0);
      group.add(mesh);
      meshes.push(mesh);
      positions.push(new THREE.Vector3(li * LAYER_SPACING, y, 0));
    }

    // Ellipsis indicator for truncated layers
    if (nNodes > MAX_DISPLAY_NODES) {
      const dots = [0.3, 0, -0.3];
      dots.forEach(dy => {
        const dg = new THREE.SphereGeometry(0.04, 6, 4);
        const dm = new THREE.MeshStandardMaterial({ color: colors.node, emissive: colors.emissive, emissiveIntensity: 0.6 });
        const dm_ = new THREE.Mesh(dg, dm);
        dm_.position.set(0, -totalHeight / 2 - 0.6 + dy * 0.5, 0);
        group.add(dm_);
      });
    }

    layerGroups.push({ group, meshes, positions, actualCount: nNodes, role, colors });
  });

  // ── Build connections (lines between adjacent layers) ─────────────────────
  const connectionMeshes = [];

  for (let li = 0; li < layerGroups.length - 1; li++) {
    const fromLayer = layerGroups[li];
    const toLayer   = layerGroups[li + 1];

    // Subsample connections to avoid visual clutter
    const maxConns = 60;
    const fromNodes = fromLayer.positions;
    const toNodes   = toLayer.positions;
    const pairs = [];
    fromNodes.forEach((f, fi) => {
      toNodes.forEach((t, ti) => pairs.push([fi, ti]));
    });
    // Sample evenly
    const step = Math.max(1, Math.floor(pairs.length / maxConns));
    const sampledPairs = pairs.filter((_, i) => i % step === 0);

    const pts = [];
    sampledPairs.forEach(([fi, ti]) => {
      pts.push(fromNodes[fi], toNodes[ti]);
    });

    if (pts.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: fromLayer.colors.line,
        transparent: true,
        opacity: CONN_OPACITY,
      });
      const lines = new THREE.LineSegments(geo, mat);
      scene.add(lines);
      connectionMeshes.push({ lines, mat });
    }
  }

  // ── Animation state ───────────────────────────────────────────────────────
  let frameId;
  let isTraining = false;
  let orbitAngle = 0;
  const centerX = (architecture.length - 1) * LAYER_SPACING * 0.5;
  const orbitRadius = 9;
  const orbitSpeed  = 0.003;

  function animate(t) {
    frameId = requestAnimationFrame(animate);
    const sec = t * 0.001;

    // Orbit camera gently around center
    orbitAngle += orbitSpeed * (isTraining ? 2.5 : 1);
    camera.position.x = centerX + Math.sin(orbitAngle) * orbitRadius * 0.3;
    camera.position.z = orbitRadius * (0.85 + Math.sin(orbitAngle * 0.3) * 0.1);
    camera.position.y = Math.sin(orbitAngle * 0.5) * 1.2;
    camera.lookAt(centerX, 0, 0);

    // Pulse nodes
    const speed = isTraining ? 4.0 : 1.2;
    layerGroups.forEach(({ meshes, role, colors }, li) => {
      meshes.forEach((mesh, ni) => {
        const phase = li * 0.8 + ni * 0.2;
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(sec * speed + phase));
        mesh.material.emissiveIntensity = pulse * (isTraining ? 1.4 : 0.6);

        // Subtle scale breathe
        const s = 1 + 0.08 * Math.sin(sec * speed * 0.7 + phase);
        mesh.scale.setScalar(s);
      });
    });

    // Connections flicker during training
    connectionMeshes.forEach(({ mat }, ci) => {
      if (isTraining) {
        mat.opacity = CONN_OPACITY + 0.25 * (0.5 + 0.5 * Math.sin(sec * 6 + ci));
      } else {
        mat.opacity = CONN_OPACITY;
      }
    });

    renderer.render(scene, camera);
  }

  frameId = requestAnimationFrame(animate);

  // ── Resize ────────────────────────────────────────────────────────────────
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  return {
    setTraining: (v) => { isTraining = v; },
    dispose: () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

export default function ModelViz3D({ architecture, isTraining = false }) {
  const containerRef = useRef(null);
  const sceneRef     = useRef(null);

  // Rebuild scene when architecture changes
  useEffect(() => {
    if (!containerRef.current) return;
    // Default display architecture when nothing selected
    const arch = (architecture && architecture.length >= 2)
      ? architecture
      : [7, 32, 16, 1];

    if (sceneRef.current) {
      sceneRef.current.dispose();
    }
    sceneRef.current = buildScene(arch, containerRef.current);

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [JSON.stringify(architecture)]);

  // Flip training flag without rebuilding
  useEffect(() => {
    sceneRef.current?.setTraining(isTraining);
  }, [isTraining]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#050510' }}
    />
  );
}
