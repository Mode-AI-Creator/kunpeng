#!/usr/bin/env python3
"""
style-library-cinematic-upgrade — 通用风格库影视级升级（gpt-image-2.5 / seedream 等通用生图通道）。

方法论：五维参数框架（画面主体与环境置景 / 美学调性 / 视听摄影与光学系统 /
色彩光影 / 后期渲染特效），模板按此框架手写。

只做两件事，幂等：
1. 存量风格 promptTemplate 在「约束」行前补"影视级增强"参数段（不删原文一字）。
2. 追加 12 个按五维框架手写的新风格（已存在同 id 则跳过）。

用法：python3 scripts/style-library-cinematic-upgrade.py [风格库 index.json 路径]
默认升级用户数据目录（~/.kunpeng/...）；打包前必须对仓库内置种子 aigc-memory/style-library/index.json 执行一次——
应用每次版本升级会用内置种子强制覆盖用户风格库（commands.rs:468）。
"""
import json
import os
import sys

LIB = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.kunpeng/aigc-memory/style-library/index.json')

LIVE_ACTION_BLOCK = (
    '- 画幅与光学：电影画幅比例，匹配画面主体的焦距与光圈，景深服务主体\n'
    '- 光影纪律：指定具体物理光源与明暗反差，避免"光线柔和"式虚词\n'
    '- 后期质感：轻微胶片颗粒，柔和高光晕染，电影级数字调色，自然动态范围，无塑料感与数码特效感\n'
)
ANIMATION_BLOCK = (
    '- 画面完成度：剧场版动画级完成度，细腻光影层次与材质刻画，美术风格统一，无廉价平涂感\n'
)

