package com.example.e2e.core.hooks;

import com.example.e2e.core.artifacts.ArtifactNaming;
import com.example.e2e.core.playwright.PlaywrightManager;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import io.qameta.allure.Allure;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class CucumberHooks {
    @Before(order = 0)
    public void beforeScenario(Scenario scenario) {
        PlaywrightManager.start(scenarioArtifactId(scenario));
    }

    @After(order = 100)
    public void afterScenario(Scenario scenario) {
        try {
            if (scenario.isFailed()) {
                byte[] screenshot = PlaywrightManager.page().screenshot();
                scenario.attach(screenshot, "image/png", scenario.getName());
                Allure.addAttachment("Failure screenshot", "image/png", new ByteArrayInputStream(screenshot), ".png");
            }

            Path tracePath = PlaywrightManager.config().tracesDir()
                    .resolve(scenarioArtifactId(scenario) + ".zip");
            PlaywrightManager.page().context().tracing().stop(
                    new com.microsoft.playwright.Tracing.StopOptions().setPath(tracePath)
            );

            if (scenario.isFailed()) {
                attachTrace(tracePath);
            }
        } finally {
            PlaywrightManager.stop();
        }
    }

    private String scenarioArtifactId(Scenario scenario) {
        return ArtifactNaming.scenarioArtifactId(scenario.getId(), scenario.getName());
    }

    private void attachTrace(Path tracePath) {
        try (InputStream traceInputStream = Files.newInputStream(tracePath)) {
            Allure.addAttachment("Playwright trace", "application/zip", traceInputStream, ".zip");
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to attach trace file: " + tracePath, exception);
        }
    }
}
