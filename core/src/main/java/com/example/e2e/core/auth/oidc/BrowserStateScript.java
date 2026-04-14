package com.example.e2e.core.auth.oidc;

import java.util.Map;
import java.util.stream.Collectors;

final class BrowserStateScript {
    private BrowserStateScript() {
    }

    static String seedLocalStorage(Map<String, String> entries) {
        return entries.entrySet().stream()
            .map(entry -> "window.localStorage.setItem(" + quoted(entry.getKey()) + ", " + quoted(entry.getValue()) + ");")
            .collect(Collectors.joining("\n"));
    }

    private static String quoted(String value) {
        return "\"" + value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t") + "\"";
    }
}
