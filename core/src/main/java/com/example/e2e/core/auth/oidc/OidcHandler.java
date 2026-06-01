package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.OidcHandlerType;

public interface OidcHandler {
    OidcHandlerType type();

    OidcBootstrapPlan bootstrap(OidcBootstrapContext context);
}
