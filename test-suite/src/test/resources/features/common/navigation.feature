Feature: Shared navigation behaviors
  As a reusable e2e test framework
  I want to keep common navigation steps in a shared feature folder
  So that multiple applications can compose the same base behavior

  @smoke @common
  Scenario: Open the Playwright home page
    Given the user opens the relative path "/"
    Then the page title should contain "Playwright"
