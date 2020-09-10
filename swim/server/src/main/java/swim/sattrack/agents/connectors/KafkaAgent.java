package swim.sattrack.agents.connectors;

import swim.sattrack.agents.connectors.MessageBrokerAgent;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.Executor;
import org.apache.avro.Schema;
import org.apache.avro.generic.GenericRecord;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.agent.AgentContext;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.api.lane.MapLane;
import swim.structure.Value;
import swim.structure.Record;
import swim.json.Json;
import swim.codec.Utf8;
import swim.uri.Uri;

/**
 * A KafkaAgent is a generic WebAgent which can be used to 
 * create a Kafka Broker and ingest data for a specific topic.
 * KafkaAgent extends MessageBrokerAgent which takes care of 
 * the connection state of the WebAgent
 */
public abstract class KafkaAgent extends MessageBrokerAgent {

    private Consumer<Long, GenericRecord> consumer;
    private Value agentConfig;
    private boolean isRunning = true;

    /**
     * place to hold records found for the kafka topic
     * the agent extending this class will handle the records found here
     */
    @SwimLane("recordList")
    public MapLane<Long, Value> recordList = this.<Long, Value>mapLane();

    /**
     * handle connecting to kafka topic
     */
    protected void connect() {
        System.out.println("[KafkaAgent] connect");

        // define our connection values
        String servers = this.agentConfig.get("servers").stringValue();
        String topic = this.agentConfig.get("topic").stringValue();
        String schemaUrl = this.agentConfig.get("schemaUrl").stringValue();
        String groupIdConfig = this.agentConfig.get("groupIdConfig").stringValue();

        // create our kakfa properties object to be used by the consumer
        final Properties kafkaProps = new Properties();
        kafkaProps.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers);
        kafkaProps.put(ConsumerConfig.GROUP_ID_CONFIG, groupIdConfig);
        kafkaProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest");
        kafkaProps.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");
        kafkaProps.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        kafkaProps.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class.getName());
        kafkaProps.put("schema.registry.url", schemaUrl);

        // create a new kafka consumer and subscribe to our topic
        this.consumer = new KafkaConsumer<>(kafkaProps);
        this.consumer.subscribe(Collections.singletonList(topic));
        
        // start our consumer
        runConsumer();
    }

    /**
     * handle disconnect
     */
    protected void disconnect() {
        this.consumer.close();
       
    }

    /**
     * This method sets up a long polling loop which 
     * has the consumer poll for new record from  the topic. 
     * New Records are converted to JSON and added to the recordsList map lane
     */
    private void runConsumer() {
        System.out.println("[KafkaAgent] runConsumer");
        String recordKey = this.agentConfig.get("recordKey").stringValue();
        while (this.isRunning) {
            final ConsumerRecords<Long, GenericRecord> records = this.consumer.poll(this.agentConfig.get("pollInterval").intValue());
            System.out.println(String.format("[KafkaAgent] check for records %s", records.count()));
            for (ConsumerRecord<Long, GenericRecord> rec : records) {

                records.forEach(record -> {
                    this.handleRecord(rec.value().get(recordKey).toString());
                });                    
            }
            this.consumer.commitAsync();
            if(this.recordList.size() > 0) {
                this.processMessages();
            }
            
        }
    }

    /**
     * convert a record to JSON and add to map lane
     */
    private void handleRecord(String genericRecord) {
        final long timestamp = System.currentTimeMillis();
        InputStream targetStream = new ByteArrayInputStream(genericRecord.getBytes());
        try {
            final Value recordValue = Utf8.read(Json.parser(), targetStream);
            this.recordList.put(timestamp, recordValue);

        } catch(Exception ex) {
            ex.printStackTrace();
        }
    }

    /**
     * abstract class used by parent class to parse 
     * new records out of the recordList map lane.
     * Called automatically by consumer when there are new records.
     */
    abstract protected void processMessages();

 
    @Override
    public void didStart() {
        System.out.println("[KafkaAgent] didStart");
        this.agentConfig = getProp("config");
        this.isRunning = true;
        super.didStart();
    }    

    @Override
    public void willStop() {
       
        this.isRunning = false;
        super.willStop();
    }


}