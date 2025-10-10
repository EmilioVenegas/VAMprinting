import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface STLViewerProps {
  file: File | null;
  rotation: { x: number; y: number; z: number };
}

const STLViewer: React.FC<STLViewerProps> = ({ file, rotation }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const rotationRad = {
      x: THREE.MathUtils.degToRad(rotation.x),
      y: THREE.MathUtils.degToRad(rotation.y),
      z: THREE.MathUtils.degToRad(rotation.z),
  }

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171717); // neutral-900

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    mountNode.appendChild(renderer.domElement);
    
    const camera = new THREE.PerspectiveCamera(75, mountNode.clientWidth / mountNode.clientHeight || 1, 0.1, 1000);
    camera.position.z = 100;
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(0, 3, 5);
    scene.add(directionalLight);

    const modelGroup = new THREE.Group();
    modelRef.current = modelGroup;
    scene.add(modelGroup);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const observer = new ResizeObserver(entries => {
        if (!mountNode) return;
        const { width, height } = entries[0].contentRect;
        if (width === 0 || height === 0) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
    observer.observe(mountNode);

    return () => {
      observer.disconnect();
      if (mountNode && renderer.domElement.parentNode === mountNode) {
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (file && modelRef.current && cameraRef.current && controlsRef.current) {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const loader = new STLLoader();
        const reader = new FileReader();
        reader.onload = (event) => {
            const contents = event.target?.result as ArrayBuffer;
            const geometry = loader.parse(contents);
            geometry.center(); // Center the geometry's vertices around the origin
            
            const material = new THREE.MeshStandardMaterial({ color: 0xd4d4d4 }); // neutral-300
            const mesh = new THREE.Mesh(geometry, material);
            
            // Visually orient model by rotating it -90 degrees on the X-axis without affecting slicing data.
            mesh.rotation.x = -Math.PI / 2;
            


            // Automatically adjust camera to frame the object
            const box = new THREE.Box3().setFromObject(mesh);
            const sphere = box.getBoundingSphere(new THREE.Sphere());
            const radius = sphere.radius;

            const fov = camera.fov * (Math.PI / 180);
            const camDistance = radius / Math.sin(fov / 2);
            
            const cameraOffset = camDistance * 1.2;
            // Position camera at a 3/4 angle for a better perspective view
            camera.position.set(
                radius * 0.7, // Move right
                radius * 0.5, // Move up
                cameraOffset  // Move back
            );

            camera.far = camDistance * 4; // Ensure far plane is far enough
            camera.updateProjectionMatrix();

            controls.target.set(0, 0, 0); // Point controls at the center of the object
            controls.update();
            
            if(modelRef.current){
                modelRef.current.clear();
                modelRef.current.add(mesh);
            }
        };
        reader.readAsArrayBuffer(file);
    }
  }, [file]);

  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.rotation.set(rotationRad.x, rotationRad.y, rotationRad.z);
    }
  }, [rotationRad.x, rotationRad.y, rotationRad.z]);

  return <div ref={mountRef} className="w-full h-full bg-neutral-900" />;
};

export default STLViewer;