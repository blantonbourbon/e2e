package com.example.e2e.core.runtime;

import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.ExecutionReporter;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

public final class RuntimeHooks implements ExecutionHook {
    private final List<ExecutionHook> hooks;

    private RuntimeHooks(List<ExecutionHook> hooks) {
        this.hooks = List.copyOf(hooks);
    }

    public static RuntimeHooks none() {
        return new RuntimeHooks(List.of());
    }

    public static RuntimeHooks of(ExecutionHook... hooks) {
        return new RuntimeHooks(Arrays.stream(hooks)
            .map(hook -> Objects.requireNonNull(hook, "hook"))
            .toList());
    }

    @Override
    public void beforeSession(RuntimeConfiguration configuration, ExecutionReporter reporter) {
        hooks.forEach(hook -> hook.beforeSession(configuration, reporter));
    }

    @Override
    public void afterSessionStart(PlaywrightSession session) {
        hooks.forEach(hook -> hook.afterSessionStart(session));
    }

    @Override
    public void beforeSessionClose(PlaywrightSession session) {
        hooks.forEach(hook -> hook.beforeSessionClose(session));
    }

    @Override
    public void afterSessionClose(RuntimeConfiguration configuration, ExecutionReporter reporter) {
        hooks.forEach(hook -> hook.afterSessionClose(configuration, reporter));
    }
}
