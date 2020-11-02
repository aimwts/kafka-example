package swim.sattrack.agents.connectors;

import swim.sattrack.agents.connectors.KafkaAgent;
import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.structure.Value;
import swim.uri.Uri;

/**
 * The TleMessagesAgent is responsible for relaying
 * all the TLE data found on the Kafka Broker to each 
 * satellite WebAgent that the data is for.
 * This extends KafkaAgent which does the heavy lifting of
 * connecting to Kafka and getting data. The details of server
 * topic, schema, etc. are defined in the config for this agent 
 * in server.recon
 */
public class TleMessagesAgent extends KafkaAgent {
    static Long firstKey;
    Value vectorList;
    String catalogNumber;
    String newPath;
    int satellites;

    /**
     * Handle all the records the Kafka Broker found for this agent's topic.
     */
    @Override
    protected void processMessages() {
        System.out.println(String.format("[TleMessagesAgent] processMessages %s", this.recordList.size()));
        int rows = 0;
        this.satellites = 0;
        while(this.recordList.size() > 0) {
            this.firstKey = this.recordList.getIndex(0).getKey();
            this.vectorList = this.recordList.get(firstKey);

            this.vectorList.forEach(vector -> {

                catalogNumber = vector.get("catalogNumber").stringValue();
                newPath = String.format("/satellite/%s", catalogNumber);
                command(Uri.parse(newPath), Uri.parse("updateData"), Value.fromObject(vector));
                this.satellites++;
            });

            this.recordList.remove(firstKey);
            rows++;
        }        
        System.out.println(String.format("[TleMessagesAgent] processed %s and %s satellites", rows, this.satellites));
    }

}