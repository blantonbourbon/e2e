package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.FrameworkConfig;

public record OidcBootstrapContext(
        FrameworkConfig config,
        String scenarioArtifactId
) {
}
