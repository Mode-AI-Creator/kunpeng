# 鲲鹏影视制作流程对照审阅

日期：2026-09-20。鲲鹏基线：`6b14297` 及当前工作区。Higgsfield 官方仓库查询到的 main 提交：`d071406147a37b835bed09543d85ab3e9bd85c7d`；已读技能文件标注 0.12.0。通过 GitHub 网页和 raw 文件阅读，未安装或执行第三方技能。本文是代码与流程审阅，未对真实付费生成、完整成片或界面做验收。现有未提交修改保持原样。

用户明确约束：本轮工业化改造不纳入首尾帧功能，不新增相关字段、节点、界面或生成依赖。

## 本轮实际实施范围（用户后续收窄）

明确不做：声音与剪辑编排、提示词与模型能力合同、审片与交付、首尾帧，以及任何新增前端按钮或功能入口。下文相关条目仅保留为历史审阅，不是实施计划。
本轮只修复制作设定的局部更新和现有下游失效提示，并通过已有提示词强化后台的事实边界、改稿影响、资产用途和镜头创作判断；不新增资产类型、审批流程或制作面板。

## 本轮变更记录

- 共用设定更新入口改为类别与字段级局部合并，未传内容保留；数组明确传入时替换该列表。非法类别、字段或 null 在发布状态前拒绝。
- 工具写盘改用完整合并结果，避免内存保留而独立设定文件仍被截断。
- 有实质变更时沿用现有步骤状态，把下游已完成步骤标记 stale；相同内容与仅更新时间的提交不触发提醒，不修改素材或中断进行中的生成。
- 通过现有编剧、导演与资产提示词加强事实/提案边界、局部改稿影响、参考用途与连续性判断；未新增 UI、存储字段或工作流入口。
- 新增纯函数及真实工具/存储链路测试，验证局部更新、持久化、失效、无效输入与无操作更新。全量 harness 812 项通过；生成服务未被调用。

## 判断

鲲鹏已经有较完整的创作与生产底座。主要缺口是把“文字里的制作要求”变成“可追溯的版本、可执行的依赖、可核验的交付”。单纯增加编剧提示词、模型数量或把技能库整体安装进来，不能解决这些问题。

Higgsfield skills 是供应商工作流规范，覆盖生成、品牌系统、角色身份、产品图、解说视频等；不能据此宣称达到电影行业认证或完整长片生产标准。下文明确区分官方可借鉴机制与面向影视的扩展建议。

## 已有能力，应保留

- 文案有正文版本、批注锚点和只读剧情审阅；编剧指导覆盖人物行动、对白、因果、时长预算、长稿与改稿。不是只有文风润色。
- 工坊有剧本→拆解→资产→提示词→生成→交付六步，剧情事实原文、镜头事实 ID、叙事职责和导演决策。
- 已有导演、角色、场景、连续性四套制作设定；角色生命周期、音色、场景多角度参考、色卡与导演约束卡。
- 已有稳定对象 ID、候选版本、生成快照、提交状态、参考图顺序校验及部分上游失效提示。
- 剪辑引擎已有音频混合、字幕和响度归一能力；不能把交付差距描述为“没有剪辑或声音能力”。

代码依据：[编剧指导](../../src/lib/copywriting/screenwritingCraft.ts)、[工坊模型](../../src/lib/workshop/types.ts)、[项目对象](../../src/lib/projectObjects/types.ts)、[提交入口](../../src/lib/workspace/generationCommand.ts)、[合成引擎](../../src/lib/editor/composeEngine.ts)。

## 1. 制作设定：从说明文字变成可追踪的定版规则（P0）

**官方借鉴**：Brandkit 的 Brand Lock 区分 fixed/proposed/unknown/not_applicable，并标记证据来源；下游记录依赖的基础版本，变更只使相关产物失效。

