# STM Montreal GTFS-RT to Solace Broker Connector

## Quick Overview

This software acts as a connector to turn the REST based STM GTFS-RT API into events via a Solace PubSub+ broker. The REST API is polled at a regular interval and any new events (since the last poll) are published to a Solace PubSub+ message broker using json encoding of the [GTFS-RT feed entities](https://developers.google.com/transit/gtfs-realtime/guides/feed-entities) and descriptive topics.

## Why Do This

Many reasons.

1. Polling sucks. Is this 2008? REST APIs are not a good fit for GTFS-RT. By definition, these are realtime events, and should use an eventing model. Polling introduces latency between when an event occurs and when the consumer learns about it. You can reduce latency by increasing the polling frequency, but at the cost of additional network bandwidth and CPU/memory usage on both the server and client.
2. The REST API returns the entire list of entities every time, whether they have changed or not. An eventing model allows you to only receive events when data has changed, saving network bandwidth and CPU/memory.
3. The Solace PubSub+ broker offers flexible filtering via [wildcards](https://docs.solace.com/PubSub-Basics/Wildcard-Charaters-Topic-Subs.htm) in  topic subscriptions. You can easily filter for routes, trips, vehicles and even geographical locations. This is not server based filtering, the broker does the heavy lifting for you.

We haven't even talked about the important concepts like high-availability and fan-out, which again, the broker does for you.

## Usage

### Setup

clone this repository then:

`npm install`

#### Get a free STM API Key

Get your [STM api key](http://www.stm.info/en/about/developers)

Set your STM api key

```
export STM_API_KEY=allworkandnoplaymakesjackadullboy
```

#### Get a Free Solace PubSub+ Broker

Signup for [Solace Cloud](https://console.solace.cloud/login/new-account)

Create a free develop service. Then set the following variables:

```
export BROKER_SMF_URL="wss://mrxxxxxxxx.messaging.solace.cloud:443"
export BROKER_USERNAME="solace-cloud-client"
export BROKER_PASSWORD="xxxxxxxxxxxx"
export BROKER_MSG_VPN="your-msg-vpn-name"
```

### Running the softare

`npm start` (to start the server in development mode)

`npm build` (to build the code)



## The Data

### Trip Update

The topic structure of the trip update event is:

`stm/bus/v1/tripUpdate/<routeId>/<tripId>`

Here is a sample payload:

```
{
  "trip": {
    "tripId": "213284799",
    "startTime": "12:26:00",
    "startDate": "20200123",
    "routeId": "48"
  },
  "stopTimeUpdate": [
    {
      "stopSequence": 46,
      "arrival": {
        "time": "1579803294"
      },
      "departure": {
        "time": "1579803420"
      },
      "stopId": "61606",
      "scheduleRelationship": "SCHEDULED"
    }
  ],
  "timestamp": "1579803203"
}
```

### Vehicle Position

The topic structure of the vehicle position event is:

`stm/bus/v1/vehiclePosition/<routeId>/<tripId>/<vehicleId>/<latitude>/<longitude>`

Here is a sample payload:
```
{
  "trip": {
    "tripId": "213373369",
    "startTime": "13:03:00",
    "startDate": "20200123",
    "routeId": "205"
  },
  "position": {
    "latitude": 45.501766204833984,
    "longitude": -73.84501647949219
  },
  "currentStopSequence": 23,
  "currentStatus": "IN_TRANSIT_TO",
  "timestamp": "1579803446",
  "vehicle": {
    "id": "22274"
  }
}
```
