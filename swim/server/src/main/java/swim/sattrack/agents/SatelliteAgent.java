package swim.sattrack.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.api.lane.MapLane;
import swim.structure.Value;
import swim.structure.Record;
import swim.uri.Uri;

/**
 * A Satellite Agent is a stateful twin of a given satellite 
 * in space catalog. Satellite Agents are created automatically by 
 * the TleMessagesAgent when it receives new data from the 
 * Space-Track.org API via our Swim Kafka Connector. 
 *
 */
public class SatelliteAgent extends AbstractAgent {

  final private int HISTORY_SIZE = 100; // max number of tracks to keep
  private Value agentConfig; // will hold agent config values from server.recon
  private String swimUrl; 

  @SwimLane("catalogNumber")
  protected ValueLane<Value> catalogNumber;

  @SwimLane("name")
  protected ValueLane<Value> name;

  @SwimLane("latitude")
  protected ValueLane<Value> latitude;

  @SwimLane("longitude")
  protected ValueLane<Value> longitude;

  /**
   * lane which hold all of the data returned from API for this satellite
   */
  @SwimLane("fullRowData")
  protected ValueLane<Value> fullRowData;

  /**
   * rough predictions of where the satellite is and will be
   */
  @SwimLane("tracks")
  protected MapLane<Long, Value> tracks = this.<Long, Value>mapLane()
    .didUpdate((key, newValue, oldValue) -> {
      if (this.tracks.size() > HISTORY_SIZE) {
        this.tracks.remove(this.tracks.getIndex(0).getKey());
      }
    });

  /**
   * place to hold the raw TLE String array for later use
   * The TLEs are 3 line and so line 0 is the satellite name
   */
  @SwimLane("tle")
  protected ValueLane<Value> tle;  

  /**
    Value Lane which holds the last update timestamp
   */
  @SwimLane("lastUpdate")
  protected ValueLane<Long> lastUpdate = this.<Long>valueLane();  

  /**
   * command lane used to update satellite data
   * This data comes from Kafka and so the structure matches
   * the schema in /kafka/tle.avsc
   */
  @SwimLane("updateData")
  public CommandLane<Value> updateData = this.<Value>commandLane()
      .onCommand((Value newValue) -> {
        if(!newValue.equals(Value.absent()) && newValue != null) {
          this.updateSatellite(newValue);
        }
      });      
    
  /**
   * Method to parse out the data sent from kafka
   */
  private void updateSatellite(Value stateData) {
    long timestamp = System.currentTimeMillis();

    this.fullRowData.set(stateData); // store new state data on fullState Value Lane
    this.catalogNumber.set(stateData.get("catalogNumber"));
    this.name.set(stateData.get("name"));
    this.latitude.set(stateData.get("latitude"));
    this.longitude.set(stateData.get("longitude"));
    this.tle.set(stateData.get("tle"));

    Value currentTrackPoint = Record.create(2)
      .slot("lat", stateData.get("latitude").floatValue(0f))
      .slot("lng", stateData.get("longitude").floatValue(0f))
      .toValue();
  
    this.tracks.put(timestamp, currentTrackPoint);    

    // create record of info to send to aggregation agent for this satellite
    Record shortInfo = Record.create()
      .slot("name", stateData.get("name"))
      .slot("catalogNumber", stateData.get("catalogNumber"))
      .slot("intlDesignator", stateData.get("intlDesignator"))
      .slot("type", stateData.get("type"))
      .slot("orbitalPeriod", stateData.get("orbitalPeriod"))
      .slot("tle", stateData.get("tle"))
      .slot("file", stateData.get("file"))
      .slot("position", stateData.get("position"))
      .slot("height", stateData.get("height"))
      .slot("latitude", stateData.get("latitude"))
      .slot("longitude", stateData.get("longitude"))
      .slot("countryCode", stateData.get("countryCode"))
      .slot("rcsSize", stateData.get("rcsSize"))
      .slot("revolutionsAtEpoch", stateData.get("revolutionsAtEpoch"))
      .slot("launchSiteCode", stateData.get("launchSiteCode"));

    // send into to aggregation
    try {
      // System.out.println(this.swimUrl);
      command(Uri.parse(this.swimUrl), Uri.parse("/aggregation"), Uri.parse("addSatellite"), shortInfo); 
    } catch(Exception ex) {
      // TODO: find out why this throws a null pointer sometimes when data first starts coming in
      // the null pointers do not seem to affect anything
      // ex.printStackTrace();
      System.out.println("error sending to agg");
      System.out.println(ex);
    }
    
    this.lastUpdate.set(timestamp); // update lastUpdate Value Lane

  }


  /**
    Standard startup method called automatically when WebAgent is created
   */
  @Override
  public void didStart() {
    this.agentConfig = getProp("config"); // grab config value for this agent from server.recon
    this.swimUrl = this.agentConfig.get("swimUrl").stringValue(); //update our swim url
  }

}