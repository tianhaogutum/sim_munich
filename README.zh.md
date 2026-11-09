# 我们的 LMU

[English](README.md)

一款在浏览器里游玩的慕尼黑散步游戏：动漫风格的 LMU 广场、飘落的樱花、同行的人，以及值得拍下的小小瞬间。正在制作的「慕尼黑约会」章节计划用 **10–15 分钟**串起一次约会：入口见面 → 喷泉聊天 → 找回樱花发夹 → 拍三张照片 → 回到「我们的广场」领取明信片。

![LMU 游戏视觉参考](project/assets/lmu-game-concept-v1.png)

*视觉参考：`project/assets/lmu-game-concept-v1.png`，不代表当前实机画面已经达到这一效果。*

**当前版本说明：**文档以并行功能合入前的 `2a24dad` 为基准。已有广场、路线目标提示、胶囊角色占位、基础 PNG 拍照、程序化音频和触屏／手柄适配。对话选择、剧情存档、照片判定／相册／明信片导出、正式角色、标题／设置、小地图、手记、闲聊和运镜仍待集成。下文区分现有行为与计划功能，具体问题见[审阅记录](docs/REVIEW_FINDINGS.md)。

## 本地运行

在仓库根目录打开终端：

```sh
cd project
python3 -m http.server 8000
```

浏览器打开 <http://localhost:8000/>。保持终端运行，按 Ctrl+C 停止服务器。应以 **`project/`** 为服务目录：其中的 `index.html` 加载 `src/anime_main.js`。不要直接用 `file://` 打开 HTML；根目录的 `index_anime.html` 是旧副本，模块路径不适用于当前目录结构。

没有构建步骤，不需要 npm install。Three.js **r160（`0.160.0`）**及后处理模块通过 `project/index.html` 的 import map 从 jsDelivr 加载。展示字体来自 Google Fonts；字体加载失败时使用本地备用字体。

## 操作

请先让游戏页面获得焦点。后续模态界面应优先处理按键，再交给场景。

| 输入 | 功能 | 当前状态 |
|---|---|---|
| WASD／方向键 | 按镜头朝向行走 | 已有 |
| Shift + 移动 | 奔跑 | 已有 |
| 在画布上拖动鼠标 | 环绕镜头；上下拖动调整俯仰 | 已有 |
| 鼠标滚轮 | 缩放 | 已有 |
| E | 与最近地点互动；附近没有地点时可查看纪念日铭牌 | 已有 |
| P | 开关拍照模式 | 已有 |
| Space | 在拍照模式下载 PNG | 已有；照片任务暂用占位判定 |
| Esc | 退出拍照或关闭信息／纪念日面板 | 已有；暂停菜单待集成 |
| N | 开关小地图 | 计划由 `date_map.js` 提供，尚未接入 |
| M | 静音／开启音乐及环境声 | 已有 |
| J | 打开手记 | 计划由 `date_collect.js` 提供，尚未接入 |
| C | 开关自由镜头 | 计划由 `date_cinematic.js` 提供，尚未接入 |

**触屏：**粗指针设备自动显示控制层，也可用 `?touch=1` 强制显示。左摇杆移动，推到边缘奔跑；在右侧视角区域拖动可水平转向，双指缩放。按钮提供互动／确认、拍照模式、快门、返回。「隐藏 HUD 提示」只隐藏触屏提示，不会隐藏整个游戏 HUD。右侧触屏适配区域目前不控制镜头俯仰。

**手柄：**需要浏览器识别为 `standard` 映射的手柄。左摇杆移动，推到边缘奔跑；右摇杆横轴转向。A／下方功能键互动或确认，X／左方功能键开关拍照，B／右方功能键或 RT 在拍照模式按快门，Start 发送 Esc。这里使用 Xbox 键名，其他手柄标注可能不同。目前没有手柄纵向视角、缩放、对话选项导航或 N／J／C 的映射。

音频需要鼠标、触屏或键盘手势后才能按浏览器策略启动，也可以点击声音按钮。静音不影响完成章节。

## 约会路线

<details>
<summary>剧透：地点、阶段 ID 与当前骨架版通关方法</summary>

