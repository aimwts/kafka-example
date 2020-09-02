# Simple Kafka Consumer using Swim

## Overview
This is a demo showing how to consume data from Kafka with Swim and how to turn that data into stateful web agents.

API DataSource: https://www.space-track.org/

## Getting Started
### Requirements:
1. Java8+
2. NodeJS 12+
3. Git
4. Docker

### Configuration
* Consumer config handled by `TleMessagesAgent` definition in /swim/server/src/main/resources/server.recon
* Producer config handled by .env file in /node/.env. 

### Starting local Kafka Broker
This will spin up a Docker instance running a broker at port 9092 and schema manager at port 8081.
1. cd kafka
2. docker-compose up -d

### Starting NodeJS Kafka Producer
NodeJS acts as a Kafka Producer. It queries the latest TLE data from space-track.org, formats and encodes the result and sends that result and schema to the broker running in Docker
1. cd node
2. npm start

### Starting Swim Application Server
The application server acts as a Kafka Consumer and takes the satellite data from the broker and converts them to Satellite web agents.
1. cd swim
2. ./gradlew run
