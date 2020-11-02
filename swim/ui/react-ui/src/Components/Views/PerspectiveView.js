import React, { useState, useEffect, useRef } from "react";
import Loader from "./Layout/Loader";
import * as THREE from "three";
import * as satelliteJs from "satellite.js";
import PerspectiveHelpers from './Helpers/PerspectiveHelpers';
import * as swim from "@swim/system";

function PerspectiveView(props) {
    
    // constants
    const scale = 10;
    const viewHelper = new PerspectiveHelpers(scale);
    const mount = useRef(null);
    const textureLoader = new THREE.TextureLoader();
    const markerSpriteMap = textureLoader.load( "/textures/sprites/disc.png" );
    const sphereMarkerGeom = new THREE.SphereGeometry(5, 10, 10);
    const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffff00 } );
    const useSprites = false;
    
    // state variables
    const [markers] = useState([]);
    const [popupMarker, setPopupMarker] = useState(null);
    const [satellitePopoverView, setPopoverView] = useState(null);
    const [satellitePopoverContent, setPopoverContent] = useState(null);
    const [selectedMesh] = useState();
    const [sceneState, setSceneState] = useState({
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        lights: [],
        selected: null,
    });

    //placeholders for various scene meshes
    // TODO: fix to use useRef
    let meshPlanet = null;
    let meshClouds = null;
    let trackMeshes = null;
    let rootSwimElement = null;

    useEffect(() => {
        rootSwimElement = swim.HtmlView.fromNode(mount.current);

        const popupMark = swim.HtmlView.create("div");
        popupMark.className("popupMarker");
        rootSwimElement.append(popupMark);
        setPopupMarker(popupMark);

        const popoverView = new swim.PopoverView()
            .borderRadius(10)
            .padding(0)
            .arrowHeight(20)
            .arrowWidth(20)
            .backgroundColor("rgba(0,0,0,0.4)")
            .backdropFilter("blur(2px)");
        
        const popoverContent = swim.HtmlView.create("div");
        popoverView.append(popoverContent);
        popoverView.setSource(popupMark);   
        rootSwimElement.append(popoverView);  
        popoverView.hidePopover();        

        setPopoverView(popoverView);
        setPopoverContent(popoverContent);

        // create new empty "space" scene
        const newScene = viewHelper.createSpaceScene(mount)
        newScene["selected"] = selectedMesh;
        setSceneState(newScene);

        // add earth and clouds (if enabled)
        const planetMeshes = viewHelper.addEarth(newScene.scene, false);
        meshPlanet = planetMeshes[0];
        meshClouds = planetMeshes[1];

        return () => {
            // stop();
            // window.removeEventListener("resize", handleResize);
            mount.current.removeChild(newScene.renderer.domElement);

            newScene.scene.remove(meshPlanet);
            if(meshClouds != null) {
                newScene.scene.remove(meshClouds);
            }
            for(let i=0; i<markers.length; i++) {
                newScene.scene.remove(markers[i]);
            }
            if(trackMeshes !== null) {
                newScene.scene.remove(trackMeshes);
            }
        };        
    }, [])

    // start up render loop for scene
    useEffect(() => {
        let frameId;
        let newScene = sceneState;

        if(newScene.scene === null) {
            return;
        }

        // render scene
        const doRenderScene = () => {
            if(newScene.selected && newScene.selected !== null) {
                // console.info(newScene.selected);
                movePoint(newScene, popupMarker, mount);
            }
            newScene.controls.update();
            newScene.renderer.render(newScene.scene, newScene.camera);
        };

        // handle container resize
        const handleResize = () => {
            const width = mount.current.clientWidth;
            const height = mount.current.clientHeight;
            newScene.renderer.setSize(width, height);
            newScene.camera.aspect = width / height;
            newScene.camera.updateProjectionMatrix();
            doRenderScene();
        };

        // on animate call
        const animate = () => {
         
            doRenderScene();
            frameId = window.requestAnimationFrame(animate);
        };

        const start = () => {
            if (!frameId) {
                frameId = requestAnimationFrame(animate);
            }
        };

        const stop = () => {
            cancelAnimationFrame(frameId);
            frameId = null;
        };

        // mount.current.appendChild(renderer.domElement);
        window.addEventListener("resize", handleResize);

        if(!frameId) {
            start();

            newScene.controls.current = { start, stop };
        }

        return () => {
            stop();
            window.removeEventListener("resize", handleResize);

        };
    }, [sceneState]);

    // handle when page state or sceneState changes to redraw satellites
    useEffect(() => {
        if(sceneState.scene !== null && props.state.satellites !== null) {
            refreshMarkers(props.state.satellites);
        }
    }, [props.state, sceneState]);

    // draw/update each satellite marker in the scene based on its current data
    function refreshMarkers(satelliteList) {
        const satKeys = Object.keys(satelliteList);
        console.info(`refresh ${satKeys.length} markers`);
        // for each satellite in the dataset...
        for (let i = 0; i < satKeys.length; i++) {
            const currKey = satKeys[i];
            const satData = satelliteList[currKey];

            // if satellite does not have a marker, create one
            if (markers[currKey] == null) {
                let newMarker = null;
                if(useSprites) {
                    newMarker = viewHelper.createSprite(markerSpriteMap, (ev) => {
                        handleSelection(satData, newMarker, sceneState);
                    });

                } else {
                    newMarker = viewHelper.createSphere(sphereMarkerGeom, (ev) => {
                        handleSelection(satData, newMarker, sceneState);
                    });
    
                }

                sceneState.scene.add(newMarker);
                markers[currKey] = newMarker;
            }

            // grab marker for satellite and update its color and position
            const mesh = markers[currKey];

            if(mesh.material.color.getHex() === 0xffffff) {
                // save current color as default so we can set it back later
                mesh["defaultColorHex"] = 0x00ff00;
                if (satData.get("type").stringValue() === "PAYLOAD") {
                    mesh["defaultColorHex"] = 0x0000ff;
                } else if (satData.get("type").stringValue() === "DEBRIS") {
                    mesh["defaultColorHex"] = 0xff0000;
                } 
                // save default color hex
                mesh.material.color.setHex(mesh["defaultColorHex"]);
            }

            // propagate satellites current position
            const satrec = satelliteJs.twoline2satrec(satData.get("tle").getItem(1).stringValue(), satData.get("tle").getItem(2).stringValue());
            const newPropagation = satelliteJs.propagate(satrec, new Date());
            const satPos = newPropagation.position;

            // update marker position
            if (satPos && satPos.x) {
                mesh.position.x = satPos.x / scale;
                mesh.position.y = satPos.z / scale;
                mesh.position.z = satPos.y / scale;
            }
        }
    }
    
    // click handler
    function handleSelection(satData, sphere, state) {
        // console.info('mark selected');
        satellitePopoverContent.node.innerHTML = "";
        satellitePopoverContent.className("popupContent");
        
        const header = swim.HtmlView.create("h2");
        header.className("popupHeader");
        header.text(satData.get("name").stringValue())

        const dataGrid = swim.HtmlView.create("div");
        dataGrid.className("popupDataGrid");

        dataGrid.append(swim.HtmlView.create("div").text("Cat#"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("catalogNumber").stringValue()));

        dataGrid.append(swim.HtmlView.create("div").text("Designator"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("intlDesignator").stringValue()));

        dataGrid.append(swim.HtmlView.create("div").text("Type"));
        const type = satData.get("type").stringValue();
        if(type === "ROCKET BODY") {
            dataGrid.append(swim.HtmlView.create("div").text("R/B"));
        } else {
            dataGrid.append(swim.HtmlView.create("div").text(type));
        }

        dataGrid.append(swim.HtmlView.create("div").text("Country"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("countryCode").stringValue("")));

        dataGrid.append(swim.HtmlView.create("div").text("RCS Size"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("rcsSize").stringValue("")));

        dataGrid.append(swim.HtmlView.create("div").text("Launch Site"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("launchSiteCode").stringValue("none")));

        dataGrid.append(swim.HtmlView.create("div").text("Orbits"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("revolutionsAtEpoch").stringValue("0")));

        dataGrid.append(swim.HtmlView.create("div").text("File"));
        dataGrid.append(swim.HtmlView.create("div").text(satData.get("file").stringValue("")));

        satellitePopoverContent.append(header);
        satellitePopoverContent.append(dataGrid);
        satellitePopoverView.showPopover();  
        // console.info(state);
        if (state.selected) {
            state.selected.material.color.setHex(state.selected.defaultColorHex);
        }

        sphere.material.color.setHex(0xa000ff);
        state.selected = sphere;

        // update orbit lines
        if(trackMeshes !== null) {
            state.scene.remove(trackMeshes);
        }
        const newLine = viewHelper.createOrbitTrack(satData, lineMaterial);
        state.scene.add(newLine);
        trackMeshes = newLine
    }


    function movePoint(state, marker, win) {
        const selected = state.selected;
        const windowWidth = mount.current.clientWidth;
        const windowHeight = mount.current.clientHeight;
        const widthHalf = windowWidth / 2;
        const heightHalf = windowHeight / 2;         
        if(selected && selected != null) {
            const pos = selected.position.clone();
            pos.project(sceneState.camera);
            const posX = (pos.x * widthHalf) + widthHalf;
            const posY = - (pos.y * heightHalf) + heightHalf;
            
            marker.top(posY-5);
            marker.left(posX-5);
  
          }         
    }    

    if (props.state.loading) {
        return (
            <div
                id="perspectiveView"
                ref={mount}
                className="perspectiveViewMain bg-grey-200 w-full h-full text-center"
            >
                <Loader />
            </div>
        );
    } else {
        return (
            <div
                id="perspectiveView"
                ref={mount}
                className="perspectiveViewMain bg-grey-200 w-full h-full text-center"
            >
            </div>
        );
    }
}

export default PerspectiveView;
