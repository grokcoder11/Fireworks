import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let clock = new THREE.Clock();
const fireworks = []; // Array to hold active fireworks (rockets and explosions)
const gravity = new THREE.Vector3(0, -9.8, 0); // Simulate gravity
const groundLevel = 0;
let groundPlaneMesh; // Reference to the ground plane for raycasting

// --- Configuration ---
const ROCKET_LIFESPAN = 1.5; // Time in seconds before rocket explodes
const ROCKET_VELOCITY = 60; // Speed of the rocket
const PARTICLE_COUNT = 300; // Particles per explosion
const PARTICLE_LIFESPAN = 2.0; // Fade out time for explosion particles
const PARTICLE_INITIAL_SPEED = 30; // Speed of particles at explosion
const STAR_COUNT = 5000; // Number of background stars

// --- Initialization ---
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050010); // Dark blue/purple night sky

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 50, 100); // Elevated view

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true }); // << Use antialiasing now
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    // Lighting (Subtle ambient light)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // soft white light
    scene.add(ambientLight);

    // Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide }); // << Use StandardMaterial for better look with light
    groundPlaneMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlaneMesh.rotation.x = -Math.PI / 2; // Rotate flat
    groundPlaneMesh.position.y = groundLevel;
    scene.add(groundPlaneMesh);

    // Starry Background
    createStars();

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movement
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 20;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera going below ground

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('click', launchFireworkOnClick, false);

    // Start animation loop
    animate();
}

// --- Starry Background ---
function createStars() {
    const starVertices = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        const x = THREE.MathUtils.randFloatSpread(1500); // Spread stars across a large area
        const y = THREE.MathUtils.randFloat(100, 750); // Stars appear higher up
        const z = THREE.MathUtils.randFloatSpread(1500);
        starVertices.push(x, y, z);
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));

    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending, // Brighter where stars overlap
        depthWrite: false // Prevent stars from blocking transparent objects
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// --- Firework Launch ---
function launchFireworkOnClick(event) {
    const mouse = new THREE.Vector2();
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(groundPlaneMesh);

    if (intersects.length > 0) {
        const launchPosition = intersects[0].point;
        launchPosition.y = groundLevel + 0.1; // Start slightly above ground
        createFireworkRocket(launchPosition);
    }
}

// --- Create Rocket ---
function createFireworkRocket(position) {
    const rocketGeometry = new THREE.SphereGeometry(0.5, 16, 8); // Small sphere
    // << Add emissive property back for glow
    const rocketMaterial = new THREE.MeshBasicMaterial({
        color: 0xffa500, // Orange glow
        emissive: 0xffa500, // Make it glow
        emissiveIntensity: 2.0
     });
    const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
    rocketMesh.position.copy(position);

    // Calculate target height (randomized)
    const targetHeight = THREE.MathUtils.randFloat(80, 150);
    const targetPosition = new THREE.Vector3(position.x, targetHeight, position.z);

    // Calculate velocity vector
    const velocity = new THREE.Vector3()
        .subVectors(targetPosition, position)
        .normalize()
        .multiplyScalar(ROCKET_VELOCITY);

    scene.add(rocketMesh);

    // Store firework data
    fireworks.push({
        type: 'rocket',
        mesh: rocketMesh,
        velocity: velocity,
        targetHeight: targetHeight,
        age: 0
    });
}

// --- Create Explosion ---
function createExplosion(position) {
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    const particleVelocities = [];
    const particleColors = [];
    const particleLifes = [];
    const explosionColor = new THREE.Color().setHSL(Math.random(), 1.0, 0.6); // Random bright color

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Initial position (center of explosion)
        particlePositions.push(position.x, position.y, position.z);

        // Initial velocity (random outward direction)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = Math.random() * PARTICLE_INITIAL_SPEED;

        const vx = speed * Math.sin(phi) * Math.cos(theta);
        const vy = speed * Math.cos(phi);
        const vz = speed * Math.sin(phi) * Math.sin(theta);
        particleVelocities.push(vx, vy, vz);

        // Color (base explosion color with slight variations)
        const colorVariation = Math.random() * 0.2 - 0.1;
        const particleColor = explosionColor.clone().offsetHSL(colorVariation, 0, colorVariation);
        particleColors.push(particleColor.r, particleColor.g, particleColor.b);

        // Lifetime
        particleLifes.push(PARTICLE_LIFESPAN * THREE.MathUtils.randFloat(0.8, 1.2)); // Randomize slightly
    }

    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    particlesGeometry.setAttribute('color', new THREE.Float33BufferAttribute(particleColors, 3)); // << Use Float33BufferAttribute for color

    // << Use original PointsMaterial settings for proper effect
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true, // Use colors defined in geometry attribute
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending, // Bright, glowing effect
        depthWrite: false // Important for transparency layering
    });

    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    particleSystem.userData = { // Store physics data directly on the object
        velocities: particleVelocities,
        lifes: particleLifes,
        age: 0
    };

    scene.add(particleSystem);

    fireworks.push({
        type: 'explosion',
        mesh: particleSystem,
        age: 0,
        lifespan: PARTICLE_LIFESPAN // Overall lifespan for removal check
    });
}


