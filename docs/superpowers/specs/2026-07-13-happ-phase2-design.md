# HAPP Phase 2 设计 — 健康提醒 + 依从性分析

## 背景

Phase 1 已完成并在真机验证通过:注册登录、健康档案（模块1）、每日记录（模块2）、30天趋势图（模块4）。

本次设计 Phase 2,覆盖患者端剩余的两个模块:

- **模块3 健康提醒**:用户可以设置每天固定时间的提醒（测血压、吃药、运动等），支持选择星期几重复。
- **模块5 依从性分析**:App 自动统计患者最近30天的连续记录天数、漏记天数、完成率。

医生端（模块6）、AI健康助手（模块7）、后台数据分析（模块8）仍在后续阶段，本次不涉及。`users.role` 字段在 Phase 1 已预留 patient/doctor/admin，届时无需改动鉴权体系。

## 总体架构

延续 Phase 1 的单仓库两包结构（`backend/` + `mobile/`），不引入新的技术栈：

- 提醒的调度是**纯本地**的，通过 `expo-notifications` 在手机上按时间触发系统通知，不依赖后端推送服务（不需要 APNs/FCM，不需要后端持有设备 push token）。后端只存"提醒规则"本身（几点、周几、什么类型），供增删改查和多设备同步。
- 依从性分析不新建数据表，基于 `daily_records` 实时计算，逻辑抽成一个纯函数（类似 Phase 1 的 `bmi.ts`），前后端各有一份（后端计算供 API 返回，无需在客户端重复计算——**这次依从性只在后端计算，客户端直接展示结果**，与 Phase 1 的 BMI/校验逻辑前后端各一份不同，因为依从性依赖"今天的日期"这种服务器时间比客户端时间更可信的判断，不需要客户端离线计算）。

## 数据模型

```prisma
enum ReminderType {
  blood_pressure
  medication
  exercise
  blood_glucose
  custom
}

model Reminder {
  id        String       @id @default(uuid())
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  type      ReminderType
  title     String       // 当 type = custom 时必填；其余类型可选（有默认标题）
  time      String       // "HH:mm"，如 "09:00"
  weekdays  Int[]        // 0=周日 ... 6=周六，至少选一天
  enabled   Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}
```

## API

- `GET /reminders` — 返回当前用户的全部提醒
- `POST /reminders` — 创建提醒，校验 `time` 格式（`HH:mm`）、`weekdays` 非空且值在 0-6 之间
- `PUT /reminders/:id` — 更新提醒（含 `enabled` 开关），只能改自己的
- `DELETE /reminders/:id` — 删除提醒，只能删自己的
- `GET /adherence` — 返回 `{ completedDays, missedDays, completionRate, currentStreak }`，基于最近30天 `daily_records` 实时计算，不落库

## 依从性计算规则

- **"完成一天"**：当天 `daily_records` 表中存在一条记录（不要求填满所有字段，与 Phase 1 "一天一条记录" upsert 逻辑天然一致）。
- **统计区间**：最近30天（含今天），与趋势图的窗口保持一致。
- **完成率** = 区间内有记录的天数 / 30。
- **漏记天数** = 30 − 完成天数。
- **当前连续天数**（currentStreak）：从今天开始向前数连续有记录的天数；如果今天还没记录，不算"断"，改从昨天开始数（今天还没结束，不应该提前判定为漏记）；如果今天和昨天都没有记录，`currentStreak = 0`。

## 提醒的本地推送

- 使用 `expo-notifications`，在 `RemindersScreen` 或 App 启动时请求通知权限（`Notifications.requestPermissionsAsync()`）。
- 一条提醒选中的每个星期几，对应调度**一条** `WeeklyTriggerInput`（expo-notifications 的重复触发器一次只能绑定一个星期几）。例如"周一三五 09:00"会产生 3 条系统调度的通知，三条都带上 `data: { reminderId }` 用于后续统一撤销。
- 增/改/删/切换启用状态时，先按 `reminderId` 撤销该提醒名下所有已调度的系统通知，再按最新规则重新调度（`enabled=false` 或删除时只撤销、不重新调度）。
- App 每次启动（`AppNavigator` 挂载时）都会拉取一次 `/reminders`，对所有 `enabled=true` 的提醒做"撤销旧的、重新调度"，避免设备重启/重装后系统调度丢失、或多设备之间状态不一致。
- 点击通知：通过 `Notifications.addNotificationResponseReceivedListener` 监听，在回调里用一个模块级的 `navigationRef`（挂在 `NavigationContainer` 的 `ref` 上）导航到 `DailyRecord` 页面 —— 不区分提醒类型，统一跳转到"今日记录"。

## 页面 / 导航

- `RemindersScreen`：列表展示所有提醒（类型图标 + 标题 + 时间 + 星期几 + 启用开关 + 删除按钮），底部"新建提醒"按钮进入 `ReminderFormScreen`；点某条提醒的编辑按钮也进入 `ReminderFormScreen`（带上该提醒的 id 用于区分新建/编辑）
- `ReminderFormScreen`：独立页面（与 `ProfileSetupScreen`/`DailyRecordScreen` 保持同样的"整屏表单"风格，不用模态），包含类型选择（4个固定类型 + 自定义）、自定义类型时标题必填、时间选择器、星期几多选（周一到周日），保存后返回 `RemindersScreen`
- `AdherenceScreen`：展示完成率（大数字）、当前连续天数、漏记天数，纯展示、无交互
- `HomeScreen` 新增两个入口按钮："健康提醒" → RemindersScreen，"依从性分析" → AdherenceScreen
- `RootStackParamList` 新增 `Reminders`、`ReminderForm`（参数 `{ reminderId?: string }`，不传即为新建）、`Adherence` 三个路由

## 错误处理

- 提醒表单：`time` 必须是合法的 `HH:mm`；`weekdays` 至少选一天；`custom` 类型必须填标题，否则前端阻止提交
- 通知权限被拒绝：`RemindersScreen` 检测到权限未授予时，仍允许创建提醒规则（写入后端），但顶部提示"通知权限未开启，提醒不会弹出，请到系统设置里开启"，不阻塞核心 CRUD 流程
- 网络请求失败：复用 Phase 1 已有的 401 拦截器和错误提示模式（Alert 弹窗），不重复设计

## 测试

- 后端：`calculateAdherence` 抽成纯函数单元测试（覆盖：无记录/全勤/中间断勤/今天未记录但昨天有记录/今天和昨天都没有）；`reminders` 路由用 Jest + Supertest + mock Prisma，覆盖增删改查和校验分支
- 移动端：沿用 Phase 1 的测试范围原则——只对纯函数（如果有需要客户端计算的部分）写单元测试；通知调度和导航跳转通过 `npx tsc --noEmit` 做类型检查，实际弹通知效果需要真机手动验证（无法在无网络/无 Postgres 的沙盒环境里自动化）
