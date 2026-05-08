# App-Specific Runner and Parallel Execution Plan

## 背景

当前 `test-suite` 只有一个全局 Runner：

- `test-suite/src/test/java/com/example/e2e/tests/runner/RunCucumberTest.java`

当前按 app 选择测试范围的方式主要依赖：

- `-Dcucumber.features=src/test/resources/features/<app-name>`

这个方案在 app 数量变多后会有几个问题：

1. app 级执行入口不显式，CI 和本地命令都要手动拼参数。
2. 不同 app 是否支持 parallel run 无法自然表达。
3. 多个 app 并行执行时，报告和产物容易写到同一目录，存在覆盖风险。
4. Runner 只有一个时，测试组织边界不够清晰，后续维护成本会上升。
5. 现有配置同时分布在 runner 注解和 Gradle task 中，后续按 app 扩展时容易出现重复配置和漂移。

## 目标

为不同 app 提供独立的执行入口，并把是否并行变成 app 级能力，而不是全局能力。

目标包括：

1. 不同 app 的测试继续按目录拆分。
2. 每个 app 有独立 runner。
3. 每个 app 有独立 Gradle task。
4. 每个 app 可以独立控制是否开启 parallel run。
5. 报告、trace、video 等产物按 app 隔离，避免冲突。
6. 保留一个聚合入口，方便本地和 CI 统一执行全部 app。
7. 明确 `common` 测试资源的执行归属，避免漏跑或重复跑。

## 非目标

这次规划先不处理以下内容：

1. 不引入新的测试框架。
2. 不调整 `core` 和 `test-suite` 的模块边界。
3. 不一次性为所有 app 开启并行。
4. 不在没有验证线程安全前默认打开 parallel。
5. 不支持在同一个 JVM / 同一个 `Test` task 中混跑多个 app 且带不同运行配置。

## 建议方案

### 1. 执行边界和目录组织

保持当前“按 app 拆 `features` 和 `steps`”的方向，并补齐 runner 维度。

同时明确：`features/common` 不是隐式附属于每个 app 的目录，而是一个显式的 shared feature area，拥有自己的 runner 和 task。

建议结构：

```text
test-suite/
  src/test/java/com/example/e2e/tests/
    runner/
      CommonRunCucumberTest.java
      demoapp/
        DemoAppRunCucumberTest.java
      adminapp/
        AdminAppRunCucumberTest.java
    steps/
      common/
      demoapp/
      adminapp/
  src/test/resources/features/
    common/
    demoapp/
    adminapp/
```

说明：

- `steps/common` 和 `features/common` 继续保留，用于跨 app 复用。
- `features/common` 通过独立入口执行，例如 `testCommon`，避免语义不清。
- 每个 app 的 runner 只负责自己的 feature 根目录。
- runner 命名建议统一为 `<AppName>RunCucumberTest`。
- 当前不预留 `runner/common/` 这层目录，先保持最小结构；未来如果 runner 真有共享代码，再抽象也不迟。

### 2. Runner 策略

每个 area（`common` 或具体 app）新增一个独立 runner。runner 的职责应尽量收敛，只负责：

1. 声明这是一个 Cucumber JUnit Platform suite。
2. 选择自己的 feature scope。
3. 提供最小默认入口。

建议原则：

- runner 负责“执行范围”，不负责完整运行时配置。
- app runner 不承载业务逻辑。
- 避免在 runner 中继续堆叠 report、artifacts、parallel 等动态参数，防止与 Gradle task 重复配置。
- 推荐让 runner 使用 `@SelectClasspathResource("features/<area>")` 绑定自己的目录，而不是继续依赖统一的 `cucumber.features` 参数切目录。

glue 建议显式收窄：

- `common` runner: `com.example.e2e.core.hooks` + `com.example.e2e.tests.steps.common`
- app runner: `com.example.e2e.core.hooks` + `com.example.e2e.tests.steps.common` + `com.example.e2e.tests.steps.<app>`

这样可以让 app 边界更清晰，并降低未来 step 歧义风险。

### 3. Gradle Task 策略

在 `test-suite/build.gradle` 中，为每个 area 提供独立 `Test` task。

示例命名：

- `testCommon`
- `testDemoApp`
- `testAdminApp`
- `testAllApps`

每个 area task 负责：

1. 显式选择对应 runner class，而不是再次通过全局 feature 扫描来间接选择范围。
2. 注入该 area 专属的 `cucumber.glue`。
3. 注入该 area 专属的 report 输出路径。
4. 注入该 area 专属的 `artifacts.dir`。
5. 注入该 area 专属的 parallel 开关和并发参数。

聚合 task `testAllApps` 的职责应当只是聚合：

- 作为 lifecycle / aggregate task，依赖 `testCommon`、`testDemoApp`、`testAdminApp` 等子任务。
- 不重新配置 `cucumber.features`。
- 不再退回成“一个全局 runner 扫全部目录”的实现。

这样可以避免“单 task 全局配置”与“多 runner 分入口”互相打架。

### 4. 配置归属原则

