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
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

public final class ScenarioCompiler {

    private static final int MAX_EXPANSION = 1000;

    private ScenarioCompiler() {}

    public static CompiledScenario compile(String yaml, Map<String, String> callerParams) {
        return compile(yaml, callerParams, name -> Optional.empty());
    }

    public static CompiledScenario compile(String yaml, Map<String, String> callerParams,
                                            Function<String, Optional<String>> scriptResolver) {
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

        List<HierarchicalStep> allSteps = scenario.allSteps().toList();
        LinkedHashMap<String, HierarchicalStep> stepMap = toStepMap(allSteps);

        stepMap = expandCsvForEach(stepMap, csvSources, resolver);

        ScenarioStepAdapter adapter = new ScenarioStepAdapter(csvSources, iterationGroups);
        ExpansionResult<HierarchicalStep> result = ForEachExpander.expand(
                stepMap, iterationGroups, resolver, adapter, MAX_EXPANSION);

        List<HierarchicalStep> expandedSteps = result.elements();

        List<String> callRefs = ScriptDescriptorExtractor.extract(
                yaml, ScriptProvenance.BUNDLED).calls();

        if (!callRefs.isEmpty() && scriptResolver != null) {
            validateCallGraph(scenario.scenario(), callRefs, scriptResolver);
            expandedSteps = inlineCalls(expandedSteps, callerParams, scriptResolver);
        }

        return new CompiledScenario(expandedSteps, callRefs);
    }

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

            String                    firstCol = csv.columns().get(0).name();
            List<Map<String, Object>> rows     = csv.rows();
            for (int i = 0; i < rows.size(); i++) {
                Map<String, Object> row       = rows.get(i);
                String              rowKey    = String.valueOf(row.get(firstCol));
                String              stampedId = stepId + "." + rowKey;

                VariableResolver rowResolver = baseResolver
                                                       .withEachContext(Map.of(as, rowKey, "index", String.valueOf(i)))
                                                       .withEachRowContext(Map.of(as, row));

                String when = step.when();
                if (when != null) {
                    String resolvedWhen = rowResolver.resolveString(when, stampedId);
                    if (!Truthiness.isTruthy(resolvedWhen)) {continue;}
                }

                List<ScenarioCommand> resolvedCommands = new ArrayList<>();
                for (ScenarioCommand cmd : step.commands()) {
                    resolvedCommands.add(resolveCommand(cmd, rowResolver, stampedId));
                }

                result.put(stampedId, new HierarchicalStep(step.name(), step.label(),
                                                           step.target(), step.actor(), step.trigger(), null, null,
                                                           step.content(), resolvedCommands));
            }
        }
        return result;}

    private static AriaTarget resolveAriaTarget(AriaTarget target,
                                                VariableResolver resolver,
                                                String context) {
        if (target == null) {return null;}
        String name = target.name();
        if (name != null && name.contains("${")) {
            name = resolver.resolveString(name, context);
        }
        String index = target.index();
        if (index != null && index.contains("${")) {
            index = resolver.resolveString(index, context);
        }
        AriaTarget within = resolveAriaTarget(target.within(), resolver, context);
        if (name == target.name() && index == target.index() && within == target.within()) {
            return target;
        }
        return new AriaTarget(target.role(), name, index, within);}

    private static ScenarioCommand resolveCommand(ScenarioCommand cmd,
                                                  VariableResolver resolver,
                                                  String context) {
        String value = cmd.value();
        if (value != null && value.contains("${")) {
            value = resolver.resolveString(value, context);
        }
        AriaTarget          target     = resolveAriaTarget(cmd.target(), resolver, context);
        Map<String, Object> callParams = resolveCallParams(cmd.callParams(), resolver, context);
        if (value == cmd.value() && target == cmd.target() && callParams == cmd.callParams()) {
            return cmd;
        }
        return new ScenarioCommand(cmd.action(), target, value, cmd.data(),
                                   cmd.domain(), cmd.await(), cmd.timeout(), cmd.mode(),
                                   cmd.source(), cmd.interval(), cmd.script(), callParams);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> resolveCallParams(Map<String, Object> params,
                                                         VariableResolver resolver,
                                                         String context) {
        if (params == null) {return null;}
        Map<String, Object> resolved = new LinkedHashMap<>();
        boolean             changed  = false;
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            Object val = entry.getValue();
            if (val instanceof String s && s.contains("${")) {
                resolved.put(entry.getKey(), resolver.resolveString(s, context));
                changed = true;
            } else {
                resolved.put(entry.getKey(), val);
            }
        }
        return changed ? Map.copyOf(resolved) : params;
    }

    private static void validateCallGraph(String rootName, List<String> callRefs,
                                           Function<String, Optional<String>> scriptResolver) {
        CallGraphValidator.validate(rootName, name -> {
            if (name.equals(rootName)) {
                return Optional.of(new CallGraphValidator.ScriptRef(rootName, callRefs));
            }
            return scriptResolver.apply(name).map(yaml -> {
                var desc = ScriptDescriptorExtractor.extract(yaml, ScriptProvenance.BUNDLED);
                return new CallGraphValidator.ScriptRef(desc.name(), desc.calls());
            });
        });
    }

    private static List<HierarchicalStep> inlineCalls(
            List<HierarchicalStep> steps,
            Map<String, String> parentParams,
            Function<String, Optional<String>> scriptResolver) {
        List<HierarchicalStep> result = new ArrayList<>();
        for (HierarchicalStep step : steps) {
            ScenarioCommand callCmd = step.commands().stream()
                    .filter(c -> "call".equals(c.action()) && c.script() != null)
                    .findFirst().orElse(null);

            if (callCmd == null) {
                result.add(step);
                continue;
            }

            String scriptName = callCmd.script();
            Optional<String> calleeYaml = scriptResolver.apply(scriptName);
            if (calleeYaml.isEmpty()) {
                result.add(step);
                continue;
            }

            Map<String, String> mergedParams = new LinkedHashMap<>(parentParams);
            if (callCmd.callParams() != null) {
                for (Map.Entry<String, Object> e : callCmd.callParams().entrySet()) {
                    mergedParams.put(e.getKey(), String.valueOf(e.getValue()));
                }
            }

            CompiledScenario callee = compile(calleeYaml.get(), mergedParams, scriptResolver);
            for (HierarchicalStep calleeStep : callee.steps()) {
                String prefixedLabel = scriptName + "." + calleeStep.label();
                String prefixedName = calleeStep.name() != null
                        ? scriptName + "." + calleeStep.name() : null;
                result.add(new HierarchicalStep(prefixedName, prefixedLabel,
                        calleeStep.target(), calleeStep.actor(), calleeStep.trigger(),
                        null, null, calleeStep.content(), calleeStep.commands()));
            }
        }
        return result;
    }
}
