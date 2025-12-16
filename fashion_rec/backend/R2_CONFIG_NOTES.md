# R2配置说明

## 核心配置

代码使用 `URLLib3Session` + `socket_options` 解决SSL EOF问题：

```python
# services/storage.py - get_r2_client()
socket_options = [
    (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
    (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),
]

http_client = URLLib3Session(
    verify=True,
    socket_options=socket_options,
    max_pool_connections=10,
    proxies=None  # 避免使用系统代理
)
```

## 问题原因

- boto3默认使用requests库，在处理R2的SSL连接时会出现EOF错误
- 使用URLLib3Session（基于urllib3）+ socket_options可以解决
- socket_options保持连接稳定，避免SSL握手过程中的连接中断

## 注意事项

- 代码已通过socket_options解决SSL问题，即使有VPN/代理也能正常工作
- 如果使用VPN，建议配置分流规则让R2流量直连以获得更好性能

