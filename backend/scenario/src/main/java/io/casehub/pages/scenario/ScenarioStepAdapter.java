package io.casehub.pages.scenario;

import io.casehub.yaml.core.data.CsvDataSource;
import io.casehub.yaml.core.foreach.ForEachAdapter;
import io.casehub.yaml.core.foreach.IterationGroup;
import io.casehub.yaml.core.resolver.VariableResolver;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class ScenarioStepAdapter implements ForEachAdapter<HierarchicalStep> {

    private final Map<String, CsvDataSource>  csvSources;
    private final Map<String, IterationGroup> iterationGroups;

    public ScenarioStepAdapter(Map<String, CsvDataSource> csvSources,
                               Map<String, IterationGroup> iterationGroups) {
        this.csvSources      = csvSources;
        this.iterationGroups = iterationGroups;
    }

    @Override
    public HierarchicalStep stamp(HierarchicalStep template, String stampedId,
                                  VariableResolver scopedResolver) {
        Object forEach        = template.forEach();
        String dataSourceName = resolveDataSourceName(forEach);
        if (dataSourceName != null) {
            CsvDataSource csv = csvSources.get(dataSourceName);
            if (csv != null) {
                String              as    = resolveAs(forEach);
                String              value = extractStampValue(stampedId);
                Map<String, Object> row   = findRowByFirstColumn(csv, value);
                if (row != null) {
                    scopedResolver = scopedResolver.withEachRowContext(Map.of(as, row));
                }
            }
        }

        List<ScenarioCommand> resolvedCommands = resolveCommands(template.commands(), scopedResolver, stampedId);
        return new HierarchicalStep(template.name(), template.label(), template.target(),
                                    template.actor(), template.trigger(), null, null,
                                    template.content(), resolvedCommands);
    }

    @Override
    public Object getForEach(HierarchicalStep element) {
        return element.forEach();
    }

    @Override
    public String getId(HierarchicalStep element) {
        return element.name() != null ? element.name() : slugify(element.label());
    }

    @Override
    public String getWhen(HierarchicalStep element) {
        return element.when();
    }

    private List<ScenarioCommand> resolveCommands(List<ScenarioCommand> commands,
                                                  VariableResolver resolver,
                                                  String context) {
        List<ScenarioCommand> resolved = new ArrayList<>();
        for (ScenarioCommand cmd : commands) {
            String value = cmd.value();
            if (value != null && value.contains("${")) {
                value = resolver.resolveString(value, context);
            }
            resolved.add(new ScenarioCommand(cmd.action(), cmd.target(), value,
                                             cmd.data(), cmd.domain(), cmd.await(), cmd.timeout(),
                                             cmd.mode(), cmd.source(), cmd.interval(),
                                             cmd.script(), cmd.callParams()));
        }
        return resolved;
    }

    private static String resolveDataSourceName(Object forEach) {
        if (forEach instanceof String s) {return s;}
        if (forEach instanceof Map<?, ?> m) {
            Object in = m.get("in");
            return in instanceof String s ? s : null;
        }
        return null;
    }

    private String resolveAs(Object forEach) {
        if (forEach instanceof String groupRef) {
            IterationGroup group = iterationGroups.get(groupRef);
            return group != null ? group.as() : groupRef;
        }
        if (forEach instanceof Map<?, ?> m) {return (String) m.get("as");}
        return null;
    }

    private static String extractStampValue(String stampedId) {
        int dot = stampedId.lastIndexOf('.');
        return dot >= 0 ? stampedId.substring(dot + 1) : stampedId;
    }

    private static Map<String, Object> findRowByFirstColumn(CsvDataSource csv, String value) {
        if (csv.columns().isEmpty()) {return null;}
        String firstCol = csv.columns().get(0).name();
        for (Map<String, Object> row : csv.rows()) {
            if (value.equals(String.valueOf(row.get(firstCol)))) {return row;}
        }
        return null;
    }

    static String slugify(String label) {
        return label.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }
}
