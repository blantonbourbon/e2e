package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.FrameworkConfig;

import java.util.List;
import java.util.Objects;

public final class PluggableOidcAuthBootstrapper {
    private final OidcHandlerRegistry handlers;

    public PluggableOidcAuthBootstrapper() {
        this(new OidcHandlerRegistry(List.of(
                new SavedSessionOidcHandler(),
                new ApiTokenOidcHandler()
        )));
    }

    public PluggableOidcAuthBootstrapper(OidcHandlerRegistry handlers) {
        this.handlers = Objects.requireNonNull(handlers, "handlers must not be null");
    }

    public OidcBootstrapPlan prepare(FrameworkConfig config, String scenarioArtifactId) {
        Objects.requireNonNull(config, "config must not be null");
        if (!config.oidcEnabled()) {
            return OidcBootstrapPlan.baseline();
        }

        OidcBootstrapContext context = new OidcBootstrapContext(config, scenarioArtifactId);
        return handlers.handlerFor(config.oidc().handlerType()).bootstrap(context);
    }
}