HUD 显示下一步目标。地面坐标写作 `(x, z)`，向北走意味着 `z` 变小。

1. **`meet`：入口 `(0, 5)`。**从出生点 `(0, 92)` 向北走，在主入口附近按 E。正式设定是女主与拉布拉多组成玩家一方，男主作为同行者；当前仍是两个胶囊占位角色。
2. **`fountain_talk`：喷泉 `(35, 40)`。**到东侧喷泉按 E。正式版计划在这里加入对话选择；骨架版直接推进，没有选择界面。
3. **`find_memento`：发夹 `(-44, 68)`。**到广场西侧树下标记按 E。该地点仅在此阶段显示，剧情记录 ID 为 `memento` 的 `COLLECT` 事件。
4. **`photos`：主楼、喷泉、合影。**按 P，构图后按 Space。目标 ID 是 `facade`、`fountain`、`couple`。**当前每按一次快门就自动完成下一个未完成目标**，不检查距离、构图和遮挡。按三次即可推进，每次都会下载 PNG。真实判定与相册待集成。
5. **`postcard`：我们的广场 `(0, 75)`。**回到标记按 E，状态进入 `done`，目标提示完成。当前还没有正式结尾／明信片界面或导出。

白玫瑰纪念地点 `(0, 55)` 是可选历史停靠点。入口附近 `(10, 5.5)` 的铭牌显示配置的相伴天数，二者都不影响通关。

正式设计中，喷泉选择影响结尾措辞，不应阻止通关。目前 `postcardText()` 对所有状态返回相同文字；分支仍属于设计目标。验收标准见[设计文档](docs/DESIGN.md)。

</details>

## 存档与重新开始

**当前剧情仅保存在内存中，刷新即重置。**已实现的持久化只有静音状态，键为 `lmu-date-audio-muted`，值为 `"true"` 或 `"false"`。PNG 是浏览器下载文件，不是游戏内相册。相伴天数使用 `project/src/anime_main.js` 的 `START_DATE`，当前为 `2024-03-15`。

目前没有重新开始按钮。可以刷新页面，或在开发者控制台重置当前剧情：

```js
window.__lmu.story.dispatch({ type: 'RESTART' });
```

计划中的正式存储键包括：剧情 `lmu-date-v1`、支线发现 `lmu-date-collect-v1`、设置 `lmu-date-settings`、照片 `lmu-date-photos-v1`，以及现有静音键。字段结构和「重新开始」清理范围仍需集成确认，见[架构文档](docs/ARCHITECTURE.md)。浏览器存储按来源和用户配置隔离，换域名或端口不会自动迁移，也没有跨设备同步。不要假定重新开始会清除所有独立存储键。

## 调试 URL

| 参数 | 含义 |
|---|---|
| `?stage=photos` | 以合法阶段开始新的内存状态。支持 `meet`、`fountain_talk`、`find_memento`、`photos`、`postcard`、`done`。不会补齐前置选择／物品／照片，也不会传送玩家；非法值回到 `meet`。 |
| `?touch=1` | 强制显示触屏控件，桌面也可用。 |
| `?notitle=1` | 预留给标题模块，当前忽略。 |

用 `&` 组合，例如 <http://localhost:8000/?stage=photos&touch=1>。验证正常开局和存档前先移除 `stage`。控制台调试入口 `window.__lmu` 包含 `engine`、`story`、`cast`、`photo`、`storyUI`、`audio` 和 `input`。

## 测试与工具

游玩不需要 Node；开发工具需要。运行 `shot.mjs` 建议使用 Node.js 22 或更新版本（原生 `fetch`、`WebSocket`），本地服务器需要 Python 3，截图需要本地 Chrome。

服务器启动后，在仓库根目录运行：

```sh
node project/tools/shot.mjs 'http://localhost:8000/?stage=photos' \
  --out /tmp/lmu-photos.png --size 1280x720 --wait 4000 \
  --eval '__lmu.engine.player.pos.set(0, 0, 30)' \
  --eval '__lmu.story.getState().stage'
```

