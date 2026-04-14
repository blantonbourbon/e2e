package com.example.e2e.core.reporting;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class InMemoryExecutionReporter implements ExecutionReporter {
    private final List<String> messages = new ArrayList<>();
    private final Map<String, String> attachments = new LinkedHashMap<>();

    @Override
    public void info(String message) {
        messages.add(message);
    }

    @Override
    public void attachment(String name, String content) {
        attachments.put(name, content);
    }

    public List<String> messages() {
        return List.copyOf(messages);
    }

    public Map<String, String> attachments() {
        return Map.copyOf(attachments);
    }
}