// --- Update Logic ---
function updateFireworks(deltaTime) {
    const fireworksToRemove = [];
     deltaTime = Math.min(deltaTime, 0.05); // Cap delta time

    fireworks.forEach((fw, index) => {
        fw.age += deltaTime;

        if (fw.type === 'rocket') {
            // Update rocket position
            fw.mesh.position.addScaledVector(fw.velocity, deltaTime);

            // Apply some pseudo-gravity/drag to make the arc look better (optional)
            fw.velocity.y -= 2.0 * deltaTime; // Simple drag/arc effect

            // Check if reached target height or lifespan
            if (fw.mesh.position.y >= fw.targetHeight || fw.age > ROCKET_LIFESPAN) {
                createExplosion(fw.mesh.position);
                // Safely remove and dispose
                if (fw.mesh.parent) fw.mesh.parent.remove(fw.mesh);
                fw.mesh.geometry.dispose();
                fw.mesh.material.dispose();
                fireworksToRemove.push(index);
            }
        } else if (fw.type === 'explosion') {
            const particles = fw.mesh;
            const geometry = particles.geometry;
            const positions = geometry.attributes.position.array;
            const velocities = particles.userData.velocities;
            const lifes = particles.userData.lifes;
            particles.userData.age += deltaTime;

            let aliveParticles = 0; // Count active particles for optimization
            for (let i = 0; i < positions.length / 3; i++) {
                const idx = i * 3;
                const lifeIdx = i; // Lifespan is per particle for potential future use

                // Check if particle is still alive based on overall explosion age for simplicity now
                 if (particles.userData.age < PARTICLE_LIFESPAN) {
                    aliveParticles++;

                    // Apply gravity to velocity
                    velocities[idx + 1] += gravity.y * deltaTime; // y-component only

                    // Update position based on velocity
                    positions[idx] += velocities[idx] * deltaTime;
                    positions[idx + 1] += velocities[idx + 1] * deltaTime;
                    positions[idx + 2] += velocities[idx + 2] * deltaTime;

                 } else {
                    // Can optionally hide dead particles, e.g., set position to Infinity
                    // positions[idx] = Infinity;
                 }
            }

            // Update opacity based on overall explosion age for fade-out
            const timeRatio = particles.userData.age / fw.lifespan;
            particles.material.opacity = Math.max(0, 1.0 - timeRatio * timeRatio); // Fade out faster at the end

            // Mark positions as needing update only if particles are alive
            if (aliveParticles > 0) {
                geometry.attributes.position.needsUpdate = true;
            } else {
                 // Optional: Could mark for removal sooner if all particles visibly dead
            }


            // Remove explosion if overall age exceeds lifespan
            if (particles.userData.age > fw.lifespan) {
                // Safely remove and dispose
                if (particles.parent) particles.parent.remove(particles);
                geometry.dispose();
                particles.material.dispose();
                fireworksToRemove.push(index);
            }
        }
    });

    // Remove fireworks marked for removal (iterate backwards to avoid index issues)
    for (let i = fireworksToRemove.length - 1; i >= 0; i--) {
        fireworks.splice(fireworksToRemove[i], 1);
    }
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Update controls
    controls.update();

    // Update fireworks physics
    updateFireworks(deltaTime);

    // Render scene
    renderer.render(scene, camera);
}

// --- Handle Window Resize ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Start ---
init();