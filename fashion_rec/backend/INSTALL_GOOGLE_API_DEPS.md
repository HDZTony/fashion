# 安装 Google API 客户端库

## 需要安装的库

代码已经更新为使用 `google-api-python-client` 的标准用法，需要安装以下依赖：

1. `google-api-python-client` - Google API Python 客户端库
2. `google-auth-httplib2` - HTTP 传输层支持
3. `google-auth-oauthlib` - OAuth 2.0 支持
4. `cryptography` - 加密库（用于凭据加密）

## 安装方法

### 方法一：使用 uv（推荐）

```bash
cd fashion_rec/backend
uv sync
```

这会自动安装 `pyproject.toml` 中列出的所有依赖，包括：
- `google-api-python-client>=2.100.0`
- `google-auth-httplib2>=0.1.1`
- `google-auth-oauthlib>=1.1.0`
- `cryptography>=41.0.0`

### 方法二：使用 pip

```bash
cd fashion_rec/backend
pip install google-api-python-client>=2.100.0 google-auth-httplib2>=0.1.1 google-auth-oauthlib>=1.1.0 cryptography>=41.0.0
```

### 方法三：使用 uv 单独安装

```bash
cd fashion_rec/backend
uv pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib cryptography
```

## 验证安装

安装完成后，验证库是否正确安装：

```bash
cd fashion_rec/backend
uv run python -c "from googleapiclient.discovery import build; from google.oauth2.credentials import Credentials; from google_auth_oauthlib.flow import Flow; print('✅ All Google API libraries imported successfully')"
```

或者使用 pip：

```bash
python -c "from googleapiclient.discovery import build; from google.oauth2.credentials import Credentials; from google_auth_oauthlib.flow import Flow; print('✅ All Google API libraries imported successfully')"
```

## 如果安装失败

### 问题 1：网络问题

如果在中国大陆，可能需要使用镜像：

```bash
# 使用清华镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple google-api-python-client google-auth-httplib2 google-auth-oauthlib cryptography
```

### 问题 2：依赖冲突

如果遇到依赖冲突，可以尝试：

```bash
# 先升级 pip
pip install --upgrade pip

# 然后安装
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib cryptography
```

### 问题 3：权限问题

如果遇到权限问题：

```bash
# 使用 --user 标志
pip install --user google-api-python-client google-auth-httplib2 google-auth-oauthlib cryptography
```

## 已更新的代码

代码已经更新为使用 `google-api-python-client` 的标准用法：

1. ✅ 使用 `googleapiclient.discovery.build()` 创建服务
2. ✅ 使用 `google.auth.transport.requests.Request` 进行 token 刷新
3. ✅ 自动处理 token 过期和刷新
4. ✅ 使用标准的 API 方法调用

## 检查当前状态

检查依赖是否已在 `pyproject.toml` 中：

```bash
# 查看 pyproject.toml
cat fashion_rec/backend/pyproject.toml | grep google
```

应该看到：
```
"google-api-python-client>=2.100.0",
"google-auth-httplib2>=0.1.1",
"google-auth-oauthlib>=1.1.0",
```

## 下一步

安装完成后：

1. 重启后端服务
2. 测试 SEO Dashboard 功能
3. 验证 API 调用是否正常工作
