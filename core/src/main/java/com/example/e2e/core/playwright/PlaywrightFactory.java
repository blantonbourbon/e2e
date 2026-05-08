package com.example.e2e.core.playwright;

import com.example.e2e.core.config.FrameworkConfig;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Tracing;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

public class PlaywrightFactory {
    private final FrameworkConfig config;

    public PlaywrightFactory(FrameworkConfig config) {
        this.config = Objects.requireNonNull(config, "config must not be null");
    }

    public PlaywrightSession createSession(String scenarioArtifactId) {
        ensureDirectories(config.tracesDir(), config.screenshotsDir(), config.videosDir());

        Playwright playwright = Playwright.create();
        BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
                .setHeadless(config.headless())
                .setSlowMo((double) config.slowMo());

        if (config.browserChannel() != null) {
            if (!"chromium".equalsIgnoreCase(config.browser())) {
                throw new IllegalStateException("browser.channel is only supported when browser=chromium");
            }
            launchOptions.setChannel(config.browserChannel());
        }

        if (config.browserExecutablePath() != null) {
            launchOptions.setExecutablePath(config.browserExecutablePath());
        }

        Browser browser = browserType(playwright)
                .launch(launchOptions);

        Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                .setBaseURL(config.baseUrl())
                .setIgnoreHTTPSErrors(true)
                .setRecordVideoDir(config.videosDir().resolve(scenarioArtifactId))
                .setViewportSize(1440, 900);

        BrowserContext context = browser.newContext(contextOptions);
        context.tracing().start(new Tracing.StartOptions()
                .setScreenshots(true)
                .setSnapshots(true)
                .setSources(true));

        Page page = context.newPage();
        return new PlaywrightSession(playwright, browser, context, page);
    }

    private BrowserType browserType(Playwright playwright) {
        return switch (config.browser().toLowerCase()) {
            case "firefox" -> playwright.firefox();
            case "webkit" -> playwright.webkit();
            case "chromium" -> playwright.chromium();
            default -> throw new IllegalArgumentException("Unsupported browser: " + config.browser());
        };
    }

    private void ensureDirectories(Path... paths) {
        for (Path path : paths) {
            try {
                Files.createDirectories(path);
            } catch (Exception exception) {
                throw new IllegalStateException("Unable to create directory: " + path, exception);
            }
        }
    }
}
