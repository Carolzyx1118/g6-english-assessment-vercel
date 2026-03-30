# 教师端用户手册

适用项目：璞源教育在线测评与试卷管理系统  
适用端：教师工作台 / Teacher Workspace  
文档语言：中文  
文档日期：2026-03-30  
版本依据：当前仓库 `main` 分支最新教师端实现

## 1. 文档说明

本手册只面向教师端与管理员端，不介绍学生答题页的具体作答方式。  
本文档重点覆盖以下真实可见模块：

- 登录与注册
- 教师首页与左侧导航
- Paper Generator
- Question Intake
- Question Bank
- Paper Manager
- Test History
- User Manager
- 口语老师评分与 PDF 下载

如果你登录后看不到这些教师工具，通常不是页面故障，而是当前账号没有完整教师工作台权限。

## 2. 账号与权限

系统中的权限主要由邀请码与账号状态共同决定。

- 注册时必须输入邀请码。
- 邀请码会决定可访问学科范围。
- 只有拥有完整教师工作台权限的账号，才会进入教师端工具页。
- 学科权限不足的账号，即使能登录，也可能只能看到学生端选卷页，而看不到 `Teacher Tools`。
- 在 `User Manager` 中，老师可以继续调整账号是否启用，以及每个账号可见的学科。

需要特别注意：

- 如果账号被设为 `Inactive`，该账号将无法继续正常使用。
- 系统要求每个账号至少保留一个学科权限，不能把所有学科全部取消。
- `User Manager` 页面当前没有前端“重置密码”按钮，因此教师日常账号维护主要集中在“启用/停用”和“学科权限”两项。

## 3. 登录与注册

### 3.1 注册账号

首次使用时，可在注册页创建账号。页面需要填写：

1. 用户名
2. 密码
3. 确认密码
4. 邀请码

当前页面校验规则如下：

- 用户名至少 3 个字符
- 密码至少 6 个字符
- 两次输入的密码必须一致
- 邀请码不能为空

注册成功后，系统会自动登录并进入首页。

### 3.2 登录账号

已有账号时，进入登录页后填写：

1. 用户名
2. 密码

登录成功后会直接进入首页。  
页面右上角支持显示/隐藏密码，适合核对输入内容。

## 4. 教师首页与导航

教师登录后，首页会进入 `Teacher Workspace`。

### 4.1 首页结构

首页主要承担两个作用：

- 选择学科工作区
- 进入教师工具模块

如果当前账号拥有多个学科权限，首页会先显示不同学科模块，例如：

- English
- Math
- Vocabulary

点击某个学科后，会进入对应学科的管理视图。  
如果当前账号只允许一个学科，首页会直接落在该学科工作区。

### 4.2 左侧导航

教师端左侧导航当前包含以下入口：

- `Assessments Home`
- `Paper Generator`
- `Question Intake`
- `Question Bank`
- `Paper Manager`
- `Test History`
- `User Manager`

导航支持收起/展开。

- 展开时会显示完整文字标签
- 收起时只显示图标
- `Test History` 图标右上角会显示 `Pending Teacher Review` 数量，用来提醒还有多少条测评记录等待老师完成口语评分

### 4.3 退出登录

教师可在顶部栏点击 `Sign out` 退出当前账号。

## 5. Paper Generator

页面名称：`Paper Generator`

这是教师端“配置试卷结构”的核心页。  
它决定后续 `Question Intake` 可用的结构、Part、单元范围以及随机/练习题的筛选逻辑。

### 5.1 页面用途

你可以在这里完成：

- 新增一份结构模板（`Add Paper`）
- 设置试卷名称
- 设置描述
- 设置试卷类型
- 配置 Assessment Part
- 配置 Textbook Practice 的规则
- 删除结构模板
- 保存整套标签配置（`Save Tag Configuration`）

页面顶部会显示：

- 当前学科
- 当前已有多少份 paper 结构

### 5.2 两种结构类型

当前支持两类结构：

- `Assessment`
- `Textbook Practice`

#### Assessment

适用于正式测评或固定考试结构。  
此模式下，你需要配置：

- Part 前缀
- Part 编号
- Part 对应题型
- 每个 Part 的目标题量

其中英语学科支持拖拽 `Part` 顺序。

#### Textbook Practice

适用于教材练习或单元练习。  
此模式下，你需要配置：

