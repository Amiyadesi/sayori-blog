#!/usr/bin/env bash
# 家庭服务器一键恢复：mihomo 代理 -> tailscale -> fast-note-sync
# 只做「启动容器 / 重启服务 / 读日志」，不删除文件、不改配置、不改密码、不重启机器。

set -u

say() { printf '\n===== %s =====\n' "$*"; }
code_of() { local c; c=$(curl -s -o /dev/null -m "$2" -w '%{http_code}' "$@" 2>/dev/null) || true; printf '%s' "${c:-000}"; }

say "0. 本机信息"
date
hostname
uname -r

say "1. DNS 检查"
if getent hosts blog.sayori.org >/dev/null 2>&1; then
  echo "DNS: OK"
else
  echo "DNS: 解析失败（可能 mihomo 兼做 DNS，修好它会一起恢复）"
fi

say "2. mihomo 当前状态"
sudo docker ps -a --format '{{.Names}}  {{.Status}}' | grep -i mihomo || echo "（没有 mihomo 容器）"

say "3. 启动 mihomo"
sudo docker start mihomo 2>/dev/null || echo "（start 失败或容器不存在）"
sleep 8
sudo docker ps --format '{{.Names}}  {{.Status}}' | grep -i mihomo || echo "（仍未运行）"

say "4. 代理连通测试（最多重试 3 次）"
PROXY_OK=0
i=1
while [ "$i" -le 3 ]; do
  c=$(curl -s -o /dev/null -m 10 -w '%{http_code}' -x http://172.18.0.2:7890 https://www.google.com 2>/dev/null) || true
  c=${c:-000}
  echo "第 $i 次: $c"
  if [ "$c" = "200" ]; then PROXY_OK=1; break; fi
  i=$((i+1))
  sleep 4
done

if [ "$PROXY_OK" != "1" ]; then
  say "代理仍然不通，收集 mihomo 信息（tailscale 先不动）"
  sudo docker inspect mihomo --format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} finished={{.State.FinishedAt}}' 2>/dev/null || echo "（无此容器）"
  echo "--- 最近 30 行日志 ---"
  sudo docker logs --tail 30 mihomo 2>&1 | tail -30
  echo "--- 7890/7891 监听 ---"
  sudo ss -tlnp 2>/dev/null | grep -E ':(7890|7891)' || echo "（无监听）"
  echo "--- 尝试过的 compose 目录 ---"
  sudo ls -d /root/sayori /srv/mihomo /opt/mihomo /root/mihomo 2>/dev/null || echo "（都不存在）"
  say "结束：代理未恢复，请把以上全部内容截图发回"
  exit 0
fi

say "5. 代理已通，重启 tailscale"
sudo systemctl restart tailscaled
sleep 8
sudo tailscale status | head -4
if sudo tailscale status 2>&1 | grep -qi "logged out"; then
  echo ">>> 需要登录：下面会打印一个链接，请发给机主本人点开确认"
  timeout 30 sudo tailscale up 2>&1 | head -5
fi

say "6. 拉起笔记同步服务"
if [ -d /srv/fast-note-sync ]; then
  cd /srv/fast-note-sync || true
  sudo docker compose up -d 2>/dev/null || sudo docker-compose up -d 2>/dev/null || echo "（compose 启动失败）"
else
  echo "（/srv/fast-note-sync 不存在）"
fi
i=1
while [ "$i" -le 8 ]; do
  sleep 5
  c=$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:9000/ 2>/dev/null) || true
  c=${c:-000}
  echo "同步服务第 $i 次探测: $c"
  if [ "$c" != "000" ]; then break; fi
  i=$((i+1))
done

say "7. 最终汇总"
sudo docker ps -a --format '{{.Names}}  {{.Status}}' | grep -iE 'mihomo|fast-note|cloudflared' || echo "（无相关容器）"
echo
sudo tailscale status | head -3
echo
c=$(curl -s -o /dev/null -m 8 -w '%{http_code}' -x http://172.18.0.2:7890 https://www.google.com 2>/dev/null) || true
echo "proxy=${c:-000}"
c=$(curl -s -o /dev/null -m 8 -w '%{http_code}' http://127.0.0.1:9000/ 2>/dev/null) || true
echo "sync=${c:-000}"

echo
echo "===== 结束：请把以上全部内容拍照发回 ====="