**鲲鹏现状**：`WorkshopProjectBibles` 已涵盖影视设定，但规则主要是字符串和更新时间。`workshopStore.setBibles` 只替换、记录日志；该入口未直接调用下游失效。`workshop_set_bibles` 又把未传的类别置为 undefined，存在局部更新丢失其他类别的风险。当前 `invalidateDownstream` 是步骤级、且只标记已完成步骤，不能表达某角色改服装只影响若干镜头。

**修改**：新增规则 ID、修订号、状态、来源、适用角色/场次；区分 patch 与 replace。生成快照绑定规则版本。变更时列出受影响草稿、候选和已采用版本，保留历史文件。旧产物可继续查看，但不能未经说明作为新基线的正式交付。

**验收**：只改角色 A 的第二套服装，不丢失场景设定，不使角色 B 的镜头失效；受影响镜头显示具体原因；历史任务回传不能覆盖新定版。

落点：`src/lib/workshop/types.ts`、`src/stores/workshopStore.ts:1194`、`src/lib/agent/tools/workshopTools.ts:1204`、`src/lib/workspace/submissions.ts`。

## 2. 资产设定：身份、服装、表演与美术风格分层（P0）

**官方借鉴**：Soul ID 提供可复用身份引用，但仅适用于其支持的 Soul 模型；Explainer 复用统一风格图；Brandkit 复用权威资产。

**鲲鹏现状**：角色已有三视图、生命周期、音色和候选；单个 `assetImagePath` 仍承担较多含义。`WorkspaceReference.role` 目前只显式定义 director-constraint，其余主要按媒体类型组织。

**修改**：角色资产包分别保存身份基准、服装造型、年龄/伤势状态、表情、音色；场景包保存平面关系、主光方向、时间天气、可用机位；道具包保存尺寸、持有人与状态。参考用途增加 identity/costume/style/layout/prop/motion/voice，并绑定资产版本。不是每个模型都支持这些独立通道，由适配器明确转换和披露能力限制。

**验收**：风格参考不会被误用为角色身份；换衣不重建脸；反打不镜像房间；不支持多参考的模型在提交前说明冲突。模型生成的一致性仍须验收，不能保证像素级不变。

落点：`src/lib/workspace/types.ts:2`、`src/lib/workshop/shotRefs.ts`、`src/lib/workspace/generationCommand.ts:32`、`src/lib/workspace/assetDraftModel.ts`。

## 3. 文案与剧本：增加制作版本和变更影响（P1）

**官方借鉴**：Brandkit 对已提供内容保真、区分已定和提议；Explainer 要求资料核实后再写作。该库不是完整编剧教学体系。

**鲲鹏现状**：`CopyDoc` 是带修订号的文本，编剧方法已较充分；需要核实并补齐跨文案与工坊的场次级稳定绑定，而不是继续堆叠“好莱坞”术语。

**修改**：保留自由写作；进入制作后建立场次 ID、源文档修订、故事时间、角色知情范围、动作与台词。原文事实、创作提案、导演解释分别保存。对白改稿要能找到关联的配音、字幕、镜头；只影响相应段落。

**验收**：修改一场对白，其他场不被重写；可定位过期配音和字幕；审阅区分文学问题、制作约束与事实冲突。不要以机械节拍或传播分数替代剧情判断。

落点：`src/lib/copywriting/types.ts`、`storyReview.ts`、`screenwritingCraft.ts`、`src/lib/workspace/scriptTools.ts`。

## 4. 剧本拆分：从分镜描述到可执行镜头合同（P1）

**官方借鉴**：Explainer 每个块明确文字、声音、画面配对及组装顺序。用于剧情片时应借鉴配对与依赖，不能照搬固定十秒。

**鲲鹏现状**：已经有 sourceFactIds、入镜/出镜状态、叙事职责、景别和运镜；连续性审计包含词语匹配和启发式规则。这些能筛查风险，不能证明实际视频接戏正确。

**修改**：镜头合同记录叙事任务、开始/结束状态、动作节拍、屏幕方向、视线、道具交接、对白/声音关联、剪辑切点、允许变化。文本检查给证据和风险级别；生成后检查实际动作过程、人物位置和相邻镜头的剪辑衔接。支持导演明确标记有意跳切或越轴。

