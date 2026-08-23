package io.casehub.pages.scenario.runtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.PushMessage;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.SessionSender;
import io.casehub.pages.scenario.HierarchicalParser;
import io.casehub.pages.scenario.OutlineNode;
import io.casehub.pages.scenario.NarrativeContent;
import io.casehub.pages.scenario.HierarchicalScenario;
import io.casehub.pages.scenario.HierarchicalStep;
import io.casehub.pages.scenario.ScenarioCommand;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class ScenarioOrchestrator {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final SessionSender    sender;
    private final EventBroadcaster broadcaster;
    private final ExecutorRegistry executorRegistry = new ExecutorRegistry();

    private volatile String                             sessionId;
    private volatile HierarchicalScenario               scenario;
    private volatile List<HierarchicalStep>             allSteps;
    private final    ConcurrentHashMap<String, Boolean> completedSteps = new ConcurrentHashMap<>();
    private volatile boolean                            paused;
    private volatile double                             speed          = 1.0;
    private volatile String                             runToTarget;

    @Inject
    public ScenarioOrchestrator(SessionSender sender, EventBroadcaster broadcaster) {
        this.sender      = sender;
        this.broadcaster = broadcaster;
    }

    public void start(String yaml) {
        start(yaml, false);
    }

    public void start(String yaml, boolean startPaused) {
        this.scenario  = HierarchicalParser.parse(yaml);
        this.allSteps  = scenario.allSteps().toList();
        this.sessionId = UUID.randomUUID().toString();
        this.completedSteps.clear();
        this.paused      = startPaused;
        this.speed       = scenario.speed();
        this.runToTarget = null;

        validateExecutors();
        dispatchAllSequences();
        broadcastState();
    }

    public void stop() {
        if (this.sessionId == null) {return;}
        broadcastControl("stop", null);
        this.sessionId = null;
        this.scenario  = null;
        this.allSteps  = List.of();
        this.completedSteps.clear();
        this.paused      = false;
        this.speed       = 1.0;
        this.runToTarget = null;
        broadcastState();
    }

    public void pause() {
        requireSession();
        this.paused = true;
        broadcastControl("pause", null);
        broadcastState();
    }

    public void resume() {
        requireSession();
        this.paused = false;
        broadcastControl("resume", null);
        broadcastState();
    }

    public void step() {
        requireSession();
        broadcastControl("step", null);
    }

    public RunToResult runTo(String label) {
        requireSession();
        int targetIndex = findStepIndex(label);
        if (targetIndex < 0) {return RunToResult.NOT_FOUND;}

        int currentIndex = completedSteps.size();
        if (targetIndex < currentIndex) {return RunToResult.ALREADY_PAST;}

        this.runToTarget = label;
        this.paused      = false;
        broadcastControl("speed", 1000.0);
        broadcastControl("resume", null);
        broadcastState();
        return RunToResult.OK;
    }

    public void speed(double newSpeed) {
        requireSession();
        if (newSpeed <= 0) {throw new IllegalArgumentException("Speed must be > 0");}
        this.speed = Math.max(0.01, newSpeed);
        broadcastControl("speed", this.speed);
        broadcastState();
    }

    public ScenarioState state() {
        if (scenario == null) {return ScenarioState.idle();}

        String currentChapter = null;
        String currentSection = null;
        String currentStep    = null;

        int              completed = completedSteps.size();
        NarrativeContent content   = null;
        if (!allSteps.isEmpty() && completed < allSteps.size()) {
            var step = allSteps.get(completed);
            currentStep    = step.label();
            currentSection = findSectionLabel(completed);
            currentChapter = findChapterLabel(completed);
            content        = resolveContent(completed);
        }

        double progress = allSteps.isEmpty() ? 1.0
                                             : (double) completed / allSteps.size();

        return new ScenarioState(scenario.scenario(), currentChapter,
                                 currentSection, currentStep, paused, speed, progress,
                                 content, scenario.slides());
    }

    public String sessionId() {
        return sessionId;
    }

    public List<OutlineNode> outline() {
        if (scenario == null) {return List.of();}
        return buildOutline(scenario);
    }

    public void onExecutorRegister(String connectionId, PushRequest.ExecutorRegister reg) {
        executorRegistry.register(connectionId, reg);
    }

    public void onStepResult(PushRequest.StepResult result) {
        if (sessionId == null || !sessionId.equals(result.sessionId())) {return;}
        completedSteps.put(result.stepName(), result.ok());

        if (runToTarget != null && runToTarget.equals(result.stepName())) {
            runToTarget = null;
            this.speed  = 1.0;
            pause();
            return;
        }
        broadcastState();
        if (result.ok()) {
            dispatchTriggeredSteps(result.stepName());
        }
    }

    private void broadcastState() {
        broadcaster.broadcast("scenario:state", state());
    }

    private void validateExecutors() {
        var missingExecutors = allSteps.stream()
                                       .map(HierarchicalStep::target)
                                       .distinct()
                                       .filter(t -> !executorRegistry.hasExecutor(t))
                                       .toList();
        if (!missingExecutors.isEmpty()) {
            throw new IllegalStateException(
                    "Missing executors: " + missingExecutors);
        }
    }

    private void dispatchAllSequences() {
        var sequences = SequencePartitioner.partitionInitial(allSteps);
        for (var seq : sequences) {
            dispatchSequence(seq);
        }
    }

    private void dispatchTriggeredSteps(String completedStepName) {
        for (var step : allSteps) {
            if (step.trigger() instanceof io.casehub.pages.scenario.Trigger.AfterTrigger after
                    && after.step().equals(completedStepName)) {
                long delay = after.delayMs();
                if (delay > 0) {
                    Thread.ofVirtual().start(() -> {
                        try { Thread.sleep(delay); } catch (InterruptedException e) { return; }
                        dispatchSequence(new SequencePartitioner.StepSequence(
                            step.target(), List.of(step)));
                    });
                } else {
                    dispatchSequence(new SequencePartitioner.StepSequence(
                        step.target(), List.of(step)));
                }
            }
        }
    }

    private void dispatchSequence(SequencePartitioner.StepSequence seq) {
        var executor = executorRegistry.get(seq.target());
        if (executor == null) {return;}

        String stepsJson = serializeSteps(seq.steps());
        String msg = PushMessage.dispatchSequence(
                sessionId, seq.target(), stepsJson, speed, paused);
        sender.send(executor.connectionId(), msg);
    }

    private String serializeSteps(List<HierarchicalStep> steps) {
        var stepMaps = new ArrayList<Map<String, Object>>();
        for (var step : steps) {
            var map = new java.util.LinkedHashMap<String, Object>();
            map.put("name", step.name() != null ? step.name() : step.label());
            map.put("label", step.label());
            if (step.actor() != null) {map.put("actor", step.actor());}

            var cmdMaps = new ArrayList<Map<String, Object>>();
            for (var cmd : step.commands()) {
                var cmdMap = new java.util.LinkedHashMap<String, Object>();
                cmdMap.put("action", cmd.action());
                if (cmd.target() != null) {
                    cmdMap.put("target", Map.of(
                            "role", cmd.target().role(),
                            "name", cmd.target().name()));
                }
                if (cmd.value() != null) {cmdMap.put("value", cmd.value());}
                if (cmd.data() != null) {cmdMap.put("data", cmd.data());}
                if (cmd.domain() != null) {cmdMap.put("domain", cmd.domain());}
                cmdMaps.add(cmdMap);
            }
            map.put("commands", cmdMaps);
            stepMaps.add(map);
        }
        try {
            return JSON.writeValueAsString(stepMaps);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize steps", e);
        }
    }

    private void broadcastControl(String command, Double controlSpeed) {
        String msg = PushMessage.executorControl(sessionId, command, controlSpeed);
        for (var executor : executorRegistry.all()) {
            sender.send(executor.connectionId(), msg);
        }
    }

    private List<OutlineNode> buildOutline(HierarchicalScenario s) {
        if (s.chapters() != null) {
            return s.chapters().stream()
                    .map(c -> new OutlineNode(c.label(),
                                              c.sections().stream()
                                               .map(sec -> new OutlineNode(sec.label(),
                                                                           sec.steps().stream()
                                                                              .map(st -> new OutlineNode(st.label(), st.target()))
                                                                              .toList()))
                                               .toList()))
                    .toList();
        }
        if (s.sections() != null) {
            return s.sections().stream()
                    .map(sec -> new OutlineNode(sec.label(),
                                                sec.steps().stream()
                                                   .map(st -> new OutlineNode(st.label(), st.target()))
                                                   .toList()))
                    .toList();
        }
        if (s.steps() != null) {
            return s.steps().stream()
                    .map(st -> new OutlineNode(st.label(), st.target()))
                    .toList();
        }
        return List.of();
    }

    private int findStepIndex(String label) {
        for (int i = 0; i < allSteps.size(); i++) {
            if (label.equals(allSteps.get(i).label())) {return i;}
        }
        return -1;
    }

    private String findSectionLabel(int stepIndex) {
        if (scenario.sections() != null) {
            int offset = 0;
            for (var section : scenario.sections()) {
                if (stepIndex < offset + section.steps().size()) {
                    return section.label();
                }
                offset += section.steps().size();
            }
        }
        if (scenario.chapters() != null) {
            int offset = 0;
            for (var chapter : scenario.chapters()) {
                for (var section : chapter.sections()) {
                    if (stepIndex < offset + section.steps().size()) {
                        return section.label();
                    }
                    offset += section.steps().size();
                }
            }
        }
        return null;
    }

    private String findChapterLabel(int stepIndex) {
        if (scenario.chapters() == null) {return null;}
        int offset = 0;
        for (var chapter : scenario.chapters()) {
            int chapterSize = chapter.sections().stream()
                                     .mapToInt(s -> s.steps().size()).sum();
            if (stepIndex < offset + chapterSize) {
                return chapter.label();
            }
            offset += chapterSize;
        }
        return null;
    }

    private NarrativeContent resolveContent(int stepIndex) {
        var step = allSteps.get(stepIndex);
        if (step.content() != null) {return step.content();}

        if (scenario.sections() != null) {
            int offset = 0;
            for (var section : scenario.sections()) {
                if (stepIndex < offset + section.steps().size()) {
                    return section.content();
                }
                offset += section.steps().size();
            }
        }
        if (scenario.chapters() != null) {
            int offset = 0;
            for (var chapter : scenario.chapters()) {
                for (var section : chapter.sections()) {
                    if (stepIndex < offset + section.steps().size()) {
                        if (section.content() != null) {return section.content();}
                        return chapter.content();
                    }
                    offset += section.steps().size();
                }
            }
        }
        return null;
    }

    private void requireSession() {
        if (sessionId == null) {
            throw new IllegalStateException("No active session");
        }
    }
}
