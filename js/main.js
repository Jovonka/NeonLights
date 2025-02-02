import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { FBXLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/FBXLoader.js";

// Scene setup
const scene = new THREE.Scene();

// Set up the orthographic camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 15;
const camera = new THREE.OrthographicCamera(
  (-frustumSize * aspect) / 1, // left
  (frustumSize * aspect) / 1,  // right
  frustumSize / 1,            // top
  -frustumSize / 1,           // bottom
  1,                        // near
  20000                        // far
);
camera.position.set(0, 10, 200); // Maintain original Z position
camera.lookAt(scene.position);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("container3D").appendChild(renderer.domElement);

const loader = new FBXLoader();

// Load the video element
const videoElement = document.createElement("video");
videoElement.loop = true;
videoElement.muted = true;
videoElement.autoplay = true;

const videoSources = [
  "./videos/video1.mp4",
  "./videos/video2.mp4",
  "./videos/video3.mp4",
  "./videos/video4.mp4",
];
let currentVideoIndex = 0;
let playbackSpeed = -10;

function playVideo(source) {
  videoElement.src = source;
  videoElement.load();
  videoElement.oncanplay = () => {
    videoElement.play();
    videoElement.playbackRate = playbackSpeed;
  };
}

playVideo(videoSources[currentVideoIndex]);

const videoTexture = new THREE.VideoTexture(videoElement);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.format = THREE.RGBFormat;

const brightness = 30.0;
const videoSize = new THREE.Vector2(1, 1);

// Shader-based video material
const videoMaterial = new THREE.ShaderMaterial({
  uniforms: {
    videoTexture: { value: videoTexture },
    brightness: { value: brightness },
    offset: { value: new THREE.Vector2(10, 10) },
    videoSize: { value: videoSize }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D videoTexture;
    uniform float brightness;
    uniform vec2 offset;
    uniform vec2 videoSize;

    void main() {
      vec2 adjustedUv = (vUv + offset) * videoSize;
      vec4 videoColor = texture2D(videoTexture, adjustedUv);
      videoColor.rgb *= brightness;
      gl_FragColor = vec4(videoColor.rgb, videoColor.a);
    }
  `
});

// Load and apply shader material to all models
const models = [];
const initialPositions = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedModel = null;
let dragOffset = new THREE.Vector3();
let isDragging = false;
let returnSpeed = 0.1;
let isReturning = false;
let returnTargetPosition = null;

function loadModel(i) {
  loader.load(
    `./models/letter/secondModel/${i}.fbx`,
    (fbx) => {
      fbx.scale.set(0.09, 0.09, 1);
      fbx.position.set(0, -6, 0);

      initialPositions.push(fbx.position.clone());

      fbx.traverse((child) => {
        if (child.isMesh) {
          child.material = videoMaterial;
        }
      });

      scene.add(fbx);
      models.push(fbx);
    },
    (xhr) => console.log((xhr.loaded / xhr.total) * 100 + "% loaded"),
    (error) => console.error(error)
  );
}

// Load all 10 models
for (let i = 1; i <= 10; i++) {
  loadModel(i);
}

// Scene lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2444);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffcc88, 14, 504);
pointLight.position.set(-5, 5, 5);
scene.add(pointLight);

const spotLight = new THREE.SpotLight(0xffffff, 1.54, 504, Math.PI / 8, 0.34);
spotLight.position.set(5, 15, 10);
scene.add(spotLight);

let offsetX = 1;
const panSpeed = 0.0009;

function animate() {
  requestAnimationFrame(animate);

  offsetX += panSpeed;
  if (offsetX > 1.0) {
    offsetX = 0;
  }

  videoMaterial.uniforms.offset.value.set(offsetX, 0);
  renderer.render(scene, camera);
}

animate();

// Update the camera when the window is resized
window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Optionally, adjust the position of the camera if needed to maintain the same view
  camera.position.set(0, 10, 200); // Maintain the original Z position
  camera.lookAt(scene.position);
});


// Mouse event listeners for dragging
const dragLimits = {
  minX: -20,
  maxX: 30,
  minZ: -5,
  maxZ: 5,
  minY: -20,  // Set minimum Y (keep on the ground level)
  maxY: 10    // Set a reasonable height limit for dragging
};

window.addEventListener("mousedown", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(models, true);
  if (intersects.length > 0) {
    selectedModel = intersects[0].object.parent;
    const intersectPoint = intersects[0].point;
    dragOffset.copy(intersectPoint).sub(selectedModel.position);
    isDragging = true;
  }
});

window.addEventListener("mousemove", (event) => {
  if (isDragging && selectedModel) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const planeIntersection = raycaster.ray.origin.clone().sub(dragOffset);
    
    // Apply the limits to the dragged model's position
    planeIntersection.x = Math.max(dragLimits.minX, Math.min(dragLimits.maxX, planeIntersection.x));
    planeIntersection.z = Math.max(dragLimits.minZ, Math.min(dragLimits.maxZ, planeIntersection.z));
    planeIntersection.y = Math.max(dragLimits.minY, Math.min(dragLimits.maxY, planeIntersection.y));
    
    selectedModel.position.copy(planeIntersection);
  }
});

window.addEventListener("mouseup", () => {
  if (selectedModel) {
    const index = models.indexOf(selectedModel);
    isDragging = false;
    if (index !== -1) {
      returnTargetPosition = initialPositions[index];
      isReturning = true;
    }
    selectedModel = null;
  }
});

// Function to change video when a button is clicked
const changeVideoButton = document.createElement("button");
changeVideoButton.textContent = "Change Lights";
changeVideoButton.style.position = "absolute";
changeVideoButton.style.top = "100px";
changeVideoButton.style.left = "10px";
changeVideoButton.style.zIndex = "9999";
changeVideoButton.style.padding = "10px 15px";
changeVideoButton.style.fontSize = "16px";
changeVideoButton.style.backgroundColor = "#33aaff";
changeVideoButton.style.color = "#ffffff";
changeVideoButton.style.border = "none";
changeVideoButton.style.cursor = "pointer";
changeVideoButton.style.borderRadius = "8px";
changeVideoButton.style.boxShadow = "2px 2px 4px rgba(0,0,0,0.2)";
document.body.appendChild(changeVideoButton);

changeVideoButton.addEventListener("click", () => {
  currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
  playVideo(videoSources[currentVideoIndex]);
  console.log(`Video changed to: ${videoSources[currentVideoIndex]}`);
});
// Add Reset Button to Reset All Models
const resetButton = document.createElement("button");
resetButton.textContent = "Reset";
resetButton.style.position = "absolute";
resetButton.style.top = "50px";
resetButton.style.left = "10px";
resetButton.style.zIndex = "9999";
resetButton.style.padding = "10px 15px";
resetButton.style.fontSize = "16px";
resetButton.style.backgroundColor = "#ff5733";
resetButton.style.color = "#ffffff";
resetButton.style.border = "none";
resetButton.style.cursor = "pointer";
resetButton.style.borderRadius = "8px";
resetButton.style.boxShadow = "2px 2px 4px rgba(0,0,0,0.2)";
document.body.appendChild(resetButton);

resetButton.addEventListener("click", () => {
  models.forEach((model, index) => {
    model.position.copy(initialPositions[index]);
  });
  console.log("Models have been reset!");
});
// Function to randomize the scale of the models
const randomizeScaleButton = document.createElement("button");
randomizeScaleButton.textContent = "Randomize Scale";
randomizeScaleButton.style.position = "absolute";
randomizeScaleButton.style.top = "150px";
randomizeScaleButton.style.left = "10px";
randomizeScaleButton.style.zIndex = "9999";
randomizeScaleButton.style.padding = "10px 15px";
randomizeScaleButton.style.fontSize = "16px";
randomizeScaleButton.style.backgroundColor = "#ffcc00";
randomizeScaleButton.style.color = "#ffffff";
randomizeScaleButton.style.border = "none";
randomizeScaleButton.style.cursor = "pointer";
randomizeScaleButton.style.borderRadius = "8px";
randomizeScaleButton.style.boxShadow = "2px 2px 4px rgba(0,0,0,0.2)";
document.body.appendChild(randomizeScaleButton);

// Event listener for the button to randomize the z-axis scale value
randomizeScaleButton.addEventListener("click", () => {
  // Generate a random z scale between 1 and 90
  const randomZScale = Math.floor(Math.random() * (20 - 1 + 1)) + 1;
  
  // Apply the same scale to all models
  models.forEach((model) => {
    model.scale.set(0.09, 0.09, randomZScale);
  });
  
  console.log("All model scales randomized to z-scale:", randomZScale);
});
