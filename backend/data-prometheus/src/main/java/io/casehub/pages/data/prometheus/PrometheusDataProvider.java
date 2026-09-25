package io.casehub.pages.data.prometheus;

import io.casehub.pages.data.DataProvider;
import io.casehub.pages.data.DataQueryException;
import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.QueryResult;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class PrometheusDataProvider implements DataProvider {

    @Inject
    PrometheusConfig config;

    private PrometheusClient client;

    @PostConstruct
    void init() {
        client = new PrometheusClient(
            config.endpoint(),
            config.authType(),
            config.authToken().orElse(null),
            config.authUsername().orElse(null),
            config.authPassword().orElse(null),
            parseSeconds(config.connectTimeout()),
            parseSeconds(config.readTimeout())
        );
    }

    @Override
    public String type() {
        return "prometheus";
    }

    @Override
    public boolean canHandle(String dataSetId) {
        return config.datasets().containsKey(dataSetId);
    }

    @Override
    public QueryResult query(DataSetLookup lookup) {
        DatasetConfig ds = config.datasets().get(lookup.dataSetId());
        if (ds == null) {
            throw new DataQueryException("INVALID_QUERY",
                "No Prometheus dataset configured: " + lookup.dataSetId());
        }

        PromQLQuery promql = PromQLBuilder.build(ds.metric(), lookup.operations(), ds.step());

        PrometheusResponse response;
        if (promql.start() != null && promql.end() != null) {
            response = client.rangeQuery(promql);
        } else {
            response = client.instantQuery(promql.expr());
        }

        long sampleCount = ResponseMapper.countSamples(response);
        if (sampleCount > config.maxSamples()) {
            throw new DataQueryException("RESULT_TOO_LARGE",
                "Response contains " + sampleCount + " samples (max: " + config.maxSamples() + ")");
        }

        return new QueryResult(ResponseMapper.toDataSetResult(response), promql.remainingOps());
    }

    private static int parseSeconds(String duration) {
        if (duration.endsWith("s")) {
            return Integer.parseInt(duration.substring(0, duration.length() - 1));
        }
        if (duration.endsWith("m")) {
            return Integer.parseInt(duration.substring(0, duration.length() - 1)) * 60;
        }
        return Integer.parseInt(duration);
    }
}
