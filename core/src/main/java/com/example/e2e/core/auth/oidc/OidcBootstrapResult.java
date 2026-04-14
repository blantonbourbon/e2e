package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.OidcHandlerType;

import java.util.Map;
import java.util.Objects;

public record OidcBootstrapResult(OidcHandlerType handlerType, String summary, Map<String, String> metadata) {
    public OidcBootstrapResult {
        Objects.requireNonNull(handlerType, "handlerType");
        Objects.requireNonNull(summary, "summary");
        metadata = Map.copyOf(Objects.requireNonNull(metadata, "metadata"));
    }
}
