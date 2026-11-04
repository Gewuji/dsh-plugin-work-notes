# 工作便签 · Work Notes

> **这是一个 DSH 插件** —— 全称 DeepSeek Harness，本仓库是它的一个 Web 界面插件（bundle）。装进 DSH 后出现在左侧栏，不是独立软件、不能单独运行，也不需要构建。

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web 界面加一个**左侧栏工作便签面板**：随手记下待办，卡片自由摆放、缩放、吸附对齐；便签可带起止日期，在**日历**和**甘特图**里拖拽改期。

[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.1.x-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-4D6BFE)](https://github.com/topics/dsh-plugin)

> 纯前端插件：不注册宿主路由、不执行命令、不发起网络请求，便签只存在你自己的浏览器里。

## 功能

**便签画布**
- 自由拖动、右下角拖拽缩放，靠近其它卡片时自动吸附（按住 `Alt` 临时关闭吸附）
- 4 种配色、置顶、删除二次确认、`未完成 / 进行中 / 完成` 三种状态
- 顶部 `Ctrl + Enter` 快速添加；卡片按编辑顺序层叠

**日历视图**
- 周一开头的月历，单元格带**农历**与节气/节日注解
- 在单元格上直接建便签；点击便签弹出日期弹层：第一次点设置开始日，第二次点设置结束日
- 起止日期覆盖某天的便签会显示在该天里，可直接拖动改期

**甘特视图**
- 时间轴按天排布（每天 26px），上限 180 天，围绕今天自动留白
- 拖动整条移动、拖两端拉伸，按整天步进
- 新建时可自动识别文字里的日期，未排期的便签可一键按文字补日期

**其它**
- 内置中英文界面（跟随 DSH 语言）
- 面板自带帮助说明
- 便签数据保存在浏览器 `localStorage`，卸载插件不删除

## 安装

DSH 的插件安装器直接支持从 git 仓库安装，本仓库根目录就是一个完整的插件包（`package.json` 里声明了 `dsh.bundle`），**不需要构建步骤**。

### 方式一：桌面端 / Web 界面里装（推荐）

1. 打开 **设置 → 插件**（插件管理）
2. 在「包名或地址」里粘贴：

   ```
   https://github.com/Gewuji/dsh-plugin-work-notes
   ```

3. 点「安装」，完成后**重启 DSH**（桌面端退出重开；Web 端重启 `dsh` 服务），再刷新页面

### 方式二：命令行装

```sh
dsh plugin --profile web add https://github.com/Gewuji/dsh-plugin-work-notes
# 等价写法
dsh plugin --profile web add github:Gewuji/dsh-plugin-work-notes
```

装完重启 `dsh` 服务（或退出重开桌面客户端），刷新页面。

> `--profile` 跟你要用的 profile 走：命令行 / `npx @deepseek-ai/dsh web` 启动的通常是 `web`。
> **桌面客户端由 Electron 独占管理 `desktop` profile，命令行不允许改它**，桌面端请用方式一。

### 方式三：本地开发（拷贝目录安装）

```sh
dsh plugin --profile web add D:\path\to\dsh-plugin-work-notes
```

（路径必须是绝对路径。）

安装成功后，左侧栏出现笔记形状的「工作便签」图标，点开即用。

## 使用

| 操作 | 效果 |
|---|---|
| 顶部输入框 + 回车 / `Ctrl + Enter` | 新增便签 |
| 拖动卡片 / 拖右下角 | 移动 / 缩放 |
| 按住 `Alt` 拖动 | 临时关闭自动吸附 |
| 卡片上的颜色点、图钉、状态 | 换色 / 置顶 / 切换状态 |
| 顶部「便签 / 日历 / 甘特」 | 切换视图 |
| 记「周五前整理周会纪要」 | 新建时自动解析出日期 |
| 「持续 3 天」 | 由单个开始日展开成区间 |

## 数据与隐私

- 存储键：`dsh-work-notes.v1`（浏览器 `localStorage`）
- 桌面端页面源是 `dsh-app://app`，Web 端是 `http://127.0.0.1:3080`（可用 `--port` 改）
- 因此：**桌面端与浏览器之间、换端口之后，便签不共享、不迁移**；同一端反复启动是本地的，不会丢
- 不上传、不写会话记录；换电脑请自行导出/手工复制

## 卸载

- 图形界面：**设置 → 插件 → 已安装** 找到 `dsh-plugin-work-notes` 删除
- 命令行：

  ```sh
  dsh plugin --profile web remove dsh-plugin-work-notes
  ```

- 卸载**不会**删除已有便签（仍在浏览器存储里），想彻底清掉请在该站点的 localStorage 中删除 `dsh-work-notes.v1`

## 兼容性

- 面向 **DSH 0.1.x**（在 `0.1.7-rc.2` 上验证）
- 依赖的稳定接口只有三处：`dsh.client` bundle 格式、`sidebar.panellist` / `main` 两个注册点、`dsh-client-ui-layout` + `dsh-client-ui-sidebar` 注入
- 桌面端和 Web 端**通用**：桌面壳加载的同样是 `platform: "web"` 的客户端模块，功能与数据存放方式一致，只是两边数据各自独立
- 没有 `peerDependencies`，不会被版本兼容闸门拦截；没有安装脚本，不会被 pnpm 的 build 拦截策略挡下

DSH 大版本（0.2 / 1.0 等）若改动上述接口，本插件需要跟着更新；遇到问题欢迎开 [Issue](https://github.com/Gewuji/dsh-plugin-work-notes/issues)。

## 项目结构

```
package.json       包元信息 + dsh.bundle / dsh.client 声明
cordis.patch.yml   bundle 补丁层：把插件条目插进 profile
index.js           宿主侧入口（空实现，行为都在浏览器端）
client.js          插件本体：面板、便签画布、日历、甘特（单文件，无构建）
icon.svg           侧栏图标
locale/zh.json     中文标题与简介（插件市场展示用）
locale/en.json     英文标题与简介
```

## 开发

没有构建步骤：改 `client.js` 后重启 DSH 服务并刷新页面即可；浏览器端有改动也可以走 DSH 的 HMR。

```sh
# 本地联调
dsh plugin --profile web add D:\path\to\dsh-plugin-work-notes
```

## License

[MIT](LICENSE) © Gewuji