可重复传入 `--eval`，表达式按顺序在页面执行；间隔由 `--between` 指定，默认 600 毫秒。`--wait` 是首次加载等待时间。默认浏览器路径为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，可用环境变量 `CHROME` 指向其他 Chrome／Chromium。截图保存到 `--out`；拍照下载进入临时配置目录，退出时清理，`--keep` 可保留。工具打印控制台错误和异常，**仅页面未捕获异常触发退出码 1**，退出码为零也应检查日志。

以下是 **QA／性能工具合入后的预定入口**：

```sh
node --test project/tests/
node project/tools/playthrough.mjs
node project/tools/perf_profile.mjs
```

`2a24dad` 中尚无 `project/tests/`、`playthrough.mjs` 或 `perf_profile.mjs`，现在无法运行这些命令。工具的 URL 和其他参数以合入后的实现为准，不能套用 `shot.mjs` 参数。现有 `date_story.mjs` 是不依赖 DOM 的纯逻辑模块。

## 浏览器支持与限制

使用支持 ES modules、import maps、`structuredClone` 和 WebGL 的近期浏览器。现有截图工具面向 Chromium；Safari、Firefox 和移动设备仍需完整流程验证，目前没有兼容性测试矩阵。手柄能否使用还取决于浏览器、设备和映射。

- 首次加载依赖 jsDelivr；没有离线包或 service worker。
- 必须有可用的 WebGL／GPU；没有画布降级或友好的渲染失败页。
- Bloom、软阴影、几何体和樱花可能给手机带来性能压力，画质设置待集成。
- 场景经过艺术化压缩，不是导航地图；旧模块的海岸是虚构地点。
- 对话／菜单的完整键盘和读屏支持仍待验证；触屏和手柄尚未覆盖全部计划功能。

## 目录

| 路径 | 用途 |
|---|---|
| `project/index.html` | 正式入口、共享 HUD、Three.js import map |
| `project/src/anime_main.js` | 场景、移动／镜头、engine API、模块接入、按键路由、渲染循环 |
| `project/src/date_route.mjs` | 阶段 ID、地点、照片目标、同行参数、边界 |
| `project/src/date_story.mjs`、`date_story_ui.js` | 纯状态机与当前目标界面 |
| `project/src/date_cast.js`、`date_photo.js` | 角色与拍照骨架 |
| `project/src/date_audio.js`、`date_input.js`、`date_input.css` | 程序化音频与触屏／手柄适配 |
| `project/tools/shot.mjs` | 无头浏览器截图、控制台检查 |
| `project/assets/` | 概念参考图、带来源元数据的旧素材 |
| `project/DATE_CONTRACT.md` | 接入约定与最初文件归属 |
| `project/CHANGELOG.md` | 基础提交记录与待合入条目模板 |
| `docs/` | [架构](docs/ARCHITECTURE.md)、[设计与路线图](docs/DESIGN.md)、[内容指南](docs/CONTENT_GUIDE.md)、[审阅记录](docs/REVIEW_FINDINGS.md) |

`main.js`、`our_world.js`、`lmu_neighborhood.js`、`lmu_interior.js`、`sunset_coast.js`、`amg_drive.js`、`river_drift.js` 和 `main.before-*.js` 是旧原型，**当前入口不加载它们**。其中的公园、室内、驾驶、信件和愿望系统可供后续章节复用，现在不是本章里的隐藏地图。

## 致谢与来源

- Three.js 及贡献者：MIT，仓库内保留 [THREE-LICENSE.txt](project/src/vendor/THREE-LICENSE.txt)；当前运行时使用 CDN 固定版本。
- Google Fonts 提供 Cormorant Garamond、Nunito、Klee One 字体。
- 现有地点文字标注了 LMU 官方导览和 Wikipedia 来源。建筑尺寸包含估算，发布前应复核史实文字。
- 旧素材的元数据标为 Poly Haven CC0：eye-candy.xyz 的 forest floor、Rico Cilliers 与 Rob Tuytel 的 fern，以及 sparse grass。各文件夹的 `sources.json` 保留来源；当前程序化广场未使用这些素材。
- 仓库未附概念参考图的独立来源／授权记录，也没有顶层项目许可证。Three.js 的许可证不代表全部游戏内容采用相同授权。
