package io.casehub.pages.playbook.runtime;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import io.casehub.pages.playbook.CompactStep;
import io.casehub.pages.playbook.PlaybookContentParser;
import io.casehub.pages.playbook.PlaybookEnvelope;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Executes playbook YAML headlessly via Playwright, treating verify: steps as assertions.
 */
public class HeadlessPlaybookRunner {

    private static final Set<String> BROWSER_ACTIONS = Set.of(
            "fill", "click", "select", "navigate", "spotlight", "show-markdown",
            "bootstrap-classifications"
    );
    private static final Set<String> SKIP_ACTIONS = Set.of(
            "spotlight", "show-markdown"
    );

    private final HeadlessRunnerConfig config;

    public HeadlessPlaybookRunner(HeadlessRunnerConfig config) {
        this.config = config;
    }

    public RunResult run(String playbookYaml) {
        PlaybookEnvelope envelope = PlaybookContentParser.parse(playbookYaml);
        List<CompactStep> steps = envelope.allSteps();
        List<StepResult> results = new ArrayList<>();

        try (Playwright pw = Playwright.create();
             Browser browser = pw.chromium().launch(
                     new BrowserType.LaunchOptions().setHeadless(config.headless()))) {
            Page page = browser.newPage();

            if (config.baseUrl() != null) {
                page.navigate(config.baseUrl());
                page.waitForLoadState();
            }

            for (int i = 0; i < steps.size(); i++) {
                CompactStep step = steps.get(i);
                String stepName = PlaybookContentParser.deriveStepName(step, i);
                String action = step.action();

                try {
                    if (SKIP_ACTIONS.contains(action)) {
                        results.add(StepResult.skipped(stepName, action));
                        continue;
                    }

                    StepResult result = executeStep(step, stepName, page);
                    results.add(result);

                    if (!result.passed()) {
                        if ("stop".equals(envelope.onError())) {
                            break;
                        }
                    }
                } catch (Exception e) {
                    results.add(StepResult.failed(stepName, action, e.getMessage()));
                    if ("stop".equals(envelope.onError())) {
                        break;
                    }
                }
            }
        }

        return new RunResult(envelope.playbook(), results);
    }

    public RunResult run(InputStream playbookStream) {
        try {
            String yaml = new String(playbookStream.readAllBytes(), StandardCharsets.UTF_8);
            return run(yaml);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read playbook YAML", e);
        }
    }

    private StepResult executeStep(CompactStep step, String stepName, Page page) {
        String action = step.action();
        Map<String, Object> params = step.params();

        return switch (action) {
            case "fill" -> executeFill(stepName, params, page);
            case "click" -> executeClick(stepName, params, page);
            case "select" -> executeSelect(stepName, params, page);
            case "navigate" -> executeNavigate(stepName, params, page);
            case "verify" -> executeVerify(stepName, params);
            case "bootstrap-classifications" -> executeBootstrap(stepName, params);
            default -> StepResult.skipped(stepName, action);
        };
    }

    private StepResult executeFill(String stepName, Map<String, Object> params, Page page) {
        Locator locator = resolveLocator(params, page);
        String value = extractValue(params);
        locator.fill(value);
        return StepResult.passed(stepName, "fill");
    }

    private StepResult executeClick(String stepName, Map<String, Object> params, Page page) {
        Locator locator = resolveLocator(params, page);
        locator.click();
        return StepResult.passed(stepName, "click");
    }

    private StepResult executeSelect(String stepName, Map<String, Object> params, Page page) {
        Locator locator = resolveLocator(params, page);
        String value = extractValue(params);
        locator.selectOption(value);
        return StepResult.passed(stepName, "select");
    }

    private StepResult executeNavigate(String stepName, Map<String, Object> params, Page page) {
        String url = (String) params.get("value");
        if (url != null && !url.startsWith("http")) {
            url = config.baseUrl() + url;
        }
        page.navigate(url);
        page.waitForLoadState();
        return StepResult.passed(stepName, "navigate");
    }

