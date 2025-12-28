import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadCities } from './data.js';
import { latLonToVector3, getSunPosition, getMoonPosition } from './utils.js';
import { earthVertexShader, earthFragmentShader } from './shaders.js';

export class Globe {
    constructor(containerId, onCityHover) {
        this.container = document.getElementById(containerId);
        this.onCityHover = onCityHover;
        // ... (rest of constructor and init)

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.earth = null;
        this.controls = null;
        this.citiesGroup = new THREE.Group();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Groups
        this.universeGroup = new THREE.Group(); // Non-tilted (Sun/Moon/Stars)
        this.tiltedGroup = new THREE.Group();   // Tilted (Earth, Atmosphere, Cities)

        // Animation state
        this.isAnimating = false;
        this.targetPosition = new THREE.Vector3();
        this.autoRotateRestorer = null;

        this.init();
    }

    async init() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 25;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false;
        this.controls.minDistance = 6;
        this.controls.maxDistance = 60;
        this.controls.rotateSpeed = 0.5;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.3;

        const ambientLight = new THREE.AmbientLight(0x111111);
        this.scene.add(ambientLight);

        // AXIAL TILT
        // We set tilt to 0 because our sun/moon position logic in utils.js 
        // works in the Equatorial Frame (Earth Axis = Y). 
        // Seasonal tilt is handled by Sun's declination (moving up/down the Y axis).
        this.tiltedGroup.rotation.z = 0;
        this.scene.add(this.tiltedGroup);

        this.nonTiltedGroup = new THREE.Group();
        this.scene.add(this.nonTiltedGroup);

        this.createEarth();
        this.createSunMoon();
        this.createStars();

        // Load Cities
        const response = await fetch('/cities.json');
        const cities = await response.json();
        this.allCities = cities; // EXPOSE FOR UI SEARCH
        this.tiltedGroup.add(this.citiesGroup); // Ensure markers are in the scene!
        this.createMarkers(cities);

