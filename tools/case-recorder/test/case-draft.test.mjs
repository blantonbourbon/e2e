import test from "node:test";
import assert from "node:assert/strict";
import { generateCaseDraft } from "../src/case-draft.mjs";

test("generates a draft from navigation and title assertions", () => {
  const recording = `
    page.navigate("https://example.test/catalog?sort=featured");
    assertThat(page).hasTitle(Pattern.compile(".*Catalog.*"));
  `;

  const draft = generateCaseDraft(recording, {
    area: "demoapp",
    feature: "catalog-smoke",
    scenario: "Visitor opens the catalog",
    baseUrl: "https://example.test",
    path: "/"
  });

  assert.deepEqual(draft.steps, [
    'Given the user opens the relative path "/catalog?sort=featured"',
    'Then the page title should contain "Catalog"'
  ]);
  assert.equal(draft.unsupportedActions.length, 0);
  assert.match(draft.files.feature, /@demoapp @draft/);
  assert.match(draft.files.feature, /Scenario: Visitor opens the catalog/);
  assert.deepEqual(JSON.parse(draft.files.draftPack).steps, draft.steps);
  assert.match(draft.files.summary, /Supported actions: 2/);
});

test("keeps recorded navigation aligned with a path-prefixed base URL target", () => {
  const recording = `
    page.navigate("https://app.example.test/root/profile?tab=settings");
  `;

  const draft = generateCaseDraft(recording, {
    area: "demoapp",
    feature: "profile-settings",
    scenario: "Visitor opens profile settings",
    baseUrl: "https://app.example.test/root/",
    path: "profile?tab=settings",
    resolvedUrl: "https://app.example.test/root/profile?tab=settings"
  });

  assert.deepEqual(draft.steps, [
    'Given the user opens the relative path "profile?tab=settings"'
  ]);
  assert.equal(JSON.parse(draft.files.draftPack).resolvedUrl, "https://app.example.test/root/profile?tab=settings");
  assert.match(draft.files.summary, /Resolved URL: https:\/\/app\.example\.test\/root\/profile\?tab=settings/);
});

test("preserves same-origin absolute URL navigation inputs unchanged", () => {
  const recording = `
    page.navigate("https://app.example.test/root/profile?tab=settings");
  `;

  const draft = generateCaseDraft(recording, {
    area: "demoapp",
    feature: "absolute-profile",
    scenario: "Visitor opens profile settings",
    baseUrl: "https://app.example.test/root/",
    path: "https://app.example.test/root/profile?tab=settings",
    resolvedUrl: "https://app.example.test/root/profile?tab=settings"
  });

  assert.deepEqual(draft.steps, [
    'Given the user opens the relative path "https://app.example.test/root/profile?tab=settings"'
  ]);
  assert.match(draft.files.feature, /https:\/\/app\.example\.test\/root\/profile\?tab=settings/);
});

test("keeps leading slash navigation rooted at the origin", () => {
  const recording = `
    page.navigate("https://app.example.test/profile?tab=settings");
  `;

  const draft = generateCaseDraft(recording, {
    area: "demoapp",
    feature: "root-profile",
    scenario: "Visitor opens origin-root profile",
    baseUrl: "https://app.example.test/root/",
    path: "/profile?tab=settings",
    resolvedUrl: "https://app.example.test/profile?tab=settings"
  });

  assert.deepEqual(draft.steps, [
    'Given the user opens the relative path "/profile?tab=settings"'
  ]);
});

test("keeps unsupported recorded actions explicit and reviewable", () => {
  const recording = `
    page.locator("[data-testid='country']").selectOption("US");
  `;

  const draft = generateCaseDraft(recording, {
    area: "demoapp",
    feature: "profile",
    scenario: "Visitor updates country",
    path: "/profile"
  });

  assert.deepEqual(draft.steps, [
    "When the user performs generated action 1"
  ]);
  assert.deepEqual(draft.unsupportedActions, [
    {
      actionNumber: 1,
      statement: 'page.locator("[data-testid=\'country\']").selectOption("US");'
    }
  ]);
  assert.match(draft.files.steps, /throw new UnsupportedOperationException/);
  assert.match(draft.files.steps, /selectOption/);
  assert.match(draft.files.summary, /Unsupported actions: 1/);
  assert.match(draft.files.summary, /selectOption/);
});

test("generates draft steps for common click fill and visibility actions", () => {
  const recording = `
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in")).click();
    page.getByLabel("Email").fill("user@example.test");
    assertThat(page.getByText("Welcome").first()).isVisible();
  `;

  const draft = generateCaseDraft(recording, {
    area: "demoapp",
    feature: "signin",
    scenario: "Visitor signs in",
    path: "/signin"
  });

  assert.deepEqual(draft.steps, [
    'When the user clicks the button named "Sign in"',
    'When the user fills the field labeled "Email" with "user@example.test"',
    'Then the text "Welcome" should be visible'
  ]);
  assert.equal(draft.unsupportedActions.length, 0);
});

test("falls back to the requested path when a recording has no supported statements", () => {
  const draft = generateCaseDraft("", {
    area: "demoapp",
    feature: "empty-recording",
    scenario: "Visitor opens a page",
    path: "/fallback"
  });

  assert.deepEqual(draft.steps, [
    'Given the user opens the relative path "/fallback"'
  ]);
  assert.equal(draft.actionInventory[0].source, "fallback-path");
});
