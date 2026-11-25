package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.PlaybookContentParser;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class HeadlessPlaybookRunnerTest {

    private static final String MINIMAL_PLAYBOOK = """
            playbook: headless-test
            description: Minimal playbook for headless runner testing
            on-error: stop
            steps:
            - label: Navigate to app
              target: browser
              navigate:
                value: /
            - label: Check page loaded
              target: browser
              verify:
                endpoint: /api/health
                expect:
                  - match: {}
                    assert:
                      status: UP
            """;

    @Test
    void parsesPlaybookAndProducesSteps() {
        var envelope = PlaybookContentParser.parse(MINIMAL_PLAYBOOK);
        assertThat(envelope.playbook()).isEqualTo("headless-test");
        assertThat(envelope.allSteps()).hasSize(2);
        assertThat(envelope.allSteps().get(0).action()).isEqualTo("navigate");
        assertThat(envelope.allSteps().get(1).action()).isEqualTo("verify");
    }

    @Test
    void configBuilderSetsDefaults() {
        var config = HeadlessPlaybookRunner.HeadlessRunnerConfig.builder()
                .baseUrl("http://127.0.0.1:8190")
                .build();
        assertThat(config.headless()).isTrue();
        assertThat(config.timeout()).isEqualTo(Duration.ofSeconds(30));
        assertThat(config.pollInterval()).isEqualTo(Duration.ofMillis(500));
    }

    @Test
    void stepResultRecordsStatus() {
        var passed = HeadlessPlaybookRunner.StepResult.passed("step-1", "fill");
        assertThat(passed.passed()).isTrue();

        var failed = HeadlessPlaybookRunner.StepResult.failed("step-2", "verify", "timeout");
        assertThat(failed.passed()).isFalse();
        assertThat(failed.error()).isEqualTo("timeout");

        var skipped = HeadlessPlaybookRunner.StepResult.skipped("step-3", "spotlight");
        assertThat(skipped.status()).isEqualTo(HeadlessPlaybookRunner.StepResult.Status.SKIPPED);
    }

    @Test
    void runResultAggregatesPassFail() {
        var results = java.util.List.of(
                HeadlessPlaybookRunner.StepResult.passed("s1", "fill"),
                HeadlessPlaybookRunner.StepResult.passed("s2", "click"));
        var runResult = new HeadlessPlaybookRunner.RunResult("test-playbook", results);
        assertThat(runResult.passed()).isTrue();
        assertThat(runResult.failedSteps()).isEmpty();
    }

    @Test
    void runResultDetectsFailure() {
        var results = java.util.List.of(
                HeadlessPlaybookRunner.StepResult.passed("s1", "fill"),
                HeadlessPlaybookRunner.StepResult.failed("s2", "verify", "assertion failed"));
        var runResult = new HeadlessPlaybookRunner.RunResult("test-playbook", results);
        assertThat(runResult.passed()).isFalse();
        assertThat(runResult.failedSteps()).hasSize(1);
    }

    @Disabled("Requires running application and Playwright browsers installed")
    @Test
    void runsMinimalPlaybookHeadlessly() {
        var config = HeadlessPlaybookRunner.HeadlessRunnerConfig.builder()
                .baseUrl("http://127.0.0.1:8190")
                .headless(true)
                .timeout(Duration.ofSeconds(15))
                .build();
        var runner = new HeadlessPlaybookRunner(config);
        var result = runner.run(MINIMAL_PLAYBOOK);
        assertThat(result.passed()).isTrue();
    }
}
