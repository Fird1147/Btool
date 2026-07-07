由CC生成的一件尝试性工具。
一个本地运行的表格可视化编辑工具，主要用于浏览、搜索、编辑和回看 `.xlsx` 配表。

# biaotool

本项目配表可视化编辑工具，适用于对应分支。

## 快速开始

### 1. 安装依赖

```bash
cd <project-root>
npm install
cd client && npm install && cd ..
```

### 2. 添加用户（首次使用）

```bash
cd <project-root>
node scripts/add-user.js --username 你的名字 --password 你的密码
```

### 3. 启动服务

**需要开两个终端窗口：**

**终端 1 — 后端**
```bash
cd <project-root>
$env:PORT=3001
node server/index.js
```

**终端 2 — 前端**
```bash
cd <project-root>\client
npm run dev
```

> **注意：** 后端使用 3001 端口（避免与本机 3000 端口上的其他服务冲突）。
> 若你的 3000 端口空闲，可去掉 `$env:PORT=3001`，并将 `client/vite.config.js` 和
> `client/src/hooks/usePresence.js` 中的 `3001` 改回 `3000`。

### 4. 访问

打开浏览器访问 **http://localhost:5173**，使用第 2 步添加的用户名和密码登录。

---

## 局域网共享（给团队其他成员用）

```bash
cd <project-root>
npm run build          # 构建前端静态文件
$env:PORT=3001
npm start              # 生产模式，后端同时托管前端
```

局域网成员通过 `http://<你的局域网IP>:3001` 访问，无需安装任何东西。

查看本机局域网 IP：
```bash
ipconfig | findstr "IPv4"
```

---

## 功能说明

| 功能 | 说明 |
|------|------|
| 配表浏览 | 左侧目录按文件夹分组，点击文件夹名可折叠/展开，带 chevron 动画 |
| 可拖拽面板 | 侧栏/表格/编辑面板之间横向拖拽调节宽度；Diff 面板与主内容之间纵向拖拽调节高度；面板尺寸自动保存 |
| 5行表头编辑 | 表头（字段名/类型/Scope/标记/注释）与数据行均可点击编辑 |
| 智能编辑控件 | 根据第5行注释自动判断：是/否切换、数值输入、数组多值列表等 |
| Diff 预览 | BC5 风格左右对照，改动高亮，确认后一次性写回 xlsx |
| 操作日志 | 记录每次写入的用户、时间和具体字段变更，点击右上角 📋 查看 |
| 多人在线 | 实时显示同一张表的在线人数，他人写入后自动提示刷新 |
| 主题切换 | 右上角 ☀️/🌙 切换深色/浅色主题，偏好自动保存 |

---

## 独立性与迁移

biaotool 是完全自包含的工具，没有数据库依赖，没有云端服务，所有数据都存在本地文件里。

| 组件 | 存放位置 | 说明 |
|------|---------|------|
| 用户账号 | `server/data/users.json` | 随工具目录一起迁移 |
| 操作日志 | `server/logs/changes.json` | 随工具目录一起迁移 |
| 配表文件 | 由 `server/config.js` 指定 | 读写的是原始 xlsx，不拷贝到工具目录 |

**迁移步骤：**
1. 把整个 `biaotool/` 文件夹复制到目标机器
2. 修改 `server/config.js` 中的 `TABLES_ROOT` 指向正确的 xlsx 目录
3. 运行 `npm install` 安装依赖
4. 启动服务，正常使用

唯一的环境要求是目标机器安装了 Node.js（`node -v` 有输出即可）。

### 修改读取目录

编辑 `server/config.js` 第 4 行：

```js
// 切换到主干
TABLES_ROOT: path.resolve(__dirname, '<workspace>/data/tables'),

// 切换到其他分支
TABLES_ROOT: path.resolve(__dirname, '<feature-branch>/data/tables'),

// 绝对路径（跨机器部署时推荐）
TABLES_ROOT: '<absolute-path-to-tables>',
```

改完后重启后端即生效，前端无需重新构建。

> xlsx 文件须遵循 5 行表头规范（R1 字段名 / R2 类型 / R3 Scope / R4 标记 / R5 中文注释），否则解析会出错。

---

## 目录结构

```
biaotool/
├── server/              ← Node.js 后端
│   ├── services/        ← 核心服务（读表/写表/校验/日志/在线）
│   ├── routes/          ← API 路由
│   ├── middleware/      ← 鉴权中间件
│   ├── data/users.json  ← 用户账号（bcrypt 加密）
│   └── logs/changes.json← 操作日志
├── client/              ← React 前端
│   └── src/
│       ├── components/  ← 界面组件
│       ├── hooks/       ← useTable / usePresence / useTheme
│       └── utils/       ← controlInfer（智能控件推断）
├── scripts/
│   └── add-user.js      ← 添加用户 CLI 工具
└── README.md
```

## 待实现功能
| # | 功能 | 说明 | 状态 |
|---|------|------|------|
| 1 | **历史版本一键恢复** | 在 SVN diff 面板中对单行或单元格添加“恢复”按钮，将历史值写回本地改动队列，走现有 `Diff → 提交` 流程 | 已完成 |
| 2 | **行内筛选** | 列头增加下拉筛选和搜索框，按字段值过滤显示行，类似 Excel 自动筛选 | 已完成 |
| 3 | **跨表引用跳转** | 点击 `vector3_array_int` 等引用字段的单元格，直接跳转到被引用表的对应行 | 待开发 |
| 4 | **收藏夹** | 常用表加星标置顶，偏好存 `localStorage`，无需后端改动 | 待开发 |
| 5 | **多版本横向 diff** | 任选两个历史 `revision` 互相对比，不限于“当前 vs 历史” | 待开发 |

