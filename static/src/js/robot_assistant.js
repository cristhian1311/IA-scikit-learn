/** @odoo-module **/

// THREE.js se carga globalmente desde el CDN
// No necesitamos importarlo

export default class RobotAssistant {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);

        if (!this.container) {
            console.error(`Container with id ${containerId} not found`);
            return;
        }

        console.log("Initializing Robot Assistant...");
        this.initScene();
        this.createRobot();
        this.animate();
    }

    initScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f4f8);

        // Camera
        const width = this.container.clientWidth || 400;
        const height = this.container.clientHeight || 300;

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        const pointLight1 = new THREE.PointLight(0x4a90e2, 0.5, 50);
        pointLight1.position.set(-5, 5, 5);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xe24a90, 0.3, 50);
        pointLight2.position.set(5, 3, -5);
        this.scene.add(pointLight2);

        // Floor
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xe0e0e0,
            roughness: 0.8,
            metalness: 0.2
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
    }

    createRobot() {
        this.robot = new THREE.Group();

        // Materials
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x4a90e2,
            shininess: 100,
            specular: 0x444444
        });

        const headMaterial = new THREE.MeshPhongMaterial({
            color: 0x5ca0f2,
            shininess: 100,
            specular: 0x444444
        });

        const darkMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a6ba2,
            shininess: 80,
            specular: 0x222222
        });

        const eyeMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff88,
            emissive: 0x00ff44,
            emissiveIntensity: 0.6,
            shininess: 100
        });

        const antennaMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            shininess: 50
        });

        const antennaLightMaterial = new THREE.MeshPhongMaterial({
            color: 0xff3366,
            emissive: 0xff0044,
            emissiveIntensity: 0.5,
            shininess: 100
        });

        // Body
        const bodyGeometry = new THREE.BoxGeometry(1.5, 2, 1);
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.body.position.y = 0;
        this.robot.add(this.body);

        // Head
        const headGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.castShadow = true;
        this.head.position.y = 1.5;
        this.robot.add(this.head);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);

        this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        this.leftEye.position.set(-0.25, 1.6, 0.51);
        this.robot.add(this.leftEye);

        this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        this.rightEye.position.set(0.25, 1.6, 0.51);
        this.robot.add(this.rightEye);

        // Antenna
        const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
        this.antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        this.antenna.position.y = 2.25;
        this.antenna.castShadow = true;
        this.robot.add(this.antenna);

        const antennaBallGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        this.antennaBall = new THREE.Mesh(antennaBallGeometry, antennaLightMaterial);
        this.antennaBall.position.y = 2.5;
        this.robot.add(this.antennaBall);

        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);

        this.leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        this.leftArm.castShadow = true;
        this.leftArm.position.set(-1, 0.2, 0);
        this.leftArm.rotation.z = Math.PI / 6;
        this.robot.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        this.rightArm.castShadow = true;
        this.rightArm.position.set(1, 0.2, 0);
        this.rightArm.rotation.z = -Math.PI / 6;
        this.robot.add(this.rightArm);

        // Hands
        const handGeometry = new THREE.SphereGeometry(0.25, 16, 16);

        this.leftHand = new THREE.Mesh(handGeometry, darkMaterial);
        this.leftHand.castShadow = true;
        this.leftHand.position.set(-1.3, -0.5, 0);
        this.robot.add(this.leftHand);

        this.rightHand = new THREE.Mesh(handGeometry, darkMaterial);
        this.rightHand.castShadow = true;
        this.rightHand.position.set(1.3, -0.5, 0);
        this.robot.add(this.rightHand);

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 8);

        this.leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        this.leftLeg.castShadow = true;
        this.leftLeg.position.set(-0.4, -1.75, 0);
        this.robot.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        this.rightLeg.castShadow = true;
        this.rightLeg.position.set(0.4, -1.75, 0);
        this.robot.add(this.rightLeg);

        // Feet
        const footGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.6);

        this.leftFoot = new THREE.Mesh(footGeometry, darkMaterial);
        this.leftFoot.castShadow = true;
        this.leftFoot.position.set(-0.4, -2.6, 0.1);
        this.robot.add(this.leftFoot);

        this.rightFoot = new THREE.Mesh(footGeometry, darkMaterial);
        this.rightFoot.castShadow = true;
        this.rightFoot.position.set(0.4, -2.6, 0.1);
        this.robot.add(this.rightFoot);

        // Position robot
        this.robot.position.y = 2;
        this.scene.add(this.robot);

        console.log("Robot created successfully");
    }

    animate() {
        this.time = 0;

        const animateLoop = () => {
            this.animationId = requestAnimationFrame(animateLoop);

            this.time += 0.01;

            if (this.robot) {
                // Rotate robot
                this.robot.rotation.y = Math.sin(this.time * 0.5) * 0.3;

                // Levitate
                this.robot.position.y = 2 + Math.sin(this.time * 1.5) * 0.15;

                // Blink eyes
                const blinkScale = Math.abs(Math.sin(this.time * 2)) > 0.95 ? 0.1 : 1;
                if (this.leftEye && this.rightEye) {
                    this.leftEye.scale.y = blinkScale;
                    this.rightEye.scale.y = blinkScale;
                }

                // Wave arms
                if (this.leftArm && this.rightArm) {
                    this.leftArm.rotation.z = Math.PI / 6 + Math.sin(this.time) * 0.3;
                    this.rightArm.rotation.z = -Math.PI / 6 - Math.sin(this.time) * 0.3;
                }

                // Bounce antenna
                if (this.antennaBall) {
                    this.antennaBall.position.y = 2.5 + Math.sin(this.time * 3) * 0.1;
                }

                // Tilt head slightly
                if (this.head) {
                    this.head.rotation.x = Math.sin(this.time * 0.8) * 0.1;
                }
            }

            this.renderer.render(this.scene, this.camera);
        };

        animateLoop();
    }

    destroy() {
        console.log("Destroying Robot Assistant...");

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.container && this.renderer.domElement) {
                this.container.removeChild(this.renderer.domElement);
            }
        }

        // Dispose geometries and materials
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        console.log("Robot Assistant destroyed");
    }
}