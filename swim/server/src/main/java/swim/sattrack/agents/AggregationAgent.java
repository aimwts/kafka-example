package swim.sattrack.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.api.lane.MapLane;
import swim.structure.Value;
import swim.uri.Uri;

/**
 * The AggregationAgent handles data which is aggregate across all
 * satellites including a list of all satellites
 */
public class AggregationAgent extends AbstractAgent {

    /**
     * List of all satellite WebAgents which have been created
     * The UI uses this to draw the satellites on the map.
     * The data is added and updated automatically by each
     * Satellite WebAgent when it gets its update.
     */
    @SwimLane("satelliteList")
    MapLane<String, Value> satelliteList = this.<String, Value>mapLane()
    .didUpdate((key, newValue, oldValue) -> {
        // System.out.println(newValue);
        // System.out.println(String.format("[AggregationAgent] satelliteList size: %s", this.satelliteList.size()));
    });

    /**
     * Command lane used by Satellite WebAgents to add/update
     * its data in the main satellite list.
     */
    @SwimLane("addSatellite")
    public CommandLane<Value> addSatellite = this.<Value>commandLane()
        .onCommand((Value newValue) -> {
          this.satelliteList.put(newValue.get("catalogNumber").stringValue(), newValue);
        });    

}