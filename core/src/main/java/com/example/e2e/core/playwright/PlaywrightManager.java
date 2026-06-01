package com.example.e2e.core.playwright;

import com.example.e2e.core.config.FrameworkConfig;
import com.example.e2e.core.context.ScenarioContext;
import com.microsoft.playwright.Page;

import java.util.Objects;

public final class PlaywrightManager {
    private static final ThreadLocal<PlaywrightSession> SESSION = new ThreadLocal<>();
    private static final ThreadLocal<ScenarioContext> CONTEXT = ThreadLocal.withInitial(ScenarioContext::new);
    private static FrameworkConfig config;
    private static PlaywrightFactory factory;

    private PlaywrightManager() {
    }

    public static void start(String scenarioArtifactId) {
        SESSION.set(factory().createSession(scenarioArtifactId));
    }

    public static Page page() {
        return Objects.requireNonNull(SESSION.get(), "Playwright session has not been started").page();
    }

    public static boolean hasSession() {
        return SESSION.get() != null;
    }

    public static ScenarioContext scenarioContext() {
        return CONTEXT.get();
    }

    public static FrameworkConfig config() {
        if (config == null) {
            factory();
        }
        return config;
    }

    public static void stop() {
        PlaywrightSession session = SESSION.get();
        if (session != null) {
            session.close();
            SESSION.remove();
        }
        CONTEXT.get().clear();
        CONTEXT.remove();
    }

    private static synchronized PlaywrightFactory factory() {
        if (factory == null) {
            config = FrameworkConfig.fromSystemProperties();
            factory = new PlaywrightFactory(config);
        }
        return factory;
    }
}