- 单元范围（`Unit Range`）
- 练习筛选方式（`By Unit`、`By Question Type`、`By Skill`）
- 每条练习规则的筛选值
- 每条规则的题目数量

页面中可以用 `Add Practice Rule` 持续新增规则。

### 5.3 常见操作

推荐顺序：

1. 先选择学科
2. 点击 `Add Paper`
3. 填写 `Paper Name`
4. 选择 `Type`
5. 根据类型补充 `Part` 或 `Practice Rule`
6. 确认结构无误后点击 `Save Tag Configuration`

保存成功后，系统会提示：

- `Paper structure saved. Question intake now uses the updated settings.`

这意味着：

- `Question Intake` 录题页会立即读取新的结构设置
- 之后录入题库和新建试卷时，会按照这里的模板工作

### 5.4 使用建议

- 如果你准备录入随机题库，先把这里的结构配好，再去 `Question Intake`
- 如果你修改了 Part 或筛选规则，建议立刻进入 `Question Intake` 检查下拉项是否已同步
- 不建议先大量录题，再回头大改结构，否则会增加后续维护成本

## 6. Question Intake

页面名称可能显示为：

- `English Question Intake`
- `Math Question Intake`
- `Vocabulary Question Intake`
- `Edit ... Question Set`

这是教师端最核心的“录题 / 建卷 / 编辑卷子”页面。

### 6.1 页面用途

你可以在这里完成：

- 新建一份试卷
- 编辑已有试卷
- 录入题干、选项、参考答案
- 上传图片
- 上传听力音频
- 配置写作题、口语题
- 查看学生视角预览
- 保存草稿
- 发布试卷
- 另存为副本

### 6.2 编辑现有试卷

如果从 `Paper Manager` 或 `Question Bank` 进入编辑页：

- 页面会自动带入现有内容
- 顶部会显示正在编辑的 `paper ID`
- 学科会被锁定，不能在编辑过程中切换

### 6.3 Paper Mode

页面中的 `Paper Mode` 当前主要有以下几种状态：

- `Random`
- `Fix`
- 旧数据兼容时可能出现 `随机组卷模板`

建议理解为：

- `Fix`：用于固定卷编辑，适合教师直接搭建学生最终作答的试卷
- `Random`：用于录入随机题库题块，供 Question Bank / 随机组卷使用
- `随机组卷模板`：旧版历史模板兼容入口，仅在旧数据中出现

### 6.4 基本录题流程

固定卷最常见的录入顺序是：

1. 选择学科
2. 选择 `Fix`
3. 填写 `Paper Name`
4. 填写 `Description`
5. 添加 `Section / Part`
6. 在每个 Part 下添加 `Question / Big Question`
7. 选择题型
8. 填写 `Instructions`
9. 补充题干、选项、参考答案、标签等内容
10. 右侧查看 `Preview`
11. 点击 `Save Draft`
12. 检查无误后点击 `Publish Paper`

### 6.5 录题页的常用能力

#### 题型编辑

不同学科、不同 Part 会限制可选题型。  
系统会根据当前 Part 类型自动显示可用题型，不需要老师自己记题型编码。

#### 图片上传

当前支持多类图片上传：

- 题块图
- 选项图
- 写作题配图
- 口语题配图
- 词汇题配图

上传成功后，页面会即时刷新预览图。

#### 音频上传

听力大题支持上传音频。  
页面会提示：

- 上传时请保持页面打开
- 上传完成后才算真正保存成功

建议：

- 上传前先确认音频文件命名清晰
- 上传完成后立刻在右侧预览或编辑页中试播

#### 右侧预览

录题页右侧有 `Preview` 面板，作用是：

- 按学生视角实时检查当前试卷内容
- 检查说明文字、题目顺序、图片、音频是否正确
- 在长页面编辑时帮助快速定位正在修改的题块

### 6.6 保存、发布与复制

页面底部或右侧操作区会显示这些按钮：

- `Save Draft`
- `Publish Paper`
- `Save as Copy`

含义如下：

- `Save Draft`：保存当前内容，但不一定对学生可见
- `Publish Paper`：把当前卷子更新为正式版本
- `Save as Copy`：复制出一个草稿副本，用于保留原卷的同时进行改版

编辑已发布试卷时，页面状态标签会显示：

- `Status: Published`
- 或 `Status: Draft`

### 6.7 草稿恢复

系统支持恢复未正式保存的草稿。  
如果页面检测到本地未完成内容，会提示：

- `Recovered your last unsaved draft.`

