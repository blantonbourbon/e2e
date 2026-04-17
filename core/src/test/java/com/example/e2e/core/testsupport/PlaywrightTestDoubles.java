package com.example.e2e.core.testsupport;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class PlaywrightTestDoubles {
    private PlaywrightTestDoubles() {
    }

    public static RecordingGraph recordingGraph() {
        return recordingGraph(new ArrayList<>());
    }

    public static RecordingGraph recordingGraph(List<String> events) {
        List<String> initScripts = new ArrayList<>();
        List<Map<String, String>> extraHttpHeaders = new ArrayList<>();
        List<String> navigations = new ArrayList<>();
        List<Boolean> configuredContexts = new ArrayList<>();

        Page page = proxy(Page.class, (proxy, method, args) -> switch (method.getName()) {
            case "navigate" -> {
                navigations.add((String) args[0]);
                events.add("navigate:" + args[0]);
                yield null;
            }
            case "close" -> null;
            default -> defaultValue(proxy, method, args);
        });

        BrowserContext context = proxy(BrowserContext.class, (proxy, method, args) -> switch (method.getName()) {
            case "newPage" -> page;
            case "addInitScript" -> {
                initScripts.add((String) args[0]);
                yield null;
            }
            case "setExtraHTTPHeaders" -> {
                extraHttpHeaders.add(Map.copyOf(castMap(args[0])));
                yield null;
            }
            case "close" -> {
                events.add("close:context");
                yield null;
            }
            default -> defaultValue(proxy, method, args);
        });

        Browser browser = proxy(Browser.class, (proxy, method, args) -> switch (method.getName()) {
            case "newContext" -> {
                if (args == null || args.length == 0) {
                    events.add("new-context:baseline");
                } else {
                    configuredContexts.add(true);
                    events.add("new-context:configured");
                }
                yield context;
            }
            case "close" -> {
                events.add("close:browser");
                yield null;
            }
            default -> defaultValue(proxy, method, args);
        });

        BrowserType browserType = proxy(BrowserType.class, (proxy, method, args) -> switch (method.getName()) {
            case "launch" -> {
                events.add("launch:chromium");
                yield browser;
            }
            default -> defaultValue(proxy, method, args);
        });

        Playwright playwright = proxy(Playwright.class, (proxy, method, args) -> switch (method.getName()) {
            case "chromium" -> browserType;
            case "close" -> {
                events.add("close:playwright");
                yield null;
            }
            default -> defaultValue(proxy, method, args);
        });

        return new RecordingGraph(playwright, context, initScripts, extraHttpHeaders, navigations, configuredContexts);
    }

    public record RecordingGraph(
        Playwright playwright,
        BrowserContext context,
        List<String> initScripts,
        List<Map<String, String>> extraHttpHeaders,
        List<String> navigations,
        List<Boolean> configuredContexts
    ) {
    }

    private static Object defaultValue(Object proxy, Method method, Object[] args) {
        if (method.getDeclaringClass() == Object.class) {
            return switch (method.getName()) {
                case "toString" -> proxy.getClass().getInterfaces()[0].getSimpleName() + "Proxy";
                case "hashCode" -> System.identityHashCode(proxy);
                case "equals" -> args != null && args.length == 1 && proxy == args[0];
                default -> null;
            };
        }

        Class<?> returnType = method.getReturnType();
        if (!returnType.isPrimitive()) {
            return null;
        }
        if (returnType == boolean.class) {
            return false;
        }
        if (returnType == char.class) {
            return '\0';
        }
        return 0;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> castMap(Object value) {
        return (Map<String, String>) Objects.requireNonNull(value);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }
}
