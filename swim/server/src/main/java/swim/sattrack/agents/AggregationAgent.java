package swim.sattrack.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.api.lane.MapLane;
import swim.structure.Record;
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
    MapLane<String, Value> satelliteList = this.<String, Value>mapLane();

    @SwimLane("satellitesTypeCount")
    MapLane<String, Record> satellitesTypeCount = this.<String, Record>mapLane();

    @SwimLane("satellitesByCountry")
    MapLane<String, Record> satellitesByCountry = this.<String, Record>mapLane();

    @SwimLane("payloadList")
    MapLane<String, Value> payloadList = this.<String, Value>mapLane()
      .didUpdate((k, n, o) -> {
        Value typeRecord = this.satellitesTypeCount.get("payload");
        Integer typeCount = typeRecord.get("count").intValue(0);
        if(typeCount != this.payloadList.size()) {
          Record newCount = Record.create(2)
            .slot("name", "Payload")
            .slot("count", this.payloadList.size());
          this.satellitesTypeCount.put("payload", newCount);
        }        
        
      });    

    @SwimLane("debrisList")
    MapLane<String, Value> debrisList = this.<String, Value>mapLane()
      .didUpdate((k, n, o) -> {
        Value typeRecord = this.satellitesTypeCount.get("debris");
        Integer typeCount = typeRecord.get("count").intValue(0);
        if(typeCount != this.debrisList.size()) {
          Record newCount = Record.create(2)
            .slot("name", "Debris")
            .slot("count", this.debrisList.size());
          this.satellitesTypeCount.put("debris", newCount);
        }        
      });    

    @SwimLane("rocketBodyList")
    MapLane<String, Value> rocketBodyList = this.<String, Value>mapLane()
      .didUpdate((k, n, o) -> {
        Value typeRecord = this.satellitesTypeCount.get("rocketBody");
        Integer typeCount = typeRecord.get("count").intValue(0);
        if(typeCount != this.rocketBodyList.size()) {
          Record newCount = Record.create(2)
            .slot("name", "Rocket Body")
            .slot("count", this.rocketBodyList.size());
          this.satellitesTypeCount.put("rocketBody", newCount);
        }        
      });    
        
    /**
     * Command lane used by Satellite WebAgents to add/update
     * its data in the main satellite list.
     */
    @SwimLane("addSatellite")
    public CommandLane<Value> addSatellite = this.<Value>commandLane()
        .onCommand((Value newValue) -> {
          // System.out.println("[AggregationAgent] add sat");
          String catId = newValue.get("catalogNumber").stringValue();
          Value currSat = this.satelliteList.get(catId);
          if(currSat == Value.absent()) {
            String satType = newValue.get("type").stringValue();
            switch(satType) {
              case "PAYLOAD":
                this.payloadList.put(catId, newValue);
                break;
              case "DEBRIS":
                this.debrisList.put(catId, newValue);
                break;
              default:
                this.rocketBodyList.put(catId, newValue);
                break;

            }
            // System.out.println(newValue);
            String countryCode = newValue.get("countryCode").stringValue("Unknown");
            Value currCountryValue = this.satellitesByCountry.get(countryCode);
            Integer countryCount = currCountryValue.get("count").intValue(0) + 1;
            Record newCount = Record.create(2)
              .slot("name", countryCode)
              .slot("count", countryCount);
            this.satellitesByCountry.put(countryCode, newCount);           
            
          }    
          
          this.satelliteList.put(catId, newValue);  
        });    
         
}