NEW_STYLES = [
    {
        'id': 'live-action-毕赣乡土诗意', 'name': '毕赣乡土诗意长镜头', 'category': 'live-action',
        'thumbnail': 'live-action/路边野餐梦境.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，毕赣《路边野餐》乡土诗意风格。
镜头描述：贵州山地村落的日常切片——石砌民居、潮湿青苔、缭绕山雾中的人物静默伫立，时间仿佛凝滞。
技术参数：
- 景别：全景至中景，环境占比大
- 拍摄角度：平视或略微俯视的远距离观察视角
- 焦距/光圈：约35mm，f/4，深景深保留环境层次
- 画幅：16:9
- 布光：阴天云层漫射自然光，山谷反射微光，柔和体积光穿过雾气
- 色调：自然绿色、青瓦深灰、石材灰褐低饱和色调，点缀衣物暖色
- 构图：多层空间纵深，乡间小路或溪流作引导线，人物置于环境之中
- 后期质感：真实大气雾效，轻微体积光，低强度胶片颗粒，电影级数字摄影质感，HDR 自然动态范围
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：蓝绿低饱和乡土色板，山雾灰、青苔绿、青瓦深灰\n- 光影：阴天漫射+雾气体积光，低光比\n- 构图：环境主导的多层纵深，人物渺小其中\n- 场景：贵州山地村落，潮湿、青苔、石砌、雾气',
        'cameraLanguage': '- 景别：全景/中景为主\n- 拍摄角度：平视或轻微俯视观察位\n- 焦距/运镜：35mm 左右，长镜头凝视感，运镜极克制',
        'promptSuffix': 'Bi Gan "Kaili Blues" style, rural Guizhou mountain village, misty atmosphere, muted green palette, observational long-take feel, 35mm, deep focus, overcast diffused light, poetic realism, cinematic film grain',
    },
    {
        'id': 'live-action-李安克制戏剧', 'name': '李安克制室内戏剧', 'category': 'live-action',
        'thumbnail': 'live-action/色戒民国摄影.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，李安式克制室内剧情片风格。
镜头描述：室内餐桌上的人物近景，表情克制内敛，暗潮汹涌的情绪压在平静表面之下，台灯的暖光勾勒侧脸轮廓。
技术参数：
- 景别：中近景至中景
- 拍摄角度：平视，略带三四分之一侧面
- 焦距/光圈：约50mm，f/2.0，浅景深分离主体
- 画幅：1.85:1
- 布光：暖色钨丝台灯或窗光作具体光源，低位侧光，伦勃朗式面部阴影，环境反射光微弱
- 色调：低饱和棕褐与深灰蓝主色调，奶油白与琥珀金点缀
- 构图：三分法，前景道具（花瓶/台灯）形成框景与视觉平衡
- 后期质感：自然景深、柔焦高光、细微胶片颗粒，写实电影级渲染，模拟35毫米胶片扫描
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和棕褐+深灰蓝，奶油白与琥珀金点缀\n- 光影：钨丝灯/窗光具体光源，伦勃朗式面部阴影，低调照明\n- 构图：三分法+前景框景\n- 场景：高级餐厅/书房/客厅，木质与布艺质感',
        'cameraLanguage': '- 景别：中近景为主\n- 拍摄角度：平视三四分之一侧面\n- 焦距/运镜：50mm 浅景深，固定机位为主',
        'promptSuffix': 'Ang Lee style restrained interior drama, warm tungsten practical lamp lighting, Rembrandt facial shadow, muted sepia and deep blue-grey palette, 50mm f/2.0 shallow depth of field, 1.85:1, subtle film grain, photorealistic cinematic rendering',
    },
    {
        'id': 'live-action-李沧东冷峻郊野', 'name': '李沧东冷峻郊野', 'category': 'live-action',
        'thumbnail': 'live-action/处子之山冷调.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，李沧东《燃烧》式冷峻 neo-noir 风格。
镜头描述：薄暮蓝调时刻，乡郊边缘地带的人物半身侧影——输电塔、积雪或泥泞土路、简易棚屋构成荒凉的日常，人物指间一点香烟暖火。
技术参数：
- 景别：中近景结合环境叙事
- 拍摄角度：平视，三分之二侧面肖像
- 焦距/光圈：约50mm，f/2.8，浅景深面部细节
- 画幅：2.39:1 宽银幕
- 布光：云层过滤的月光或暮光为主，阴天环境光，人物剪影与浅层面部细节，香烟微弱暖色火星作唯一暖点
- 色调：低饱和蓝灰、冷钢蓝与雪白色调
- 构图：三分法，人物置于一侧，大面积负空间，道路与电缆作引导线
- 后期质感：自然大气雾霭、远景空气透视、低饱和冷色分级、柔和高光、轻微胶片颗粒与高动态范围，无明显 CG 痕迹
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和蓝灰、冷钢蓝、雪白\n- 光影：蓝调时刻暮光，剪影+浅层面部细节，唯一暖色点缀\n- 构图：人物侧置+大负空间，引导线\n- 场景：乡郊工业边缘，输电塔、土路、棚屋',
        'cameraLanguage': '- 景别：中近景带环境\n- 拍摄角度：平视三分之二侧面\n- 焦距/运镜：50mm f/2.8，凝视式固定机位',
        'promptSuffix': 'Lee Chang-dong "Burning" style neo-noir, blue hour rural outskirts, desaturated steel-blue palette, silhouetted figure with faint warm cigarette ember, 50mm f/2.8, 2.39:1 widescreen, atmospheric haze, restrained film grain, photorealistic digital cinema',
    },
    {
        'id': 'live-action-武侠格栅窗光', 'name': '武侠格栅窗光双人', 'category': 'live-action',
        'thumbnail': 'live-action/卧虎藏龙竹海.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，武侠电影室内场景风格。
镜头描述：传统木结构室内，半透明格栅窗透入温暖日光，武侠人物近景双人层次构图，衣料刺绣与皮肤纹理清晰可见，情绪张力在静默中酝酿。
技术参数：
- 景别：近景至特写双人肖像
- 拍摄角度：平视正面机位，前后层次
- 焦距/光圈：约50-85mm 中长焦，f/2.0-f/2.8 浅景深
- 画幅：2.15:1 超宽银幕
- 布光：侧后方格栅窗自然日光为主光源，形成窗格光影图案，辅以柔和环境反射光
- 色调：暖棕色、琥珀色、米白色与低饱和青绿色
- 构图：中央对称或双主体平衡布局，前后景层次，面部为视觉焦点
- 后期质感：自然皮肤纹理，轻微胶片颗粒与柔和高光溢出，写实数字电影渲染，接近 ARRI 摄影机肤色表现，无明显 CG 效果
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：暖棕、琥珀、米白、低饱和青绿\n- 光影：格栅窗投影+侧后自然光，柔和明暗过渡\n- 构图：中央对称/双主体层次\n- 场景：传统木结构室内，格栅窗、纸窗、深色木梁',
        'cameraLanguage': '- 景别：近景/特写双人\n- 拍摄角度：平视正面\n- 焦距/运镜：50-85mm 中长焦浅景深',
        'promptSuffix': 'wuxia film interior, lattice window light patterns, warm amber and ivory palette with muted teal, 85mm f/2.0 shallow depth, 2.15:1 widescreen, dual-figure layered composition, natural skin texture, subtle film grain, ARRI-like cinematic rendering',
    },
    {
        'id': 'live-action-秦汉军阵史诗', 'name': '秦汉军阵史诗', 'category': 'live-action',
        'thumbnail': 'live-action/天国王朝十字军.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，中国历史战争史诗风格（秦汉至三国气质）。
镜头描述：重甲将领立于指挥军帐之下，兽面金属胸甲与佩刀兵器细节分明，身后是排列的持矛士兵、旌旗与朦胧地平线，临战军阵氛围肃穆。
技术参数：
- 景别：中近景至中景，前景主体压迫感
- 拍摄角度：正面平视，略带轻微低机位英雄化效果
- 焦距/光圈：约50mm 标准镜头，f/4-f/5.6 中等景深
- 画幅：16:9
- 布光：阴天自然天光为主，粗粝自然主义漫射光效，辅以帷幕下环境反射光与金属反光
- 色调：低饱和铁灰、烟褐、暗红与旧金色调
- 构图：中央对称构图，前景主体与背景纵深层次，旗帜线条引导视线
- 后期质感：轻度电影级调色、空气雾霭、远景景深衰减、细微尘埃与战场氛围增强，基于物理的金属/皮革/织物材质，低调数字合成
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和铁灰、烟褐、暗红、旧金\n- 光影：阴天漫射自然光，金属微反光\n- 构图：中央对称英雄式，旗帜引导线\n- 场景：古代军营指挥区，重甲、旌旗、兵器',
        'cameraLanguage': '- 景别：中近景/中景\n- 拍摄角度：正面平视带轻微低机位\n- 焦距/运镜：50mm，f/4-5.6',
        'promptSuffix': 'ancient Chinese war epic, armored general under command canopy, Qin-Han to Three Kingdoms era, desaturated iron-grey and aged-gold palette, overcast diffused daylight, 50mm f/4, centered heroic composition, banners and spears, restrained cinematic color grade, physically based metal textures',
    },
    {
        'id': 'live-action-中世纪骑士群像', 'name': '中世纪骑士群像', 'category': 'live-action',
        'thumbnail': 'live-action/北欧人冷雪.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，中世纪欧洲战争史诗风格。
镜头描述：中世纪战场集结地——披甲骑士与战马居前景，金发持剑军官、密集步兵方阵、长矛与战旗铺陈至远山，阴云压境。
技术参数：
- 景别：中广景群像镜头
- 拍摄角度：平视，略带正面英雄视角
- 焦距/光圈：约50mm 标准镜头，f/5.6 中等景深
- 画幅：16:9
- 布光：厚重云层过滤的日光，柔和低对比自然漫射光，金属反光与环境填充光
- 色调：低饱和冷灰、铁青、墨绿与暗红色调
- 构图：前景骑士与战马形成视觉主轴，前中后景层次与旗帜线条引导视线
- 后期质感：写实历史战争视觉效果，轻度环境雾气、群像扩展、旗帜动态与细微尘土颗粒，电影级写实渲染质感，接近虚幻引擎高保真数字合成与实拍调色
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和冷灰、铁青、墨绿、暗红\n- 光影：云层过滤日光，低对比漫射\n- 构图：群像前中后景层次，旗帜引导线\n- 场景：中世纪战场集结地，骑士、步兵方阵、战旗',
        'cameraLanguage': '- 景别：中广景群像\n- 拍摄角度：平视英雄视角\n- 焦距/运镜：50mm f/5.6 中等景深',
        'promptSuffix': 'medieval war epic, armored knights and infantry formation, desaturated steel-blue and dark crimson palette, overcast filtered daylight, 50mm f/5.6, layered group composition with banner lines, atmospheric haze, photorealistic cinematic rendering',
    },
    {
        'id': 'live-action-军事科幻废土', 'name': '军事科幻废土', 'category': 'live-action',
        'thumbnail': 'live-action/疯狂的麦克斯荒漠.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，军事科幻/后启示录战争片风格。
镜头描述：荒漠废土战场——重装机甲士兵与风化装甲运输车，红色光学目镜在沙尘中发亮，弹药与战术挂载、报废载具残骸散布低矮山脊。
技术参数：
- 景别：中全景，双人物全身构图
- 拍摄角度：低机位仰拍，轻微广角透视
- 焦距/光圈：约35mm，f/5.6 景深
- 画幅：2.40:1
- 布光：沙漠低角度太阳光穿透尘埃，电影级硬朗侧逆光，深阴影与金色轮廓光，装甲目镜与武器上的红色电子光点缀
- 色调：低饱和橄榄绿、枪灰、沙土棕与烟尘金色
- 构图：三角形构图，前景主体压迫感，装甲车形成背景框架与引导线
- 后期质感：尘埃粒子、空气透视、体积雾、镜头级景深、金属磨损增强，UE5 式实时渲染质感，PBR 金属材质，电影级色彩分级与高细节数字合成
约束：写实照片质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和橄榄绿、枪灰、沙土棕、烟尘金\n- 光影：硬朗侧逆光+体积光+沙尘散射，红色电子光点缀\n- 构图：三角形压迫构图，载具框架\n- 场景：荒漠废土战场，重装机甲、风化载具',
        'cameraLanguage': '- 景别：中全景全身\n- 拍摄角度：低机位仰拍轻微广角\n- 焦距/运镜：35mm f/5.6',
        'promptSuffix': 'military sci-fi post-apocalyptic, heavily armored soldiers, weathered armored vehicle, desaturated olive-green and gunmetal palette, hard side-backlight with volumetric dust, red electronic glow visors, low-angle 35mm, 2.40:1, UE5-style PBR metal, cinematic color grading',
    },
    {
        'id': 'live-action-哥特烛光教堂', 'name': '哥特烛光教堂', 'category': 'live-action',
        'thumbnail': 'live-action/潘神的迷宫哥特.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，哥特式恐怖/黑暗奇幻风格。
镜头描述：地下室式中世纪石砌礼拜堂——粗粝石灰岩墙面、尖拱穹顶、十字形窗洞，白袍人物跪地祈祷，铁制烛台垂落烛泪，幽闭且荒废的宗教空间。
技术参数：
- 景别：远景至大全景，完整呈现人物与建筑空间
- 拍摄角度：正面平视机位，略带庄严的低压迫感
- 焦距/光圈：约28mm 广角，f/4.0 中等光圈，深景深
- 画幅：1.78:1
- 布光：十字窗外冷白色自然天光为主光源，画面前后方蜡烛提供低位暖色补光，石墙微弱反射光，高反差明暗对照，宗教绘画式伦勃朗光
- 色调：低饱和灰褐色、炭黑色、旧石色与冷白色为主，局部蜡烛暖金色点缀
- 构图：中央对称构图，门框式构图，引导线，中心主体与十字窗形成垂直轴线
- 后期质感：轻微体积光束、蜡烛火焰辉光、窗光高光溢出、空气尘埃颗粒、自然暗角与胶片级高光滚降，以实景摄影为核心的高细节写实渲染，电影级 HDR 与真实材质表现，无明显 CGI 痕迹
约束：写实照片质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和灰褐、炭黑、旧石色、冷白，蜡烛暖金点缀\n- 光影：十字窗冷天光+低位烛光，高反差明暗对照\n- 构图：中央对称+门框框景+垂直轴线\n- 场景：中世纪石砌教堂/地下墓室，尖拱、烛台',
        'cameraLanguage': '- 景别：远景/大全景\n- 拍摄角度：正面平视微压迫\n- 焦距/运镜：28mm f/4 深景深',
        'promptSuffix': 'gothic horror medieval chapel, cross-shaped window cold daylight key, low candle fill, high-contrast chiaroscuro, Rembrandt lighting, centered symmetrical composition, 28mm f/4 deep focus, desaturated stone-grey palette, volumetric light rays, dust particles, photorealistic, cinematic HDR',
    },
    {
        'id': 'live-action-雨夜泪光肖像', 'name': '雨夜泪光情绪肖像', 'category': 'live-action',
        'thumbnail': 'live-action/堕落天使夜港.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，雨夜情感剧情片肖像风格。
镜头描述：极近景至近景——雨幕中的人物面部占据画面主体，湿透的发丝与衣物，面部水珠与雨水飞溅，含泪微笑或复杂情绪在近距离被放大。
技术参数：
- 景别：极近特写至近景
- 拍摄角度：平视机位，略带轻微低角度亲密观察感
- 焦距/光圈：约50-85mm 人像镜头，f/2.8 浅景深
- 画幅：2.39:1 电影宽银幕
- 布光：正面偏侧柔光、顶部环境光、冷色雨天散射光，湿润高光与轻微轮廓光，微弱补光
- 色调：冷灰蓝与低饱和肤色为主，辅以温暖肤色高光
- 构图：中心偏左或偏右构图，一侧留白，面部视觉重心，负空间结合
- 后期质感：真实降雨、水珠反光、湿发与湿衣材质增强，轻微景深与高光散射，低程度颗粒与对比度调色，写实数字电影质感，基于物理光照的自然渲染，接近 ARRI 数字摄影与电影级调色
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：冷灰蓝+低饱和肤色，暖肤色高光\n- 光影：雨天散射光+湿润高光+轮廓光\n- 构图：面部主体+一侧留白负空间\n- 场景：极简暗色雨幕，水珠、湿发、湿衣',
        'cameraLanguage': '- 景别：极近特写/近景\n- 拍摄角度：平视微低角度亲密观察\n- 焦距/运镜：50-85mm f/2.8 浅景深',
        'promptSuffix': 'rainy night emotional drama portrait, wet hair and skin with water droplets, cool charcoal-blue palette with warm skin highlights, 85mm f/2.8 shallow depth, 2.39:1, soft frontal-side key light, photorealistic rainfall, ARRI-style cinematic texture, restrained film grain',
    },
    {
        'id': 'live-action-水城 noir 剪影', 'name': '水城 noir 剪影', 'category': 'live-action',
        'thumbnail': 'live-action/消失的爱人冷调.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，悬疑 noir 电影风格。
镜头描述：欧洲水城运河场景——石砌拱桥下的人物剪影与小型木船，连续叠层拱桥、斑驳潮湿石墙、水面倒影与远处暖色灯光，清晨或阴天白昼。
技术参数：
- 景别：远景至大全景
- 拍摄角度：平视机位，人物背后跟拍视角
- 焦距/光圈：约35mm 广角镜头，f/4 光圈
- 画幅：2.55:1 超宽银幕
- 布光：阴天漫射天光，拱桥外部冷色环境光，远处建筑暖色灯光与水面反射光，高反差低调照明，轮廓剪影
- 色调：低饱和青灰、炭黑、湿石灰褐色，少量暖金色点缀
- 构图：中央构图、拱门框景、对称构图、引导线构图、前景遮挡与视觉递进
- 后期质感：轻微水面增强、倒影细节强化、薄雾与空气透视、暗部压暗和高光柔化，写实电影级数字中间片调色，接近 ARRI Alexa 实拍质感，低锐度胶片颗粒与自然动态范围
约束：写实照片质感，无文字无水印。''',
        'visualDNA': '- 色调：低饱和青灰、炭黑、湿石灰褐，暖金点缀\n- 光影：阴天漫射+剪影+远处暖光反射\n- 构图：拱门框景+对称+引导线+前景遮挡\n- 场景：欧洲水城运河，石砌拱桥、木船',
        'cameraLanguage': '- 景别：远景/大全景\n- 拍摄角度：平视背后视角\n- 焦距/运镜：35mm f/4',
        'promptSuffix': 'mystery noir European canal city, silhouetted figure under masonry arch bridge, desaturated blue-grey and wet limestone palette, 2.55:1 ultra-wide, 35mm f/4, archway framing, water reflections, overcast diffused light, ARRI Alexa texture, restrained film grain',
    },
    {
        'id': 'live-action-古装烛光侧脸', 'name': '古装烛光侧脸肖像', 'category': 'live-action',
        'thumbnail': 'live-action/花样年华暗香.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，历史剧情片古装室内肖像风格。
镜头描述：古典室内空间——暗红色木质墙面或屏风前的人物侧脸肖像，深色传统服饰、精致发饰，暖色烛光或灯笼光斑在背景虚化，内敛沉思的神情。
技术参数：
- 景别：特写至大特写
- 拍摄角度：平视侧面肖像机位
- 焦距/光圈：约85mm 中长焦镜头，T1.8 大光圈，浅景深突出面部
- 画幅：2.39:1 宽银幕
- 布光：侧前方暖色烛光或油灯为主光源，背景实景灯笼散射光，微弱环境反光，低调柔和的明暗对比，电影式明暗光，细腻面部渐变
- 色调：琥珀棕、焦糖色、深褐色、暗红色的暖色低饱和调色
- 构图：三分法构图，人物位于一侧，另一侧留白，侧脸轮廓线引导视线
- 后期质感：自然主义视觉效果，浅景深散景，柔和高光晕染，轻微胶片颗粒，细腻皮肤纹理，无明显数字特效，电影级数字中间片调色，写实摄影渲染质感，柔和镜头光晕与高光滚降
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：琥珀棕、焦糖、深褐、暗红，暖色低饱和\n- 光影：烛光/油灯主光，灯笼散射，低调明暗\n- 构图：三分法侧置+留白，轮廓线引导\n- 场景：古典室内，暗红木墙/屏风、烛光灯笼',
        'cameraLanguage': '- 景别：特写/大特写\n- 拍摄角度：平视侧面\n- 焦距/运镜：85mm T1.8 大光圈浅景深',
        'promptSuffix': 'historical drama candlelit profile portrait, dark red wooden interior, amber caramel umber palette, 85mm T1.8 shallow depth, 2.39:1, rule of thirds with negative space, candle key light with lantern bokeh, delicate facial gradation, fine film grain, film-grade DI color, soft highlight roll-off',
    },
    {
        'id': 'live-action-山区上学路', 'name': '山区上学路纪实', 'category': 'live-action',
        'thumbnail': 'live-action/贾樟柯纪实主义.jpg',
        'promptTemplate': '''角色设定：你是一位专业摄影师，乡土剧情片/现实主义纪录电影风格。
镜头描述：山地传统村落的清晨——背着书包的孩子们沿乡间小路行走，石墙木梁民居、深色青瓦屋顶、拱形石门、荷塘与繁茂植被，远处浓密山林与雾气。
技术参数：
- 景别：大全景至全景
- 拍摄角度：平视机位，略微俯视的远距离观察视角
- 焦距/光圈：约35mm，f/5.6-f/8 深景深
- 画幅：16:9
- 布光：阴天漫射光结合薄雾中的柔和体积光，云层散射的自然日光，山谷反射光与建筑表面的柔和环境光
- 色调：自然绿色、石材灰褐、青瓦深灰与儿童服装的鲜艳红蓝色形成对比
- 构图：前景植物与人物、中景村落建筑、后景山林形成多层空间，乡间小路作为引导线
- 后期质感：真实大气雾效、轻微体积光、自然景深、低强度胶片颗粒与写实色彩分级，电影级数字摄影质感，HDR 自然动态范围，接近 ARRI Alexa 的柔和高光与纪录片式真实渲染
约束：写实照片，真人皮肤质感，无文字无水印。''',
        'visualDNA': '- 色调：自然绿+石材灰褐+青瓦深灰，人物服装鲜艳对比\n- 光影：阴天漫射+薄雾体积光\n- 构图：前中后景多层空间，小路引导线\n- 场景：山地村落，石砌民居、青瓦、荷塘、山雾',
        'cameraLanguage': '- 景别：大全景/全景\n- 拍摄角度：平视微俯视观察位\n- 焦距/运镜：35mm f/5.6-8 深景深',
        'promptSuffix': 'rural drama documentary realism, mountain village morning, schoolchildren on country path, stone houses and dark tiled roofs, natural green and slate-grey palette with vivid clothing accents, overcast diffused light with misty volumetric rays, 35mm deep focus, 16:9, ARRI Alexa soft highlights, documentary authenticity',
    },
];


def upgrade_template(style: dict) -> bool:
    """在「约束」行前插入影视级增强段；幂等。返回是否有改动。
    存量旧模板一律没有「画幅」行；带「画幅」行的是按五维框架手写的新模板，跳过。"""
    template = style.get('promptTemplate', '')
    if '画幅' in template or '画面完成度' in template:
        return False
    block = ANIMATION_BLOCK if style.get('category') == '2d-animation' else LIVE_ACTION_BLOCK
    marker = '约束：'
    if marker in template:
        template = template.replace(marker, block + marker, 1)
    else:
        template = template.rstrip() + '\n' + block.rstrip()
    style['promptTemplate'] = template
    return True


def main() -> int:
    if not os.path.exists(LIB):
        print(f'风格库不存在：{LIB}', file=sys.stderr)
        return 1
    idx = json.load(open(LIB))
    upgraded = sum(1 for s in idx['styles'] if upgrade_template(s))
    existing = {s['id'] for s in idx['styles']}
    added = 0
    for style in NEW_STYLES:
        if style['id'] not in existing:
            idx['styles'].append(style)
            added += 1
    with open(LIB, 'w') as f:
        json.dump(idx, f, ensure_ascii=False, indent=2)
    print(f'升级存量 {upgraded} 条；新增 {added} 条；总计 {len(idx["styles"])} 条')
    return 0


if __name__ == '__main__':
    sys.exit(main())
