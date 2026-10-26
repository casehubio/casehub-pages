package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ActivationTrigger;
import io.casehub.pages.playbook.PlaybookContentParser;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.ObservesAsync;
import jakarta.inject.Inject;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.scheduler.Scheduled;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoField;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class TriggerDispatcher {

    interface OrchestratorAdapter {
        boolean isRunning();
        void start(String yaml, String triggerSource);
    }

    private final OrchestratorAdapter adapter;
    private volatile TriggerIndex index;
    private final ActivationLog activationLog;
    private final ConcurrentHashMap<String, ActivationQueue> queues = new ConcurrentHashMap<>();
    private final Object activationLock = new Object();
    private final ConcurrentHashMap<String, Long> cronLastFiredMinute = new ConcurrentHashMap<>();

    @Inject ScriptRegistry registry;

    @Inject
    public TriggerDispatcher(PlaybookOrchestrator orchestrator) {
        this.adapter = new OrchestratorAdapter() {
            @Override public boolean isRunning() {
                return orchestrator.state().playbook() != null;
            }
            @Override public void start(String yaml, String triggerSource) {
                orchestrator.start(yaml, triggerSource);
            }
        };
        this.index = TriggerIndex.builder().build();
        this.activationLog = new ActivationLog(1000);
    }

    TriggerDispatcher(OrchestratorAdapter adapter, TriggerIndex index, ActivationLog activationLog) {
        this.adapter = adapter;
        this.index = index;
        this.activationLog = activationLog;
    }

    void onStartup(@Observes StartupEvent event) {
        rebuildIndex();
    }

    public void rebuildIndex() {
        if (registry == null) return;
        var builder = TriggerIndex.builder();
        for (var desc : registry.list(List.of(), List.of())) {
            if (!"active".equals(desc.state())) continue;
            registry.getYaml(desc.name()).ifPresent(yaml -> {
                try {
                    var envelope = PlaybookContentParser.parse(yaml);
                    for (var trigger : envelope.triggers()) {
                        if (trigger instanceof ActivationTrigger.CloudEventTrigger ce) {
                            builder.add(desc.name(), ce, yaml);
                        } else if (trigger instanceof ActivationTrigger.ScheduledTrigger sched) {
                            builder.addCron(desc.name(), sched, yaml);
                        }
                    }
                } catch (Exception ignored) {}
            });
        }
        this.index = builder.build();
    }

    void onRegistryChange(@Observes ScriptRegistryChangeEvent event) {
        rebuildIndex();
    }

    void onCompletion(@ObservesAsync PlaybookCompletionEvent event) {
        drainNextFromAnyQueue();
    }

    void handleCloudEvent(String eventType, Map<String, Object> data, String source) {
        var bindings = index.matchCloudEvent(eventType);
        for (var binding : bindings) {
            if (!CloudEventFilter.matches(binding.trigger().filter(), data)) continue;
            if (binding.trigger().source() != null
                    && !binding.trigger().source().equals(source)) continue;
            tryActivate(binding.playbookName(), binding.yaml(), binding.trigger(),
                    "cloud-event:" + eventType, data);
        }
    }

    @Scheduled(every = "60s")
    void evaluateCronTriggers() {
        var now = ZonedDateTime.now(ZoneOffset.UTC);
        long currentMinute = now.getLong(ChronoField.EPOCH_DAY) * 1440L + now.getHour() * 60L + now.getMinute();
        for (var binding : index.cronBindings()) {
            String key = binding.playbookName() + ":" + binding.trigger().cron();
            Long lastFired = cronLastFiredMinute.get(key);
            if (lastFired != null && lastFired == currentMinute) continue;
            if (cronMatchesNow(binding.trigger().cron(), now)) {
                cronLastFiredMinute.put(key, currentMinute);
                tryActivate(binding.playbookName(), binding.yaml(), binding.trigger(),
                        "cron:" + binding.trigger().cron(), null);
            }
        }
    }

    static boolean cronMatchesNow(String cron, ZonedDateTime now) {
        String[] parts = cron.trim().split("\\s+");
        if (parts.length < 5) return false;
        int minute = now.getMinute();
        int hour = now.getHour();
        int dayOfMonth = now.getDayOfMonth();
        int month = now.getMonthValue();
        int dayOfWeek = now.getDayOfWeek().getValue() % 7;
        int offset = parts.length >= 6 ? 1 : 0;
        return fieldMatches(parts[offset], minute, 0, 59)
                && fieldMatches(parts[offset + 1], hour, 0, 23)
                && fieldMatches(parts[offset + 2], dayOfMonth, 1, 31)
                && fieldMatches(parts[offset + 3], month, 1, 12)
                && (parts[offset + 4].equals("?") || fieldMatches(parts[offset + 4], dayOfWeek, 0, 6));
    }

    private static boolean fieldMatches(String field, int value, int min, int max) {
        if (field.equals("*") || field.equals("?")) return true;
        for (String part : field.split(",")) {
            if (part.contains("/")) {
                String[] stepParts = part.split("/");
                int step = Integer.parseInt(stepParts[1]);
                int start = stepParts[0].equals("*") ? min : Integer.parseInt(stepParts[0]);
                for (int v = start; v <= max; v += step) {
                    if (v == value) return true;
                }
            } else if (part.contains("-")) {
                String[] rangeParts = part.split("-");
                int lo = Integer.parseInt(rangeParts[0]);
                int hi = Integer.parseInt(rangeParts[1]);
                if (value >= lo && value <= hi) return true;
            } else {
                if (Integer.parseInt(part) == value) return true;
            }
        }
        return false;
    }

    private void tryActivate(String playbookName, String yaml,
                             ActivationTrigger trigger, String triggerSource,
                             Map<String, Object> eventData) {
        synchronized (activationLock) {
            boolean running = isRunning();
            if (running) {
                if (trigger.retriggerPolicy() == ActivationTrigger.RetriggerPolicy.SKIP) {
                    record(playbookName, triggerSource, eventData, ActivationOutcome.SKIPPED);
                    return;
                }
                var queue = queues.computeIfAbsent(playbookName,
                        k -> new ActivationQueue(trigger.maxQueued()));
                var pending = new PendingActivation(playbookName, yaml, trigger, Instant.now());
                if (queue.offer(pending)) {
                    record(playbookName, triggerSource, eventData, ActivationOutcome.QUEUED);
                } else {
                    record(playbookName, triggerSource, eventData, ActivationOutcome.QUEUE_FULL);
                }
                return;
            }
            doStart(yaml, triggerSource);
            record(playbookName, triggerSource, eventData, ActivationOutcome.STARTED);
        }
    }

    private boolean isRunning() {
        return adapter.isRunning();
    }

    private void doStart(String yaml, String triggerSource) {
        adapter.start(yaml, triggerSource);
    }

    private void drainNextFromAnyQueue() {
        synchronized (activationLock) {
            while (true) {
                PendingActivation oldest = null;
                String oldestKey = null;
                for (var entry : queues.entrySet()) {
                    var candidate = entry.getValue().peek();
                    if (candidate != null &&
                            (oldest == null || candidate.enqueuedAt().isBefore(oldest.enqueuedAt()))) {
                        oldest = candidate;
                        oldestKey = entry.getKey();
                    }
                }
                if (oldest == null || oldestKey == null) return;
                var polled = queues.get(oldestKey).poll();
                if (polled == null) return;
                if (registry != null) {
                    var desc = registry.get(polled.playbookName());
                    if (desc.isPresent() && !"active".equals(desc.get().state())) {
                        record(polled.playbookName(),
                                triggerTypeString(polled.trigger()) + ":" +
                                triggerDetailString(polled.trigger()),
                                null, ActivationOutcome.LIFECYCLE_BLOCKED);
                        continue;
                    }
                }
                String source = triggerTypeString(polled.trigger()) + ":" +
                        triggerDetailString(polled.trigger());
                doStart(polled.yaml(), source);
                record(polled.playbookName(), source, null, ActivationOutcome.STARTED);
                return;
            }
        }
    }

    private void record(String playbookName, String triggerSource,
                        Map<String, Object> eventData, ActivationOutcome outcome) {
        String[] parts = triggerSource != null ? triggerSource.split(":", 2) : new String[]{"unknown", ""};
        activationLog.record(new ActivationRecord(
                UUID.randomUUID().toString(), playbookName,
                parts[0], parts.length > 1 ? parts[1] : "",
                eventData != null ? eventData : Map.of(),
                Instant.now(), outcome));
    }

    private static String triggerTypeString(ActivationTrigger trigger) {
        return switch (trigger) {
            case ActivationTrigger.CloudEventTrigger ignored -> "cloud-event";
            case ActivationTrigger.ScheduledTrigger ignored -> "cron";
        };
    }

    private static String triggerDetailString(ActivationTrigger trigger) {
        return switch (trigger) {
            case ActivationTrigger.CloudEventTrigger ce -> ce.eventType();
            case ActivationTrigger.ScheduledTrigger st -> st.cron();
        };
    }

    ActivationLog activationLog() {
        return activationLog;
    }
}
