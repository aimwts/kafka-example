class IndexPage {

    constructor(swimUrl, elementID, templateID) {
        console.info("[IndexPage]: constructor");
        this.swimUrl = swimUrl;
        this.rootHtmlElementId = elementID;
        this.rootSwimTemplateId = templateID;
        this.overlay = null;
        this.map = null;
        this.aggregateNodeRef = null;
        this.selectedMapPoint = null;
        this.pie1Div = null;
        this.pie2Div = null;
        this.datagridDiv = null;
        this.onGroundPie = null;
        this.drawAirportTimeout = null;
        this.uiFilters = {};
        this.planeIcon = new Image();
        this.airportIcon = new Image();
        this.pieHighlightFilter = null;
        this.currentSimTime = new Date(0);
        this.appConfig = null;
        this.userGuid = null;
        this.mapBoundingBox = null;
        this.links = {};
        this.onGroundCount = 0;
        this.inAirCount = 0;
        this.altitudePieValues = {};
        this.airplaneDataDirty = false;
        this.weatherDirty = false;
        this.airportsDirty = false;
        this.onGroundPieDirty = false;
        this.altitudePieDirty = false;
        this.didMapMove = false;
        this.displayedTimeDirty = false;
        this.isNewTickRendered = true;
        this.uiFilterDirty = false;
        this.airportMarkers = {};
        this.airplaneMarkers = {};
        this.airportDataset = {};
        this.airplaneDataset = {};
        this.gairmetWeatherDataset = {};
        this.gairmetWeatherPolys = [];
        this.devicesDataset = {};
        this.devicesMarkers = {};
        this.trackDataset = {};
        this.trackMarkers = {};
        this.airplaneWorker = null;
        this.fastTween = swim.Transition.duration(100);
        this.currentZoomLevel = 0;
        this.countriesList = {};
        this.countryMarkers = {};
        this.originCountryCounts = {};
        this.zoomTransitionLevel = 4;
        this.originCountryDataDirty = false;


        console.info("[IndexPage]: cookie", document.cookie, Utils.getCookie("swim.user.guid"))
        if(Utils.getCookie("swim.user.guid") === "") {
            this.userGuid = Utils.newGuid();
            Utils.setCookie("swiw.user.guid", this.userGuid, 30);
            console.info("[IndexPage]: new user guid set", this.userGuid);
        } else {
            this.userGuid = Utils.getCookie("swim.user.guid");
            console.info("[IndexPage]: user has guid cookie", this.userGuid);
        }
        this.airplaneWorker = new Worker('/assets/js/airplaneWorker.js');
    }

    initialize() {
        console.info("[IndexPage]: init", this.userGuid);
        swim.command(this.swimUrl, "/userPrefs/" + this.userGuid, "setGuid", this.userGuid);
        this.rootHtmlElement = document.getElementById(this.rootHtmlElementId);
        this.rootSwimElement = swim.HtmlView.fromNode(this.rootHtmlElement);
        this.loadTemplate(this.rootSwimTemplateId, this.rootSwimElement, this.start.bind(this), false);
        this.aggregateNodeRef = swim.nodeRef(this.swimUrl, 'aggregation');

        this.airplaneWorker.onmessage = (evt) => {            
            this.handleWorkerMessage(evt);
        }
    }

    handleWorkerMessage(evt) {
        const msgData = evt.data;

        switch(msgData.action) {
            case "update":
                const updateMarkerId = msgData.markerId;
                this.airplaneDataset[updateMarkerId] = swim.Record.fromObject(msgData.newValue);
                this.airplaneDataset[updateMarkerId].dirty = true;
                this.airplaneDataDirty = true;
                break;

            case "remove":
                const removeMarkerId = msgData.markerId;
                if (this.airplaneDataset[removeMarkerId]) {
                    this.airplaneDataset[removeMarkerId].removed = true;
                    this.airplaneDataset[removeMarkerId].dirty = true;
                    
                }
                this.airplaneDataDirty = true;                
                break;
            case "sync":
                this.map.map.synced = true;
                this.airplaneDataDirty = true;
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
        // this.pie1Div = this.rootSwimElement.getCachedElement("cec61646");
        // this.pie2Div = this.rootSwimElement.getCachedElement("c3ab4b07");
        // this.datagridDiv = this.rootSwimElement.getCachedElement("d5dbe551");

        // document.getElementById("regionDropDown").onchange = (evt) => {
        //     this.selectRegion(evt.target.value);
        // }

        this.overlay = this.map.overlays['de2f3c54'];

        this.map.map.dataDirty = true;
        this.map.map.synced = false;

        this.map.map.on("load", () => {
            this.currentZoomLevel = this.map.map.getZoom();
            // this.drawOnGroundPie();
            // this.drawAltitudePie();
            this.updateMapBoundingBox();
            for(let linkLKey in this.links) {
                this.links[linkLKey].open();
            }

        });

        const handleMapUpdate = () => {
            this.didMapMove = true;
            this.currentZoomLevel = this.map.map.getZoom();
        }

        this.map.map.on("zoom", handleMapUpdate);
        this.map.map.on("zoomend", handleMapUpdate);

        this.map.map.on("move", handleMapUpdate);
        this.map.map.on("moveend", handleMapUpdate);

        this.airportPopoverView = new swim.PopoverView()
            .borderRadius(10)
            .padding(0)
            .arrowHeight(20)
            .arrowWidth(20)
            .backgroundColor(swim.Color.parse("#071013").alpha(0.7))
            .backdropFilter("blur(2px)");
            
        this.airportPopoverContent = swim.HtmlView.create("div");
        this.airportPopoverContent.render("7ea87845");
        this.airportPopoverView.append(this.airportPopoverContent);
        this.rootSwimElement.append(this.airportPopoverView);        

        this.airplanePopoverView = new swim.PopoverView()
            .borderRadius(10)
            .padding(0)
            .arrowHeight(20)
            .arrowWidth(20)
            .backgroundColor(swim.Color.parse("#071013").alpha(0.7))
            .backdropFilter("blur(2px)");
            
        this.airplanePopoverContent = swim.HtmlView.create("div");
        this.airplanePopoverContent.render("7cd1b130");
        this.airplanePopoverView.append(this.airplanePopoverContent);
        this.rootSwimElement.append(this.airplanePopoverView);           

        this.airplaneWorker.postMessage({"action":"setSwimUrl","data":this.swimUrl});
        this.airplaneWorker.postMessage({"action":"start"});

        window.requestAnimationFrame(() => {
            this.render();
        })
        document.body.onresize = () => {
            this.handleResize();
        };
        // swim.command(this.swimUrl.replace("9001", "9002"), "/simulator", "addAppLog", "Map Page Opened");

    }

    render() {

        // // update displayed time
        // if(this.displayedTimeDirty) {
        //     let timestampDiv = this.rootSwimElement.getCachedElement("c0ebccfc");
        //     if (this.currentSimTime !== "Invalid Date") {
        //         timestampDiv.text(this.currentSimTime + " CST");
        //     } else {
        //         timestampDiv.text("");
        //     }
        //     this.displayedTimeDirty = false;
        // }

        // // update progress bar
        // if(!this.isNewTickRendered) {
        //     const progressBarContainer = this.rootSwimElement.getCachedElement("e5bdb7f9");
        //     const progressBar = this.rootSwimElement.getCachedElement("3e5db015");
        //     const liveBar = this.rootSwimElement.getCachedElement("93c39404");
        //     const apiQueryEnabled = this.currentSimTicks.get("apiQueryEnabled").booleanValue(false);
        //     // console.info("[Index] simTickLink", apiQueryEnabled);
        //     if(apiQueryEnabled) {
        //         progressBarContainer.display("none");
        //         liveBar.display("block");
        //     } else {
        //         progressBarContainer.display("block");
        //         liveBar.display("none");
        //         const currTick = this.currentSimTicks.get("currentTick");
        //         const totalTicks = this.currentSimTicks.get("totalTicks");
        //         const width = currTick / totalTicks;
        //         progressBar.node.style.width = Math.round(width * 100) + "%";
    
        //     }        
        //     this.isNewTickRendered = true;
        // }

        // if(this.onGroundPieDirty) {
        //     this.updateOnGroundPie("onGround", this.onGroundCount);
        //     this.updateOnGroundPie("inAir", this.inAirCount);
        //     this.onGroundPieDirty = false;
        // }
        
        // if(this.altitudePieDirty) {
        //     for(let key in this.altitudePieValues) {
        //         this.updateAltitudePie(swim.Value.fromAny(key), swim.Value.fromAny(this.altitudePieValues[key]));
        //     }
            
        //     this.altitudePieDirty = false;
        // }
        
        if(this.didMapMove) {
            this.updateMapBoundingBox();
            this.dirtyAirplanes();
            this.didMapMove = false;
        }
        
        // if(this.airportsDirty) {
        //     this.drawAirports();
        //     this.airportsDirty = false;
        // }

        if(this.airplaneDataDirty /* && this.currentZoomLevel >= this.zoomTransitionLevel*/ ) {
            this.drawTracks();
            this.drawAirplanes();
            this.airplaneDataDirty = false;    
        }

        // if(this.weatherDirty) {
        //     this.drawWeather();
        //     this.weatherDirty = false;
        // }

        // if(this.originCountryDataDirty) {
        //     for (let id in this.countryMarkers) {
        //         this.countryMarkers[id].remove();
        //         delete this.countryMarkers[id];
        //     }
        //     this.originCountryDataDirty = false;            
        // }

        // if(this.currentZoomLevel < this.zoomTransitionLevel) {
        //     if(Object.keys(this.airplaneMarkers).length > 0) {
        //         this.clearAirplanes();
        //     }
        //     if(Object.keys(this.countryMarkers).length === 0) {
        //         this.drawCountsByCountry();
        //     }            
        // } else {
        //     if(Object.keys(this.countryMarkers).length !== 0) {
        //         for (let id in this.countryMarkers) {
        //             this.countryMarkers[id].remove();
        //             delete this.countryMarkers[id];
        
        //         }
        //         this.dirtyAirplanes();
        //         this.airplaneDataDirty = true;
        //     }            

        // }

        // if(this.uiFilterDirty) {
        //     this.drawUiFilterList();
        //     this.uiFilterDirty = false;
        // }
        

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

    drawTrackLine(trackPoints, strokeColor = swim.Color.rgb(108, 95, 206, 0.75)) {
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

    dirtyAirplanes() {
        this.airplaneDataDirty = true;
        for(let id in this.airplaneDataset) {
            const newValue = this.airplaneDataset[id];
            const boundsRecord = swim.Record.create()
                .slot("lat", newValue.get("latitude").numberValue(0))
                .slot("lng", newValue.get("longitude").numberValue(0));

            const boundsCheck = this.checkBounds(boundsRecord, this.mapBoundingBox);

            if(boundsCheck[2] === true) {
                this.airplaneDataset[id].dirty = true;
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

    drawAltitudePie() {

        this.altitudePie = new swim.PieView()
            // .innerRadius("15%")
            .outerRadius("30%")
            .tickColor("#fff")
            .font("14px sans-serif")
            .textColor("#fff");
        this.pie2Div.append(this.altitudePie);

    }


    updateAltitudePie(key, value) {
        const tween = swim.Transition.duration(200);
        const v = value;//.get(key).numberValue();
        // const sliceColors = [swim.Color.parse("#6acd00"), swim.Color.parse("#00a6ed")];
        let slice = this.altitudePie.getChildView(key.value);
        if (slice) {
            slice.value(v, tween);
            slice.label().text(v.value);
        } else {
            const labels = ["On Ground", "1′-6k′", "6k′-13k′", "13k′-26k′","26k′-32k′","above 32k′"];
            const sliceCount = 6;
            const startColor = swim.Color.rgb(106, 175, 0, 0.95);
            const endColor = swim.Color.rgb(0, 166, 255, 0.95);
            const newRgb = new swim.Color.rgb();
            newRgb.r = this.interpolate(startColor.r, endColor.r, parseInt(key.value), sliceCount);
            newRgb.g = this.interpolate(startColor.g, endColor.g, parseInt(key.value), sliceCount);
            newRgb.b = this.interpolate(startColor.b, endColor.b, parseInt(key.value), sliceCount);
            newRgb.a = this.interpolate(startColor.a, endColor.a, parseInt(key.value), sliceCount);
            const sliceColor = newRgb.alpha(0.75);
            const sliceColorHover = newRgb.alpha(1);

            slice = new swim.SliceView()
                .value(v)
                .sliceColor(sliceColor)
                .label(v)
                .labelRadius("60%")
                .legend(labels[key.value - 1])
                .tickLength(135)

            slice.origColor = sliceColor;

            slice.onMouseOver = (evt) => {
                slice.outerRadius("35%", tween);
                slice.sliceColor(sliceColorHover, tween);
                this.pieHighlightFilter = "alt-" + key.value;
                this.map.map.dataDirty = true;
                this.dirtyAirplanes();               
                this.drawAirplanes();
            }
            slice.onMouseOut = (evt) => {
                slice.outerRadius("30%", tween);
                slice.sliceColor(sliceColor, tween);
                this.pieHighlightFilter = null;
                this.map.map.dataDirty = true;
                this.dirtyAirplanes();               
                this.drawAirplanes();
            }
            this.altitudePie.setChildView(key.value, slice);
        }
        let total = 0;
        for(let sliceIndex in this.altitudePie.childViews) {
            const slice = this.altitudePie.childViews[sliceIndex];
            total += slice.value().numberValue();
        }
        this.rootSwimElement.getCachedElement("311db141").text(Math.round(total), tween)
    }  

    drawOnGroundPie() {
        this.onGroundPie = new swim.PieView()
            // .innerRadius("15%")
            .outerRadius("30%")
            .tickColor("#fff")
            .font("14px sans-serif")
            .textColor("#fff");
        this.pie1Div.append(this.onGroundPie);


        this.updateOnGroundPie("onGround", 1);
        this.updateOnGroundPie("inAir", 1);
    }

    updateOnGroundPie(key, value) {
        const tween = swim.Transition.duration(200);
        const v = value;//.get(key).numberValue();
        const sliceColors = [swim.Color.parse("#6acd00"), swim.Color.parse("#00a6ed")];

        const pieIndices = { "onGround": 0, "inAir": 1 };
        let slice = this.onGroundPie.getChildView(key);
        if (slice) {
            slice.value(v, tween);
            slice.label().text(v);
        } else {
            const sliceColor = sliceColors[pieIndices[key]].alpha(0.75);
            const sliceColorHover = sliceColor.alpha(1);
            slice = new swim.SliceView()
                .value(v)
                .sliceColor(sliceColor)
                .label(v.toFixed())
                .legend(key)
                .tickLength(125)

            slice.origColor = sliceColor;

            slice.onMouseOver = (evt) => {
                slice.outerRadius("35%", tween);
                slice.sliceColor(sliceColorHover, tween);
                this.pieHighlightFilter = key;
                this.map.map.dataDirty = true;
                this.map.map.dataDirty = true;
                this.dirtyAirplanes();
                this.drawAirplanes();
            }
            slice.onMouseOut = (evt) => {
                slice.outerRadius("30%", tween);
                slice.sliceColor(sliceColor, tween);
                this.pieHighlightFilter = null;
                this.map.map.dataDirty = true;
                this.map.map.dataDirty = true;
                this.dirtyAirplanes();
                this.drawAirplanes();
            }
            this.onGroundPie.setChildView(key, slice);
        }
        let total = 0;
        for(let sliceIndex in this.onGroundPie.childViews) {
            const slice = this.onGroundPie.childViews[sliceIndex];
            total += slice.value();
        }
        this.rootSwimElement.getCachedElement("1a6cff34").text(Math.round(total), tween);
        // console.info("status total", total);        
    }    

    drawAirplanes() {

        const mapView = this.map.map;
        
        // make sure map is loaded and there is dirty airplane data
        if (this.airplaneDataDirty && mapView.synced) {

            // setup tween based on zoom level
            let tween = swim.Transition.duration(2000);
            // if(this.currentZoomLevel <= 6) {
            //     tween = swim.Transition.duration(500);
            // }
    
            // foreach airplane in the airplaneDataSet
            // each airplane is stored in the dataset by its callsign
            for (let callsign in this.airplaneDataset) {
                const newValue = this.airplaneDataset[callsign];
                const boundsRecord = swim.Record.create()
                    .slot("lat", newValue.get("latitude").numberValue(0))
                    .slot("lng", newValue.get("longitude").numberValue(0));

                // check if current airplane is on the screen
                const boundsCheck = this.checkBounds(boundsRecord, this.mapBoundingBox);

                // if current airplane data dirty and on screen, create/update it
                if(this.airplaneDataset[callsign].dirty === true && boundsCheck[2] === true) {
                        
                    // if there is not a map marker for current airplane, create one
                    if (!this.airplaneMarkers[callsign]) {

                        const startColor = swim.Color.rgb(0, 0, 255, 0.95).hsl();
                        const endColor = swim.Color.rgb(255, 0, 0, 0.95).hsl();
                        const newRgb = new swim.Color.rgb().hsl();
                        let altitude = newValue.get("height").numberValue(0);
                        const maxAlt = 10000;
                        if (altitude > maxAlt) {
                            altitude = maxAlt;
                        }
                        newRgb.h = this.interpolate(startColor.h, endColor.h, altitude, maxAlt);
                        newRgb.s = this.interpolate(startColor.s, endColor.s, altitude, maxAlt);
                        newRgb.l = this.interpolate(startColor.l, endColor.l, altitude, maxAlt);

                        let markerFillColor = newRgb.rgb().alpha(0.25);
                        let markerStrokeColor = newRgb.rgb().alpha(0.95);
                                                
                        // create marker object
                        let tempMarker = new swim.MapCircleView()
                            // .center([newLat, newLng])
                            .center([newValue.get("longitude").numberValue(0), newValue.get("latitude").numberValue(0)])
                            // .center(mapboxgl.LngLat.convert([newLng, newLat]))
                            .radius(4)
                            .fill(markerFillColor)
                            .stroke(markerStrokeColor)
                            .strokeWidth(1);

                        ;
                        tempMarker.origStrokeColor = markerStrokeColor;
                        // tempMarker.didRender = () => {
                        //     const overlayContext = this.overlay.canvasView.node.getContext("2d");
                        //     const currX = tempMarker.anchor.x;
                        //     const currY = tempMarker.anchor.y;
                        //     const iconScale = 5;
                        //     const markerData = this.airplaneDataset[callsign];
                        //     this.drawRotatedImage(overlayContext, this.planeIcon, (currX - iconScale), (currY - iconScale), markerData.get("heading").numberValue(0), iconScale);
                        // };
                        tempMarker.on("click", () => {
                            this.selectVectorPoint(tempMarker, newValue);
                            this.renderAirplanePopover(tempMarker, newValue);
                        });

                        // add marker to overlay and cache to markers list
                        this.overlay.setChildView(callsign, tempMarker);
                        this.airplaneMarkers[callsign] = tempMarker;
                        this.airplaneDataset[callsign].dirty = false;

                    } else { // else if marker has already been created, update or remove it

                        // if current airplane was marked 'removed', remove from overlay and datasets
                        if (this.airplaneDataset[callsign].removed) {
                            if (this.selectedMapPoint !== null && this.selectedMapPoint._key == callsign) {
                                this.hideAirplanePopover();
                            }
                            this.airplaneMarkers[callsign].remove();
                            delete this.airplaneMarkers[callsign];
                            delete this.airplaneDataset[callsign];
                        } else { // update existing airplane marker

                            // grab cached marker
                            const tempMarker = this.airplaneMarkers[callsign];

                            // decide what initial color it will be
                            const startColor = swim.Color.rgb(0, 0, 255, 0.95).hsl();
                            const endColor = swim.Color.rgb(255, 0, 0, 0.95).hsl();
                            const newRgb = new swim.Color.rgb().hsl();
                            let altitude = newValue.get("height").numberValue(0);
                            const maxAlt = 10000;
                            if (altitude > maxAlt) {
                                altitude = maxAlt;
                            }
                            newRgb.h = this.interpolate(startColor.h, endColor.h, altitude, maxAlt);
                            newRgb.s = this.interpolate(startColor.s, endColor.s, altitude, maxAlt);
                            newRgb.l = this.interpolate(startColor.l, endColor.l, altitude, maxAlt);
    
                            let markerFillColor = newRgb.rgb().alpha(0.75);
                            let markerStrokeColor = newRgb.rgb().alpha(0.95);
    
                            // for coloring by velocity
                            // const startColor = swim.Color.rgb(0, 0, 255, 0.95).hsl();
                            // const endColor = swim.Color.rgb(255, 0, 0, 0.95).hsl();
                            // const newRgb = new swim.Color.rgb().hsl();
                            // let altitude = newValue.get("velocity").numberValue(0);
                            // const maxAlt = 300;
                            // newRgb.h = this.interpolate(startColor.h, endColor.h, altitude, maxAlt);
                            // newRgb.s = this.interpolate(startColor.s, endColor.s, altitude, maxAlt);
                            // newRgb.l = this.interpolate(startColor.l, endColor.l, altitude, maxAlt);

                            // let markerFillColor = newRgb.alpha(0.75);
                            // let markerStrokeColor = newRgb.alpha(0.95);
                            // const highlightFillColor = swim.Color.rgb(249, 240, 112, 0.75);
                            // const highlightStrokeColor = swim.Color.rgb(249, 240, 112, 0.95);
                            // altitude = newValue.get("baroAltitude").numberValue(0);

                            // // update new color based on various states of current airplane
                            // if (this.pieHighlightFilter === "onGround" && newValue.get("onGround").booleanValue() === true) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "inAir" && newValue.get("onGround").booleanValue() === false) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "alt-1" && altitude <= 0) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "alt-2" && altitude >= 1 && altitude < 2000) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "alt-3" && altitude >= 2000 && altitude < 4000) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "alt-4" && altitude >= 4000 && altitude < 8000) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "alt-5" && altitude >= 8000 && altitude < 10000) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            // if (this.pieHighlightFilter === "alt-6" && altitude >= 10000) {
                            //     markerFillColor = highlightFillColor;
                            //     markerStrokeColor = highlightStrokeColor;
                            // }
                            if (this.selectedMapPoint === tempMarker) {
                                markerFillColor = swim.Color.rgb(108, 95, 206, 0.5);
                                markerStrokeColor = swim.Color.rgb(108, 95, 206, 0.75);
                            }
                            // if(newValue.get("squawk").stringValue === "7700") {
                            //     markerFillColor = swim.Color.rgb(255, 0, 0, 0.5);
                            //     markerStrokeColor = swim.Color.rgb(255, 0, 0, 0.75);
                            // }
                            // if(newValue.get("squawk").stringValue === "7600") {
                            //     markerFillColor = swim.Color.rgb(255, 0, 0, 0.5);
                            //     markerStrokeColor = swim.Color.rgb(255, 0, 0, 0.75);
                            // }
                            // if(newValue.get("squawk").stringValue === "7500") {
                            //     markerFillColor = swim.Color.rgb(255, 0, 0, 0.5);
                            //     markerStrokeColor = swim.Color.rgb(255, 0, 0, 0.75);
                            // }
                            // if(newValue.get("callsign").stringValue().indexOf("911ZZ") >= 0) {
                            //     markerFillColor = swim.Color.rgb(255, 0, 0, 0.5);
                            //     markerStrokeColor = swim.Color.rgb(255, 0, 0, 0.75);
                            // }

                            // // update marker color/stroke
                            // tempMarker.stroke(markerStrokeColor, this.fastTween);
                            // tempMarker.fill(markerFillColor, this.fastTween);

                            // update center point
                            const newCenter = [newValue.get("longitude").numberValue(0), newValue.get("latitude").numberValue(0)];
                            tempMarker.center.setState(newCenter, tween);

                            // clean up dirty flag
                            this.airplaneDataset[callsign].dirty = false;

                            // ??
                            if (this.selectedMapPoint !== null && this.selectedMapPoint._key == callsign) {
                                this.selectVectorPoint(this.selectedMapPoint, this.airplaneDataset[callsign]);
                            }
            
                        }
                    }
                    
                } else {
                    // if airplane marker is off screen make sure it gets removed from overlay
                    if(boundsCheck[2] === false && this.airplaneMarkers[callsign] && this.airplaneMarkers[callsign].parentView !== null) {
                        if (this.selectedMapPoint !== null && this.selectedMapPoint._key == callsign) {
                            this.hideAirplanePopover();
                        }
                        try {
                            this.airplaneMarkers[callsign].remove();
                        } catch (ex) {
                            console.error(ex);
                        }
                        delete this.airplaneMarkers[callsign];
                    }
                    
                }
            }

            // clean up last dirty flag
            this.airplaneDataDirty = false;
        }
    }

    clearAirplanes() {
        this.clearTracks();
        this.hideAirplanePopover();
        for (let callsign in this.airplaneMarkers) {
            this.airplaneMarkers[callsign].remove();
            delete this.airplaneMarkers[callsign];
        }
    }

    drawAirports() {

        for (let markerId in this.airportDataset) {
            const currentVector = this.airportDataset[markerId];
            const newLat = currentVector.get("latitude").value;
            const newLng = currentVector.get("longitude").value;
            const airportType = currentVector.get("type").value;
            if (!this.airportDataset[markerId].removed) {
                if (newLat && newLat !== "None" && newLng && newLng !== "None") {
                    try {
                        if (!this.airportMarkers[markerId]) {
                            let tempMarker = new swim.MapCircleView()
                                // .center([newLat, newLng])
                                .center(mapboxgl.LngLat.convert([newLng, newLat]))
                                .radius((airportType === "large_airport") ? 9 : 6)
                                .fill(swim.Color.rgb(155, 155, 155, 0.75))
                                .stroke(swim.Color.rgb(155, 155, 155, 1))
                                .strokeWidth(2);

                            
                            tempMarker.didRender = () => {
                                const overlayContext = this.overlay.canvasView.node.getContext("2d");
                                const currX = tempMarker.anchor.x;
                                const currY = tempMarker.anchor.y;
                                const iconScale = (airportType === "large_airport") ? 8 : 5;
                                // const markerData = this.airplaneDataset[markerId];
                                // overlayContext.drawImage(this.airportIcon, -5, -5, 10, 10);
                                this.drawRotatedImage(overlayContext, this.airportIcon, (currX- iconScale), (currY-iconScale), 0, iconScale);
                            };
            
                            tempMarker.on("click", () => {
                                this.selectVectorPoint(tempMarker, currentVector);
                                this.renderAirportPopover(tempMarker, currentVector, swim.Color.rgb(155, 155, 155, 0.75));
                            });

                            this.overlay.setChildView(markerId, tempMarker);
                            this.airportMarkers[markerId] = tempMarker;

                        }
                    } catch (ex) {
                        console.info(ex);
                    }
                }
            } else {
                if (this.airportDataset[markerId].removed) {
                    if(this.airportMarkers[markerId].parentView !== null) {
                        this.airportMarkers[markerId].remove();
                        // this.overlay.removeChildView(this.airportMarkers[markerId]);
                    }
                    delete this.airportMarkers[markerId];
                    delete this.airportDataset[markerId];
                }
            }

        }

    }

    drawUiFilterList() {
        // console.info("Draw UI Filters", this.uiFilters);
        const filterListDiv = document.getElementById("cfb9be55");
        filterListDiv.innerHTML = "<a href='https://opensky-network.org/' target='_blank'><h4>Flights: OpenSky API</h4></a>";
        const flightSectionDiv = document.createElement("div");
        flightSectionDiv.className = "nolink";
        flightSectionDiv.innerHTML = "<span class='listIcon' id='aircraft'><h2 class='airplaneIcon'>&nbsp;</h2></span> Aircraft";
        filterListDiv.appendChild(flightSectionDiv);

        filterListDiv.innerHTML += "<a href='http://noaa.gov' target='_blank'><h4>Airports: Static File</h4></a>";
        let i = 0;
        for (let filterKey in this.uiFilters) {
            if (i === 2) {
                const weatherHeader = document.createElement("a");
                weatherHeader.href = "https://www.aviationweather.gov/dataserver/output?datatype=gairmet";
                weatherHeader.innerHTML = "<h4>Weather: NOAA</h4>";
                filterListDiv.appendChild(weatherHeader);
                // filterListDiv.innerHTML += "<h4>Weather Overlays</h4>";
            }
            const newDiv = document.createElement("div");
            if (filterKey === "1largeAirports") {
                newDiv.innerHTML = "<span class='listIcon' id='lgAirport'><h2 class='airportIcon'>&nbsp;</h2></span> Large Airports";
            }
            if (filterKey === "2mediumAirports") {
                newDiv.innerHTML = "<span class='listIcon' id='medAirport'><h2 class='airportIconSmol'>&nbsp;</h2></span> Medium Airports";
            }
            if (filterKey === "3iceWeather") {
                newDiv.innerHTML = "<span class='listIcon' id='icyWeather'></span> Icy Weather";
            }
            if (filterKey === "4turbHi") {
                newDiv.innerHTML = "<span class='listIcon' id='highTurb'></span> High Turbulence";
            }
            if (filterKey === "5turbLo") {
                newDiv.innerHTML = "<span class='listIcon' id='lowTurb'></span> Low Turbulence";
            }
            if (filterKey === "6IFR") {
                newDiv.innerHTML = "<span class='listIcon' id='ifr'></span> IFR";
            }
            if (filterKey === "7fzlvl") {
                newDiv.innerHTML = "<span class='listIcon' id='freezeLevel'></span> Freeze Level";
            }
            if (filterKey === "8mtObsc") {
                newDiv.innerHTML = "<span class='listIcon' id='mntObstr'></span> Mountain Obstruction";
            }
            if (filterKey === "9sfcWind") {
                newDiv.innerHTML = "<span class='listIcon' id='surfaceWind'></span> Surface Wind";
            }

            newDiv.onclick = (clickEvent) => {
                if (filterKey.indexOf("Airports") >= 0) {
                    this.toggleAirportFilter(filterKey, !this.uiFilters[filterKey]);
                } else {
                    this.toggleWeatherFilter(filterKey, !this.uiFilters[filterKey]);
                }
                clickEvent.currentTarget.style.opacity = (!this.uiFilters[filterKey]) ? "0.5" : "1";
            }
            newDiv.style.opacity = (!this.uiFilters[filterKey]) ? "0.5" : "1";
            filterListDiv.appendChild(newDiv);
            i++;
        }
    }

    hideAirportPopover() {
        this.airportPopoverView.hidePopover(this.fastTween);
        this.selectVectorPoint(null, null);
    }

    hideAirplanePopover() {
        this.airplanePopoverView.hidePopover(this.fastTween);
        this.selectVectorPoint(null, null);
    }

    selectVectorPoint(marker, data) {
        console.info(data);
        this.clearTracks();
        if (this.selectedMapPoint) {
            this.selectedMapPoint.fill(this.selectedMapPoint.defaultFillColor || "#ffffff");
            this.selectedMapPoint.stroke(this.selectedMapPoint.defaultStrokeColor || "#ffffff");
        }
        if(marker === null) {
            this.selectedMapPoint = null;

            this.airportPopoverView.hidePopover(this.fastTween);
            return ;
        }
        // const type = (data.has("icao24")) ? "Airplane" : "Airport"
        this.selectedMapPoint = marker;

        this.selectedMapPoint.defaultFillColor = this.selectedMapPoint.fill();
        this.selectedMapPoint.defaultStrokeColor = this.selectedMapPoint.stroke();
        this.selectedMapPoint.fill(swim.Color.rgb(108,95,206,0.5));
        this.selectedMapPoint.stroke(swim.Color.rgb(108,95,206,0.75));

        // if(type === "Airplane") {
            
            if(this.tracksLink) {
                this.tracksLink.close();
            }
            this.tracksLink = swim.nodeRef(this.swimUrl, `/satellite/${data.get("intlDesignator").stringValue()}`).downlinkMap().laneUri('tracks')
                .didUpdate((newKey, newValue) => {
                    // console.info(newKey, newValue);
                    this.trackDataset[newKey.numberValue()] = newValue;

                })
                .didSync(() => {
                    this.drawTracks();
                })
                .open();

            this.airplanePopoverContent.getCachedElement("ff42bb72").text(`${data.get("catalogNumber").stringValue()}`);
            this.airplanePopoverContent.getCachedElement("01d5a4da").text(`${data.get("type").stringValue()}`);
            this.airplanePopoverContent.getCachedElement("01d5a4df").text(`${data.get("orbitalPeriod").numberValue()}°`);
            this.airplanePopoverContent.getCachedElement("01d5a4d2").text(`${Math.round(data.get("height").numberValue()*3.2)}m`);
                
        
        // }

    }

    toggleMenu() {
        const menuDiv = document.getElementById("b3a6b5bb");
        menuDiv.className = (menuDiv.className === "sideMenuOpen") ? "sideMenu" : "sideMenuOpen";

    }

    toggleAirportFilter(airportSize, showAirport) {
        if (airportSize === "2mediumAirports") {
            swim.command(this.swimUrl, '/userPrefs/' + this.userGuid, 'toggleMediumAirports', showAirport);
        }
        if (airportSize === "1largeAirports") {
            swim.command(this.swimUrl, '/userPrefs/' + this.userGuid, 'toggleLargeAirports', showAirport);
        }

    }

    toggleWeatherFilter(weatherOverlay, showOverlay) {
        this.uiFilters[weatherOverlay] = !this.uiFilters[weatherOverlay];
        this.drawUiFilterList();
        this.drawWeather();

        const filterInfo = swim.Record.create();
        filterInfo.slot("name", weatherOverlay);
        filterInfo.slot("value", this.uiFilters[weatherOverlay]);

        swim.command(this.swimUrl, '/userPrefs/' + this.userGuid, 'toggleWeather', filterInfo);

    }

    renderAirportPopover(tempMarker, airportData) {

        // console.info("airport clicked:" + airportData);

        this.airportPopoverView.hidePopover(this.fastTween);
        this.airportPopoverView.setSource(tempMarker);            
        this.airportPopoverView.showPopover(this.fastTween);   
        
        this.airportPopoverContent.getCachedElement("31642d80").text(airportData.get("short_code").stringValue());
        this.airportPopoverContent.getCachedElement("e29f472c").text(airportData.get("id").stringValue());
        this.airportPopoverContent.getCachedElement("ff42bb70").text(airportData.get("short_code").stringValue());
        this.airportPopoverContent.getCachedElement("30f5f749").text(airportData.get("name").stringValue());
        this.airportPopoverContent.getCachedElement("89e42dea").text(airportData.get("iata_code").stringValue());
        this.airportPopoverContent.getCachedElement("f1d3cefd").text(airportData.get("gps_code").stringValue());

        this.airportPopoverContent.getCachedElement("531bb754").node.href = airportData.get("home_link").stringValue();
        this.airportPopoverContent.getCachedElement("34b0062c").node.href = airportData.get("wiki_link").stringValue();

    }

    renderAirplanePopover(tempMarker, airplaneData) {

        // console.info("airplane clicked:" + airplaneData);

        this.airplanePopoverView.hidePopover(this.fastTween);
        this.airplanePopoverView.setSource(tempMarker);            
        this.airplanePopoverView.showPopover(this.fastTween);   
        
        this.airplanePopoverContent.getCachedElement("31642d81").text(airplaneData.get("type").stringValue());
        this.airplanePopoverContent.getCachedElement("e29f472a").text(airplaneData.get("name").stringValue());
        this.airplanePopoverContent.getCachedElement("ff42bb72").text(`${airplaneData.get("catalogNumber").stringValue()}`);
        this.airplanePopoverContent.getCachedElement("01d5a4da").text(`${airplaneData.get("type").stringValue()}`);
        this.airplanePopoverContent.getCachedElement("01d5a4df").text(`${airplaneData.get("orbitalPeriod").numberValue()}°`);
        this.airplanePopoverContent.getCachedElement("01d5a4d2").text(`${Math.round(airplaneData.get("height").numberValue()*3.2)}m`);
        this.airplanePopoverContent.getCachedElement("ebc8e8a0").node.href =`https://flightaware.com/live/flight/${airplaneData.get("callsign").stringValue()}`;
        // const callsignLink = "https://flightaware.com/live/flight/" + data.get("callsign").stringValue();
    }

    drawCountsByCountry() {
        // console.info("draw countries");
        // console.info(this.countriesList);
        for(let key in this.originCountryCounts) { 
            const currCounts = this.originCountryCounts[key]; 
            const currCountry = this.countriesList[key];
            if(currCountry) {
                if(!this.countryMarkers[key]) {
                    let tempMarker = new swim.MapCircleView()
                        // .center([newLat, newLng])
                        .center(mapboxgl.LngLat.convert([currCountry.get("longitude"), currCountry.get("latitude")]))
                        .radius(20)
                        .fill(swim.Color.rgb(155, 155, 155, 0.95))
                        .stroke(swim.Color.rgb(255, 255, 0, 0.75))
                        .strokeWidth(3);
    
                    tempMarker.didRender = () => {
                        const overlayContext = this.overlay.canvasView.node.getContext("2d");
                        const currX = tempMarker.anchor.x;
                        const currY = tempMarker.anchor.y;
                        const currCount = currCounts.get("count").numberValue();
                        const iconScale = 30;
    
                        this.drawCountryNumber(overlayContext, currCount, currX, currY, iconScale);
                    };
    
                    this.overlay.setChildView(key, tempMarker);
                    this.countryMarkers[key] = tempMarker;
    
                }
            }

        }
    }

    handleResize() {
        this.map.map.resize();
        this.map.cascadeResize();        
        this.updateMapBoundingBox();
        this.dirtyAirplanes();
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

    drawRotatedImage(context, image, x, y, angle, scale = 5) {
        const toRadians = Math.PI / 180;
        context.save();
        context.translate(x + scale, y + scale);
        context.rotate(angle * toRadians);
        context.drawImage(image, (scale*-1), (scale*-1), (scale*2), (scale*2));
        context.restore();
    }

    drawCountryNumber(context, count, x, y, scale = 5) {
        const halfScale = scale/2;
        context.save();
        context.font = "20px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        // context.fillText(count, (scale*-1), (scale*-1), (scale*2), (scale*2));
        context.fillText(count, x, y+2, scale);
        context.restore();
    }    

    selectRegion(evt) {
        let lat = 0;
        let lng = 0;
        let newZoom = 0;

        switch(evt) {
            default:
            case "chicago":
                lat = 41.979246;
                lng = -87.906914;
                newZoom = 9;
                break;

            case "sfbay":
                lat = 37.822114;
                lng = -122.252373;
                newZoom = 8;
                break;

            case "socal":
                lat = 33.543285;
                lng = -117.566918;
                newZoom = 7.6;
                break;

            case "seaboard":
                lat = 40.584109;
                lng = -78.492369;
                newZoom = 6.1;
                break;

            case "europe":
                lat = 49.179902;
                lng = 8.325247;
                newZoom = 4.5;
                break;

            case "persian":
                lat = 26.287425;
                lng = 52.925304;
                newZoom = 6.3;
                break;

            case "dfw":
                lat = 32.874241;
                lng = -96.940683;
                newZoom = 9.3;
                break;

            case "phoenix":
                lat = 33.434141;
                lng = -112.005681;
                newZoom = 14;
                break;
                    
            case "zurich":
                lat = 47.464199;
                lng = 8.559765;
                newZoom = 12;
                break;                

            case "seattle":
                lat = 48.369794;
                lng = -122.613833;
                newZoom = 7;
                break;                

            case "world":
                lat = 28.889794;
                lng = 28.620412;
                newZoom = 1.8;
                break;                
        
        }

        if(lat !== 0 && lng !== 0 && newZoom !== 0) {
            this.map.map.setCenter([lng, lat]);
            this.map.map.setZoom(newZoom);

            // this.map.map.flyTo({
            //     // These options control the ending camera position: centered at
            //     // the target, at zoom level 9, and north up.
            //     center: [lng, lat],
            //     zoom: newZoom,
            //     bearing: 0,
            //     speed: 0.2, // make the flying slow
            //     curve: 1, // change the speed at which it zooms out
                 
            //     // This can be any easing function: it takes a number between
            //     // 0 and 1 and returns another number between 0 and 1.
            //     // easing: function(t) {
            //     //     return t;
            //     // },
                 
            //     // this animation is considered essential with respect to prefers-reduced-motion
            //     // essential: true
            // });     
            setTimeout(() => {
                this.didMapMove = true;
            },10)
            
        }
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