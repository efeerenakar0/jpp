"use client";

import { useEffect, useRef, useState } from "react";

export interface SpatialOperatingCoreProps {
  readonly ariaLabel: string;
  readonly signalLabels: readonly string[];
}

type RenderState = "loading" | "ready" | "fallback";

const coreVertexShader = `
  uniform float uTime;

  varying float vEnergyBand;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    float axialWave = sin(position.y * 4.2 + uTime * 0.42);
    float crossWave = sin((position.x + position.z) * 5.1 - uTime * 0.35);
    float displacement = axialWave * crossWave * 0.018;
    vec3 displaced = position + normal * displacement;
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);

    vEnergyBand = 0.5 + 0.5 * sin(displaced.y * 3.8 + uTime * 0.25);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const coreFragmentShader = `
  uniform vec2 uPointer;

  varying float vEnergyBand;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normalDirection = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 keyDirection = normalize(vec3(
      -0.45 + uPointer.x * 0.28,
      0.70 - uPointer.y * 0.22,
      1.0
    ));
    vec3 halfDirection = normalize(keyDirection + viewDirection);

    float facing = clamp(dot(normalDirection, viewDirection), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.35);
    float facetLight = pow(max(dot(normalDirection, keyDirection), 0.0), 1.4);
    float materialSpecular = pow(max(dot(normalDirection, halfDirection), 0.0), 26.0);
    float materialMix = clamp(vEnergyBand * 0.26 + facetLight * 0.48, 0.0, 1.0);

    vec3 deepBlue = vec3(0.018, 0.075, 0.42);
    vec3 electricBlue = vec3(0.055, 0.255, 1.0);
    vec3 signalCyan = vec3(0.28, 0.83, 1.0);
    vec3 color = mix(deepBlue, electricBlue, materialMix);
    color += signalCyan * fresnel * 0.68;
    color += signalCyan * facetLight * 0.08;
    color += signalCyan * materialSpecular * 0.26;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmosphereVertexShader = `
  varying vec3 vNormalDirection;
  varying vec3 vViewDirection;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalDirection = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormalDirection;
  varying vec3 vViewDirection;

  void main() {
    float rim = pow(1.0 - abs(dot(vNormalDirection, vViewDirection)), 2.6);
    vec3 color = mix(vec3(0.08, 0.24, 1.0), vec3(0.34, 0.88, 1.0), rim);
    gl_FragColor = vec4(color, rim * 0.24);
  }
`;

/**
 * A code-native Three.js scene. It deliberately carries no product copy or
 * fabricated data: all meaningful labels remain accessible HTML around it.
 */
