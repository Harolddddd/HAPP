# HAPP 个人健康档案 App — 总体架构 & Phase 1 设计

## 背景

HAPP 是一个面向慢病患者的健康自我管理 App，共规划 8 个模块：

1. 个人健康档案（首次注册填写）
2. 每日健康记录
3. 健康提醒
4. 趋势图（30天）
5. 依从性分析
6. 医生端（查看患者90天趋势）
7. AI 健康助手
8. 后台数据分析

8 个模块规模较大，涉及患者、医生、管理员三种角色和多个独立子系统。按照分阶段方式实施，每个阶段独立成 spec + plan：

- **Phase 1（本文档详细设计）**：项目脚手架、注册登录、模块1健康档案、模块2每日记录、模块4趋势图。打通"记录数据 → 看到图表"的核心闭环。
- **Phase 2**：模块3健康提醒、模块5依从性分析
- **Phase 3**：模块6医生端、模块7 AI 健康助手
- **Phase 4**：模块8后台数据分析

## 总体架构

单仓库，两个包：

```
HAPP/
  mobile/     # React Native (Expo) + TypeScript，患者/医生/管理员共用一个 App，按角色渲染不同界面
  backend/    # Express + TypeScript + PostgreSQL（Prisma ORM）
```

医生端和后台数据分析（Phase 3、4）复用同一个 App 和同一套后端，通过角色权限区分可见内容，不单独开发 Web 管理后台，避免维护两套前端。

**技术栈**
- 移动端：React Native (Expo)、TypeScript、react-native-chart-kit（趋势图）、expo-notifications（Phase 2 提醒用）
- 后端：Node.js + Express + TypeScript、PostgreSQL、Prisma ORM
- 鉴权：JWT + 角色（patient / doctor / admin）
- AI 健康助手（Phase 3）：规则引擎，基于阈值和记录缺失情况触发建议，不接入外部 LLM

## Phase 1 详细设计

### 范围

- 用户注册 / 登录（角色默认为 patient；doctor/admin 角色 Phase 3/4 再启用）
- 模块1：注册后填写健康档案（年龄、性别、身高、体重、BMI 自动计算、慢病类型、正在服用药物、过敏史）
- 模块2：每日健康记录（血压、血糖、心率、体重、睡眠时间、运动时间、饮水量）
- 模块4：30天血压/血糖/体重趋势折线图

### 页面 / 屏幕

- 登录 / 注册
- 健康档案填写向导（首次注册后进入）：年龄、性别、身高、体重（实时计算并显示 BMI）、慢病类型（多选 + 自定义输入）、正在服用药物（可增删的列表）、过敏史（文本）
- 首页 Dashboard：今日是否已记录、快捷入口
- 每日记录表单：血压（收缩压/舒张压）、血糖、心率、体重、睡眠时长、运动时长、饮水量 — 一天一条记录，当天可反复编辑
- 历史记录列表（按天倒序）
- 趋势图页面：30天血压/血糖/体重折线图，可切换指标查看

### API

- `POST /auth/register` — email、password、name
- `POST /auth/login` — 返回 JWT
- `GET /profile` / `PUT /profile` — 健康档案读写
- `POST /records` — 当天记录 upsert（按 `user_id + record_date` 唯一）
- `GET /records?days=30` — 查询最近 N 天记录，供历史列表和趋势图使用

### 数据库表

```
users
  id, email, password_hash, name, role, created_at

health_profiles
  id, user_id, age, gender, height_cm, weight_kg,
  chronic_conditions text[], medications text[], allergies text,
  updated_at
  -- BMI = weight_kg / (height_cm/100)^2，实时计算，不落库

daily_records
  id, user_id, record_date,
  systolic, diastolic, blood_glucose, heart_rate, weight_kg,
  sleep_hours, exercise_minutes, water_ml,
  created_at, updated_at
  -- UNIQUE(user_id, record_date)
```

### 错误处理

- 数值合理范围校验（如血压 50–250、心率 30–220、睡眠 0–24 小时），前端表单 + 后端接口双重校验
- 断网时本地暂存草稿（AsyncStorage），联网后提示用户同步
- 同一天重复提交按更新处理（upsert），不会产生重复记录

### 测试

- 后端：Jest + Supertest，覆盖注册登录、BMI 计算、`daily_records` upsert 逻辑
- 前端：BMI 计算、表单校验等关键纯函数的单元测试
- 本阶段不做端到端（E2E）测试，超出 MVP 范围

## 后续阶段（概要，非本次实施范围）

- **Phase 2**：`reminders` 表（时间、类型、重复规则）+ 本地推送；依从性统计（基于 `daily_records` 连续天数、漏记天数、完成率实时计算，不单独存储）
- **Phase 3**：`doctor_patient_links` 表；医生角色可查看关联患者近90天趋势图；AI 助手基于阈值规则在客户端/服务端触发建议（如漏记提醒、血压血糖异常建议咨询医生）
- **Phase 4**：`usage_events` 埋点表；admin 角色可见连续使用天数分布、日均使用人数、功能点击排行等统计视图
