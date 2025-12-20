# FROM ubuntu:20.04
# 个人 shell 环境
apt update ; \
apt install -y git && cd; \
git clone --depth 1 https://gitee.com/city945/oh-my-ubuntu.git ~/.oh-my-ubuntu && \
bash .oh-my-ubuntu/install && rm -rf .oh-my-ubuntu

# node
apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# markdown-siyuaner
npm config set registry https://registry.npmmirror.com
npm install -g yo generator-code vsce # need VPN

rm -rf /var/lib/apt/lists/ && cd && rm -rf .cache .vscode* .npm
