package com.example.e2e.core.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Locale;
import java.util.Objects;

public record FrameworkConfig(
        String baseUrl,
        boolean headless,
        int slowMo,
        String browser,
        boolean useLocalBrowser,
        String browserChannel,
        Path browserExecutablePath,
        Path artifactsRoot,
        Path tracesDir,
        Path screenshotsDir,
        Path videosDir,
        AuthMode authMode,
        OidcConfiguration oidc
) {
    public static FrameworkConfig fromSystemProperties() {
        return from(systemProperties(), System.getenv());
    }

    public static FrameworkConfig from(Map<String, String> properties, Map<String, String> environment) {
        Objects.requireNonNull(properties, "properties must not be null");
        Objects.requireNonNull(environment, "environment must not be null");

        Path artifactsRoot = Paths.get(property(properties, "artifacts.dir", "build/artifacts"));
        String browser = property(properties, "browser", "chromium");
        boolean windows = isWindows();
        boolean useLocalBrowser = Boolean.parseBoolean(
                property(properties, "playwright.use.local.browser", Boolean.toString(windows))
        );
        String browserChannel = property(properties, "browser.channel", null);
        String browserExecutablePath = property(properties, "browser.executable.path", null);
        AuthMode authMode = AuthMode.parse(configValue(properties, environment, "e2e.auth.mode", "E2E_AUTH_MODE", null));
        return new FrameworkConfig(
                parseBaseUrl(configValue(properties, environment, "e2e.baseUrl", "E2E_BASE_URL",
                        property(properties, "base.url", "https://playwright.dev"))),
                Boolean.parseBoolean(property(properties, "headless", "true")),
                parseInteger(property(properties, "slowmo", "0"), "slowmo"),
                browser,
                useLocalBrowser,
                defaultBrowserChannel(browser, windows, useLocalBrowser, browserChannel, browserExecutablePath),
                toPath(browserExecutablePath),
                artifactsRoot,
                artifactsRoot.resolve("traces"),
                artifactsRoot.resolve("screenshots"),
                artifactsRoot.resolve("videos"),
                authMode,
                oidcConfiguration(authMode, properties, environment)
        );
    }

    public boolean oidcEnabled() {
        return authMode == AuthMode.OIDC;
    }

    private static Map<String, String> systemProperties() {
        return System.getProperties().entrySet().stream()
                .collect(
                        java.util.stream.Collectors.toMap(
                                entry -> String.valueOf(entry.getKey()),
                                entry -> String.valueOf(entry.getValue())
                        )
                );
    }

    private static OidcConfiguration oidcConfiguration(
            AuthMode authMode,
            Map<String, String> properties,
            Map<String, String> environment
    ) {
        if (authMode != AuthMode.OIDC) {
            return null;
        }

        OidcHandlerType handlerType = OidcHandlerType.parse(
                configValue(properties, environment, "e2e.oidc.handler", "E2E_OIDC_HANDLER", null)
        );
        Path storageStatePath = toPath(configValue(
                properties,
                environment,
                "e2e.oidc.storageState",
                "E2E_OIDC_STORAGE_STATE",
                null
        ));
        String apiToken = configValue(properties, environment, "e2e.oidc.apiToken", "E2E_OIDC_API_TOKEN", null);

        return new OidcConfiguration(handlerType, storageStatePath, apiToken);
    }

    private static String parseBaseUrl(String value) {
        if (!hasText(value)) {
            throw new ConfigurationException(
                    "Missing base URL. Set e2e.baseUrl, E2E_BASE_URL, or legacy base.url to an absolute http(s) URL."
            );
        }

        String trimmedValue = value.trim();
        try {
            URI uri = new URI(trimmedValue);
            String scheme = uri.getScheme();
            if (!uri.isAbsolute()
                    || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
                    || !hasText(uri.getHost())) {
                throw new ConfigurationException(
                        "Invalid base URL '%s'. Set e2e.baseUrl, E2E_BASE_URL, or legacy base.url to an absolute http(s) URL with a host."
                                .formatted(value)
                );
            }
            return uri.toString();
        } catch (URISyntaxException exception) {
            throw new ConfigurationException(
                    "Invalid base URL '%s'. Set e2e.baseUrl, E2E_BASE_URL, or legacy base.url to an absolute http(s) URL with a host."
                            .formatted(value),
                    exception
            );
        }
    }

    private static int parseInteger(String value, String propertyName) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new ConfigurationException("Invalid integer for %s: %s".formatted(propertyName, value), exception);
        }
    }

    private static String configValue(
            Map<String, String> properties,
            Map<String, String> environment,
            String propertyName,
            String environmentName,
            String defaultValue
    ) {
        String propertyValue = properties.get(propertyName);
        if (hasText(propertyValue)) {
            return propertyValue;
        }

        String environmentValue = environment.get(environmentName);
        if (hasText(environmentValue)) {
            return environmentValue;
        }

        return defaultValue;
    }

    private static String property(Map<String, String> properties, String propertyName, String defaultValue) {
        String value = properties.get(propertyName);
        return hasText(value) ? value : defaultValue;
    }

    private static Path toPath(String value) {
        return hasText(value) ? Paths.get(value) : null;
    }

    private static String defaultBrowserChannel(
            String browser,
            boolean windows,
            boolean useLocalBrowser,
            String browserChannel,
            String browserExecutablePath
    ) {
        if (hasText(browserChannel)) {
            return browserChannel;
        }
        if (hasText(browserExecutablePath)) {
            return null;
        }
        if (windows && useLocalBrowser && "chromium".equalsIgnoreCase(browser)) {
            return "msedge";
        }
        return null;
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "")
                .toLowerCase(Locale.ROOT)
                .contains("win");
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
