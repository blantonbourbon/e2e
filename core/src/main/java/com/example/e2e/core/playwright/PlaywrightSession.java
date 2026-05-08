package com.example.e2e.core.playwright;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;

public record PlaywrightSession(
        Playwright playwright,
        Browser browser,
        BrowserContext browserContext,
        Page page
) {
    public void close() {
        page.close();
        browserContext.close();
        browser.close();
        playwright.close();
    }
}