**验收**：同一段两人交接道具的戏，远景、近景和反打可组成连贯动作；镜头数不固定；空镜有明确用途；主观判断允许有依据地忽略。

落点：`src/lib/workshop/types.ts:231`、`directorReasoning.ts`、`shotNarrativeAudit.ts`、`workshopPrompts.ts`。

## 5. 画布：展示制作依赖与影响范围（P0/P1）

**官方借鉴**：Brandkit 的局部依赖失效和只修坏项。官方技能并没有要求必须使用某种节点画布，以下是鲲鹏产品化方案。

**修改**：在现有项目对象上显示“使用何版本资产、约束来自哪里、输出供谁使用”。区分参考边、生成依赖边、剪辑顺序；边必须有实际执行含义。右键提供影响预览、重做本项、重做受影响项；无依赖节点并发，有资产定版或声音依赖的节点按顺序。

不新增第二份资产或任务存储，不让画布、工坊与项目工作面各自维护版本。任务成功、候选选中、审核通过应是不同状态。

**验收**：修改母版后，只提示真正引用它的镜头；节点删除不丢失历史媒体；任务断线恢复不重复提交；参考边绝不被误当剪辑顺序。

落点：`src/lib/projectObjects/types.ts`、`src/lib/workshop/canvasSyncModel.ts`、`src/lib/workspace/taskProjection.ts`、`src/lib/workspace/submissions.ts`。

## 6. 提示词与模型：用能力合同转换制作要求（P0）

**官方借鉴**：Generate 读取模型 schema、区分媒体角色、提交前校验；其简短提示词建议只是一般经验，不能统一套到所有视频模型。

**鲲鹏现状**：已有模型目录、专属路由、参数校准和草稿快照；工作面请求最终把参考按 image/video/audio 分组，用途信息未完整进入统一合同。

**修改**：先形成模型无关镜头意图，再由模型适配器生成参数与提示词。能力表记录通道版本、参考上限、声音、时长和比例约束。供应商有发现接口则同步，没有则维护经测试的能力版本。参数被调整、参考被省略时记录实际提交回执，不能悄悄改变制作意图。

**验收**：文生视频不携带参考；超出容量提交前阻断；切换模型不丢失原草稿；明确展示意图与实际提交的差异。禁止为解决合同错误重放已付费任务。

落点：`src/lib/workspace/engineCatalog.ts`、`drafts.ts`、`generationCommand.ts`、`src/lib/canvasGen/index.ts`。

## 7. 声音与剪辑：按项目类型编排（P1）

**官方借鉴**：Explainer 先完成旁白，再生成画面，按块对应自动组装，不能只交一堆散片。

**影视扩展**：建立剧情短片、广告、解说三个模板。解说按已生成语音真实时长组织画面；剧情按对白表演和动作切点组织镜头；广告另存版本变量与平台交付。分离对白、环境、效果、音乐，已有时间线与配音能力继续使用。

**验收**：配音、字幕、镜头用稳定 ID 关联而非数组下标；删镜后不串台词；可生成预演粗剪，再替换正式镜头。不要把“一个旁白、十秒一段、非写实、禁止对白”的解说限制带入剧情片。

落点：`src/lib/workspace/timelineSource.ts`、`src/lib/workspace/productionSafety.ts`、`src/lib/doubaoSpeech/`、`src/lib/editor/composeEngine.ts`。

## 8. 审片与交付：成功生成不等于制作完成（P0/P1）

**官方借鉴**：Brandkit 同时检查单项和整套一致性，区分视觉判断与可测量属性，维护交付清单、版本和局部修订。

**鲲鹏现状**：任务有 succeeded，资产有 selected，步骤有 done；在已审阅的核心类型中尚未看到完整的镜头验收记录。素材导出目前主要分类收集路径。合成器已有字幕、混音和固定参数的响度归一，不应重复实现。

