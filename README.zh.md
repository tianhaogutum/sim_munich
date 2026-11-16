# 我们的慕尼黑

运行方式和完整说明见 [README](README.md)。

```sh
cd project
python3 -m http.server 8100
```

- [LMU 约会篇章](http://localhost:8100/)：双人角色与狗、对话选择、寻找发夹、真实取景任务、相册与明信片。G 打开六街区地图，查看实景照片并快速前往。
- [慕尼黑全市探索](http://localhost:8100/city.html)：在线加载真实道路及建筑轮廓；133 个目的地、25 个城区导航点、17 条探索路线。WASD 移动，Shift 奔跑，F 跟随人物，G 地点列表，P 保存截图。

两种模式都提供触屏控制。约会进度、相册和城市探索记录保存在当前浏览器。城市模式需要联网；范围是覆盖慕尼黑的游戏矩形，并非精确行政边界。建筑是地图轮廓与高度拉伸，缺少的数据采用近似表达；除 LMU 周边外，尚未逐栋精细复原。

真实对照照片及署名、许可见 [照片清单](project/assets/reference_photos/sources.json)。数据来源与局限见 [城市范围说明](docs/CITY_SCOPE_SOL.md)。

已通过 T3 界面创建13个共用当前工作区的独立 SOL 对话，没有创建新 worktree。当前最新目标为至少20个标准档对话；余下7个因内置工具 `parent_not_active` 仍未创建。按用户要求已停止 Computer Use。记录见 [会话清单](docs/CITY_SESSIONS_CREATED.json)。100项任务清单和地图网格均不代表100个已启动代理。
