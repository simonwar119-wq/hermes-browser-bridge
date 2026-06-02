# Chrome Web Store — 隐私权规范填写内容

## 单一用途说明

> 粘贴到"隐私权规范"标签页的"单一用途"输入框。

```
Hermes AI Assistant 的唯一用途是帮助用户在浏览器侧边栏中完成网页理解和浏览器操作，包括：分析当前页面内容、回答与当前页面相关的问题、执行用户主动发起的浏览器操作（如截图、导航、点击、滚动、表单填写），以及在可选的本地 Bridge 模式下连接到用户自己机器上的本地 Hermes Agent 服务。扩展不运行开发者自有代理服务器；AI 请求只会在用户主动发送时直接发往用户选定的 AI 提供商。
```

## 权限理由

> 分别在"隐私权规范"标签页中，为每个权限输入对应的理由。

### sidePanel

```
sidePanel 权限用于在浏览器右侧显示 Hermes AI Assistant 的主界面。用户通过侧边栏查看当前页面信息、与 AI 对话、执行截图/导航/点击/表单填写等浏览器操作，并在需要时触发本地 Bridge 功能。
```

### contextMenus

```
contextMenus 权限用于在用户右键菜单中添加“总结本页”“分析本页”等快捷操作。用户主动点击后，扩展会打开侧边栏并基于当前页面内容执行相应请求。
```

## 隐私政策 URL

> 粘贴到"隐私权规范"标签页的"隐私政策"输入框。

```
请不要再填写 raw.githubusercontent.com 的 Markdown 链接。
```

建议改成一个可公开访问的 HTML 页面，例如：

```
https://<your-public-domain>/privacy-policy.html
```

如果你用 GitHub Pages，可以把本仓库里的 `privacy-policy.html` 发布后填写：

```
https://<your-github-pages-domain>/privacy-policy.html
```

如果你直接用这个仓库开启 GitHub Pages（Source 选 `main` 分支的 `/docs` 目录），则推荐填写：

```
https://<your-github-username>.github.io/hermes-browser-bridge/privacy-policy.html
```
