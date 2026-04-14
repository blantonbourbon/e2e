package com.example.e2e.core.auth;

import com.example.e2e.core.auth.oidc.OidcHandlerRegistry;
import com.example.e2e.core.auth.oidc.PluggableOidcAuthBootstrapper;
import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.ExecutionReporter;
import com.microsoft.playwright.BrowserContext;

@FunctionalInterface
public interface AuthBootstrapper {
    AuthBootstrapResult bootstrap(RuntimeConfiguration configuration, BrowserContext browserContext, ExecutionReporter reporter);

    static AuthBootstrapper defaultBootstrapper() {
        return new PluggableOidcAuthBootstrapper(OidcHandlerRegistry.defaults());
    }
}
