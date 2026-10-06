package io.casehub.pages.playbook;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PlaybookContentParserTest {

    @Test
    void parsesFlatFormatWithSteps() {
        var yaml = """
                playbook: demo
                steps:
                  - navigate: /intake
                  - fill:
                      role: textbox
                      name: Subject
                      value: hello
                    label: Fill subject
                  - click:
                      role: button
                      name: Submit
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals("demo", envelope.playbook());
        assertEquals(3, envelope.allSteps().size());

        var nav = envelope.allSteps().get(0);
        assertEquals("navigate", nav.action());
        assertEquals("/intake", nav.params().get("value"));

        var fill = envelope.allSteps().get(1);
        assertEquals("fill", fill.action());
        assertEquals("textbox", fill.params().get("role"));
        assertEquals("Fill subject", fill.decorator("label"));
        assertEquals("browser", fill.decorator("target"));
    }

    @Test
    void parsesSectionedFormat() {
        var yaml = """
                playbook: tutorial
                actor: system
                speed: 1.0
                sections:
                  - label: Section One
                    content: Walk through the form
                    steps:
                      - fill:
                          role: textbox
                          name: Name
                          value: Alice
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals("tutorial", envelope.playbook());
        assertEquals("system", envelope.actor());
        assertEquals(1.0, envelope.speed());
        assertEquals(1, envelope.sections().size());
        assertEquals("Section One", envelope.sections().get(0).label());
        assertEquals("Walk through the form", envelope.sections().get(0).content());

        var step = envelope.allSteps().get(0);
        assertEquals("fill", step.action());
        assertEquals("system", step.decorator("actor"));
        assertEquals("browser", step.decorator("target"));
    }

    @Test
    void parsesChapteredFormat() {
        var yaml = """
                playbook: tutorial
                chapters:
                  - label: Chapter One
                    sections:
                      - label: Section A
                        steps:
                          - click:
                              role: button
                              name: OK
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals(1, envelope.chapters().size());
        assertEquals("Chapter One", envelope.chapters().get(0).label());
        assertEquals(1, envelope.allSteps().size());
        assertEquals("click", envelope.allSteps().get(0).action());
    }

    @Test
    void omittedSpeedUsesNoDelaySentinel() {
        var yaml = """
                playbook: demo
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertTrue(envelope.speed() <= 0);
    }

    @Test
    void explicitSpeedIsPreserved() {
        var yaml = """
                playbook: demo
                speed: 2.5
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals(2.5, envelope.speed());
    }

    @Test
    void defaultTargetIsBrowser() {
        var yaml = """
                playbook: demo
                steps:
                  - fill:
                      role: textbox
                      name: Name
                      value: Alice
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertEquals("browser", step.decorator("target"));
    }

    @Test
    void explicitTargetOverridesDefault() {
        var yaml = """
                playbook: demo
                steps:
                  - rest:
                      method: POST
                      url: /api/cases
                    target: server
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertEquals("server", step.decorator("target"));
    }

    @Test
    void actorInheritedFromEnvelope() {
        var yaml = """
                playbook: demo
                actor: admin
                steps:
                  - navigate: /home
                  - fill:
                      role: textbox
                      name: Name
                      value: Alice
                    actor: user
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals("admin", envelope.allSteps().get(0).decorator("actor"));
        assertEquals("user", envelope.allSteps().get(1).decorator("actor"));
    }

    @Test
    void stepNameFromExplicitStep() {
        var yaml = """
                playbook: demo
                steps:
                  - navigate: /home
                    step: go-home
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertEquals("go-home", step.decorator("step"));
    }

    @Test
    void stepNameDerivedFromLabel() {
        var step = new CompactStep("fill", java.util.Map.of(), null, null, null,
                java.util.Map.of("label", "Fill the Subject Field"));
        assertEquals("fill-the-subject-field",
                PlaybookContentParser.deriveStepName(step, 0));
    }

    @Test
    void stepNameAutoGenerated() {
        var step = new CompactStep("click", java.util.Map.of(), null, null, null,
                java.util.Map.of());
        assertEquals("click-2", PlaybookContentParser.deriveStepName(step, 2));
    }

    @Test
    void stepNameCollisionFails() {
        var yaml = """
                playbook: demo
                steps:
                  - navigate: /home
                    step: same-name
                  - click:
                      role: button
                      name: Submit
                    step: same-name
                """;
        assertThrows(IllegalArgumentException.class,
                () -> PlaybookContentParser.parse(yaml));
    }

    @Test
    void parsesForEachAsTypedField() {
        var yaml = """
                playbook: demo
                steps:
                  - fill:
                      role: textbox
                      name: Name
                      value: "${each.member.name}"
                    forEach:
                      as: member
                      in: members
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertNotNull(step.forEach());
        assertNull(step.decorators().get("forEach"));
    }

    @Test
    void parsesTriggerAsTypedField() {
        var yaml = """
                playbook: demo
                steps:
                  - click:
                      role: button
                      name: Submit
                    trigger:
                      after: step-1
                      delay: 500
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertNotNull(step.trigger());
        assertInstanceOf(Trigger.AfterTrigger.class, step.trigger());
        assertEquals("step-1", ((Trigger.AfterTrigger) step.trigger()).step());
    }

    @Test
    void parsesTemporalAsTypedField() {
        var yaml = """
                playbook: demo
                steps:
                  - temporal:
                      action: start
                      name: driver-1
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertNotNull(step.temporal());
        assertEquals(TemporalSpec.Action.START, step.temporal().action());
    }

    @Test
    void parsesEnvelopeFields() {
        var yaml = """
                playbook: demo
                on-error: stop
                params:
                  - name: teamName
                    type: string
                    required: true
                data:
                  members:
                    inline: |
                      name:string
                      Alice
                simulation:
                  strategies:
                    correlator: random
                  corpus:
                    - classpath:corpus/tickets.yaml
                  capture:
                    - case.created
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals("stop", envelope.onError());
        assertEquals(1, envelope.params().size());
        assertEquals("teamName", envelope.params().get(0).name());
        assertNotNull(envelope.data());
        assertNotNull(envelope.simulation());
        assertEquals("random", envelope.simulation().strategies().get("correlator"));
    }

    @Test
    void shorthandStepValueParsedAsParams() {
        var yaml = """
                playbook: demo
                steps:
                  - navigate: /intake
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertEquals("navigate", step.action());
        assertEquals("/intake", step.params().get("value"));
    }

    @Test
    void awaitAndModeAsDecorators() {
        var yaml = """
                playbook: demo
                steps:
                  - rest:
                      method: GET
                      url: /api/status
                    target: server
                    await:
                      match:
                        status: ready
                      timeout: 5000
                    mode: SINGLE
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertNotNull(step.decorator("await"));
        assertEquals("SINGLE", step.decorator("mode"));
    }

    @Test
    void temporalStepSkipsTargetDefault() {
        var yaml = """
                playbook: demo
                steps:
                  - temporal:
                      action: start
                      name: driver-1
                """;
        var step = PlaybookContentParser.parse(yaml).allSteps().get(0);
        assertNotNull(step.temporal());
        assertNull(step.decorator("target"));
    }

    @Test
    void mutualExclusivityEnforced() {
        var yaml = """
                playbook: demo
                sections:
                  - label: S1
                    steps: []
                steps:
                  - navigate: /home
                """;
        assertThrows(IllegalArgumentException.class,
                () -> PlaybookContentParser.parse(yaml));
    }

    @Test
    void missingPlaybookNameFails() {
        var yaml = """
                steps:
                  - navigate: /home
                """;
        assertThrows(IllegalArgumentException.class,
                () -> PlaybookContentParser.parse(yaml));
    }

    @Test
    void parsesMultiDocWithPlaybookHeader() {
        var yaml = """
                playbook: "1.0"
                schema: client
                ---
                playbook: helpdesk-intake
                steps:
                  - navigate: /intake
                  - click:
                      role: button
                      name: Submit
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals("helpdesk-intake", envelope.playbook());
        assertEquals(2, envelope.allSteps().size());
    }

    @Test
    void singleDocStillWorksAfterSplitter() {
        var yaml = """
                playbook: legacy
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals("legacy", envelope.playbook());
        assertEquals(1, envelope.allSteps().size());
    }
}
