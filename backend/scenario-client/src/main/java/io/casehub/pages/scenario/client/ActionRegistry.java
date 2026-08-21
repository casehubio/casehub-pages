package io.casehub.pages.scenario.client;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class ActionRegistry {

    private record ActionHandler(Object bean, Method method) {}

    private final Map<String, ActionHandler> handlers;

    private ActionRegistry(Map<String, ActionHandler> handlers) {
        this.handlers = Map.copyOf(handlers);
    }

    public static ActionRegistry scan(List<Object> beans) {
        var handlers = new HashMap<String, ActionHandler>();
        for (var bean : beans) {
            Class<?> clazz = bean.getClass();
            while (clazz != null && clazz != Object.class) {
                for (var method : clazz.getDeclaredMethods()) {
                    var annotation = method.getAnnotation(ScenarioAction.class);
                    if (annotation != null && !handlers.containsKey(annotation.value())) {
                        method.setAccessible(true);
                        handlers.put(annotation.value(), new ActionHandler(bean, method));
                    }
                }
                clazz = clazz.getSuperclass();
            }
        }
        return new ActionRegistry(handlers);
    }

    public Set<String> actions() {
        return handlers.keySet();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> invoke(String action, ActionContext ctx) throws Exception {
        var handler = handlers.get(action);
        if (handler == null) {
            throw new IllegalArgumentException("No handler for action: " + action);
        }
        try {
            var result = handler.method().invoke(handler.bean(), ctx);
            if (result instanceof Map<?, ?> map) {
                return (Map<String, Object>) map;
            }
            return Map.of();
        } catch (InvocationTargetException e) {
            if (e.getCause() instanceof Exception ex) throw ex;
            throw e;
        }
    }
}