        // Initial Camera Position - Offset to give a "tilted" feel visually
        this.camera.position.set(8, 6, 12);
        this.controls.update();

        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));

        this.controls.addEventListener('change', () => {
            this.updateLOD();
        });

        this.controls.addEventListener('start', () => {
            this.cancelAutoRotateRestore();
        });

        this.animate();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(5, 64, 64);

        const textureLoader = new THREE.TextureLoader();
        const dayMap = textureLoader.load('/textures/earth.jpg');
        // Ensure we handle no-texture gracefully or wait.

        const nightMap = textureLoader.load('/textures/earth_lights.png');
        const specularMap = textureLoader.load('/textures/specular.jpg');

        const material = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { value: dayMap },
                nightTexture: { value: nightMap },
                specularMap: { value: specularMap },
                sunDirection: { value: new THREE.Vector3(1, 0, 0) }
            },
            vertexShader: earthVertexShader,
            fragmentShader: earthFragmentShader,
            transparent: true
        });

        this.earth = new THREE.Mesh(geometry, material);
        this.earth.rotation.y = -Math.PI / 2; // Center of texture (Lon 0) moves from -X to +Z
        this.tiltedGroup.add(this.earth);

        // Wireframe overlay (Neon)
        const wireGeo = new THREE.WireframeGeometry(geometry);
        const wireMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.1 });
        const wireframe = new THREE.LineSegments(wireGeo, wireMat);
        this.earth.add(wireframe);
    }

    createSunMoon() {
        // SUN
        const sunGeo = new THREE.SphereGeometry(1, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        // Sun Glow
        const spriteMat = new THREE.SpriteMaterial({
            map: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/spark1.png'),
            color: 0xffaa00,
            blending: THREE.AdditiveBlending
        });
        const sunGlow = new THREE.Sprite(spriteMat);
        sunGlow.scale.set(8, 8, 8);
        this.sunMesh.add(sunGlow);

        // SUN LIGHT (To light up the Moon!)
        // Intensity 2.0, No Decay (Reach infinite but not blinding)
        const sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 0);
        this.sunMesh.add(sunLight);

        // MOON
        // Use MeshStandardMaterial to react to sunlight
        const moonGeo = new THREE.SphereGeometry(1.0, 32, 32);
        const moonTexture = new THREE.TextureLoader().load('/textures/moon.jpg');
        const moonMat = new THREE.MeshStandardMaterial({
            map: moonTexture,
            roughness: 0.8,
            emissive: 0x111111 // Very faint glow for earthshine
        });
        this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonMesh);
    }

    createMarkers(cities) {
        this.citiesGroup.clear();
        // Use InstancedMesh for performance with 5000+ cities
        // Markers are white/cyan dots.

        const markerGeo = new THREE.SphereGeometry(0.015, 6, 6);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

        cities.forEach((city, index) => {
            // Convert "42.5" to 42.5
            const lat = parseFloat(city.lat);
            const lon = parseFloat(city.lon);
            if (isNaN(lat) || isNaN(lon)) return;

            // Tier estimation if missing
            if (!city.tier) {
                // Estimate tier by population if available
                city.tier = 3;
            }

            const pos = latLonToVector3(lat, lon, 5.02);

            const group = new THREE.Group();
            group.position.copy(pos);
            group.lookAt(new THREE.Vector3(0, 0, 0));

            const mesh = new THREE.Mesh(markerGeo, markerMat);
            group.add(mesh);

            group.userData = { city: city };

            this.citiesGroup.add(group);
        });

        this.updateLOD();
    }

    createStars() {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const radius = 90;

        for (let i = 0; i < 6000; i++) {
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius + (Math.random() * 50);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            vertices.push(x, y, z);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0xcccccc, size: 0.6 });
        const stars = new THREE.Points(geometry, material);
        this.scene.add(stars);
    }

    updateLOD() {
        const distance = this.camera.position.distanceTo(this.controls.target);

        this.citiesGroup.children.forEach((group) => {
            const city = group.userData.city;
            let visible = false;

            const pop = parseInt(city.population) || 0;

            if (distance < 20) visible = true; // Show all markers when reasonably close
            else if (distance < 35 && pop > 100000) visible = true;
            else if (pop > 1000000) visible = true;

            group.visible = visible;
        });
    }

    updateSun() {
        const sunPos = getSunPosition();
        if (this.sunMesh) {
            this.sunMesh.position.copy(sunPos);
        }

        if (this.moonMesh) {
            const moonPos = getMoonPosition();
            this.moonMesh.position.copy(moonPos);
            this.moonMesh.lookAt(0, 0, 0);
        }

        if (this.earth && this.earth.material.uniforms) {
            this.earth.material.uniforms.sunDirection.value.copy(sunPos).normalize();
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.citiesGroup.children, true);

        if (intersects.length > 0) {
            // Find group
            let obj = intersects[0].object;
            while (obj.parent && obj.parent !== this.citiesGroup) {
                obj = obj.parent;
            }

            const cityData = obj.userData.city;
            if (cityData) {
                document.body.style.cursor = 'pointer';
                this.onCityHover(cityData);
                obj.children[0].scale.set(3, 3, 3);
                obj.children[0].material.color.setHex(0xff0055);
            }
        } else {
            document.body.style.cursor = 'default';
            this.onCityHover(null);
            this.citiesGroup.children.forEach(group => {
                group.children[0].scale.set(1, 1, 1);
                group.children[0].material.color.setHex(0x00ffcc);
            });
        }
    }

    addTemporaryPin(lat, lon) {
        // Create a Sprite PIN using custom image
        const map = new THREE.TextureLoader().load('/pin.png');
        const material = new THREE.SpriteMaterial({ map: map, color: 0xffffff });
        const pin = new THREE.Sprite(material);

        const pos = latLonToVector3(lat, lon, 5.1);
        pin.position.copy(pos);
        pin.scale.set(1.5, 1.5, 1.5);
        pin.center.set(0.5, 0.0);

        // Add to Tilted Group so it matches earth!
        this.tiltedGroup.add(pin);

        setTimeout(() => {
            this.tiltedGroup.remove(pin);
            material.dispose();
        }, 6000);
    }

    flyTo(lat, lon) {
        this.cancelAutoRotateRestore();

        // We fly the CAMERA.
        // But now Earth is in Tilted Group.
        // latLonToVector3 returns position relative to Earth Center (0,0,0) in Local Space (untilted) usually?
        // Wait, latLonToVector3 assumes Y is North.
        // In Tilted Group, local Y is North (tilted axis).
        // So the vector (x,y,z) returned is correct in LOCAL space of TiltedGroup.

        // We need the WORLD position of that point to move Camera there?
        // Camera is in World Space (Scene root).

        const localTarget = latLonToVector3(lat, lon, 15); // Target dist 15
        const worldTarget = localTarget.clone().applyMatrix4(this.tiltedGroup.matrixWorld);

        this.controls.autoRotate = false;
        this.isAnimating = true;
        this.targetPosition.copy(worldTarget);
        this.animationStartPos = this.camera.position.clone();
        this.animationStartTime = Date.now();
        this.animationDuration = 2000;
    }

    cancelAutoRotateRestore() {
        if (this.autoRotateRestorer) {
            clearTimeout(this.autoRotateRestorer);
            this.autoRotateRestorer = null;
        }
    }

    scheduleAutoRotateRestore() {
        this.cancelAutoRotateRestore();
        this.autoRotateRestorer = setTimeout(() => {
            this.controls.autoRotate = true;
        }, 5000);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        if (this.isAnimating) {
            const now = Date.now();
            const progress = Math.min((now - this.animationStartTime) / this.animationDuration, 1);
            const t = 1 - Math.pow(1 - progress, 3);

            this.camera.position.lerpVectors(this.animationStartPos, this.targetPosition, t);
            this.camera.lookAt(0, 0, 0);

            if (progress >= 1) {
                this.isAnimating = false;
                this.scheduleAutoRotateRestore();
            }
        } else {
            this.controls.update();
        }

        this.updateSun();
        this.renderer.render(this.scene, this.camera);
    }
}