    @SuppressWarnings("unchecked")
    private StepResult executeVerify(String stepName, Map<String, Object> params) {
        String endpoint = (String) params.get("endpoint");
        List<Map<String, Object>> expectations = (List<Map<String, Object>>) params.get("expect");

        String url = config.baseUrl() + endpoint;
        int maxAttempts = (int) (config.timeout().toMillis() / config.pollInterval().toMillis());

        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                String responseBody = httpGet(url);
                List<String> failures = checkExpectations(responseBody, expectations);
                if (failures.isEmpty()) {
                    return StepResult.passed(stepName, "verify");
                }
                if (attempt < maxAttempts - 1) {
                    Thread.sleep(config.pollInterval().toMillis());
                } else {
                    return StepResult.failed(stepName, "verify",
                            "Expectations not met after " + config.timeout() + ": " +
                            String.join("; ", failures));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return StepResult.failed(stepName, "verify", "Interrupted");
            } catch (Exception e) {
                if (attempt >= maxAttempts - 1) {
                    return StepResult.failed(stepName, "verify", e.getMessage());
                }
            }
        }
        return StepResult.failed(stepName, "verify", "Unreachable");
    }

    private StepResult executeBootstrap(String stepName, Map<String, Object> params) {
        // Bootstrap steps seed classification rules via REST
        // TODO: implement bootstrap dispatch to /scenario/bootstrap/* or equivalent
        return StepResult.skipped(stepName, "bootstrap-classifications");
    }

    @SuppressWarnings("unchecked")
    private Locator resolveLocator(Map<String, Object> params, Page page) {
        Map<String, Object> target = (Map<String, Object>) params.get("target");
        if (target == null) {
            target = params;
        }

        String role = (String) target.get("role");
        String name = (String) target.get("name");

        if (role != null) {
            var ariaRole = mapToAriaRole(role);
            if (name != null) {
                return page.getByRole(ariaRole, new Page.GetByRoleOptions().setName(name));
            }
            return page.getByRole(ariaRole);
        }

        if (name != null) {
            return page.getByLabel(name);
        }

        throw new IllegalArgumentException("Cannot resolve locator — no role or name in: " + target);
    }

    private static com.microsoft.playwright.options.AriaRole mapToAriaRole(String role) {
        return switch (role.toLowerCase()) {
            case "button" -> com.microsoft.playwright.options.AriaRole.BUTTON;
            case "textbox" -> com.microsoft.playwright.options.AriaRole.TEXTBOX;
            case "combobox" -> com.microsoft.playwright.options.AriaRole.COMBOBOX;
            case "link" -> com.microsoft.playwright.options.AriaRole.LINK;
            case "checkbox" -> com.microsoft.playwright.options.AriaRole.CHECKBOX;
            case "radio" -> com.microsoft.playwright.options.AriaRole.RADIO;
            case "tab" -> com.microsoft.playwright.options.AriaRole.TAB;
            case "status" -> com.microsoft.playwright.options.AriaRole.STATUS;
            case "heading" -> com.microsoft.playwright.options.AriaRole.HEADING;
            case "listbox" -> com.microsoft.playwright.options.AriaRole.LISTBOX;
            case "option" -> com.microsoft.playwright.options.AriaRole.OPTION;
            case "dialog" -> com.microsoft.playwright.options.AriaRole.DIALOG;
            default -> throw new IllegalArgumentException("Unmapped ARIA role: " + role);
        };
    }

    private static String extractValue(Map<String, Object> params) {
        Object value = params.get("value");
        if (value != null) return value.toString();
        @SuppressWarnings("unchecked")
        Map<String, Object> target = (Map<String, Object>) params.get("target");
        if (target != null && target.containsKey("value")) {
            return target.get("value").toString();
        }
        throw new IllegalArgumentException("No value found in params: " + params);
    }

    private String httpGet(String url) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new RuntimeException("HTTP " + response.statusCode() + " from " + url);
            }
            return response.body();
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("HTTP GET failed: " + url, e);
        }
    }

    private List<String> checkExpectations(String responseBody,
                                            List<Map<String, Object>> expectations) {
        // TODO: parse JSON response, match against expectations
        // For each expectation: find matching item, check asserted fields
        throw new UnsupportedOperationException(
                "checkExpectations not yet implemented — verify steps cannot run until this is complete");
    }

    public record HeadlessRunnerConfig(
            String baseUrl,
            boolean headless,
            Duration timeout,
            Duration pollInterval
    ) {
        public HeadlessRunnerConfig {
            java.util.Objects.requireNonNull(baseUrl, "baseUrl is required");
            if (timeout == null) timeout = Duration.ofSeconds(30);
            if (pollInterval == null) pollInterval = Duration.ofMillis(500);
        }

        public static Builder builder() {
            return new Builder();
        }

        public static class Builder {
            private String baseUrl;
            private boolean headless = true;
            private Duration timeout = Duration.ofSeconds(30);
            private Duration pollInterval = Duration.ofMillis(500);

            public Builder baseUrl(String baseUrl) { this.baseUrl = baseUrl; return this; }
            public Builder headless(boolean headless) { this.headless = headless; return this; }
            public Builder timeout(Duration timeout) { this.timeout = timeout; return this; }
            public Builder pollInterval(Duration pollInterval) { this.pollInterval = pollInterval; return this; }
            public HeadlessRunnerConfig build() {
                return new HeadlessRunnerConfig(baseUrl, headless, timeout, pollInterval);
            }
        }
    }

    public record StepResult(String stepName, String action, Status status, String error) {
        public enum Status { PASSED, FAILED, SKIPPED }

        public boolean passed() { return status == Status.PASSED; }

        public static StepResult passed(String stepName, String action) {
            return new StepResult(stepName, action, Status.PASSED, null);
        }
        public static StepResult failed(String stepName, String action, String error) {
            return new StepResult(stepName, action, Status.FAILED, error);
        }
        public static StepResult skipped(String stepName, String action) {
            return new StepResult(stepName, action, Status.SKIPPED, null);
        }
    }

    public record RunResult(String playbook, List<StepResult> steps) {
        public boolean passed() {
            return steps.stream().noneMatch(s -> s.status() == StepResult.Status.FAILED);
        }
        public List<StepResult> failedSteps() {
            return steps.stream().filter(s -> s.status() == StepResult.Status.FAILED).toList();
        }
    }
}
