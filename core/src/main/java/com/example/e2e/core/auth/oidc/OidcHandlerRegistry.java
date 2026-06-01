package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.config.ConfigurationException;
import com.example.e2e.core.config.OidcHandlerType;

import java.util.Collection;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

public final class OidcHandlerRegistry {
    private final Map<OidcHandlerType, OidcHandler> handlers = new EnumMap<>(OidcHandlerType.class);

    public OidcHandlerRegistry(Collection<? extends OidcHandler> handlers) {
        Objects.requireNonNull(handlers, "handlers must not be null")
                .forEach(this::register);
    }

    public OidcHandler handlerFor(OidcHandlerType type) {
        OidcHandler handler = handlers.get(type);
        if (handler == null) {
            throw new ConfigurationException(
                    "No OIDC handler registered for '%s'. Registered handlers: %s"
                            .formatted(type.configValue(), registeredHandlers())
            );
        }
        return handler;
    }

    private void register(OidcHandler handler) {
        Objects.requireNonNull(handler, "handler must not be null");
        OidcHandler previous = handlers.putIfAbsent(handler.type(), handler);
        if (previous != null) {
            throw new ConfigurationException(
                    "Duplicate OIDC handler registration for '%s': %s and %s"
                            .formatted(handler.type().configValue(), previous.getClass().getName(), handler.getClass().getName())
            );
        }
    }

    private String registeredHandlers() {
        if (handlers.isEmpty()) {
            return "<none>";
        }
        return handlers.keySet().stream()
                .map(OidcHandlerType::configValue)
                .collect(Collectors.joining(", "));
    }
}
