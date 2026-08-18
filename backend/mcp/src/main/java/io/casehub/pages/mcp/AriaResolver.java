package io.casehub.pages.mcp;

import io.casehub.pages.scenario.AriaTarget;
import io.casehub.platform.api.mcp.McpDomain;
import org.eclipse.microprofile.graphql.GraphQLApi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.graphql.Mutation;
import org.eclipse.microprofile.graphql.Query;

import java.util.Map;

@McpDomain("aria")
@GraphQLApi
@ApplicationScoped
public class AriaResolver {

    @Inject
    AriaCommandBridge bridge;

    @Query("findByRole")
    public AriaResult findByRole(String role, String name, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("find", target, null, null, null);
        return AriaResult.from(result);
    }

    @Mutation("click")
    public AriaResult click(String role, String name, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("click", target, null, null, null);
        return AriaResult.from(result);
    }

    @Mutation("fill")
    public AriaResult fill(String role, String name, String value, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("fill", target, value, null, null);
        return AriaResult.from(result);
    }

    @Mutation("select")
    public AriaResult select(String role, String name, String value, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("select", target, value, null, null);
        return AriaResult.from(result);
    }

    @Mutation("expand")
    public AriaResult expand(String role, String name, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("expand", target, null, null, null);
        return AriaResult.from(result);
    }

    @Mutation("collapse")
    public AriaResult collapse(String role, String name, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("collapse", target, null, null, null);
        return AriaResult.from(result);
    }

    @Query("assertState")
    public AriaResult assertState(String role, String name, Map<String, Object> state,
                                  AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("assert", target, null, state, null);
        return AriaResult.from(result);
    }

    @Query("waitFor")
    public AriaResult waitFor(String role, String name, Map<String, Object> state,
                              Integer timeout, AriaTarget within) {
        var target = new AriaTarget(role, name, within);
        var result = bridge.send("wait", target, null, state, timeout);
        return AriaResult.from(result);
    }
}
