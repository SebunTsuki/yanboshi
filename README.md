# 时小悠 Web2D v0.1

“悠然时光”虚拟主播演播室原型。当前版本用于验证 PSD 分层角色在网页里动起来：待机、眨眼、呼吸、头部轻摆、基础口型和表情切换。

## 功能

- PSD 分层角色渲染，图层坐标来自 `assets/puppet/manifest.json`
- 自动眨眼、轻微呼吸、头部摆动和饰品摆动
- 基础口型：闭口、微笑、A/I/U/O/E
- 表情按钮：默认、开心、惊讶
- 控制面板：自动口型开关、手动张嘴滑条、重置
- 新帽子素材已接入，衣服保留原 PSD 素材

## 运行

```powershell
npm install
npm start
```

然后打开：

```text
http://localhost:4173
```

## 生成测试视频

先保持本地服务运行，然后执行：

```powershell
node tools/render-match-video.mjs
```

输出文件会写到：

```text
C:\Users\Administrator\Downloads\yanboshi-web2d-match-test.mp4
```

## 测试

```powershell
npm test
```

## 主要目录

- `assets/puppet/layers/`：PSD 导出的角色分层
- `assets/puppet/expressions/`：表情和口型素材
- `assets/puppet/replacements/`：后续生成的替换素材
- `assets/puppet/manifest.json`：图层坐标和素材清单
- `src/puppetConfig.js`：图层顺序、动效分组、口型和表情配置
- `src/puppetRuntime.js`：Web2D 渲染和动画运行时
- `test/`：图层、口型和资产配置测试
