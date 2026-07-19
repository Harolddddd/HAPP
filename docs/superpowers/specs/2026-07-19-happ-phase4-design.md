# HAPP Phase 4 设计 — 后台数据分析(管理员只读)

## 背景

Phase 1-3 已完成:患者端(健康档案、每日记录、趋势图、健康提醒、依从性分析)和医生端(患者列表、患者详情)。`users.role` 从 Phase 1 起就预留了 patient/doctor/admin 三种角色,`admin` 目前还没有任何用途。

本次设计 Phase 4,实现模块8"后台数据分析":管理员登录后可以看到全 App 的使用情况统计——连续使用90/60/30天的患者人数、最近30天日均使用人数、最近30天功能使用排行。

模块7(AI健康助手)本次不做,暂缓。

## 埋点方式:导航即事件

新增 `UsageEvent` 表记录"谁在什么时候访问了哪个页面"。埋点只改一处:`AppNavigator` 的 `NavigationContainer` 增加 `onStateChange` 回调,每次导航状态变化时取当前激活的路由名,POST 到后端记一条事件。不需要在每个页面文件里单独埋点。

- 只在已登录(`token` 存在)时上报,避免给 Login/Register 页面记录无意义的匿名事件,也避免未登录状态下的请求必然 401
- 上报失败静默忽略(fire-and-forget),不阻塞、不提示用户,与现有提醒调度失败时的处理方式一致
- 同一天同一用户同一页面可能有多条事件(反复进出同一页面),不做去重约束——统计时按需去重(比如"日活人数"按用户去重,不按事件去重)

## 数据模型

```prisma
model UsageEvent {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  screen    String
  createdAt DateTime @default(now())
}
```

`screen` 存的是路由名(如 `"DailyRecord"`、`"Trends"`),不是中文标签——中文映射放在管理员统计页展示时做,后端/数据库只存原始路由名。

## 统计口径

三项指标都只在 `GET /admin/stats`(`requireAuth` + `requireRole('admin')`)里现算,不建统计缓存表:

1. **连续使用天数人数**:分别统计当前连续使用天数 ≥90、≥60、≥30 的**患者**账号数量。"连续使用天数"的算法和依从性分析的"当前连续天数"一致——从今天往前数,今天还没有任何 `UsageEvent` 不算断(从昨天开始数),今天和昨天都没有则为0。三个数字是累加口径(连续100天的患者会同时计入90/60/30三个数字)。只统计 `role='patient'` 的账号,医生/管理员自己登录不计入。
2. **日均使用人数**:最近30天(含今天),每天按 `role='patient'` 且当天有至少一条 `UsageEvent` 的用户数去重计数,30天(即使某天是0)求平均。
3. **功能使用排行**:最近30天,不分角色统计每个 `screen` 值出现的次数,按次数降序,取前10。因为未登录不上报,Login/Register 不会出现在排行里。

## 接口

- `POST /usage-events`:`requireAuth`(任意已登录角色都能调用),请求体 `{ screen: string }`,写入一条 `UsageEvent`
- `GET /admin/stats`:`requireAuth` + `requireRole('admin')`,返回
  ```json
  {
    "continuousUsers": { "days90": 0, "days60": 0, "days30": 0 },
    "avgDailyActiveUsers": 0,
    "topFeatures": [{ "screen": "DailyRecord", "count": 0 }]
  }
  ```

## 管理员账号

不在注册页开放"管理员"身份选项(注册页身份选择维持患者/医生两个选项不变)。管理员账号只能通过手动在数据库里把某个已注册账号的 `role` 字段改成 `admin` 来创建。

## 移动端

- `AppNavigator` 在现有的患者/医生两个角色分支基础上,新增第三个分支:`user?.role === 'admin'` 时进入唯一的 `AdminStatsScreen`(和医生端一样,不单独做管理员首页,登录后直接是统计页)
- `AdminStatsScreen`:三张卡片——连续使用人数(90/60/30天三个数字并排展示)、日均使用人数(单个大数字)、功能使用排行(列表,路由名通过一个中文映射表转成可读标签展示,未在映射表里的路由名直接显示原始值兜底)
- `NavigationContainer` 增加 `onStateChange`,内部调用新增的 `logUsageEvent(screen)` API 函数上报当前路由名

## 错误处理

- `POST /usage-events` 失败(网络问题等)在客户端静默吞掉,不重试、不提示
- `GET /admin/stats` 失败时 `AdminStatsScreen` 显示"加载失败,请稍后重试",与 `AdherenceScreen` 的失败态处理方式一致

## 测试

- 后端:三个统计口径各抽成一个纯函数(`calculateContinuousUsers`、`calculateAvgDailyActiveUsers`、`calculateTopFeatures`),参照 `calculateAdherence` 的模式单独写单元测试;`POST /usage-events` 和 `GET /admin/stats` 路由用 Supertest + mock Prisma 测试(覆盖鉴权、角色拒绝、正常返回)
- 移动端:延续既定原则,只有纯函数才写单元测试(本阶段无新增纯函数,埋点和统计页展示都是 I/O/UI,不适合单测);`AdminStatsScreen` 和导航埋点通过 `npx tsc --noEmit` 做类型检查;完整流程(手动改一个账号为 admin → 登录 → 看到统计数据随患者端操作变化)需要真机/真实后端手动验证
