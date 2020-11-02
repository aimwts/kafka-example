import * as satelliteJs from "satellite.js";
import moment from "moment";
import mapboxgl from "mapbox-gl";
import * as swim from "@swim/system";

class FlatViewHelper {

    constructor(){

    }

    createMap(targetElem, onMapLoaded, onMapUpdate, onMapClick) {
        mapboxgl.accessToken =
            "pk.eyJ1Ijoic3dpbWl0IiwiYSI6ImNpczUwODM1MTBhNGMydGxreGxreXc4ZXkifQ.zTuMYsNF_7R4STiqTNRBaA";

        const newMap = new mapboxgl.Map({
            container: targetElem,
            style:
                "mapbox://styles/swimit/cjs5h20wh0fyf1gocidkpmcvm?optimize=true",
            trackResize: true,
            center: {
                lng: -3.29837673769498,
                lat: 4.995591157004185,
            },
            pitch: 0,
            zoom: 2.29,
            antialias: true,
        });
        newMap.on("zoom", onMapUpdate);
        newMap.on("move", onMapUpdate);
        newMap.on("zoomend", onMapUpdate);
        newMap.on("moveend", onMapUpdate);
        newMap.on("click", onMapClick);

        newMap.addControl(new mapboxgl.NavigationControl(), "bottom-right")
            .getCanvasContainer()
            .addEventListener("touchstart", function () {
                // prevent dragPan from interfering with touch scrolling
                newMap.dragPan.disable();
            });

        newMap.on("load", onMapLoaded);

        return newMap;
    }

    createOrbitTrack(satData, projection) {
        const points = [];
        // console.info(satData);
        const satrec = satelliteJs.twoline2satrec(satData.get("tle").getItem(1).stringValue(), satData.get("tle").getItem(2).stringValue());
        let currDate = moment();
        for(let i=0; i<=720; i++) {
            const newDateObj = currDate.add(i*100, 'ms');
            const currGmst = satelliteJs.gstime(newDateObj.toDate());
            const newPropagation = satelliteJs.propagate(satrec, newDateObj.toDate());
            const nextPositionEci = newPropagation.position;
            // console.info(newPropagation.position)
            const nextPositionGd = satelliteJs.eciToGeodetic(nextPositionEci, currGmst);
            const newLong = satelliteJs.degreesLong(nextPositionGd.longitude);
            const newLat = satelliteJs.degreesLat(nextPositionGd.latitude);
            const coords = projection.project(newLong, newLat);
            points.push(coords);
        }



        // var material = new THREE.LineBasicMaterial( { color: 0xffff00 } );
        // var geometry = new THREE.BufferGeometry().setFromPoints( points );
        // var line = new THREE.Line( geometry, material );

        return points
    }      

    drawTrackLine(trackPoints, strokeColor = swim.Color.rgb(249, 240, 112, 1)) {
        // const currPolys = this.trackMarkers.length;
        // const tempMarker = new swim.MapPolygonView();
        // tempMarker.setCoords(trackPoints);
        // tempMarker.stroke(strokeColor);
        // // tempMarker.fill(strokeColor);
        // tempMarker.strokeWidth(2);

        // this.overlay.setChildView('track', tempMarker);

        // this.trackMarkers[currPolys] = tempMarker;

    }      

    interpolate(startValue, endValue, stepNumber, lastStepNumber) {
        return (
            ((endValue - startValue) * stepNumber) / lastStepNumber + startValue
        );
    }

    normalize(value, startRangeMin, startRangeMax, endRangeMin, endRangeMax) {
        // console.info(value, startRangeMin, startRangeMax, endRangeMin, endRangeMax);
        if(value >= 0 && value <= startRangeMax) {
            const percentOfRange = (value/startRangeMax);
            return endRangeMax*percentOfRange;
        } else if(value < 0 && value >= startRangeMin){
            const percentOfRange = (value/startRangeMin);
            return endRangeMin*percentOfRange;
        } else {
            console.info("out of range", value);
            return 0;
        }
    }

    findElemsAtSegmentCoords(mouseX, mouseY, itemMap, segmentPixelSize) {
    
        let newList = new Array();
        
        // x,y
        const primeSegmentX = Math.floor(mouseX/segmentPixelSize.current);
        const primeSegmentY = Math.floor(mouseY/segmentPixelSize.current);
        newList = itemMap.current[primeSegmentX][primeSegmentY];
        
        // x+,y
        if (itemMap.current[primeSegmentX + 1][primeSegmentY]) {
            newList = newList.concat(itemMap.current[primeSegmentX + 1][primeSegmentY]);
        }
    
        // x-,y
        if (primeSegmentX - 1 >=0 && itemMap.current[primeSegmentX - 1][primeSegmentY]) {
            newList = newList.concat(itemMap.current[primeSegmentX - 1][primeSegmentY])
        }
    
        // x-,y-
        if (primeSegmentX - 1 >=0 && primeSegmentY - 1 >=0 && itemMap.current[primeSegmentX - 1][primeSegmentY - 1]) {
            newList = newList.concat(itemMap.current[primeSegmentX - 1][primeSegmentY - 1])
        }
    
        // x,y-
        if (primeSegmentY - 1 >=0 && itemMap.current[primeSegmentX][primeSegmentY - 1]) {
            newList = newList.concat(itemMap.current[primeSegmentX][primeSegmentY - 1])
        }
    
        // x,y+
        if (itemMap.current[primeSegmentX][primeSegmentY + 1]) {
            newList = newList.concat(itemMap.current[primeSegmentX][primeSegmentY + 1])
        }
        
        // x-,y+
        if (primeSegmentX - 1 >=0 && itemMap.current[primeSegmentX - 1][primeSegmentY + 1]) {
            newList = newList.concat(itemMap.current[primeSegmentX - 1][primeSegmentY + 1])
        }
        
        // x,y+
        if (itemMap.current[primeSegmentX][primeSegmentY + 1]) {
            newList = newList.concat(itemMap.current[primeSegmentX][primeSegmentY + 1])
        }
    
        // x+,y+
        if (itemMap.current[primeSegmentX + 1][primeSegmentY + 1]) {
            newList = newList.concat(itemMap.current[primeSegmentX + 1][primeSegmentY + 1])
        }
    
        return newList;
        
    }    

    checkCollision(c1, c2) {
        // console.info(c1, c2);
        var collDist = 1;
        var isColliding = false;
        if (c1 && c2) {
            var dx = (c1.offsetLeft + c1.radius) - (c2.detectionCircleX + c2.detectionCircleRadius);
            var dy = (c1.offsetTop + c1.radius) - (c2.detectionCircleY + c2.detectionCircleRadius);
            var dist = c1.radius + c2.detectionCircleRadius;
            var delta1 = (dx * dx) + (dy * dy);
            var delta2 = dist * dist;
            collDist = ((delta1 - delta2) * -1) / 100;
            isColliding = delta1 <= delta2;
        }
     
        return ({'isColliding': isColliding, 'distance': collDist});
        
    }        
}

export default FlatViewHelper;