---
title: 配置 Windows 的局域网 SSH 访问
date: "2025-12-01 00:05:00"
tags: [Windows, docs]
category: blog
---
Windows 10 1809 起，自带可选的 OpenSSH 服务器功能，经过简单配置即可作为 SSH 服务器使用。

<!-- more -->

本文教程尽可能从简，目的是提供一个最小化的配置案例，减轻后续维护难度以及避免系统配置造成的差异。

1. 打开可选功能，搜索 OpenSSH，安装 OpenSSH 服务器功能，不需要重启

2. 生成或者复制一个用于登录的公钥，例如 id\_ed25519.pub

3. 把 id\_ed25519.pub 作为 SSH 服务器的认证公钥复制为 `~\.ssh\authorized_keys`

4. 配置服务器信息，编辑 `%ProgramData%\ssh\sshd_config`，设置 `Port 233`，`PubkeyAuthentication yes`，`AuthorizedKeysFile .ssh/authorized_keys`，`PasswordAuthentication no`，其中 233 是 SSH 服务端口号，不要和 Linux 或者 Windows 的服务冲突

5. PowerShell 执行 `Restart-Service sshd` 重启服务

6. PowerShell 执行 `New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP-Custom-Port' -DisplayName 'OpenSSH Server (sshd) Custom Port' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 234` 开放 Windows 防火墙，注意端口号自行修改为第四步设置的

7. PowerShell 执行 `Set-Service -Name "sshd" -StartupType Automatic` 设置 sshd 服务开机自启动

8. 可选，PowerShell 执行 `New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Program Files\PowerShell\7\pwsh.exe" -PropertyType String -Force` 可以修改默认 Shell，注意路径必须是绝对路径
