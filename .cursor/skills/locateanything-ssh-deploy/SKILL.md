---
name: locateanything-ssh-deploy
description: Deploy LocateAnything-3B on kdsvgm5 via SSH. Use the global skill copy on this machine.
---

# 项目内指针

本机已安装**全局** Skill，任意 Cursor 项目均可使用：

- **Skill**：`%USERPROFILE%\.cursor\skills\locateanything-ssh-deploy\SKILL.md`
- **一键部署**：

```powershell
& "$env:USERPROFILE\.cursor\skills\locateanything-ssh-deploy\scripts\deploy-to-kdsvgm5.ps1"
```

仓库内脚本（等价）：`locateanything-service\scripts\deploy-to-kdsvgm5.ps1`

完整说明见全局 Skill 文件。
