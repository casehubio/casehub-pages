package io.casehub.pages.playbook.runtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.playbook.ParamDescriptor;
import org.eclipse.microprofile.graphql.GraphQLApi;
import org.eclipse.microprofile.graphql.Description;
import org.eclipse.microprofile.graphql.Name;
import org.eclipse.microprofile.graphql.Source;

import java.util.List;

@GraphQLApi
public class ParamDescriptorResolver {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Name("defaultValue")
    @Description("JSON-encoded default value. Strings are quoted (e.g. \"\\\"blank\\\"\"), numbers and booleans are bare (e.g. \"42\", \"true\"). Parse with JSON.parse().")
    public String defaultValue(@Source ParamDescriptor param) {
        if (param.defaultValue() == null) return null;
        return toJsonString(param.defaultValue());
    }

    @Name("enumValues")
    @Description("JSON-encoded enum values. Each element is a JSON literal — parse individually with JSON.parse().")
    public List<String> enumValues(@Source ParamDescriptor param) {
        return param.enumValues().stream()
                .map(ParamDescriptorResolver::toJsonString)
                .toList();
    }

    private static String toJsonString(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return String.valueOf(value);
        }
    }
}
