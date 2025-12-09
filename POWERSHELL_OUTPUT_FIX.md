# PowerShell 输出被抑制问题解决方案

## 问题描述

在 Cursor 的终端中执行 PowerShell 命令时，所有输出都被抑制，无法看到命令执行结果。

## 可能的原因

1. **Cursor 终端工具的输出重定向问题** - 终端工具可能没有正确捕获 PowerShell 的输出流
2. **PowerShell 执行策略限制** - 可能阻止了某些命令的输出
3. **编码问题** - UTF-8 编码可能导致输出显示异常
4. **输出流重定向** - stdout/stderr 可能被重定向到空设备

## 解决方案

### 方案 1: 使用诊断脚本（推荐）

运行诊断脚本来识别具体问题：

```powershell
# 在 PowerShell 中执行
cd "c:\Users\hedz\Desktop\何东洲的代码库\lang"
.\diagnose_powershell.ps1
```

如果执行策略阻止运行，先设置：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 方案 2: 使用 Python 脚本下载安装脚本

由于 PowerShell 输出被抑制，使用 Python 脚本作为替代：

```powershell
# 使用 uv 运行 Python 脚本
uv run download_cursor_install.py
```

或者直接使用 Python：

```powershell
python download_cursor_install.py
```

### 方案 3: 手动下载并执行

1. **使用浏览器下载**：
   - 打开浏览器访问: https://cursor.com/install
   - 保存页面内容为 `cursor-install.sh`

2. **使用 curl.exe**（如果可用）：
   ```powershell
   curl.exe https://cursor.com/install -o cursor-install.sh
   ```

3. **使用 Invoke-WebRequest 并保存到文件**：
   ```powershell
   Invoke-WebRequest -Uri https://cursor.com/install -OutFile cursor-install.sh
   ```

### 方案 4: 直接在外部 PowerShell 窗口执行

1. 打开新的 PowerShell 窗口（以管理员身份运行）
2. 执行以下命令：

```powershell
# 方法 1: 使用 curl.exe
curl.exe https://cursor.com/install -fsS | bash

# 方法 2: 使用 Invoke-WebRequest
(Invoke-WebRequest -Uri https://cursor.com/install -UseBasicParsing).Content | bash

# 方法 3: 分步执行
$script = Invoke-WebRequest -Uri https://cursor.com/install -UseBasicParsing
$script.Content | Out-File -FilePath "$env:TEMP\cursor-install.sh" -Encoding utf8
bash "$env:TEMP\cursor-install.sh"
```

## 验证安装

安装完成后，验证 Cursor CLI 是否安装成功：

```powershell
cursor-agent --version
```

如果命令未找到，可能需要将安装目录添加到 PATH：

```powershell
# 临时添加（当前会话）
$env:Path += ";$HOME\.local\bin"

# 永久添加（需要管理员权限）
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$HOME\.local\bin", "User")
```

## 关于输出抑制问题的进一步诊断

如果问题持续存在，可以尝试：

1. **检查 PowerShell 配置文件**：
   ```powershell
   $PROFILE
   Test-Path $PROFILE
   ```

2. **重置输出编码**：
   ```powershell
   $OutputEncoding = [System.Text.Encoding]::UTF8
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
   ```

3. **使用不同的输出方法**：
   ```powershell
   # 尝试不同的输出方式
   Write-Host "测试" -ForegroundColor Green
   Write-Output "测试"
   [Console]::WriteLine("测试")
   "测试" | Out-Host
   ```

4. **检查是否有输出重定向**：
   ```powershell
   Get-Command | Where-Object { $_.Name -like "*Out*" }
   ```

## 临时解决方案

如果所有方法都无法解决输出问题，建议：

1. 使用外部 PowerShell 窗口执行命令
2. 使用 Python 脚本作为中间工具
3. 直接在浏览器中查看安装脚本内容
4. 手动复制安装脚本内容并执行
