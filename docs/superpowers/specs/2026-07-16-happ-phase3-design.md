# HAPP Phase 3 设计 — 医生端(只读)

## 背景

Phase 1(健康档案、每日记录、趋势图)和 Phase 2(健康提醒、依从性分析)已完成并验证通过,患者端的核心功能已经完整。

本次设计 Phase 3,实现模块6"医生端":医生登录后可以查看患者列表和每个患者近90天的健康趋势。`users.role` 字段在 Phase 1 就已预留 patient/doctor/admin 三种角色,数据库和登录体系无需大改。

模块7(AI健康助手)、模块8(后台数据分析)仍在后续阶段,本次不涉及。

## 权限模型:简化为"全量只读"

与常见的医患双向授权模式不同,本次采用简化模型:**任何 role=doctor 的账号登录后可以查看全部患者的数据**,不需要患者单独邀请/授权某个医生。理由:

- 这是一个学习/演示项目,不是要上线的真实多租户医疗系统,严格的访问控制不是当前的核心诉求
- 省去了"医患关联"这张表和邀请/审批流程,大幅简化实现
- 医生端功能本身是只读的,不修改患者数据,风险可控

如果未来需要限制医生只能看到被明确授权的患者,可以在此设计基础上叠加一张 `DoctorPatientLink` 关联表,不影响本次已实现的接口结构(只需在查询上加一层过滤)。

## 账号与鉴权

### 注册时选择身份

`RegisterScreen` 新增"患者 / 医生"选择(默认患者)。`POST /auth/register` 请求体新增可选字段 `role`,取值限定为 `patient` 或 `doctor`(不允许注册 `admin`);不传时默认为 `patient`,保持向后兼容。

### 补齐的缺口:`GET /auth/me`

现状:`AuthContext` 只把 token 持久化到 `SecureStore`,App 重新启动、从本地恢复 token 时,并不知道当前登录用户的 `role`(`user` 状态仍是 `null`,只有调用 `login`/`register` 时才会被填充)。这在 Phase 1/2 里不是问题,因为界面不分角色;但医生端要在 `AppNavigator` 里根据 `role` 分流界面,必须在 App 冷启动、仅有本地 token 的情况下也能拿到 `role`。

新增 `GET /auth/me`(需要 `requireAuth`),返回 `{ id, email, name, role }`。`AuthContext` 从 `SecureStore` 恢复 token 后,调用一次 `/auth/me` 填充 `user` 状态,再进入正常渲染流程。

## 医生端接口(只读,`requireAuth` + 新增的 `requireRole('doctor')` 中间件)

- `GET /doctor/patients?condition=<chronicCondition>` — 患者列表,返回 `{ id, name, age, gender, chronicConditions }`;`condition` 可选,传了就按 `chronicConditions` 数组包含该值过滤,不传返回全部 role=patient 的用户
- `GET /doctor/patients/:id/profile` — 指定患者的健康档案(含自动计算的 BMI,复用 `calculateBmi`)
- `GET /doctor/patients/:id/records?days=90` — 指定患者最近90天的每日记录(复用 `records.ts` 里 `GET /records` 的查询模式,只是 `userId` 换成路径参数里的 `:id`,天数默认90而不是30)
- `GET /doctor/patients/:id/adherence?today=YYYY-MM-DD` — 指定患者的依从性数据(复用 `calculateAdherence`,`userId` 同上换成路径参数)

以上4个接口都要求调用者 `role === 'doctor'`,否则返回 403。路径参数 `:id` 指向的用户必须存在且 `role === 'patient'`,否则 404(医生不能通过这些接口查看另一个医生或管理员账号的数据)。

## 移动端

### 角色分流

`AppNavigator` 目前按 `token` 有无分两支(已登录 / 未登录)。本次在已登录分支内再按 `user?.role` 二次分流:

- `role === 'doctor'`:进入医生端导航栈,初始页面直接是 `DoctorPatientListScreen`(不单独做医生首页——医生登录后唯一要做的事就是看患者列表,不需要额外一层导航)
- 其余情况(`role === 'patient'` 或 `role` 尚未加载完成的过渡态):走现有患者端导航栈,行为不变

`role` 尚未加载完成(`GET /auth/me` 还没返回)期间,展示与 Phase 1 一致的全屏 loading。

### 新增页面

- `DoctorPatientListScreen`:患者列表(姓名、年龄、慢病类型),顶部是慢病类型筛选条。筛选选项不额外建接口获取——页面挂载时先请求一次不带 `condition` 的全量列表,在客户端把所有患者的 `chronicConditions` 去重合并成筛选条选项(外加一个"全部"选项);点击某个筛选项时才带上 `?condition=xxx` 重新请求列表(而不是本地过滤,因为医生数据量未来可能变大,过滤逻辑应该在后端)。列表项点击进入患者详情;页面右上角/底部有退出登录按钮
- `DoctorPatientDetailScreen`:三块内容——健康档案卡片(年龄/性别/身高体重/BMI/慢病类型/用药/过敏史)、依从性卡片(完成率/连续天数/漏记天数,样式复用 `AdherenceScreen` 的卡片布局)、90天趋势图(血压/血糖/体重可切换,图表逻辑参照患者端 `TrendsScreen`,但改为90天窗口、数据源换成指定患者)

这两个页面各自独立实现,不强行抽取和患者端共用的组件——目前患者端和医生端的展示需求相似度不足以支撑一个通用组件,保持每个页面自包含,后续如果医生端页面变多再考虑抽取。

## 错误处理

- 医生端接口对非 doctor 角色统一返回 403 `{ error: 'Forbidden' }`
- `:id` 指向不存在或非 patient 用户,返回 404
- 移动端网络请求失败复用现有的 401 拦截器 + Alert 提示模式,不重复设计

## 测试

- 后端:`requireRole` 中间件单测(mock `AuthRequest.role`,验证非 doctor 返回403);4个医生端路由的 Supertest 用例(mock Prisma),覆盖权限拒绝、患者不存在、正常返回；`POST /auth/register` 补充 `role` 字段的测试(合法值通过、非法值400、不传默认patient)；`GET /auth/me` 的返回值测试
- 移动端:沿用既定原则,只对纯函数写单元测试(本阶段无新增纯函数);角色分流导航、患者列表/详情页通过 `npx tsc --noEmit` 做类型检查;医生端完整流程(注册医生账号→登录→看列表→看详情)需要真机/真实后端手动验证
