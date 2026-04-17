Feature: app1 sample suite
  Scenario: resolve the shared framework marker
    When I resolve the shared framework marker
    Then the shared framework marker should be "core"
