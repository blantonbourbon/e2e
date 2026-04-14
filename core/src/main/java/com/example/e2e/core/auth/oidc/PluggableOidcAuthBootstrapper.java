package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.auth.AuthBootstrapResult;
import com.example.e2e.core.auth.AuthBootstrapper;
import com.example.e2e.core.config.AuthMode;
import com.example.e2e.core.config.OidcConfiguration;
import com.example.e2e.core.config.OidcHandlerType;
import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.ExecutionReporter;
import com.microsoft.playwright.BrowserContext;

import java.util.Objects;

public final class PluggableOidcAuthBootstrapper implements AuthBootstrapper {
    private final OidcHandlerRegistry handlerRegistry;

    public PluggableOidcAuthBootstrapper(OidcHandlerRegistry handlerRegistry) {
        this.handlerRegistry = Objects.requireNonNull(handlerRegistry, "handlerRegistry");
    }

    @Override
    public AuthBootstrapResult bootstrap(RuntimeConfiguration configuration, BrowserContext browserContext, ExecutionReporter reporter) {
        Objects.requireNonNull(configuration, "configuration");
        Objects.requireNonNull(browserContext, "browserContext");
        Objects.requireNonNull(reporter, "reporter");

        if (configuration.authMode() == AuthMode.BASELINE) {
            reporter.info("Auth mode baseline selected; no authentication bootstrap applied.");
            return AuthBootstrapResult.baseline();
        }

        OidcHandlerType handlerType = configuration.oidc()
            .map(OidcConfiguration::handler)
            .orElseThrow(() -> new IllegalStateException("OIDC configuration is required when auth mode is oidc."));
        reporter.info("Auth mode oidc selected; invoking handler " + handlerType.externalValue() + ".");

        OidcBootstrapResult oidcBootstrapResult = handlerRegistry.require(handlerType)
            .bootstrap(new OidcBootstrapContext(configuration, browserContext, reporter));
        reporter.attachment(
            "oidc-bootstrap.txt",
            "Auth mode: oidc\nHandler: " + oidcBootstrapResult.handlerType().externalValue() + "\nSummary: " + oidcBootstrapResult.summary()
        );
        return AuthBootstrapResult.oidc(oidcBootstrapResult);
    }
}
