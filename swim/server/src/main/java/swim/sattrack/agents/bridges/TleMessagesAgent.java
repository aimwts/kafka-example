package swim.sattrack.agents.bridges;

import swim.sattrack.agents.connectors.KafkaAgent;
import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.structure.Value;
import swim.uri.Uri;

public class TleMessagesAgent extends KafkaAgent {

    @Override
    protected void processMessages() {
        System.out.println("[TleMessagesAgent] processMessages");
        while(this.recordList.size() > 0) {
            Long firstKey = this.recordList.getIndex(0).getKey();
            Value vectorList = this.recordList.get(firstKey);

            // System.out.println(vectorList.getItem(0));
            vectorList.forEach(vector -> {
                // System.out.println(vector.get("name").stringValue());
                // System.out.println(vector.get("intlDesignator").stringValue());
                // System.out.println(vector.get("catalogNumber").stringValue());
                // System.out.println("------------");

                String catalogNumber = vector.get("intlDesignator").stringValue();
                String newPath = String.format("/satellite/%s", catalogNumber);
                // System.out.println("[KafkaAgent] update " + newPath);
                command(Uri.parse(newPath), Uri.parse("updateData"), Value.fromObject(vector));
            });

            this.recordList.remove(firstKey);
        }        
    }

}