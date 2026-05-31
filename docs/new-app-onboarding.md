# New App Test Onboarding

这份文档说明如何把一个新的 app 测试 area 接入当前仓库。

假设你要新增的 app 名称是 `adminapp`。

`area` 名称会同时用作 feature 目录、step package 和 Gradle key，因此必须是 Java package 片段：小写字母开头，只包含小写字母和数字，例如 `adminapp`，不要用 `admin-app`。

## 1. 建目录

新增 feature 目录：

```text
test-suite/src/test/resources/features/adminapp/
```

新增 step definitions 目录：

```text
test-suite/src/test/java/com/example/e2e/tests/steps/adminapp/
```

新增 runner 目录和类：

```text
test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java
```

## 2. 新增 runner

参考 `demoapp` 的做法，新增一个只绑定自己 area 的 runner：

```java
package com.example.e2e.tests.runner.adminapp;

import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/adminapp")
public class AdminAppRunCucumberTest {
}
```

规则：

- runner 只负责声明自己的 feature scope。
- 不要把业务逻辑写进 runner。
- glue、Allure、artifacts、parallel 这类运行时配置放在 `test-suite/build.gradle`。

## 3. 新增 feature 文件

在 `features/adminapp/` 下新增 `.feature` 文件。

建议：

- feature 目录按 app 划分。
- 跨 app 复用的 feature 保持放在 `features/common/`。
- 场景名保持稳定、可读，避免同一 area 下大量重名 scenario。

## 4. 新增 step definitions

在 `steps/adminapp/` 下新增 step class。

建议：

- app 专属步骤放在自己的包下。
- 跨 app 公共步骤放在 `steps/common/`。
- step 内统一通过 `PlaywrightManager.page()` 访问 Playwright 页面对象。
- 需要跨 step 共享数据时，使用 `PlaywrightManager.scenarioContext()`。

## 5. 在 Gradle 注册新的 area task

编辑 [test-suite/build.gradle](../test-suite/build.gradle)，在 `cucumberAreas` 中新增一项：

```groovy
adminapp: [
        taskName       : 'testAdminApp',
        taskSuffix     : 'AdminApp',
        runnerClassName: 'com.example.e2e.tests.runner.adminapp.AdminAppRunCucumberTest',
        glue           : [
                'com.example.e2e.core.hooks',
                'com.example.e2e.tests.steps.common',
                'com.example.e2e.tests.steps.adminapp'
        ],
        parallelEnabled: false,
        parallelism    : 1
]
```

规则：

- `taskName` 建议统一为 `test<AppName>`。
- `taskSuffix` 用于自动生成 `allureReport<AppName>` / `allureServe<AppName>` 这类别名任务。
- `runnerClassName` 要写全限定名。
- `glue` 至少包含 `core.hooks` 和自己的 steps 包。
- 只有明确验证通过后，才把 `parallelEnabled` 改成 `true`。

## 6. 运行新 app 的测试

注册好后，可以直接运行：

```bash
./gradlew :test-suite:testAdminApp
```

如果要生成 Allure 报告：

```bash
./gradlew :test-suite:testAdminApp
./gradlew :test-suite:allureReport
```

如果要打开本地 Allure 报告：

```bash
./gradlew :test-suite:allureServe
```

如果你只想看单个 app 的 Allure 报告，只要给该 area 配置好 `taskSuffix`，`test-suite/build.gradle` 就会自动注册别名任务。然后可以直接运行：

```bash
./gradlew :test-suite:allureReportAdminApp
./gradlew :test-suite:allureServeAdminApp
```

如果你更喜欢连字符风格，也可以同时使用：

```bash
./gradlew :test-suite:allureReport-adminapp
./gradlew :test-suite:allureServe-adminapp
```

## 7. Windows 本地浏览器约定

Windows 下默认开启本地浏览器模式：

- 自动设置 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- 默认优先使用本机 `msedge` 作为 `chromium` 通道

如果要显式指定本地浏览器：

```bash
./gradlew :test-suite:testAdminApp \
  -Dplaywright.use.local.browser=true \
  -Dbrowser.channel=chrome
```

或者：

```bash
./gradlew :test-suite:testAdminApp \
  -Dplaywright.use.local.browser=true \
  -Dbrowser.executable.path="C:\\Program Files\\Mozilla Firefox\\firefox.exe" \
  -Dbrowser=firefox
```

## 8. 可选：录制并生成新用例草稿

如果新 area 已经在 `cucumberAreas` 注册，并且 `glue` 包含 `com.example.e2e.tests.steps.common`，可以先用 recorder 操作浏览器，再生成 Cucumber 草稿：

```bash
. tools/case-recorder/bin/env.sh
sh tools/case-recorder/bin/doctor.sh
```

doctor 必须先通过。WSL 下它会拒绝 `/mnt/c/...` 这类 Windows 侧 `node` / `npm` / `java`，避免录制和生成链路绕回 Windows 文件系统。可选的 `env.sh` 会在存在时加入 `$HOME/.local/toolchains/node-current/bin` 和 `$HOME/.sdkman/candidates/java/current/bin`。

