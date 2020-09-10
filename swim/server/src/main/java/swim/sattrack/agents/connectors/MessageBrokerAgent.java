package swim.sattrack.agents.connectors;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.structure.Value;

/**
 * Base abstract class to handle connection states
 */
public abstract class MessageBrokerAgent extends AbstractAgent {

  @SwimLane("init")
  private CommandLane<Value> init = this.<Value>commandLane().onCommand(value -> {
    // System.out.println("[MessageBrokerAgent] init");    
  });

  @SwimLane("reconnect")
  private CommandLane<Value> reconnect = this.<Value>commandLane().onCommand(value -> {
    connect();
  });

  @SwimLane("disconnect")
  private CommandLane<Value> close = this.<Value>commandLane().onCommand(value -> {
    disconnect();
  });

  abstract protected void connect();

  abstract protected void disconnect();

  public void didStart() {
    // System.out.println("[MessageBrokerAgent] didStart");
    connect();
  }

  @Override
  public void willStop() {
    disconnect();
    super.willStop();
  }

  @Override
  public void didFail(Throwable error) {
    System.out.println("[MessageBrokerAgent] didFail");
    System.out.println(error);
  }

}