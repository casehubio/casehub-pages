package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ScriptDescriptor;
import io.casehub.pages.playbook.ScriptMeta;
import jakarta.inject.Inject;
import org.eclipse.microprofile.graphql.Description;
import org.eclipse.microprofile.graphql.GraphQLApi;
import org.eclipse.microprofile.graphql.Mutation;
import org.eclipse.microprofile.graphql.Name;
import org.eclipse.microprofile.graphql.Query;

import java.util.List;

@GraphQLApi
public class PlaybookLibraryGraphQL {

    @Inject
    ScriptRegistry registry;

    PlaybookLibraryGraphQL() {}

    PlaybookLibraryGraphQL(ScriptRegistry registry) {
        this.registry = registry;
    }

    @Query("scriptLibrary")
    @Description("List scripts, optionally filtered by labels and tags")
    public List<ScriptDescriptor> scriptLibrary(
            @Name("labels") List<String> labels,
            @Name("tags") List<String> tags) {
        return registry.list(labels, tags);
    }

    @Query("scriptDescriptor")
    @Description("Get a single script descriptor by name")
    public ScriptDescriptor scriptDescriptor(@Name("name") String name) {
        return registry.get(name).orElse(null);
    }

    @Query("scriptYaml")
    @Description("Get raw YAML content of a script")
    public String scriptYaml(@Name("name") String name) {
        return registry.getYaml(name).orElse(null);
    }

    @Mutation("uploadScript")
    @Description("Upload a new script from YAML content")
    public ScriptDescriptor uploadScript(@Name("yaml") String yaml) {
        return registry.upload(yaml);
    }

    @Mutation("updateScriptMeta")
    @Description("Update metadata for an uploaded script")
    public ScriptDescriptor updateScriptMeta(
            @Name("name") String name,
            @Name("description") String description,
            @Name("labels") List<String> labels,
            @Name("tags") List<String> tags) {
        return registry.updateMeta(name, new ScriptMeta(description, labels, tags));
    }

    @Mutation("deleteScript")
    @Description("Delete an uploaded script")
    public boolean deleteScript(@Name("name") String name) {
        return registry.delete(name);
    }
}
