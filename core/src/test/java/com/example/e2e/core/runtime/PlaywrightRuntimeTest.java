package com.example.e2e.core.runtime;

import com.example.e2e.core.config.ConfigurationSource;
import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.InMemoryExecutionReporter;
import com.example.e2e.core.testsupport.PlaywrightTestDoubles;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaywrightRuntimeTest {
    @Test
    void startsManagedSessionWithHooksAndConfiguredStorageState() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(
                    "e2e.baseUrl", "http://localhost:3110",
                    "e2e.auth.storageStatePath", "playwright/.auth/demo-user.json"
                ),
                Map.of()
            )
        );
        List<String> events = new ArrayList<>();
        PlaywrightTestDoubles.RecordingGraph graph = PlaywrightTestDoubles.recordingGraph(events);
        InMemoryExecutionReporter reporter = new InMemoryExecutionReporter();
        ExecutionHook hook = new ExecutionHook() {
            @Override
            public void beforeSession(RuntimeConfiguration runtimeConfiguration, com.example.e2e.core.reporting.ExecutionReporter executionReporter) {
                events.add("hook.before-session");
            }

            @Override
            public void afterSessionStart(PlaywrightSession session) {
                events.add("hook.after-session-start");
            }

            @Override
            public void beforeSessionClose(PlaywrightSession session) {
                events.add("hook.before-session-close");
            }

            @Override
            public void afterSessionClose(RuntimeConfiguration runtimeConfiguration, com.example.e2e.core.reporting.ExecutionReporter executionReporter) {
                events.add("hook.after-session-close");
            }
        };

        PlaywrightRuntime runtime = new PlaywrightRuntime(
            graph::playwright,
            PlaywrightRuntimeOptions.defaults(),
            RuntimeHooks.of(hook),
            reporter
        );

        PlaywrightSession session = runtime.start(configuration);
        session.navigateToBaseUrl();
        session.close();

        assertEquals(configuration, session.configuration());
        assertEquals("http://localhost:3110", graph.navigations().get(0));
        assertEquals(List.of(true), graph.configuredContexts());
        assertTrue(reporter.messages().stream().anyMatch(message -> message.contains("playwright/.auth/demo-user.json")));
        assertEquals(
            List.of(
                "hook.before-session",
                "launch:chromium",
                "new-context:configured",
                "hook.after-session-start",
                "navigate:http://localhost:3110",
                "hook.before-session-close",
                "close:context",
                "close:browser",
                "close:playwright",
                "hook.after-session-close"
            ),
            events
        );
    }

    @Test
    void startsManagedSessionWithoutConfiguredStorageState() {
        RuntimeConfiguration configuration = RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of("e2e.baseUrl", "http://localhost:3110"),
                Map.of()
            )
        );
        List<String> events = new ArrayList<>();
        PlaywrightTestDoubles.RecordingGraph graph = PlaywrightTestDoubles.recordingGraph(events);

        PlaywrightSession session = new PlaywrightRuntime(
            graph::playwright,
            PlaywrightRuntimeOptions.defaults(),
            RuntimeHooks.none(),
            new InMemoryExecutionReporter()
        ).start(configuration);

        session.close();

        assertTrue(graph.configuredContexts().isEmpty());
        assertEquals(
            List.of(
                "launch:chromium",
                "new-context:baseline",
                "close:context",
                "close:browser",
                "close:playwright"
            ),
            events
        );
    }
}
