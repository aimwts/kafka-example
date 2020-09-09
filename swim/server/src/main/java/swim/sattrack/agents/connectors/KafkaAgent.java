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

public abstract class KafkaAgent extends MessageBrokerAgent {

    private Consumer<Long, GenericRecord> consumer;
    private Value agentConfig;
    private boolean isRunning = true;

    @SwimLane("recordList")
    public MapLane<Long, Value> recordList = this.<Long, Value>mapLane();

    protected void connect() {
        System.out.println("[KafkaAgent] connect");

        String servers = this.agentConfig.get("servers").stringValue();
        String topic = this.agentConfig.get("topic").stringValue();
        String schemaUrl = this.agentConfig.get("schemaUrl").stringValue();
        String groupIdConfig = this.agentConfig.get("groupIdConfig").stringValue();

        final Properties kafkaProps = new Properties();
        kafkaProps.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, servers);
        kafkaProps.put(ConsumerConfig.GROUP_ID_CONFIG, groupIdConfig);
        kafkaProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest");
        kafkaProps.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");
        kafkaProps.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        kafkaProps.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class.getName());
        kafkaProps.put("schema.registry.url", schemaUrl);

        this.consumer = new KafkaConsumer<>(kafkaProps);
        this.consumer.subscribe(Collections.singletonList(topic));
        
        runConsumer();
    }

    protected void disconnect() {
        this.consumer.close();
       
    }
 
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

    private void runConsumer() {
        System.out.println("[KafkaAgent] runConsumer");
        // executor.execute(() -> {
            // final long[] count = {0L};
            
            while (this.isRunning) {
                final ConsumerRecords<Long, GenericRecord> records = this.consumer.poll(this.agentConfig.get("pollInterval").intValue());
                System.out.println(String.format("[KafkaAgent] check for records %s", records.count()));
                for (ConsumerRecord<Long, GenericRecord> rec : records) {

                    // executor.execute(() -> {
                        records.forEach(record -> {
                            // final String genericRecord = ;
                            this.handleRecord(rec.value().get("tleDataset").toString());
                            // final long timestamp = System.currentTimeMillis();
                            // final String genericRecord = rec.value().get("tleDataset").toString();
                            // InputStream targetStream = new ByteArrayInputStream(genericRecord.getBytes());
                            // try {
                            //     final Value recordValue = Utf8.read(Json.parser(), targetStream);
                            //     this.recordList.put(timestamp, recordValue);
    
                            // } catch(Exception ex) {
                            //     ex.printStackTrace();
                            // }
                        });                    

                        

                    // });
                }
                this.consumer.commitAsync();
                if(this.recordList.size() > 0) {
                    this.processMessages();
                }
                
            }
        // });
    }

    private void handleRecord(String genericRecord) {
        final long timestamp = System.currentTimeMillis();
        // final String genericRecord = record.value().get("tleDataset").toString();
        InputStream targetStream = new ByteArrayInputStream(genericRecord.getBytes());
        try {
            final Value recordValue = Utf8.read(Json.parser(), targetStream);
            this.recordList.put(timestamp, recordValue);

        } catch(Exception ex) {
            ex.printStackTrace();
        }
    }

    abstract protected void processMessages();

}