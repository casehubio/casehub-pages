package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ScriptDescriptor;

import java.util.List;
import java.util.Optional;

public interface ScriptSource {
    List<ScriptDescriptor> list();
    Optional<String> getYaml(String name);
    boolean contains(String name);
}
