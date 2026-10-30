package io.casehub.pages.data.json;

import java.util.List;

public record PreparedQuery(String sql, List<Object> params) {}
