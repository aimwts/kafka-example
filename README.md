# Simple Kafka Consumer using Swim

## Overview
This is a demo showing how to consume data from Kafka with Swim and how to turn that data into stateful web agents.

In this example we will use NodeJS as a generic Kafka Producer which fetches satellite data from Space-Track.org on a regular interval and sends that data to a standard Kafka Broker running inside a Docker instance. 

From there we create Swim WebAgents act as a Kafka Consumer as well as Web Agents for every satellite currently being tracked by the API.


## Getting Started
### Requirements:
1. Java8+
2. NodeJS 12+
3. Git
4. Docker-Compose

### Configuration
* Consumer config handled by `TleMessagesAgent` definition in /swim/server/src/main/resources/server.recon
* Producer config handled by `.env` file in `/node/.env`. 

### Setup
1. Create a free account with Space-track.org in order to be able to query their API for satellite data
2. cd to `node/`
3. Copy `.env-example` to `.env`
4. Edit the `.env` file and enter the username and password for your Space-Track where shown.
5. run `npm install`

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

