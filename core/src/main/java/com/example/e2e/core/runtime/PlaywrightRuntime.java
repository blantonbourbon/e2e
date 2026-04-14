package com.example.e2e.core.runtime;

import com.example.e2e.core.auth.AuthBootstrapResult;
import com.example.e2e.core.auth.AuthBootstrapper;
import com.example.e2e.core.config.RuntimeConfiguration;
import com.example.e2e.core.reporting.AllureExecutionReporter;
import com.example.e2e.core.reporting.ExecutionReporter;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;

import java.util.Objects;

public final class PlaywrightRuntime {
    private final PlaywrightFactory playwrightFactory;
    private final PlaywrightRuntimeOptions options;
    private final RuntimeHooks hooks;
    private final ExecutionReporter reporter;
    private final AuthBootstrapper authBootstrapper;

    public PlaywrightRuntime() {
        this(
            Playwright::create,
            PlaywrightRuntimeOptions.defaults(),
            RuntimeHooks.none(),
            new AllureExecutionReporter(),
            AuthBootstrapper.defaultBootstrapper()
        );
    }

    public PlaywrightRuntime(
        PlaywrightFactory playwrightFactory,
        PlaywrightRuntimeOptions options,
        RuntimeHooks hooks,
        ExecutionReporter reporter,
        AuthBootstrapper authBootstrapper
    ) {
        this.playwrightFactory = Objects.requireNonNull(playwrightFactory, "playwrightFactory");
        this.options = Objects.requireNonNull(options, "options");
        this.hooks = Objects.requireNonNull(hooks, "hooks");
        this.reporter = Objects.requireNonNull(reporter, "reporter");
        this.authBootstrapper = Objects.requireNonNull(authBootstrapper, "authBootstrapper");
    }

    public PlaywrightSession start() {
        return start(RuntimeConfiguration.load());
    }

    public PlaywrightSession start(RuntimeConfiguration configuration) {
        Objects.requireNonNull(configuration, "configuration");

        hooks.beforeSession(configuration, reporter);
        reporter.info("Starting Playwright runtime in " + configuration.authMode().name().toLowerCase() + " mode.");

        Playwright playwright = null;
        Browser browser = null;
        BrowserContext context = null;
        try {
            playwright = playwrightFactory.create();
            browser = launchBrowser(playwright);
            context = browser.newContext();
            AuthBootstrapResult authBootstrapResult = authBootstrapper.bootstrap(configuration, context, reporter);
            Page page = context.newPage();

            ManagedPlaywrightSession session = new ManagedPlaywrightSession(
                configuration,
                reporter,
                hooks,
                authBootstrapResult,
                playwright,
                browser,
                context,
                page
            );
            hooks.afterSessionStart(session);
            reporter.info("Playwright session is ready for " + configuration.baseUrl() + ".");
            return session;
        } catch (RuntimeException exception) {
            closeQuietly(context);
            closeQuietly(browser);
            closeQuietly(playwright);
            throw exception;
        }
    }

    private Browser launchBrowser(Playwright playwright) {
        BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
            .setHeadless(options.headless());

        return switch (options.normalizedBrowserName()) {
            case "chromium" -> playwright.chromium().launch(launchOptions);
            case "firefox" -> playwright.firefox().launch(launchOptions);
            case "webkit" -> playwright.webkit().launch(launchOptions);
            default -> throw new IllegalArgumentException(
                "Unsupported Playwright browser '" + options.browserName() + "'. Use chromium, firefox, or webkit."
            );
        };
    }

    private static void closeQuietly(BrowserContext context) {
        if (context != null) {
            context.close();
        }
    }

    private static void closeQuietly(Browser browser) {
        if (browser != null) {
            browser.close();
        }
    }

    private static void closeQuietly(Playwright playwright) {
        if (playwright != null) {
            playwright.close();
        }
    }

    private static final class ManagedPlaywrightSession implements PlaywrightSession {
        private final RuntimeConfiguration configuration;
        private final ExecutionReporter reporter;
        private final RuntimeHooks hooks;
        private final AuthBootstrapResult authBootstrapResult;
        private final Playwright playwright;
        private final Browser browser;
        private final BrowserContext context;
        private final Page page;
        private boolean closed;

        private ManagedPlaywrightSession(
            RuntimeConfiguration configuration,
            ExecutionReporter reporter,
            RuntimeHooks hooks,
            AuthBootstrapResult authBootstrapResult,
            Playwright playwright,
            Browser browser,
            BrowserContext context,
            Page page
        ) {
            this.configuration = configuration;
            this.reporter = reporter;
            this.hooks = hooks;
            this.authBootstrapResult = authBootstrapResult;
            this.playwright = playwright;
            this.browser = browser;
            this.context = context;
            this.page = page;
        }

        @Override
        public RuntimeConfiguration configuration() {
            return configuration;
        }

        @Override
        public ExecutionReporter reporter() {
            return reporter;
        }

        @Override
        public AuthBootstrapResult authBootstrapResult() {
            return authBootstrapResult;
        }

        @Override
        public Playwright playwright() {
            return playwright;
        }

        @Override
        public Browser browser() {
            return browser;
        }

        @Override
        public BrowserContext context() {
            return context;
        }

        @Override
        public Page page() {
            return page;
        }

        @Override
        public void navigateToBaseUrl() {
            page.navigate(configuration.baseUrl().toString());
            reporter.info("Navigated shared Playwright session to " + configuration.baseUrl() + ".");
        }

        @Override
        public void close() {
            if (closed) {
                return;
            }

            closed = true;
            hooks.beforeSessionClose(this);
            closeQuietly(context);
            closeQuietly(browser);
            closeQuietly(playwright);
            hooks.afterSessionClose(configuration, reporter);
        }
    }
}