当前 feature / glue / plugin 同时配置在 runner 注解和 Gradle task 中。按 app 扩展后，如果继续双写，维护成本会明显上升。

建议统一归属：

- **runner**：负责 suite 声明和 feature scope。
- **Gradle task**：负责运行时参数，例如 glue、plugin、artifacts.dir、parallel 参数。
- **`FrameworkConfig`**：只消费传入的运行时配置，不感知 app 名称或执行编排。

如果需要保留 `RunCucumberTest` 作为兼容入口，应明确它只是过渡方案，而不是未来主入口。

## Parallel 设计

### 1. 基本原则

parallel 是否开启，不应该是 repo 全局统一开关，而应该是 app 级配置。

原因：

1. 不同 app 的页面稳定性不同。
2. 不同 app 的测试是否线程安全不同。
3. 有些 app 适合快速并发回归，有些 app 只适合串行执行。

### 2. 作用域

parallel 的作用域应明确为：**每个 app 的 `Test` task / JVM**。

也就是说：

- `testDemoApp` 可以带自己的 parallel 配置。
- `testAdminApp` 可以带另一套配置。
- 不要求在同一个 `Test` task 中切换不同 app 的配置。
- 不把“多个 app 在同一个 JVM 内混跑且各自并行”作为本次目标。

这个约束与当前实现一致：运行时配置在启动时读取，适合按 task 隔离，而不是在单次 JVM 生命周期中动态切换。

### 3. 建议控制面

每个 app 单独定义：

- `parallelEnabled`
- `parallelism`

逻辑上可以映射为：

- 串行 app：显式关闭 parallel
- 并行 app：显式开启 parallel，并设置固定并发度

不要采用“全局开 parallel，然后对个别 app 特判关闭”的方式，因为这会让默认行为变得不可预测。

### 4. task 级并发与场景级并发

本次优先引入的是 **app 内部场景级并发能力**。

后续如果 CI 还要让多个 app task 同时运行，需要额外确认：

1. 报告和产物目录已经完全隔离。
2. 环境、账号、测试数据没有资源竞争。
3. CI 报告聚合方式已经调整完成。

因此建议：

- Phase 1 / Phase 2 先让 `testAllApps` 以稳定、可预期的方式聚合。
- Phase 3 再根据 app 的成熟度决定是否在 CI 层面并发多个 task。

## 报告和产物隔离

### 1. 按 area 隔离目录

如果要并行跑多个 app，以下输出必须隔离：

1. Cucumber HTML report
2. Cucumber JSON report
3. trace zip
4. video 目录
5. screenshot 或其他失败产物

建议按 area 隔离：

```text
build/
  reports/cucumber/
    common/
    demoapp/
    adminapp/
  artifacts/
    common/
      traces/
      screenshots/
      videos/
    demoapp/
      traces/
      screenshots/
      videos/
    adminapp/
      traces/
      screenshots/
      videos/
```

### 2. area 隔离还不够，文件名也要唯一

只按 app 隔离目录还不够。当前 trace 和 video 的命名主要基于 scenario name，如果同一个 app 下不同 feature 存在同名 scenario，仍然可能冲突。

因此建议：

1. 目录按 area 隔离。
2. 文件名加入稳定唯一标识，而不只使用 scenario name。
3. 唯一标识建议基于 feature 路径信息 + scenario 标识，必要时再追加 run-scoped 后缀。

这样既能保证冲突安全，也更方便定位产物来源。

### 3. 关于 screenshot 的现状

当前失败截图主要是 attach 到 Cucumber scenario，并没有完整落盘到 `screenshots` 目录。

因此这次计划中的“screenshot 隔离”应理解为：

- 当前：先确保附件逻辑不受 app-specific 改造影响。
- 后续如果要把 screenshot 持久化到磁盘，也必须沿用 area 隔离和唯一命名规则。

## 对现有代码的影响点

### 1. `test-suite/src/test/java/com/example/e2e/tests/runner/RunCucumberTest.java`

当前是单一全局入口。后续建议：

1. 先保留为兼容入口，但降低其主路径地位。
2. 新增 `CommonRunCucumberTest` 和 app-specific runners。
3. 等 app-specific 入口稳定后，再评估是否删除全局 runner。

### 2. `test-suite/build.gradle`

这是本次改动的主要落点，需要：

1. 新增 area-specific `Test` tasks。
2. 让每个 task 只运行对应 runner。
3. 把 report / glue / artifacts / parallel 参数按 task 生成。
4. 避免继续在 runner 和 task 两端重复定义相同配置。
5. 把 `testAllApps` 设计成聚合 task，而不是新的“全局扫描入口”。

### 3. `core/src/main/java/com/example/e2e/core/config/FrameworkConfig.java`

后续需要继续让 `artifacts.dir` 支持按 area 注入，例如：

- `build/artifacts/common`
- `build/artifacts/demoapp`
- `build/artifacts/adminapp`

`core` 不需要感知 app 细节，只消费外部传入的 artifacts 根目录。

### 4. `core/src/main/java/com/example/e2e/core/hooks/CucumberHooks.java`

