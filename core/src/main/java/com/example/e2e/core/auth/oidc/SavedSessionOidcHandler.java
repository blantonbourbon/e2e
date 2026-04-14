package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.auth.AuthBootstrapException;
import com.example.e2e.core.config.OidcHandlerType;

import java.util.Map;
import java.util.Objects;

public final class SavedSessionOidcHandler implements OidcHandler {
    private final SavedSessionMaterialSupplier supplier;

    public SavedSessionOidcHandler(SavedSessionMaterialSupplier supplier) {
        this.supplier = Objects.requireNonNull(supplier, "supplier");
    }

    public static SavedSessionOidcHandler fakeDefault() {
        return new SavedSessionOidcHandler(configuration -> java.util.Optional.of(
            new SavedSessionMaterial(
                "demo-user",
                Map.of(
                    "demo.auth.mode", "oidc",
                    "demo.auth.subject", "demo-user",
                    "demo.auth.handler", OidcHandlerType.SAVED_SESSION.externalValue()
                )
            )
        ));
    }

    @Override
    public OidcHandlerType type() {
        return OidcHandlerType.SAVED_SESSION;
    }

    @Override
    public OidcBootstrapResult bootstrap(OidcBootstrapContext context) {
        SavedSessionMaterial material = supplier.load(context.configuration())
            .orElseThrow(() -> new AuthBootstrapException(
                "Saved-session OIDC bootstrap could not load session material for "
                    + context.configuration().baseUrl()
                    + "."
            ));

        context.browserContext().addInitScript(BrowserStateScript.seedLocalStorage(material.localStorageEntries()));
        context.reporter().info("OIDC bootstrap selected handler saved-session.");
        context.reporter().attachment(
            "oidc-saved-session.txt",
            "Seeded saved-session bootstrap for subject " + material.subject()
        );

        return new OidcBootstrapResult(
            type(),
            "Seeded saved-session state for " + material.subject(),
            Map.of("subject", material.subject())
        );
    }
}
