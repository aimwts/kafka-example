import React, { useState, useRef, useEffect, useReducer } from "react";
import mapboxgl from "mapbox-gl";
import * as swim from "@swim/system";
import Loader from "./Layout/Loader";
import FlatViewHelper from './Helpers/FlatViewHelper';

function FlatView(props) {
    let satellitePopoverView = useRef(null);
    let satellitePopoverContent = useRef(null);

    const viewHelper = new FlatViewHelper();
    const mount = useRef(null);
    const pageFrame = useRef(null);
    const canvasElem = useRef(null);
    const rootSwimElement = useRef(null);
    const popupMarker = useRef(null);

    const segmentPixelSize = useRef(100);

	let totalSegmentsX = useRef();
	let totalSegmentsY = useRef();    

    let map = useRef(null);
    let overlayCanvas = useRef(null);
    let mapProjection = useRef(null);
    let satelliteList = useRef(null);
    let highlightedMarker = useRef(null);
    let selectedMarker = useRef(null);
    let itemMap = useRef([]);
    let markers = useRef([]);
    let mouseCir = useRef({
        radius: 5,
        offsetLeft: 0,
        offsetTop: 0
    })

    function buildEmptyItemMap() {
        itemMap.current = new Array(totalSegmentsX.current, totalSegmentsY.current);
        for(var i=0; i <= totalSegmentsX.current; i++) {
            itemMap.current[i] = new Array;
            for(var x=0; x <= totalSegmentsY.current; x++) {
                itemMap.current[i][x] = new Array;    
            }
        }
    }    

    const handleMapLoaded = () => {
        mapProjection.current = new swim.MapboxProjection(map.current);
        overlayCanvas.current = document.getElementById(
            "overlayCanvasElem"
        );
        overlayCanvas.current.style.width = `${mount.current.offsetWidth}px`;
        overlayCanvas.current.width = mount.current.offsetWidth;
        overlayCanvas.current.style.height = `${mount.current.offsetHeight}px`;
        overlayCanvas.current.height = mount.current.offsetHeight;
        overlayCanvas.current.style.pointerEvents = "none";
        overlayCanvas.current.style.zIndex = "1";
        handleMapUpdate();
    }

    const handleMapUpdate = () => {
        // mapProjection.current.setProjection(map.current);
        buildEmptyItemMap();
        refreshMarkers(satelliteList.current);
    };

    const handleMapClick = () => {
        // console.info(highlightedMarker.current);
        if(selectedMarker.current !== null) {
            const control = selectedMarker.current;
            selectedMarker.current.fill = selectedMarker.current.defaultFill;
            selectedMarker.current.stroke = selectedMarker.current.defaultStroke;
            selectedMarker.current.radius = 5;
            selectedMarker.current.selected = false;
            satellitePopoverView.current.hidePopover();        
        }
        const highlightColor = swim.Color.rgb(255, 255, 255, 0.75);
        

        selectedMarker.current = highlightedMarker.current

        // props.selectSat(selectedMarker.current.data.get("catalogNumber").stringValue());

        if(selectedMarker.current) {
            selectedMarker.current.fill = highlightColor;
            selectedMarker.current.stroke = highlightColor.alpha(1);
            selectedMarker.current.radius = 5;
            selectedMarker.current.selected = true;
            satellitePopoverContent.current.node.innerHTML = "";
            satellitePopoverContent.current.className("popupContent");
            const satData = selectedMarker.current.data;
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
    
            satellitePopoverContent.current.append(header);
            satellitePopoverContent.current.append(dataGrid);
            satellitePopoverView.current.showPopover();        
            
            const tracks = viewHelper.createOrbitTrack(satData, mapProjection.current);
        }

    }

    const handleMouseMove = (evtData) => {
        let subObjList = [];
        if(itemMap && itemMap.current !== null && itemMap.current.length !== 0) {
            // const markerList = itemMap.current[segX][segY];
            mouseCir.current.offsetLeft = (evtData.clientX-mouseCir.current.radius);
            mouseCir.current.offsetTop = (evtData.clientY-mouseCir.current.radius);
            subObjList = viewHelper.findElemsAtSegmentCoords(evtData.clientX, evtData.clientY, itemMap, segmentPixelSize);
            // console.info(subObjList);
        }
        var totalObjs = subObjList.length || 0;

        if (totalObjs > 0) {
            var index =0
            //loop over list of object and detect collisions
            const nearestItems = [];
            while(index < totalObjs) {
                var control = subObjList[index];
                const collInfo = viewHelper.checkCollision(mouseCir.current, control);
                if(!control.selected) {
                    control.fill = control.defaultFill;
                    control.stroke = control.defaultStroke;
                    control.radius = 5;
                }
                if (collInfo.isColliding) {
                    nearestItems[collInfo.distance] = control;
                }
                index++;
            }

            const itemKeys = Object.keys(nearestItems);
            // console.info(nearestItems[itemKeys[0]]);
            if(itemKeys.length > 0) {
                const startColor = swim.Color.rgb(255, 255, 0, 0.95);
                const endColor = swim.Color.rgb(0, 255, 255, 0.95);
                if(!control.selected) {
                    nearestItems[itemKeys[0]].fill = startColor;
                    nearestItems[itemKeys[0]].stroke = endColor;
                    nearestItems[itemKeys[0]].radius = 5;
                }
                document.getElementsByClassName("mapboxgl-canvas-container")[0].style.cursor = "crosshair";
                highlightedMarker.current = nearestItems[itemKeys[0]];

            } else {
                document.getElementsByClassName("mapboxgl-canvas-container")[0].style.cursor = "grab";
                highlightedMarker.current = null;
            }
        }      
    }       

    // console.info(swimView.MapboxView);
    const createMapElement = () => {

        map.current = viewHelper.createMap(mount.current, handleMapLoaded, handleMapUpdate, handleMapClick);

        rootSwimElement.current = swim.HtmlView.fromNode(pageFrame.current);
        
        const popupMark = swim.HtmlView.create("div");
        popupMark.className("popupMarker");
        rootSwimElement.current.append(popupMark);
        popupMarker.current = popupMark;      

        const popoverView = new swim.PopoverView()
            .borderRadius(10)
            .padding(0)
            .arrowHeight(20)
            .arrowWidth(20)
            .zIndex(8)
            .backgroundColor("rgba(0,0,0,0.4)")
            .backdropFilter("blur(2px)");
        
        const popoverContent = swim.HtmlView.create("div");
        popoverView.append(popoverContent);
        popoverView.setSource(popupMark);   
        rootSwimElement.current.append(popoverView);  
        popoverView.hidePopover();        

        satellitePopoverView.current = popoverView
        satellitePopoverContent.current = popoverContent;

        mount.current.onmousemove = handleMouseMove;
        mount.current.ontouchstart = function () {arguments[0].preventDefault();};
        mount.current.ontouchmove = handleMouseMove;
        mount.current.ontouchend = function () {};     
        
        console.info(props);
    };



    // draw/update each satellite marker in the scene based on its current data
    function refreshMarkers(satelliteList) {
        // console.info('flatview- refresh markers');
        const satKeys = Object.keys(satelliteList);
        let lowestAltitude = 10000;
        let highestAltitude = 0;
        // console.info(`refresh ${satKeys.length} markers`);
        // console.info(mapProjection);
        if (!overlayCanvas.current || overlayCanvas.current == null) {
            // console.info("overlay not loaded");
            return;
        }
        if(satKeys.length === 0) {
            // console.info("no satellite data");
            return;
        }
        var ctx = overlayCanvas.current.getContext("2d");
        clearCanvas(ctx);
        // buildEmptyItemMap();
        // for each satellite in the dataset...
        let tracks = null;
        for (let i = 0; i < satKeys.length; i++) {
            const currKey = satKeys[i];
            const satData = satelliteList[currKey];
            // console.info(satData.dirty);
            if(satData.dirty && satData.dirty === true) {
                const colorBy = "height";
                let newRgb = new swim.Color.rgb().hsl();

                switch (colorBy) {
                    case "height":
                        //color by height/altitude
                        const startColor = swim.Color.rgb(0, 0, 255, 0.95).hsl();
                        const endColor = swim.Color.rgb(255, 0, 0, 0.95).hsl();
                        let altitude = satData.get("height").numberValue(0);
                        if (altitude >= highestAltitude && altitude < 30000) {
                            highestAltitude = altitude;
                        }
                        if (altitude <= lowestAltitude) {
                            lowestAltitude = altitude;
                        }
                        let maxAlt = highestAltitude;
                        if (altitude > maxAlt) {
                            altitude = maxAlt;
                        }
                        maxAlt = maxAlt - lowestAltitude;
                        altitude = altitude - lowestAltitude;
                        newRgb.h = viewHelper.interpolate(startColor.h, endColor.h, altitude, maxAlt);
                        newRgb.s = viewHelper.interpolate(startColor.s, endColor.s, altitude, maxAlt);
                        newRgb.l = viewHelper.interpolate(startColor.l, endColor.l, altitude, maxAlt);
                        break;
                    case "type":
                        const satType = satData
                            .get("type")
                            .stringValue()
                            .toLowerCase();
                        switch (satType) {
                            case "payload":
                                newRgb = swim.Color.rgb(0, 255, 0, 1);
                                break;
                            case "debris":
                                newRgb = swim.Color.rgb(255, 0, 0, 1);
                                break;
                            case "rocket body":
                                newRgb = swim.Color.rgb(0, 0, 255, 1);
                                break;
                        }
                        break;
                }

                let markerFillColor = newRgb.rgb().alpha(0.5);
                let markerStrokeColor = newRgb.rgb().alpha(1);

                const coords = mapProjection.current.project(
                    satData.get("longitude").numberValue(0),
                    satData.get("latitude").numberValue(0)
                );


                // markers[currKey].center.setState(newCenter);
                const mainRadius = 1
                const detectionRadius = 1;
                const totalRadius = mainRadius + detectionRadius;
                const catNumber = satData.get("catalogNumber").stringValue();
                if(!markers.current[catNumber]) {
                    markers.current[catNumber] = {
                        data: satData,
                        fill: markerFillColor,
                        defaultFill: markerFillColor,
                        stroke: markerStrokeColor,
                        defaultStroke: markerStrokeColor,
                        radius: 5,
                        detectionCircleX: coords.x - detectionRadius,
                        detectionCircleY: coords.y - detectionRadius,
                        detectionCircleRadius: totalRadius,
                        selected: false
                    
                    }
        
                } else {
                    markers.current[catNumber].detectionCircleX = coords.x - detectionRadius;
                    markers.current[catNumber].detectionCircleY = coords.y - detectionRadius;
                    markers.current[catNumber].detectionCircleRadius = totalRadius;
                }

                if(coords.x >=0 && coords.y >= 0 && coords.x <= mount.current.clientWidth && coords.y <= mount.current.clientHeight) {
                    //draw marker to canvas
                    ctx.beginPath();
                    ctx.arc(coords.x, coords.y, markers.current[catNumber].radius, 0, 2 * Math.PI);
                    ctx.fillStyle = markers.current[catNumber].fill;
                    ctx.strokeStyle = markers.current[catNumber].stroke;
                    ctx.fill();
                    ctx.stroke();
                    if(itemMap.current[Math.floor(coords.x/segmentPixelSize.current)][Math.floor(coords.y/segmentPixelSize.current)] == null) {
                        itemMap.current[Math.floor(coords.x/segmentPixelSize.current)][Math.floor(coords.y/segmentPixelSize.current)] = new Array();
                    }
                    itemMap.current[Math.floor(coords.x/segmentPixelSize.current)][Math.floor(coords.y/segmentPixelSize.current)].push(markers.current[satData.get("catalogNumber").stringValue()]);            

                }
                if(selectedMarker.current && selectedMarker.current.data && selectedMarker.current.data.get("catalogNumber").stringValue() === catNumber) {
                    // console.info("move marker", selectedMarker.current.data.get("catalogNumber").stringValue() === catNumber)
                    popupMarker.current.top(coords.y-5);
                    popupMarker.current.left(coords.x-5);
                    tracks = viewHelper.createOrbitTrack(satData, mapProjection.current);
                }
                // satData.dirty = false;
            }
            
        }

        if(tracks !== null) {
            const coords = mapProjection.current.project(
                selectedMarker.current.data.get("longitude").numberValue(0),
                selectedMarker.current.data.get("latitude").numberValue(0)
            );            
            ctx.strokeStyle = "yellow";
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
            let previousCoords = coords;
            for (let i = 0; i < tracks.length; i++) {
                const nextTrackPoint = tracks[i];
                // const x1 = parseFloat(previousCoords.x);
                // const x2 = parseFloat(nextTrackPoint.x);
                // const y1 = parseFloat(previousCoords.y);
                // const y2 = parseFloat(nextTrackPoint.x);
                // const deltaX = Math.pow(x2-x1,2);
                // const deltaY = Math.pow(y2-y1,2);
                // const distance = Math.sqrt(deltaX+deltaY);

                const distance  = (nextTrackPoint.x>previousCoords.x) ? nextTrackPoint.x - previousCoords.x : previousCoords.x - nextTrackPoint.x;
                // console.info(distance)
                if(distance >= 800) {
                    // console.info(distance)
                    ctx.stroke();
                    ctx.moveTo(nextTrackPoint.x, nextTrackPoint.y);
                    ctx.beginPath();
                } else {
                    ctx.lineTo(nextTrackPoint.x, nextTrackPoint.y);
                }
                previousCoords = nextTrackPoint;

                
            }
            ctx.stroke(); 
        }

        
        // console.info(itemMap);
    }

    function clearCanvas(ctx) {
        ctx.clearRect(
            0,
            0,
            mount.current.offsetWidth,
            mount.current.offsetHeight
        );
        // var w = this.mCanvasDomObj.width;
        // this.mCanvasDomObj.width = 1;
        // this.mCanvasDomObj.width = w;

    }

    useEffect(() => {
        let frameId;
        totalSegmentsX.current = Math.ceil(mount.current.offsetWidth/segmentPixelSize.current);
        totalSegmentsY.current = Math.ceil(mount.current.offsetHeight/segmentPixelSize.current);    
        // buildEmptyItemMap();
        createMapElement();
        const animate = () => {
         
            refreshMarkers(satelliteList.current);
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
        if(!frameId) {
            start();
        }        
        return () => {
            stop();
        };
    }, []);

    // handle when page state or sceneState changes to redraw satellites
    useEffect(() => {
        if (props.state.satellites !== null) {
            satelliteList.current = props.state.satellites;
            refreshMarkers(props.state.satellites);
            // console.info(props.state.satellites);
        }
    }, [props.state]);

    if (props.state.loading) {
        return (
            <div id="flatView" ref={pageFrame}>
                <div id="mapElem" ref={mount}></div>
                <canvas id="overlayCanvasElem" ref={canvasElem} />
                <Loader />
            </div>
        );
    } else {
        return (
            <div id="flatView" ref={pageFrame}>
                <div id="mapElem" ref={mount}></div>
                <canvas id="overlayCanvasElem" ref={canvasElem} />
            </div>
        );
    }
}

export default FlatView;
