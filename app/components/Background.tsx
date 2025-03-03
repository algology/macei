"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function Background() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    camera.position.z = 1000;

    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000;
    const positions = new Float32Array(particlesCount * 3);
    const velocities = new Float32Array(particlesCount * 3);
    const colors = new Float32Array(particlesCount * 3);

    const color1 = new THREE.Color("#007cf0").multiplyScalar(0.8);
    const color2 = new THREE.Color("#00dfd8").multiplyScalar(0.8);
    const color3 = new THREE.Color("#7928ca").multiplyScalar(0.8);
    const color4 = new THREE.Color("#ff0080").multiplyScalar(0.8);
    const colorArray = [color1, color2, color3, color4];

    // Create circular texture for glow effect
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.4)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(canvas);
    particleTexture.needsUpdate = true;
    particleTexture.generateMipmaps = false;

    for (let i = 0; i < particlesCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * window.innerWidth * 1.5;
      positions[i + 1] = (Math.random() - 0.5) * window.innerHeight * 1.5;
      positions[i + 2] = (Math.random() - 0.5) * 500;

      velocities[i] = (Math.random() - 0.5) * 0.2;
      velocities[i + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i + 2] = (Math.random() - 0.5) * 0.1;

      const randomColor =
        colorArray[Math.floor(Math.random() * colorArray.length)];
      colors[i] = randomColor.r;
      colors[i + 1] = randomColor.g;
      colors[i + 2] = randomColor.b;
    }

    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    particlesGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3)
    );

    const particlesMaterial = new THREE.PointsMaterial({
      size: 12,
      map: particleTexture,
      vertexColors: true,
      opacity: 0.35,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 2;
      mouseY = (event.clientY - window.innerHeight / 2) * 2;
    };

    const animate = () => {
      requestAnimationFrame(animate);

      const positions = particlesGeometry.attributes.position
        .array as Float32Array;

      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];

        const dx = mouseX - positions[i];
        const dy = -mouseY - positions[i + 1];
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 200) {
          velocities[i] += dx * 0.00002;
          velocities[i + 1] += dy * 0.00002;
        }

        if (Math.abs(positions[i]) > window.innerWidth) {
          positions[i] *= -0.5;
          velocities[i] *= -0.5;
        }
        if (Math.abs(positions[i + 1]) > window.innerHeight) {
          positions[i + 1] *= -0.5;
          velocities[i + 1] *= -0.5;
        }
        if (Math.abs(positions[i + 2]) > 500) {
          positions[i + 2] *= -0.5;
          velocities[i + 2] *= -0.5;
        }
      }

      particlesGeometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      particleTexture.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 grid-pattern opacity-[0.15]" />
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
