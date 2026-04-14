package com.example.e2e.core.config;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum OidcHandlerType {
    SAVED_SESSION,
    API_TOKEN;

    static OidcHandlerType parse(ConfigurationSource.ResolvedValue resolvedValue) {
        String value = normalized(resolvedValue.value());

        for (OidcHandlerType handlerType : values()) {
            if (handlerType.externalValue().equals(value)) {
                return handlerType;
            }
        }

        throw new ConfigurationException(
            "Invalid OIDC handler from "
                + resolvedValue.key()
                + ": '"
                + resolvedValue.value()
                + "'. Use e2e.oidc.handler or E2E_OIDC_HANDLER with one of: "
                + supportedValues()
                + "."
        );
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    public String externalValue() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    private static String supportedValues() {
        return Arrays.stream(values())
            .map(OidcHandlerType::externalValue)
            .collect(Collectors.joining(", "));
    }
}
