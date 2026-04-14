package com.example.e2e.core.auth.oidc;

import com.example.e2e.core.auth.AuthBootstrapException;
import com.example.e2e.core.auth.AuthBootstrapResult;
import com.example.e2e.core.config.ConfigurationSource;
import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.InMemoryExecutionReporter;
import com.example.e2e.core.testsupport.PlaywrightTestDoubles;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PluggableOidcAuthBootstrapperTest {
    @Test
    void selectsSavedSessionHandlerFromSharedRuntimeConfiguration() {
        PlaywrightTestDoubles.RecordingGraph graph = PlaywrightTestDoubles.recordingGraph();
        InMemoryExecutionReporter reporter = new InMemoryExecutionReporter();
        AuthBootstrapResult result = new PluggableOidcAuthBootstrapper(
            new OidcHandlerRegistry(List.of(
                new SavedSessionOidcHandler(configuration -> Optional.of(
                    new SavedSessionMaterial(
                        "demo-user",
                        Map.of(
                            "demo.auth.mode", "oidc",
                            "demo.auth.subject", "demo-user"
                        )
                    )
                )),
                new ApiTokenOidcHandler(configuration -> Optional.of(
                    new ApiTokenMaterial("demo-token", "demo.auth.token", "Authorization")
                ))
            ))
        ).bootstrap(savedSessionConfiguration(), graph.context(), reporter);

        assertEquals("saved-session", result.oidc().orElseThrow().handlerType().externalValue());
        assertTrue(graph.initScripts().get(0).contains("demo.auth.subject"));
        assertTrue(reporter.messages().stream().anyMatch(message -> message.contains("saved-session")));
    }

    @Test
    void selectsApiTokenHandlerFromSharedRuntimeConfiguration() {
        PlaywrightTestDoubles.RecordingGraph graph = PlaywrightTestDoubles.recordingGraph();
        AuthBootstrapResult result = new PluggableOidcAuthBootstrapper(
            OidcHandlerRegistry.defaults()
        ).bootstrap(apiTokenConfiguration(), graph.context(), new InMemoryExecutionReporter());

        assertEquals("api-token", result.oidc().orElseThrow().handlerType().externalValue());
        assertEquals("Bearer fake-api-token", graph.extraHttpHeaders().get(0).get("Authorization"));
        assertTrue(graph.initScripts().get(0).contains("demo.auth.token"));
    }

    @Test
    void failsClearlyWhenConfiguredOidcHandlerIsUnavailable() {
        PlaywrightTestDoubles.RecordingGraph graph = PlaywrightTestDoubles.recordingGraph();
        AuthBootstrapException exception = assertThrows(
            AuthBootstrapException.class,
            () -> new PluggableOidcAuthBootstrapper(
                new OidcHandlerRegistry(List.of(
                    new SavedSessionOidcHandler(configuration -> Optional.of(
                        new SavedSessionMaterial("demo-user", Map.of("demo.auth.subject", "demo-user"))
                    ))
                ))
            ).bootstrap(apiTokenConfiguration(), graph.context(), new InMemoryExecutionReporter())
        );

        assertTrue(exception.getMessage().contains("api-token"));
        assertTrue(exception.getMessage().contains("saved-session"));
    }

    private static RuntimeConfiguration savedSessionConfiguration() {
        return RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(
                    "e2e.baseUrl", "http://localhost:3110",
                    "e2e.auth.mode", "oidc",
                    "e2e.oidc.handler", "saved-session"
                ),
                Map.of()
            )
        );
    }

    private static RuntimeConfiguration apiTokenConfiguration() {
        return RuntimeConfiguration.load(
            ConfigurationSource.of(
                Map.of(
                    "e2e.baseUrl", "http://localhost:3110",
                    "e2e.auth.mode", "oidc",
                    "e2e.oidc.handler", "api-token"
                ),
                Map.of()
            )
        );
    }
}
