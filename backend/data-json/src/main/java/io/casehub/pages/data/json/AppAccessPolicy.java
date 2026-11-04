package io.casehub.pages.data.json;

import java.util.List;
import java.util.Set;

public record AppAccessPolicy(
    AccessRule read,
    AccessRule write
) {
    public static final AppAccessPolicy DEFAULT = new AppAccessPolicy(
        new AccessRule(List.of()),
        new AccessRule(List.of("admin", "developer"))
    );

    public record AccessRule(List<String> roles) {
        public AccessRule {
            if (roles == null) roles = List.of();
            roles = List.copyOf(roles);
        }

        public boolean isSatisfiedBy(Set<String> userRoles) {
            if (roles.isEmpty()) {return true;}
            if (roles.contains("authenticated")) {return true;}
            return roles.stream().anyMatch(userRoles::contains);
        }
    }
}
