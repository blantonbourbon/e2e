# New App Test Onboarding

这份文档说明如何把一个新的 app 测试 area 接入当前仓库。

假设你要新增的 app 名称是 `adminapp`。

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

编辑 [test-suite/build.gradle](/home/kratos/projects/e2e/test-suite/build.gradle)，在 `cucumberAreas` 中新增一项：

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

## 8. 验证清单

新增一个 app 后，至少验证这些点：

1. `./gradlew :test-suite:test<AppName>` 可以成功发现并执行用例。
2. `test-suite/build/allure-results/` 中有新的 Allure 原始结果。
3. 失败场景在 Allure 中能看到 screenshot。
4. `test-suite/build/artifacts/<app-name>/` 下能看到 trace / video 产物。
5. 如果要开并行，先确认没有共享账号、共享测试数据和共享文件路径冲突。

## 9. 不要做的事

- 不要把新 app 的步骤直接塞进 `steps/common/`。
- 不要复用别的 app runner 去跑新的 feature 目录。
- 不要把 app 专属 selector 或业务词汇下沉到 `core`。
- 不要在未验证线程安全前直接把 `parallelEnabled` 打开。
