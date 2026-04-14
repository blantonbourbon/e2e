package com.example.e2e.core.config;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

public final class ConfigurationSource {
    private final Map<String, String> systemProperties;
    private final Map<String, String> environmentVariables;

    private ConfigurationSource(Map<String, String> systemProperties, Map<String, String> environmentVariables) {
        this.systemProperties = Map.copyOf(systemProperties);
        this.environmentVariables = Map.copyOf(environmentVariables);
    }

    public static ConfigurationSource of(Map<String, String> systemProperties, Map<String, String> environmentVariables) {
        return new ConfigurationSource(systemProperties, environmentVariables);
    }

    public static ConfigurationSource system() {
        return new ConfigurationSource(readSystemProperties(System.getProperties()), System.getenv());
    }

    ResolvedValue resolve(String propertyKey, String environmentKey) {
        if (systemProperties.containsKey(propertyKey)) {
            return new ResolvedValue(propertyKey, systemProperties.get(propertyKey));
        }

        if (environmentVariables.containsKey(environmentKey)) {
            return new ResolvedValue(environmentKey, environmentVariables.get(environmentKey));
        }

        return null;
    }

    private static Map<String, String> readSystemProperties(Properties properties) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String propertyName : properties.stringPropertyNames()) {
            values.put(propertyName, properties.getProperty(propertyName));
        }
        return values;
    }

    record ResolvedValue(String key, String value) {
    }
}