建议：

- 看到恢复提示后，先通读一遍页面内容，再决定是否继续编辑
- 长时间录题时，仍建议主动点一次 `Save Draft`，不要完全依赖浏览器暂存

### 6.8 建议的录题习惯

- 先搭结构，再录题
- 先完成一整个 Part，再进入下一个 Part
- 每次上传图片/音频后立即检查预览
- 每录完一个关键部分就手动保存一次
- 正式发布前一定从右侧预览整体检查一遍

## 7. Question Bank

页面名称：`Question Bank`

这是教师查看“随机题库内容”的主页面。  
题库内容通常来自 `Question Intake` 中的 `Random` 录入模式。

### 7.1 页面用途

你可以在这里完成：

- 查看题库纸张
- 搜索题目
- 按学科过滤
- 按考试体系过滤
- 按题型过滤
- 展开查看题目预览
- 编辑原题库纸张
- 删除整份题库
- 删除单个题库条目

### 7.2 页面结构

顶部会显示：

- Total Question Banks
- 各学科题库数量

筛选区支持：

- `Keyword`
- `Exam System`
- `Question Type`
- 学科切换
- `Clear Filters`

### 7.3 查看题目

每条题库记录会显示：

- 标题
- 学科
- item 数量
- Item ID 摘要
- 更新时间

展开后可以看到：

- 题型标签
- 保存时的 tag
- 题目摘要
- 子题块预览

### 7.4 编辑与删除

每条题库纸张提供：

- `Edit`
- `View / Hide`
- `Delete`

展开后的每个题库 item 还提供：

- `Delete Item`

适用场景：

- 某道题标签错误，需要回到编辑页修改
- 某题已过时，直接删除单项
- 整个题库纸张无效，直接删整份

### 7.5 题库管理建议

- 如果题目结构错了，优先回到 `Question Intake` 编辑，不要只在这里观察
- 删除单个 `Item` 前，确认它不是当前随机组卷唯一来源
- 当筛选后什么都看不到时，先检查当前是否启用了 `Exam System` 或 `Question Type` 过滤条件

## 8. Paper Manager

页面名称：`Paper Manager`

这是学生端试卷的“上架管理页”。  
题库容器本身不在这里管理，这里只管理学生真正可能看到的试卷。

### 8.1 页面用途

你可以在这里完成：

- 查看学生端试卷数量
- 按学科筛选
- 搜索试卷
- 编辑试卷
- 复制试卷
- 切换学生可见状态
- 删除试卷
- 查看自动组卷警告

### 8.2 顶部统计与筛选

顶部会显示：

- Total Student Papers
- English Papers
- Math Papers
- Vocabulary Papers

搜索框支持：

- 按试卷名搜索
- 按 paper ID 搜索
- 按描述搜索

### 8.3 每张试卷卡片的常见按钮

手动卷通常提供：

- `Edit`
- `Duplicate`
- `Visible to students`
- `Delete`

自动组卷试卷通常提供：

- `Edit Generator`
- `Visible to students`
- `Delete`

其中：

- `Edit`：进入 `Question Intake` 编辑该卷
- `Duplicate`：复制成一份新的草稿卷
- `Edit Generator`：回到 `Paper Generator` 修改该自动卷的生成结构
- `Visible to students`：控制学生端是否能看到该卷
- `Delete`：删除该卷

### 8.4 发布可见性

`Visible to students` 开关是学生是否能看到该卷的最终控制项。  
即使内容已经写好，如果这里是关闭状态，学生仍然看不到。

老师排查“学生为什么看不到卷子”时，建议按这个顺序检查：

1. 该卷是否已存在于 `Paper Manager`
2. 该卷是否显示为 `Published`
3. `Visible to students` 是否已打开
4. 学生账号是否拥有对应学科权限

### 8.5 自动组卷提醒

如果是 `Paper Generator` 类型的卷，卡片可能显示 `generation warnings`。  
这表示当前组卷规则没有被完全满足，例如：

- 规则要求的题量不足
- 某些 Part 没有足够题源

建议看到警告后：

1. 先展开警告
2. 查看是哪条规则不满足
3. 回到 `Paper Generator` 或 `Question Bank` 补结构/补题

## 9. Test History

页面名称：`Test History`

这是教师端查看学生测评结果、下载报告、补做口语评分的核心页面。

### 9.1 页面用途

你可以在这里完成：

