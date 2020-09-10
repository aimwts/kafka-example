package swim.sattrack;


import swim.api.space.Space;
import swim.api.SwimRoute;
import swim.api.agent.AgentRoute;
import swim.api.plane.AbstractPlane;
import swim.client.ClientRuntime;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.structure.Value;
import swim.structure.Record;
import swim.uri.Uri;

/**
  The ApplicationPlane is the top level of the app.
  This is where we define our Swim Kernel and Swim Space.
 */
public class ApplicationPlane extends AbstractPlane {

  public static void main(String[] args) throws InterruptedException {
    
    final Kernel kernel = ServerLoader.loadServer();
    final Space space = (Space) kernel.getSpace("sattrack");

    kernel.start();
    System.out.println("Running Satellite Tracker Plane...");
    kernel.run();

    space.command(Uri.parse("/aggregation"), Uri.parse("start"), Value.absent());
    space.command(Uri.parse("/layoutManager"), Uri.parse("start"), Value.absent());
    space.command(Uri.parse("/bridges/tleMessagesAgent"), Uri.parse("init"), Value.absent());

  }
}
