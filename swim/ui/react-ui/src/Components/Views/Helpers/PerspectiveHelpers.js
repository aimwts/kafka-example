import * as THREE from "three";
import OrbitControlsLib from "three-orbit-controls";
import { Interaction } from "three.interaction";
import * as satelliteJs from "satellite.js";
import moment from "moment";

class PerspectiveHelpers {

    constructor(scale = 10) {
        this.scale = scale;
        this.radius = 6371 / scale;
        this.tilt = 0.41;
        this.cloudsScale = 1.025;
        this.textureLoader = new THREE.TextureLoader();
        this.orbitControls = OrbitControlsLib(THREE);
    }

    createEarth() {

        var earthNormalMap = new THREE.MeshPhongMaterial({
            specular: 0x333333,
            shininess: 15,
            map: this.textureLoader.load("/textures/planets/earth_atmos_2048.jpg"),
            specularMap: this.textureLoader.load(
                "/textures/planets/earth_specular_2048.jpg"
            ),
            normalMap: this.textureLoader.load(
                "/textures/planets/earth_normal_2048.jpg"
            ),

            // y scale is negated to compensate for normal map handedness.
            normalScale: new THREE.Vector2(0.85, -0.85),
        });

        this.earthMesh = new THREE.SphereBufferGeometry(this.radius, 100, 100);

        const meshPlanet = new THREE.Mesh(this.earthMesh, earthNormalMap);
        meshPlanet.rotation.y = 0;
        meshPlanet.rotation.z = this.tilt;

        return meshPlanet;

    }

    createClouds() {
        const materialClouds = new THREE.MeshLambertMaterial({
            map: this.textureLoader.load("/textures/planets/earth_clouds_1024.png"),
            transparent: true,
        });

        const cloudMesh = new THREE.Mesh(this.earthMesh, materialClouds);
        cloudMesh.scale.set(this.cloudsScale, this.cloudsScale, this.cloudsScale);
        cloudMesh.rotation.z = this.tilt;

        return cloudMesh;
    }

    createSprite(spriteMap, clickHandler = (ev) => {}) {
        var spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap } );
        var sprite = new THREE.Sprite( spriteMaterial );
        sprite.scale.set(10,10,1);
        sprite.cursor = "pointer";
        sprite.on("click", clickHandler);
        
        return sprite;        
    }    

    createSphere(sphereMarkerGeom, clickHandler = (ev) => {}) {
        var material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        var sphere = new THREE.Mesh(sphereMarkerGeom, material);
        sphere.cursor = "pointer";
        sphere.on("click", clickHandler);
        return sphere;
    }    

    addEarth(scene, useClouds = false) {
        const meshPlanet = this.createEarth();
        scene.add(meshPlanet);

        let meshClouds = null;
        if(useClouds) {
            meshClouds = this.createClouds();
            scene.add(meshClouds);
        }
        return {
            earthMesh: meshPlanet,
            cloudMesh: meshClouds
        }
    }

    createSpaceScene(mount) {
        
        const width = mount.current.clientWidth;
        const height = mount.current.clientHeight;
        const viewAngle = 62;
        const aspectRatio = width / height;
        const nearDistance = 0.1;
        const farDistance = 50000;

        const scene = new THREE.Scene();
    
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        renderer.physicallyCorrectLights = true;
        renderer.gammaOutput = true;
        renderer.outputEncoding = THREE.sRGBEncoding;

        // renderer.setClearColor("#000000");
        renderer.setSize(width, height);

        const camera = new THREE.PerspectiveCamera(
            viewAngle,
            aspectRatio,
            nearDistance,
            farDistance
        );
        // camera.position.set(200, 500, 1000);
        camera.position.set(200, 1000, 2000);

        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(-1, 0, 1).normalize();
        scene.add(dirLight);

        const ambientLight = new THREE.AmbientLight(0x020202)
        scene.add(ambientLight);

        const controls = new this.orbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.5, 0);
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.2;
        controls.update();
        controls.enablePan = false;

        // interaction required for to make meshes clickable
        // eslint-disable-next-line
        const interaction = new Interaction(renderer, scene, camera);

        mount.current.appendChild(renderer.domElement);

        return {
            scene: scene,
            camera: camera,
            renderer: renderer,
            controls: controls,
            lights: [
                dirLight,
                ambientLight
            ],
            selected: null
        }
    }

    createOrbitTrack(satData, material) {
        const points = [];
        const satrec = satelliteJs.twoline2satrec(satData.get("tle").getItem(1).stringValue(), satData.get("tle").getItem(2).stringValue());
        let currDate = moment();
        for(let i=0; i<=360; i++) {
            const newDateObj = currDate.add(i*1, 's');
            // const testGmst = satelliteJs.gstime(newDateObj.toDate());
            const newPropagation = satelliteJs.propagate(satrec, newDateObj.toDate());
            // const nextPositionEci = newPropagation.position;
            // const nextPositionGd = satelliteJs.eciToGeodetic(nextPositionEci, testGmst);
            // console.info(newPropagation.position);
            var satPos = newPropagation.position;
            points.push( new THREE.Vector3( satPos.x/this.scale, satPos.z/this.scale, satPos.y/this.scale ) );
        }

        // var material = new THREE.LineBasicMaterial( { color: 0xffff00 } );
        var geometry = new THREE.BufferGeometry().setFromPoints( points );
        var line = new THREE.Line( geometry, material );

        return line
    }    
}

export default PerspectiveHelpers;