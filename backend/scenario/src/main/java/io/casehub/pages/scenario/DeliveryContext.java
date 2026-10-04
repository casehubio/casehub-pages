package io.casehub.pages.scenario;

import java.util.Map;

public interface DeliveryContext {
    String config(String key);
    String resolve(String template);
    Map<String, Object> resolveMap(Map<String, Object> data);
}
