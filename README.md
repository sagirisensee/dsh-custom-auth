# dsh-custom-auth

> **DeepSeek Harness (DSH)** 专属持久化安全认证插件：为 Web 界面注入自定义账号密码登录页，并在 DSH 核心升级时自动自愈打补丁。

---

## 🌟 核心特性

- **📱 移动端友好登录页**：未登录或 Token 失效时，优雅重定向至专门适配手机视口的深色管理员登录页。
- **🛡️ 抵抗内核升级覆盖（自愈补丁机制）**：官方 DSH 执行 `npm update` 全量覆盖底层时，插件在启动时毫秒级自动执行自检与热补丁注入，防止升级后丢失登录认证。
- **🍪 长期免密 Cookie**：登录成功一次即可获得为期 10 年（3650 天）的高强度签名凭据 Cookie，免除频繁输入 Token 的烦恼。
- **🔒 敏感凭据环境变量隔离**：支持直接通过 `DSH_AUTH_USERNAME` 与 `DSH_AUTH_PASSWORD` 声明管理员账号密码，安全不落源码。

---

## 🚀 安装与挂载

### 1. 克隆至个人插件目录
```bash
git clone https://github.com/sagirisensee/dsh-custom-auth.git ~/.dsh/plugins/dsh-custom-auth
```

### 2. 添加到 Web Profile 依赖
```bash
dsh plugin --profile web add ~/.dsh/plugins/dsh-custom-auth
```

### 3. 配置服务环境变量
在 `~/.config/systemd/user/dsh-web.service`（或你的 DSH 启动脚本中）加入环境变量：
```ini
Environment=DSH_AUTH_USERNAME=你的用户名
Environment=DSH_AUTH_PASSWORD=你的安全密码
```

随后重载并重启服务：
```bash
systemctl --user daemon-reload
systemctl --user restart dsh-web.service
```

---

## 📄 开源许可证

MIT License
