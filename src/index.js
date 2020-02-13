import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import request from 'request-promise-native';
import solace from 'solclientjs';
import { TopicPublisher } from './TopicPublisher';

let topicPublisher = {};
let theTimeout;

const STM_API_KEY = process.env.STM_API_KEY;
const url = process.env.BROKER_SMF_URL;
const username = process.env.BROKER_USERNAME;
const password = process.env.BROKER_PASSWORD;
const msgVpn = process.env.BROKER_MSG_VPN;

async function startBrokerConnection(connectedCallback, failureCallback) {

    // Sleep for a few seconds (helps with nodemon retry)
    await sleep(4000);

    var factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10;
    solace.SolclientFactory.init(factoryProps);
    // enable logging to JavaScript console at WARN level
    // NOTICE: works only with "solclientjs-debug.js"
    solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

    topicPublisher = TopicPublisher(url, username, password, msgVpn);
    topicPublisher.connect(connectedCallback, failureCallback);

    // Handle ^C from user
    process.on('SIGINT', function () {
        console.log("Existing topic publisher");
        topicPublisher.disconnect();
        clearTimeout(theTimeout);
    });

    // Handle nodemon restarts
    process.on('SIGUSR2', function () {
        console.log("Existing topic publisher");
        topicPublisher.disconnect();
        clearTimeout(theTimeout);
    }); 
}

async function startPollingForBusData() {
    let lastVehiclePositionTimestamp = 0;
    let lastTripUpdateTimestamp = 0;
    while (true) {
        lastVehiclePositionTimestamp = await publishVehiclePositions(lastVehiclePositionTimestamp);
        await sleep(16000);
        // lastTripUpdateTimestamp = await publishTripUpdates(lastTripUpdateTimestamp);
        // await sleep(16000);
    }
}

async function getVehiclePositionResponse() {
    var requestSettings = {
        method: 'POST',
        url: 'https://api.stm.info/pub/od/gtfs-rt/ic/v1/vehiclePositions',
        encoding: null,
        headers: {
            'Content-Type': 'application/json',
            'apikey': STM_API_KEY
        }
    };

    return await request(requestSettings);
}

const sleep = (milliseconds) => {
    return new Promise(resolve => theTimeout = setTimeout(resolve, milliseconds))
}
  
async function publishVehiclePositions(lastTimestamp = 0) {
    console.log("Using Last timestamp for Vehicle Position", lastTimestamp);
    let sendCount = 0;
    let filteredCount = 0;

    const body = await getVehiclePositionResponse();
    var feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(body);
    //console.log(feed);
    //console.log("Current Timestamp", feed.header.timestamp.low);
    //console.log("Is deleted?", feed.entity[0].isDeleted);
    //console.log("Vehicle", JSON.stringify(feed.entity[0].vehicle, null, 2));
    for (let index = 0; index < feed.entity.length; index++) {
        const entity = feed.entity[index];
        if (entity.vehicle) {
            if (entity.vehicle.timestamp < lastTimestamp) {
                filteredCount++;
            } else {
                const topic = "stm/bus/v1/vehiclePosition/" + entity.vehicle.trip.routeId
                + "/" + entity.vehicle.trip.tripId + "/" + entity.vehicle.vehicle.id
                + "/" + entity.vehicle.position.latitude + "/" + entity.vehicle.position.longitude;
                await sendMessageWithRetry(topic, JSON.stringify(entity.vehicle));
                sendCount++;
            }
        }
    }
    console.log("Sent", sendCount);
    console.log("Filtered", filteredCount);

    const timestamp = feed.header.timestamp;
    if (typeof timestamp === 'object' && timestamp !== null) {
        return timestamp.low;
    }
    return timestamp;
}

async function getTripUpdatesResponse() {
    var requestSettings = {
        method: 'POST',
        url: 'https://api.stm.info/pub/od/gtfs-rt/ic/v1/tripUpdates',
        encoding: null,
        headers: {
            'Content-Type': 'application/json',
            'apikey': STM_API_KEY
        }
    };

    return await request(requestSettings);
}

async function publishTripUpdates(lastTimestamp = 0) {
    console.log("Using Last timestamp for Trip Update", lastTimestamp);
    let sendCount = 0;
    let filteredCount = 0;


    const body = await getTripUpdatesResponse();
    var feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(body);
    //console.log(feed);
    console.log("Current Timestamp", feed.header.timestamp.low);
    // console.log("Is deleted?", feed.entity[0].isDeleted);
    // console.log(JSON.stringify(feed.entity[0].tripUpdate, null, 2));
    for (let index = 0; index < feed.entity.length; index++) {
        const entity = feed.entity[index];
        if (entity.tripUpdate) {
            if (entity.tripUpdate.timestamp < lastTimestamp) {
                filteredCount++;
            } else {
                const topic = "stm/bus/v1/tripUpdate/" + entity.tripUpdate.trip.routeId
                   + "/" + entity.tripUpdate.trip.tripId;
                await sendMessageWithRetry(topic, JSON.stringify(entity.tripUpdate));
                sendCount++;
            }
        }
    }

    console.log("Sent", sendCount);
    console.log("Filtered", filteredCount);

    const timestamp = feed.header.timestamp;
    if (typeof timestamp === 'object' && timestamp !== null) {
        return timestamp.low;
    }
    return timestamp;
    

}

async function sendMessageWithRetry(topic, message, maxPublishAttempts = 3, delayBetweenRetriesMs = 100) {
    let currentTry = 1;
    let retry = false;
    try {
        while (currentTry <= maxPublishAttempts) {
            if (currentTry > 1) {
                console.log("Retrying...");
                retry = true;
            }
            if (!topicPublisher.publish(topic, message)) {
                await sleep(delayBetweenRetriesMs);
            } else {
                // We're good, message sent, return
                if (retry) {
                    console.log("Retry successful");
                }
                return;
            }
            currentTry++;
        }
        console.error("Failed to send after retries");
    } catch (error) {
        console.error(error);
    }
}

startBrokerConnection(startPollingForBusData);
