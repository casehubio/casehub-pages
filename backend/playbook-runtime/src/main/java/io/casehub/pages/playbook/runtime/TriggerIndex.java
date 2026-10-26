package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ActivationTrigger;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TriggerIndex {

    public record TriggerBinding(
        String playbookName,
        ActivationTrigger.CloudEventTrigger trigger,
        String yaml
    ) {}

    public record CronBinding(
        String playbookName,
        ActivationTrigger.ScheduledTrigger trigger,
        String yaml
    ) {}

    private final Map<String, List<TriggerBinding>> cloudEventBindings;
    private final List<CronBinding> cronBindings;

    private TriggerIndex(Map<String, List<TriggerBinding>> cloudEventBindings,
                         List<CronBinding> cronBindings) {
        this.cloudEventBindings = Map.copyOf(cloudEventBindings);
        this.cronBindings = List.copyOf(cronBindings);
    }

    public List<TriggerBinding> matchCloudEvent(String eventType) {
        return cloudEventBindings.getOrDefault(eventType, List.of());
    }

    public List<CronBinding> cronBindings() {
        return cronBindings;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private final Map<String, List<TriggerBinding>> ce = new HashMap<>();
        private final List<CronBinding> cron = new ArrayList<>();

        public Builder add(String playbookName,
                           ActivationTrigger.CloudEventTrigger trigger,
                           String yaml) {
            ce.computeIfAbsent(trigger.eventType(), k -> new ArrayList<>())
              .add(new TriggerBinding(playbookName, trigger, yaml));
            return this;
        }

        public Builder addCron(String playbookName,
                               ActivationTrigger.ScheduledTrigger trigger,
                               String yaml) {
            cron.add(new CronBinding(playbookName, trigger, yaml));
            return this;
        }

        public TriggerIndex build() {
            return new TriggerIndex(ce, cron);
        }
    }
}
