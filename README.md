# Simple Kafka Consumer using Swim

## Overview
This is a demo showing how to consume data from Kafka with Swim and how to turn that data into stateful web agents.

In this example we will use NodeJS as a generic Kafka Producer which fetches satellite data from Space-Track.org on a regular interval and sends that data to a standard Kafka Broker running inside a Docker instance. From there we use Swim WebAgents to act as a Kafka Consumer as well as Web Agents for every satellite currently being tracked by the API.


## Getting Started
### Requirements:
1. Java 8+
2. NodeJS 12+
3. Git
4. Docker-Compose

### Configuration
* Consumer config handled by `TleMessagesAgent` definition in /swim/server/src/main/resources/server.recon
* Producer config handled by `.env` file in `/node/.env`. 

### Setup
1. Create a free account with [Space-track.org](https://www.space-track.org/auth/createAccount) in order to be able to query their API for satellite data
2. cd to `node/`
3. Copy `.env-example` to `.env`
4. Edit the `.env` file and enter the username and password for your Space-Track where shown.
5. run `npm install`
6. If you are using a different Kafka Broker, edit `server.recon` and update the config section of the TleMessagesAgent definition with the information for your Kafka Broker, Schema Server, and/or Topic.

### Starting the Demo
As stated above, this demo has three parts in order to run. The steps below will walk you thought starting up each part.

#### *Starting local Kafka Broker*
First we will spin up a Docker instance running a standard Kafka Broker at port 9092 and Schema Manager at port 8081.
1. cd `kafka/`
2. run `docker-compose up -d`

#### *Starting NodeJS Kafka Producer*
NodeJS acts as a Kafka Producer. It queries the latest TLE data from space-track.org, formats and encodes the result and sends that result and schema to the broker running in Docker. 
From the application root directory:
1. cd `node`
2. run `npm start`

#### *Starting Swim Application Server*
The application server acts as a Kafka Consumer and takes the satellite data from the broker and converts them to Satellite web agents. Swim also serves the UI on port 9001.
1. cd `swim/server/`
2. run `./gradlew run` for *nix or `gradlew.bat run` for windows


Once you have the Node JS Kafka Producer, the Kafka Broker, and your Swim application server running you should be able to open a browser to http://127.0.0.1:9001 and see a map. Due to long polling in NodeJS and our Kafka Consumer as well as the volume of data, it can take a few minutes for all the satellites to appear in the UI.

## Folder Structure
* /kafka - This holds the Avro Schema and a docker YAML file. The Avro Schema describes the format of the message being sent to the Broker from the Kafka Producer. The YAML file is used to run our Kafka Broker inside Docker. This just a standard Kafka Broker with nothing special done to it. This means you should be able to use any broker you like if you do not want use this one.
* /node - In this example we use NodeJS as our Kafka Producer. It will query the latest propagatable satellite data from space-track.org, encode that data with our Avro Schema and send the result to our Broker. Node will also propagate out the orbit for each satellite and send that along with the rest if the data in the 'tracks' field.
* /swim/server - This is our main Swim Server and acts as a number of things. First, it is a Kafka Consumer and takes the data in the messages we have sent to our Broker and turns that data into Web Agents. Next, it is the space where all our Web Agents run. You can find a description of those Web Agents below. Finally, our Swim server also acts as a Web Server and serves up our UI on the port defined in server.recon.
* /swim/ui - This is our web based UI that gets served by our Swim Server. It uses vanilla javascript and CSS along with our Swim UI Library and Swim Client to fetch all the satellite data from our Swim Server and map out that data in both 2D and 3D.

## Web Agents and Swim Application Structure

### Top level Application

A Swim Application exists on a Swim Plane. That Plane contains the Swim Kernel and a Space inside which our Web Agents run. In this demo that is handled in ApplicationPlane.java, and once setup and running you generally will not need to think about this again. In this java class notice we also initialize a few Web Agents on startup. Keep in mind that Web Agents are created automatically when first accessed and can perform actions on startup.

### Web Agents

* AggregationAgent - This Web Agent manages data which is aggregated across all tracked satellites including counts of various types of satellites and a list of all tracked satellites. The Web UI uses lanes from this agent to create the maps. On startup this agent prepoulates a few lanes so that the UI does not have to deal with null data on startup.
* SatelliteAgent - This Web Agents is used to track the state of an individual satellite. All data received from the broker for the given satellite is stored here. On startup this agent will report up to the AggregationAgent with a small subset of the full satellite date. This is how data in the AggregationAgent gets populated.

#### Kafka Connector Agents
* connector/KafkaAgent - This is a abstract agent which does the heavy lifting of creating a Kafka Consumer, connecting to a topic and polling that topic for new messages. Classes extending this class simply need to override `processMessages()` to handle messages received from the Broker and define a `config` in server.recon which tells the agent where the Kafka Broker is and what topic to listen on.
* connector/MessageBroker - This is an abstract agent which handles connect/disconnect/reconnect actions for an agent which is connection to another server in order to receive messages. KafkaAgent extends this class.
* connector/TleMessagesAgent - This Web Agent extends KafkaAgent and overrides `processMessages()` to receive and process the all TLE data received by the Kafka Consumer. Each TLE will be sent to the appropriate SatelliteAgent based on the catalogID. IF the agent does not exist it will be automatically created.


