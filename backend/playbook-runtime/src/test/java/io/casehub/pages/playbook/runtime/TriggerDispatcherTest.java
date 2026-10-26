package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ActivationTrigger;
import io.casehub.pages.playbook.ActivationTrigger.RetriggerPolicy;
import io.casehub.pages.playbook.PlaybookContentParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TriggerDispatcherTest {

    private static final String YAML_WITH_TRIGGER = """
            playbook: fraud-response
            triggers:
              - type: cloud-event
                event-type: io.casehub.ras.situation
                filter:
                  situationType: fraud-detected
                on-retrigger: skip
            steps:
              - navigate: /dashboard
            """;

    private static final String YAML_WITH_QUEUE = """
            playbook: queue-playbook
            triggers:
              - type: cloud-event
                event-type: io.casehub.ras.situation
                filter:
                  situationType: fraud-detected
                on-retrigger: queue
                max-queued: 2
            steps:
              - navigate: /dashboard
            """;

    private StubAdapter orchestrator;
    private TriggerDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        orchestrator = new StubAdapter();
        var envelope = PlaybookContentParser.parse(YAML_WITH_TRIGGER);
        var builder = TriggerIndex.builder();
        for (var trigger : envelope.triggers()) {
            if (trigger instanceof ActivationTrigger.CloudEventTrigger ce) {
                builder.add(envelope.playbook(), ce, YAML_WITH_TRIGGER);
            }
        }
        dispatcher = new TriggerDispatcher(orchestrator, builder.build(), new ActivationLog(100));
    }

    @Test
    void activatesOnMatchingCloudEvent() {
        dispatcher.handleCloudEvent("io.casehub.ras.situation",
                Map.of("situationType", "fraud-detected"), null);

        assertThat(orchestrator.startedYaml).isNotNull();
        assertThat(orchestrator.lastTriggerSource)
                .isEqualTo("cloud-event:io.casehub.ras.situation");
    }

    @Test
    void skipsOnNonMatchingFilter() {
        dispatcher.handleCloudEvent("io.casehub.ras.situation",
                Map.of("situationType", "compliance"), null);

        assertThat(orchestrator.startedYaml).isNull();
    }

    @Test
    void skipsOnNonMatchingEventType() {
        dispatcher.handleCloudEvent("io.casehub.other", Map.of(), null);
        assertThat(orchestrator.startedYaml).isNull();
    }

    @Test
    void skipPolicyDropsRetrigger() {
        orchestrator.running = true;
        dispatcher.handleCloudEvent("io.casehub.ras.situation",
                Map.of("situationType", "fraud-detected"), null);

        assertThat(orchestrator.startedYaml).isNull();
        assertThat(dispatcher.activationLog().recent(10).get(0).outcome())
                .isEqualTo(ActivationOutcome.SKIPPED);
    }

    @Test
    void recordsActivation() {
        dispatcher.handleCloudEvent("io.casehub.ras.situation",
                Map.of("situationType", "fraud-detected"), null);

        var records = dispatcher.activationLog().recent(10);
        assertThat(records).hasSize(1);
        assertThat(records.get(0).outcome()).isEqualTo(ActivationOutcome.STARTED);
        assertThat(records.get(0).triggerType()).isEqualTo("cloud-event");
        assertThat(records.get(0).triggerDetail()).isEqualTo("io.casehub.ras.situation");
    }

    @Test
    void queuePolicyEnqueuesRetrigger() {
        var queueOrchestrator = new StubAdapter();
        queueOrchestrator.running = true;
        var envelope = PlaybookContentParser.parse(YAML_WITH_QUEUE);
        var builder = TriggerIndex.builder();
        for (var trigger : envelope.triggers()) {
            if (trigger instanceof ActivationTrigger.CloudEventTrigger ce) {
                builder.add(envelope.playbook(), ce, YAML_WITH_QUEUE);
            }
        }
        var queueDispatcher = new TriggerDispatcher(queueOrchestrator, builder.build(), new ActivationLog(100));

        queueDispatcher.handleCloudEvent("io.casehub.ras.situation",
                Map.of("situationType", "fraud-detected"), null);

        var records = queueDispatcher.activationLog().recent(10);
        assertThat(records).hasSize(1);
        assertThat(records.get(0).outcome()).isEqualTo(ActivationOutcome.QUEUED);
    }

    static class StubAdapter implements TriggerDispatcher.OrchestratorAdapter {
        String startedYaml;
        String lastTriggerSource;
        boolean running;

        @Override
        public void start(String yaml, String triggerSource) {
            startedYaml = yaml;
            lastTriggerSource = triggerSource;
            running = true;
        }

        @Override
        public boolean isRunning() { return running; }
    }
}
