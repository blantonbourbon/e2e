package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.auth.AuthBootstrapException;
import com.example.e2e.core.config.OidcHandlerType;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public final class ApiTokenOidcHandler implements OidcHandler {
    private final ApiTokenSupplier supplier;

    public ApiTokenOidcHandler(ApiTokenSupplier supplier) {
        this.supplier = Objects.requireNonNull(supplier, "supplier");
    }

    public static ApiTokenOidcHandler fakeDefault() {
        return new ApiTokenOidcHandler(configuration -> Optional.of(
            new ApiTokenMaterial("fake-api-token", "demo.auth.token", "Authorization")
        ));
    }

    @Override
    public OidcHandlerType type() {
        return OidcHandlerType.API_TOKEN;
    }

    @Override
    public OidcBootstrapResult bootstrap(OidcBootstrapContext context) {
        ApiTokenMaterial material = supplier.load(context.configuration())
            .orElseThrow(() -> new AuthBootstrapException(
                "API-token OIDC bootstrap could not load token material for "
                    + context.configuration().baseUrl()
                    + "."
            ));

        context.browserContext().setExtraHTTPHeaders(Map.of(material.headerName(), bearerToken(material.token())));
        context.browserContext().addInitScript(BrowserStateScript.seedLocalStorage(
            Map.of(
                material.storageKey(), material.token(),
                "demo.auth.handler", OidcHandlerType.API_TOKEN.externalValue()
            )
        ));
        context.reporter().info("OIDC bootstrap selected handler api-token.");
        context.reporter().attachment(
            "oidc-api-token.txt",
            "Seeded api-token bootstrap using header " + material.headerName()
        );

        return new OidcBootstrapResult(
            type(),
            "Seeded API token bootstrap using header " + material.headerName(),
            Map.of("headerName", material.headerName(), "storageKey", material.storageKey())
        );
    }

    private static String bearerToken(String token) {
        return token.startsWith("Bearer ") ? token : "Bearer " + token;
    }
}
