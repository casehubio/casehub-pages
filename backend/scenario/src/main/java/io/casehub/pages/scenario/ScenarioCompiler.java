package io.casehub.pages.scenario;

import io.casehub.yaml.core.condition.Truthiness;
import io.casehub.yaml.core.data.CsvDataSource;
import io.casehub.yaml.core.data.CsvParser;
import io.casehub.yaml.core.foreach.ExpansionResult;
import io.casehub.yaml.core.foreach.ForEachExpander;
import io.casehub.yaml.core.foreach.IterationGroup;
import io.casehub.yaml.core.resolver.VariableResolver;
import io.casehub.yaml.core.resolver.VariableSource;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ScenarioCompiler {

    private static final int MAX_EXPANSION = 1000;

    private ScenarioCompiler() {}

    public static CompiledScenario compile(String yaml, Map<String, String> callerParams) {
        HierarchicalScenario scenario = HierarchicalParser.parse(yaml);

        validateRequiredParams(scenario.params(), callerParams);

        Map<String, String> defaults = buildDefaults(scenario.params());
        VariableSource paramSource = VariableSource.chain(
                callerParams::get,
                defaults::get
                                                         );
        VariableResolver resolver = new VariableResolver(
                Map.of("params", paramSource, "var", paramSource),
                Set.of("step")
        );

        Map<String, CsvDataSource> csvSources = parseCsvSources(scenario.data());
        Map<String, IterationGroup> iterationGroups = buildIterationGroups(
                scenario.iterations(), csvSources);

        List<HierarchicalStep>                  allSteps = scenario.allSteps().toList();
        LinkedHashMap<String, HierarchicalStep> stepMap  = toStepMap(allSteps);

        stepMap = expandCsvForEach(stepMap, csvSources, resolver);

        ScenarioStepAdapter adapter = new ScenarioStepAdapter(csvSources, iterationGroups);
        ExpansionResult<HierarchicalStep> result = ForEachExpander.expand(
                stepMap, iterationGroups, resolver, adapter, MAX_EXPANSION);

        List<String> callRefs = ScriptDescriptorExtractor.extract(
                yaml, ScriptProvenance.BUNDLED).calls();

        return new CompiledScenario(result.elements(), callRefs);}

    private static void validateRequiredParams(List<ParamDescriptor> params,
                                                Map<String, String> callerParams) {
        for (ParamDescriptor param : params) {
            if (param.required() && param.defaultValue() == null
                    && !callerParams.containsKey(param.name())) {
                throw new IllegalArgumentException(
                        "Missing required parameter: " + param.name());
            }
        }
    }

    private static Map<String, String> buildDefaults(List<ParamDescriptor> params) {
        Map<String, String> defaults = new LinkedHashMap<>();
        for (ParamDescriptor param : params) {
            if (param.defaultValue() != null) {
                defaults.put(param.name(), String.valueOf(param.defaultValue()));
            }
        }
        return defaults;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, CsvDataSource> parseCsvSources(Map<String, Object> data) {
        Map<String, CsvDataSource> sources = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (entry.getValue() instanceof Map<?, ?> spec) {
                String inline = null;
                if (spec.containsKey("inline")) {
                    inline = String.valueOf(spec.get("inline"));
                }
                if (inline != null) {
                    sources.put(entry.getKey(), CsvParser.parse(entry.getKey(), inline));
                }
            }
        }
        return sources;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, IterationGroup> buildIterationGroups(
            Map<String, Object> iterations,
            Map<String, CsvDataSource> csvSources) {
        Map<String, IterationGroup> groups = new LinkedHashMap<>();

        for (Map.Entry<String, Object> entry : iterations.entrySet()) {
            if (entry.getValue() instanceof Map<?, ?> spec) {
                String as = (String) spec.get("as");
                Object in = spec.get("in");
                groups.put(entry.getKey(), new IterationGroup(as, in));
            }
        }

        for (Map.Entry<String, CsvDataSource> entry : csvSources.entrySet()) {
            CsvDataSource csv = entry.getValue();
            if (csv.columns().isEmpty() || csv.rows().isEmpty()) continue;
            String firstCol = csv.columns().get(0).name();
            List<String> values = csv.rows().stream()
                    .map(row -> String.valueOf(row.get(firstCol)))
                    .toList();
            groups.put(entry.getKey(), new IterationGroup(entry.getKey(), values));
        }

        return groups;
    }

    private static LinkedHashMap<String, HierarchicalStep> toStepMap(
            List<HierarchicalStep> steps) {
        LinkedHashMap<String, HierarchicalStep> map = new LinkedHashMap<>();
        for (HierarchicalStep step : steps) {
            String id = step.name() != null ? step.name()
                    : ScenarioStepAdapter.slugify(step.label());
            map.put(id, step);
        }
        return map;
    }


    @SuppressWarnings("unchecked")
    private static LinkedHashMap<String, HierarchicalStep> expandCsvForEach(
            LinkedHashMap<String, HierarchicalStep> stepMap,
            Map<String, CsvDataSource> csvSources,
            VariableResolver baseResolver) {
        LinkedHashMap<String, HierarchicalStep> result = new LinkedHashMap<>();

        for (Map.Entry<String, HierarchicalStep> entry : stepMap.entrySet()) {
            String           stepId  = entry.getKey();
            HierarchicalStep step    = entry.getValue();
            Object           forEach = step.forEach();

            String dataSourceName = null;
            String as             = null;
            if (forEach instanceof String ref && csvSources.containsKey(ref)) {
                dataSourceName = ref;
            } else if (forEach instanceof Map<?, ?> m) {
                Object in = m.get("in");
                if (in instanceof String ref && csvSources.containsKey(ref)) {
                    dataSourceName = ref;
                    as             = (String) m.get("as");
                }
            }

            if (dataSourceName == null) {
                result.put(stepId, step);
                continue;
            }

            CsvDataSource csv = csvSources.get(dataSourceName);
            if (as == null) {
                as = dataSourceName;
            }

            String firstCol = csv.columns().get(0).name();
            for (Map<String, Object> row : csv.rows()) {
                String rowKey    = String.valueOf(row.get(firstCol));
                String stampedId = stepId + "." + rowKey;

                VariableResolver rowResolver = baseResolver
                                                       .withEachContext(Map.of(as, rowKey))
                                                       .withEachRowContext(Map.of(as, row));

                String when = step.when();
                if (when != null) {
                    String resolvedWhen = rowResolver.resolveString(when, stampedId);
                    if (!Truthiness.isTruthy(resolvedWhen)) {continue;}
                }

                List<ScenarioCommand> resolvedCommands = new ArrayList<>();
                for (ScenarioCommand cmd : step.commands()) {
                    String value = cmd.value();
                    if (value != null && value.contains("${")) {
                        value = rowResolver.resolveString(value, stampedId);
                    }
                    resolvedCommands.add(new ScenarioCommand(cmd.action(), cmd.target(),
                                                             value, cmd.data(), cmd.domain(), cmd.await(), cmd.timeout(),
                                                             cmd.mode(), cmd.source(), cmd.interval()));
                }

                result.put(stampedId, new HierarchicalStep(step.name(), step.label(),
                                                           step.target(), step.actor(), step.trigger(), null, null,
                                                           step.content(), resolvedCommands));
            }
        }
        return result;
    }


}
