package com.example.e2e.core.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Objects;
import java.util.Optional;

public record RuntimeConfiguration(URI baseUrl, AuthMode authMode, Optional<OidcConfiguration> oidc) {
    private static final String BASE_URL_PROPERTY = "e2e.baseUrl";
    private static final String BASE_URL_ENVIRONMENT = "E2E_BASE_URL";
    private static final String AUTH_MODE_PROPERTY = "e2e.auth.mode";
    private static final String AUTH_MODE_ENVIRONMENT = "E2E_AUTH_MODE";
    private static final String OIDC_HANDLER_PROPERTY = "e2e.oidc.handler";
    private static final String OIDC_HANDLER_ENVIRONMENT = "E2E_OIDC_HANDLER";

    public RuntimeConfiguration {
        Objects.requireNonNull(baseUrl, "baseUrl");
        Objects.requireNonNull(authMode, "authMode");
        oidc = Objects.requireNonNull(oidc, "oidc");
    }

    public static RuntimeConfiguration load() {
        return load(ConfigurationSource.system());
    }

    public static RuntimeConfiguration load(ConfigurationSource source) {
        ConfigurationSource.ResolvedValue baseUrlValue = source.resolve(BASE_URL_PROPERTY, BASE_URL_ENVIRONMENT);
        URI baseUrl = parseBaseUrl(baseUrlValue);

        ConfigurationSource.ResolvedValue authModeValue = source.resolve(AUTH_MODE_PROPERTY, AUTH_MODE_ENVIRONMENT);
        AuthMode authMode = authModeValue == null ? AuthMode.BASELINE : AuthMode.parse(authModeValue);

        Optional<OidcConfiguration> oidcConfiguration = switch (authMode) {
            case BASELINE -> Optional.empty();
            case OIDC -> Optional.of(new OidcConfiguration(parseOidcHandler(source.resolve(OIDC_HANDLER_PROPERTY, OIDC_HANDLER_ENVIRONMENT))));
        };

        return new RuntimeConfiguration(baseUrl, authMode, oidcConfiguration);
    }

    private static URI parseBaseUrl(ConfigurationSource.ResolvedValue baseUrlValue) {
        if (baseUrlValue == null) {
            throw new ConfigurationException(
                "Missing base URL configuration. Set "
                    + BASE_URL_PROPERTY
                    + " or "
                    + BASE_URL_ENVIRONMENT
                    + " to an absolute http(s) URL."
            );
        }

        String rawValue = normalized(baseUrlValue.value());
        if (rawValue.isEmpty()) {
            throw new ConfigurationException(
                "Invalid base URL from "
                    + baseUrlValue.key()
                    + ": value is blank. Set "
                    + BASE_URL_PROPERTY
                    + " or "
                    + BASE_URL_ENVIRONMENT
                    + " to an absolute http(s) URL."
            );
        }

        try {
            URI uri = new URI(rawValue);
            String scheme = uri.getScheme();
            if (!uri.isAbsolute() || scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
                throw invalidBaseUrl(baseUrlValue);
            }
            return uri;
        } catch (URISyntaxException exception) {
            throw invalidBaseUrl(baseUrlValue);
        }
    }

    private static OidcHandlerType parseOidcHandler(ConfigurationSource.ResolvedValue handlerValue) {
        if (handlerValue == null || normalized(handlerValue.value()).isEmpty()) {
            throw new ConfigurationException(
                "OIDC mode requires an OIDC handler. Set "
                    + OIDC_HANDLER_PROPERTY
                    + " or "
                    + OIDC_HANDLER_ENVIRONMENT
                    + " to one of: "
                    + supportedOidcHandlers()
                    + "."
            );
        }

        return OidcHandlerType.parse(handlerValue);
    }

    private static ConfigurationException invalidBaseUrl(ConfigurationSource.ResolvedValue baseUrlValue) {
        return new ConfigurationException(
            "Invalid base URL from "
                + baseUrlValue.key()
                + ": '"
                + baseUrlValue.value()
                + "'. Use "
                + BASE_URL_PROPERTY
                + " or "
                + BASE_URL_ENVIRONMENT
                + " with an absolute http(s) URL."
        );
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim();
    }

    private static String supportedOidcHandlers() {
        return String.join(", ",
            OidcHandlerType.SAVED_SESSION.externalValue(),
            OidcHandlerType.API_TOKEN.externalValue()
        );
    }
}
