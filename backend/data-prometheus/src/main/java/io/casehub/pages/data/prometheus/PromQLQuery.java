package io.casehub.pages.data.prometheus;

import io.casehub.pages.data.DataSetOp;

import java.util.List;

public record PromQLQuery(
    String expr,
    String start,
    String end,
    String step,
    List<DataSetOp> remainingOps
) {}
