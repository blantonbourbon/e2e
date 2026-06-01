package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.ConfigurationException;
import com.example.e2e.core.config.OidcHandlerType;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

public final class SavedSessionOidcHandler implements OidcHandler {
    @Override
    public OidcHandlerType type() {
        return OidcHandlerType.SAVED_SESSION;
    }

    @Override
    public OidcBootstrapPlan bootstrap(OidcBootstrapContext context) {
        Path storageStatePath = context.config().oidc().storageStatePath();
        if (storageStatePath == null) {
            storageStatePath = context.config()
                    .artifactsRoot()
                    .resolve("auth")
                    .resolve(context.scenarioArtifactId() + "-saved-session.json");
            writeRepoLocalStorageState(storageStatePath, origin(context.config().baseUrl()));
        } else if (!Files.exists(storageStatePath)) {
            throw new ConfigurationException("OIDC saved-session storage state does not exist: " + storageStatePath);
        }

        return new OidcBootstrapPlan(
                "oidc saved-session handler using storage state " + storageStatePath,
                storageStatePath,
                null,
                null
        );
    }

    private void writeRepoLocalStorageState(Path storageStatePath, String origin) {
        Objects.requireNonNull(storageStatePath.getParent(), "storageStatePath parent must not be null");
        try {
            Files.createDirectories(storageStatePath.getParent());
            Files.writeString(storageStatePath, """
                    {
                      "cookies": [],
                      "origins": [
                        {
                          "origin": "%s",
                          "localStorage": [
                            { "name": "sample-app-role", "value": "standard visitor" },
                            { "name": "sample-app-auth-source", "value": "oidc-saved-session" },
                            { "name": "migration-demo-role", "value": "standard visitor" }
                          ]
                        }
                      ]
                    }
                    """.formatted(escapeJson(origin)));
        } catch (IOException exception) {
            throw new ConfigurationException("Unable to write repo-local OIDC storage state: " + storageStatePath, exception);
        }
    }

    private String origin(String baseUrl) {
        URI uri = URI.create(baseUrl);
        String port = uri.getPort() == -1 ? "" : ":" + uri.getPort();
        return uri.getScheme() + "://" + uri.getHost() + port;
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