- 查看所有历史测评记录
- 搜索学生或试卷
- 查看完整报告
- 下载 PDF
- 删除历史记录
- 对口语部分进行老师评分

### 9.2 顶部统计

当前页面顶部会显示三张统计卡：

- `Total History Records`
- `Completed Scoring Reports`
- `Pending Teacher Review`

左侧导航中的 `Test History` 图标也会同步显示 `Pending Teacher Review` 数量，方便老师从全局快速看到待处理口语记录数。

### 9.3 搜索与筛选

页面支持：

- 按学生姓名搜索
- 按试卷名称搜索
- 按学科过滤

每条记录当前会显示状态标签，例如：

- `Completed Scoring Report`
- `Pending Teacher Review`

### 9.4 查看单条记录

点击某条历史记录的 `View` 后，页面会在该卡片下方展开完整报告。  
报告中可见：

- 学生档案
- 综合得分
- 总用时
- 各 Part 反馈
- 逐题回顾
- 写作状态
- 口语评分状态
- 下载 PDF 按钮

报告顶部支持：

- 中英文切换
- `Download PDF`

### 9.5 记录状态说明

#### Completed Scoring Report

表示该条记录已经具备完整可查看报告，且需要老师补充的口语评分流程已经结束。

#### Pending Teacher Review

表示该条记录中存在等待老师完成的人工评分内容。  
当前主要是口语部分。

### 9.6 删除历史记录

每条记录右侧有 `Delete`。  
删除前系统会弹确认框，删除后不可恢复。

## 10. 口语老师评分流程

当前教师端的口语处理逻辑是：

- 学生完成录音后，音频会先被保存进历史记录
- 老师之后在 `Test History` 中手动补评分
- 系统不要求老师重新上传音频

### 10.1 进入评分

步骤如下：

1. 打开 `Test History`
2. 找到状态为 `Pending Teacher Review` 的记录
3. 点击 `View`
4. 在口语题的 `评分维度` 区域找到 `老师评分`
5. 点击 `老师评分`

注意：

- `老师评分` 按钮当前放在口语题 `评分维度` 区域的右下角
- 不是在页面顶部单独显示

### 10.2 五个评分维度

当前口语人工评分固定按以下五项填写：

- 任务完成
- 流利度
- 词汇
- 语法
- 发音

每项满分为 5 分。  
老师只需要输入整数分值即可。

### 10.3 总反馈输入框

点击 `老师评分` 进入编辑状态后：

- 同一块评分区域内会出现 `口语总反馈` 输入框
- 输入框只在编辑状态出现
- 保存后不会继续占用报告版面

### 10.4 保存评分

填写完成后点击：

- `保存口语评分`

保存成功后：

- 口语评分会写回当前报告
- `Test History` 列表会刷新
- 该记录通常会从 `Pending Teacher Review` 转为 `Completed Scoring Report`

### 10.5 评分建议

建议老师按以下顺序评分：

1. 先播放整段录音
2. 再按五项维度逐个给分
3. 最后写一句整体反馈
4. 点击保存

如果你只想快速完成批量评分，建议“先打分，后补文字评语”，避免来回切换记录。

## 11. 写作报告的当前逻辑

教师在 `Test History` 中查看报告时，写作部分遵循以下规则：

- 如果学生没有提交作文，系统会显示 `未作答 / No Submission`
- 没有作文时，不会显示写作评分
- 没有作文时，不会显示语法修改
- 没有作文时，不会显示写作提示
- 没有作文时，不会显示 AI 改写示例

这意味着：

- 看到“未作答”就表示本次没有作文提交
- 不应再看到凭空生成的写作分数或建议

## 12. User Manager

页面名称：`User Manager`

这是教师端的账号维护页面。

### 12.1 页面用途

你可以在这里完成：

- 查看所有用户
- 查看账号是否 `Active`
- 查看谁拥有 `Full Workspace Access`
- 启用或停用账号
- 调整账号可见学科
- 删除账号

### 12.2 页面特点

当前页面的权限编辑是自动保存的，不需要额外点击“保存”按钮。

老师修改以下内容后会自动写回：

- `Account Status`
- `Visible Subjects`

页面会显示：

- `Saving...`
- `Saved`
- `Auto-save enabled`

### 12.3 当前限制

当前页面有一些保护逻辑：

- 不能把一个账号的学科全部取消
- 当前正在登录的用户不能删除自己
- 当前正在登录的用户也不应随意把自己改成不可用状态