export function SpatialOperatingCore({
  ariaLabel,
  signalLabels,
}: SpatialOperatingCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderState, setRenderState] = useState<RenderState>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    let disposed = false;
    let disposeScene = () => {};
    let hasStarted = false;
    let startupObserver: IntersectionObserver | null = null;
    let startupDelay: number | null = null;
    let startupIdleCallback: number | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactViewport = window.matchMedia("(max-width: 767px)");

    const cancelScheduledStart = () => {
      if (startupDelay !== null) {
        window.clearTimeout(startupDelay);
        startupDelay = null;
      }

      if (startupIdleCallback !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(startupIdleCallback);
        startupIdleCallback = null;
      }
    };

    const initialise = async () => {
      try {
        const THREE = await import("three");

        if (disposed) {
          return;
        }

        const isCompact = compactViewport.matches;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: !isCompact,
          canvas,
          powerPreference: "high-performance",
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 40);
        camera.position.set(0, 0.05, 7.3);

        const operatingSystem = new THREE.Group();
        operatingSystem.rotation.x = -0.08;
        scene.add(operatingSystem);

        const coreUniforms = {
          uPointer: { value: new THREE.Vector2() },
          uTime: { value: 0 },
        };
        const coreMaterial = new THREE.ShaderMaterial({
          fragmentShader: coreFragmentShader,
          uniforms: coreUniforms,
          vertexShader: coreVertexShader,
        });
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.98, isCompact ? 3 : 5),
          coreMaterial,
        );
        operatingSystem.add(core);

        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(1.16, isCompact ? 24 : 42, isCompact ? 14 : 24),
          new THREE.ShaderMaterial({
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fragmentShader: atmosphereFragmentShader,
            side: THREE.BackSide,
            transparent: true,
            vertexShader: atmosphereVertexShader,
          }),
        );
        operatingSystem.add(atmosphere);

        const innerCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 2),
          new THREE.MeshStandardMaterial({
            color: 0x8fe4ff,
            emissive: 0x43c9ff,
            emissiveIntensity: 1.1,
            metalness: 0.28,
            roughness: 0.14,
          }),
        );
        innerCore.rotation.z = Math.PI / 4;
        operatingSystem.add(innerCore);

        const wireCore = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.24, 2),
          new THREE.MeshBasicMaterial({
            color: 0x72d8ff,
            opacity: 0.24,
            transparent: true,
            wireframe: true,
          }),
        );
        operatingSystem.add(wireCore);

        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x72d8ff,
          opacity: 0.22,
          transparent: true,
        });
        const ringConfigs = [
          { radius: 1.48, rotation: [0.62, 0.08, 0.16] },
          { radius: 1.92, rotation: [1.18, 0.32, -0.38] },
          { radius: 2.48, rotation: [0.18, 1.06, 0.52] },
        ] as const;
        const rings = ringConfigs.map(({ radius, rotation }) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius, 0.012, 8, isCompact ? 72 : 144),
            ringMaterial.clone(),
          );
          ring.rotation.set(rotation[0], rotation[1], rotation[2]);
          operatingSystem.add(ring);
          return ring;
        });

        const nodePositions = [
          new THREE.Vector3(-2.3, 1.15, 0.08),
          new THREE.Vector3(2.42, 1.02, -0.14),
          new THREE.Vector3(2.26, -1.3, 0.18),
          new THREE.Vector3(-2.18, -1.46, -0.12),
          new THREE.Vector3(0.06, 2.34, 0.12),
        ];
        const nodeMaterial = new THREE.MeshStandardMaterial({
          color: 0xc9f2ff,
          emissive: 0x43c9ff,
          emissiveIntensity: 0.72,
          metalness: 0.36,
          roughness: 0.24,
        });
        const signalPulseGeometry = new THREE.SphereGeometry(
          isCompact ? 0.045 : 0.038,
          10,
          8,
        );
        const signalPulseMaterial = new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: 0x8fe4ff,
          depthWrite: false,
          opacity: 0.88,
          transparent: true,
        });
        const impactGeometry = new THREE.RingGeometry(
          isCompact ? 0.052 : 0.045,
          isCompact ? 0.074 : 0.067,
          isCompact ? 20 : 28,
        );
        const signalFlows: Array<{
          curve: InstanceType<typeof THREE.QuadraticBezierCurve3>;
          impact: InstanceType<typeof THREE.Mesh>;
          impactMaterial: InstanceType<typeof THREE.MeshBasicMaterial>;
          offset: number;
          pulse: InstanceType<typeof THREE.Mesh>;
          target: InstanceType<typeof THREE.Vector3>;
        }> = [];
        const nodes = nodePositions.map((position, index) => {
          const curveControl = position.clone().multiplyScalar(0.46);
          curveControl.z += index % 2 === 0 ? 0.92 : -0.72;
          curveControl.y += (index - 2) * 0.08;
          const curve = new THREE.QuadraticBezierCurve3(
            position.clone(),
            curveControl,
            new THREE.Vector3(0, 0, 0),
          );
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(
            curve.getPoints(isCompact ? 28 : 56),
          );
          const line = new THREE.Line(
            lineGeometry,
            new THREE.LineBasicMaterial({
              color: index === 0 ? 0x2448ff : 0x43c9ff,
              opacity: index === 0 ? 0.32 : 0.2,
              transparent: true,
            }),
          );
          operatingSystem.add(line);

          const pulseCount = isCompact ? 1 : 2;
          for (let pulseIndex = 0; pulseIndex < pulseCount; pulseIndex += 1) {
            const pulse = new THREE.Mesh(signalPulseGeometry, signalPulseMaterial);
            const offset = index * 0.137 + pulseIndex * 0.47;
            const target = new THREE.Vector3();
            curve.getPoint(offset % 1, target);
            pulse.position.copy(target);
            pulse.renderOrder = 3;
            operatingSystem.add(pulse);

            const impactMaterial = new THREE.MeshBasicMaterial({
              blending: THREE.AdditiveBlending,
              color: index === 0 ? 0x8fe4ff : 0x43c9ff,
              depthWrite: false,
              opacity: 0,
              side: THREE.DoubleSide,
              transparent: true,
            });
            const impact = new THREE.Mesh(impactGeometry, impactMaterial);
            curve.getPoint(0.91, impact.position);
            impact.renderOrder = 2;
            impact.visible = false;
            operatingSystem.add(impact);
            signalFlows.push({ curve, impact, impactMaterial, offset, pulse, target });
          }

          const node = new THREE.Mesh(
            new THREE.OctahedronGeometry(index === 0 ? 0.15 : 0.11, 1),
            nodeMaterial.clone(),
          );
          node.position.copy(position);
          operatingSystem.add(node);

          const halo = new THREE.Mesh(
            new THREE.RingGeometry(index === 0 ? 0.25 : 0.2, index === 0 ? 0.27 : 0.215, 48),
            new THREE.MeshBasicMaterial({
              color: index === 0 ? 0x2448ff : 0x43c9ff,
              opacity: index === 0 ? 0.52 : 0.3,
              side: THREE.DoubleSide,
              transparent: true,
            }),
          );
          halo.position.copy(position);
          operatingSystem.add(halo);

          return { halo, node };
        });

        const pointCount = isCompact ? 56 : 96;
        const pointPositions = new Float32Array(pointCount * 3);
        for (let index = 0; index < pointCount; index += 1) {
          const phi = Math.acos(-1 + (2 * index) / pointCount);
          const theta = Math.sqrt(pointCount * Math.PI) * phi;
          const radius = 3.1 + ((index * 17) % 13) * 0.055;
          pointPositions[index * 3] = radius * Math.cos(theta) * Math.sin(phi);
          pointPositions[index * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
          pointPositions[index * 3 + 2] = radius * Math.cos(phi) * 0.42;
        }
        const pointGeometry = new THREE.BufferGeometry();
        pointGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(pointPositions, 3),
        );
        const points = new THREE.Points(
          pointGeometry,
          new THREE.PointsMaterial({
            color: 0x72d8ff,
            opacity: 0.34,
            size: 0.025,
            sizeAttenuation: true,
            transparent: true,
          }),
        );
        operatingSystem.add(points);

        scene.add(new THREE.HemisphereLight(0xb9ecff, 0x061126, 1.3));
        const keyLight = new THREE.PointLight(0x7bdfff, 24, 14, 1.7);
        keyLight.position.set(3.4, 2.8, 4.6);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0x2448ff, 18, 12, 1.7);
        rimLight.position.set(-4, -1.8, 3.1);
        scene.add(rimLight);

        let isIntersecting = true;
        let pointerX = 0;
        let pointerY = 0;
        let scrollDepth = 0;
        const shaderPointerTarget = new THREE.Vector2();

        const resize = () => {
          const { width, height } = container.getBoundingClientRect();
          if (width <= 0 || height <= 0) {
            return;
          }
          renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, compactViewport.matches ? 1.2 : 1.55),
          );
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };

        const updateScrollDepth = () => {
          const rect = container.getBoundingClientRect();
          scrollDepth = Math.max(
            0,
            Math.min(1, -rect.top / Math.max(rect.height * 0.9, 1)),
          );
        };

        const render = (time = 0) => {
          const seconds = time * 0.001;
          const materialTime = reducedMotion.matches ? 0 : seconds;
          coreUniforms.uTime.value = materialTime;
          shaderPointerTarget.set(
            reducedMotion.matches ? 0 : pointerX,
            reducedMotion.matches ? 0 : pointerY,
          );
          coreUniforms.uPointer.value.lerp(
            shaderPointerTarget,
            reducedMotion.matches ? 1 : 0.075,
          );

          signalFlows.forEach(({ curve, impact, impactMaterial, offset, pulse, target }) => {
            const progress = reducedMotion.matches
              ? offset % 1
              : (seconds * 0.115 + offset) % 1;
            curve.getPoint(progress, target);
            pulse.position.copy(target);
            pulse.scale.setScalar(0.68 + Math.sin(progress * Math.PI) * 0.82);
            const impactPhase = Math.max(0, (progress - 0.82) / 0.18);
            impact.visible = !reducedMotion.matches && impactPhase > 0;
            impact.scale.setScalar(0.72 + impactPhase * 2.7);
            impactMaterial.opacity = Math.sin(impactPhase * Math.PI) * 0.38;
          });

          if (!reducedMotion.matches) {
            operatingSystem.rotation.y +=
              (pointerX * 0.16 + seconds * 0.05 + scrollDepth * 0.2 -
                operatingSystem.rotation.y) *
              0.035;
            operatingSystem.rotation.x +=
              (-0.08 + pointerY * 0.1 - scrollDepth * 0.1 - operatingSystem.rotation.x) *
              0.04;
            operatingSystem.rotation.z +=
              (scrollDepth * 0.055 - operatingSystem.rotation.z) * 0.035;
            const targetScale = 1 - scrollDepth * 0.055;
            operatingSystem.scale.x += (targetScale - operatingSystem.scale.x) * 0.04;
            operatingSystem.scale.y += (targetScale - operatingSystem.scale.y) * 0.04;
            operatingSystem.scale.z += (targetScale - operatingSystem.scale.z) * 0.04;
            camera.position.x += (pointerX * 0.09 - camera.position.x) * 0.035;
            camera.position.y += (0.05 - pointerY * 0.07 - camera.position.y) * 0.035;
            camera.position.z += (7.3 + scrollDepth * 0.34 - camera.position.z) * 0.035;
            camera.lookAt(0, 0, 0);
            core.rotation.y = seconds * 0.17;
            core.rotation.x = seconds * 0.08;
            innerCore.rotation.y = -seconds * 0.32;
            wireCore.rotation.y = -seconds * 0.1;
            atmosphere.rotation.y = seconds * 0.025;
            rings[0].rotation.z = 0.16 + seconds * 0.045;
            rings[1].rotation.z = -0.38 - seconds * 0.032;
            rings[2].rotation.x = 0.18 + Math.sin(seconds * 0.22) * 0.06;
            nodes.forEach(({ halo, node }, index) => {
              const pulse = 1 + Math.sin(seconds * 1.25 + index * 1.1) * 0.12;
              halo.scale.setScalar(pulse);
              node.rotation.y = seconds * (0.22 + index * 0.018);
            });
            points.rotation.z = seconds * 0.008;
          }
          renderer.render(scene, camera);
        };

        const syncLoop = () => {
          const shouldAnimate =
            !reducedMotion.matches && isIntersecting && !document.hidden;
          renderer.setAnimationLoop(shouldAnimate ? render : null);
          if (!shouldAnimate) {
            render(0);
          }
        };

        const handlePointerMove = (event: PointerEvent) => {
          if (reducedMotion.matches) {
            return;
          }
          const rect = container.getBoundingClientRect();
          pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
          pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        };
        const handlePointerLeave = () => {
          pointerX = 0;
          pointerY = 0;
        };
        const handleVisibility = () => syncLoop();
        const handleMotionPreference = () => {
          if (reducedMotion.matches) {
            pointerX = 0;
            pointerY = 0;
          }
          syncLoop();
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        const intersectionObserver = new IntersectionObserver(
          ([entry]) => {
            isIntersecting = entry?.isIntersecting ?? false;
            syncLoop();
          },
          { rootMargin: "160px" },
        );
        intersectionObserver.observe(container);
        container.addEventListener("pointermove", handlePointerMove, { passive: true });
        container.addEventListener("pointerleave", handlePointerLeave, { passive: true });
        document.addEventListener("visibilitychange", handleVisibility);
        reducedMotion.addEventListener("change", handleMotionPreference);
        window.addEventListener("scroll", updateScrollDepth, { passive: true });

        resize();
        updateScrollDepth();
        renderer.compile(scene, camera);
        syncLoop();
        setRenderState("ready");

        disposeScene = () => {
          renderer.setAnimationLoop(null);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();
          container.removeEventListener("pointermove", handlePointerMove);
          container.removeEventListener("pointerleave", handlePointerLeave);
          document.removeEventListener("visibilitychange", handleVisibility);
          reducedMotion.removeEventListener("change", handleMotionPreference);
          window.removeEventListener("scroll", updateScrollDepth);
          const geometries = new Set<InstanceType<typeof THREE.BufferGeometry>>();
          const materials = new Set<InstanceType<typeof THREE.Material>>();
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
              geometries.add(object.geometry);
              const objectMaterials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              objectMaterials.forEach((material) => materials.add(material));
            }
          });
          geometries.forEach((geometry) => geometry.dispose());
          materials.forEach((material) => material.dispose());
          ringMaterial.dispose();
          nodeMaterial.dispose();
          renderer.dispose();
        };
      } catch {
        if (!disposed) {
          setRenderState("fallback");
        }
      }
    };

    const startInitialise = () => {
      if (disposed || hasStarted || reducedMotion.matches) {
        return;
      }

      hasStarted = true;
      cancelScheduledStart();
      startupObserver?.disconnect();
      reducedMotion.removeEventListener("change", handleStartupMotionChange);
      void initialise();
    };

    const scheduleCompactInitialise = () => {
      if (hasStarted || startupDelay !== null || startupIdleCallback !== null) {
        return;
      }

      // The CSS fallback is a complete first paint. On compact screens, give
      // the headline and primary actions the main thread before importing and
      // compiling Three.js, then progressively upgrade the scene while idle.
      startupDelay = window.setTimeout(() => {
        startupDelay = null;

        if ("requestIdleCallback" in window) {
          startupIdleCallback = window.requestIdleCallback(
            () => {
              startupIdleCallback = null;
              startInitialise();
            },
            { timeout: 1_600 },
          );
          return;
        }

        startInitialise();
      }, 650);
    };

    const scheduleInitialise = () => {
      if (reducedMotion.matches) {
        setRenderState("fallback");
        return;
      }

      setRenderState("loading");
      if (compactViewport.matches && "IntersectionObserver" in window) {
        startupObserver?.disconnect();
        startupObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.34) {
              scheduleCompactInitialise();
            }
          },
          { threshold: 0.34 },
        );
        startupObserver.observe(container);
        return;
      }

      startInitialise();
    };

    function handleStartupMotionChange() {
      if (hasStarted) {
        return;
      }

      startupObserver?.disconnect();
      cancelScheduledStart();
      scheduleInitialise();
    }

    reducedMotion.addEventListener("change", handleStartupMotionChange);
    scheduleInitialise();

    return () => {
      disposed = true;
      startupObserver?.disconnect();
      cancelScheduledStart();
      reducedMotion.removeEventListener("change", handleStartupMotionChange);
      disposeScene();
    };
  }, []);

  return (
    <div
      className="bceo-spatial-core"
      data-render-state={renderState}
      ref={containerRef}
    >
      <div className="bceo-spatial-core__fallback" aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
      </div>
      <canvas
        aria-label={ariaLabel}
        className="bceo-spatial-core__canvas"
        ref={canvasRef}
        role="img"
      />
      <div className="bceo-spatial-core__labels" aria-hidden="true">
        {signalLabels.slice(0, 5).map((label, index) => (
          <span data-position={index + 1} key={label}>
            <i />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