Windows 端请在 Windows 本地 checkout 中运行，不要直接在 `\\wsl.localhost\...` 路径上跑 `gradlew.bat`；Gradle 在 WSL UNC / 映射盘上可能无法创建文件哈希服务。`cmd.exe` 下可以先执行：

```bat
call tools\case-recorder\bin\env.cmd
gradlew.bat :test-suite:caseRecorderTest
```

如果改过 recorder 本身，先跑它自己的测试：

```bash
./gradlew :test-suite:caseRecorderTest
```

```bash
./gradlew :test-suite:recordCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile
```

关闭 Playwright codegen 窗口后，原始录制文件会保存到：

```text
test-suite/build/case-drafts/adminapp/user-profile/
```

然后生成 feature 和 step draft：

```bash
./gradlew :test-suite:generateCaseFromRecording \
  -Parea=adminapp \
  -Pfeature=user-profile
```

生成结果：

```text
test-suite/src/test/resources/features/adminapp/user-profile.feature
test-suite/src/test/java/com/example/e2e/tests/steps/adminapp/UserProfileSteps.java
test-suite/build/case-drafts/adminapp/user-profile/case-draft.json
test-suite/build/case-drafts/adminapp/user-profile/draft-summary.md
```

落地规则：

- 生成的 feature 会带 `@draft`，合并前需要改成稳定业务语言。
- `case-draft.json` 和 `draft-summary.md` 会保留 action inventory，方便先 review 再提升为正式用例。
- 简单点击、输入、可见性断言会复用 `steps/common/DraftInteractionSteps.java`。
- 不支持的录制动作会生成明确失败的 step，必须人工改成 app 专属 step 或 interaction。
- 默认不覆盖已有文件；确认要重生成时再传 `-Pforce=true`。

## 9. Cypress 迁移和录制新用例的边界

Cypress-to-Playwright 迁移不是上面的 recorder 默认路径。迁移时应先读取 Cypress source（`cypress.config.*`、`.cy.js` / `.cy.ts`、`cypress/e2e/features/**/*.feature`、`cypress/support/**/*`、`cypress/fixtures/**/*`），再用 Cypress 运行结果作为 oracle；manual Playwright recording 只用于 record-first 新用例 onboarding。

从仓库根目录先查看可执行入口：

```bash
node tools/cypress-migration/src/cli.mjs --help
./gradlew :test-suite:tasks --all --console=plain --no-daemon
```

内置 synthetic Cypress 迁移验证命令：

```bash
./gradlew :test-suite:cypressMigrationInventory --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationRisk --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationDraft --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationOracle --console=plain --no-daemon
./gradlew :test-suite:testMigrationDemo --console=plain --no-daemon -Dheadless=true
./gradlew :test-suite:cypressMigrationCheck --console=plain --no-daemon -Dheadless=true
```

如果是私有 Cypress 项目，只传路径，不要粘贴或提交私有源码：

WSL 下请使用 WSL-local Node.js / Java，并优先把 Cypress source 和 output 放在 Linux 本地路径，避免 `/mnt/c/...` 带来的性能、锁文件和 CRLF 问题。

```bash
CYPRESS_SOURCE=/absolute/path/to/cypress-project
MIGRATION_OUT=build/cypress-migration
node tools/cypress-migration/src/cli.mjs inventory --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs risk --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs draft --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
```

生成的迁移证据保持在 ignored build 目录中：

```text
build/cypress-migration/inventory.json
build/cypress-migration/inventory.md
build/cypress-migration/risk-flags.md
build/cypress-migration/draft-features/*.feature
build/cypress-migration/oracle-result.json
build/cypress-migration/oracle-result.md
build/cypress-migration/evidence-summary.json
build/cypress-migration/evidence-summary.md
```

迁移安全规则：

- 不要把 `cy.wait(number)` 迁移成 `Thread.sleep(...)`，改用 locator、URL、response 或业务状态等待。
- step definitions 不要直接创建 `Playwright`、`Browser` 或 `Page`，统一通过 `PlaywrightManager` 和 interaction/helper 使用框架托管 session。
- mock-heavy、fixture-heavy、隐藏 custom command setup、`cy.session`、alias、写共享数据、unsupported 或 uncertain conversion 都必须人工 review 后再提升为正式测试。
- `build/cypress-migration/draft-features/` 下的草稿只是 review 资料，不要直接当成 production-ready test 提交。

## 10. 验证清单

新增一个 app 后，至少验证这些点：

1. `./gradlew :test-suite:test<AppName>` 可以成功发现并执行用例。
2. `test-suite/build/allure-results/` 中有新的 Allure 原始结果。
3. 失败场景在 Allure 中能看到 screenshot。
4. `test-suite/build/artifacts/<app-name>/` 下能看到 trace / video 产物。
5. 如果要开并行，先确认没有共享账号、共享测试数据和共享文件路径冲突。

## 11. 不要做的事

- 不要把新 app 的步骤直接塞进 `steps/common/`。
- 不要复用别的 app runner 去跑新的 feature 目录。
- 不要把 app 专属 selector 或业务词汇下沉到 `core`。
- 不要在未验证线程安全前直接把 `parallelEnabled` 打开。
