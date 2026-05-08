package com.example.e2e.core.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;

public record FrameworkConfig(
        String baseUrl,
        boolean headless,
        int slowMo,
        String browser,
        boolean useLocalBrowser,
        String browserChannel,
        Path browserExecutablePath,
        Path tracesDir,
        Path screenshotsDir,
        Path videosDir
) {
    public static FrameworkConfig fromSystemProperties() {
        Path artifactsRoot = Paths.get(System.getProperty("artifacts.dir", "build/artifacts"));
        String browser = System.getProperty("browser", "chromium");
        boolean windows = isWindows();
        boolean useLocalBrowser = Boolean.parseBoolean(
                System.getProperty("playwright.use.local.browser", Boolean.toString(windows))
        );
        String browserChannel = System.getProperty("browser.channel");
        String browserExecutablePath = System.getProperty("browser.executable.path");
        return new FrameworkConfig(
                System.getProperty("base.url", "https://playwright.dev"),
                Boolean.parseBoolean(System.getProperty("headless", "true")),
                Integer.getInteger("slowmo", 0),
                browser,
                useLocalBrowser,
                defaultBrowserChannel(browser, windows, useLocalBrowser, browserChannel, browserExecutablePath),
                toPath(browserExecutablePath),
                artifactsRoot.resolve("traces"),
                artifactsRoot.resolve("screenshots"),
                artifactsRoot.resolve("videos")
        );
    }

    private static Path toPath(String value) {
        return hasText(value) ? Paths.get(value) : null;
    }

    private static String defaultBrowserChannel(
            String browser,
            boolean windows,
            boolean useLocalBrowser,
            String browserChannel,
            String browserExecutablePath
    ) {
        if (hasText(browserChannel)) {
            return browserChannel;
        }
        if (hasText(browserExecutablePath)) {
            return null;
        }
        if (windows && useLocalBrowser && "chromium".equalsIgnoreCase(browser)) {
            return "msedge";
        }
        return null;
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "")
                .toLowerCase(Locale.ROOT)
                .contains("win");
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
