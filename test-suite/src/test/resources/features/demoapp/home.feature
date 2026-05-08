Feature: Demo application home page
  In order to validate one specific application area
  As an e2e automation engineer
  I want feature files to be organized under app-specific folders

  @demoapp @smoke
  Scenario: Demo app landing page is accessible
    Given the user opens the relative path "/"
    Then the page title should contain "Playwright"
    And the get started link should be visible