### 12.4 使用建议

- 新老师开通权限：先让对方注册，再到这里补学科权限
- 需要停用账号：直接关闭 `Account Status`
- 学生只需要某一个学科时，可在 `Visible Subjects` 中只保留该学科

## 13. 推荐工作流

### 13.1 新建并发布一份固定卷

推荐顺序：

1. 进入 `Question Intake`
2. 选择学科
3. 选择 `Fix`
4. 填写 `Paper Name` 和 `Description`
5. 按 Part 录入题目
6. 上传所需图片和音频
7. 查看右侧 `Preview`
8. 点击 `Save Draft`
9. 点击 `Publish Paper`
10. 去 `Paper Manager` 确认 `Visible to students` 已开启

### 13.2 维护随机题库

推荐顺序：

1. 在 `Paper Generator` 先配结构
2. 进入 `Question Intake`
3. 切到 `Random`
4. 逐题块录入内容和标签
5. 去 `Question Bank` 检查是否已出现
6. 根据需要删除错误 item 或回编辑页修改

### 13.3 审阅学生报告

推荐顺序：

1. 进入 `Test History`
2. 搜索学生姓名
3. 点击 `View`
4. 阅读综合报告
5. 如需留档，点击 `Download PDF`
6. 如状态为 `Pending Teacher Review`，继续完成口语评分

### 13.4 批量处理口语

推荐顺序：

1. 先看左侧导航 `Test History` 的待评分数字
2. 进入 `Test History`
3. 优先筛查 `Pending Teacher Review`
4. 按记录逐条打开
5. 在口语区域点击 `老师评分`
6. 填写 5 项分数和总反馈
7. 保存后切换下一条

## 14. 常见问题与排错

### 14.1 为什么我看不到教师工具？

通常原因有：

- 账号没有完整教师工作台权限
- 邀请码只开了部分学科，但没有开教师权限
- 当前账号被设置成 `Inactive`

### 14.2 为什么学生看不到试卷？

优先按这个顺序检查：

1. 卷子是否已经录入成功
2. 卷子是否在 `Paper Manager` 中存在
3. 是否显示为 `Published`
4. `Visible to students` 是否开启
5. 学生账号是否拥有对应学科权限

### 14.3 为什么随机卷题量不够？

如果 `Paper Manager` 中某张自动卷出现 `generation warnings`，通常表示：

- 题库量不足
- 某条筛选规则过严
- `Paper Generator` 中配置的题量超过现有题库覆盖范围

处理建议：

1. 先看 warning 内容
2. 回到 `Question Bank` 检查题源
3. 必要时回 `Paper Generator` 调整规则

### 14.4 为什么 Test History 里还有待评分数字？

说明仍有记录处于 `Pending Teacher Review`。  
通常是某条口语记录还没完成老师评分。

### 14.5 为什么报告里写作部分没有分数？

如果学生没有提交作文，系统会按“未作答”处理，这是当前正确逻辑，不是异常。

### 14.6 上传音频或图片时要注意什么？

- 上传过程中不要刷新页面
- 音频上传完成后最好立即试播
- 图片上传完成后最好立即看右侧预览
- 大文件上传更需要保持页面停留，直到提示成功

## 15. 教师首次上线检查清单

建议正式投入使用前，老师至少完成一次全链路自测：

1. 登录教师账号
2. 进入 `Paper Generator` 检查结构
3. 在 `Question Intake` 新建一份测试卷
4. 上传一张图和一段音频
5. 保存并发布
6. 去 `Paper Manager` 打开学生可见开关
7. 用学生账号完成一次真实作答
8. 回到 `Test History` 查看报告
9. 下载一次 PDF
10. 对口语做一次老师评分

如果这 10 步都走通，说明教师端主要链路已经可正常使用。

## 16. 术语对照

- `Paper Generator`：试卷结构与随机规则配置页
- `Question Intake`：录题、建卷、编辑页
- `Question Bank`：随机题库浏览页
- `Paper Manager`：学生可见试卷管理页
- `Test History`：历史记录、报告与老师评分页
- `User Manager`：用户状态与学科权限管理页
- `Pending Teacher Review`：等待老师完成人工评分
- `Completed Scoring Report`：已完成评分的报告
- `Visible to students`：学生端是否可见
- `Save Draft`：保存草稿
- `Publish Paper`：发布试卷
- `Save as Copy`：另存为副本

