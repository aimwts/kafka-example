require('dotenv').config();
const moment = require('moment');
const spacetrack = require("spacetrack");
const satellite = require('satellite.js');
const path = require("path");
const { Kafka } = require("kafkajs");
const {
    SchemaRegistry,
    readAVSCAsync,
} = require("@kafkajs/confluent-schema-registry");

const registry = new SchemaRegistry({ host: process.env.KAFKA_SCHEMA_URL });
const kafka = new Kafka({
    brokers: [process.env.KAFKA_BROKER_URL],
    clientId: process.env.KAFKA_CLIENT_ID,
});

const producer = kafka.producer();
let storedSchema = 0;
const rowsToFetch = process.env.ROWS_TO_FETCH;
const consecutiveFetches = process.env.CONSECUTIVE_FETCHES;

if(((60/process.env.POLLING_INTERVAL) * process.env.CONSECUTIVE_FETCHES) > 300) {
    console.error("requests will exceed api limits");
    console.error(((60/process.env.POLLING_INTERVAL) * process.env.CONSECUTIVE_FETCHES));
    return;
}

const getLatestTLEs = () => {
    console.info("get latest satellite vectors");
    spacetrack.login({
        username: process.env.SPACETRACK_USERNAME,
        password: process.env.SPACETRACK_PASSWORD,
    });

    for(let i=0; i<consecutiveFetches; i++) {
        const queryOptions = (options = {
            controller: "basicspacedata", // defaults to 'basicspacedata'
            action: "query", // defaults to 'query'
    
            type: "tle_latest", // required, must be one of the following:
            // tle, tle_latest, tle_publish, omm, boxscore, satcat,
            // launch_site, satcat_change, satcat_debut, decay, tip, csm
    
            query: [
                // optional, but highly recommended
                { field: "ORDINAL", condition: "1" },
                { field: "EPOCH", condition: ">now-1" },
                { field: "OBJECT_TYPE", condition: "<>TBA" }, // e.g. (see the API documentation)
            ],
    
            predicates: [  // optional
            ],
    
            // favorites: [  // optional
            //   'Navigation'
            // ],
    
            orderby: [
                // optional
                "-NORAD_CAT_ID", // descending by NORAD_CAT_ID
            ],
    
            limit: rowsToFetch, // optional, but recommended
            offset: rowsToFetch*i, // optional (needs limit to be set, otherwise limit defaults to 100)
    
            // distinct: true // optional (this option causes some hiccups)
        });
    
        spacetrack.get(queryOptions).then(handleTleResult, handleTleError);
    }

};

const handleTleResult = (result) => {
    console.info("received tle results");
    // console.log(util.inspect(result, { colors: true, depth: null }));

    const fullDataset = [];
    let totalNewVectors = 0;

    // the raw result data is all strings, so convert to proper data types to match the AVRO schema
    for (let i = 0; i < result.length; i++) {
        const rowData = result[i];

        const gmst = satellite.gstime(new Date());
        const satrec = satellite.twoline2satrec(rowData.tle[1], rowData.tle[2]);
        const positionAndVelocity = satellite.sgp4(satrec, gmst);
        const positionEci = positionAndVelocity.position;
        // const velocityEci = positionAndVelocity.velocity;
        const positionGd    = satellite.eciToGeodetic(positionEci, gmst);
        const satLongitude = positionGd.longitude;
        const satLatitude  = positionGd.latitude;
        const satHeight    = positionGd.height;        

        // console.info(rowData.name, velocityEci);

        // build track list
        let satTracks = [];
        let currDate = moment();
        for(let i=0; i<=5; i++) {
            const newDateObj = currDate.add(i*1, 'm');
            const testGmst = satellite.gstime(newDateObj.toDate());
            const newPropagation = satellite.sgp4(satrec, testGmst);
            const nextPositionEci = newPropagation.position;
            const nextPositionGd = satellite.eciToGeodetic(nextPositionEci, testGmst);
            satTracks.push({
                timestamp: newDateObj.valueOf(),
                lat: satellite.degreesLat(nextPositionGd.latitude),
                long: satellite.degreesLong(nextPositionGd.longitude)
            });
        }
        // console.info(satTracks);
    

        const satData = {
            name: rowData.name,
            intlDesignator: rowData.intlDesignator,
            catalogNumber: parseInt(rowData.catalogNumber),
            type: rowData.type,
            classificationType: rowData.classificationType,
            epoch: new Date(rowData.epoch).getTime(),
            eccentricity: parseFloat(rowData.eccentricity),
            inclination: parseFloat(rowData.inclination),
            rightAscension: parseFloat(rowData.rightAscension),
            argPericenter: parseFloat(rowData.argPericenter),
            meanAnomaly: parseFloat(rowData.meanAnomaly),
            meanMotion: parseFloat(rowData.meanMotion),
            meanMotionDot: parseFloat(rowData.meanMotionDot),
            meanMotionDotDot: parseFloat(rowData.meanMotionDotDot),
            bStar: parseFloat(rowData.bStar),
            revolutionsAtEpoch: parseInt(rowData.revolutionsAtEpoch),
            elementSetNumber: parseInt(rowData.elementSetNumber),
            ephemerisType: parseInt(rowData.ephemerisType),
            comment: rowData.comment,
            originator: rowData.originator,
            ordinal: parseInt(rowData.ordinal),
            file: parseInt(rowData.file),
            tle: rowData.tle,
            orbitalPeriod: parseFloat(rowData.orbitalPeriod),
            apogee: parseFloat(rowData.apogee),
            perigee: parseFloat(rowData.perigee),
            latitude: satellite.degreesLat(satLatitude),
            longitude: satellite.degreesLong(satLongitude),
            position: {
                x: parseFloat(positionEci.x),
                y: parseFloat(positionEci.y),
                z: parseFloat(positionEci.z)
            },
            height: satHeight,
            tracks: satTracks
        };

        // console.info(rowData.tle[1], rowData.tle[2]);

        fullDataset.push(satData);
        totalNewVectors++;
    }

    console.info(`${totalNewVectors} results parsed, begin encoding`);
    var milliseconds = new Date().getTime();

    var newSatVector = {
        timestamp: milliseconds.toString(),
        tleDataset: fullDataset,
    };
    const parseResults = async () => {
        const outgoingMessage = {
            key: milliseconds.toString(),
            value: await registry.encode(storedSchema.id, newSatVector),
        };
        console.info("outgoing message encoded, send to kafka");
        await producer
            .send({
                topic: process.env.KAFKA_TOPIC,
                messages: [outgoingMessage],
            })
            .then(() => {
                console.info("send complete");
            });
    };
    parseResults().catch(async (e) => {
        console.error(e);
    });
};

const handleTleError = (err) => {
    console.error("tle error", err.stack);
};

const start = async() => {
    const schema = await readAVSCAsync(
        path.join(__dirname, process.env.TLE_SCHEMA)
    );
    storedSchema = await registry.register(schema); // { id: 2 }
    console.info("schema id", storedSchema);
    mainLoop();
}

const run = async () => {
    // const schema = await avdlToAVSCAsync(path.join(__dirname, 'schema.avdl'))
    // const { id } = await registry.register(schema);

    getLatestTLEs();
};

const mainLoop = () => {
    run()
    .then(() => {
        setTimeout(() => {
            mainLoop();            
        }, (process.env.POLLING_INTERVAL * 60 * 1000));
        
    })
    .catch(async (e) => {
        console.error(e);
    });

}

start();

