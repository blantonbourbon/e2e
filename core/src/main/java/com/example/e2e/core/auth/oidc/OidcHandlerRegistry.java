package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.auth.AuthBootstrapException;
import com.example.e2e.core.config.OidcHandlerType;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

public final class OidcHandlerRegistry {
    private final Map<OidcHandlerType, OidcHandler> handlers;

    public OidcHandlerRegistry(Collection<? extends OidcHandler> handlers) {
        Objects.requireNonNull(handlers, "handlers");
        Map<OidcHandlerType, OidcHandler> byType = new LinkedHashMap<>();
        for (OidcHandler handler : handlers) {
            OidcHandler nonNullHandler = Objects.requireNonNull(handler, "handler");
            byType.put(nonNullHandler.type(), nonNullHandler);
        }
        this.handlers = Map.copyOf(byType);
    }

    public static OidcHandlerRegistry defaults() {
        return new OidcHandlerRegistry(Arrays.asList(
            SavedSessionOidcHandler.fakeDefault(),
            ApiTokenOidcHandler.fakeDefault()
        ));
    }

    public OidcHandler require(OidcHandlerType handlerType) {
        OidcHandler handler = handlers.get(handlerType);
        if (handler != null) {
            return handler;
        }

        throw new AuthBootstrapException(
            "No OIDC bootstrap handler is registered for '"
                + handlerType.externalValue()
                + "'. Registered handlers: "
                + supportedHandlers()
                + "."
        );
    }

    private String supportedHandlers() {
        return handlers.keySet().stream()
            .map(OidcHandlerType::externalValue)
            .collect(Collectors.joining(", "));
    }
}
