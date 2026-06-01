package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.OidcHandlerType;

import java.util.Map;

public final class ApiTokenOidcHandler implements OidcHandler {
    @Override
    public OidcHandlerType type() {
        return OidcHandlerType.API_TOKEN;
    }

    @Override
    public OidcBootstrapPlan bootstrap(OidcBootstrapContext context) {
        String apiToken = context.config().oidc().apiToken();
        if (apiToken == null || apiToken.isBlank()) {
            apiToken = "repo-local-fake-token";
        }

        return new OidcBootstrapPlan(
                "oidc api-token handler using repo-local token material",
                null,
                Map.of("Authorization", "Bearer " + apiToken),
                """
                        localStorage.setItem("sample-app-role", "standard visitor");
                        localStorage.setItem("sample-app-auth-source", "oidc-api-token");
                        """
        );
    }
}
