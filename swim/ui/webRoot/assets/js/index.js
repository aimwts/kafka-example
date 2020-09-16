class IndexPage {

    constructor(swimUrl, elementID, templateID) {
        console.info("[IndexPage]: constructor");

        this.uiFilters = {};
        this.uiFilterDirty = false;
        
        // global stuff
        this.swimUrl = swimUrl;
        this.links = {};        
        this.backgroundWorker = null;
        this.fastTween = swim.Transition.duration(300);
        this.markerTween = swim.Transition.duration(60000);
        this.userGuid = null;

        // LayoutManager related values
        this.rootHtmlElementId = elementID;
        this.rootSwimTemplateId = templateID;
        this.satellitePopoverTemplateId = "7cd1b130";
        this.satellitePopoverView = null;
        this.satellitePopoverContent = null;

        //map specific values
        this.map = null;
        this.overlay = null;
        this.mapBoundingBox = null;
        this.selectedMapPoint = null;
        this.didMapMove = false;
        this.currentZoomLevel = 0;

        // satellite specific values
        this.satelliteDataset = {};
        this.satelliteDataDirty = false;
        this.satelliteMarkers = {};
        this.highestAltitude = 0;
        this.lowestAltitude = 10000;

        // for drawing tracks
        this.trackDataset = {};
        this.trackMarkers = {};

        //ui filters
        this.selectedType = "payload";
        this.selectedConstellation = null;


        console.info("[IndexPage]: cookie", document.cookie, Utils.getCookie("swim.user.guid"))
        if(Utils.getCookie("swim.user.guid") === "") {
            this.userGuid = Utils.newGuid();
            Utils.setCookie("swiw.user.guid", this.userGuid, 30);
            console.info("[IndexPage]: new user guid set", this.userGuid);
        } else {
            this.userGuid = Utils.getCookie("swim.user.guid");
            console.info("[IndexPage]: user has guid cookie", this.userGuid);
        }
        this.backgroundWorker = new Worker('/assets/js/backgroundWorker.js');
    }

    initialize() {
        console.info("[IndexPage]: init", this.userGuid);
        swim.command(this.swimUrl, "/userPrefs/" + this.userGuid, "setGuid", this.userGuid);
        this.rootHtmlElement = document.getElementById(this.rootHtmlElementId);
        this.rootSwimElement = swim.HtmlView.fromNode(this.rootHtmlElement);
        this.loadTemplate(this.rootSwimTemplateId, this.rootSwimElement, this.start.bind(this), false);

        document.getElementById("typeDropDown").onchange = (evt) => {
            this.selectType(evt.target.value);
        }        

        document.getElementById("constDropDown").onchange = (evt) => {
            this.selectConstellation(evt.target.value);
        }        

        this.backgroundWorker.onmessage = (evt) => {            
            this.handleWorkerMessage(evt);
        }
    }

    handleWorkerMessage(evt) {
        const msgData = evt.data;

        switch(msgData.action) {
            case "update":
                const updateMarkerId = msgData.markerId;
                this.satelliteDataset[updateMarkerId] = swim.Record.fromObject(msgData.newValue);
                this.satelliteDataset[updateMarkerId].dirty = true;
                this.satelliteDataDirty = true;
                break;

            case "remove":
                const removeMarkerId = msgData.markerId;
                if (this.satelliteDataset[removeMarkerId]) {
                    this.satelliteDataset[removeMarkerId].removed = true;
                    this.satelliteDataset[removeMarkerId].dirty = true;
                    
                }
                this.satelliteDataDirty = true;                
                break;
            case "sync":
                this.map.map.synced = true;
                this.satelliteDataDirty = true;
                break;
            case "bufferedUpdate":
                // console.info(evt);
                msgData.buffer.forEach((msg) => {
                    this.handleWorkerMessage({"data": msg});
                })
                break;
            }
        // console.info("[IndexPage]: worker message", evt);
    }

    start() {
        console.info("[IndexPage]: start");
        swim.command(this.swimUrl, "/userPrefs/" + this.userGuid, "setGuid", this.userGuid);
        this.map = this.rootSwimElement.getCachedElement("83ca05b4");

        this.overlay = this.map.overlays['de2f3c54'];

        this.map.map.dataDirty = true;
        this.map.map.synced = false;

        this.map.map.on("load", () => {
            this.currentZoomLevel = this.map.map.getZoom();
            this.updateMapBoundingBox();
            for(let linkLKey in this.links) {
                this.links[linkLKey].open();
            }

        });

        const handleMapUpdate = () => {
            this.didMapMove = true;
            this.currentZoomLevel = this.map.map.getZoom();
        }

        // this.map.map.on("zoom", handleMapUpdate);
        this.map.map.on("zoomend", handleMapUpdate);

        // this.map.map.on("move", handleMapUpdate);
        this.map.map.on("moveend", handleMapUpdate);
       

        this.satellitePopoverView = new swim.PopoverView()
            .borderRadius(10)
            .padding(0)
            .arrowHeight(20)
            .arrowWidth(20)
            .backgroundColor(swim.Color.parse("#071013").alpha(0.7))
            .backdropFilter("blur(2px)");
            
        this.satellitePopoverContent = swim.HtmlView.create("div");
        this.satellitePopoverContent.render(this.satellitePopoverTemplateId);
        this.satellitePopoverView.append(this.satellitePopoverContent);
        this.rootSwimElement.append(this.satellitePopoverView);           

        this.backgroundWorker.postMessage({"action":"setSwimUrl","data":this.swimUrl});
        this.backgroundWorker.postMessage({"action":"start"});

        window.requestAnimationFrame(() => {
            this.render();
        })
        document.body.onresize = () => {
            this.handleResize();
        };
        // swim.command(this.swimUrl.replace("9001", "9002"), "/simulator", "addAppLog", "Map Page Opened");

    }

    render() {

       
        if(this.didMapMove) {
            this.updateMapBoundingBox();
            this.dirtySatellites();
            this.didMapMove = false;
        }
        
        if(this.satelliteDataDirty /* && this.currentZoomLevel >= this.zoomTransitionLevel*/ ) {
            this.drawTracks();
            this.drawSatellites();
            this.satelliteDataDirty = false;    
        }

        window.requestAnimationFrame(() => {
            this.render();
        })
    }

    drawPoly(key, coords, weatherData = [], fillColor = swim.Color.rgb(255, 0, 0, 0.3), strokeColor = swim.Color.rgb(255, 0, 0, 0.8), strokeSize = 2) {

        const geometryType = weatherData.get("geometry_type").stringValue().toLowerCase();
        const currPolys = this.gairmetWeatherPolys.length;
        const tempMarker = new swim.MapPolygonView()
        tempMarker.setCoords(coords);
        if (geometryType === "area") {
            tempMarker.fill(fillColor);
        }
        tempMarker.stroke(strokeColor);
        tempMarker.strokeWidth(strokeSize);


        // tempMarker.on("click", () => {
        //     this.datagridDiv.node.innerHTML = "<h3>G-AIRMET</h3>";
        //     weatherData.forEach((dataKey) => {
        //         if (dataKey.key.value !== "points") {
        //             this.datagridDiv.node.innerHTML += `<div><span>${dataKey.key.value.replace("_", " ")}</span><span>${dataKey.value.value}</span></h3>`;
        //         }
        //     })
        // });
        this.overlay.setChildView(key, tempMarker);

        this.gairmetWeatherPolys[currPolys] = tempMarker;
        // console.info('test poly drawn');
    }

    drawTrackLine(trackPoints, strokeColor = swim.Color.rgb(249, 240, 112, 1)) {
        const currPolys = this.trackMarkers.length;
        const tempMarker = new swim.MapPolygonView();
        tempMarker.setCoords(trackPoints);
        tempMarker.stroke(strokeColor);
        // tempMarker.fill(strokeColor);
        tempMarker.strokeWidth(2);

        this.overlay.setChildView('track', tempMarker);

        this.trackMarkers[currPolys] = tempMarker;

    }

    updateMapBoundingBox() {
        const topLeftPoint = new mapboxgl.Point(0, 0);
        const bottomRightPoint = new mapboxgl.Point(document.body.offsetWidth, document.body.offsetHeight)
        const topLeftCoords = this.map.map.unproject(topLeftPoint);
        const bottomRightCoords = this.map.map.unproject(bottomRightPoint);

        this.mapBoundingBox = [topLeftCoords, bottomRightCoords];
        
    }

    dirtySatellites() {
        this.satelliteDataDirty = true;
        for(let id in this.satelliteDataset) {
            const newValue = this.satelliteDataset[id];
            const boundsRecord = swim.Record.create()
                .slot("lat", newValue.get("latitude").numberValue(0))
                .slot("lng", newValue.get("longitude").numberValue(0));

            const boundsCheck = this.checkBounds(boundsRecord, this.mapBoundingBox);

            if(boundsCheck[2] === true) {
                this.satelliteDataset[id].dirty = true;
            }
            
        }
    }

    refreshMapInfo() {
        const mapInfo = swim.Record.create()
            .slot('boundBoxTopRightLat', this.mapBoundingBox[0].lat)
            .slot('boundBoxTopRightLong', this.mapBoundingBox[0].lng)
            .slot('boundBoxBottomLeftLat', this.mapBoundingBox[1].lat)
            .slot('boundBoxBottomLeftLong', this.mapBoundingBox[1].lng);

        swim.command(this.swimUrl, '/userPrefs/' + this.userGuid, 'updateMapSettings', mapInfo);

    }

    drawTracks() {
        const trackList = [];
        const trackKeys = Object.keys(this.trackDataset);

        for (let i = 0; i < trackKeys.length; i++) {
            const currTrackPoint = this.trackDataset[trackKeys[i]];
            const currCoords = this.checkBounds(currTrackPoint, this.mapBoundingBox);
            if(currCoords[2]) {
                const newCoord = { "lng": currCoords[1], "lat": currCoords[0] };
                // console.info(newCoord);
                trackList.push(newCoord);
            }
        }
        for (let i = (trackKeys.length - 1); i >= 0; i--) {
            const currTrackPoint = this.trackDataset[trackKeys[i]];
            const currCoords = this.checkBounds(currTrackPoint, this.mapBoundingBox);
            if(currCoords[2]) {
                const newCoord = { "lng": currCoords[1], "lat": currCoords[0] };
                // console.info(newCoord);
                trackList.push(newCoord);
            }
        }

        this.drawTrackLine(trackList);
    }

    clearTracks() {
        for (let trackKey in this.trackMarkers) {
            if (this.trackMarkers[trackKey] !== null && this.trackMarkers[trackKey].parentView !== null) {
                try {
                    // this.overlay.removeChildView(this.trackMarkers[trackKey]);
                    this.trackMarkers[trackKey].remove();
                } catch (ex) {
                    console.info('track parent not found', this.trackMarkers[trackKey]);
                }

            }

        }
        this.trackMarkers = [];
        this.trackDataset = [];
    }

    drawSatellites() {

        const mapView = this.map.map;
        
        // make sure map is loaded and there is dirty satellite data
        if (this.satelliteDataDirty && mapView.synced) {

            // setup tween 
            let tween = swim.Transition.duration(2000);
    
            // foreach satellite in the satelliteDataSet
            // each satellite is stored in the dataset by its catalog id
            for (let catalogId in this.satelliteDataset) {
                const currentSatellite = this.satelliteDataset[catalogId];
                const boundsRecord = swim.Record.create()
                    .slot("lat", currentSatellite.get("latitude").numberValue(0))
                    .slot("lng", currentSatellite.get("longitude").numberValue(0));

                // check if current satellite is on the screen
                const boundsCheck = this.checkBounds(boundsRecord, this.mapBoundingBox);

                // if current satellite data dirty and on screen, create/update it
                if(this.satelliteDataset[catalogId].dirty === true /*&& boundsCheck[2] === true*/) {
                        
                    // render marker
                    this.renderSatelliteMarker(catalogId, currentSatellite);

                }
       
            }

            // clean up last dirty flag
            this.satelliteDataDirty = false;
        }
    }

    renderSatelliteMarker(catalogId, satelliteData) {

        //decide what the marker color needs to be
        const highlightFillColor = swim.Color.rgb(249, 240, 112, 1);
        const startColor = swim.Color.rgb(0, 0, 255, 0.95).hsl();
        const endColor = swim.Color.rgb(255, 0, 0, 0.95).hsl();
        let newRgb = new swim.Color.rgb().hsl();
        let newRadius = 4;
        let canMarkerRender = false;

        const boundsRecord = swim.Record.create()
            .slot("lat", satelliteData.get("latitude").numberValue(0))
            .slot("lng", satelliteData.get("longitude").numberValue(0));

        // check if current satellite is on the screen
        const boundsCheck = this.checkBounds(boundsRecord, this.mapBoundingBox);

        if(this.selectedConstellation !== null && this.selectedConstellation !== "none") {
            newRadius = 1;
        }

        if(satelliteData.get("name").stringValue().toLowerCase().indexOf(this.selectedConstellation) >= 0) {
            newRgb = highlightFillColor;
            newRadius = 7;
        } else {
            let altitude = satelliteData.get("height").numberValue(0);
            if(altitude >= this.highestAltitude && altitude < 30000) {
                this.highestAltitude = altitude;
            }
            if(altitude <= this.lowestAltitude) {
                this.lowestAltitude = altitude;
            }
            let maxAlt = this.highestAltitude;
            if (altitude > maxAlt) {
                altitude = maxAlt;
            }
            // maxAlt = maxAlt - this.lowestAltitude;
            // altitude = altitude - this.lowestAltitude;
            newRgb.h = this.interpolate(startColor.h, endColor.h, altitude, maxAlt);
            newRgb.s = this.interpolate(startColor.s, endColor.s, altitude, maxAlt);
            newRgb.l = this.interpolate(startColor.l, endColor.l, altitude, maxAlt);
        }

        let markerFillColor = newRgb.rgb().alpha(0.5);
        let markerStrokeColor = newRgb.rgb().alpha(1);
        let tempMarker = null;

        if(this.selectedType === null || this.selectedType === "none" || this.selectedType.indexOf(satelliteData.get("type").stringValue().toLowerCase()) >= 0) {
            canMarkerRender = boundsCheck[2];
        } 

        if(!canMarkerRender) {

            if(this.satelliteMarkers[catalogId]) {
                this.satelliteMarkers[catalogId].remove();
                delete this.satelliteMarkers[catalogId];
    
            }
        } else {
            // if there is not a map marker for current satellite, create one
            if (!this.satelliteMarkers[catalogId]) {
                                    
                // create marker object
                tempMarker = new swim.MapCircleView()
                    .center([satelliteData.get("longitude").numberValue(0), satelliteData.get("latitude").numberValue(0)])
                    .strokeWidth(1);

                tempMarker.on("click", () => {
                    this.selectVectorPoint(tempMarker, satelliteData);
                    this.renderSatellitePopover(tempMarker, satelliteData);
                });

                // add marker to overlay and cache to markers list
                this.overlay.setChildView(catalogId, tempMarker);
                this.satelliteMarkers[catalogId] = tempMarker;
                this.satelliteDataset[catalogId].dirty = false;  
            } 

            if(tempMarker === null) {
                tempMarker = this.satelliteMarkers[catalogId];
            }
            // update marker color/stroke
            tempMarker.stroke(markerStrokeColor, this.fastTween);
            tempMarker.fill(markerFillColor, this.fastTween);
            tempMarker.radius(newRadius, this.fastTween);

            // update center point
            const newCenter = [satelliteData.get("longitude").numberValue(0), satelliteData.get("latitude").numberValue(0)];
            tempMarker.center.setState(newCenter, this.markerTween);

            // clean up dirty flag
            this.satelliteDataset[catalogId].dirty = false;
        }
   
    }

    clearSatellites() {
        this.clearTracks();
        this.hideSatellitePopover();
        for (let callsign in this.satelliteMarkers) {
            this.satelliteMarkers[callsign].remove();
            delete this.satelliteMarkers[callsign];
        }
    }

    selectType(evt) {
        const dropdown = document.getElementById("typeDropDown");
        this.selectedType = dropdown[dropdown.selectedIndex].value;
        this.dirtySatellites();
    }

    selectConstellation(evt) {
        const dropdown = document.getElementById("constDropDown");
        this.selectedConstellation = dropdown[dropdown.selectedIndex].value;
        this.dirtySatellites();
    }

    selectVectorPoint(marker, data) {
        // console.info(data);
        this.clearTracks();
        if (this.selectedMapPoint) {
            this.selectedMapPoint.fill(this.selectedMapPoint.defaultFillColor || "#ffffff");
            this.selectedMapPoint.stroke(this.selectedMapPoint.defaultStrokeColor || "#ffffff");
        }
        if(marker === null) {
            this.selectedMapPoint = null;

            this.satellitePopoverView.hidePopover(this.fastTween);
            return ;
        }

        this.selectedMapPoint = marker;

        this.selectedMapPoint.defaultFillColor = this.selectedMapPoint.fill();
        this.selectedMapPoint.defaultStrokeColor = this.selectedMapPoint.stroke();
        this.selectedMapPoint.fill(swim.Color.rgb(108,95,206,0.5));
        this.selectedMapPoint.stroke(swim.Color.rgb(108,95,206,0.75));

        if(this.tracksLink) {
            this.tracksLink.close();
        }
        this.tracksLink = swim.nodeRef(this.swimUrl, `/satellite/${data.get("catalogNumber").stringValue()}`).downlinkMap().laneUri('tracks')
            .didUpdate((newKey, newValue) => {
                // console.info(newKey, newValue);
                this.trackDataset[newKey.numberValue()] = newValue;

            })
            .didSync(() => {
                this.drawTracks();
            })
            .open();    


    }

    renderSatellitePopover(tempMarker, satelliteData) {

        this.satellitePopoverView.hidePopover(this.fastTween);
        this.satellitePopoverView.setSource(tempMarker);            
        this.satellitePopoverView.showPopover(this.fastTween);   
        
        this.satellitePopoverContent.getCachedElement("31642d81").text(satelliteData.get("name").stringValue());
        // this.satellitePopoverContent.getCachedElement("e29f472a").text(satelliteData.get("name").stringValue());
        this.satellitePopoverContent.getCachedElement("ff42bb72").text(`${satelliteData.get("catalogNumber").stringValue()}`);
        this.satellitePopoverContent.getCachedElement("01d5a4da").text(`${satelliteData.get("type").stringValue()}`);
        this.satellitePopoverContent.getCachedElement("01d5a4df").text(`${satelliteData.get("orbitalPeriod").numberValue()}°`);
        this.satellitePopoverContent.getCachedElement("01d5a4d2").text(`${satelliteData.get("height").numberValue()}km`);
        // this.satellitePopoverContent.getCachedElement("01d5a4d0").text(`${satelliteData.get("velocity").numberValue()}km/s`);
        let tleContent = "<b>TLE</b><br>";//`${satelliteData.get("tle").getItem(0).stringValue()}<br>`;
        tleContent += `${satelliteData.get("tle").getItem(1).stringValue()}<br>`;
        tleContent += `${satelliteData.get("tle").getItem(2).stringValue()}`;
        this.satellitePopoverContent.getCachedElement("ebc8e8a0").node.innerHTML = tleContent;
}

    hideSatellitePopover() {
        this.satellitePopoverView.hidePopover(this.fastTween);
        this.selectVectorPoint(null, null);
    }

    handleResize() {
        this.map.map.resize();
        this.map.cascadeResize();        
        this.updateMapBoundingBox();
        this.dirtySatellites();
        this.map.getCachedElement("cec61646").cascadeResize();
        this.map.getCachedElement("c3ab4b07").cascadeResize();
    }

    loadTemplate(templateId, swimElement, onTemplateLoad = null, keepSynced = true) {
        console.info("[IndexPage]: load template");
        swimElement.render(templateId, () => {
            if (onTemplateLoad) {
                onTemplateLoad();
            }
        }, keepSynced);
    }

    interpolate(startValue, endValue, stepNumber, lastStepNumber) {
        return (endValue - startValue) * stepNumber / lastStepNumber + startValue;
    }

    checkBounds(currTrackPoint, boundingBox) {
        let currLong = currTrackPoint.get("lng").numberValue();
        let currLat = currTrackPoint.get("lat").numberValue();
        let inBounds = true;

        if(currLat > boundingBox[0].lat) {
            inBounds = false;
            currLat = boundingBox[0].lat;
        }

        if(currLat < boundingBox[1].lat) {
            inBounds = false;
            currLat = boundingBox[1].lat;
        }

        if(currLong < boundingBox[0].lng) {
            inBounds = false;
            currLong = boundingBox[0].lng;
        }

        if(currLong > boundingBox[1].lng) {
            inBounds = false;
            currLong = boundingBox[1].lng;
        }        
        
        return [currLat, currLong, inBounds];
    }    
}