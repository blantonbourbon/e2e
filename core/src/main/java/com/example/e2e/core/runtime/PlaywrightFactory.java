package com.example.e2e.core.runtime;

import com.microsoft.playwright.Playwright;

@FunctionalInterface
public interface PlaywrightFactory {
    Playwright create();
}
