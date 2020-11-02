require("dotenv").config();
const moment = require("moment");
const spacetrack = require("./lib/spacetrack");
const satellite = require("satellite.js");
const path = require("path");
const { Kafka, logLevel } = require("kafkajs");
const {
    SchemaRegistry,
    readAVSCAsync,
} = require("@kafkajs/confluent-schema-registry");

const registry = new SchemaRegistry({ host: process.env.KAFKA_SCHEMA_URL });
const kafka = new Kafka({
    logLevel: logLevel.NOTHING,
    brokers: [process.env.KAFKA_BROKER_URL],
    clientId: process.env.KAFKA_CLIENT_ID,
});

const producer = kafka.producer();
let storedSchema = 0;
const fullTleDataset = {};
let isFirstRun = true;

if ((60 / process.env.POLLING_INTERVAL) * process.env.CONSECUTIVE_FETCHES >300) {
    console.error("requests will exceed api limits");
    console.error((60 / process.env.POLLING_INTERVAL) * process.env.CONSECUTIVE_FETCHES);
    return;
}

const getLatestTLEs = () => {
    console.info("get latest satellite vectors");
    spacetrack.login({
        username: process.env.SPACETRACK_USERNAME,
        password: process.env.SPACETRACK_PASSWORD,
    });

    let epochRange = ">now-1";
    if(isFirstRun) {
        epochRange = ">now-24";
        isFirstRun = false;
    }

    const queryOptions = (options = {
        controller: "basicspacedata", 
        action: "query", 
        type: "gp", 

        query: [
            { field: "DECAYED", condition: "0" },
            { field: "EPOCH", condition: epochRange },
            { field: "OBJECT_TYPE", condition: "<>TBA" },
        ],

        orderby: [
            "NORAD_CAT_ID", 
        ]

    });

    spacetrack.get(queryOptions).then(receiveTleData, handleTleError);
    // spacetrack.get(queryOptions).then(handleTleResult, handleTleError);
};

const encodeAndSend = async (dataset) => {
    var milliseconds = new Date().getTime();
    var newSatVector = {
        timestamp: milliseconds.toString(),
        tleDataset: dataset,
    };
    const outgoingMessage = {
        key: milliseconds.toString(),
        value: await registry.encode(storedSchema.id, newSatVector),
    };
    console.info("outgoing message encoded, send to kafka");
    await producer.connect();
    await producer
        .send({
            topic: process.env.KAFKA_TOPIC,
            messages: [outgoingMessage],
        })
        .then(() => {
            console.info("send complete");
        });
};

const receiveTleData = (incomingData) => {
    for(let i=0; i<incomingData.length; i++) {
        const rowData = incomingData[i];
        fullTleDataset[rowData.catalogNumber] = rowData
    }
    // handleTleResult(Object.values(fullTleDataset));
}

const handleTleResult = (result) => {
    console.info(`received tle results ${result.length}`);
    let totalNewVectors = 0;
    let i = 0;

    
    let rowNumber = 0;
    while (totalNewVectors < result.length) {
        const maxResults = result.length - rowNumber > 5000 ? 5000 : result.length - rowNumber;
        // console.info(rowNumber, maxResults);
        const fullDataset = [];
        for (let i = rowNumber; i < (maxResults+rowNumber); i++) {
            // console.info(i);
            
            const rowData = result[i];

            const gmst = satellite.gstime(new Date());
            const satrec = satellite.twoline2satrec(
                rowData.tle[1],
                rowData.tle[2]
            );
            const positionAndVelocity = satellite.propagate(satrec, new Date());
            const positionEci = positionAndVelocity.position;
            if (!positionEci) {
                console.error(`Error propagating ${rowData.name}`);
                console.info(positionAndVelocity);
                // return;
            } else {
                const positionGd = satellite.eciToGeodetic(positionEci, gmst);
                const satLongitude = positionGd.longitude;
                const satLatitude = positionGd.latitude;
                const satHeight = positionGd.height;

                // the raw result data is all strings, so convert to proper data types to match the AVRO schema
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
                    ordinal: parseInt(rowData.ordinal || 0.0),
                    file: parseInt(rowData.file),
                    tle: rowData.tle,
                    orbitalPeriod: parseFloat(rowData.orbitalPeriod),
                    apogee: parseFloat(rowData.apogee || 0.0),
                    perigee: parseFloat(rowData.perigee || 0.0),
                    latitude: satellite.degreesLat(satLatitude),
                    longitude: satellite.degreesLong(satLongitude),
                    position: {
                        x: parseFloat(positionEci.x),
                        y: parseFloat(positionEci.y),
                        z: parseFloat(positionEci.z),
                    },
                    height: satHeight,
                    countryCode: rowData.countryCode || "Unknown",
                    rcsSize: rowData.rcsSize || "Unknown",
                    launchSiteCode: rowData.launchSiteCode || "Unknown",
                    orbitalPeriod: parseFloat(rowData.orbitalPeriod || 0.0),
                };

                // console.info(rowData.tle[1], rowData.tle[2]);
                if (i % 100 == 1) {
                    // console.info(` row ${i}`);
                }
                fullDataset.push(satData);
            }
            totalNewVectors++;
        }
        rowNumber = totalNewVectors;

        let totalRecordCount = fullDataset.length;
        let recordIndex = 0;
        const recordsPerMessage = 1000;
        while (totalRecordCount > 0) {
            const subCount =
                totalRecordCount >= recordsPerMessage
                    ? recordsPerMessage
                    : totalRecordCount;
            const subSet = fullDataset.slice(
                recordIndex,
                recordIndex + subCount
            );

            encodeAndSend(subSet).catch(async (e) => {
                console.error(e);
            });

            recordIndex = recordIndex + subCount;
            totalRecordCount = totalRecordCount - subCount;
        }
        console.info(
            `${totalNewVectors} of ${result.length} results parsed, begin encoding`
        );

    }

};

const handleTleError = (err) => {
    console.error("tle error", err.stack);
};

const start = async () => {
    const schema = await readAVSCAsync(
        path.join(__dirname, process.env.TLE_SCHEMA)
    );
    storedSchema = await registry.register(schema); // { id: 2 }
    console.info("schema id", storedSchema);
    setInterval(() => {
        handleTleResult(Object.values(fullTleDataset));
    },12000);

    mainLoop();
};

const run = async () => {
    getLatestTLEs();
};

const mainLoop = () => {
    run()
        .then(() => {
            setTimeout(() => {
                mainLoop();
            }, process.env.POLLING_INTERVAL * 60 * 1000);
        })
        .catch(async (e) => {
            console.error(e);
        });
};

start();