当前 trace 文件名主要基于 scenario name。后续需要：

1. 改为支持更稳定的唯一命名策略。
2. 确保失败截图附件逻辑在 app-specific runner 模式下保持正常。
3. 如果未来落盘 screenshot，也应复用同样的路径和命名规范。

### 5. `core/src/main/java/com/example/e2e/core/playwright/PlaywrightManager.java`

当前 `SESSION` 和 `CONTEXT` 使用 `ThreadLocal`，这对场景级并行是一个好的基础，但还不能直接证明整个框架已经适合并发。

同时还需要注意：

- 配置对象在 JVM 生命周期内按当前实现方式只初始化一次。
- 因此更适合“每个 app 一个 `Test` task / JVM”的隔离方式。
- 不建议把“单 task 内动态切换多个 app 配置”作为实现方向。

仍需验证：

1. hooks 生命周期是否完全线程安全。
2. 文件系统输出是否存在共享路径冲突。
3. 是否存在未来新增代码绕开 `ThreadLocal` 使用共享状态的风险。

### 6. `core/src/main/java/com/example/e2e/core/playwright/PlaywrightFactory.java`

当前 video 目录按 scenario name 建目录。后续需要与 trace 一样采用更稳妥的唯一命名策略，避免同 app 内部冲突。

## 推荐实施步骤

### Phase 1: 结构准备和显式入口

1. 保留当前目录结构。
2. 为 `common` 新增独立 runner 和 task。
3. 为第一个 app 新增独立 runner 和 task。
4. task 显式绑定 runner class，不再依赖全局 `cucumber.features` 切目录。
5. 该 app 先保持串行运行。
6. 保留 `RunCucumberTest` 作为兼容入口。

交付结果：

- 可以通过 `testCommon` 和 app-specific task 跑通显式入口。
- `common` 的执行归属明确，不会漏跑或重复跑。
- 不影响现有全量执行入口。

### Phase 2: 报告和产物隔离

1. 让每个 area 的 report 输出到独立目录。
2. 让每个 area 的 `artifacts.dir` 指向独立目录。
3. 改造 trace / video 的命名策略，确保同 area 内也不会覆盖。
4. 校验失败截图附件逻辑不受影响。

交付结果：

- 多个 area 即使同时执行，输出也不会相互污染。
- 同 app 下的同名 scenario 也不会覆盖彼此产物。

### Phase 3: 引入 app 级 parallel 开关

1. 为明确适合并行的 app 增加 parallel 配置。
2. 为不适合的 app 保持串行。
3. 在 CI 中按 app 维度选择执行策略。
4. 视需要评估是否并发多个 area task。

交付结果：

- 只有被确认稳定的 app 会开启并行。
- parallel 的作用域和边界清晰，不依赖全局默认行为。

### Phase 4: 迁移和清理

1. 将现有 app 逐个迁移到独立 runner/task 模式。
2. 更新 README、AGENTS 和 CI 脚本说明。
3. 评估是否还需要保留全局 runner。
4. 如有必要，再进一步收紧 glue 和入口约束。

交付结果：

- 执行入口从“单 runner + 参数切目录”迁移为“shared/common runner + app-specific runner + area-specific task”。

## 任务拆分建议

如果开始实现，建议按下面顺序拆任务：

1. 新增 `CommonRunCucumberTest` 和一个 app-specific runner 作为样板。
2. 改造 `test-suite/build.gradle` 支持 area-specific tasks 和聚合 task。
3. 改造 report 输出路径，确保按 area 隔离。
4. 改造 `artifacts.dir` 注入，确保按 area 隔离。
5. 改造 trace / video 命名，确保同 area 内唯一。
6. 为一个 app 试点开启 parallel。
7. 补充 README、AGENTS 和 CI 使用文档。

## 风险

1. 如果 `common` 的执行模型不清晰，容易出现漏跑或重复跑。
2. 如果 trace / video 仍只按 scenario name 命名，同 app 内也可能覆盖。
3. 如果后续 step definitions 引入共享静态状态，会破坏并行安全。
4. 多 runner 迁移后，CI 命令和报告聚合方式需要同步调整。
5. 若 app 之间对环境或账户资源有竞争，单纯打开并行也未必稳定。
6. 如果 glue 仍长期保持全量扫描，未来 step 歧义和边界不清的问题仍会累积。

## 决策建议

建议采用下面的落地原则：

1. 目录按 app / area 拆分继续保持。
2. `common` 保留为显式 shared area，并拥有自己的 runner / task。
3. runner 负责执行范围，Gradle task 负责运行时参数。
4. Gradle task 按 area 拆分，`testAllApps` 只做聚合，不重新回退成全局 runner。
5. parallel 按 app 显式开启，不做全局默认开启。
6. 产物不仅按 app 隔离目录，还要保证同 app 内文件名唯一。
7. 先做串行可运行，再做并行提速。

这个方案兼顾了清晰性、可维护性和后续 CI 扩展空间，也更贴合当前这个 `Gradle + Cucumber JVM + Playwright Java` repo 的实现约束。