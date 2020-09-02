open module swim.sattrack {
  requires transitive swim.api;
  requires swim.server;
  requires swim.client;
  requires swim.xml;

  requires io.confluent;
  requires org.apache.avro;
  exports swim.sattrack;
}