**修改**：增加候选→待审→可用→采用的验收记录，以及缺陷类型、证据时间码、修复范围。视觉检验人物、服化道、动作、空间、风格；程序测量文件可解码性、尺寸、帧率、音画时长、黑帧/静音风险和字幕边界。主观项目人工定版；可委托自动通过的规则应显式配置。

交付包增加镜头表、采用版本、源素材、生成合同、字幕、声音分轨和 manifest。按平台配置画幅、帧率、编码、色彩与响度；不得把当前固定 -16 LUFS 设置称为所有影视交付标准。若要专业剪辑交换，另行实现并验证目标剪辑软件的格式；本次检索未发现 AAF/OTIO/FCPXML 的完整实现，不据此承诺支持。院线 DCP、HDR 和放映级声画 QC 应独立立项。

**验收**：脱离当前电脑仍能定位并重链接交付素材；知道每镜用了哪套资产与参数；修第 7 镜不重做全片；最终文件已实际检查，不能只依据模型一句“通过”。

落点：`src/lib/projectObjects/types.ts`、`src/lib/workspace/exportMaterials.ts`、`src/lib/editor/composeEngine.ts`。

## 实施次序与样片验收

1. **先统一生产事实**：设定 patch/版本、依赖失效、参考用途、实际提交合同、验收记录。先把“旧资产误用、设定被覆盖、生成了但不知道能否用”解决。
2. **再改用户工作流**：场次级改稿影响、镜头合同、画布影响预览、资产定版台、声音与粗剪协同。
3. **最后扩展交付与规模**：交换格式、平台交付预设、多项目模板、成本/重做统计及长片需求。避免一次把全部专业字段塞进默认页面。

建议用一部 60–90 秒叙事短片做验收：两人、两场景、一个需跨镜交接的道具、一段对白、一次服装变化。镜头数由叙事决定。执行三次真实变更：改对白、换服装、改主光方向，验证各自只影响对应声音/字幕、相关角色镜头和相关场景镜头。先进行无付费合同测试，再在明确预算下做端到端样片。

指标建议：关键剧情事实覆盖；采用镜头可溯源率；已发现连续性缺陷关闭率；一次改动导致的无关重生成数；实际与预估成本差；交付缺失文件数。除可测量合同外，不把未经标定的视觉分数包装成质量认证。

## 不建议照搬

- 不强制全部切到 Higgsfield：工作流原则与供应商实现分开，现有模型适配器可复用。
- 不把 Soul 身份引用假定为跨供应商通用，也不保证一次训练永久不变脸。
- 不把解说十秒分块、单旁白和非写实限制用于电影。
- 不强制每一个微小步骤弹确认；只在关键定版和确实缺失的信息上交互，尊重用户已给出的委托。
- 不把 Virality Predictor 的广告注意力指标当编剧、电影艺术或连续性的评分标准。
- 不把提示词中的“保持像素完全不变”当生成模型必然能兑现的保证；精确文字、图形和字幕优先采用确定性合成。

## 官方依据

- [官方技能库](https://github.com/higgsfield-ai/skills)
- [Brandkit：锁定、版本与依赖](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-brandkit/SKILL.md)
- [Brand Lock：规则状态与证据](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-brandkit/references/brand-lock.md)
- [QA：整套一致性、局部修复与交付](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-brandkit/references/qa-and-iteration.md)
- [Generate：模型与生成合同](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-generate/SKILL.md)
- [媒体角色](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-generate/references/media-inputs.md)
- [提示词指导](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-generate/references/prompt-engineering.md)
- [Soul ID](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-soul-id/SKILL.md)
- [Video Explainer](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-video-explainer/SKILL.md)
- [Product Photoshoot](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-product-photoshoot/SKILL.md)
- [Thumbnail：参考与局部编辑](https://github.com/higgsfield-ai/skills/blob/main/higgsfield-youtube-thumbnail/SKILL.md)
