# Chrome Web Store — 隐私权规范填写内容

## 单一用途说明

> 粘贴到"隐私权规范"标签页的"单一用途"输入框。

```
Hermes Browser Bridge 的唯一用途是作为本地 Hermes AI Agent 与用户浏览器之间的桥接工具。它通过本地 WebSocket 连接接收 Agent 指令，在用户当前标签页中执行网页导航、内容读取、截图、点击、表单填写等操作，并将结果返回给 Agent。所有通信仅发生在本地（127.0.0.1），不收集、不传输、不存储任何用户数据。
```

## 权限理由

> 分别在"隐私权规范"标签页中，为每个权限输入对应的理由。

### sidePanel

```
sidePanel 权限用于在浏览器侧边栏显示连接状态、当前页面信息和操作日志。用户可通过侧边栏实时查看扩展与 Bridge Server 的连接状态，以及最近执行的浏览器操作记录。所有信息仅显示在用户本地浏览器中，不传输到任何外部服务器。
```

### contextMenus

```
contextMenus 权限用于在用户右键菜单中添加"让 Hermes 分析当前页面""让 Hermes 处理选中文字""让 Hermes 总结本页"等快捷指令。用户通过右键菜单主动触发操作，将其发送给本地 Hermes Agent 处理。此权限仅用于创建菜单项和响应点击事件，不读取、不收集任何上下文信息。
```

## 隐私政策 URL

> 粘贴到"隐私权规范"标签页的"隐私政策"输入框。

```
https://raw.githubusercontent.com/simonwar119-wq/hermes-browser-bridge/refs/heads/main/PRIVACY_POLICY.md
```

如果标准 URL 还不能访问，先用这个带 `/refs/heads/main/` 的版本，等几分钟后试试标准 URL：

```
https://raw.githubusercontent.com/simonwar119-wq/hermes-browser-bridge/main/PRIVACY_POLICY.md
```
