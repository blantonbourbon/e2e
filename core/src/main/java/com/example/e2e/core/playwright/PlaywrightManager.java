package com.example.e2e.core.playwright;

import com.example.e2e.core.config.FrameworkConfig;
import com.example.e2e.core.context.ScenarioContext;
import com.microsoft.playwright.Page;

import java.util.Objects;

public final class PlaywrightManager {
    private static final ThreadLocal<PlaywrightSession> SESSION = new ThreadLocal<>();
    private static final ThreadLocal<ScenarioContext> CONTEXT = ThreadLocal.withInitial(ScenarioContext::new);
    private static final FrameworkConfig CONFIG = FrameworkConfig.fromSystemProperties();
    private static final PlaywrightFactory FACTORY = new PlaywrightFactory(CONFIG);

    private PlaywrightManager() {
    }

    public static void start(String scenarioArtifactId) {
        SESSION.set(FACTORY.createSession(scenarioArtifactId));
    }

    public static Page page() {
        return Objects.requireNonNull(SESSION.get(), "Playwright session has not been started").page();
    }

    public static ScenarioContext scenarioContext() {
        return CONTEXT.get();
    }

    public static FrameworkConfig config() {
        return CONFIG;
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
}
