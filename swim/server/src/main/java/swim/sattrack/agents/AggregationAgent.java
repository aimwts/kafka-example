package swim.sattrack.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.api.lane.MapLane;
import swim.structure.Value;
import swim.uri.Uri;

public class AggregationAgent extends AbstractAgent {

    @SwimLane("satelliteList")
    MapLane<String, Value> satelliteList = this.<String, Value>mapLane()
    .didUpdate((key, newValue, oldValue) -> {
        // System.out.println(newValue);
        // System.out.println(String.format("[AggregationAgent] satelliteList size: %s", this.satelliteList.size()));
    });

    @SwimLane("addSatellite")
    public CommandLane<Value> addSatellite = this.<Value>commandLane()
        .onCommand((Value newValue) -> {
          this.satelliteList.put(newValue.get("catalogNumber").stringValue(), newValue);
        });    

}