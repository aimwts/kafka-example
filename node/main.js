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

    // for(let i=0; i<consecutiveFetches; i++) {
        const queryOptions = (options = {
            controller: "basicspacedata", // defaults to 'basicspacedata'
            action: "query", // defaults to 'query'
            type: "gp", // required, must be one of the following:
            // tle, tle_latest, tle_publish, omm, boxscore, satcat,
            // launch_site, satcat_change, satcat_debut, decay, tip, csm
    
            query: [
                { field: "DECAYED", condition: "0" },
                { field: "EPOCH", condition: ">now-1" },
                { field: "OBJECT_TYPE", condition: "<>TBA" }, // e.g. (see the API documentation)
                // optional, but highly recommended
            ],
    
            predicates: [  // optional

            ],
    
            // favorites: [  // optional
            //   'Navigation'
            // ],
    
            orderby: [
                // optional
                "NORAD_CAT_ID", // descending by NORAD_CAT_ID
            ],
    
            // limit: 5, // optional, but recommended
            // offset: rowsToFetch*i, // optional (needs limit to be set, otherwise limit defaults to 100)
    
            // distinct: true // optional (this option causes some hiccups)
        });
    
        spacetrack.get(queryOptions).then(handleTleResult, handleTleError);
    // }

};

const handleTleResult2 = (result) => {
    console.info(result);
}

const handleTleResult = (result) => {
    console.info(`received tle results ${result.length}`);
    // console.log(util.inspect(result, { colors: true, depth: null }));

    const fullDataset = [];
    let totalNewVectors = 0;
    const maxResults = (result.length > 16000) ? 16000 : result.length

    // the raw result data is all strings, so convert to proper data types to match the AVRO schema
    for (let i = 0; i < maxResults; i++) {
        const rowData = result[i];

        const gmst = satellite.gstime(new Date());
        const satrec = satellite.twoline2satrec(rowData.tle[1], rowData.tle[2]);
        const positionAndVelocity = satellite.propagate(satrec, new Date());
        const positionEci = positionAndVelocity.position;
        // const velocityEci = positionAndVelocity.velocity;
        if(!positionEci) {
            // console.info(satrec);
            return;
        }
        const positionGd    = satellite.eciToGeodetic(positionEci, gmst);
        const satLongitude = positionGd.longitude;
        const satLatitude  = positionGd.latitude;
        const satHeight    = positionGd.height;        


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
                z: parseFloat(positionEci.z)
            },
            height: satHeight,
            countryCode: rowData.countryCode || "Unknown",
            rcsSize: rowData.rcsSize || "Unknown",
            launchSiteCode: rowData.launchSiteCode || "Unknown",
            orbitalPeriod: parseFloat(rowData.orbitalPeriod || 0.0)
        };

        // console.info(rowData.tle[1], rowData.tle[2]);
        if(i%100 == 1) {
            // console.info(` row ${i}`);
        }
        fullDataset.push(satData);
        totalNewVectors++;
    }

    console.info(`${totalNewVectors} of ${fullDataset.length} results parsed, begin encoding`);
    //


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
        await producer
            .send({
                topic: process.env.KAFKA_TOPIC,
                messages: [outgoingMessage],
            })
            .then(() => {
                console.info("send complete");
            });
    };

    let totalRecordCount = fullDataset.length;
    let recordIndex = 0;
    const recordsPerMessage = 1000;
    while(totalRecordCount > 0) {
        const subCount = (totalRecordCount >= recordsPerMessage) ? recordsPerMessage : totalRecordCount;
        const subSet = fullDataset.slice(recordIndex, (recordIndex+subCount));

        encodeAndSend(subSet).catch(async (e) => {
            console.error(e);
        });

        recordIndex = recordIndex + subCount;
        totalRecordCount = totalRecordCount - subCount;
    }
    
    // encodeAndSend().catch(async (e) => {
    //     console.error(e);
    // });
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

